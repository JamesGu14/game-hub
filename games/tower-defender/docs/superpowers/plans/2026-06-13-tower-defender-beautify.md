# 塔防美化三件套 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 武将立绘扩到 5 阶、地图装饰元素精修、高台美化加「山」标 + 新增营(+攻击)/塔(+攻速)两种可建增益地形。

**Architecture:** 复用 plateau 加成模型（建塔时按 slot 落点写静态字段），新建 `effectiveStats(tower)` 把三种地形加成收口到一处（顺手消除现有散落的 `+rangeBonus`）；地图/地形渲染为 canvas 矢量画，直接精修；立绘走现有 Nano Banana 锚链生成管线（L4←L3、L5←L4）。

**Tech Stack:** 纯 ES modules（无框架）、`node:assert` 单测（每文件独立跑）、canvas 2D 渲染、OpenRouter/Gemini 图像生成（仅 Seg B）。

**配套 spec：** `docs/superpowers/specs/2026-06-13-tower-defender-beautify-design.md`（含 §5.2 L4/L5 逐将概念表、§4.6 门禁分工与局限）。

**分段：** Seg A（Task 1–9，纯代码，可独立 SHIP）｜ Seg B（Task 10–12，需 James 跑生成）。

---

## File Structure

| 文件 | 动作 | 职责 |
|---|---|---|
| `src/data/balance.js` | 改 | 加 `BARRACKS_DMG_MULT` / `ARCHTOWER_INTERVAL_MULT` |
| `src/entities/tower.js` | 改 | tower 加 `dmgMult` / `intervalMult` 字段 |
| `src/systems/terrainSystem.js` | 改 | `rangeBonusFor` → `terrainBonuses()`（返回三加成），保留 `rangeBonusFor` 薄封装 |
| `src/data/generals.js` | 改 | 新增 `effectiveStats(tower)` |
| `src/systems/targetingSystem.js` `combatSystem.js` `combat/attacks.js` `combat/damageCalc.js` `combat/signatureSkills.js` | 改 | 迁移 `towerStats(g,level)` → `effectiveStats(tower)`，删 `+rangeBonus` 求和 |
| `src/systems/economySystem.js` | 改 | `tryBuild` 写三字段 |
| `src/main.js` | 改 | `applyResume` 重算三字段；选中塔射程圈用 `effectiveStats` |
| `src/ui/towerPanel.js` | 改 | 面板数值用 `effectiveStats` + 营/塔 角标 |
| `src/render/board.js` | 改 | plateau 美化、barracks/archtower 填色、角标 helper |
| `src/data/baseBoards.js` | 改 | 10 基板铺 barracks/archtower rects |
| `src/render/ground.js` | 改 | 树/草/花/帐篷等 painter 精修 |
| `src/core/assets.js` | 改 | MANIFEST 加 24 行 `gen_*_4/_5`；`generalSprite` 封顶 3→5 |
| `tools/gen-sprites.mjs` | 改 | `STAGED` 各将补 L4/L5；循环 `s<=5` |
| `tests/terrainBonus.test.mjs` | 建 | terrainBonuses + effectiveStats 单测 |
| `tests/barracksArchtower.test.mjs` | 建 | 建塔写字段 + plateau 射程恰 +0.5（防双计）+ 死区断言 |
| `tests/assets.test.mjs` | 改 | generalSprite 封顶 5 + 回退链 |

**测试运行约定：** 每个 `.mjs` 独立跑 `node tests/<file>.test.mjs`（成功末行打印 `ok <name>`）；全套 `for f in tests/*.test.mjs; do node "$f" || break; done`。

---

## SEG A · Task 1：地形加成常量 + 字段 + `terrainBonuses()`

**Files:**
- Modify: `src/data/balance.js`（紧随 `PLATEAU_RANGE_BONUS` 行）
- Modify: `src/entities/tower.js:17`（`rangeBonus` 之后）
- Modify: `src/systems/terrainSystem.js:15-17`（`rangeBonusFor`）
- Test: `tests/terrainBonus.test.mjs`（建）

- [ ] **Step 1: 写失败测试**

`tests/terrainBonus.test.mjs`：
```js
// tests/terrainBonus.test.mjs — terrainBonuses 三类型取值 + effectiveStats 三加成
// 运行：node games/tower-defender/tests/terrainBonus.test.mjs
import assert from 'node:assert';
import { BAL } from '../src/data/balance.js';
import { terrainBonuses, rangeBonusFor } from '../src/systems/terrainSystem.js';

// 合成关：terrainAt[y][x] 查表（plateau/barracks/archtower/平地/越界）
const fake = { terrainAt: [['plateau', 'barracks'], ['archtower', null]] };

assert.deepEqual(terrainBonuses(fake, { x: 0, y: 0 }),
  { rangeBonus: BAL.PLATEAU_RANGE_BONUS, dmgMult: 1, intervalMult: 1 }, 'plateau 只加射程');
assert.deepEqual(terrainBonuses(fake, { x: 1, y: 0 }),
  { rangeBonus: 0, dmgMult: BAL.BARRACKS_DMG_MULT, intervalMult: 1 }, 'barracks 只加攻击');
assert.deepEqual(terrainBonuses(fake, { x: 0, y: 1 }),
  { rangeBonus: 0, dmgMult: 1, intervalMult: BAL.ARCHTOWER_INTERVAL_MULT }, 'archtower 只加攻速');
assert.deepEqual(terrainBonuses(fake, { x: 1, y: 1 }),
  { rangeBonus: 0, dmgMult: 1, intervalMult: 1 }, '平地无加成');
assert.deepEqual(terrainBonuses({}, { x: 0, y: 0 }),
  { rangeBonus: 0, dmgMult: 1, intervalMult: 1 }, '无 terrainAt 防御性默认');

// 常量量级自检（温和 +25%）
assert.equal(BAL.BARRACKS_DMG_MULT, 1.25, '营 +25%');
assert.equal(BAL.ARCHTOWER_INTERVAL_MULT, 0.8, '塔 间隔×0.8=攻速+25%');

// rangeBonusFor 薄封装仍可用（plateau.test 依赖）
assert.equal(rangeBonusFor(fake, { x: 0, y: 0 }), BAL.PLATEAU_RANGE_BONUS, 'rangeBonusFor 委托');
assert.equal(rangeBonusFor(fake, { x: 1, y: 1 }), 0, 'rangeBonusFor 平地 0');

console.log('ok terrainBonus');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/terrainBonus.test.mjs`
Expected: 抛错 `terrainBonuses is not a function`（或常量 undefined）。

