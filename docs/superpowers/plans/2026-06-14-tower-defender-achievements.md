# 成就系统实现计划（武将图鉴 + 15 挑战成就）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给成都保卫战加「成就中心」——44 张武将卡图鉴（我方按累计击杀升 6 段位、敌方击败后点亮）+ 15 条挑战成就，纯荣誉零数值影响。

**Architecture:** 新增独立 render-free 存档模块 `core/achievements.js`（键 `save_td_ach_v1`，照搬 `save.js` 注入式范式）+ 数据模块 `data/achievements.js`（15 条定义 + `evaluate`）+ UI `ui/codexScreen.js`（照搬 `levelSelect.js` 的 layout/hit/draw 单一来源）。击杀归因走现有 `enemyKilled` 事件，`killEnemy` 加 `killerId` 第三参；灼烧致死归"最后点火的将"。main.js 内存累加、定点落盘。

**Tech Stack:** 纯 ESM、Canvas 2D、`node:assert` 直跑式测试（`node tests/x.test.mjs`）、事件总线 `core/eventBus.js`、localStorage（注入 storage 单测）。

**spec：** `docs/superpowers/specs/2026-06-14-tower-defender-achievements-design.md`

**约定：** 所有命令在 `games/tower-defender/` 下运行。测试运行：`node tests/<name>.test.mjs`（无框架，无抛错即通过）。全量：`for f in tests/*.test.mjs; do node "$f" || exit 1; done`。

---

## 文件结构

| 文件 | 职责 | 新增/改动 |
|---|---|---|
| `src/core/achievements.js` | 存档 schema/load/write/迁移 + 段位表 `TIERS`/`tierIndex` + 记录/查询纯函数 | 新增 |
| `src/data/achievements.js` | 15 条成就定义 + `evaluate(ach,save,run)` + 文案 | 新增 |
| `src/ui/codexScreen.js` | 成就中心 layout/hit/draw（图鉴页 + 成就页 + 大卡详情） | 新增 |
| `src/systems/combat/kill.js` | `killEnemy(state,enemy,killerId)` + 事件带 killerId | 改 |
| `src/systems/combat/attacks.js` | `hitOnce` 致死传 `tower.generalId` | 改 |
| `src/systems/combat/signatureSkills.js` | 致死传 `tower.generalId` | 改 |
| `src/systems/combat/statusEffects.js` | `applyBurn` 记 `src` | 改 |
| `src/systems/statusSystem.js` | 灼烧致死传"最后点火将" | 改 |
| `src/core/gameState.js` | `newGameState` 加 `runKills:{}` | 改 |
| `src/main.js` | `ach` 加载、`enemyKilled` 累加/记录/横幅、结算 `evaluate`、落盘、`screen='codex'` 路由、入口钮、toast 渲染 | 改 |

> `systems/terrainSystem.js` **无需改动**：环境致死现有 `killEnemy(state,e)` 不传第三参，默认 `killerId=null`，语义即"环境击杀不记功"。

---

## Task 1: 成就存档模块（schema + 段位）

**Files:**
- Create: `src/core/achievements.js`
- Test: `tests/achievements.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
// tests/achievements.test.mjs — 注入式存档往返 / 损坏回退 / 归一化 / 段位边界 / 记录函数
import assert from 'node:assert';
import {
  defaultAch, loadAch, writeAch, ACH_VERSION,
  TIERS, tierIndex, recordKill, recordDefeatedEnemy, totalKills, cardTier,
} from '../src/core/achievements.js';

function fakeStore() {
  return { m: {}, getItem(k){ return Object.prototype.hasOwnProperty.call(this.m,k)?this.m[k]:null; }, setItem(k,v){ this.m[k]=v; } };
}

// 空 storage → 默认
{ const s = fakeStore(); assert.deepEqual(loadAch(s), defaultAch(), '空 → 默认'); }

// 往返一致
{
  const s = fakeStore();
  const a = defaultAch(); a.kills = { guan: 12 }; a.seen = { lvbu: true }; a.namedDefeats = 3; a.earned = { first_blood: true };
  writeAch(s, a);
  assert.deepEqual(loadAch(s), { version: ACH_VERSION, kills:{guan:12}, seen:{lvbu:true}, namedDefeats:3, earned:{first_blood:true} }, '往返');
}

// 坏 JSON → 默认
{ const bad = { getItem(){ return '{x'; }, setItem(){} }; assert.deepEqual(loadAch(bad), defaultAch(), '坏 JSON → 默认'); }

// 脏字段归一化
{
  const s = fakeStore();
  s.m['save_td_ach_v1'] = JSON.stringify({ kills:'x', seen:5, namedDefeats:-9, earned:null });
  const a = loadAch(s);
  assert.deepEqual(a.kills, {}, '脏 kills → {}');
  assert.deepEqual(a.seen, {}, '脏 seen → {}');
  assert.equal(a.namedDefeats, 0, '负 namedDefeats → 0');
  assert.deepEqual(a.earned, {}, '脏 earned → {}');
}

// 段位边界
{
  assert.equal(TIERS.length, 6, '6 段');
  assert.equal(tierIndex(0), 0, '0 → 青铜');
  assert.equal(tierIndex(49), 0, '49 → 青铜');
  assert.equal(tierIndex(50), 1, '50 → 白银');
  assert.equal(tierIndex(399), 2, '399 → 黄金');
  assert.equal(tierIndex(400), 3, '400 → 钻石');
  assert.equal(tierIndex(2499), 4, '2499 → 荣耀');
  assert.equal(tierIndex(2500), 5, '2500 → 王者');
  assert.equal(tierIndex(undefined), 0, 'undefined → 青铜');
}

// 记录函数
{
  const a = defaultAch();
  recordKill(a, 'guan'); recordKill(a, 'guan'); recordKill(a, null);
  assert.equal(a.kills.guan, 2, 'recordKill 累加;null 不计');
  assert.equal(cardTier(a, 'guan'), 0, 'cardTier 查段位');
  recordDefeatedEnemy(a, 'lvbu'); recordDefeatedEnemy(a, 'lvbu');
  assert.equal(a.seen.lvbu, true, 'seen 标记');
  assert.equal(a.namedDefeats, 2, 'namedDefeats 每次累加');
  recordKill(a, 'zhao'); assert.equal(totalKills(a), 3, 'totalKills 求和');
}

console.log('achievements.test.mjs OK');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/achievements.test.mjs`
Expected: FAIL（`Cannot find module ../src/core/achievements.js`）

- [ ] **Step 3: 写实现**

