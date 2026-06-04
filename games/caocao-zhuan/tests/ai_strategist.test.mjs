// tests/ai_strategist.test.mjs — P2-C2 智将（strategist）AI + 计略感知（纯逻辑，无 Three.js / 无 DOM）
//
// 运行：node games/caocao-zhuan/tests/ai_strategist.test.mjs
//
// 契约（plan §1.5 + 任务 C2）：
//   planTurn(enemyUnit, battleState)
//     -> [ {kind:'move', to:{c,r}}
//        | {kind:'attack', targetId}
//        | {kind:'skill', skillId, targetCell:{c,r}} ]
//   - 返回“计划”，不修改任何状态（controller 执行）。
//
// 智将（ai:'strategist'）每回合按优先级：
//   ① 伤害计略：评估各计略×各落点 AOE 价值（覆盖 wei 期望总伤 + 可击杀加成），划算则施放（必要时先进位）。
//   ② 治疗：缺血友军（缺失 HP > 阈值）→ heal/healwave。
//   ③ 控场/弱体：对最强 wei 威胁 confuse/root/weaken（必要时先进位）。
//   ④ 走位：拉开与最近 wei 的距离（安全施法位）；无处可退则待机。
//
// 单位约定（与 battleController 运行态一致）：faction 'wei' = 玩家方（敌眼中的敌人）；
//   'foe' = 敌方；skills:[id...]；_skillUses 可选（缺省按 SKILLS[id].uses）；statuses:[]。

import assert from 'node:assert';
import { planTurn } from '../src/battle/ai.js';
import { SKILLS } from '../src/data/skills.js';
import { aoeCells } from '../src/battle/skillEngine.js';

// ---- 地图 / battleState 夹具（移植自 ai.test.mjs，供独立运行）----

function gridMap(cols, rows, fill = 'grass') {
  const tiles = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) row.push(fill);
    tiles.push(row);
  }
  return { cols, rows, tiles };
}

const key = (c, r) => `${c},${r}`;
const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

function makeState(units, map) {
  const occupied = new Set();
  for (const u of units) if (u.alive !== false) occupied.add(key(u.pos.c, u.pos.r));

  function passable(c, r) {
    if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) return false;
    return map.tiles[r][c] !== 'water';
  }

  return {
    units,
    map,
    occupied,
    reachable(unit) {
      const out = new Map();
      out.set(key(unit.pos.c, unit.pos.r), 0);
      const q = [{ c: unit.pos.c, r: unit.pos.r, cost: 0 }];
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      while (q.length) {
        const cur = q.shift();
        if (cur.cost >= unit.mov) continue;
        for (const [dc, dr] of dirs) {
          const nc = cur.c + dc, nr = cur.r + dr;
          if (!passable(nc, nr)) continue;
          const k = key(nc, nr);
          if (occupied.has(k)) continue;
          const nCost = cur.cost + 1;
          if (!out.has(k) || out.get(k) > nCost) {
            out.set(k, nCost);
            q.push({ c: nc, r: nr, cost: nCost });
          }
        }
      }
      return out;
    },
    path(from, to) {
      const p = [{ c: from.c, r: from.r }];
      let c = from.c, r = from.r;
      while (c !== to.c) { c += to.c > c ? 1 : -1; p.push({ c, r }); }
      while (r !== to.r) { r += to.r > r ? 1 : -1; p.push({ c, r }); }
      return p;
    },
    inAttackRange(attacker, defender) {
      const [mn, mx] = attacker.atkRange;
      const d = manhattan(attacker.pos, defender.pos);
      return d >= mn && d <= mx;
    },
  };
}

function mkUnit(over) {
  return {
    id: over.id,
    name: over.name || over.id,
    faction: over.faction,
    classId: over.classId || 'infantry',
    atkRange: over.atkRange || [1, 1],
    atk: over.atk ?? 10,
    def: over.def ?? 5,
    int: over.int ?? 5,
    spd: over.spd ?? 5,
    mov: over.mov ?? 3,
    maxHp: over.maxHp ?? 30,
    curHp: over.curHp ?? 30,
    pos: over.pos,
    ai: over.ai ?? null,
    alive: over.alive ?? true,
    skills: over.skills || [],
    statuses: over.statuses || [],
    _skillUses: over._skillUses, // 可选；缺省按 SKILLS[id].uses
  };
}

let passed = 0;
function ok(msg) { passed++; console.log('  ok -', msg); }