- [ ] **Step 3: 加常量**

`src/data/balance.js`，在 `PLATEAU_RANGE_BONUS: 0.5,` 行后加：
```js
  BARRACKS_DMG_MULT: 1.25,      // [地形] 营·攻击加成（+25%）
  ARCHTOWER_INTERVAL_MULT: 0.8, // [地形] 塔·攻速加成（间隔×0.8=攻速×1.25）
```

- [ ] **Step 4: 加 tower 字段**

`src/entities/tower.js`，在 `rangeBonus: 0,` 行后加：
```js
    dmgMult: 1,       // [地形] 营·攻击加成乘子
    intervalMult: 1,  // [地形] 塔·攻速加成乘子（<1 更快）
```

- [ ] **Step 5: 升级 `terrainBonuses` + 保留 `rangeBonusFor`**

`src/systems/terrainSystem.js`，把现有 `rangeBonusFor`（约 15–17 行）替换为：
```js
// 将位地形加成（建塔/续玩按 slot 落点写实例；plateau→射程 / barracks→攻击 / archtower→攻速）
export function terrainBonuses(level, slot) {
  const t = terrainTypeAt(level, slot.x, slot.y);
  return {
    rangeBonus: t === 'plateau' ? BAL.PLATEAU_RANGE_BONUS : 0,
    dmgMult: t === 'barracks' ? BAL.BARRACKS_DMG_MULT : 1,
    intervalMult: t === 'archtower' ? BAL.ARCHTOWER_INTERVAL_MULT : 1,
  };
}
// 薄封装：空将位建造预览（main.js）仅需射程；plateau.test 依赖
export function rangeBonusFor(level, slot) {
  return terrainBonuses(level, slot).rangeBonus;
}
```

- [ ] **Step 6: 跑测试确认通过**

Run: `node tests/terrainBonus.test.mjs` → Expected: `ok terrainBonus`
Run: `node tests/plateau.test.mjs` → Expected: `ok plateau`（薄封装回归）

- [ ] **Step 7: 提交**

```bash
git add src/data/balance.js src/entities/tower.js src/systems/terrainSystem.js tests/terrainBonus.test.mjs
git commit -m "feat(tower-defender): 地形加成基建——营/塔常量+tower字段+terrainBonuses"
```

---

## SEG A · Task 2：`effectiveStats(tower)`

**Files:**
- Modify: `src/data/generals.js`（`towerStats` 之后）
- Test: `tests/terrainBonus.test.mjs`（追加）

- [ ] **Step 1: 追加失败测试**

在 `tests/terrainBonus.test.mjs` 的 `console.log` 之前插入：
```js
// —— effectiveStats：三加成 + 缺字段默认 ——
import { GENERALS, towerStats, effectiveStats } from '../src/data/generals.js';
const base = towerStats(GENERALS.huang, 1);   // dmg7 range4.5 interval0.7
const mk = (extra) => ({ generalId: 'huang', level: 1, ...extra });

assert.equal(effectiveStats(mk({})).dmg, base.dmg, '无字段=基础 dmg');
assert.equal(effectiveStats(mk({})).range, base.range, '无字段=基础 range');
assert.equal(effectiveStats(mk({})).interval, base.interval, '无字段=基础 interval');
assert.ok(Math.abs(effectiveStats(mk({ dmgMult: 1.25 })).dmg - base.dmg * 1.25) < 1e-9, '营 dmg×1.25');
// 关键回归：plateau 射程恰 +0.5，绝不是 +1.0（防双计）
assert.equal(effectiveStats(mk({ rangeBonus: 0.5 })).range, base.range + 0.5, 'plateau 恰 +0.5');
assert.ok(Math.abs(effectiveStats(mk({ intervalMult: 0.8 })).interval - base.interval * 0.8) < 1e-9, '塔 间隔×0.8');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/terrainBonus.test.mjs`
Expected: `effectiveStats is not a function`。

- [ ] **Step 3: 实现 `effectiveStats`**

