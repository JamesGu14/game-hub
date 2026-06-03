// tests/ai.test.mjs — Task B4 敌方 AI 决策（纯逻辑，无 Three.js / 无 DOM）
//
// 运行：node games/caocao-zhuan/tests/ai.test.mjs
//
// 契约（plan §1.8 + 任务说明）：
//   planTurn(enemyUnit, battleState)
//     -> [ {kind:'move', to:{c,r}} | {kind:'attack', targetId} ]
//   - 返回的是“计划”，planTurn 不得修改任何状态（controller 负责执行）。
//   - battleState 至少提供：
//       units            : Unit[]
//       map              : {cols,rows,tiles}
//       occupied         : Set<"c,r">
//       reachable(unit)  : Map<"c,r",cost>（含起点，cost<=mov，已绕开占用/不可通行）
//       path(from,to)    : [{c,r}...]（含起点与终点；不可达返回 [] 或 null）
//       inAttackRange(attacker, defender) : bool（按 attacker.atkRange 曼哈顿判定）
//
// 行为（按 enemyUnit.ai）：
//   reckless ：朝最近存活 wei 单位移动（沿 path 走到 reachable 内最深处），移动后若有 wei 在攻击范围则攻击。
//   cautious ：若本回合可击杀某 wei（估算 dmg>=curHp）则移动+攻击；否则待机（[]）。优先相克有利目标。
//   guard    ：守在原地；仅当 wei 单位进入攻击范围才攻击；从不追击（不产出 move）。

import assert from 'node:assert';
import { planTurn } from '../src/battle/ai.js';

// ---- 小工具：构造一行/网格地图与 battleState 辅助函数 ----

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

// 极简 battleState：直线/网格上按 mov 半径给 reachable，path 走直线（先列后行），
// inAttackRange 按 attacker.atkRange[min,max] 曼哈顿判定。
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
      // BFS 半径 = unit.mov，按曼哈顿步数 1 每格（测试地图均为可通行平地）
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
          if (occupied.has(k)) continue; // 不能停在别的单位上
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
      // 直线曼哈顿路径：先调列、再调行（够测试用）
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
  };
}

let passed = 0;
function ok(msg) { passed++; console.log('  ok -', msg); }

// ---------------------------------------------------------------------------
// 测试 1：reckless 朝最近的 wei 移动，并在移动后（若到达攻击范围）攻击。
// 1×N 直线：敌 @c=6（mov=3），wei @c=0。敌应向左移动到 reachable 最深处（c=3）。
// 此时与 wei 距离 3 > atkRange1，不应攻击。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const enemy = mkUnit({ id: 'e1', faction: 'foe', ai: 'reckless', pos: { c: 6, r: 0 }, mov: 3 });
  const wei = mkUnit({ id: 'w1', faction: 'wei', pos: { c: 0, r: 0 } });
  const st = makeState([enemy, wei], map);

  const plan = planTurn(enemy, st);
  assert.ok(Array.isArray(plan), 'plan is array');
  const move = plan.find((a) => a.kind === 'move');
  assert.ok(move, 'reckless produces a move');
  // 朝 wei（向左）逼近：终点列应 < 起点列，且在 mov 半径内
  assert.ok(move.to.c < enemy.pos.c, 'reckless moves toward the wei (leftward)');
  assert.ok(st.reachable(enemy).has(`${move.to.c},${move.to.r}`), 'move target within reachable');
  // 距离仍 >1，本回合不应攻击
  assert.ok(!plan.some((a) => a.kind === 'attack'), 'no attack when still out of range after move');
  // planTurn 不得修改状态
  assert.equal(enemy.pos.c, 6, 'planTurn did not mutate enemy.pos');
  ok('reckless moves toward nearest wei, no premature attack');
}

// ---------------------------------------------------------------------------
// 测试 2：reckless 移动后进入攻击范围 → 计划里应包含 attack(targetId=该 wei)。
// 1×N：敌 @c=4 (mov=3)，wei @c=0 → 可走到 c=1，与 wei 相邻 → 攻击。
// ---------------------------------------------------------------------------
{
  const map = gridMap(6, 1);
  const enemy = mkUnit({ id: 'e2', faction: 'foe', ai: 'reckless', pos: { c: 4, r: 0 }, mov: 3 });
  const wei = mkUnit({ id: 'w2', faction: 'wei', pos: { c: 0, r: 0 } });
  const st = makeState([enemy, wei], map);

  const plan = planTurn(enemy, st);
  const move = plan.find((a) => a.kind === 'move');
  const atk = plan.find((a) => a.kind === 'attack');
  assert.ok(move, 'reckless moves');
  assert.equal(move.to.c, 1, 'reckless stops adjacent to wei (c=1)');
  assert.ok(atk, 'reckless attacks after closing range');
  assert.equal(atk.targetId, 'w2', 'attack targets the wei unit by id');
  ok('reckless closes and attacks adjacent wei');
}

