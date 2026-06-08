// tests/towerStats.test.mjs — 升级曲线 L1-L3 硬坡（§17.1）+ L4-L5 软坡防爆（§5.3）
// 运行：node games/tower-defender/tests/towerStats.test.mjs
import assert from 'node:assert';
import { GENERALS, towerStats } from '../src/data/generals.js';
import { BAL } from '../src/data/balance.js';

const h = GENERALS.huang;
const l1 = towerStats(h, 1), l2 = towerStats(h, 2), l3 = towerStats(h, 3);
const l4 = towerStats(h, 4), l5 = towerStats(h, 5);

// —— L1-L3 维持现曲线（逐位不变）——
assert.equal(l1.dmg, 9, 'L1 基准 dmg');
assert.equal(l1.range, 3.5, 'L1 射程');
assert.ok(Math.abs(l1.interval - 0.7) < 1e-9, 'L1 间隔');
assert.ok(Math.abs(l2.dmg - 14.4) < 1e-9, 'L2 dmg 9×1.6');
assert.equal(l2.range, 4.0, 'L2 射程 +0.5');
assert.ok(Math.abs(l2.interval - 0.63) < 1e-9, 'L2 间隔 ×0.9');
assert.ok(Math.abs(l3.dmg - 23.04) < 1e-9, 'L3 dmg 9×1.6²');
assert.equal(l3.range, 4.5, 'L3 射程 +1.0');
assert.ok(Math.abs(l3.interval - 0.567) < 1e-9, 'L3 间隔 ×0.81');

// —— L4-L5 软坡（dmg×SOFT、interval×SOFT，range 仍线性）——
assert.ok(Math.abs(l4.dmg - 23.04 * BAL.UPGRADE_DMG_MULT_SOFT) < 1e-9, 'L4 dmg = L3×SOFT');
assert.ok(Math.abs(l4.interval - 0.567 * BAL.UPGRADE_INTERVAL_MULT_SOFT) < 1e-9, 'L4 间隔 = L3×SOFT');
assert.equal(l4.range, 5.0, 'L4 射程 +1.5（线性）');
assert.ok(Math.abs(l5.dmg - 23.04 * BAL.UPGRADE_DMG_MULT_SOFT ** 2) < 1e-9, 'L5 dmg = L3×SOFT²');
assert.ok(Math.abs(l5.interval - 0.567 * BAL.UPGRADE_INTERVAL_MULT_SOFT ** 2) < 1e-9, 'L5 间隔 = L3×SOFT²');
assert.equal(l5.range, 5.5, 'L5 射程 +2.0（线性）');

// —— 防爆守护：L5 DPS / L3 DPS 必在 [1.8, 2.5]（§5.3 目标 2-2.5×）——
const dps = (s) => s.dmg / s.interval;
const ratio = dps(l5) / dps(l3);
assert.ok(ratio >= 1.8 && ratio <= 2.5, `L5/L3 DPS=${ratio.toFixed(3)} 必在 [1.8,2.5] 防秒杀`);

// —— 单调：dmg 升、interval 降 ——
assert.ok(l3.dmg < l4.dmg && l4.dmg < l5.dmg, 'dmg 单调升');
assert.ok(l3.interval > l4.interval && l4.interval > l5.interval, 'interval 单调降');

console.log('ok towerStats');