`src/data/generals.js`，在 `towerStats` 函数之后加：
```js
// 等级数值 × 地形加成（建塔时写 tower.dmgMult/rangeBonus/intervalMult；缺则默认）。
// 收口：所有战斗/UI 取数走此函数，勿在调用点再 +rangeBonus（防双计）。
export function effectiveStats(tower) {
  const s = towerStats(GENERALS[tower.generalId], tower.level);
  return {
    dmg: s.dmg * (tower.dmgMult || 1),
    range: s.range + (tower.rangeBonus || 0),
    interval: s.interval * (tower.intervalMult || 1),
  };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/terrainBonus.test.mjs` → Expected: `ok terrainBonus`

- [ ] **Step 5: 提交**

```bash
git add src/data/generals.js tests/terrainBonus.test.mjs
git commit -m "feat(tower-defender): effectiveStats 收口三地形加成（含plateau防双计回归）"
```

---

## SEG A · Task 3：迁移战斗/瞄准调用点（删 `+rangeBonus` 求和）

**Files（7 处 `towerStats(` 调用，删 5 处 `+rangeBonus` 求和）:**
- Modify: `src/systems/targetingSystem.js:4,11`
- Modify: `src/systems/combatSystem.js:3,24,26`
- Modify: `src/systems/combat/attacks.js:4,34,35`（`:110 dps` 自动继承营加成）
- Modify: `src/systems/combat/damageCalc.js:5,8`
- Modify: `src/systems/combat/signatureSkills.js:5,26`
- Test: `tests/barracksArchtower.test.mjs`（建，集成验证）

- [ ] **Step 1: 写测试（本任务只放 plateau/平地回归；营/塔留 Task 4）**

`tests/barracksArchtower.test.mjs`（**手搭 state，不用 newGameState** —— 合成关无 waves，避开其初始化依赖）：
```js
// tests/barracksArchtower.test.mjs — 营/塔/高台建塔生效 + plateau 防双计 + 死区
// 运行：node games/tower-defender/tests/barracksArchtower.test.mjs
import assert from 'node:assert';
import { tryBuild } from '../src/systems/economySystem.js';
import { effectiveStats, GENERALS, towerStats } from '../src/data/generals.js';
import { BAL } from '../src/data/balance.js';

// 合成关：一格 barracks/archtower/plateau，各配同坐标将位 + 一格平地将位
function synthLevel() {
  const cols = 12, rows = 8;
  const terrainAt = Array.from({ length: rows }, () => Array(cols).fill(null));
  terrainAt[2][3] = 'barracks'; terrainAt[2][5] = 'archtower'; terrainAt[2][7] = 'plateau';
  return { id: 9001, cols, rows, terrainAt };   // tryBuild 仅需 level.terrainAt（经 terrainBonuses 查表）
}
const lv = synthLevel();
const build = (x, y) => {                         // 手搭最小 state，避开 newGameState 的 waves 依赖
  const s = { gold: 999999, level: lv, towers: [], unlocked: null };
  assert.ok(tryBuild(s, { x, y }, 'huang'), `建塔 ${x},${y}`);
  return s.towers[0];
};
const b1 = towerStats(GENERALS.huang, 1);

// 本任务断言：plateau 射程恰 +0.5（绝非 +1.0，防迁移双计）+ 平地基础
assert.equal(effectiveStats(build(7, 2)).range, b1.range + BAL.PLATEAU_RANGE_BONUS, '高台 射程恰+0.5（防双计）');
const flat = build(1, 5);
assert.equal(effectiveStats(flat).dmg, b1.dmg, '平地 基础 dmg');
assert.equal(effectiveStats(flat).range, b1.range, '平地 基础射程');

console.log('ok barracksArchtower');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/barracksArchtower.test.mjs`
Expected: 迁移未做时仍可能过（plateau 链路本就 +0.5）——**本测试的真正价值是 Step 6 迁移后仍恒 +0.5**。若此刻已 `ok`，迁移后再跑一次确认未变 +1.0。

- [ ] **Step 3: 迁移 targetingSystem**

`src/systems/targetingSystem.js`：import 行加 `effectiveStats`，第 11 行
```js
    const rangePx = (towerStats(g, tower.level).range + (tower.rangeBonus || 0)) * BAL.CELL;
```
→
```js
    const rangePx = effectiveStats(tower).range * BAL.CELL;
```
（若 `g` 此后未再用，删其声明与 `towerStats` import；否则保留。）

- [ ] **Step 4: 迁移 combatSystem**

`src/systems/combatSystem.js`：import 加 `effectiveStats`，第 24 行 `const stats = towerStats(g, tower.level);` → `const stats = effectiveStats(tower);`；第 26 行 `(stats.range + (tower.rangeBonus || 0))` → `stats.range`。`stats.interval` 作为开火节奏 → 塔加速自动生效。

- [ ] **Step 5: 迁移 attacks / damageCalc / signatureSkills**

- `combat/attacks.js`：import 加 `effectiveStats`，第 34 行 `const stats = towerStats(g, tower.level);` → `const stats = effectiveStats(tower);`；第 35 行 `((stats.range + (tower.rangeBonus || 0)) * CELL)` → `(stats.range * CELL)`。第 110 行 `let dps = stats.dmg;` 不改（自动含营加成 → 灼烧 DoT 继承）。
- `combat/damageCalc.js`：import 加 `effectiveStats`，第 8 行 `const base = towerStats(g, tower.level).dmg;` → `const base = effectiveStats(tower).dmg;`。
- `combat/signatureSkills.js`：import 加 `effectiveStats`，第 26 行 `towerStats(g, tower.level).dmg` → `effectiveStats(tower).dmg`。

- [ ] **Step 6: grep 防双计 + 跑测试**