```js
// src/core/achievements.js — 成就/图鉴存档（注入式纯函数 + browser 包装）。copy-pattern 自 core/save.js。
// render-free、可单测。key: save_td_ach_v1（独立于进度档 save_td_v1）。
// schema: { version, kills:{generalId:n}, seen:{enemyId:true}, namedDefeats:n, earned:{achId:true} }
const KEY = 'save_td_ach_v1';
export const ACH_VERSION = 1;

// 改 schema 时：①ACH_VERSION+1 ②注册 MIGRATIONS[from]=(d)=>d'。归一化(loadAch 末段)是兜底，不替代迁移。
const MIGRATIONS = {};
export function _applyAchMigrations(d, migrations = MIGRATIONS, current = ACH_VERSION) {
  let v = Number.isInteger(d.version) ? d.version : 0, out = d;
  while (v < current && migrations[v]) { out = migrations[v](out); v++; }
  return out;
}

// 段位阶梯（spec §7）。门槛=累计击杀，常量表可调。
export const TIERS = [
  { key: 'bronze',  name: '青铜', min: 0 },
  { key: 'silver',  name: '白银', min: 50 },
  { key: 'gold',    name: '黄金', min: 150 },
  { key: 'diamond', name: '钻石', min: 400 },
  { key: 'glory',   name: '荣耀', min: 1000 },
  { key: 'king',    name: '王者', min: 2500 },
];
export function tierIndex(kills) {
  const k = kills || 0; let t = 0;
  for (let i = 0; i < TIERS.length; i++) if (k >= TIERS[i].min) t = i;
  return t;
}

export function defaultAch() {
  return { version: ACH_VERSION, kills: {}, seen: {}, namedDefeats: 0, earned: {} };
}

export function loadAch(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return defaultAch();
    const d = _applyAchMigrations(JSON.parse(raw));
    return {
      version: ACH_VERSION,
      kills: d.kills && typeof d.kills === 'object' ? { ...d.kills } : {},
      seen: d.seen && typeof d.seen === 'object' ? { ...d.seen } : {},
      namedDefeats: Number.isInteger(d.namedDefeats) && d.namedDefeats >= 0 ? d.namedDefeats : 0,
      earned: d.earned && typeof d.earned === 'object' ? { ...d.earned } : {},
    };
  } catch { return defaultAch(); }
}

export function writeAch(storage, ach) {
  try { storage.setItem(KEY, JSON.stringify(ach)); } catch { /* 隐私模式/配额 → 忽略 */ }
  return ach;
}

// —— 记录/查询（就地 mutate ach 并返回，便于链用；纯逻辑、无 IO）——
export function recordKill(ach, generalId) {
  if (!generalId) return ach;
  ach.kills[generalId] = (ach.kills[generalId] || 0) + 1;
  return ach;
}
export function recordDefeatedEnemy(ach, enemyId) {
  if (!enemyId) return ach;
  ach.namedDefeats = (ach.namedDefeats || 0) + 1;   // 累计（含重复）
  if (!ach.seen[enemyId]) ach.seen[enemyId] = true; // 唯一集合
  return ach;
}
export function totalKills(ach) { let n = 0; for (const k in ach.kills) n += ach.kills[k]; return n; }
export function cardTier(ach, generalId) { return tierIndex(ach.kills[generalId] || 0); }

export const browserLoadAch = () => loadAch(window.localStorage);
export const browserWriteAch = (a) => writeAch(window.localStorage, a);
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/achievements.test.mjs`
Expected: PASS（打印 `achievements.test.mjs OK`）

- [ ] **Step 5: 提交**

```bash
git add tests/achievements.test.mjs src/core/achievements.js
git commit -m "feat(tower-defender): 成就存档模块(schema+段位+记录函数)"
```

---

## Task 2: 成就定义 + evaluate

**Files:**
- Create: `src/data/achievements.js`
- Test: `tests/achievementsEval.test.mjs`

> evaluate 依赖真实 `LEVELS`/`CHAPTERS`/`unlockedGenerals`/`BOSSES`（静态数据）。测试用真实关数据 + 构造 save。

- [ ] **Step 1: 写失败测试**

```js
// tests/achievementsEval.test.mjs — 15 条成就判定 / earned 幂等 / runCtx 驱动
import assert from 'node:assert';
import { ACHIEVEMENTS, evaluate } from '../src/data/achievements.js';
import { defaultAch } from '../src/core/achievements.js';
import { LEVELS } from '../src/data/levels.js';
import { CHAPTERS } from '../src/data/campaign.js';
import { BOSSES, LIEUTENANTS } from '../src/data/bosses.js';

const baseSave = () => ({ version: 1, unlockedLevel: 1, stars: {}, settings: {} });

// 15 条齐全 + id 唯一
{
  assert.equal(ACHIEVEMENTS.length, 15, '15 条');
  const ids = new Set(ACHIEVEMENTS.map(a => a.id));
  assert.equal(ids.size, 15, 'id 唯一');
}

// 空档：一条都不达成
{ assert.deepEqual(evaluate(defaultAch(), baseSave(), {}), [], '空档 0 达成'); }

// 初战告捷：通关第 1 关
{
  const s = baseSave(); s.stars = { 1: 2 };
  assert.ok(evaluate(defaultAch(), s, {}).includes('first_blood'), '通 L1 → 初战告捷');
}

// 三分天下：全 50 关有星
{
  const s = baseSave(); for (let i = 1; i <= LEVELS.length; i++) s.stars[i] = 1;
  const got = evaluate(defaultAch(), s, {});
  assert.ok(got.includes('three_kingdoms'), '全清 → 三分天下');
  assert.ok(got.includes('first_blood'), '同时含初战告捷');
}

// 群英荟萃 + 五虎上将：unlockedLevel>30 → 12 将全解锁
{
  const s = baseSave(); s.unlockedLevel = 40;
  const got = evaluate(defaultAch(), s, {});
  assert.ok(got.includes('gather_heroes'), '12 将全解锁');
  assert.ok(got.includes('five_tigers'), '五虎集齐');
}

// 知己知彼：20 名将全 seen
{
  const a = defaultAch(); for (const id of Object.keys(BOSSES)) a.seen[id] = true;
  assert.ok(evaluate(a, baseSave(), {}).includes('know_enemy'), '20 名将 → 知己知彼');
}

// 武庙立像：12 友(unlockedLevel>30) + 32 敌全 seen
{
  const a = defaultAch();
  for (const id of [...Object.keys(BOSSES), ...Object.keys(LIEUTENANTS)]) a.seen[id] = true;
  const s = baseSave(); s.unlockedLevel = 40;
  assert.ok(evaluate(a, s, {}).includes('martial_temple'), '44 卡全亮 → 武庙立像');
}

// 段位类：钻石/王者
{
  const a = defaultAch(); a.kills = { guan: 400 };
  assert.ok(evaluate(a, baseSave(), {}).includes('dazzling'), '400 → 流光溢彩');
  assert.ok(!evaluate(a, baseSave(), {}).includes('pinnacle'), '400 未到王者');
  a.kills.guan = 2500;
  assert.ok(evaluate(a, baseSave(), {}).includes('pinnacle'), '2500 → 登峰造极');
}

// 壮举：万人敌(run) / 固若金汤(run) / 完美战役(stars=3)
{
  assert.ok(evaluate(defaultAch(), baseSave(), { maxRunKills: 50 }).includes('slayer'), '单局50 → 万人敌');
  assert.ok(evaluate(defaultAch(), baseSave(), { castleHpFull: true }).includes('impregnable'), '满血 → 固若金汤');
  const s = baseSave(); s.stars = { 5: 3 };
  assert.ok(evaluate(defaultAch(), s, {}).includes('perfect_battle'), '3星 → 完美战役');
}

// 累计：杀敌如麻 / 名将收割
{
  const a = defaultAch(); a.kills = { guan: 600, zhao: 400 }; a.namedDefeats = 100;
  const got = evaluate(a, baseSave(), {});
  assert.ok(got.includes('slaughter'), '累计1000 → 杀敌如麻');
  assert.ok(got.includes('reaper'), '名将100 → 名将收割');
}

// earned 幂等：已得不再返回
{
  const s = baseSave(); s.stars = { 1: 1 };
  const a = defaultAch(); a.earned = { first_blood: true };
  assert.ok(!evaluate(a, s, {}).includes('first_blood'), '已 earned 不重复');
}

// 一方平定 / 运筹帷幄：第一章全清 / 全三星
{
  const ch1 = CHAPTERS[0].id;
  const idxs = LEVELS.map((l, i) => ({ l, i })).filter(x => x.l.chapter === ch1).map(x => x.i + 1);
  const s1 = baseSave(); for (const n of idxs) s1.stars[n] = 1;
  assert.ok(evaluate(defaultAch(), s1, {}).includes('pacify_region'), '第一章全清 → 一方平定');
  const s3 = baseSave(); for (const n of idxs) s3.stars[n] = 3;
  assert.ok(evaluate(defaultAch(), s3, {}).includes('masterstroke'), '第一章全3星 → 运筹帷幄');
}

console.log('achievementsEval.test.mjs OK');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/achievementsEval.test.mjs`
Expected: FAIL（`Cannot find module ../src/data/achievements.js`）

