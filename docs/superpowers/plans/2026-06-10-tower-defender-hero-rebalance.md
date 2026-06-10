# Tower Defender 武将重排+新6将+按章解锁+形象演进 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 spec(docs/superpowers/specs/2026-06-10-tower-defender-hero-rebalance-design.md)落地:五虎单发重排+涨价、升级曲线下调、新增 6 廉价蜀汉将、按章解锁、建造栏两行、L1→L3 三阶形象演进(OpenRouter 生成 36 张)。

**Architecture:** 数值与门禁先行(Task 1-4 改 data+测试,winnable 是硬检查点),解锁与 UI 居中(Task 5-8),资产管线最后(Task 9-11)。解锁状态纯派生自现有存档 `unlockedLevel`,零 schema 迁移;形象取图走 `generalSprite(id, level)` 单一函数+逐级回退,缺图永不裂。

**Tech Stack:** 原生 ES Modules + Canvas 2D(零依赖铁律);node:assert 单测;OpenRouter google/gemini-2.5-flash-image;Pillow debg 去底。

**约定:** 所有命令在 `games/tower-defender/` 下执行;全量测试 = `for f in tests/*.test.mjs; do node "$f" || exit 1; done`。仓库根在上两级(commit 时 `git -C ../..` 或 cd)。

---

### Task 1: 升级曲线下调(balance.js)

**Files:**
- Modify: `src/data/balance.js:19,26`
- Test: `tests/towerStats.test.mjs`

- [ ] **Step 1: 更新 towerStats.test 为新曲线期望(先改测试)**

将 `tests/towerStats.test.mjs` 整体替换为:

```js
// tests/towerStats.test.mjs — 升级曲线 L1-L3 硬坡(×1.5)+ L4-L5 软坡(×1.3)+ 武力排序/师徒不变量
// 运行:node games/tower-defender/tests/towerStats.test.mjs
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

// —— 防爆守护:L5/L3 DPS 比 ∈ [1.8, 2.5](新曲线 ≈1.873)——
const dps = (s) => s.dmg / s.interval;
const ratio = dps(l5) / dps(l3);
assert.ok(ratio >= 1.8 && ratio <= 2.5, `L5/L3 DPS=${ratio.toFixed(3)} 必在 [1.8,2.5]`);

// —— 单调 ——
assert.ok(l3.dmg < l4.dmg && l4.dmg < l5.dmg, 'dmg 单调升');
assert.ok(l3.interval > l4.interval && l4.interval > l5.interval, 'interval 单调降');

// —— [spec §8.1] 武力排序不变量:五虎单发严格 赵>关>马>张>黄 ——
const hit = (id) => GENERALS[id].dmg;
assert.ok(hit('zhao') > hit('guan') && hit('guan') > hit('ma') && hit('ma') > hit('zhang') && hit('zhang') > hit('huang'),
  `五虎单发排序 赵${hit('zhao')}>关${hit('guan')}>马${hit('ma')}>张${hit('zhang')}>黄${hit('huang')}`);

// —— [spec §8.1] 师徒不变量:徒弟单发与 L1 DPS 均低于师父(张苞对照赵云)——
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/towerStats.test.mjs`
Expected: FAIL(`L2 dmg 9×1.5` 断言失败,当前曲线 1.6 算出 14.4)

- [ ] **Step 3: 改 balance.js 两个常量**

`src/data/balance.js` 中:
- `UPGRADE_DMG_MULT: 1.6,` → `UPGRADE_DMG_MULT: 1.5,      // [重排spec §2.3] 每级伤害 ×1.5(原1.6)`
- `UPGRADE_DMG_MULT_SOFT: 1.35,` → `UPGRADE_DMG_MULT_SOFT: 1.3,     // [§5.3+重排spec] L3→L5 软坡 ×1.3(原1.35)`

- [ ] **Step 4: 跑测试——此时排序/师徒断言仍失败(新将未定义),曲线部分应过**

Run: `node tests/towerStats.test.mjs`
Expected: FAIL 在 `新将 liao 已定义`(曲线断言全过)。这是 Task 2 的入口状态。

- [ ] **Step 5: Commit(连同 Task 2 一起提交,此处不单独 commit——曲线+数值是一个原子变更,中间态测试红)**

(无操作,继续 Task 2)

### Task 2: 五虎重排+涨价 + 新 6 将条目(generals.js)+ 受影响测试字面量

**Files:**
- Modify: `src/data/generals.js:7-56`
- Modify: `tests/damageCalc.test.mjs`、`tests/attacks.test.mjs`、`tests/signatureSkills.test.mjs`、`tests/economy.test.mjs`、`tests/economy-upgrade.test.mjs`

- [ ] **Step 1: 重写 generals.js 的 GENERALS(towerStats 函数不动)**

将 `export const GENERALS = {...}` 整块替换为(注释风格沿用原文件):

```js
// —— 五虎将+诸葛(premium,L3 招牌技;单发武力排序 赵>关>马>张>黄,spec §2.1)——
export const GENERALS = {
  huang: {
    id: 'huang', name: '黄忠',
    cost: 90, range: 3.5, interval: 0.7, dmg: 9,
    dmgType: 'physical', targets: 'both',   // 单体速射·可空·单发最轻(武力⑤)
    attack: 'single', attackParams: {},
    signature: { id: 'baibu', name: '百步穿杨', type: 'passive', params: {} }, // 25% 暴击 ×2.5 无视护甲(见 damageCalc)
    color: '#ffd24d',
  },
  zhang: {
    id: 'zhang', name: '张飞',
    cost: 140, range: 2.5, interval: 1.8, dmg: 18,
    dmgType: 'physical', targets: 'ground', // 范围溅射·清群·仅地(武力④)
    attack: 'splash', attackParams: { splash: 1 },
    signature: { id: 'nuhou', name: '当阳怒吼', type: 'cooldown', cooldown: 10, params: { stunDur: 1, radius: 1 } },
    color: '#b06b3a',
  },
  guan: {
    id: 'guan', name: '关羽',
    cost: 155, range: 3.0, interval: 2.2, dmg: 28,
    dmgType: 'strategy', targets: 'both',   // 重刀+减速控制(水攻·无视护甲)·可空(武力②)
    attack: 'slow', attackParams: { slowPct: 0.4, slowDur: 2.5 },
    signature: { id: 'shuiyan', name: '水淹七军', type: 'cooldown', cooldown: 12, params: { slowPct: 0.6, slowDur: 3, dmgMult: 1, radius: 1.5 } },
    color: '#3aa6d6',
  },
  zhao: {
    id: 'zhao', name: '赵云',
    cost: 200, range: 5.0, interval: 2.5, dmg: 48,
    dmgType: 'physical', targets: 'ground', // 高单体·狙 BOSS·仅地(武力①)
    attack: 'single', attackParams: {},
    signature: { id: 'qijin', name: '七进七出', type: 'passive', params: { maxChain: 2 } },
    color: '#dfe3ea',
  },
  ma: {
    id: 'ma', name: '马超',
    cost: 175, range: 3.0, interval: 1.4, dmg: 22,
    dmgType: 'physical', targets: 'ground', // 沿道路冲锋·多目标·仅地(武力③)
    attack: 'charge', attackParams: { maxHits: 3 },
    signature: { id: 'tuzhen', name: '西凉突阵', type: 'passive', params: { knockback: 0.5 } },
    color: '#e0533a',
  },
  zhuge: {
    id: 'zhuge', name: '诸葛亮',
    cost: 190, range: 3.0, interval: 1.4, dmg: 8,  // dmg = 灼烧 dps(每秒),非命中直伤
    dmgType: 'fire', targets: 'both',       // 火攻灼烧·克藤甲·可空(谋略系,不参与武力排序)
    attack: 'burn', attackParams: { burnDur: 3 },
    signature: { id: 'huoshao', name: '火烧藤甲', type: 'passive', params: { vsTengjiaMult: 2 } },
    color: '#ff7a2f',
  },
  // —— 新 6 将(廉价起步,师门传承,无招牌技;spec §2.2)——
  liao: {
    id: 'liao', name: '廖化',
    cost: 40, range: 3.0, interval: 0.8, dmg: 6,
    dmgType: 'physical', targets: 'both',   // 师承黄忠:单体速射·可空·最便宜入门将
    attack: 'single', attackParams: {},
    signature: null,
    color: '#ffe08a',
  },
  zhou: {
    id: 'zhou', name: '周仓',
    cost: 55, range: 2.5, interval: 2.0, dmg: 11,
    dmgType: 'physical', targets: 'ground', // 师承张飞:大刀溅射·仅地
    attack: 'splash', attackParams: { splash: 0.8 },
    signature: null,
    color: '#8a8f99',
  },
  madai: {
    id: 'madai', name: '马岱',
    cost: 55, range: 2.8, interval: 1.3, dmg: 9,
    dmgType: 'physical', targets: 'ground', // 师承马超:轻骑冲锋·贯穿≤2·仅地
    attack: 'charge', attackParams: { maxHits: 2 },
    signature: null,
    color: '#f08a70',
  },
  guanping: {
    id: 'guanping', name: '关平',
    cost: 60, range: 3.0, interval: 1.6, dmg: 6,
    dmgType: 'strategy', targets: 'both',   // 师承关羽:小水攻(谋略·无视护甲)+弱减速·可空
    attack: 'slow', attackParams: { slowPct: 0.25, slowDur: 2 },
    signature: null,
    color: '#7cc4e0',
  },
  zhangbao: {
    id: 'zhangbao', name: '张苞',
    cost: 65, range: 4.0, interval: 1.9, dmg: 16,
    dmgType: 'physical', targets: 'ground', // 重击位(对照赵云):蛇矛重击单体·仅地
    attack: 'single', attackParams: {},
    signature: null,
    color: '#cf8d56',
  },
  yueying: {
    id: 'yueying', name: '黄月英',
    cost: 75, range: 2.8, interval: 1.5, dmg: 5,  // dmg = 灼烧 dps/层
    dmgType: 'fire', targets: 'both',       // 师承诸葛:机关火弩灼烧·克藤甲·可空·开局即有的火系
    attack: 'burn', attackParams: { burnDur: 2.5 },
    signature: null,
    color: '#ffa05c',
  },
};
```