Run: `grep -rn "\.rangeBonus" src/`
Expected: 仅剩 ①`economySystem.js`（写，Task 4 后）②`main.js:140`（写）③`main.js:224` 区域用 `rangeBonusFor`（预览）④`towerPanel.js` 的 `⛰` presence 判断 ⑤`generals.js` `effectiveStats` 内 `|| 0`。**不得再有 `effectiveStats(...).range + ...rangeBonus` 形态的求和。**
Run: `node tests/targeting.test.mjs && node tests/combat.test.mjs && node tests/damageCalc.test.mjs && node tests/signatureSkills.test.mjs && node tests/plateau.test.mjs`
Expected: 全部 `ok`（迁移不改基础行为）。

- [ ] **Step 7: 提交（不含营/塔断言解注，留 Task 4）**

```bash
git add src/systems/targetingSystem.js src/systems/combatSystem.js src/systems/combat/ tests/barracksArchtower.test.mjs
git commit -m "feat(tower-defender): 战斗/瞄准迁移到 effectiveStats，删散落+rangeBonus求和"
```

---

## SEG A · Task 4：建塔 + 续玩写三字段

**Files:**
- Modify: `src/systems/economySystem.js:6,26`
- Modify: `src/main.js:12,140`
- Test: `tests/barracksArchtower.test.mjs`（解注营/塔断言）

- [ ] **Step 1: 改 tryBuild 写三字段**

`src/systems/economySystem.js`：import 改 `import { rangeBonusFor } ...` → `import { terrainBonuses } from './terrainSystem.js';`；第 26 行
```js
  t.rangeBonus = rangeBonusFor(state.level, slot);   // [地形] 高台加成落实例（静态字段）
```
→
```js
  const tb = terrainBonuses(state.level, slot);       // [地形] 高台/营/塔 加成落实例
  t.rangeBonus = tb.rangeBonus; t.dmgMult = tb.dmgMult; t.intervalMult = tb.intervalMult;
```

- [ ] **Step 2: 改 applyResume 重算三字段**

`src/main.js`：import 行 `import { rangeBonusFor } ...` 改为 `import { rangeBonusFor, terrainBonuses } from './systems/terrainSystem.js';`（`rangeBonusFor` 仍被第 224 行预览用，保留）。第 140 行
```js
    t.rangeBonus = rangeBonusFor(state.level, ts.slot);   // [地形] 按 slot 重算（快照零迁移）
```
→
```js
    const tb = terrainBonuses(state.level, ts.slot);      // [地形] 按 slot 重算三字段（快照零迁移）
    t.rangeBonus = tb.rangeBonus; t.dmgMult = tb.dmgMult; t.intervalMult = tb.intervalMult;
```

- [ ] **Step 3: 追加营/塔断言（现 tryBuild 已写字段）**

`tests/barracksArchtower.test.mjs`，在 `console.log` 前插入：
```js
// Task 4 后：tryBuild 写 dmgMult/intervalMult → 营加伤、塔加速
const camp = build(3, 2), tower = build(5, 2);
assert.ok(Math.abs(effectiveStats(camp).dmg - b1.dmg * BAL.BARRACKS_DMG_MULT) < 1e-9, '营 dmg+25%');
assert.equal(effectiveStats(camp).range, b1.range, '营 不改射程');
assert.ok(Math.abs(effectiveStats(tower).interval - b1.interval * BAL.ARCHTOWER_INTERVAL_MULT) < 1e-9, '塔 攻速+25%');
assert.equal(effectiveStats(tower).dmg, b1.dmg, '塔 不改攻击');
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/barracksArchtower.test.mjs` → Expected: `ok barracksArchtower`
Run: `node tests/resume.test.mjs && node tests/economy.test.mjs` → Expected: 全 `ok`

- [ ] **Step 5: 提交**

```bash
git add src/systems/economySystem.js src/main.js tests/barracksArchtower.test.mjs
git commit -m "feat(tower-defender): 建塔/续玩写 dmgMult/intervalMult（营/塔加成生效，零存档迁移）"
```

---

## SEG A · Task 5：面板数值 + 选中塔射程圈

**Files:**
- Modify: `src/ui/towerPanel.js:4,64-66`
- Modify: `src/main.js:30,232`
- Test: 视觉冒烟（Task 9 统一），本任务仅保证现有 `towerPanel.test.mjs` 不红。

- [ ] **Step 1: towerPanel 用 effectiveStats + 营/塔角标**

`src/ui/towerPanel.js`：import 加 `effectiveStats`。第 64–66 行
```js
  const st = towerStats(g, tower.level);
  const rngEff = st.range + (tower.rangeBonus || 0);
  ...fillText(`攻击 ${Math.round(st.dmg)}　射程 ${rngEff.toFixed(1)}${tower.rangeBonus ? '⛰' : ''}　攻速 ${(1 / st.interval).toFixed(1)}`, ...);
```
→
```js
  const st = effectiveStats(tower);
  const dmgMark = tower.dmgMult > 1 ? '营' : '';
  const rngMark = tower.rangeBonus ? '⛰' : '';
  const spdMark = tower.intervalMult < 1 ? '塔' : '';
  ...fillText(`攻击 ${Math.round(st.dmg)}${dmgMark}　射程 ${st.range.toFixed(1)}${rngMark}　攻速 ${(1 / st.interval).toFixed(1)}${spdMark}`, ...);
```
（`st.range` 已含 rangeBonus，删原 `rngEff` 求和。）