// ---------------------------------------------------------------------------
// 测试 1：智将持有 'fire' + 2 个聚集的 wei → 返回 {kind:'skill',skillId:'fire',targetCell} 同时命中两者。
// 布局（grass 平地，避免地形元素乘子干扰）：
//   strategist @ (5,0)；两个 wei 在 (1,0)/(2,0) 相邻（曼哈顿距 1）→ 一个 area1 的 AOE 可同覆盖。
// fire.range=[1,3]，智将 mov=3，可先进位到 (3,0)/(4,0) 使两 wei 都进入射程。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const strat = mkUnit({
    id: 'lijru', faction: 'foe', ai: 'strategist', classId: 'strategist',
    pos: { c: 5, r: 0 }, mov: 3, int: 30, atkRange: [1, 1], skills: ['fire'],
  });
  const w1 = mkUnit({ id: 'wa', faction: 'wei', pos: { c: 1, r: 0 }, def: 2 });
  const w2 = mkUnit({ id: 'wb', faction: 'wei', pos: { c: 2, r: 0 }, def: 2 });
  const st = makeState([strat, w1, w2], map);

  const plan = planTurn(strat, st);
  assert.ok(Array.isArray(plan), 'plan is array');
  const skill = plan.find((a) => a.kind === 'skill');
  assert.ok(skill, 'strategist casts a skill');
  assert.equal(skill.skillId, 'fire', 'casts fire');
  assert.ok(skill.targetCell && typeof skill.targetCell.c === 'number', 'skill has a targetCell');

  // 该 targetCell 的 fire(area1) AOE 应同时覆盖两个 wei 的格。
  const cells = aoeCells(skill.targetCell, SKILLS.fire.area || 0, map);
  const cellSet = new Set(cells.map((p) => `${p.c},${p.r}`));
  assert.ok(cellSet.has('1,0') && cellSet.has('2,0'), 'fire AOE covers BOTH clustered wei');

  // 若需进位，move 落点应在 reachable 内、且不晚于 skill。
  const move = plan.find((a) => a.kind === 'move');
  if (move) {
    assert.ok(st.reachable(strat).has(`${move.to.c},${move.to.r}`), 'move target within reachable');
    assert.ok(plan.indexOf(move) < plan.indexOf(skill), 'move precedes skill');
  }
  // planTurn 不得 mutate
  assert.equal(strat.pos.c, 5, 'planTurn did not mutate strategist.pos');
  assert.equal(st.occupied.size, 3, 'occupied unchanged');
  ok('strategist with fire + 2 clustered wei casts fire hitting both');
}

// ---------------------------------------------------------------------------
// 测试 2：智将持有 'heal' + 一个明显缺血的友军（无伤害计略）→ 返回一个治疗计略。
//   缺血友军 curHp=5/30（缺失 25 > 阈值 30%）。智将自身满血。
//   场上有一个 wei（满血、距离较远，不在任何伤害计略射程；且智将无伤害计略）。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const strat = mkUnit({
    id: 'medic', faction: 'foe', ai: 'strategist', classId: 'strategist',
    pos: { c: 5, r: 0 }, mov: 3, int: 20, skills: ['heal'],
  });
  const hurt = mkUnit({ id: 'ally1', faction: 'foe', pos: { c: 6, r: 0 }, curHp: 5, maxHp: 30 });
  const wei = mkUnit({ id: 'we1', faction: 'wei', pos: { c: 0, r: 0 } });
  const st = makeState([strat, hurt, wei], map);

  const plan = planTurn(strat, st);
  const skill = plan.find((a) => a.kind === 'skill');
  assert.ok(skill, 'strategist casts a skill');
  assert.equal(skill.skillId, 'heal', 'casts heal on a wounded ally');
  // 目标格应是缺血友军所在格（heal area0 单体）。
  assert.equal(skill.targetCell.c, 6, 'heal aims the wounded ally cell (c)');
  assert.equal(skill.targetCell.r, 0, 'heal aims the wounded ally cell (r)');
  ok('strategist with a wounded ally returns a heal');
}

// ---------------------------------------------------------------------------
// 测试 3：无伤害/治疗可用时——有控场计略 → 对最强 wei 威胁下控场（这里 weaken）。
//   智将仅持 'weaken'（debuff，range[1,3]，area1）；两 wei，一个 atk 高（强威胁）。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const strat = mkUnit({
    id: 'hexer', faction: 'foe', ai: 'strategist', classId: 'strategist',
    pos: { c: 4, r: 0 }, mov: 3, int: 25, skills: ['weaken'],
  });
  const weak = mkUnit({ id: 'soft', faction: 'wei', pos: { c: 1, r: 0 }, atk: 6 });
  const bruiser = mkUnit({ id: 'bruiser', faction: 'wei', pos: { c: 2, r: 0 }, atk: 22 });
  const st = makeState([strat, weak, bruiser], map);

  const plan = planTurn(strat, st);
  const skill = plan.find((a) => a.kind === 'skill');
  assert.ok(skill, 'strategist casts a control/debuff skill');
  assert.equal(skill.skillId, 'weaken', 'casts weaken');
  assert.equal(skill.targetCell.c, 2, 'weaken aims the strongest threat (high-atk bruiser at c=2)');
  ok('strategist debuffs the strongest wei threat when no damage/heal play');
}

