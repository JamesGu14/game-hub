// tests/towerStats.test.mjs — 升级曲线 L1-L3 硬坡(×1.5)+ L4-L5 软坡(×1.3)+ 武力排序/师徒不变量
// 运行：node games/tower-defender/tests/towerStats.test.mjs
import assert from 'node:assert';
import { GENERALS, towerStats } from '../src/data/generals.js';
import { BAL } from '../src/data/balance.js';

const h = GENERALS.huang;
const l1 = towerStats(h, 1), l2 = towerStats(h, 2), l3 = towerStats(h, 3);
const l4 = towerStats(h, 4), l5 = towerStats(h, 5);

// —— L1-L3 硬坡 ×1.5 ——
assert.equal(l1.dmg, 9, 'L1 基准 dmg');
assert.equal(l1.range, 3.5, 'L1 射程');
assert.ok(Math.abs(l1.interval - 0.7) < 1e-9, 'L1 间隔');
assert.ok(Math.abs(l2.dmg - 13.5) < 1e-9, 'L2 dmg 9×1.5');
assert.equal(l2.range, 4.0, 'L2 射程 +0.5');
assert.ok(Math.abs(l2.interval - 0.63) < 1e-9, 'L2 间隔 ×0.9');
assert.ok(Math.abs(l3.dmg - 20.25) < 1e-9, 'L3 dmg 9×1.5²');
assert.equal(l3.range, 4.5, 'L3 射程 +1.0');
assert.ok(Math.abs(l3.interval - 0.567) < 1e-9, 'L3 间隔 ×0.81');

// —— L4-L5 软坡 ×1.3 ——
assert.ok(Math.abs(l4.dmg - 20.25 * BAL.UPGRADE_DMG_MULT_SOFT) < 1e-9, 'L4 dmg = L3×SOFT');
assert.ok(Math.abs(l4.interval - 0.567 * BAL.UPGRADE_INTERVAL_MULT_SOFT) < 1e-9, 'L4 间隔 = L3×SOFT');
assert.equal(l4.range, 5.0, 'L4 射程 +1.5');
assert.ok(Math.abs(l5.dmg - 20.25 * BAL.UPGRADE_DMG_MULT_SOFT ** 2) < 1e-9, 'L5 dmg = L3×SOFT²');
assert.ok(Math.abs(l5.interval - 0.567 * BAL.UPGRADE_INTERVAL_MULT_SOFT ** 2) < 1e-9, 'L5 间隔 = L3×SOFT²');
assert.equal(l5.range, 5.5, 'L5 射程 +2.0');

// —— 防爆守护：L5/L3 DPS 比 ∈ [1.8, 2.5]（新曲线 ≈1.873）——
const dps = (s) => s.dmg / s.interval;
const ratio = dps(l5) / dps(l3);
assert.ok(ratio >= 1.8 && ratio <= 2.5, `L5/L3 DPS=${ratio.toFixed(3)} 必在 [1.8,2.5]`);

// —— 单调 ——
assert.ok(l3.dmg < l4.dmg && l4.dmg < l5.dmg, 'dmg 单调升');
assert.ok(l3.interval > l4.interval && l4.interval > l5.interval, 'interval 单调降');

// —— [spec §8.1] 武力排序不变量：五虎单发严格 赵>关>马>张>黄 ——
const hit = (id) => GENERALS[id].dmg;
assert.ok(hit('zhao') > hit('guan') && hit('guan') > hit('ma') && hit('ma') > hit('zhang') && hit('zhang') > hit('huang'),
  `五虎单发排序 赵${hit('zhao')}>关${hit('guan')}>马${hit('ma')}>张${hit('zhang')}>黄${hit('huang')}`);

// —— [spec §8.1] 师徒不变量：徒弟单发与 L1 DPS 均低于师父（张苞对照赵云）——
const PAIRS = [['liao', 'huang'], ['zhou', 'zhang'], ['madai', 'ma'], ['guanping', 'guan'], ['zhangbao', 'zhao'], ['yueying', 'zhuge']];
const dps1 = (id) => GENERALS[id].dmg / GENERALS[id].interval;
for (const [stu, mas] of PAIRS) {
  assert.ok(GENERALS[stu], `新将 ${stu} 已定义`);
  assert.ok(hit(stu) < hit(mas), `${stu} 单发 < ${mas}`);
  assert.ok(dps1(stu) < dps1(mas), `${stu} DPS < ${mas}`);
  assert.ok(GENERALS[stu].cost < GENERALS[mas].cost, `${stu} 造价 < ${mas}`);
  assert.equal(GENERALS[stu].signature, null, `${stu} 无招牌技`);
}

// —— [spec §2.2] 新将单发全部 ≤ 张飞 ——
for (const [stu] of PAIRS) assert.ok(hit(stu) <= hit('zhang'), `${stu} 单发 ≤ 张飞`);

console.log('ok towerStats');