- [ ] **Step 2: main 选中塔射程圈**

`src/main.js`：第 30 行 import 加 `effectiveStats`（与 `towerStats` 同源）。第 232 行
```js
    const srng = towerStats(sg, selectedTower.level).range + (selectedTower.rangeBonus || 0);
```
→
```js
    const srng = effectiveStats(selectedTower).range;
```

- [ ] **Step 3: 跑测试**

Run: `node tests/towerPanel.test.mjs` → Expected: `ok`（如断言锚定旧文案需同步更新断言）。
Run: `grep -rn "\.rangeBonus" src/ui/ src/main.js` → Expected: 仅写入/presence/预览，无求和。

- [ ] **Step 4: 提交**

```bash
git add src/ui/towerPanel.js src/main.js
git commit -m "feat(tower-defender): 面板/射程圈用 effectiveStats，营/塔/⛰ 角标提示"
```

---

## SEG A · Task 6：地形渲染（高台美化 + 营/塔 + 角标）

**Files:**
- Modify: `src/render/board.js:116-118`（`TERRAIN_FILL`）、`141-148`（plateau）、`drawTerrainBase` 末尾加角标
- Test: 视觉冒烟（Task 9 统一）；结构上不引入单测。

- [ ] **Step 1: 扩 TERRAIN_FILL**

`src/render/board.js` `TERRAIN_FILL` 加两色：
```js
  barracks: '#b07a3c', archtower: '#7c8a9c',
```

- [ ] **Step 2: plateau 立体台阶强化**

把第 141–148 的 plateau 分支描边升级为双层 bevel（顶 2px 亮 + 顶内 1px 更亮高光、底 2px 暗 + 底内 1px 阴影），凸显"抬升"：
```js
    } else if (z.type === 'plateau') {
      for (const c of z.cells) {
        const x = c.x * C, y = c.y * C;
        ctx.strokeStyle = 'rgba(255,238,190,.65)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 1, y + 1); ctx.lineTo(x + C - 1, y + 1); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,250,225,.4)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 2, y + 3); ctx.lineTo(x + C - 2, y + 3); ctx.stroke();
        ctx.strokeStyle = 'rgba(60,42,16,.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + 1, y + C - 1); ctx.lineTo(x + C - 1, y + C - 1); ctx.stroke();
      }
    } else if (z.type === 'barracks' || z.type === 'archtower') {
      // 增益地形：暖/冷底已由 TERRAIN_FILL 铺；此处加轻纹理（营=帐影斜纹 / 塔=砖横线）
      for (const c of z.cells) {
        const x = c.x * C, y = c.y * C;
        ctx.strokeStyle = z.type === 'barracks' ? 'rgba(90,55,20,.45)' : 'rgba(40,55,70,.45)';
        ctx.lineWidth = 1.5;
        if (z.type === 'barracks') { ctx.beginPath(); ctx.moveTo(x + 6, y + C - 5); ctx.lineTo(x + C / 2, y + 6); ctx.lineTo(x + C - 6, y + C - 5); ctx.stroke(); }
        else { for (let yy = y + 8; yy < y + C - 4; yy += 8) { ctx.beginPath(); ctx.moveTo(x + 5, yy); ctx.lineTo(x + C - 5, yy); ctx.stroke(); } }
      }
    }
```

- [ ] **Step 3: 角标 helper + 调用**

`drawTerrainBase` 内、`for (const z of zones)` 循环里（在各分支之后，仍在 `z` 作用域），按类型画一次角标。先在 `board.js` 顶部加 helper：
```js
// 地形角标：zone 包围盒指定角画小字 + 深色圆底（左下 'bl' / 右下 'br'）
function terrainGlyph(ctx, cells, corner, char, tint) {
  let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const c of cells) { minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x); maxY = Math.max(maxY, c.y); }
  const px = (corner === 'bl' ? minX : maxX) * C + (corner === 'bl' ? 4 : C - 4);
  const py = maxY * C + C - 4;
  ctx.save();
  ctx.fillStyle = 'rgba(20,16,10,.55)';
  ctx.beginPath(); ctx.arc(px + (corner === 'bl' ? 5 : -5), py - 6, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tint; ctx.font = `bold ${Math.round(C * 0.34)}px system-ui`;
  ctx.textAlign = corner === 'bl' ? 'left' : 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(char, px, py);
  ctx.restore();
}
```
在循环内每个 `z` 处理后追加：
```js
    if (z.type === 'plateau') terrainGlyph(ctx, z.cells, 'bl', '山', '#ffeec0');
    else if (z.type === 'barracks') terrainGlyph(ctx, z.cells, 'br', '营', '#ffd9a8');
    else if (z.type === 'archtower') terrainGlyph(ctx, z.cells, 'br', '塔', '#cfe0ff');
```

- [ ] **Step 4: 提交（渲染，冒烟留 Task 9）**

```bash
git add src/render/board.js
git commit -m "feat(tower-defender): 高台立体化+山字标，营/塔地形填色与营/塔角标"
```

---

## SEG A · Task 7：铺设 barracks/archtower（10 基板）+ 死区断言

**Files:**
- Modify: `src/data/baseBoards.js`（10 基板各加 2 rects）
- Test: `tests/barracksArchtower.test.mjs`（追加 LEVELS 死区断言）

- [ ] **Step 1: 写死区断言（先红）**

