// tests/unlocks.test.mjs — 按章解锁:派生自 save.unlockedLevel,零 schema 迁移(spec §3)
// 运行:node games/tower-defender/tests/unlocks.test.mjs
import assert from 'node:assert';
import { BASE_ROSTER, UNLOCKS, unlockedGenerals, newlyUnlocked } from '../src/data/unlocks.js';
import { GENERALS } from '../src/data/generals.js';

// 日程表形状
assert.deepEqual(BASE_ROSTER, ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'], '开局新6将');
assert.deepEqual(UNLOCKS.map((u) => u.afterLevel), [10, 20, 30], '三个解锁门槛');
for (const u of UNLOCKS) for (const id of u.generals) assert.ok(GENERALS[id], `日程引用合法将 ${id}`);

// 新档(unlockedLevel=1):仅新6将
const fresh = unlockedGenerals({ unlockedLevel: 1 });
assert.equal(fresh.size, 6, '新档 6 将');
assert.ok(fresh.has('liao') && !fresh.has('zhao') && !fresh.has('huang'), '新档无五虎');

// 通关 L10(unlockedLevel=11):+赵云/张飞
const ch2 = unlockedGenerals({ unlockedLevel: 11 });
assert.ok(ch2.has('zhao') && ch2.has('zhang') && !ch2.has('guan'), 'L10 后解锁赵/张');
// 边界:unlockedLevel=10(尚未通关 L10)不解锁
assert.ok(!unlockedGenerals({ unlockedLevel: 10 }).has('zhao'), '未过 L10 不解锁');

// 通关 L20 → +诸葛/关羽;通关 L30 → 全 12
assert.ok(unlockedGenerals({ unlockedLevel: 21 }).has('zhuge'), 'L20 后诸葛');
assert.equal(unlockedGenerals({ unlockedLevel: 31 }).size, 12, 'L30 后全 12 将');

// 老存档(已通关 50):全解锁;脏档兜底
assert.equal(unlockedGenerals({ unlockedLevel: 51 }).size, 12, '老档全解锁');
assert.equal(unlockedGenerals(null).size, 6, '空档=新档');

// newlyUnlocked:跨门槛差集(用于结算面板提示)
assert.deepEqual(newlyUnlocked(10, 11), ['zhao', 'zhang'], '通关 L10 新增赵/张');
assert.deepEqual(newlyUnlocked(11, 12), [], '未跨门槛无新增');
assert.deepEqual(newlyUnlocked(30, 31), ['huang', 'ma'], '通关 L30 新增黄/马');
console.log('ok unlocks');
