// tests/statuses.test.mjs — 状态效果系统（纯函数，Node 直跑）
// 运行：node games/caocao-zhuan/tests/statuses.test.mjs
//
// 覆盖（plan §1.2）：
//   - applyStatus 叠加/刷新进 unit.statuses（缺省自动初始化 []）
//   - tickStatuses：poison 扣血、turns--、清理过期 -> {dmg, expired, log}
//   - statMods：增减益汇总为乘子；无相关状态时恒等（×1，向后兼容关键）
//   - canAct：confuse 影响（注入 rng 确定性）
//   - canMove：immobilize -> false
//   - 空 statuses：statMods 恒等 & tick no-op
import assert from 'node:assert';
import {
  applyStatus,
  tickStatuses,
  statMods,
  canAct,
  canMove,
} from '../src/battle/statuses.js';

// 单位工厂（仅放状态系统读取的字段）
function unit(o) {
  return { name: 'u', curHp: 30, maxHp: 30, ...o };
}

// --- 1) applyStatus 缺省初始化 statuses=[] 并写入 ---
{
  const u = unit({}); // 无 statuses 字段
  assert.strictEqual(u.statuses, undefined, 'precondition: no statuses field');
  applyStatus(u, { type: 'poison', turns: 3, magnitude: 4 });
  assert.ok(Array.isArray(u.statuses), 'applyStatus initializes statuses[]');
  assert.strictEqual(u.statuses.length, 1, 'one status applied');
  assert.strictEqual(u.statuses[0].type, 'poison', 'poison stored');
  assert.strictEqual(u.statuses[0].turns, 3, 'turns stored');
  assert.strictEqual(u.statuses[0].magnitude, 4, 'magnitude stored');
}

// --- 2) applyStatus 刷新同类型（取较强/较久，不重复堆叠条目） ---
{
  const u = unit({ statuses: [] });
  applyStatus(u, { type: 'atk_up', turns: 2, magnitude: 0.2 });
  applyStatus(u, { type: 'atk_up', turns: 3, magnitude: 0.1 });
  assert.strictEqual(u.statuses.length, 1, 'same type refreshed, not duplicated');
  const s = u.statuses[0];
  assert.strictEqual(s.turns, 3, 'turns refreshed to the longer');
  assert.ok(s.magnitude >= 0.2 - 1e-9, 'magnitude keeps the stronger');
}

// --- 3) tickStatuses：poison 扣血、turns--、过期清理 ---
{
  const u = unit({ curHp: 30, statuses: [] });
  applyStatus(u, { type: 'poison', turns: 2, magnitude: 5 });
  applyStatus(u, { type: 'atk_up', turns: 1, magnitude: 0.3 });

  const r1 = tickStatuses(u);
  assert.strictEqual(r1.dmg, 5, 'poison deals magnitude HP as dmg');
  assert.strictEqual(u.curHp, 25, 'curHp reduced by poison dmg');
  // atk_up turns 1 -> 0 过期
  assert.deepStrictEqual([...r1.expired].sort(), ['atk_up'], 'atk_up expired this tick');
  assert.ok(Array.isArray(r1.log), 'log is array');
  // poison turns 2 -> 1 仍在
  assert.strictEqual(u.statuses.length, 1, 'only poison remains');
  assert.strictEqual(u.statuses[0].type, 'poison', 'remaining is poison');
  assert.strictEqual(u.statuses[0].turns, 1, 'poison turns decremented to 1');

  const r2 = tickStatuses(u);
  assert.strictEqual(r2.dmg, 5, 'poison ticks again');
  assert.strictEqual(u.curHp, 20, 'curHp 25->20');
  assert.deepStrictEqual([...r2.expired].sort(), ['poison'], 'poison expired after second tick');
  assert.strictEqual(u.statuses.length, 0, 'all statuses cleared');
}

// --- 4) poison 不把 curHp 扣到负（地板 0） ---
{
  const u = unit({ curHp: 3, statuses: [] });
  applyStatus(u, { type: 'poison', turns: 3, magnitude: 5 });
  const r = tickStatuses(u);
  assert.strictEqual(r.dmg, 5, 'reported dmg is full magnitude');
  assert.strictEqual(u.curHp, 0, 'curHp floored at 0');
}