- [ ] **Step 3: 写实现**

```js
// src/data/achievements.js — 15 条挑战成就定义 + evaluate（纯函数，render-free）。
// evaluate(ach, save, run) → 当前"已达成但未 earned"的 id 数组（main.js 据此弹横幅 + 落盘）。
// run = { maxRunKills, castleHpFull }（结算/击杀时由 main.js 组装）。
import { LEVELS } from './levels.js';
import { CHAPTERS } from './campaign.js';
import { unlockedGenerals } from './unlocks.js';
import { BOSSES } from './bosses.js';
import { totalKills } from '../core/achievements.js';

const FIVE_TIGERS = ['guan', 'zhang', 'zhao', 'ma', 'huang'];

function chapterLevelNums(chId) {
  const out = [];
  for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i].chapter === chId) out.push(i + 1);
  return out;
}
function chapterCleared(save, chId) {
  const ns = chapterLevelNums(chId);
  return ns.length > 0 && ns.every((n) => (save.stars[n] || 0) >= 1);
}
function chapterAllThreeStar(save, chId) {
  const ns = chapterLevelNums(chId);
  return ns.length > 0 && ns.every((n) => save.stars[n] === 3);
}
const anyChapter = (save, fn) => CHAPTERS.some((c) => fn(save, c.id));

export const ACHIEVEMENTS = [
  { id: 'first_blood',    name: '初战告捷', cat: '进度', desc: '通关第 1 关',              test: (c) => (c.save.stars[1] || 0) >= 1 },
  { id: 'pacify_region',  name: '一方平定', cat: '进度', desc: '通关任意一整章',          test: (c) => anyChapter(c.save, chapterCleared) },
  { id: 'three_kingdoms', name: '三分天下', cat: '进度', desc: '通关全部 50 关',          test: (c) => LEVELS.every((_, i) => (c.save.stars[i + 1] || 0) >= 1) },
  { id: 'gather_heroes',  name: '群英荟萃', cat: '进度', desc: '解锁全部 12 位我方武将',  test: (c) => c.unlocked.size >= 12 },
  { id: 'five_tigers',    name: '五虎上将', cat: '收集', desc: '集齐五虎上将',            test: (c) => FIVE_TIGERS.every((id) => c.unlocked.has(id)) },
  { id: 'know_enemy',     name: '知己知彼', cat: '收集', desc: '点亮全部 20 名敌方名将',  test: (c) => Object.keys(BOSSES).every((id) => c.ach.seen[id]) },
  { id: 'martial_temple', name: '武庙立像', cat: '收集', desc: '点亮全部 44 张武将卡',    test: (c) => c.cardsLit >= 44 },
  { id: 'dazzling',       name: '流光溢彩', cat: '收集', desc: '任一武将达到钻石段位',    test: (c) => c.maxKills >= 400 },
  { id: 'pinnacle',       name: '登峰造极', cat: '收集', desc: '任一武将达到王者段位',    test: (c) => c.maxKills >= 2500 },
  { id: 'slayer',         name: '万人敌',   cat: '壮举', desc: '单局某将击杀 ≥ 50',        test: (c) => (c.run.maxRunKills || 0) >= 50 },
  { id: 'impregnable',    name: '固若金汤', cat: '壮举', desc: '满血通关任意关',          test: (c) => c.run.castleHpFull === true },
  { id: 'perfect_battle', name: '完美战役', cat: '壮举', desc: '任意关三星通关',          test: (c) => c.anyThreeStar },
  { id: 'masterstroke',   name: '运筹帷幄', cat: '壮举', desc: '某一整章全部三星',        test: (c) => anyChapter(c.save, chapterAllThreeStar) },
  { id: 'slaughter',      name: '杀敌如麻', cat: '累计', desc: '累计击杀 1000',            test: (c) => c.total >= 1000 },
  { id: 'reaper',         name: '名将收割', cat: '累计', desc: '累计击败敌将 100',         test: (c) => (c.ach.namedDefeats || 0) >= 100 },
];

const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achName = (id) => (ACH_BY_ID[id]?.name || id);

export function evaluate(ach, save, run = {}) {
  const unlocked = unlockedGenerals(save);
  const seenCount = Object.keys(ach.seen || {}).filter((k) => ach.seen[k]).length;
  const killVals = Object.values(ach.kills || {});
  const ctx = {
    ach, save, run, unlocked,
    cardsLit: unlocked.size + seenCount,          // 12 友(解锁) + 敌(seen)，自然封顶 44
    maxKills: killVals.length ? Math.max(...killVals) : 0,
    total: totalKills(ach),
    anyThreeStar: Object.values(save.stars || {}).some((s) => s === 3),
  };
  const out = [];
  for (const a of ACHIEVEMENTS) if (!ach.earned[a.id] && a.test(ctx)) out.push(a.id);
  return out;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/achievementsEval.test.mjs`