在 `tests/barracksArchtower.test.mjs` 末尾 `console.log` 前追加：
```js
// —— 全 50 关：每个 barracks/archtower 区必有 ≥1 存活将位（防"有地形无将位"死区）——
import { LEVELS } from '../src/data/levels.js';
let campN = 0, towerN = 0;
for (const L of LEVELS) {
  for (const z of L.terrain) {
    if (z.type !== 'barracks' && z.type !== 'archtower') continue;
    const built = z.cells.some((c) => L.slots.some((s) => s.x === c.x && s.y === c.y));
    assert.ok(built, `关${L.id} 的 ${z.type} 区无可建将位（死区）`);
    if (z.type === 'barracks') campN++; else towerN++;
  }
}
assert.ok(campN >= 10 && towerN >= 10, `营${campN}/塔${towerN} 至少各覆盖 10（10 基板）`);
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/barracksArchtower.test.mjs`
Expected: `营0/塔0 至少各覆盖 10` 失败（尚未铺设）。

- [ ] **Step 3: 铺设（每基板 1 营 + 1 塔，压在某 slot variant 的将位格上）**

`src/data/baseBoards.js`：每块基板的 `terrain: [...]` 数组里，参照现有 `plateau` 选点注释，加两条 1×1 rect，坐标须命中**该基板 `slotsVariants` 三套中都出现**的将位格（与 plateau 同位思路：选交战口）。**示例（基板 0，按其实际 slotsVariants 校准坐标）：**
```js
      { type: 'plateau', rects: [{ x: 8, y: 6, w: 2, h: 2 }] },
      { type: 'plateau', rects: [{ x: 16, y: 2, w: 2, h: 2 }] },
      { type: 'barracks', rects: [{ x: 10, y: 8, w: 1, h: 1 }] },   // 营：城西交战口将位（按 slotsVariants 校准）
      { type: 'archtower', rects: [{ x: 14, y: 5, w: 1, h: 1 }] },  // 塔：中路将位（按 slotsVariants 校准）
```
> 选点法：打开该基板 `slotsVariants`，挑一个在三套里都存在、且靠近路的将位坐标作为 rect。逐基板重复，直到 Step 4 全绿。

- [ ] **Step 4: 跑测试迭代到全绿**

Run: `node tests/barracksArchtower.test.mjs` → Expected: `ok barracksArchtower`
Run: `node tests/baseBoards.test.mjs && node tests/boardVariants.test.mjs && node tests/levels-integrity.test.mjs && node tests/levels-coverage.test.mjs` → Expected: 全 `ok`（如断言锚定 terrain 类型集合，同步放行 barracks/archtower）。

- [ ] **Step 5: 提交**

```bash
git add src/data/baseBoards.js tests/barracksArchtower.test.mjs
git commit -m "feat(tower-defender): 10 基板铺营/塔地形（死区断言保证每区可建）"
```

---

## SEG A · Task 8：平衡门禁 + 全量回归

**Files:** 无（只跑工具/测试）。tools 保留原始 `towerStats`（测无增益基线，见 spec §4.6）。

- [ ] **Step 1: 全量单测**

Run: `for f in tests/*.test.mjs; do node "$f" || { echo "FAIL $f"; break; }; done`
Expected: 每个 `ok ...`，无 FAIL。

- [ ] **Step 2: 经济模拟门禁**

Run: `node tools/sim-economy.mjs`
Expected: winnable 50/50（基础难度无回归；玩家增益只会更易过关）。若某关掉出 winnable → 排查是否 Task 3 迁移污染了基础公式（应 0 改动）。

- [ ] **Step 3: balance-report 基线核对**

Run: `node tools/balance-report.mjs`
Expected: 关键数值与改前一致（tools 用原始 towerStats，不含地形增益）→ 反证 effectiveStats 迁移未污染基础。

- [ ] **Step 4: 提交（如有 sim 报告产物）**

```bash
git add -A && git commit -m "test(tower-defender): Seg A 门禁——全测绿 + sim winnable 50/50 无回归" --allow-empty
```

---

## SEG A · Task 9：地图元素美化 + 视觉冒烟

**Files:**
- Modify: `src/render/ground.js`（`treeAt`/`pineAt`/`flowerAt`/`tuft`/`tent` 等 painter）
- Test: 浏览器冒烟（无单测；保 `groundLayout.test.mjs` 等布点测试不红）

**手法铁律**：明暗只用 alpha 叠加（不新增 `theme.colors` 键）；保 `blurOk` 退化路径；不碰布点纯函数。

- [ ] **Step 1: 树冠分层（代表，其余同法）**

`ground.js` `treeAt` 升级为 2 簇冠 + 冠底 AO：
```js
function treeAt(ctx, x, y, r, crownFill, col) {
  shadowAt(ctx, x, y + r * 1.5, r * 1.3);
  ctx.fillStyle = col.trunk; ctx.strokeStyle = col.trunkOutline; ctx.lineWidth = 1;
  ctx.fillRect(x - 2, y + r * 0.5, 4, r * 0.9); ctx.strokeRect(x - 2, y + r * 0.5, 4, r * 0.9);
  crownAt(ctx, x, y, r, crownFill, col.crownOutline);
  ellipseFill(ctx, x, y + r * 0.35, r * 0.85, r * 0.5, 'rgba(0,0,0,.14)', 1);   // 冠底 AO
  crownAt(ctx, x - r * 0.42, y - r * 0.18, r * 0.6, crownFill, col.crownOutline); // 第二簇
  ellipseFill(ctx, x - r * 0.3, y - r * 0.45, r * 0.4, r * 0.3, col.crownHi, 0.9); // 高光
}
```