- [ ] **Step 2: 验证 signature:null 的空安全**

Run: `grep -rn "signature" src/ | grep -v "signature?." | grep -v "g.signature)" | grep -v "//"`
逐处检查:`src/systems/combatSystem.js`、`src/entities/tower.js` 若有不带 `?.` 的 `g.signature.xxx` 访问,改为 `g.signature?.xxx`(已知 attacks.js/damageCalc.js/signatureSkills.js 均已用 `?.`,towerPanel 已条件判断)。

- [ ] **Step 3: 跑 towerStats 测试确认全绿**

Run: `node tests/towerStats.test.mjs`
Expected: PASS(`ok towerStats`)

- [ ] **Step 4: 更新受影响测试的字面量(数值推导见行内注释)**

`tests/damageCalc.test.mjs`:
- `calcDamage({ level: 1 }, guan, teng, noCrit).dmg, 10` → `28`(关羽 dmg 10→28;注释同步改 `谋略 dmg28`)
- 黄忠 L3 字面量 `23.04` 全部 → `20.25`(9×1.5²),暴击 `23.04 * 2.5`(57.6)→ `20.25 * 2.5`(50.625),`L3 普通 ×0.5` 的 `23.04 * 0.5` → `20.25 * 0.5`
- L1 物理藤甲 `4.5`、`9`、`3.825` 不变(黄忠基础 dmg 9 未动)

`tests/attacks.test.mjs`:
- 注释与断言 `8×1.6²=20.48` → `8×1.5²=18`;`20.48 * 2` → `18 * 2`(火烧藤甲)
- 注释 `48×1.6²=122.88` → `48×1.5²=108`(赵云 L3 仍秒杀步卒,断言行为不变)

`tests/signatureSkills.test.mjs`:
- 水淹七军伤害若有字面量:关羽 L3 dmg = 28×2.25 = `63`(原 10×2.56=25.6);按实际断言替换

`tests/economy.test.mjs`:
- `assert.equal(s.gold, 30, '扣 70')` → `assert.equal(s.gold, 10, '扣 90')`(黄忠 70→90;若测试起始金非 100,按"起始金−90"调整)

`tests/economy-upgrade.test.mjs`:
- 黄忠注释/字面量:建造 70→90,`let invested = 70` → `90`,逐级费 L2=90/L3=144/L4=180/L5=252(=90×{1.0,1.6,2.0,2.8}),满级累计 756
- 赵云:`160 → 840` 改 `200 → 800`(起始 1000),`L2 cost 160 → 680` 改 `L2 cost 200 → 600`,`invested 320` → `400`

- [ ] **Step 5: 跑全量测试,确认仅 levels-winnable 可能红(其余全绿)**

Run: `for f in tests/*.test.mjs; do echo "== $f"; node "$f" || echo "FAIL $f"; done`
Expected: 除 `levels-winnable.test.mjs`(旧 6 将阵容+新曲线,可能过也可能红,Task 4 重写)外全部 PASS。heroCard.test 此时遍历 12 将应仍 PASS(lore 缺省空串,Task 8 补文案)。

- [ ] **Step 6: Commit**

```bash
git add src/data/balance.js src/data/generals.js tests/towerStats.test.mjs tests/damageCalc.test.mjs tests/attacks.test.mjs tests/signatureSkills.test.mjs tests/economy.test.mjs tests/economy-upgrade.test.mjs
git commit -m "feat(tower-defender): 五虎单发重排(赵48>关28>马22>张18>黄9)+涨价25-29%+新6将(廖化/周仓/马岱/关平/张苞/黄月英)+曲线两段压(1.5/1.3),排序与师徒不变量进测试"
```

### Task 3: 解锁系统 data/unlocks.js(纯派生,零存档迁移)

**Files:**
- Create: `src/data/unlocks.js`
- Create: `tests/unlocks.test.mjs`

- [ ] **Step 1: 写失败测试**

创建 `tests/unlocks.test.mjs`:

```js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/unlocks.test.mjs`
Expected: FAIL(模块不存在)

- [ ] **Step 3: 实现 src/data/unlocks.js**

```js
// data/unlocks.js — 按章解锁日程(spec §3):纯派生自 save.unlockedLevel,零 schema 迁移。
// 语义:save.unlockedLevel = 最高可玩关号 ⇒ 已通关 afterLevel ⇔ unlockedLevel > afterLevel。
// 剧情呼应:L10→赵/张(长坂坡)、L20→诸葛/关(赤壁)、L30→黄/马(定军山·西川)。
export const BASE_ROSTER = ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'];

export const UNLOCKS = [
  { afterLevel: 10, generals: ['zhao', 'zhang'] },
  { afterLevel: 20, generals: ['zhuge', 'guan'] },
  { afterLevel: 30, generals: ['huang', 'ma'] },
];

// save → 已解锁将 id 集合。save 缺失/脏值 → 新档(仅新6将)。
export function unlockedGenerals(save) {
  const lvl = (save && Number.isInteger(save.unlockedLevel) && save.unlockedLevel >= 1) ? save.unlockedLevel : 1;
  const set = new Set(BASE_ROSTER);
  for (const u of UNLOCKS) if (lvl > u.afterLevel) for (const id of u.generals) set.add(id);
  return set;
}

// 跨门槛差集:prev/next 为通关前后的 unlockedLevel(供结算面板"新武将来援"提示)。
export function newlyUnlocked(prevLevel, nextLevel) {
  const out = [];
  for (const u of UNLOCKS) if (prevLevel <= u.afterLevel && nextLevel > u.afterLevel) out.push(...u.generals);
  return out;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/unlocks.test.mjs`