Expected: PASS（`achievementsEval.test.mjs OK`）

- [ ] **Step 5: 提交**

```bash
git add tests/achievementsEval.test.mjs src/data/achievements.js
git commit -m "feat(tower-defender): 15条成就定义+evaluate判定"
```

---

## Task 3: killEnemy 击杀归因（killerId 第三参）

**Files:**
- Modify: `src/systems/combat/kill.js`
- Modify: `src/systems/combat/attacks.js:24`（`hitOnce` 致死）
- Modify: `src/systems/combat/signatureSkills.js:33`
- Test: `tests/killAttribution.test.mjs`

- [ ] **Step 1: 写失败测试**

```js
// tests/killAttribution.test.mjs — killEnemy 第三参 killerId 进入 enemyKilled 事件
import assert from 'node:assert';
import { bus } from '../src/core/eventBus.js';
import { killEnemy } from '../src/systems/combat/kill.js';

function mkState() { return { gold: 0 }; }
function mkEnemy() { return { alive: true, gold: 5, px: 0, py: 0 }; }

// 带 killerId → 事件携带
{
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  killEnemy(mkState(), mkEnemy(), 'guan');
  assert.equal(got.length, 1, '触发一次');
  assert.equal(got[0].killerId, 'guan', 'killerId 透传');
  if (off) off();
}

// 不传 → killerId=null（环境击杀），且仍掉金/置死
{
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  const s = mkState(); const e = mkEnemy();
  const r = killEnemy(s, e);
  assert.equal(r, true, '首杀返回 true');
  assert.equal(e.alive, false, '置死');
  assert.equal(s.gold, 5, '掉金');
  assert.equal(got[0].killerId, null, '缺省 killerId=null');
  if (off) off();
}

// 幂等：已死不重复
{
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  const e = mkEnemy(); e.alive = false;
  assert.equal(killEnemy(mkState(), e, 'zhao'), false, '已死 → false');
  assert.equal(got.length, 0, '不重复 emit');
  if (off) off();
}

console.log('killAttribution.test.mjs OK');
```

> 若 `bus.on` 不返回取消函数，删去 `off()` 调用即可（测试间事件累积不影响断言，因每块用独立 `got`）。

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/killAttribution.test.mjs`
Expected: FAIL（`killerId` 为 `undefined`，断言 `=== 'guan'`/`=== null` 不过）

- [ ] **Step 3: 改 `src/systems/combat/kill.js`**

```js
// systems/combat/kill.js — 共享击杀:alive=false + 同步掉金 + emit 通知(带 killerId 归因)。
import { bus } from '../../core/eventBus.js';

export function killEnemy(state, enemy, killerId = null) {
  if (!enemy.alive) return false;                       // 已死幂等
  enemy.alive = false;
  state.gold += enemy.gold;                              // [N5] 同步写 state（权威）
  bus.emit('enemyKilled', { enemy, killerId });         // killerId=我方将 id | null(环境/DoT 无源)
  return true;
}
```

- [ ] **Step 4: 改 `src/systems/combat/attacks.js`（`hitOnce` 第 24 行）**

把 `if (enemy.hp <= 0) return killEnemy(state, enemy);`
改为：
```js
  if (enemy.hp <= 0) return killEnemy(state, enemy, tower.generalId);
```

- [ ] **Step 5: 改 `src/systems/combat/signatureSkills.js`（第 33 行）**

把 `if (e.hp <= 0) killEnemy(state, e);`
改为：
```js
    if (e.hp <= 0) killEnemy(state, e, tower.generalId);
```
> 确认该函数作用域内 `tower` 为入参（第 26 行 `effectiveStats(tower)` 已用到）。

- [ ] **Step 6: 跑测试 + 回归既有战斗测试**

Run:
```bash
node tests/killAttribution.test.mjs
node tests/combat.test.mjs
node tests/signatureSkills.test.mjs
node tests/attacks.test.mjs
```
Expected: 全 PASS（既有测试解构 `{enemy}` 不受新增 `killerId` 影响）

- [ ] **Step 7: 提交**

```bash
git add tests/killAttribution.test.mjs src/systems/combat/kill.js src/systems/combat/attacks.js src/systems/combat/signatureSkills.js
git commit -m "feat(tower-defender): killEnemy加killerId归因+直伤/招牌技传将id"
```

---

## Task 4: 灼烧归因（applyBurn 记 src + DoT 致死归最后点火将）

**Files:**
- Modify: `src/systems/combat/statusEffects.js`（`applyBurn`）
- Modify: `src/systems/combat/attacks.js`（`attackBurn` 传 `g.id`）
- Modify: `src/systems/statusSystem.js:38`（DoT 致死取栈末 src）
- Test: `tests/burnAttribution.test.mjs`

> 实现前先 `Read src/systems/combat/statusEffects.js` 确认 `applyBurn` 现有签名与栈结构（spec：栈元素 `{dps, until}`，本任务加 `src`）。

- [ ] **Step 1: 写失败测试**

```js
// tests/burnAttribution.test.mjs — 灼烧栈记 src;DoT 致死归"栈末点火将";环境灼烧不记功
import assert from 'node:assert';
import { bus } from '../src/core/eventBus.js';
import { applyBurn } from '../src/systems/combat/statusEffects.js';
import { statusSystem } from '../src/systems/statusSystem.js';

function mkEnemy(hp) {
  return { alive: true, hp, maxHp: hp, gold: 5, px: 0, py: 0, statuses: {}, envBurn: null, resist: null };
}
function mkState(enemies) { return { phase: 'combat', time: 100, gold: 0, enemies }; }

// applyBurn 记 src
{
  const e = mkEnemy(100);
  applyBurn(e, 10, 3, 100, 'zhuge');
  const last = e.statuses.burn[e.statuses.burn.length - 1];
  assert.equal(last.src, 'zhuge', '栈元素带 src');
}

// DoT 致死 → killerId = 栈末 src
{
  const e = mkEnemy(1);                 // 1 滴血，一 tick 必死
  applyBurn(e, 100, 3, 100, 'yueying');
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  statusSystem(mkState([e]), 1);        // dt=1，burn 100 → 致死
  assert.equal(e.alive, false, '烧死');
  assert.equal(got[0].killerId, 'yueying', 'DoT 致死归点火将');
  if (off) off();
}

// 环境灼烧致死（envBurn，无 src）→ killerId=null
{
  const e = mkEnemy(1); e.envBurn = { dps: 100, until: 999 };
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  statusSystem(mkState([e]), 1);
  assert.equal(e.alive, false, '环境烧死');
  assert.equal(got[0].killerId, null, '环境击杀不记功');
  if (off) off();
}

