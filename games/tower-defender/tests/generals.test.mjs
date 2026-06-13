// tests/generals.test.mjs — [改进⑩] 廖化/黄忠改"远程消耗位"数值快照(防误改回)。
// 弓箭类单体速射将:加射程、降单发攻击。运行: node games/tower-defender/tests/generals.test.mjs
import assert from 'node:assert';
import { GENERALS, towerStats } from '../src/data/generals.js';

// 廖化:射程 3.0→4.0,攻 6→4
assert.equal(GENERALS.liao.range, 4.0, '廖化射程 4.0');
assert.equal(GENERALS.liao.dmg, 5, '廖化攻 5');
// 黄忠:射程 3.5→4.5,攻 9→6
assert.equal(GENERALS.huang.range, 4.5, '黄忠射程 4.5');
assert.equal(GENERALS.huang.dmg, 7, '黄忠攻 7');

// towerStats 缩放仍正常(range 每级 +0.5;dmg 硬坡 ×1.5)
assert.equal(towerStats(GENERALS.huang, 1).range, 4.5, '黄忠 L1 射程=4.5');
assert.equal(towerStats(GENERALS.huang, 3).range, 5.5, '黄忠 L3 射程=4.5+1.0');
assert.ok(Math.abs(towerStats(GENERALS.huang, 3).dmg - 7 * 1.5 ** 2) < 1e-9, '黄忠 L3 攻=7×1.5²');

console.log('ok generals');
