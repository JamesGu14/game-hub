// tests/pathfind.test.mjs — Task B1: grid + pathfind 单测
//
// 运行：node games/caocao-zhuan/tests/pathfind.test.mjs
// 纯逻辑单测：不依赖 Three.js / DOM；只 import battle/* 与 data/*。
//
// 覆盖：
//   1. 直线道路累计消耗（road foot=1，逐格累加；超出 mov 排除）。
//   2. 森林骑兵消耗=2（horse moveType 取 forest.moveCost.horse）。
//   3. 水域不可通行（passable:false → 阻挡且不进入结果）。
//   4. 被占格阻挡（occupied 中的格不可停留/不可经过）。
//   5. 出界 / 超 mov 范围排除。
//   6. path() 最短路（排除起点、含终点）；不可达返回 []。

import assert from 'node:assert';
import { reachable, path } from '../src/battle/pathfind.js';
import { tileAt, inBounds, neighbors } from '../src/battle/grid.js';

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log('  ok -', label);
}

// ---------------------------------------------------------------------------
// grid.js 基础
// ---------------------------------------------------------------------------
check('inBounds / tileAt 基础', () => {
  const map = { cols: 3, rows: 2, tiles: [['road', 'grass', 'road'], ['water', 'forest', 'hill']] };
  assert.equal(inBounds(map, 0, 0), true);
  assert.equal(inBounds(map, 2, 1), true);
  assert.equal(inBounds(map, 3, 0), false);
  assert.equal(inBounds(map, 0, 2), false);
  assert.equal(inBounds(map, -1, 0), false);
  // tiles 索引为 tiles[r][c]
  assert.equal(tileAt(map, 0, 0), 'road');
  assert.equal(tileAt(map, 1, 0), 'grass');
  assert.equal(tileAt(map, 0, 1), 'water');
  assert.equal(tileAt(map, 1, 1), 'forest');
  assert.equal(tileAt(map, 99, 99), null); // 出界返回 null
});

check('neighbors 四邻 + 边界裁剪', () => {
  const map = { cols: 3, rows: 2, tiles: [['road', 'road', 'road'], ['road', 'road', 'road']] };
  const center = neighbors(map, 1, 0).map((p) => `${p.c},${p.r}`).sort();
  assert.deepEqual(center, ['0,0', '1,1', '2,0'].sort());
  const corner = neighbors(map, 0, 0).map((p) => `${p.c},${p.r}`).sort();
  assert.deepEqual(corner, ['0,1', '1,0'].sort());
});

// ---------------------------------------------------------------------------
// reachable: 直线道路累计消耗（来自 plan Task B1 示例）
// ---------------------------------------------------------------------------
check('直线道路累计消耗 + mov 上限排除', () => {
  const map = { cols: 3, rows: 1, tiles: [['road', 'road', 'road']] };
  const unit = { pos: { c: 0, r: 0 }, base: { mov: 2 }, classId: 'infantry' };
  const r = reachable(unit, map, new Set());
  assert.equal(r.get('1,0'), 1);
  assert.equal(r.get('2,0'), 2);
  assert.ok(!r.has('3,0')); // 出界
  assert.ok(!r.has('0,0')); // 不含起点
});

check('mov=1 只到相邻格', () => {
  const map = { cols: 3, rows: 1, tiles: [['road', 'road', 'road']] };
  const unit = { pos: { c: 0, r: 0 }, mov: 1, classId: 'infantry' };
  const r = reachable(unit, map, new Set());
  assert.equal(r.get('1,0'), 1);
  assert.ok(!r.has('2,0')); // 距离 2 > mov 1
});

// ---------------------------------------------------------------------------
// 森林骑兵消耗 = 2
// ---------------------------------------------------------------------------
check('森林骑兵进入消耗=2（步兵=1）', () => {
  const map = { cols: 3, rows: 1, tiles: [['road', 'forest', 'road']] };
  // 骑兵 mov=3：进 forest 花 2，再进 road 花 1 -> 终点累计 3
  const horse = { pos: { c: 0, r: 0 }, mov: 3, classId: 'cavalry' };
  const rh = reachable(horse, map, new Set());
  assert.equal(rh.get('1,0'), 2); // forest horse cost = 2
  assert.equal(rh.get('2,0'), 3); // 2 + road(1)
  // 步兵 forest foot cost = 1
  const foot = { pos: { c: 0, r: 0 }, mov: 3, classId: 'infantry' };
  const rf = reachable(foot, map, new Set());
  assert.equal(rf.get('1,0'), 1);
  assert.equal(rf.get('2,0'), 2);
});