Expected: PASS(`ok unlocks`)

- [ ] **Step 5: Commit**

```bash
git add src/data/unlocks.js tests/unlocks.test.mjs
git commit -m "feat(tower-defender): 按章解锁日程 unlocks.js(L10赵张/L20诸葛关/L30黄马,派生自unlockedLevel零迁移)+单测"
```

### Task 4: levels-winnable 升级"按章阵容"——硬门禁检查点 ⚠️

**Files:**
- Modify: `tests/levels-winnable.test.mjs`

- [ ] **Step 1: 重写 winnable 测试为按章阵容**

整体替换 `tests/levels-winnable.test.mjs`:

```js
// tests/levels-winnable.test.mjs — 每关用「首次遭遇时已解锁阵容」满将位升满(L5)→ headless 跑到 won
// 阵容 = unlockedGenerals({unlockedLevel: 关号})(最严苛:首次打到该关,replay 只会更宽裕;spec §8.2)。
// --sample:15 关快测(调参循环);无 flag = 全 50 关(提交门禁)。
// 运行:node games/tower-defender/tests/levels-winnable.test.mjs
import assert from 'node:assert';
import { newGameState } from '../src/core/gameState.js';
import { LEVELS } from '../src/data/levels.js';
import { step } from '../src/core/gameLoop.js';
import { tryBuild, tryUpgrade } from '../src/systems/economySystem.js';
import { BAL } from '../src/data/balance.js';
import { makeRng } from '../src/core/rng.js';
import { unlockedGenerals } from '../src/data/unlocks.js';

const SAMPLE = process.argv.includes('--sample');
const SAMPLE_IDS = new Set([1, 5, 10, 11, 15, 20, 21, 25, 30, 31, 35, 40, 41, 45, 50]);

for (let i = 0; i < LEVELS.length; i++) {
  if (SAMPLE && !SAMPLE_IDS.has(LEVELS[i].id)) continue;
  const roster = [...unlockedGenerals({ unlockedLevel: LEVELS[i].id })];   // Set 插入序:新6将在前,确定性
  const s = newGameState(LEVELS[i]);
  s.rng = makeRng(LEVELS[i].id);
  s.gold = 99999999;
  s.level.slots.forEach((sl, k) => {
    if (tryBuild(s, sl, roster[k % roster.length])) {
      const t = s.towers[s.towers.length - 1];
      while (tryUpgrade(s, t)) { /* 升满 */ }
    }
  });
  assert.ok(s.towers.length > 0 && s.towers.every((t) => t.level === BAL.MAX_TOWER_LEVEL), `L${LEVELS[i].id} 满防升至 L${BAL.MAX_TOWER_LEVEL}`);
  const guard = Math.max(400000, s.level.waves.length * 20000);
  let g = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && g < guard) {
    if (s.phase === 'prep') s.earlyRequested = true;
    step(s, 1 / 60);
    g++;
  }
  assert.equal(s.phase, 'won', `L${LEVELS[i].id} 按章阵容(${roster.length}将)满防应可通关(实际 ${s.phase}, castleHp ${s.castleHp})`);
}

console.log('ok levels-winnable');
```

- [ ] **Step 2: 先跑 --sample 快测**

Run: `node tests/levels-winnable.test.mjs --sample`
Expected: PASS。**若 FAIL:这是 spec §9 的高优先级风险,停下执行预案**——记录失败关号:第 1-2 章失败 → 新将数值整体 +5~10%(改 generals.js 后回 Task 2 Step 3 起重验);L47/48/50 失败 → 改 `src/data/campaign.js` 对应关 `rampMax` 覆盖(参考 balance.js:13 注释先例);改完重跑本步。**任何数值改动须同步回写 spec §2 表格并在 commit message 注明**。

- [ ] **Step 3: 跑全量 50 关**

Run: `node tests/levels-winnable.test.mjs`
Expected: PASS(`ok levels-winnable`)。失败处理同 Step 2。

- [ ] **Step 4: Commit**

```bash
git add tests/levels-winnable.test.mjs
git commit -m "test(tower-defender): winnable门禁升级按章阵容(首遇阵容满防L5全50关,第1章纯新6将硬门禁)"
```

### Task 5: 解锁调用链(gameState → economySystem)

**Files:**
- Modify: `src/core/gameState.js:9-10`
- Modify: `src/systems/economySystem.js:10-12`
- Modify: `tests/economy.test.mjs`(追加用例)

- [ ] **Step 1: economy.test 追加锁定用例(先写失败测试)**

在 `tests/economy.test.mjs` 末尾(`console.log` 前)追加:

```js
// —— [spec §3] 解锁门禁:state.unlocked 存在时,未解锁将不可建;缺省(null)=全解锁(存量测试零破坏)——
{
  const s = newGameState(LV, { unlocked: new Set(['liao']) });
  s.gold = 9999;
  assert.equal(canBuild(s, 'liao'), true, '已解锁可建');
  assert.equal(canBuild(s, 'zhao'), false, '未解锁不可建(金够也不行)');
  assert.equal(tryBuild(s, { x: 1, y: 1 }, 'zhao'), false, 'tryBuild 同样拦截');
  const s2 = newGameState(LV);
  s2.gold = 9999;
  assert.equal(canBuild(s2, 'zhao'), true, '缺省全解锁');
}
```

(`LV`/导入名以该测试文件现有变量为准:若现有用例用 `LEVELS[0]` 或本地 stub level,沿用同一对象;确保 `canBuild` 已在 import 列表,没有则加上。)

Run: `node tests/economy.test.mjs`
Expected: FAIL(newGameState 不接受第二参/canBuild 不看 unlocked)

- [ ] **Step 2: gameState 增可选 opts.unlocked**

`src/core/gameState.js` 签名与首字段:

```js
export function newGameState(level, opts = {}) {
  return {
    phase: 'prep',
    level,
    unlocked: opts.unlocked || null,   // [spec §3] 已解锁将 Set;null=全解锁(单测/老调用零破坏)
    rng: makeRng(),
    ...
```

(其余字段原样保留。)

- [ ] **Step 3: canBuild 加解锁判定**

`src/systems/economySystem.js`:

```js
export function canBuild(state, generalId) {
  if (state.unlocked && !state.unlocked.has(generalId)) return false;   // [spec §3] 未解锁不可建
  return state.gold >= GENERALS[generalId].cost;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/economy.test.mjs && node tests/economy-upgrade.test.mjs && node tests/levels-winnable.test.mjs --sample`
Expected: 全 PASS(winnable 不传 unlocked → null → 全解锁,只建 roster 内的将,不受影响)

- [ ] **Step 5: Commit**

```bash
git add src/core/gameState.js src/systems/economySystem.js tests/economy.test.mjs
git commit -m "feat(tower-defender): 解锁调用链——newGameState可选unlocked参+canBuild解锁判定(null=全解锁,存量零破坏)"
```

### Task 6: 建造栏两行+锁定态+热键(buildBar.js + main.js)

**Files:**
- Modify: `src/ui/buildBar.js`(整体重写)
- Modify: `src/main.js:28,44,60,285`
- Create: `tests/buildBar.test.mjs`

- [ ] **Step 1: 写失败测试(布局/命中纯函数)**

创建 `tests/buildBar.test.mjs`:

```js
// tests/buildBar.test.mjs — 建造栏布局/命中:单行(仅新6将)/两行(解锁五虎后)/锁定将不可命中(spec §5)
// 运行:node games/tower-defender/tests/buildBar.test.mjs
import assert from 'node:assert';
import { buildBarLayout, hitBuildBar, ROW_CHEAP, ROW_PREMIUM, HOTKEYS } from '../src/ui/buildBar.js';

const view = { w: 1280, h: 800 };
const mkState = (ids) => ({ unlocked: ids ? new Set(ids) : null });

// 行序与价格升序
assert.deepEqual(ROW_CHEAP, ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'], '下排新6将价格升序');
assert.deepEqual(ROW_PREMIUM, ['huang', 'zhang', 'guan', 'ma', 'zhuge', 'zhao'], '上排五虎+诸葛价格升序');

// 新档:无五虎解锁 → 单行 6 项,全部可点
{
  const st = mkState(ROW_CHEAP);
  const L = buildBarLayout(view, st);
  assert.equal(L.length, 6, '第1章单行 6 牌');
  assert.ok(L.every((b) => !b.locked), '全部解锁');
  const ys = new Set(L.map((b) => b.y));
  assert.equal(ys.size, 1, '单行同一 y');
  assert.equal(hitBuildBar(view, st, L[0].x + 5, L[0].y + 5), 'liao', '命中下排首位');
}

// 解锁赵/张后:两行 12 牌,上排 4 锁定;锁定命中返回 null
{
  const st = mkState([...ROW_CHEAP, 'zhao', 'zhang']);
  const L = buildBarLayout(view, st);
  assert.equal(L.length, 12, '两行 12 牌');
  const top = L.filter((b) => b.row === 'premium'), bottom = L.filter((b) => b.row === 'cheap');
  assert.equal(top.length, 6, '上排 6'); assert.equal(bottom.length, 6, '下排 6');
  assert.ok(top[0].y < bottom[0].y, '上排在下排之上');
  const zhao = top.find((b) => b.id === 'zhao'), huang = top.find((b) => b.id === 'huang');
  assert.equal(zhao.locked, false, '赵云已解锁');
  assert.equal(huang.locked, true, '黄忠锁定');
  assert.equal(hitBuildBar(view, st, zhao.x + 5, zhao.y + 5), 'zhao', '解锁将可命中');
  assert.equal(hitBuildBar(view, st, huang.x + 5, huang.y + 5), null, '锁定将命中 null');
}

// unlocked=null(调试/单测)→ 全解锁两行
assert.equal(buildBarLayout(view, mkState(null)).length, 12, 'null=全解锁 12 牌');

// 热键映射:下排 1-6,上排 qwerty
assert.equal(HOTKEYS['1'], 'liao'); assert.equal(HOTKEYS['6'], 'yueying');
assert.equal(HOTKEYS['q'], 'huang'); assert.equal(HOTKEYS['y'], 'zhao');
console.log('ok buildBar');
```

Run: `node tests/buildBar.test.mjs`
Expected: FAIL(ROW_CHEAP 等未导出)

- [ ] **Step 2: 重写 src/ui/buildBar.js**

```js
// ui/buildBar.js — [P5/重排spec §5] 底部建造栏:单行(第1章新6将)/两行(解锁五虎后,上排五虎+诸葛)。
// 木牌=头像+楷体将名+金价;锁定将灰底🔒。layout/hit 单一来源;热键映射 HOTKEYS 供 main 消费。
import { GENERALS } from '../data/generals.js';
import { generalSprite } from '../core/assets.js';
import { panel, roundRect, FONT, PAL } from './theme.js';

export const ROW_CHEAP = ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'];   // 价格升序
export const ROW_PREMIUM = ['huang', 'zhang', 'guan', 'ma', 'zhuge', 'zhao'];            // 价格升序
export const HOTKEYS = {
  1: 'liao', 2: 'zhou', 3: 'madai', 4: 'guanping', 5: 'zhangbao', 6: 'yueying',
  q: 'huang', w: 'zhang', e: 'guan', r: 'ma', t: 'zhuge', y: 'zhao',
};
const KEY_OF = Object.fromEntries(Object.entries(HOTKEYS).map(([k, id]) => [id, String(k).toUpperCase()]));
const UNLOCK_HINT = { huang: '过30关', zhang: '过10关', guan: '过20关', ma: '过30关', zhuge: '过20关', zhao: '过10关' };

const BW = 74, BH = 70, GAP = 8, ROW_GAP = 6;

// 布局:返回 [{id,x,y,w,h,row:'cheap'|'premium',locked,key}]。
// unlocked=null → 全解锁;上排仅在「任一五虎已解锁」后出现(第1章=单行,spec §5)。
export function buildBarLayout(view, state) {
  const unlocked = state && state.unlocked;
  const has = (id) => !unlocked || unlocked.has(id);
  const showPremium = ROW_PREMIUM.some(has);
  const rowX = (n) => (view.w - (n * (BW + GAP) - GAP)) / 2;
  const out = [];
  const cheapY = view.h - BH - 12;
  let x = rowX(ROW_CHEAP.length);
  for (const id of ROW_CHEAP) { out.push({ id, x, y: cheapY, w: BW, h: BH, row: 'cheap', locked: !has(id), key: KEY_OF[id] }); x += BW + GAP; }
  if (showPremium) {
    const py = cheapY - BH - ROW_GAP;
    x = rowX(ROW_PREMIUM.length);
    for (const id of ROW_PREMIUM) { out.push({ id, x, y: py, w: BW, h: BH, row: 'premium', locked: !has(id), key: KEY_OF[id] }); x += BW + GAP; }
  }
  return out;
}

// 命中:锁定将返回 null(静默,与买不起置灰同范式)。
export function hitBuildBar(view, state, sx, sy) {
  for (const b of buildBarLayout(view, state)) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.locked ? null : b.id;
  }
  return null;
}

export function drawBuildBar(ctx, state, view, selected) {
  for (const b of buildBarLayout(view, state)) {
    const g = GENERALS[b.id];
    const afford = state.gold >= g.cost;
    const sel = b.id === selected && !b.locked;
    panel(ctx, b.x, b.y, b.w, b.h, { variant: 'wood', r: 9, glow: sel });

    ctx.save();
    if (b.locked) ctx.globalAlpha = 0.42;
    else if (!afford) ctx.globalAlpha = 0.55;
    // 头像牌:将色底+上亮下暗叠层(有立绘裁入框,缺则白字描边将名首字)
    const aw = b.w - 18, ah = 24, ax = b.x + 9, ay = b.y + 7;
    const portrait = generalSprite(b.id, 1);          // [形象演进] 建造栏=1阶(所购即所得)
    roundRect(ctx, ax, ay, aw, ah, 5);
    ctx.fillStyle = g.color; ctx.fill();
    const sh = ctx.createLinearGradient(0, ay, 0, ay + ah);
    sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(1, 'rgba(0,0,0,.34)');
    roundRect(ctx, ax, ay, aw, ah, 5); ctx.fillStyle = sh; ctx.fill();
    if (portrait) {
      ctx.save();
      roundRect(ctx, ax, ay, aw, ah, 5); ctx.clip();
      const iw = aw, ih = iw * (portrait.height / portrait.width || 1.35);
      ctx.drawImage(portrait, ax, ay - ih * 0.04, iw, ih);
      ctx.restore();
    }
    roundRect(ctx, ax, ay, aw, ah, 5);
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
    if (!portrait) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = FONT.head(15); ctx.lineJoin = 'round';
      ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(20,12,4,.7)'; ctx.strokeText(g.name[0], ax + aw / 2, ay + ah / 2 + 0.5);
      ctx.fillStyle = '#fff'; ctx.fillText(g.name[0], ax + aw / 2, ay + ah / 2 + 0.5);
    }
    // 将名(楷体居中)
    ctx.fillStyle = sel ? PAL.goldBright : PAL.cream; ctx.font = FONT.head(13);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(g.name, b.x + b.w / 2, b.y + 45);
    ctx.restore();

    if (b.locked) {
      // 锁定:🔒+解锁条件(给娃可见的收集目标,spec §5)
      ctx.fillStyle = 'rgba(232,222,200,.92)'; ctx.font = FONT.body(11, 700);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🔒 ' + (UNLOCK_HINT[b.id] || ''), b.x + b.w / 2, b.y + b.h - 11);
    } else {
      // 金价(买不起标红)
      ctx.fillStyle = afford ? PAL.goldBright : PAL.warn; ctx.font = FONT.body(11, 700);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('💰' + g.cost, b.x + b.w / 2, b.y + b.h - 11);
    }

    // 左上热键角标
    ctx.fillStyle = 'rgba(20,13,6,.78)';
    roundRect(ctx, b.x + 4, b.y + 4, 14, 13, 3); ctx.fill();
    ctx.fillStyle = PAL.gold; ctx.font = FONT.body(9, 700); ctx.textAlign = 'center';
    ctx.fillText(b.key, b.x + 11, b.y + 11);
  }
}
```