console.log('burnAttribution.test.mjs OK');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/burnAttribution.test.mjs`
Expected: FAIL（`applyBurn` 不接受 src / `killerId` 非 'yueying'）

- [ ] **Step 3: 改 `applyBurn`（`src/systems/combat/statusEffects.js`）**

给签名加 `src = null` 末参，push 的栈元素带 `src`。例（按文件实际结构对齐，保留原 dps/until 字段）：
```js
export function applyBurn(enemy, dps, dur, now, src = null) {
  if (!enemy.statuses.burn) enemy.statuses.burn = [];
  enemy.statuses.burn.push({ dps, until: now + dur, src });
}
```

- [ ] **Step 4: 改 `attackBurn`（`src/systems/combat/attacks.js`，约第 114 行）**

把 `applyBurn(primary, dps, g.attackParams.burnDur, now);`
改为：
```js
  applyBurn(primary, dps, g.attackParams.burnDur, now, g.id);
```

- [ ] **Step 5: 改 DoT 致死（`src/systems/statusSystem.js`，第 38 行）**

把 `if (e.hp <= 0) killEnemy(state, e);`
改为：
```js
    if (e.hp <= 0) {
      const stk = e.statuses.burn;
      let src = null;
      if (stk && stk.length) src = stk[stk.length - 1].src ?? (stk.find((b) => b.src)?.src ?? null);
      killEnemy(state, e, src);                       // DoT 致死归"最后点火将"；纯环境灼烧 → null
    }
```
> 文件顶部已 `import { killEnemy }`；无需新增 import。

- [ ] **Step 6: 跑测试 + 回归**

Run:
```bash
node tests/burnAttribution.test.mjs
node tests/statusSystem.test.mjs
node tests/statusEffects.test.mjs
node tests/attacks.test.mjs
```
Expected: 全 PASS

- [ ] **Step 7: 提交**

```bash
git add tests/burnAttribution.test.mjs src/systems/combat/statusEffects.js src/systems/combat/attacks.js src/systems/statusSystem.js
git commit -m "feat(tower-defender): 灼烧记来源将+DoT致死归最后点火者"
```

---

## Task 5: gameState 单局击杀计数

**Files:**
- Modify: `src/core/gameState.js`（`newGameState` 返回对象加 `runKills: {}`）
- Test: `tests/gameState.test.mjs`（追加一块断言）

- [ ] **Step 1: 追加失败断言（`tests/gameState.test.mjs` 末尾，`console.log` 之前）**

```js
// 新建关：runKills 为空对象（单局分将击杀计数，每关复位）
{
  const st = newGameState(LEVELS[0], { unlocked: new Set(['liao']) });
  assert.deepEqual(st.runKills, {}, 'newGameState.runKills = {}');
}
```
> 若该测试文件未 import `LEVELS`/`newGameState`，参照文件顶部既有 import 补齐（多数已 import）。

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/gameState.test.mjs`
Expected: FAIL（`runKills` 为 `undefined`）

- [ ] **Step 3: 改 `src/core/gameState.js`**

在 `newGameState` 返回的 state 字面量里加一行（与 `gold`/`castleHp` 等同级）：
```js
    runKills: {},                 // [成就] 单局分将击杀计数(每关复位;万人敌判定 + 击杀归因)
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/gameState.test.mjs`
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add tests/gameState.test.mjs src/core/gameState.js
git commit -m "feat(tower-defender): gameState加runKills单局击杀计数"
```

---

## Task 6: 成就中心 UI（codexScreen layout/hit）

**Files:**
- Create: `src/ui/codexScreen.js`
- Test: `tests/codexScreen.test.mjs`

> 先 `Read src/ui/levelSelect.js` 与 `src/ui/theme.js`，对齐 `panel/button/title/FONT/PAL/roundRect` 用法。本任务**只测纯几何 layout/hit**；draw 走 canvas 不单测（冒烟覆盖，见 Task 8）。

- [ ] **Step 1: 写失败测试**

```js
// tests/codexScreen.test.mjs — 成就中心 layout/hit 纯几何（无 canvas）
import assert from 'node:assert';
import { codexLayout, hitCodex } from '../src/ui/codexScreen.js';

const view = { w: 1024, h: 720, dpr: 1 };

// 图鉴标签：44 张卡 across 三分区
{
  const L = codexLayout(view, 'codex');
  assert.equal(L.cards.length, 44, '44 张卡');
  assert.equal(L.cards.filter((c) => c.side === 'shu').length, 12, '我方 12');
  assert.equal(L.cards.filter((c) => c.side === 'boss').length, 20, '名将 20');
  assert.equal(L.cards.filter((c) => c.side === 'lieut').length, 12, '副将 12');
  assert.ok(L.tabs.codex && L.tabs.ach && L.back, '有标签与返回');
}

// 成就标签：无卡，15 行成就
{
  const L = codexLayout(view, 'ach');
  assert.equal(L.cards.length, 0, '成就页无卡格');
  assert.equal(L.rows.length, 15, '15 条成就行');
}

// hit：点第一张卡 → {kind:'card', id}
{
  const L = codexLayout(view, 'codex');
  const c0 = L.cards[0];
  const r = hitCodex(view, 'codex', c0.x + 2, c0.y + 2, null);
  assert.deepEqual(r, { kind: 'card', id: c0.id }, '点卡返回 card+id');
}

// hit：点成就标签 → 切 tab
{
  const L = codexLayout(view, 'codex');
  const t = L.tabs.ach;
  assert.deepEqual(hitCodex(view, 'codex', t.x + 2, t.y + 2, null), { kind: 'tab', tab: 'ach' }, '点成就标签');
}

// hit：详情打开时点空白 → 关详情
{
  assert.deepEqual(hitCodex(view, 'codex', 1, 1, 'guan'), { kind: 'closeDetail' }, '详情态点空白关闭');
}

// hit：返回
{
  const L = codexLayout(view, 'codex');
  const b = L.back;
  assert.deepEqual(hitCodex(view, 'codex', b.x + 2, b.y + 2, null), { kind: 'back' }, '点返回');
}

console.log('codexScreen.test.mjs OK');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/codexScreen.test.mjs`
Expected: FAIL（`Cannot find module ../src/ui/codexScreen.js`）

- [ ] **Step 3: 写实现**

```js
// src/ui/codexScreen.js — 成就中心(屏幕坐标 layout/hit/draw 单一来源)。copy-pattern 自 ui/levelSelect.js。
// 两标签:武将图鉴(三分区 44 卡) / 挑战成就(15 行)。点卡 → 大卡详情浮层。
import { GENERALS } from '../data/generals.js';
import { BOSSES, LIEUTENANTS } from '../data/bosses.js';
import { unlockedGenerals } from '../data/unlocks.js';
import { TIERS, tierIndex } from '../core/achievements.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { HERO_LORE } from './heroCard.js';                 // 见 Step 3a：heroCard 需导出 HERO_LORE
import { generalSprite, assets } from '../core/assets.js';
import { backdrop, panel, button, title, roundRect, FONT, PAL } from './theme.js';

