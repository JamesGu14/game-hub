// tests/cheats.test.mjs — [作弊] 纯内存叠加层:三开关读取时派生,不碰存档(spec 关键设计选择)
// 运行:node games/tower-defender/tests/cheats.test.mjs
import assert from 'node:assert';
import { defaultCheats, effectiveUnlockedLevel, effectiveRoster, effectiveStartGold } from '../src/core/cheats.js';
import { unlockedGenerals } from '../src/data/unlocks.js';

const ALL = ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying', 'huang', 'zhang', 'guan', 'ma', 'zhuge', 'zhao'];

// 默认:三开关全关
assert.deepEqual(defaultCheats(), { allLevels: false, allGenerals: false, goldOverride: null }, '默认三开关');

// effectiveUnlockedLevel:allLevels 真→总关数;假→真实存档值
assert.equal(effectiveUnlockedLevel({ unlockedLevel: 3 }, { allLevels: true }, 50), 50, 'allLevels→总关数');
assert.equal(effectiveUnlockedLevel({ unlockedLevel: 3 }, { allLevels: false }, 50), 3, '非作弊→存档值');

// effectiveRoster:allGenerals 真→全12;假→等于 unlockedGenerals(save)
const full = effectiveRoster({ unlockedLevel: 1 }, { allGenerals: true }, ALL);
assert.equal(full.size, 12, 'allGenerals→全12将');
assert.ok(full.has('zhao') && full.has('huang'), '含五虎');
const base = effectiveRoster({ unlockedLevel: 1 }, { allGenerals: false }, ALL);
assert.deepEqual([...base].sort(), [...unlockedGenerals({ unlockedLevel: 1 })].sort(), '非作弊→等于 unlockedGenerals');

// effectiveStartGold:override 非 null(含0边界)→覆盖;null→原值
assert.equal(effectiveStartGold(300, { goldOverride: 9999 }), 9999, 'override 覆盖');
assert.equal(effectiveStartGold(300, { goldOverride: 0 }), 0, 'override=0 边界也覆盖');
assert.equal(effectiveStartGold(300, { goldOverride: null }), 300, 'null→原值');

console.log('ok cheats');