- [ ] **Step 2: 花 5 瓣 + 花心；草丛多叶高光；松三层；帐篷脊缝撑杆**

按同法精修 `flowerAt`（4 点→5 瓣 `for (let i=0;i<5;i++)` 绕圈 + 中心点）、`tuft`（加尖端浅色高光笔）、`pineAt`（叠 3 层三角，自下而上变浅）、`tent` landmark（加脊线 `moveTo(cx,footY-24) lineTo(cx,footY)` 描深、撑杆顶旗影、坡面 alpha 受光）。每个 painter 改完即在浏览器看一眼对应章。

- [ ] **Step 3: 布点测试不红**

Run: `node tests/groundLayout.test.mjs && node tests/chapterThemes.test.mjs` → Expected: `ok`（painter 改动不触布点/取色契约）。

- [ ] **Step 4: 浏览器冒烟（5 章各扫一眼 + 地形角标）**

启动本地静态服务（如 `python3 -m http.server` 于 game-hub 根，访问 `/games/tower-defender/`），逐章进 1 关，肉眼确认：树/草/花/帐篷更立体；高台「山」、营「营」、塔「塔」角标清晰；iPad 视口（窄屏）角标不糊。截图留档。

- [ ] **Step 5: 提交**

```bash
git add src/render/ground.js
git commit -m "feat(tower-defender): 地图元素精修——树冠分层/花5瓣/草高光/帐篷脊杆（alpha叠加，零新色键）"
```

**→ Seg A 完成，可独立 SHIP。**

---

## SEG B · Task 10：立绘接线（MANIFEST + generalSprite 封顶，缺图安全回退）

**Files:**
- Modify: `src/core/assets.js:18-30`（MANIFEST）、`147-153`（`generalSprite`）
- Test: `tests/assets.test.mjs`（追加封顶 + 回退）

- [ ] **Step 1: 写失败测试**

`tests/assets.test.mjs` 追加（按该文件现有 import/风格）：
```js
// —— generalSprite 封顶 5 + 逐级回退（注入假图，不依赖真加载）——
import { assets, generalSprite } from '../src/core/assets.js';
assets.images = {};
assets.images['gen_huang_3'] = { _tag: 'L3' };
assert.equal(generalSprite('huang', 5)._tag, 'L3', 'L5/L4 缺 → 回退 L3');
assets.images['gen_huang_5'] = { _tag: 'L5' };
assert.equal(generalSprite('huang', 5)._tag, 'L5', 'L5 在 → 取 L5');
assets.images['gen_huang_4'] = { _tag: 'L4' };
assert.equal(generalSprite('huang', 4)._tag, 'L4', 'L4 在 → 取 L4');
assert.equal(generalSprite('huang', 2)._tag, 'L3', 'L2 缺 → 回退最近低阶(L3)');   // 现回退语义不变
assets.images = {};
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/assets.test.mjs`
Expected: `generalSprite('huang',5)` 现封顶 3 → 取不到 L5（断言 `_tag L5` 失败）。

- [ ] **Step 3: MANIFEST 加 24 行**

`src/core/assets.js` MANIFEST 内，每将（huang/zhang/guan/zhao/ma/zhuge/liao/zhou/madai/guanping/zhangbao/yueying）补两行，形如：
```js
  gen_huang_4: 'assets/sprites/generals/huang_4.png', gen_huang_5: 'assets/sprites/generals/huang_5.png',
```

- [ ] **Step 4: generalSprite 封顶 3→5**

第 148 行 `for (let s = Math.min(level, 3); s >= 1; s--) {` → `for (let s = Math.min(level, 5); s >= 1; s--) {`

- [ ] **Step 5: 跑测试确认通过**

Run: `node tests/assets.test.mjs` → Expected: `ok`（含新断言）。

- [ ] **Step 6: 提交（缺图安全：L4/L5 PNG 未生成前，回退 L3，可先落）**

```bash
git add src/core/assets.js tests/assets.test.mjs
git commit -m "feat(tower-defender): 立绘封顶L1→L5 + 24图 manifest（缺图自动回退L3）"
```

---

## SEG B · Task 11：gen-sprites.mjs 补 L4/L5 prompt + 循环

**Files:**
- Modify: `tools/gen-sprites.mjs`（`STAGED` 各将 stages 3→5；`--stages` 循环 `s<=3`→`s<=5`）

L4/L5 文案逐将照 **spec §5.2 概念表**（L4 名将统帅 / L5 神将封神；关赵马升坐骑、诸葛走道法、黄月英走机关，均不破人设）。每条续 `PERSON` 锚约束；L5 须含"金光/能量效果画在角色身上、纯白背景"措辞以兼容 debg。

- [ ] **Step 1: 循环上限**

`--stages` 分支里 `for (let s = 1; s <= 3; s++)` → `for (let s = 1; s <= 5; s++)`。

- [ ] **Step 2: 每将 stages 追加 2 条（示例 2 将，其余 10 将照 §5.2 同式补全）**