const SECTIONS = [
  { side: 'shu',   label: '我方武将', ids: () => Object.keys(GENERALS) },
  { side: 'boss',  label: '敌方 · 名将', ids: () => Object.keys(BOSSES) },
  { side: 'lieut', label: '敌方 · 副将', ids: () => Object.keys(LIEUTENANTS) },
];
const COLS = 10, CW = 74, CH = 96, GAP = 10, TOP = 132;

export function codexLayout(view, tab) {
  const tabW = 150, tabH = 40, ty = 64;
  const tabs = {
    codex: { x: view.w / 2 - tabW - 6, y: ty, w: tabW, h: tabH },
    ach:   { x: view.w / 2 + 6,        y: ty, w: tabW, h: tabH },
  };
  const back = { x: 20, y: 18, w: 96, h: 38 };
  const cards = [], sections = [];
  const rows = [];
  if (tab === 'codex') {
    let y = TOP;
    for (const sec of SECTIONS) {
      const ids = sec.ids();
      const gridW = COLS * CW + (COLS - 1) * GAP;
      const x0 = (view.w - gridW) / 2;
      sections.push({ label: sec.label, side: sec.side, y: y - 24 });
      ids.forEach((id, k) => {
        const r = Math.floor(k / COLS), c = k % COLS;
        cards.push({ id, side: sec.side, x: x0 + c * (CW + GAP), y: y + r * (CH + GAP), w: CW, h: CH });
      });
      const rowsN = Math.ceil(ids.length / COLS);
      y += rowsN * (CH + GAP) + 34;
    }
  } else {
    const lw = Math.min(560, view.w - 80), x0 = (view.w - lw) / 2;
    let y = TOP;
    for (const a of ACHIEVEMENTS) { rows.push({ id: a.id, x: x0, y, w: lw, h: 44 }); y += 50; }
  }
  return { tabs, back, cards, sections, rows };
}

export function hitCodex(view, tab, sx, sy, detailId) {
  if (detailId) return { kind: 'closeDetail' };                 // 详情态：任意点击关闭
  const L = codexLayout(view, tab);
  const inb = (b) => b && sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h;
  if (inb(L.back)) return { kind: 'back' };
  if (inb(L.tabs.codex)) return { kind: 'tab', tab: 'codex' };
  if (inb(L.tabs.ach)) return { kind: 'tab', tab: 'ach' };
  for (const c of L.cards) if (inb(c)) return { kind: 'card', id: c.id };
  return null;
}

// —— 渲染（render-only）——
function enemyName(id) { return (BOSSES[id] || LIEUTENANTS[id])?.name || id; }
function cardImg(id, side) { return side === 'shu' ? generalSprite(id, 3) : (assets.images['boss_' + id] || null); }

export function drawCodex(ctx, view, save, ach, tab, detailId) {
  ctx.setTransform(view.dpr || 1, 0, 0, view.dpr || 1, 0, 0);
  backdrop(ctx, view.w, view.h);
  title(ctx, '成就中心', view.w / 2, 38, 30);
  const L = codexLayout(view, tab);
  button(ctx, L.back, { label: '◀ 返回', variant: 'wood' });
  button(ctx, L.tabs.codex, { label: '武将图鉴', variant: tab === 'codex' ? 'jade' : 'wood', active: tab === 'codex' });
  button(ctx, L.tabs.ach,   { label: '挑战成就', variant: tab === 'ach' ? 'jade' : 'wood', active: tab === 'ach' });

  if (tab === 'codex') {
    const unlocked = unlockedGenerals(save);
    for (const s of L.sections) {
      ctx.fillStyle = PAL.gold; ctx.font = FONT.head(16); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(s.label, (view.w - (COLS * CW + (COLS - 1) * GAP)) / 2, s.y);
    }
    for (const c of L.cards) {
      const lit = c.side === 'shu' ? unlocked.has(c.id) : !!ach.seen[c.id];
      drawMiniCard(ctx, c, lit, c.side === 'shu' ? tierIndex(ach.kills[c.id] || 0) : -1);
    }
    if (detailId) drawDetail(ctx, view, save, ach, detailId);
  } else {
    for (const r of L.rows) drawAchRow(ctx, r, ach);
  }
}

function drawMiniCard(ctx, c, lit, tier) {
  if (!lit) {                                          // 未解锁：斜纹剪影
    roundRect(ctx, c.x, c.y, c.w, c.h, 8); ctx.fillStyle = '#241a12'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,50,.4)'; ctx.stroke();
    ctx.fillStyle = 'rgba(200,170,110,.5)'; ctx.font = FONT.head(28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', c.x + c.w / 2, c.y + c.h / 2);
    return;
  }
  // 解锁：流光段位底 + 立绘 + 名/段
  const t = tier >= 0 ? TIERS[tier] : null;
  roundRect(ctx, c.x, c.y, c.w, c.h, 8);
  ctx.fillStyle = t ? tierColor(tier) : '#5a3414'; ctx.fill();
  const img = cardImg(c.id, c.side);
  if (img) { ctx.save(); roundRect(ctx, c.x + 3, c.y + 3, c.w - 6, c.h - 26, 6); ctx.clip();
    const ih = (c.w - 6) * (img.height / img.width || 1.3); ctx.drawImage(img, c.x + 3, c.y + 3, c.w - 6, ih); ctx.restore(); }
  ctx.strokeStyle = t ? 'rgba(255,235,170,.8)' : 'rgba(200,160,90,.5)'; ctx.lineWidth = 1.5; roundRect(ctx, c.x, c.y, c.w, c.h, 8); ctx.stroke();
  ctx.fillStyle = PAL.cream; ctx.font = FONT.head(11); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const nm = c.side === 'shu' ? GENERALS[c.id].name : enemyName(c.id);
  ctx.fillText(nm, c.x + c.w / 2, c.y + c.h - 8);
  if (tier === 5) { ctx.fillText('👑', c.x + c.w - 12, c.y + 16); }
}

function tierColor(i) { return ['#7a4a1e', '#8a8f99', '#caa23a', '#3fb6cc', '#9a5bd0', '#c0392b'][i] || '#5a3414'; }

