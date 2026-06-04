// battle/ai.js — 敌方决策（Task B4 + P2-C2 智将 / 计略感知）
//
// 纯逻辑模块：不得 import three，不得触碰 DOM。
// 仅依赖 battleState 提供的辅助函数（由 battleController 注入），
// 必要时退化到内置曼哈顿几何，使 AI 在测试夹具下也可独立运行。
//
// 计略感知依赖（均为纯逻辑/纯数据，符合“不触碰 three/DOM”约束）：
//   data/skills.js     —— SKILLS 计略库（按 id 取 SkillDef）
//   battle/skillEngine —— skillTargets / aoeCells / resolveSkill（合法施法格、AOE、结算）
//   battle/statuses    —— statMods（评估缺血友军时一并感知增减益，无相关状态恒等 ×1）
//
// 契约（plan §1.8 + §1.5 + 任务说明）：
//   planTurn(enemyUnit, battleState)
//     -> [ {kind:'move', to:{c,r}}
//        | {kind:'attack', targetId}
//        | {kind:'skill', skillId, targetCell:{c,r}} ]   // P2 新增计略动作
//
//   * 返回“计划”，不修改任何状态——执行交给 controller。
//   * battleState 至少应提供：
//       units                          : Unit[]
//       map                            : {cols,rows,tiles}
//       occupied                       : Set<"c,r">（可选；fallback 会自建）
//       reachable(unit)                : Map<"c,r",cost>（含起点，cost<=mov）
//       path(from,to)                  : [{c,r}...]（含端点；不可达返回 [] / null）
//       inAttackRange(attacker,def)    : bool（按 attacker.atkRange 曼哈顿判定）
//   * 计略次数：优先 battleState.remainingUses(unit,skillId)（可选注入），
//       否则读 unit._skillUses[skillId]，再退化 SKILLS[skillId].uses。
//
// 行为（按 enemyUnit.ai）：
//   'reckless'   ：朝最近存活 wei 移动（沿 path 走到 reachable 内最靠近目标处），
//                  移动后若有 wei 进入攻击范围则攻击（优先相克有利、其次低残血）。
//                  若持有“明显划算”的伤害计略（当前射程内即可命中多个/可击杀）则改放计略（轻量）。
//   'cautious'   ：若本回合可击杀某 wei（估算 dmg>=curHp）则移动+攻击该目标；
//                  否则待机（返回 []）。可先用一发明显划算的伤害计略（轻量）。
//   'guard'      ：守原地，从不追击（不产出 move）；仅当 wei 已在攻击范围内才攻击。
//   'strategist' ：智将（plan §1.5）。每回合按优先级：
//                  ① 评估每个伤害计略在各落点的 AOE 价值（覆盖 wei 期望总伤 + 可击杀加成），
//                     价值划算且射程内（必要时先移动进位）则施放；
//                  ② 否则群疗/治疗缺血友军（缺失 HP > 阈值）；
//                  ③ 否则对最强 wei 威胁下控场/弱体（confuse/weaken/root，必要时先进位）；
//                  ④ 否则走位到安全施法射程（拉开与最近 wei 的距离）。
//   其它/未知    ：等同 'reckless'（保守的“会动会打”默认）。
//
// 相克：优先使用 battleState.triangleMul(atkClass,defClass)（由 controller 注入，
// 即 battle/classTriangle.js 的同名函数）；未注入时退化为本文件的 §1.2 基线表，
// 以避免对并行开发中的 classTriangle 模块产生硬加载依赖。

import { SKILLS } from '../data/skills.js';
import { skillTargets, aoeCells, resolveSkill } from './skillEngine.js';
import { statMods } from './statuses.js';

// ---------------------------------------------------------------------------
// 几何 / 辅助（内置 fallback，仅当 battleState 未提供对应 helper 时使用）
// ---------------------------------------------------------------------------

const key = (c, r) => `${c},${r}`;
const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

function isAlive(u) {
  return u && u.alive !== false && (u.curHp === undefined || u.curHp > 0);
}

// 敌方眼中的“敌人”= wei 阵营存活单位
function livingWeiUnits(state) {
  return state.units.filter((u) => u.faction === 'wei' && isAlive(u));
}

