// tests/towerStats.test.mjs — 升级曲线（§17.1：dmg×1.6 · range+0.5 · interval×0.9）
// 运行：node games/tower-defender/tests/towerStats.test.mjs
import assert from 'node:assert';
import { GENERALS, towerStats } from '../src/data/generals.js';

const h = GENERALS.huang;
const l1 = towerStats(h, 1), l2 = towerStats(h, 2), l3 = towerStats(h, 3);

assert.equal(l1.dmg, 9, 'L1 基准 dmg');
assert.equal(l1.range, 3.5, 'L1 射程');
assert.ok(Math.abs(l1.interval - 0.7) < 1e-9, 'L1 间隔');

assert.ok(Math.abs(l2.dmg - 14.4) < 1e-9, 'L2 dmg 9×1.6');
assert.equal(l2.range, 4.0, 'L2 射程 +0.5');
assert.ok(Math.abs(l2.interval - 0.63) < 1e-9, 'L2 间隔 ×0.9');

assert.ok(Math.abs(l3.dmg - 23.04) < 1e-9, 'L3 dmg 9×1.6²');
assert.equal(l3.range, 4.5, 'L3 射程 +1.0');
assert.ok(Math.abs(l3.interval - 0.567) < 1e-9, 'L3 间隔 ×0.81');

console.log('ok towerStats');
