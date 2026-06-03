// battle/ai.js — 敌方决策（Task B4）
//
// 纯逻辑模块：不得 import three，不得触碰 DOM。
// 仅依赖 battleState 提供的辅助函数（由 battleController 注入），
// 必要时退化到内置曼哈顿几何，使 AI 在测试夹具下也可独立运行。
//
// 契约（plan §1.8 + 任务说明）：
//   planTurn(enemyUnit, battleState)
//     -> [ {kind:'move', to:{c,r}} | {kind:'attack', targetId} ]
//
//   * 返回“计划”，不修改任何状态——执行交给 controller。
//   * battleState 至少应提供：
//       units                          : Unit[]
//       map                            : {cols,rows,tiles}
//       occupied                       : Set<"c,r">（可选；fallback 会自建）
//       reachable(unit)                : Map<"c,r",cost>（含起点，cost<=mov）
//       path(from,to)                  : [{c,r}...]（含端点；不可达返回 [] / null）
//       inAttackRange(attacker,def)    : bool（按 attacker.atkRange 曼哈顿判定）
//
// 行为（按 enemyUnit.ai）：
//   'reckless'   ：朝最近存活 wei 移动（沿 path 走到 reachable 内最靠近目标处），
//                  移动后若有 wei 进入攻击范围则攻击（优先相克有利、其次低残血）。
//   'cautious'   ：若本回合可击杀某 wei（估算 dmg>=curHp）则移动+攻击该目标；
//                  否则待机（返回 []）。同样可击杀时优先相克有利者。
//   'guard'      ：守原地，从不追击（不产出 move）；仅当 wei 已在攻击范围内才攻击。
//   其它/未知    ：等同 'reckless'（保守的“会动会打”默认）。
//
// 相克：优先使用 battleState.triangleMul(atkClass,defClass)（由 controller 注入，
// 即 battle/classTriangle.js 的同名函数）；未注入时退化为本文件的 §1.2 基线表，
// 以避免对并行开发中的 classTriangle 模块产生硬加载依赖。

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
    case 'cautious':
      return planCautious(enemyUnit, battleState, weis);
    case 'reckless':
    case 'strategist': // v1：智将策略尚未细化，先按 reckless 逼近交战
    default:
      return planReckless(enemyUnit, battleState, weis);
  }
}

export default { planTurn };