// fallback：按 attacker.atkRange 曼哈顿判定是否可攻击（从 attacker.pos 或给定坐标）
function inRangeFrom(attacker, fromPos, defender) {
  const [mn, mx] = attacker.atkRange || [1, 1];
  if (mx <= 0) return false; // 空攻击区间（理论上不存在的攻方）
  const d = manhattan(fromPos, defender.pos);
  return d >= mn && d <= mx;
}

function callInAttackRange(state, attacker, defender) {
  if (typeof state.inAttackRange === 'function') {
    return state.inAttackRange(attacker, defender);
  }
  return inRangeFrom(attacker, attacker.pos, defender);
}

// 取 reachable：Map<"c,r",cost>。fallback 给出仅含起点的退化集合（即不能移动）。
function callReachable(state, unit) {
  if (typeof state.reachable === 'function') {
    const m = state.reachable(unit);
    if (m && typeof m.has === 'function') return m;
  }
  return new Map([[key(unit.pos.c, unit.pos.r), 0]]);
}

function callPath(state, from, to) {
  if (typeof state.path === 'function') {
    const p = state.path(from, to);
    return Array.isArray(p) ? p : [];
  }
  // fallback：先列后行的曼哈顿直线
  const p = [{ c: from.c, r: from.r }];
  let c = from.c, r = from.r;
  while (c !== to.c) { c += to.c > c ? 1 : -1; p.push({ c, r }); }
  while (r !== to.r) { r += to.r > r ? 1 : -1; p.push({ c, r }); }
  return p;
}

// §1.2 基线相克表（fallback）：攻方 -> { 守方: 系数 }，缺省 1.0。
// strategist 作守方被物理打 1.2（脆）。
const TRIANGLE = {
  spear: { cavalry: 1.5 },
  cavalry: { archer: 1.4, infantry: 1.3, spear: 0.7 },
  archer: { infantry: 1.3, cavalry: 0.8 },
};

function fallbackTriangle(atkClass, defClass) {
  if (defClass === 'strategist') {
    const base = (TRIANGLE[atkClass] && TRIANGLE[atkClass][defClass]) ?? 1.0;
    // 谋士守方脆：与具体相克取较高者，至少 1.2
    return Math.max(base, 1.2);
  }
  return (TRIANGLE[atkClass] && TRIANGLE[atkClass][defClass]) ?? 1.0;
}

// 相克系数：优先 battleState 注入的 triangleMul，否则退化基线表。
function tri(state, attacker, defender) {
  try {
    if (state && typeof state.triangleMul === 'function') {
      const m = state.triangleMul(attacker.classId, defender.classId);
      if (Number.isFinite(m)) return m;
    }
  } catch {
    /* 退化 */
  }
  return fallbackTriangle(attacker.classId, defender.classId);
}

// 轻量伤害估算（AI 内部用于“能否击杀 / 谁更划算”，非权威结算）。
// 与 combat 同向：atk×triangle − def，下限 1。地形未在估算中精确建模（保守）。
function estimateDamage(state, attacker, defender) {
  const base = (attacker.atk ?? 0) * tri(state, attacker, defender) - (defender.def ?? 0);
  return Math.max(1, Math.round(base));
}

// 从一组“候选站位坐标”里挑出能攻击到 defender 的最佳站位。
// 返回 {c,r} 或 null。优先：能打到 && cost 最小（reachable 的值）。
function tileToHitFrom(reach, attacker, defender) {
  let best = null;
  let bestCost = Infinity;
  for (const [k, cost] of reach) {
    const [c, r] = k.split(',').map(Number);
    if (inRangeFrom(attacker, { c, r }, defender) && cost < bestCost) {
      bestCost = cost;
      best = { c, r };
    }
  }
  return best;
}