**注意:`generalSprite` 在 Task 9 才创建——本 Task 先在 `core/assets.js` 加最小版(Task 9 再扩 MANIFEST):**

```js
// [形象演进 spec §6.1] 按等级取将立绘:gen_<id>_<stage> 逐级回退 → 旧图 gen_<id> → null(调用方画色块/首字)。
export function generalSprite(id, level = 1) {
  for (let s = Math.min(level, 3); s >= 1; s--) {
    const img = assets.images['gen_' + id + '_' + s];
    if (img) return img;
  }
  return assets.images['gen_' + id] || null;
}
```

- [ ] **Step 3: main.js 接线**

四处修改:
1. 第 16 行 import 增 `HOTKEYS`:`import { drawBuildBar, hitBuildBar, buildBarLayout, HOTKEYS } from './ui/buildBar.js';`;第 9 行 save import 后追加一行 `import { unlockedGenerals, newlyUnlocked } from './data/unlocks.js';`;删除第 28 行 `const GEN_IDS = [...]`(已被 HOTKEYS 取代)。
2. 默认选中将:第 44 行 `let selected = 'huang';` → `let selected = 'liao';`;`enterLevel` 内(第 60 行)`selected = 'huang';` → `selected = 'liao';`,且 `Object.assign(state, newGameState(LEVELS[n]));` → `Object.assign(state, newGameState(LEVELS[n], { unlocked: unlockedGenerals(save) }));`
3. 热键(第 285 行)`else if (ev.key >= '1' && ev.key <= '6') { selected = GEN_IDS[+ev.key - 1]; selectedTower = null; }` 替换为:

```js
  else if (HOTKEYS[ev.key.toLowerCase()]) {
    const id = HOTKEYS[ev.key.toLowerCase()];
    if (!state.unlocked || state.unlocked.has(id)) { selected = id; selectedTower = null; }
  }
```

4. 命中调用补 state 参(两处):第 250 行 `hitBuildBar(view, sx, sy)` → `hitBuildBar(view, state, sx, sy)`;第 271 行 `hitBuildBar(view, ev.clientX, ev.clientY)` → `hitBuildBar(view, state, ev.clientX, ev.clientY)`。第 191 行 `buildBarLayout(view).find(...)` → `buildBarLayout(view, state).find(...)`。
5. `boot()` 内预建 state(第 294 行)同样传 `{ unlocked: unlockedGenerals(save) }`(此行在 `save = browserLoad()` 之后,顺序成立)。

- [ ] **Step 4: 跑测试**

Run: `node tests/buildBar.test.mjs && for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`
Expected: buildBar PASS,全量无 FAIL

- [ ] **Step 5: Commit**

```bash
git add src/ui/buildBar.js src/main.js src/core/assets.js tests/buildBar.test.mjs
git commit -m "feat(tower-defender): 建造栏两行(下排新6将1-6/上排五虎QWERTY)+锁定🔒收集目标+generalSprite取图链,main热键与unlocked接线"
```

### Task 7: 结算面板解锁提示(resultPanel + main)

**Files:**
- Modify: `src/ui/resultPanel.js:6,26,35,65-68`
- Modify: `src/main.js:196-203`

- [ ] **Step 1: resultPanel 增 unlockNotice**

`src/ui/resultPanel.js` 四处:
1. `const BTN_Y_OFF = 56;` → `const BTN_Y_OFF = 84;        // 按钮下移,给解锁提示行留位(spec §4)`
2. `drawResult(ctx, view, state, total)` → `drawResult(ctx, view, state, total, opts = {})`
3. 木匾尺寸 `panel(ctx, cx - PW / 2, cy - 156, PW, 268, ...)` → `panel(ctx, cx - PW / 2, cy - 156, PW, 296, { variant: 'wood', r: 16 });`
4. won 分支的"已解锁·第 N 关"块之后追加:

```js
    if (opts.unlockNotice) {
      ctx.fillStyle = PAL.goldBright; ctx.font = FONT.body(15, 700);
      ctx.fillText(opts.unlockNotice, cx, cy + 58);
    }
```

- [ ] **Step 2: main.js 计算并传递 unlockNotice**

1. 模块变量区(第 49 行 `sfxPhase` 后)加:`let unlockNotice = null;   // [spec §4] 本局通关新解锁的武将提示`
2. `enterLevel` 内 `recorded = false;` 同行处追加 `unlockNotice = null;`
3. 写档块(第 200 行)改为:

```js
      if (s.phase === 'won') {
        const prev = save.unlockedLevel;
        save = applyClear(save, s.level.id, s.stars); browserWrite(save);
        const ids = newlyUnlocked(prev, save.unlockedLevel);
        unlockNotice = ids.length ? '⚔️ 新武将来援:' + ids.map((id) => GENERALS[id].name).join('、') + '!' : null;
      }
```

4. `drawResult(ctx, view, s, LEVELS.length);` → `drawResult(ctx, view, s, LEVELS.length, { unlockNotice });`

- [ ] **Step 3: 全量测试(resultPanel 无单测,跑回归)+ commit**

Run: `for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`
Expected: 无 FAIL

```bash
git add src/ui/resultPanel.js src/main.js
git commit -m "feat(tower-defender): 结算面板解锁轻仪式——通关L10/20/30金字「新武将来援」,按钮组下移留行"
```

### Task 8: heroCard lore + towerPanel 无招牌技兼容

**Files:**
- Modify: `src/ui/heroCard.js:12-21,65`
- Modify: `src/ui/towerPanel.js:45,68-75`

- [ ] **Step 1: HERO_LORE 增 6 条 + 升级文案分支**

`src/ui/heroCard.js` 的 `HERO_LORE` 内追加(zhuge 行后):

```js
  liao: { bio: '蜀汉先锋老将。从黄巾打到蜀汉末年的"常青树",俗话说:蜀中无大将,廖化作先锋。', trait: '速射弓手:出手快、造价低,还能射飞鸟,最实惠的入门武将。' },
  zhou: { bio: '关羽的忠心护卫,黑面虬髯、力大无穷,一生为关公扛青龙偃月刀。', trait: '大刀横扫:一刀劈一片,克制扎堆的地面敌军。' },
  madai: { bio: '马超的从弟,西凉骑兵出身,沉稳可靠,后来一刀斩了反叛的魏延。', trait: '轻骑冲锋:沿蜀道冲杀,一次贯穿两个敌人。' },
  guanping: { bio: '关羽义子,白袍小将,随父镇守荆州,父子并肩作战。', trait: '小水攻:谋略伤害无视护甲,还能减慢敌人脚步。' },
  zhangbao: { bio: '张飞长子,继承父亲的丈八蛇矛,虎父无犬子的猛小伙。', trait: '蛇矛重击:单发伤害高,适合对付皮厚的敌人。' },
  yueying: { bio: '诸葛亮之妻,传说中的发明家,木牛流马、诸葛连弩都有她的巧思。', trait: '机关火弩:射出火羽箭持续灼烧敌人,专克藤甲兵。' },
```