// ---------------------------------------------------------------------------
// 测试 4：无任何可用计略 → 退化为走位/攻击（不抛错、返回数组）。
//   智将无技能、附近一个 wei → 应至少产出一个动作（move 或 attack），不空崩。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const strat = mkUnit({
    id: 'mute', faction: 'foe', ai: 'strategist', classId: 'strategist',
    pos: { c: 4, r: 0 }, mov: 3, skills: [],
  });
  const wei = mkUnit({ id: 'near', faction: 'wei', pos: { c: 0, r: 0 } });
  const st = makeState([strat, wei], map);

  const plan = planTurn(strat, st);
  assert.ok(Array.isArray(plan), 'plan is array even with no skills');
  // 最近 wei 在 c=0，智将在 c=4 → 应退向右（拉开距离）或待机；无论如何不得施放计略。
  assert.ok(!plan.some((a) => a.kind === 'skill'), 'no skill cast when none usable');
  ok('strategist with no usable skill repositions/holds without error');
}

// ---------------------------------------------------------------------------
// 测试 5：次数耗尽的计略不被选用。
//   智将持 'fire' 但 _skillUses.fire=0 → 不放火计；附近无其它计略 → 退化走位/待机。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const strat = mkUnit({
    id: 'spent', faction: 'foe', ai: 'strategist', classId: 'strategist',
    pos: { c: 4, r: 0 }, mov: 3, int: 30, skills: ['fire'], _skillUses: { fire: 0 },
  });
  const w1 = mkUnit({ id: 'x1', faction: 'wei', pos: { c: 1, r: 0 } });
  const w2 = mkUnit({ id: 'x2', faction: 'wei', pos: { c: 2, r: 0 } });
  const st = makeState([strat, w1, w2], map);

  const plan = planTurn(strat, st);
  assert.ok(!plan.some((a) => a.kind === 'skill' && a.skillId === 'fire'),
    'fire not cast when uses exhausted');
  ok('strategist does not cast a skill with zero remaining uses');
}

// ---------------------------------------------------------------------------
// 测试 6：reckless 持“明显划算”的伤害计略（原地可命中 2 个 wei）→ 改放计略（轻量增强）。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const r = mkUnit({
    id: 'rk', faction: 'foe', ai: 'reckless', classId: 'strategist',
    pos: { c: 4, r: 0 }, mov: 3, int: 30, skills: ['fire'], atkRange: [1, 1],
  });
  // 两 wei 相邻且在 fire.range[1,3] 内（距 3/2），原地即可一发覆盖。
  const w1 = mkUnit({ id: 'rw1', faction: 'wei', pos: { c: 1, r: 0 }, def: 2 });
  const w2 = mkUnit({ id: 'rw2', faction: 'wei', pos: { c: 2, r: 0 }, def: 2 });
  const st = makeState([r, w1, w2], map);

  const plan = planTurn(r, st);
  const skill = plan.find((a) => a.kind === 'skill');
  assert.ok(skill && skill.skillId === 'fire', 'reckless uses an obviously-good fire on a 2-wei cluster');
  // 不应为放计略额外移动（lightDamagePlay 仅评估原地落点）。
  assert.ok(!plan.some((a) => a.kind === 'move'), 'reckless does not move just to cast (in-place play)');
  ok('reckless opportunistically casts an obviously-good damage skill');
}

// ---------------------------------------------------------------------------
// 测试 7：planTurn 对 strategist 纯（重复调用结果一致，不 mutate）。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const strat = mkUnit({
    id: 'pure', faction: 'foe', ai: 'strategist', classId: 'strategist',
    pos: { c: 5, r: 0 }, mov: 3, int: 30, skills: ['fire'],
  });
  const w1 = mkUnit({ id: 'p1', faction: 'wei', pos: { c: 1, r: 0 }, def: 2 });
  const w2 = mkUnit({ id: 'p2', faction: 'wei', pos: { c: 2, r: 0 }, def: 2 });
  const st = makeState([strat, w1, w2], map);

  const a = planTurn(strat, st);
  const b = planTurn(strat, st);
  assert.deepEqual(a, b, 'planTurn is pure: identical output on repeat');
  assert.equal(strat.pos.c, 5, 'strategist unchanged');
  assert.equal(st.occupied.size, 3, 'occupied set unchanged');
  ok('planTurn(strategist) is non-mutating / repeatable');
}

console.log(`\nai_strategist.test.mjs: all ${passed} checks passed`);