// reachable 内“离 target 最近”的落点（沿 path 逼近：取 reachable 与 path 的交集里最深处）。
// 优先沿 state.path 行走以遵循寻路；若 path 不可用则取 reachable 内曼哈顿最近格。
function stepToward(state, unit, target) {
  const reach = callReachable(state, unit);
  // 1) 优先：reachable 内能直接攻击 target 的落点
  const hitTile = tileToHitFrom(reach, unit, target);
  if (hitTile) return hitTile;

  // 2) 沿 path 走到 reachable 内最深的一格
  const p = callPath(state, unit.pos, target.pos);
  if (p && p.length > 1) {
    let chosen = null;
    for (const step of p) {
      const k = key(step.c, step.r);
      if (reach.has(k)) chosen = step; // path 上仍可达的最后一格
      else break; // path 一旦超出可达范围就停（避免跳过阻挡）
    }
    if (chosen && (chosen.c !== unit.pos.c || chosen.r !== unit.pos.r)) {
      return { c: chosen.c, r: chosen.r };
    }
  }

  // 3) fallback：reachable 内曼哈顿离 target 最近、且非原地的格
  let best = null;
  let bestDist = manhattan(unit.pos, target.pos);
  for (const [k] of reach) {
    const [c, r] = k.split(',').map(Number);
    if (c === unit.pos.c && r === unit.pos.r) continue;
    const d = manhattan({ c, r }, target.pos);
    if (d < bestDist) { bestDist = d; best = { c, r }; }
  }
  return best; // 可能为 null（无处可去 / 已是最近）
}