// --- 5) statMods：atk_up/def_down 改乘子；无相关状态恒等 ---
{
  const u = unit({ statuses: [] });
  // 空 -> 恒等
  const m0 = statMods(u);
  assert.strictEqual(m0.atk, 1, 'no statuses -> atk x1');
  assert.strictEqual(m0.def, 1, 'no statuses -> def x1');
  assert.strictEqual(m0.spd, 1, 'no statuses -> spd x1');

  applyStatus(u, { type: 'atk_up', turns: 2, magnitude: 0.25 });
  applyStatus(u, { type: 'def_down', turns: 2, magnitude: 0.2 });
  applyStatus(u, { type: 'spd_up', turns: 2, magnitude: 0.5 });
  const m = statMods(u);
  assert.ok(Math.abs(m.atk - 1.25) < 1e-9, 'atk_up -> x1.25');
  assert.ok(Math.abs(m.def - 0.8) < 1e-9, 'def_down -> x0.8');
  assert.ok(Math.abs(m.spd - 1.5) < 1e-9, 'spd_up -> x1.5');
}

// --- 6) statMods：atk_down / def_up ---
{
  const u = unit({ statuses: [] });
  applyStatus(u, { type: 'atk_down', turns: 2, magnitude: 0.3 });
  applyStatus(u, { type: 'def_up', turns: 2, magnitude: 0.5 });
  const m = statMods(u);
  assert.ok(Math.abs(m.atk - 0.7) < 1e-9, 'atk_down -> x0.7');
  assert.ok(Math.abs(m.def - 1.5) < 1e-9, 'def_up -> x1.5');
  assert.strictEqual(m.spd, 1, 'spd unchanged');
}

// --- 7) canMove：immobilize -> false，否则 true ---
{
  const free = unit({ statuses: [] });
  assert.strictEqual(canMove(free), true, 'no status -> can move');
  const rooted = unit({ statuses: [] });
  applyStatus(rooted, { type: 'immobilize', turns: 1, magnitude: 0 });
  assert.strictEqual(canMove(rooted), false, 'immobilize -> cannot move');
  // 即便定身也仍可行动（原地攻/计）
  assert.strictEqual(canAct(rooted), true, 'immobilize still allows acting');
}

// --- 8) canAct：confuse 受注入 rng 影响（确定性） ---
{
  const sane = unit({ statuses: [] });
  assert.strictEqual(canAct(sane), true, 'no status -> can act');
  assert.strictEqual(canAct(sane, () => 0), true, 'rng=0 still acts when not confused');

  const dazed = unit({ statuses: [] });
  applyStatus(dazed, { type: 'confuse', turns: 2, magnitude: 0 });
  // rng 低于阈值 -> 无法行动；rng 高 -> 行动
  assert.strictEqual(canAct(dazed, () => 0), false, 'confuse + low rng -> cannot act');
  assert.strictEqual(canAct(dazed, () => 0.999), true, 'confuse + high rng -> can act');
}

// --- 9) 空 statuses 完全 no-op（向后兼容关键） ---
{
  const u = unit({ statuses: [] });
  const r = tickStatuses(u);
  assert.strictEqual(r.dmg, 0, 'empty tick dmg 0');
  assert.deepStrictEqual(r.expired, [], 'empty tick no expired');
  assert.deepStrictEqual(r.log, [], 'empty tick no log');
  assert.strictEqual(u.curHp, 30, 'empty tick does not change hp');
  const m = statMods(u);
  assert.deepStrictEqual(m, { atk: 1, def: 1, spd: 1 }, 'empty statMods identity');
}

// --- 10) 完全无 statuses 字段也安全（statMods/canAct/canMove/tick） ---
{
  const bare = unit({}); // 无 statuses 字段
  assert.deepStrictEqual(statMods(bare), { atk: 1, def: 1, spd: 1 }, 'bare statMods identity');
  assert.strictEqual(canAct(bare), true, 'bare canAct true');
  assert.strictEqual(canMove(bare), true, 'bare canMove true');
  const r = tickStatuses(bare);
  assert.strictEqual(r.dmg, 0, 'bare tick no dmg');
  assert.deepStrictEqual(r.expired, [], 'bare tick no expired');
}

console.log('statuses ok');