function drawAchRow(ctx, r, ach) {
  const a = ACHIEVEMENTS.find((x) => x.id === r.id);
  const got = !!ach.earned[r.id];
  panel(ctx, r.x, r.y, r.w, r.h, { variant: got ? 'wood' : 'ink', r: 8 });
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = got ? PAL.gold : PAL.dim; ctx.font = FONT.head(14);
  ctx.fillText((got ? '✅ ' : '🔒 ') + a.name, r.x + 12, r.y + r.h / 2 - 7);
  ctx.fillStyle = PAL.dim; ctx.font = FONT.body(11);
  ctx.fillText('[' + a.cat + '] ' + a.desc, r.x + 12, r.y + r.h / 2 + 11);
}

function drawDetail(ctx, view, save, ach, id) {
  const isShu = !!GENERALS[id];
  ctx.fillStyle = 'rgba(8,5,3,.72)'; ctx.fillRect(0, 0, view.w, view.h);
  const W = 360, H = 420, x = (view.w - W) / 2, y = (view.h - H) / 2;
  panel(ctx, x, y, W, H, { variant: 'parch', r: 14 });
  const img = cardImg(id, isShu ? 'shu' : (BOSSES[id] ? 'boss' : 'lieut'));
  if (img) { ctx.save(); roundRect(ctx, x + 20, y + 20, W - 40, 220, 10); ctx.clip();
    const iw = W - 40, ih = iw * (img.height / img.width || 1.3); ctx.drawImage(img, x + 20, y + 20, iw, ih); ctx.restore(); }
  ctx.fillStyle = PAL.ink; ctx.font = FONT.head(22); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const nm = isShu ? GENERALS[id].name : enemyName(id);
  ctx.fillText(nm, x + W / 2, y + 272);
  ctx.font = FONT.body(12); ctx.fillStyle = 'rgba(60,46,26,.92)';
  if (isShu) {
    const k = ach.kills[id] || 0, ti = tierIndex(k);
    ctx.fillText('段位:' + TIERS[ti].name + '  ·  累计击杀 ' + k, x + W / 2, y + 298);
    const lore = HERO_LORE[id];
    if (lore) wrapText(ctx, lore.bio, x + 24, y + 322, W - 48, 16);
  } else {
    ctx.fillText('敌方武将 · 已击败', x + W / 2, y + 298);
  }
  ctx.fillStyle = PAL.dim; ctx.font = FONT.body(11); ctx.fillText('（点击任意处关闭）', x + W / 2, y + H - 16);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  ctx.textAlign = 'left'; let line = '', yy = y;
  for (const ch of text) { if (ctx.measureText(line + ch).width > maxW && line) { ctx.fillText(line, x, yy); line = ch; yy += lh; } else line += ch; }
  if (line) ctx.fillText(line, x, yy);
}
```

- [ ] **Step 3a: 让 `heroCard.js` 导出 `HERO_LORE`**

`src/ui/heroCard.js` 把 `const HERO_LORE = {` 改为 `export const HERO_LORE = {`（其余不动；既有 `drawHeroCard` 内部引用不受影响）。

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/codexScreen.test.mjs`
Expected: PASS（`codexScreen.test.mjs OK`）

- [ ] **Step 5: 提交**

```bash
git add tests/codexScreen.test.mjs src/ui/codexScreen.js src/ui/heroCard.js
git commit -m "feat(tower-defender): 成就中心UI(图鉴三区44卡+成就列表+大卡详情)"
```

---

## Task 7: main.js 装配（入口钮 + 路由 + 击杀累加 + 落盘 + toast）

**Files:**
- Modify: `src/main.js`
- 验证：浏览器冒烟（无纯单测；逻辑已在 Task 1-6 覆盖）

> 本任务是装配胶水。逐处对齐既有代码风格（`drawMuteButton`/`MUTE_BTN` 范式、`screen` 分支、`bus.on('enemyKilled')`）。

- [ ] **Step 1: 顶部 import 追加**

```js
import { browserLoadAch, browserWriteAch, recordKill, recordDefeatedEnemy, tierIndex, TIERS } from './core/achievements.js';
import { evaluate, achName } from './data/achievements.js';
import { BOSSES, LIEUTENANTS } from './data/bosses.js';
import { codexLayout, hitCodex, drawCodex } from './ui/codexScreen.js';
```
> `GENERALS` 已 import（line 33）；`CAST` 不必（codexScreen 内部用）。

- [ ] **Step 2: 模块级状态（`let cheats = ...` 附近）**

```js
let ach = null;                 // [成就] 内存成就档(boot 加载);定点落盘
let achDirty = false;           // [成就] 有未落盘变更
let codexTab = 'codex';         // [成就] 'codex' | 'ach'
let codexDetail = null;         // [成就] 打开的大卡 id | null
let toasts = [];                // [成就] 屏幕中上方横幅 {msg, until}
```

- [ ] **Step 3: 工具函数（`function toSelect()` 附近）**

```js
// [成就] 横幅
function pushToast(msg) { toasts.push({ msg, until: performance.now() + 2800 }); if (toasts.length > 4) toasts.shift(); }
function drawToasts() {
  const now = performance.now(); toasts = toasts.filter((t) => t.until > now);
  let y = 70;
  for (const t of toasts) {
    const w = 320, x = view.w / 2 - w / 2;
    panel(ctx, x, y, w, 38, { variant: 'gold', r: 10 });
    ctx.fillStyle = PAL.ink; ctx.font = FONT.head(15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(t.msg, view.w / 2, y + 19); y += 46;
  }
}
// [成就] 跑判定:新解锁 → 横幅 + 标脏
function fireAch(run) {
  const got = evaluate(ach, save, run || {});
  for (const id of got) { ach.earned[id] = true; pushToast('🏆 解锁成就:' + achName(id)); }
  if (got.length) achDirty = true;
}
function flushAch() { if (achDirty) { browserWriteAch(ach); achDirty = false; } }
function maxRunKills() { let m = 0; for (const k in state.runKills) if (state.runKills[k] > m) m = state.runKills[k]; return m; }
// [成就] 首页左上角入口钮(与 cheatHotspot 同屏;返回几何供 draw/hit 共用)
function CODEX_BTN() { return { x: 20, y: 18, w: 104, h: 38 }; }
function drawCodexButton() { button(ctx, CODEX_BTN(), { label: '🏆 图鉴', variant: 'wood' }); }
```

- [ ] **Step 4: `enemyKilled` 监听替换（line 547）**

把原行替换为：
```js
  bus.on('enemyKilled', ({ enemy, killerId }) => {
    spawnFloat(state, enemy.px, enemy.py, '+' + enemy.gold); audio.sfx('kill');   // 原行为保留
    if (killerId && GENERALS[killerId] && ach) {
      const before = ach.kills[killerId] || 0;
      recordKill(ach, killerId); achDirty = true;
      state.runKills[killerId] = (state.runKills[killerId] || 0) + 1;
      const a = tierIndex(before), b = tierIndex(before + 1);
      if (b > a) pushToast('⚔️ ' + GENERALS[killerId].name + ' 晋升 ' + TIERS[b].name + '!');
      fireAch({ maxRunKills: maxRunKills() });
    }
    const eid = enemy.bossId;
    if (eid && (BOSSES[eid] || LIEUTENANTS[eid]) && ach) {
      const fresh = !ach.seen[eid];
      recordDefeatedEnemy(ach, eid); achDirty = true;
      if (fresh) pushToast('🏆 图鉴 +1:' + ((BOSSES[eid] || LIEUTENANTS[eid]).name));
      fireAch({});
    }
  });
```

- [ ] **Step 5: boot 加载（`save = browserLoad();` 之后）**

```js
  ach = browserLoadAch();
```

- [ ] **Step 6: 结算判定 + 落盘（render() 的 `if (!recorded) { ... }` 块内，写完进度档之后）**

在 `unlockNotice = ...` 那几行之后、`}` 关闭 `if(!recorded)` 之前加：
```js
      fireAch({ maxRunKills: maxRunKills(), castleHpFull: s.castleHp >= s.castleMaxHp });
      flushAch();
```

- [ ] **Step 7: 选关屏画入口钮（render() 的 `if (screen === 'select')` 分支，`drawMuteButton();` 后）**

```js
 drawCodexButton();
```
并在该分支 `return;` 前加 codex 屏渲染分支（紧跟 `if (screen === 'story')` 之后）：
```js
  if (screen === 'codex') { drawCodex(ctx, view, selSave(), ach, codexTab, codexDetail); drawToasts(); drawFsButton(); return; }
```
> `drawToasts()` 也加到对局渲染末尾（`render(s)` 函数结束前，`vignette` 之后任意处）让战斗中横幅可见：在 `drawHud(...)` 之后加一行 `drawToasts();`。

- [ ] **Step 8: 选关屏入口点击（onPointerDown 的 `if (screen === 'select')` 分支顶部，cheat 模态判断之前）**

```js
    if (cheatStage === 'closed' && inBtn(CODEX_BTN(), sx, sy)) { codexTab = 'codex'; codexDetail = null; screen = 'codex'; audio.sfx('ui'); return; }
```

- [ ] **Step 9: codex 屏点击处理（onPointerDown，`if (screen === 'story') {...}` 之后）**

```js
  if (screen === 'codex') {
    const r = hitCodex(view, codexTab, sx, sy, codexDetail);
    if (r && r.kind === 'tab') codexTab = r.tab;
    else if (r && r.kind === 'card') codexDetail = r.id;
    else if (r && r.kind === 'closeDetail') codexDetail = null;
    else if (r && r.kind === 'back') { flushAch(); toSelect(); }
    if (r) audio.sfx('ui');
    return;
  }
```

- [ ] **Step 10: 退出/切后台落盘**

在 `leaveToSelect()` 内首行加 `flushAch();`；在 boot 内 `persistResume` 函数体里加 `flushAch();`（与 `browserWriteResume` 并列，确保切后台/关页也落盘）。

- [ ] **Step 11: 跑全量测试**

Run: `for f in tests/*.test.mjs; do node "$f" || exit 1; done`
Expected: 全 PASS（新增 4 个测试文件 + 既有全绿）

- [ ] **Step 12: 提交**

```bash
git add src/main.js
git commit -m "feat(tower-defender): 装配成就系统(入口/路由/击杀累加/落盘/横幅)"
```

---

## Task 8: 浏览器冒烟验证

**Files:** 无（验证 + 修缺陷）

> 用 game-hub 既有冒烟方式（host 侧 puppeteer-core + 系统 Chrome；见 BOOM WORMS 冒烟备忘）或手动 iPad 实玩。

- [ ] **Step 1: 起本地静态服务并打开 tower-defender**（项目既有方式）。

- [ ] **Step 2: 验证清单**
  - 首页左上角「🏆 图鉴」钮可见、可点 → 进成就中心。
  - 两标签切换正常；图鉴三区显示我方12/名将20/副将12;未解锁=「?」剪影,已解锁我方按段位上色。
  - 点已解锁卡 → 大卡详情(立绘/名/段位/累计击杀/生平);点空白关闭。
  - 返回回到首页。
  - 进一关、用诸葛/黄月英灼烧击杀 → 该将 `runKills` 增长;`window.__td` 下可读 `getSave`(进度)。
  - 通关 L1 → 弹「🏆 解锁成就:初战告捷」横幅;刷新后图鉴/成就持久(localStorage `save_td_ach_v1`)。

- [ ] **Step 3: 调试钩子（可选，便于冒烟）**——在 `window.__td` 对象里加：
```js
    getAch() { return ach; },
    openCodex() { codexTab = 'codex'; codexDetail = null; screen = 'codex'; },
```

- [ ] **Step 4: 修任何冒烟暴露的问题**（按需小改 codexScreen/main），逐个提交。

- [ ] **Step 5: 提交（若有调试钩子/修复）**

```bash
git add -A
git commit -m "test(tower-defender): 成就系统冒烟验证+调试钩子"
```

---

## 自检结果（spec 覆盖）

- §2 范围(44 卡/排除兵种) → Task 6 SECTIONS（shu12/boss20/lieut12）。
- §3 决策 1-7 → 全覆盖（范围 T6、段位 T1、敌将 seen T1/T6、灼烧 T4、入口 T7、卡面流光 T6、零数值=无任何战斗数值改动）。
- §5 数据/存档(独立键/schema/归一化/落盘时机) → T1 + T7(flush)。
- §6 击杀归因(killEnemy/调用点/灼烧 src/main 监听) → T3 + T4 + T7。
- §7 段位表/tierIndex → T1。
- §8 点亮规则(我方派生/敌方 seen) → T6 drawMiniCard。
- §9 15 条成就逐条 → T2（evaluate）+ T7（fireAch 时机）。
- §10 UI(路由/codexScreen/详情/横幅) → T6 + T7。
- §11 美术复用(generalSprite/boss_/缺图回退) → T6 cardImg。
- §12 测试 → T1-T6 单测 + T8 冒烟。
- §13 YAGNI(无数值/无新美术/不每杀写盘/无重置成就) → 落实。
- §15 风险:**副将 bossId 透传**——实现 Task 7 前先核验：`grep -n "bossId\|LIEUTENANTS\|lieutenant" src/data/levels.js src/data/waveGen.js`，确认副将出场带 `enemy.bossId`；若没有，在副将 spawn 处补 `bossId`，并加一条断言到 `tests/levels-integrity.test.mjs`（本检查作为 Task 7 Step 0）。

---

## 执行顺序与依赖
T1 → T2(依赖 T1 的 totalKills) → T3 → T4(依赖 T3) → T5 → T6(依赖 T1/T2) → T7(依赖全部) → T8。可严格顺序执行。