黄忠：
```js
    '三国蜀汉名将·黄忠(名将统帅):花白长须,金鳞重铠披风,骑一匹战马,背插帅旗,手持宝雕大弓,定军山主帅气概。' + PERSON,
    '三国蜀汉老将武神·黄忠(封神):花白长须,周身金光罩体光晕,神弓拉满、箭化流光,效果全部画在角色身上,纯白背景无场景。' + PERSON,
```
关羽：
```js
    '三国蜀汉名将·关羽(名将统帅):面如重枣长髯,绿金帅袍披重甲,骑赤兔马披战甲挂饰,背帅旗,手持青龙偃月刀,威震华夏。' + PERSON,
    '三国武圣·关羽(封神):面如重枣丹凤眼,周身金光罩体,青龙虚影绕刀身,效果全部画在角色身上,纯白背景无场景,骑赤兔执青龙偃月刀。' + PERSON,
```
其余 10 将（zhang/zhao/ma/zhuge/liao/zhou/madai/guanping/zhangbao/yueying）按 spec §5.2 表逐条补 L4/L5，**诸葛/黄月英不加战马**（诸葛升华贵鹤氅+八卦光、素舆精致化；黄月英升机关连弩+器械阵）。

- [ ] **Step 3: 静态自检（不调 API）**

Run: `node -e "import('./tools/gen-sprites.mjs')" 2>&1 | head` 或语法检查 `node --check tools/gen-sprites.mjs`
Expected: 无语法错。再用一行脚本断言每将 stages 长度为 5（同 Task 前置核验法）。

- [ ] **Step 4: 提交**

```bash
git add tools/gen-sprites.mjs
git commit -m "feat(tower-defender): gen-sprites 补12将L4/L5封神prompt + 5阶循环"
```

---

## SEG B · Task 12：生成 + 去底 + QA + 接线验收（James 跑生成）

**Files:** 产 `assets/sprites/generals/<id>_4.png`、`<id>_5.png`（24 张）。

- [ ] **Step 1: 生成（James 执行，key 不落盘）**

Run: `OPENROUTER_API_KEY=sk-or-... node tools/gen-sprites.mjs --stages`
Expected: 控制台逐条 `✓ generals/<id>_4.png`、`<id>_5.png`（24 行）。失败的将单独重跑：`... gen-sprites.mjs --stages <id>`。

- [ ] **Step 2: 去白底**

Run: `python3 tools/debg-sprites.py`（或既有去底命令，对 generals 目录新图生效）。
Expected: 24 张近白底被抠成透明。

- [ ] **Step 3: 4 角亮度 QA（spec §5.1）**

逐张抽检去底后图 4 角像素：若任一角亮度 < 250（残留浅金底）→ 标记该图，回 Step 1 单独重生成该将。可用一次性脚本批量验：
```bash
python3 - <<'PY'
from PIL import Image; import glob
for f in glob.glob('assets/sprites/generals/*_[45].png'):
    im = Image.open(f).convert('RGBA'); w,h = im.size
    for (x,y) in [(1,1),(w-2,1),(1,h-2),(w-2,h-2)]:
        r,g,b,a = im.getpixel((x,y))
        if a > 20 and (r+g+b)/3 < 250: print('CHECK', f, (x,y), (r,g,b,a)); break
print('done')
PY
```
Expected: 无 `CHECK` 行（全角近透/近白）。

- [ ] **Step 4: 浏览器接线验收**

进 1 关，建塔→升到 L4、L5，确认：①立绘逐阶换形（名将统帅→封神）②无黑底/白卡 ③升级金光特效正常。在 营/塔/高台 各建一塔，确认加成 + 角标 + 立绘三者同屏正常（含 iPad 触屏）。截图留档。

- [ ] **Step 5: 提交**

```bash
git add assets/sprites/generals/
git commit -m "feat(tower-defender): 12将L4/L5封神立绘24张（生成+去底+4角QA过）"
```

**→ Seg B 完成。**

---

## Self-Review

**Spec 覆盖核对（逐节）：**
- §3 地图元素美化 → Task 9 ✓
- §4.1 三地形模型/常量 → Task 1 ✓
- §4.2 effectiveStats 收口 + 迁移 + 防双计 → Task 2/3（grep + plateau 恰 +0.5 断言）✓
- §4.3 字段/写入/续玩 → Task 1（字段）+ Task 4（建塔/续玩）✓
- §4.4 高台美化 + 营/塔渲染 + 角标 → Task 6 ✓
- §4.5 铺设 + 黑名单自动保留 + 死区验收 → Task 7（死区断言）✓
- §4.6 门禁分工/tools 保留原始 towerStats → Task 8 ✓
- §5.1–5.3 生成管线/概念表/接线/亮度 QA → Task 10（接线）/11（prompt）/12（生成+QA）✓
- §6 常量 → Task 1 ✓
- §7 测试与验收 → 各 Task 内嵌 + Task 8/9/12 冒烟 ✓

**占位符扫描：** 无 TBD/TODO。Task 7 rect 坐标与 Task 9 其余 painter、Task 11 其余 10 将 prompt 标注"照既定示例/§5.2 表补全"——内容来源已在 spec/示例中具体存在，非留待发明。

**类型/命名一致性：** `terrainBonuses`/`effectiveStats`/`dmgMult`/`intervalMult`/`rangeBonus`/`barracks`/`archtower` 全计划统一；`effectiveStats(tower)` 签名各 Task 一致；`terrainGlyph(ctx,cells,corner,char,tint)` 仅 Task 6 定义与调用。

**已知顺序依赖：** Task 3 营/塔断言依赖 Task 4 写字段（已用临时注释+解注显式处理）；Task 10 可先于 Task 11/12 落地（缺图回退 L3）。