check('森林骑兵 mov 不足以进入则排除', () => {
  const map = { cols: 2, rows: 1, tiles: [['road', 'forest']] };
  const horse = { pos: { c: 0, r: 0 }, mov: 1, classId: 'cavalry' };
  const r = reachable(horse, map, new Set());
  assert.ok(!r.has('1,0')); // forest 需 2 > mov 1
});

// ---------------------------------------------------------------------------
// 水域不可通行
// ---------------------------------------------------------------------------
check('水域不可通行（阻挡，不进入结果，也不可越过）', () => {
  const map = { cols: 3, rows: 1, tiles: [['road', 'water', 'road']] };
  const unit = { pos: { c: 0, r: 0 }, mov: 5, classId: 'infantry' };
  const r = reachable(unit, map, new Set());
  assert.ok(!r.has('1,0')); // water 不可进
  assert.ok(!r.has('2,0')); // 被 water 隔断（直线无绕路）
});

// ---------------------------------------------------------------------------
// 被占格阻挡
// ---------------------------------------------------------------------------
check('occupied 格不可停留/经过', () => {
  const map = { cols: 3, rows: 1, tiles: [['road', 'road', 'road']] };
  const unit = { pos: { c: 0, r: 0 }, mov: 5, classId: 'infantry' };
  const occupied = new Set(['1,0']);
  const r = reachable(unit, map, occupied);
  assert.ok(!r.has('1,0')); // 被占
  assert.ok(!r.has('2,0')); // 直线被占格隔断
});

check('occupied 中含起点不影响（起点可出发）', () => {
  const map = { cols: 3, rows: 1, tiles: [['road', 'road', 'road']] };
  const unit = { pos: { c: 0, r: 0 }, mov: 2, classId: 'infantry' };
  // 起点也在 occupied（自身所在格），仍能正常出发
  const occupied = new Set(['0,0']);
  const r = reachable(unit, map, occupied);
  assert.equal(r.get('1,0'), 1);
  assert.equal(r.get('2,0'), 2);
});

// ---------------------------------------------------------------------------
// path()
// ---------------------------------------------------------------------------
check('path 最短路：排除起点、含终点', () => {
  const map = { cols: 3, rows: 1, tiles: [['road', 'road', 'road']] };
  const p = path(map, { c: 0, r: 0 }, { c: 2, r: 0 }, 'foot', new Set());
  assert.deepEqual(p, [{ c: 1, r: 0 }, { c: 2, r: 0 }]);
});

check('path 绕过 occupied', () => {
  // 2x3 网格全 road，从 (0,0) 到 (0,2)；(0,1) 被占 -> 需绕 c=1 列
  const map = {
    cols: 2,
    rows: 3,
    tiles: [
      ['road', 'road'],
      ['road', 'road'],
      ['road', 'road'],
    ],
  };
  const occupied = new Set(['0,1']);
  const p = path(map, { c: 0, r: 0 }, { c: 0, r: 2 }, 'foot', occupied);
  // 绕路：(1,0)->(1,1)->(1,2)->(0,2) 长度 4
  assert.equal(p.length, 4);
  assert.deepEqual(p[p.length - 1], { c: 0, r: 2 }); // 终点
  // 不经过被占格
  assert.ok(!p.some((s) => s.c === 0 && s.r === 1));
});

check('path 不可达返回 []', () => {
  const map = { cols: 3, rows: 1, tiles: [['road', 'water', 'road']] };
  const p = path(map, { c: 0, r: 0 }, { c: 2, r: 0 }, 'foot', new Set());
  assert.deepEqual(p, []);
});

check('path 到自身返回 []（无移动）', () => {
  const map = { cols: 3, rows: 1, tiles: [['road', 'road', 'road']] };
  const p = path(map, { c: 1, r: 0 }, { c: 1, r: 0 }, 'foot', new Set());
  assert.deepEqual(p, []);
});

console.log(`\npathfind ok — ${passed} checks passed`);