// ---------------------------------------------------------------------------
// 测试 3：guard 在没有 wei 进入攻击范围时不移动（返回 []，不追击）。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const enemy = mkUnit({ id: 'g1', faction: 'foe', ai: 'guard', pos: { c: 6, r: 0 }, mov: 3 });
  const wei = mkUnit({ id: 'w3', faction: 'wei', pos: { c: 0, r: 0 } });
  const st = makeState([enemy, wei], map);

  const plan = planTurn(enemy, st);
  assert.ok(Array.isArray(plan), 'guard plan is array');
  assert.ok(!plan.some((a) => a.kind === 'move'), 'guard does not move when no enemy in range');
  assert.ok(!plan.some((a) => a.kind === 'attack'), 'guard does not attack distant enemy');
  ok('guard holds when no wei in attack range');
}

// ---------------------------------------------------------------------------
// 测试 4：guard 在 wei 已处于攻击范围时攻击（不移动）。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const enemy = mkUnit({ id: 'g2', faction: 'foe', ai: 'guard', pos: { c: 5, r: 0 }, mov: 3 });
  const wei = mkUnit({ id: 'w4', faction: 'wei', pos: { c: 4, r: 0 } }); // 相邻
  const st = makeState([enemy, wei], map);

  const plan = planTurn(enemy, st);
  assert.ok(!plan.some((a) => a.kind === 'move'), 'guard stays put');
  const atk = plan.find((a) => a.kind === 'attack');
  assert.ok(atk && atk.targetId === 'w4', 'guard attacks adjacent intruder');
  ok('guard attacks wei already in range without moving');
}

// ---------------------------------------------------------------------------
// 测试 5：cautious 可一击击杀的残血 wei → 移动+攻击；否则待机。
// 残血 wei (curHp=1) 相邻一格之外，敌 atk 足以击杀。
// ---------------------------------------------------------------------------
{
  const map = gridMap(6, 1);
  const enemy = mkUnit({ id: 'c1', faction: 'foe', ai: 'cautious', pos: { c: 3, r: 0 }, mov: 3, atk: 30 });
  const wei = mkUnit({ id: 'w5', faction: 'wei', pos: { c: 0, r: 0 }, curHp: 1, def: 0 });
  const st = makeState([enemy, wei], map);

  const plan = planTurn(enemy, st);
  const atk = plan.find((a) => a.kind === 'attack');
  assert.ok(atk && atk.targetId === 'w5', 'cautious goes for the killable wei');
  ok('cautious engages a killable wei');
}

// ---------------------------------------------------------------------------
// 测试 6：cautious 无可击杀目标 → 待机（[]）。
// 满血 wei 防御高，敌单次伤害远不足以击杀。
// ---------------------------------------------------------------------------
{
  const map = gridMap(6, 1);
  const enemy = mkUnit({ id: 'c2', faction: 'foe', ai: 'cautious', pos: { c: 3, r: 0 }, mov: 3, atk: 8 });
  const wei = mkUnit({ id: 'w6', faction: 'wei', pos: { c: 0, r: 0 }, curHp: 60, def: 30 });
  const st = makeState([enemy, wei], map);

  const plan = planTurn(enemy, st);
  assert.deepEqual(plan, [], 'cautious holds when no kill is available');
  ok('cautious holds when no killable target');
}

// ---------------------------------------------------------------------------
// 测试 7：planTurn 不修改 battleState（防御性：再次调用结果一致）。
// ---------------------------------------------------------------------------
{
  const map = gridMap(8, 1);
  const enemy = mkUnit({ id: 'e7', faction: 'foe', ai: 'reckless', pos: { c: 6, r: 0 }, mov: 3 });
  const wei = mkUnit({ id: 'w7', faction: 'wei', pos: { c: 0, r: 0 } });
  const st = makeState([enemy, wei], map);

  const a = planTurn(enemy, st);
  const b = planTurn(enemy, st);
  assert.deepEqual(a, b, 'planTurn is pure: identical output on repeat');
  assert.equal(enemy.pos.c, 6, 'enemy unchanged');
  assert.equal(st.occupied.size, 2, 'occupied set unchanged');
  ok('planTurn is non-mutating / repeatable');
}

console.log(`\nai.test.mjs: all ${passed} checks passed`);