`UPGRADE_TEXT` 常量替换为函数化两版本:

```js
const UPGRADE_TEXT_SIG = `升级(最高 L${BAL.MAX_TOWER_LEVEL}):每级 伤害↑ 射程↑ 攻速↑;升到 L${BAL.SIGNATURE_LEVEL} 解锁招牌技,之后继续变强。`;
const UPGRADE_TEXT_PLAIN = `升级(最高 L${BAL.MAX_TOWER_LEVEL}):每级 伤害↑ 射程↑ 攻速↑。`;
```

`drawHeroCard` 内 `const upLines = wrap(ctx, UPGRADE_TEXT, ...)` → `const upLines = wrap(ctx, g.signature ? UPGRADE_TEXT_SIG : UPGRADE_TEXT_PLAIN, CW - PAD * 2);`
头像取图(第 65 行)`assets.images['gen_' + generalId]` → `generalSprite(generalId, 3)`(import 从 `../core/assets.js` 增 `generalSprite`;heroCard=3 阶目标感,spec §6.1)。

- [ ] **Step 2: towerPanel 无招牌技行 + 当前阶头像**

`src/ui/towerPanel.js`:
1. 第 45 行 `const portrait = assets.images['gen_' + tower.generalId];` → `const portrait = generalSprite(tower.generalId, tower.level);`(import 增 `generalSprite`;towerPanel=当前阶)
2. 招牌技行(第 68-75 行)替换为:

```js
  // 招牌技行(新6将无招牌技 → 整行隐藏,spec §5)
  if (g.signature) {
    if (tower.level >= BAL.SIGNATURE_LEVEL) {
      ctx.fillStyle = '#9a3a12'; ctx.font = FONT.body(11, 700);
      ctx.fillText('★ ' + g.signature.name, L.x + 12, L.y + 58);
    } else {
      ctx.fillStyle = 'rgba(60,46,26,.62)'; ctx.font = FONT.body(11, 600);
      ctx.fillText(`升至 L${BAL.SIGNATURE_LEVEL} 解锁招牌技`, L.x + 12, L.y + 58);
    }
  }
```

- [ ] **Step 3: 跑测试 + commit**

Run: `node tests/heroCard.test.mjs && for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`
Expected: heroCard 遍历 12 将全 PASS,全量无 FAIL

```bash
git add src/ui/heroCard.js src/ui/towerPanel.js
git commit -m "feat(tower-defender): 新6将lore文案+无招牌技UI兼容(heroCard升级文案分支/towerPanel隐藏招牌行)+阶级立绘接入"
```

### Task 9: 形象演进取图全接线 + MANIFEST 36 键

**Files:**
- Modify: `src/core/assets.js:10-65`(MANIFEST)
- Modify: `src/render/entityRenderer.js:37`
- Modify: `tests/assets.test.mjs`(追加 36 键断言)

- [ ] **Step 1: assets.test 追加注册断言(先写失败测试)**

`tests/assets.test.mjs` 末尾追加:

```js
// 5) [形象演进 spec §6.1] 12 将 × 3 阶全部注册,路径规范
{
  const IDS = ['huang', 'zhang', 'guan', 'zhao', 'ma', 'zhuge', 'liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'];
  for (const id of IDS) for (const s of [1, 2, 3]) {
    assert.equal(MANIFEST[`gen_${id}_${s}`], `assets/sprites/generals/${id}_${s}.png`, `gen_${id}_${s} 注册`);
  }
}
console.log('ok assets');
```

(若文件已有结尾 console.log,保持单条。)

Run: `node tests/assets.test.mjs`
Expected: FAIL(`gen_huang_1 注册`)

- [ ] **Step 2: MANIFEST 加 36 键(六将旧键保留作回退)**

在 `gen_zhuge:` 行后插入:

```js
  // —— [形象演进 spec §6] 12 将 × 3 阶(L1寒微/L2精进/L3神兵;取图经 generalSprite 逐级回退)——
  gen_huang_1: 'assets/sprites/generals/huang_1.png', gen_huang_2: 'assets/sprites/generals/huang_2.png', gen_huang_3: 'assets/sprites/generals/huang_3.png',
  gen_zhang_1: 'assets/sprites/generals/zhang_1.png', gen_zhang_2: 'assets/sprites/generals/zhang_2.png', gen_zhang_3: 'assets/sprites/generals/zhang_3.png',
  gen_guan_1: 'assets/sprites/generals/guan_1.png', gen_guan_2: 'assets/sprites/generals/guan_2.png', gen_guan_3: 'assets/sprites/generals/guan_3.png',
  gen_zhao_1: 'assets/sprites/generals/zhao_1.png', gen_zhao_2: 'assets/sprites/generals/zhao_2.png', gen_zhao_3: 'assets/sprites/generals/zhao_3.png',
  gen_ma_1: 'assets/sprites/generals/ma_1.png', gen_ma_2: 'assets/sprites/generals/ma_2.png', gen_ma_3: 'assets/sprites/generals/ma_3.png',
  gen_zhuge_1: 'assets/sprites/generals/zhuge_1.png', gen_zhuge_2: 'assets/sprites/generals/zhuge_2.png', gen_zhuge_3: 'assets/sprites/generals/zhuge_3.png',
  gen_liao_1: 'assets/sprites/generals/liao_1.png', gen_liao_2: 'assets/sprites/generals/liao_2.png', gen_liao_3: 'assets/sprites/generals/liao_3.png',
  gen_zhou_1: 'assets/sprites/generals/zhou_1.png', gen_zhou_2: 'assets/sprites/generals/zhou_2.png', gen_zhou_3: 'assets/sprites/generals/zhou_3.png',
  gen_madai_1: 'assets/sprites/generals/madai_1.png', gen_madai_2: 'assets/sprites/generals/madai_2.png', gen_madai_3: 'assets/sprites/generals/madai_3.png',
  gen_guanping_1: 'assets/sprites/generals/guanping_1.png', gen_guanping_2: 'assets/sprites/generals/guanping_2.png', gen_guanping_3: 'assets/sprites/generals/guanping_3.png',
  gen_zhangbao_1: 'assets/sprites/generals/zhangbao_1.png', gen_zhangbao_2: 'assets/sprites/generals/zhangbao_2.png', gen_zhangbao_3: 'assets/sprites/generals/zhangbao_3.png',
  gen_yueying_1: 'assets/sprites/generals/yueying_1.png', gen_yueying_2: 'assets/sprites/generals/yueying_2.png', gen_yueying_3: 'assets/sprites/generals/yueying_3.png',
```

- [ ] **Step 3: drawTower 接入当前阶**

`src/render/entityRenderer.js` 第 37 行 `const img = assets.images['gen_' + t.generalId];` → `const img = generalSprite(t.generalId, t.level);`(import 行从 `'../core/assets.js'` 增 `generalSprite`)。

- [ ] **Step 4: 跑测试 + commit**

Run: `node tests/assets.test.mjs && node tests/entityRenderer.test.mjs && for f in tests/*.test.mjs; do node "$f" >/dev/null || echo "FAIL $f"; done`
Expected: 全 PASS(缺图时 generalSprite 回退旧键/null,行为与原一致)

```bash
git add src/core/assets.js src/render/entityRenderer.js tests/assets.test.mjs
git commit -m "feat(tower-defender): MANIFEST注册12将×3阶36键+drawTower按当前阶取图(回退链保证缺图不裂)"
```

### Task 10: gen-sprites.mjs 三阶生成条目+锚链

**Files:**
- Modify: `tools/gen-sprites.mjs:74-123`

- [ ] **Step 1: 加 STAGED 数据与三阶生成模式**

`gen()` 改为支持自定义文件名:`const file = path.join(dir, (unit.file || unit.id + '.png'));`