// 最近的存活 wei（按曼哈顿；并列时取 id 字典序保证确定性）
function nearestWei(unit, weis) {
  let best = null;
  let bestD = Infinity;
  for (const w of weis) {
    const d = manhattan(unit.pos, w.pos);
    if (d < bestD || (d === bestD && best && String(w.id) < String(best.id))) {
      bestD = d;
      best = w;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// 行为实现
// ---------------------------------------------------------------------------

// reckless：逼近最近 wei，移动后若能攻击则攻击（攻击目标在“移动后能打到的 wei”里
// 选相克最有利、其次估算伤害最高者）。
function planReckless(enemy, state, weis) {
  const plan = [];
  const target = nearestWei(enemy, weis);
  if (!target) return plan;

  // 决定落点
  let standPos = { c: enemy.pos.c, r: enemy.pos.r };
  const step = stepToward(state, enemy, target);
  if (step) {
    plan.push({ kind: 'move', to: { c: step.c, r: step.r } });
    standPos = step;
  }

  // 移动后从 standPos 选择攻击目标
  const victim = pickAttackTarget(state, enemy, standPos, weis);
  if (victim) plan.push({ kind: 'attack', targetId: victim.id });
  return plan;
}

// cautious：仅在“本回合可击杀”时出手（移动到能打到的格 + 攻击）；否则待机。
function planCautious(enemy, state, weis) {
  // 收集可击杀候选：站位可达 && 估算伤害>=curHp
  const candidates = [];
  const reachMap = callReachable(state, enemy);
  for (const w of weis) {
    const stand = tileToHitFrom(reachMap, enemy, w);
    // 也允许原地就能打到的情形（stand 可能是原地）
    const standPos = stand || (inRangeFrom(enemy, enemy.pos, w) ? { c: enemy.pos.c, r: enemy.pos.r } : null);
    if (!standPos) continue;
    const dmg = estimateDamage(state, enemy, w);
    if (dmg >= (w.curHp ?? w.maxHp ?? Infinity)) {
      candidates.push({ w, standPos, dmg, mul: tri(state, enemy, w) });
    }
  }
  if (candidates.length === 0) return []; // 无可击杀 → 待机

  // 优先相克有利（mul 大），其次伤害高，再按 id 稳定
  candidates.sort((a, b) =>
    b.mul - a.mul || b.dmg - a.dmg || String(a.w.id).localeCompare(String(b.w.id)));
  const best = candidates[0];

  const plan = [];
  if (best.standPos.c !== enemy.pos.c || best.standPos.r !== enemy.pos.r) {
    plan.push({ kind: 'move', to: { c: best.standPos.c, r: best.standPos.r } });
  }
  plan.push({ kind: 'attack', targetId: best.w.id });
  return plan;
}

// guard：从不移动；仅当某 wei 已在原地攻击范围内才攻击（选相克/伤害最优）。
function planGuard(enemy, state, weis) {
  const inRange = weis.filter((w) => callInAttackRange(state, enemy, w));
  if (inRange.length === 0) return [];
  const victim = pickBest(state, enemy, inRange);
  return victim ? [{ kind: 'attack', targetId: victim.id }] : [];
}

// 从“移动后站位 standPos 能打到的 wei”里挑最优目标
function pickAttackTarget(state, enemy, standPos, weis) {
  const reachable = weis.filter((w) => inRangeFrom(enemy, standPos, w));
  return pickBest(state, enemy, reachable);
}

// 选最优受击者：相克系数最高 → 估算伤害最高 → curHp 最低 → id 稳定
function pickBest(state, enemy, list) {
  if (!list.length) return null;
  const scored = list.map((w) => ({ w, mul: tri(state, enemy, w), dmg: estimateDamage(state, enemy, w) }));
  scored.sort((a, b) =>
    b.mul - a.mul ||
    b.dmg - a.dmg ||
    (a.w.curHp ?? 0) - (b.w.curHp ?? 0) ||
    String(a.w.id).localeCompare(String(b.w.id)));
  return scored[0].w;
}

// ---------------------------------------------------------------------------
// 计略感知（P2-C2）：剩余次数、确定性评估、候选落点打分
// ---------------------------------------------------------------------------

// 评估期用的确定性 rng：取抖动区间中点，使 resolveSkill 的伤害/治疗可重复（便于打分/测试）。
const MID_RNG = () => 0.5;

// 智将治疗阈值：友军缺失 HP 超过其上限的此比例才考虑治疗。
const HEAL_HP_THRESHOLD = 0.3;
// 残血可击杀的额外价值加成（鼓励 AOE 收掉残血）。
const KILL_BONUS = 1000;
// 伤害计略“值得施放”的最低期望总伤（避免空放）。
const DMG_WORTH_MIN = 1;

// 某单位某技能的剩余次数：优先注入的 remainingUses，其次 unit._skillUses，最后 SKILLS 默认。
function remainingUses(state, unit, skillId) {
  if (state && typeof state.remainingUses === 'function') {
    const n = state.remainingUses(unit, skillId);
    if (Number.isFinite(n)) return n;
  }
  if (unit && unit._skillUses && unit._skillUses[skillId] != null) {
    return unit._skillUses[skillId];
  }
  const def = SKILLS[skillId];
  return def && typeof def.uses === 'number' ? def.uses : 0;
}

// 该单位当前可用（持有 & 次数>0 & 已知定义）的某类计略 id 列表，按指定 kind 过滤。
function usableSkills(state, unit, kinds) {
  const set = Array.isArray(kinds) ? new Set(kinds) : null;
  const ids = Array.isArray(unit.skills) ? unit.skills : [];
  const out = [];
  for (const id of ids) {
    const def = SKILLS[id];
    if (!def) continue;
    if (set && !set.has(def.kind)) continue;
    if (remainingUses(state, unit, id) <= 0) continue;
    out.push(id);
  }
  return out;
}

// 以 caster 站在 fromPos（默认其当前格）为前提，构造一个“位移视角”的 caster 副本，
// 供 skillEngine 用真实 caster.pos 计算射程/AOE。返回 {c,r} 不变的浅拷贝（不 mutate 原 unit）。
function casterAt(caster, fromPos) {
  if (!fromPos || (fromPos.c === caster.pos.c && fromPos.r === caster.pos.r)) return caster;
  return { ...caster, pos: { c: fromPos.c, r: fromPos.r } };
}

// 评估某伤害计略落点对 wei 的“价值”：AOE 内 wei 期望总伤（MID_RNG 确定性）+ 可击杀加成。
// 命中 intDiff 时用期望命中率折算（不掷骰，保持确定性）。返回数值；无 wei 命中则为 0。
function scoreDamageCell(state, caster, def, targetCell, weis, map, units) {
  const cells = aoeCells(targetCell, def.area || 0, map);
  const cellKey = new Set(cells.map((p) => `${p.c},${p.r}`));
  let score = 0;
  let any = false;
  for (const w of weis) {
    if (!w.pos || !cellKey.has(`${w.pos.c},${w.pos.r}`)) continue;
    any = true;
    // 用 resolveSkill 对“仅此单位”估伤：复用引擎数值，避免在 AI 里重写公式。
    const res = resolveSkill(casterAt(caster, caster.pos), def, w.pos, [caster, w], map, MID_RNG);
    const hit = res.hits.find((h) => h.unitId === w.id);
    let dmg = hit && typeof hit.dmg === 'number' ? hit.dmg : 0;
    // intDiff 命中率折算（always 视作 100%）。
    if (def.hit === 'intDiff') {
      const ci = typeof caster.int === 'number' ? caster.int : 0;
      const ti = typeof w.int === 'number' ? w.int : 0;
      const chance = Math.max(30, Math.min(100, 85 + (ci - ti))) / 100;
      dmg *= chance;
    }
    score += dmg;
    const hp = typeof w.curHp === 'number' ? w.curHp : (w.maxHp ?? Infinity);
    if (dmg >= hp) score += KILL_BONUS; // 可击杀（按期望伤判定）
  }
  return any ? score : 0;
}

// 找“此格能否被 caster 当前射程合法选中”：用 skillEngine.skillTargets 严格校验。
function legalCellSet(caster, def, map, units) {
  const cells = skillTargets(caster, def, map, units);
  return new Set(cells.map((p) => `${p.c},${p.r}`));
}

// 在 reachable 落点里，找一个能让 caster 合法施放 def 命中 targetCell 的站位（cost 最小者）。
// targetCell 固定（按 wei 群中心/具体目标格）；返回 {standPos,legal} 或 null。
function standToCast(state, caster, def, targetCell, map, units) {
  const reach = callReachable(state, caster);
  let best = null;
  let bestCost = Infinity;
  for (const [k, cost] of reach) {
    const [c, r] = k.split(',').map(Number);
    const probe = casterAt(caster, { c, r });
    const legal = legalCellSet(probe, def, map, units);
    if (legal.has(`${targetCell.c},${targetCell.r}`) && cost < bestCost) {
      bestCost = cost;
      best = { c, r };
    }
  }
  return best;
}

// 最强 wei 威胁：按 有效atk(含增减益)×相克（对智将自身）→ atk → curHp 高 → id 稳定。
function strongestWei(state, enemy, weis) {
  if (!weis.length) return null;
  const scored = weis.map((w) => {
    const effAtk = (w.atk ?? 0) * (statMods(w).atk || 1);
    return { w, threat: effAtk * tri(state, w, enemy) + effAtk * 0.001 };
  });
  scored.sort((a, b) =>
    b.threat - a.threat ||
    (b.w.curHp ?? 0) - (a.w.curHp ?? 0) ||
    String(a.w.id).localeCompare(String(b.w.id)));
  return scored[0].w;
}

// 缺血最重的友军（同阵营存活、且缺失 HP 超阈值）。返回 unit 或 null。
function mostWoundedAlly(state, enemy) {
  let best = null;
  let bestMissing = 0;
  for (const u of state.units) {
    if (!isAlive(u) || u.faction !== enemy.faction) continue;
    const max = u.maxHp ?? u.curHp ?? 0;
    const cur = u.curHp ?? max;
    const missing = max - cur;
    if (max > 0 && missing > max * HEAL_HP_THRESHOLD && missing > bestMissing) {
      bestMissing = missing;
      best = u;
    }
  }
  return best;
}

// 评估 heal/healwave 落点（覆盖友军的“有效回血”，超出缺失量的溢出不计）。
function scoreHealCell(state, caster, def, targetCell, map, units) {
  const cells = aoeCells(targetCell, def.area || 0, map);
  const cellKey = new Set(cells.map((p) => `${p.c},${p.r}`));
  let score = 0;
  for (const u of units) {
    if (!isAlive(u) || u.faction !== caster.faction || !u.pos) continue;
    if (!cellKey.has(`${u.pos.c},${u.pos.r}`)) continue;
    const max = u.maxHp ?? u.curHp ?? 0;
    const missing = Math.max(0, max - (u.curHp ?? max));
    if (missing <= 0) continue;
    const res = resolveSkill(casterAt(caster, caster.pos), def, u.pos, [caster, u], map, MID_RNG);
    const hit = res.hits.find((h) => h.unitId === u.id);
    const heal = hit && typeof hit.heal === 'number' ? hit.heal : 0;
    score += Math.min(missing, heal); // 不计溢出
  }
  return score;
}

// 远离最近 wei 的安全走位（reachable 内曼哈顿离最近 wei 最远、非原地的落点）。
function retreatStep(state, enemy, weis) {
  const reach = callReachable(state, enemy);
  let best = null;
  let bestMin = -Infinity;
  for (const [k] of reach) {
    const [c, r] = k.split(',').map(Number);
    if (c === enemy.pos.c && r === enemy.pos.r) continue;
    let nearest = Infinity;
    for (const w of weis) nearest = Math.min(nearest, manhattan({ c, r }, w.pos));
    if (nearest > bestMin) { bestMin = nearest; best = { c, r }; }
  }
  // 仅当确实拉开了与当前最近 wei 的距离才退；否则不动。
  let curMin = Infinity;
  for (const w of weis) curMin = Math.min(curMin, manhattan(enemy.pos, w.pos));
  return best && bestMin > curMin ? best : null;
}

// 在“当前格 + reachable 落点”里，为某伤害计略找最佳 {standPos, targetCell, score}。
// 优先评估“原地不动即可施放”的落点（cost 0），鼓励智将定点输出；其余进位。
function bestDamagePlay(state, caster, weis, map, units, { allowMove = true } = {}) {
  const damageIds = usableSkills(state, caster, ['damage']);
  if (!damageIds.length) return null;

  // 候选施法者站位：原地优先；allowMove 时含 reachable。
  const reach = allowMove ? callReachable(state, caster) : new Map([[key(caster.pos.c, caster.pos.r), 0]]);

  let best = null;
  for (const id of damageIds) {
    const def = SKILLS[id];
    for (const [k, cost] of reach) {
      const [c, r] = k.split(',').map(Number);
      const probe = casterAt(caster, { c, r });
      const legalCells = skillTargets(probe, def, map, units);
      for (const cell of legalCells) {
        const score = scoreDamageCell(state, probe, def, cell, weis, map, units);
        if (score < DMG_WORTH_MIN) continue;
        const cand = { skillId: id, standPos: { c, r }, targetCell: cell, score, cost };
        if (
          !best ||
          cand.score > best.score ||
          (cand.score === best.score && cand.cost < best.cost) ||
          (cand.score === best.score && cand.cost === best.cost &&
            String(cand.skillId).localeCompare(String(best.skillId)) < 0)
        ) {
          best = cand;
        }
      }
    }
  }
  return best;
}

// 把一个“站位 + 计略 + 目标格”转成动作序列（必要时先 move，再 skill）。
function castPlan(enemy, play) {
  const plan = [];
  if (play.standPos && (play.standPos.c !== enemy.pos.c || play.standPos.r !== enemy.pos.r)) {
    plan.push({ kind: 'move', to: { c: play.standPos.c, r: play.standPos.r } });
  }
  plan.push({ kind: 'skill', skillId: play.skillId, targetCell: { c: play.targetCell.c, r: play.targetCell.r } });
  return plan;
}

// ---------------------------------------------------------------------------
// 智将（strategist）：按 plan §1.5 优先级决策
// ---------------------------------------------------------------------------

function planStrategist(enemy, state, weis) {
  const map = state.map;
  const units = state.units;

  // ① 伤害计略：评估所有计略×所有落点，挑期望价值最高者；划算则施放（必要时先进位）。
  const dmgPlay = bestDamagePlay(state, enemy, weis, map, units, { allowMove: true });
  if (dmgPlay) return castPlan(enemy, dmgPlay);

  // ② 治疗：存在缺血友军（缺失 > 阈值）→ 选 heal/healwave 中“有效回血”最高的落点。
  const wounded = mostWoundedAlly(state, enemy);
  if (wounded) {
    const healIds = usableSkills(state, enemy, ['heal']);
    let bestHeal = null;
    for (const id of healIds) {
      const def = SKILLS[id];
      const reach = callReachable(state, enemy);
      for (const [k, cost] of reach) {
        const [c, r] = k.split(',').map(Number);
        const probe = casterAt(enemy, { c, r });
        const legalCells = skillTargets(probe, def, map, units);
        for (const cell of legalCells) {
          const score = scoreHealCell(state, probe, def, cell, map, units);
          if (score <= 0) continue;
          const cand = { skillId: id, standPos: { c, r }, targetCell: cell, score, cost };
          if (!bestHeal || cand.score > bestHeal.score ||
            (cand.score === bestHeal.score && cand.cost < bestHeal.cost)) {
            bestHeal = cand;
          }
        }
      }
    }
    if (bestHeal) return castPlan(enemy, bestHeal);
  }

  // ③ 控场/弱体：对最强 wei 威胁施放 control/debuff（confuse/root/weaken），必要时先进位。
  const threat = strongestWei(state, enemy, weis);
  if (threat) {
    const ctrlIds = usableSkills(state, enemy, ['control', 'debuff']);
    // 优先级：root（定身）→ confuse（乱心）→ weaken（弱体）；同列按持有顺序。
    ctrlIds.sort((a, b) => ctrlRank(a) - ctrlRank(b));
    for (const id of ctrlIds) {
      const def = SKILLS[id];
      // 控场目标格 = 威胁所在格（AOE 控场会顺带覆盖周围 wei）。
      const tCell = { c: threat.pos.c, r: threat.pos.r };
      const stand = standToCast(state, enemy, def, tCell, map, units);
      if (stand) return castPlan(enemy, { skillId: id, standPos: stand, targetCell: tCell });
    }
  }

  // ④ 走位：拉开与最近 wei 的距离（安全施法位）；无处可退则待机。
  const back = retreatStep(state, enemy, weis);
  if (back) return [{ kind: 'move', to: { c: back.c, r: back.r } }];
  return [];
}

// 控场优先级（数字越小越先选）。
function ctrlRank(id) {
  switch (id) {
    case 'root': return 0;
    case 'confuse': return 1;
    case 'weaken': return 2;
    default: return 3;
  }
}

// 轻量计略增强：reckless/cautious 若持有“明显划算”的伤害计略（当前射程内即可命中、
// 且 AOE 多杀或单体高伤），优先放计略而非平 A。判定保守，避免空放。
function lightDamagePlay(state, enemy, weis) {
  const map = state.map;
  const units = state.units;
  // 仅评估“原地即可施放”的落点（不为放计略额外移动，保持 reckless/cautious 的本性）。
  const play = bestDamagePlay(state, enemy, weis, map, units, { allowMove: false });
  if (!play) return null;
  // “明显划算”门槛：期望可击杀（score 含 KILL_BONUS），或 AOE 覆盖 ≥2 个 wei。
  const cells = aoeCells(play.targetCell, (SKILLS[play.skillId].area || 0), map);
  const cellKey = new Set(cells.map((p) => `${p.c},${p.r}`));
  let hitCount = 0;
  for (const w of weis) if (w.pos && cellKey.has(`${w.pos.c},${w.pos.r}`)) hitCount++;
  if (play.score >= KILL_BONUS || hitCount >= 2) return play;
  return null;
}

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export function planTurn(enemyUnit, battleState) {
  if (!enemyUnit || !isAlive(enemyUnit) || !battleState || !Array.isArray(battleState.units)) {
    return [];
  }
  const weis = livingWeiUnits(battleState);
  if (weis.length === 0) return [];

  switch (enemyUnit.ai) {
    case 'guard':
      return planGuard(enemyUnit, battleState, weis);
    case 'cautious': {
      // 先看是否有“明显划算”的伤害计略（原地可施放）；否则回退到原 cautious 逻辑。
      const light = lightDamagePlay(battleState, enemyUnit, weis);
      if (light) return castPlan(enemyUnit, light);
      return planCautious(enemyUnit, battleState, weis);
    }
    case 'strategist':
      return planStrategist(enemyUnit, battleState, weis);
    case 'reckless':
    default: {
      const light = lightDamagePlay(battleState, enemyUnit, weis);
      if (light) return castPlan(enemyUnit, light);
      return planReckless(enemyUnit, battleState, weis);
    }
  }
}

export default { planTurn };
