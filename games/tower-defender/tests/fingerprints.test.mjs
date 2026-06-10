// tests/fingerprints.test.mjs — 验收标准 §10.1/§10.2:50 关几何指纹两两不同 + 逐关营数=现状承诺
// 运行:node games/tower-defender/tests/fingerprints.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';

// 指纹 = 序列化(paths)+序列化(slots)(spec §10.1;直接字符串比对,无哈希碰撞)
const fps = new Map();
for (const lv of LEVELS) {
  const fp = JSON.stringify(lv.paths) + '|' + JSON.stringify(lv.slots);
  assert.ok(!fps.has(fp), `L${lv.id} 与 L${fps.get(fp)} 指纹相同(撞图)`);
  fps.set(fp, lv.id);
}
assert.equal(fps.size, 50, '50 关指纹两两不同');

// 逐关营数与现状完全一致(营数承诺的直接回归证明;cities/cityAssign 是间接证明)
const EXPECT = [
  3, 2, 2, 2, 2, 3, 3, 3, 3, 3,   // ch1
  4, 3, 3, 3, 3, 4, 4, 4, 4, 4,   // ch2
  5, 4, 4, 4, 4, 5, 5, 5, 5, 5,   // ch3
  6, 5, 5, 5, 5, 6, 6, 6, 6, 6,   // ch4
  8, 6, 6, 6, 6, 8, 8, 8, 8, 8,   // ch5
];
assert.deepEqual(LEVELS.map((l) => l.camps.length), EXPECT, '逐关营数=现状');

// 每关挂上地形展开产物(本切换起 levels 必带)
for (const lv of LEVELS) {
  assert.ok(Array.isArray(lv.terrain), `L${lv.id} 有 terrain`);
  assert.ok(Array.isArray(lv.terrainAt) && lv.terrainAt.length === lv.rows, `L${lv.id} 有 terrainAt`);
}
console.log('ok fingerprints');