在 `UNITS` 数组后加 STAGED(完整 12 将,prompt 含 spec §6.3 演进表+渲染约束;阶1 明确"不要神兵"防锚链漂移):

```js
// —— [形象演进 spec §6.3] 12 将 × 3 阶。锚链:阶1 用黄忠风格锚;阶2 锚本将阶1;阶3 锚本将阶2(同一人换装)。
// 渲染约束:人形为主、武器/小道具为辅,禁大型载具复杂场景(塔显示高仅 ~51px)。
const PERSON = '【重要】保持与参考图同一人物的长相、肤色、发须与配色,只升级服装与装备。';
const STAGED = [
  { id: 'huang', stages: [
    '三国蜀汉老将·黄忠(初出·寒微):年迈老猎户打扮,花白长须,粗布短衣,手持简朴木弓,精神矍铄。',
    '三国蜀汉老将·黄忠(精进):花白长须,轻便皮甲铁护腕,手持铁胎强弓,背负箭壶,沉稳老练。' + PERSON,
    '三国蜀汉五虎上将·黄忠(神兵):金色鳞甲披风,花白长须,手持华丽宝雕大弓,箭壶金饰,定军山老当益壮的气概。' + PERSON,
  ] },
  { id: 'zhang', stages: [
    '三国蜀汉猛将·张飞(初出·寒微):屠户出身的壮汉,豹头环眼虬髯,粗布短打围裙,手持一杆朴素铁矛(普通直矛,不要蛇形曲刃)。',
    '三国蜀汉猛将·张飞(精进):豹头环眼虬髯怒目,深色皮甲,手持「丈八蛇矛」——矛尖是青亮的蛇形波浪曲刃(蜿蜒如蛇),绝不是直枪尖。' + PERSON,
    '三国蜀汉五虎上将·张飞(神兵):黑色重甲暗金纹,豹头环眼怒目圆睁如当阳桥断喝,手持华丽「丈八蛇矛」(蛇形波浪曲刃,绝非直枪尖),披风猎猎。' + PERSON,
  ] },
  { id: 'guan', stages: [
    '三国蜀汉武将·关羽(初出·寒微):红脸长髯的布衣壮士,绿色头巾粗布劲装,手持一柄朴素的单手朴刀(短柄宽刃刀)。【不要】青龙偃月刀,【不要】长柄大刀,【不要】铠甲。',
    '三国蜀汉武将·关羽(精进):面如重枣长髯及胸,绿袍配铁甲,手持长柄战刀(略宽刃,无龙纹无红缨)。' + PERSON,
    '三国蜀汉五虎上将·关羽(神兵):面如重枣丹凤眼,长髯飘胸,绿袍金甲,骑枣红色骏马「赤兔马」,手持「青龙偃月刀」——长柄顶端宽大弯月形大刀刃,刀背青龙纹,柄端红缨。骑乘全身像,人马都完整。' + PERSON,
  ] },
  { id: 'zhao', stages: [
    '三国蜀汉武将·赵云(初出·寒微):年轻俊朗的白袍枪兵,素白布袍无甲,手持普通长枪,英气内敛。',
    '三国蜀汉武将·赵云(精进):年轻俊朗,白袍配银色鳞甲,手持长枪,腰悬佩剑,英姿飒爽。' + PERSON,
    '三国蜀汉五虎上将·赵云(神兵):白袍银甲白盔缨,骑神骏白马,手持「龙胆亮银枪」(银亮长枪,枪缨雪白),长坂坡单骑救主的英姿。骑乘全身像,人马都完整。' + PERSON,
  ] },
  { id: 'ma', stages: [
    '三国西凉武将·马超(初出·寒微):西凉轻骑装束,皮甲毡袍,手持短骑枪,剽悍英武的青年。',
    '三国西凉武将·马超(精进):兽带轻铠配白袍,手持骑枪,腰挎弯刀,西凉铁骑统帅气度。' + PERSON,
    '三国蜀汉五虎上将·马超(神兵):兽面狮盔银甲白袍「锦马超」,骑西凉白色战马,手持长枪,披风飞扬,英武剽悍。骑乘全身像,人马都完整。' + PERSON,
  ] },
  { id: 'zhuge', stages: [
    '三国谋士·诸葛亮(初出·寒微):隆中布衣书生,青色素袍,手持普通竹扇,清瘦儒雅,目光睿智。',
    '三国军师·诸葛亮(精进):八卦纹道袍,头戴纶巾(青色丝帛软头巾),一手明显握展开的白色羽毛扇,儒雅从容。' + PERSON,
    '三国蜀汉丞相·诸葛亮(神兵):羽扇纶巾(青色软头巾+展开的白羽扇,两样缺一不可),华贵八卦纹鹤氅,端坐一辆简洁的四轮小车(素舆,木质小车,人物占画面主体、车体简洁低矮),仙风道骨。' + PERSON,
  ] },
  { id: 'liao', stages: [
    '三国蜀汉先锋·廖化(初出·寒微):粗布短衣的精瘦汉子,手持简朴猎弓,背小箭壶,坚毅朴实。',
    '三国蜀汉先锋·廖化(精进):轻便皮甲,手持军用强弓,箭壶满箭,先锋营老兵的干练。' + PERSON,
    '三国蜀汉先锋官·廖化(神兵):铁甲披肩配先锋营红色令旗插背,手持精制强弓,神情果敢,「蜀中无大将廖化作先锋」的担当。' + PERSON,
  ] },
  { id: 'zhou', stages: [
    '三国壮士·周仓(初出·寒微):黑面虬髯赤脚的魁梧大汉,粗布短打,手持柴刀,憨直忠勇。',
    '三国壮士·周仓(精进):黑面虬髯,深色铁甲,双手持阔身大刀,魁梧威武。' + PERSON,
    '三国蜀汉猛士·周仓(神兵):黑面虬髯黑甲,肩扛一柄「青龙偃月刀」(长柄弯月大刀刃带青龙纹红缨,为关公扛刀的刀僮形象),忠勇威风。' + PERSON,
  ] },
  { id: 'madai', stages: [
    '三国西凉骑兵·马岱(初出·寒微):西凉布甲青年骑士,手持普通弯刀,沉稳干练。',
    '三国西凉骑将·马岱(精进):轻骑皮铠配毡袍,手持骑兵长刀,腰挎弓囊,剽悍利落。' + PERSON,
    '三国蜀汉将领·马岱(神兵):白袍铁甲,手持一柄寒光斩将大刀,沉稳果决(阵前斩魏延的名刀),西凉骑将风范。' + PERSON,
  ] },
  { id: 'guanping', stages: [
    '三国少年·关平(初出·寒微):眉目英气的少年,粗布练功服,手持木刀,朝气蓬勃。',
    '三国小将·关平(精进):轻甲白袍少年将,手持长刀,英姿初成。' + PERSON,
    '三国蜀汉小将·关平(神兵):白袍银甲红披风,手持父传宝刀(精美长柄战刀),少年英雄气概。' + PERSON,
  ] },
  { id: 'zhangbao', stages: [
    '三国少年·张苞(初出·寒微):浓眉虎目的壮实少年,粗布短打,手持普通短矛,虎虎生威。',
    '三国小将·张苞(精进):深色皮甲,手持「丈八蛇矛」(蛇形波浪曲刃,绝非直枪尖),少年猛将。' + PERSON,
    '三国蜀汉虎贲·张苞(神兵):虎贲铁甲暗金纹,手持家传华丽「丈八蛇矛」(蛇形波浪曲刃),怒目圆睁有乃父之风。' + PERSON,
  ] },
  { id: 'yueying', stages: [
    '三国才女·黄月英(初出·寒微):布裙荆钗的年轻女子,清秀聪慧,手持一具小巧木制手弩,身旁散落图纸。',
    '三国发明家·黄月英(精进):利落工装布裙,袖口束起,手持机关连弩(多管小弩),腰挂工具袋,巧思灵动。' + PERSON,
    '三国蜀汉巧匠·黄月英(神兵):鹅黄色衣裙配轻便护甲,手持精巧「诸葛连弩」(多管连发弩,弩匣金饰),背负小型机关匣,弩箭带火羽,聪慧自信。人形为主,不要大型机械。' + PERSON,
  ] },
];
```

主流程(`const only = ...` 之后)追加 staged 模式分支(放在现有 UNITS 循环之后,或经 `--stages` 旗标走独立循环):

```js
// —— 三阶模式:node tools/gen-sprites.mjs --stages [id...](无 id = 全 12 将)——
if (process.argv.includes('--stages')) {
  const ids = process.argv.slice(2).filter((a) => a !== '--stages');
  const todo = ids.length ? STAGED.filter((u) => ids.includes(u.id)) : STAGED;
  if (!anchorUrl && fs.existsSync(anchorFile)) anchorUrl = dataUrlOf(anchorFile);
  for (const u of todo) {
    let ref = anchorUrl;                          // 阶1:黄忠风格锚
    for (let s = 1; s <= 3; s++) {
      const file = `${u.id}_${s}.png`;
      try {
        const r = await gen({ cat: 'generals', id: u.id, file, desc: u.stages[s - 1] }, ref);
        console.log(`✓ generals/${file}  (${(r.bytes / 1024).toFixed(0)} KB)`);
        ref = dataUrlOf(r.file);                  // 锚链:下一阶锚本阶(同一人换装)
        await sleep(1500);
      } catch (e) { console.log(`✗ generals/${file} — ${e.message}`); break; }
    }
  }
  process.exit(0);
}
```

(注意将此块放在原 UNITS 循环**之前**,避免 --stages 时跑旧全套;原循环保持不动。)

- [ ] **Step 2: 语法自检 + commit(不跑生成)**

Run: `node --check tools/gen-sprites.mjs`
Expected: 无输出(语法 OK)

```bash
git add tools/gen-sprites.mjs
git commit -m "feat(tower-defender): gen-sprites三阶模式--stages(12将×3阶prompt+本将锚链防漂移,阶1反神兵约束)"
```

### Task 11: 生成 36 张三阶立绘(需 OPENROUTER_API_KEY)

**Files:**
- Create: `assets/sprites/generals/<id>_<1|2|3>.png` × 36

**⚠️ Key 安全铁律:OPENROUTER_API_KEY 仅命令行环境变量注入,绝不写入任何文件/脚本/git;完成后提醒 James 在 OpenRouter 后台轮换。**

- [ ] **Step 1: 先生成一将验证管线(廖化,新将无历史包袱)**

Run: `OPENROUTER_API_KEY=<James提供> node tools/gen-sprites.mjs --stages liao`
Expected: `✓ generals/liao_1.png` `liao_2` `liao_3` 三行

- [ ] **Step 2: debg 去底+瘦身,目检**

Run: `python3 tools/debg-sprites.py generals/liao_1.png generals/liao_2.png generals/liao_3.png`
然后用 Read 工具目检 3 张图:人物同一、装备递进、透明背景、无大型场景。不合格 → 重跑该将(单张重 roll)。

- [ ] **Step 3: 全量 12 将生成(36 张,约 5-8 分钟,1.5s 间隔防限流)**

Run: `OPENROUTER_API_KEY=<James提供> node tools/gen-sprites.mjs --stages`
Expected: 36 行 ✓(廖化会重新生成,覆盖即可)。失败的单将用 `--stages <id>` 补跑。

- [ ] **Step 4: 全量 debg + 尺寸预算检查**

Run: `python3 tools/debg-sprites.py $(cd assets/sprites && ls generals/*_[123].png)`
Run: `du -sh assets/sprites/generals/ && ls -la assets/sprites/generals/*_[123].png | wc -l`
Expected: 36 张,单张 ≤300KB、总增量 ≤6MB

- [ ] **Step 5: 目检关键阶(关羽三阶:朴刀→长刀→偃月刀+赤兔马;诸葛三阶:竹扇→羽扇→四轮小车)**

用 Read 工具看 `guan_1/2/3.png`、`zhuge_1/2/3.png`、`zhao_3.png`、`yueying_3.png`。装备演进不达意 → 调该阶 desc 重 roll(改 prompt 须 commit)。

- [ ] **Step 6: Commit 资产**

```bash
git add assets/sprites/generals/
git commit -m "assets(tower-defender): 12将×3阶形象演进立绘36张(Nano Banana锚链生成+debg去底≤512px,关羽朴刀→偃月刀赤兔/诸葛竹扇→羽扇纶巾四轮车)"
```

### Task 12: 全量门禁 + balance-report + 浏览器冒烟

**Files:**
- 无新改动(验证收口)

- [ ] **Step 1: 全量单测**

Run: `for f in tests/*.test.mjs; do echo "== $f"; node "$f" || exit 1; done`
Expected: 全绿(46 个文件:45 旧 + unlocks + buildBar − 0)

- [ ] **Step 2: 关卡几何校验 + balance-report 趋势**

Run: `node tools/verify-levels.mjs && node tools/balance-report.mjs | tail -30`
Expected: verify 通过;balance-report 重点看:第 1 章可负担塔数(CHEAP=40 后应 ≥5)、关羽 DPS/金 是否冒尖(spec §9 观察项,过强后续回调 interval 2.4)

- [ ] **Step 3: 浏览器冒烟(host 侧 puppeteer-core + 系统 Chrome,沙箱禁 localhost——见记忆 boom-worms-smoke-test-setup)**

参考 `/tmp/td-smoke.cjs` 先例写冒烟脚本验证:
1. 新档(清 localStorage)进 L1:建造栏单行 6 牌、热键 1 选廖化、建塔成功
2. `__td.getSave()` 注入 `unlockedLevel: 11` 重载进 L11:两行 12 牌、赵云可点、黄忠灰底🔒、Q 键选黄忠无效
3. `__td` 建 1 座廖化升到 L3:塔立绘随等级变化(截图对比 L1/L3)
4. 通关 L10(用 `__td.setGold` + 调试跳关模拟胜利)结算面板出现"⚔️ 新武将来援:赵云、张飞!"
5. 截图存 /tmp 给 James 终审

- [ ] **Step 4: 更新记忆文件并 commit 收口**

更新 `~/.claude/projects/-Users-james-Projects-game-hub/memory/tower-defender-game.md`:追加本次重排+新将+解锁+形象演进完成状态、关键数值、待 James+娃实玩验收。

```bash
git add -A games/tower-defender
git commit -m "chore(tower-defender): 武将重排全量门禁收口(46单测+verify+balance-report+冒烟)"
```

---

## Self-Review 记录

- **Spec 覆盖**:§2.1/2.2(Task 2)、§2.3(Task 1)、§3(Task 3/5)、§4(Task 7)、§5(Task 6/8)、§6(Task 9/10/11)、§7 全触点有任务、§8 门禁(Task 1/2/3/4/6/9/12)、§9 预案内嵌 Task 4/12、§10 范围外未越界 ✓
- **占位符扫描**:无 TBD/TODO;Task 2 Step 4 的 signatureSkills 字面量与 economy 起始金按"现值推导"给出了精确目标数(63/10/756/400),executor 对照现文件替换 ✓
- **类型一致性**:`generalSprite(id, level)`(Task 6 定义,Task 8/9 消费)、`buildBarLayout(view, state)`/`hitBuildBar(view, state, sx, sy)`(Task 6 定义与 main 接线同步)、`newGameState(level, opts)`(Task 5 定义,Task 6 main 传参)、`unlockedGenerals(save)`/`newlyUnlocked(prev, next)`(Task 3 定义,Task 4/6/7 消费)✓
