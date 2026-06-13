# 武将栏全显示 + 隐藏作弊菜单 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让建造栏从第1章即显示全部12将（未解锁者锁定态），并在选关页「卫」字加隐藏作弊菜单（密码111 → 解锁关卡/设初始金币/解锁武将）。

**Architecture:** 作弊用**纯内存叠加层** `core/cheats.js`（三开关读取时派生，不碰存档，刷新即还原）；选关屏用 shim save 让 `levelSelect.js` 零改；作弊面板 `ui/cheatPanel.js` 模态盖在选关屏，文本输入用 `window.prompt`。武将栏全显示只需让 `buildBarLayout` 永远输出12将（锁定渲染已存在）。

**Tech Stack:** 纯 ES modules、canvas 2D、`node:assert` 单测（standalone `.mjs`，跑 `node tests/X.test.mjs`，全量 `bash scripts/test.sh`）。

> **约定**：所有 commit 末尾加 trailer：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`。当前分支 `develop`，**只 commit 不 push**。

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/ui/buildBar.js` | 建造栏 layout/hit/draw | 改：`ids` 永远12将 |
| `src/core/cheats.js` | 作弊叠加层纯函数（render-free） | 新建 |
| `src/ui/cheatPanel.js` | 作弊面板 layout/hit/draw（木牌风格） | 新建 |
| `src/ui/levelSelect.js` | 选关屏 | 改：加 `cheatHotspot` 导出（「卫」字矩形） |
| `src/main.js` | 装配/状态机/输入 | 改：imports + 作弊 vars + 选关点击路由 + enterLevel roster/gold + 故事 roster + render 面板 + `__td` 钩子 |
| `tests/buildBar.test.mjs` | — | 改：新档=12牌、premium 锁定 |
| `tests/cheats.test.mjs` | — | 新建 |
| `tests/cheatPanel.test.mjs` | — | 新建 |
| `tests/levelSelect.test.mjs` | — | 改：加 `cheatHotspot` 断言 |

执行顺序：Task 1（独立）→ Task 2 → 3 → 4（被 Task 5 依赖）→ Task 5（装配）。

---

## Task 1: 武将栏永远显示12将（功能1）

**Files:**
- Modify: `src/ui/buildBar.js:20-26`（删 `showPremium` 分支）+ 头部注释
- Test: `tests/buildBar.test.mjs`（首个断言块 6→12）

- [ ] **Step 1: 改测试——新档应为12牌且 premium 全锁定**

把 `tests/buildBar.test.mjs` 中「新档:无五虎解锁 → 单行 6 项」整个块替换为：

```js
// 新档(仅基础6将解锁):仍单行 12 牌,premium 段全部锁定(🔒+解锁提示),不再整排隐藏
{
  const st = mkState(ROW_CHEAP);
  const L = buildBarLayout(view, st);
  assert.equal(L.length, 12, '第1章即显示全12牌');
  assert.equal(new Set(L.map((b) => b.y)).size, 1, '单行同一 y');
  assert.deepEqual(L.map((b) => b.id), [...ROW_CHEAP, ...ROW_PREMIUM], '廉价段在左、五虎段在右');
  assert.ok(L.slice(0, 6).every((b) => !b.locked), '廉价6将解锁');
  assert.ok(L.slice(6).every((b) => b.locked), 'premium 6将锁定');
  assert.equal(hitBuildBar(view, st, L[0].x + 5, L[0].y + 5), 'liao', '命中首位');
  const huang = L.find((b) => b.id === 'huang');
  assert.equal(hitBuildBar(view, st, huang.x + 5, huang.y + 5), null, '锁定将命中 null');
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/buildBar.test.mjs`
Expected: FAIL — `AssertionError: 第1章即显示全12牌`（现状返回 6）

- [ ] **Step 3: 改 `buildBarLayout` 永远输出12将**

`src/ui/buildBar.js` 把第25-26行：

```js
  const showPremium = ROW_PREMIUM.some(has);
  const ids = showPremium ? [...ROW_CHEAP, ...ROW_PREMIUM] : ROW_CHEAP;
```

替换为：

```js
  // [全显示] 永远12将单行:廉价6在左、五虎+诸葛6在右;未解锁者 locked=true(🔒+解锁提示),不再整排隐藏
  const ids = [...ROW_CHEAP, ...ROW_PREMIUM];
```

并把第21行注释：

```js
// unlocked=null → 全解锁;五虎段仅在「任一五虎已解锁」后出现(第1章=6牌,spec §5)。
```

改为：

```js
// unlocked=null → 全解锁;锁定将照常出现于固定段位、渲染为 locked(第1章即12牌)。
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/buildBar.test.mjs`
Expected: `ok buildBar`

- [ ] **Step 5: Commit**

```bash
git add src/ui/buildBar.js tests/buildBar.test.mjs
git commit -m "feat(tower-defender): 武将栏第1章即显示全12将(未解锁锁定态)"
```

---

## Task 2: 作弊叠加层 `core/cheats.js`（功能2 数据层）

**Files:**
- Create: `src/core/cheats.js`
- Test: `tests/cheats.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `tests/cheats.test.mjs`：

```js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/cheats.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND: ../src/core/cheats.js`

- [ ] **Step 3: 写实现**

Create `src/core/cheats.js`：

```js
// core/cheats.js — [作弊] 隐藏作弊菜单的纯内存叠加层(render-free、可单测;刷新即还原,绝不写存档)。
// 关键设计:作弊不改 save.unlockedLevel(它同时驱动关卡+武将解锁),而是读取时派生 → 关卡/武将独立、还原无损。
import { unlockedGenerals } from '../data/unlocks.js';

export function defaultCheats() {
  return { allLevels: false, allGenerals: false, goldOverride: null };
}
// 有效最高可玩关号:allLevels → 总关数;否则真实存档值。
export function effectiveUnlockedLevel(save, cheats, total) {
  return cheats.allLevels ? total : save.unlockedLevel;
}
// 有效已解锁将集:allGenerals → 全部 id;否则按真实存档派生。allIds 由调用方传 Object.keys(GENERALS)。
export function effectiveRoster(save, cheats, allIds) {
  return cheats.allGenerals ? new Set(allIds) : unlockedGenerals(save);
}
// 有效起始金币:goldOverride 非 null 则覆盖(含 0);否则关卡默认。
export function effectiveStartGold(levelStartGold, cheats) {
  return cheats.goldOverride != null ? cheats.goldOverride : levelStartGold;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/cheats.test.mjs`
Expected: `ok cheats`

- [ ] **Step 5: Commit**

```bash
git add src/core/cheats.js tests/cheats.test.mjs
git commit -m "feat(tower-defender): 作弊叠加层 core/cheats.js(纯内存·不碰存档)"
```

---

## Task 3: 选关「卫」字隐藏热区 `cheatHotspot`（功能2）

**Files:**
- Modify: `src/ui/levelSelect.js`（追加 `cheatHotspot` 导出；`FONT` 已在现有 import 中）
- Test: `tests/levelSelect.test.mjs`（加断言 + import）

- [ ] **Step 1: 写失败测试**

`tests/levelSelect.test.mjs` 第一行 import 改为：

```js
import { levelSelectLayout, hitLevelSelect, cheatHotspot } from '../src/ui/levelSelect.js';
```

在 `console.log('ok levelSelect');` **之前**插入：

```js
// [作弊] 隐藏热区:"卫"(成都保卫战 第4字)字形矩形,落标题带内、不压副标题、位于中线右侧
{
  const ctx = { save() {}, restore() {}, set font(v) {}, measureText: (s) => ({ width: s.length * 46 }) };
  const hs = cheatHotspot(ctx, view, levels, 0);
  const L = levelSelectLayout(view, levels, 0);
  assert.ok(hs && typeof hs.x === 'number' && hs.w > 0 && hs.h > 0, 'cheatHotspot 返回矩形');
  assert.ok(hs.x + hs.w / 2 > view.w / 2, '"卫"在标题中线右侧(第4字)');
  assert.ok(hs.y + hs.h < L.header.chapterY, '不压章节副标题');
  assert.ok(hs.y > L.header.titleY - 46, '在标题带内');
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/levelSelect.test.mjs`
Expected: FAIL — `cheatHotspot is not a function`（未导出）

- [ ] **Step 3: 写实现**

`src/ui/levelSelect.js` 在文件末尾（`drawLevelSelect` 之后）追加：

```js
// [作弊] 隐藏热区:返回标题「成都保卫战」中「卫」(第4字)的屏幕矩形{x,y,w,h}(含触控外扩);无任何视觉绘制。
// 与 drawLevelSelect 内 title(...,TITLE_PX) 同字体测量;改标题字号需同步本常量。
const TITLE_PX = 46;
export function cheatHotspot(ctx, view, levels, chapterIdx) {
  const L = levelSelectLayout(view, levels, chapterIdx);
  ctx.save();
  ctx.font = FONT.head(TITLE_PX);
  const full = ctx.measureText('成都保卫战').width;
  const before = ctx.measureText('成都保').width;
  const w = ctx.measureText('卫').width;
  ctx.restore();
  const left = view.w / 2 - full / 2;       // title 居中 → 左缘
  const pad = 6;                            // 触控外扩
  return { x: left + before - pad, y: L.header.titleY - TITLE_PX / 2 - pad, w: w + pad * 2, h: TITLE_PX + pad * 2 };
}
```

> 说明：`title()` 用 `textAlign='center'`、`FONT.head(46)`、无字间距，故「卫」左缘 = 居中左缘 + `measureText('成都保')`。高度居中于 `titleY`（±23），副标题在 `titleY+50`，不重叠。

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/levelSelect.test.mjs`
Expected: `ok levelSelect`

- [ ] **Step 5: Commit**

```bash
git add src/ui/levelSelect.js tests/levelSelect.test.mjs
git commit -m "feat(tower-defender): 选关\"卫\"字隐藏作弊热区 cheatHotspot"
```

---

## Task 4: 作弊面板 `ui/cheatPanel.js`（功能2）

**Files:**
- Create: `src/ui/cheatPanel.js`
- Test: `tests/cheatPanel.test.mjs`

action 集合（main.js 据此分派）：`'levels-on' | 'levels-reset' | 'gold-set' | 'gold-reset' | 'generals-toggle' | 'close' | 'panel'`（`'panel'`=面板内空白，模态吞点击；面板外=`null`）。

- [ ] **Step 1: 写失败测试**

Create `tests/cheatPanel.test.mjs`：

```js
// tests/cheatPanel.test.mjs — [作弊] 面板 layout/hit:各按钮命中各自 action、模态吞空白、按钮不重叠
// 运行:node games/tower-defender/tests/cheatPanel.test.mjs
import assert from 'node:assert';
import { cheatPanelLayout, hitCheatPanel } from '../src/ui/cheatPanel.js';

const view = { w: 1280, h: 800 };
const L = cheatPanelLayout(view);
const center = (b) => [b.x + b.w / 2, b.y + b.h / 2];

// 面板水平居中
assert.ok(Math.abs((L.panel.x + L.panel.w / 2) - view.w / 2) < 1, '面板水平居中');

// 各按钮中心 → 对应 action
assert.equal(hitCheatPanel(view, ...center(L.levelsOn)), 'levels-on', '解锁关卡');
assert.equal(hitCheatPanel(view, ...center(L.levelsReset)), 'levels-reset', '关卡还原');
assert.equal(hitCheatPanel(view, ...center(L.goldSet)), 'gold-set', '设置金币');
assert.equal(hitCheatPanel(view, ...center(L.goldReset)), 'gold-reset', '金币还原');
assert.equal(hitCheatPanel(view, ...center(L.generalsToggle)), 'generals-toggle', '解锁武将');
assert.equal(hitCheatPanel(view, ...center(L.close)), 'close', '关闭');

// 面板内空白(标题区左上角)→ 'panel'(模态,不穿透)
assert.equal(hitCheatPanel(view, L.panel.x + 6, L.panel.y + 6), 'panel', '面板内空白吞点击');
// 面板外 → null
assert.equal(hitCheatPanel(view, 4, 4), null, '面板外返回 null');

// 同行两按钮不重叠
const noOverlap = (a, b) => a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
assert.ok(noOverlap(L.levelsOn, L.levelsReset), '行0两按钮不重叠');
assert.ok(noOverlap(L.goldSet, L.goldReset), '行1两按钮不重叠');

console.log('ok cheatPanel');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/cheatPanel.test.mjs`
Expected: FAIL — `ERR_MODULE_NOT_FOUND: ../src/ui/cheatPanel.js`

- [ ] **Step 3: 写实现**

Create `src/ui/cheatPanel.js`：

```js
// ui/cheatPanel.js — [作弊] 隐藏作弊菜单(模态盖选关屏)。layout/hit/draw 单一来源;木牌风格。
// 三组(纯内存,刷新即还原,见 core/cheats.js):①解锁所有关卡/还原 ②设初始金币/还原 ③一键解锁所有武将(切换)。
import { panel, button, FONT, PAL } from './theme.js';

const PW = 440, ROW_H = 58, BTN_W = 100, BTN_H = 40, PAD = 24, TITLE_H = 54, CLOSE_H = 48, GAP = 10;

// 面板矩形 + 各按钮矩形(屏幕坐标,居中)。rowY(i):第 i 行顶。
export function cheatPanelLayout(view) {
  const rows = 3;
  const ph = TITLE_H + rows * ROW_H + CLOSE_H + PAD;
  const px = (view.w - PW) / 2, py = (view.h - ph) / 2;
  const rowY = (i) => py + TITLE_H + i * ROW_H;
  const rightBtn = (i) => ({ x: px + PW - PAD - BTN_W, y: rowY(i) + (ROW_H - BTN_H) / 2, w: BTN_W, h: BTN_H });
  const midBtn = (i) => ({ x: px + PW - PAD - BTN_W * 2 - GAP, y: rowY(i) + (ROW_H - BTN_H) / 2, w: BTN_W, h: BTN_H });
  return {
    panel: { x: px, y: py, w: PW, h: ph },
    levelsOn: midBtn(0),          // 行0:解锁所有关卡
    levelsReset: rightBtn(0),     // 行0:还原
    goldSet: midBtn(1),           // 行1:设置
    goldReset: rightBtn(1),       // 行1:还原
    generalsToggle: rightBtn(2),  // 行2:解锁所有武将(切换)
    close: { x: px + (PW - 180) / 2, y: py + ph - CLOSE_H + 4, w: 180, h: CLOSE_H - 12 },
    rowY,
  };
}

// 命中 → action。面板内空白='panel'(模态吞点击);面板外=null。
export function hitCheatPanel(view, sx, sy) {
  const L = cheatPanelLayout(view);
  const hit = (b) => b && sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h;
  if (hit(L.levelsOn)) return 'levels-on';
  if (hit(L.levelsReset)) return 'levels-reset';
  if (hit(L.goldSet)) return 'gold-set';
  if (hit(L.goldReset)) return 'gold-reset';
  if (hit(L.generalsToggle)) return 'generals-toggle';
  if (hit(L.close)) return 'close';
  if (hit(L.panel)) return 'panel';
  return null;
}

// 绘制(屏幕坐标);开关态用 jade 高亮反映 cheats。
export function drawCheatPanel(ctx, view, cheats) {
  const L = cheatPanelLayout(view);
  ctx.fillStyle = 'rgba(8,5,3,.55)'; ctx.fillRect(0, 0, view.w, view.h);   // 模态遮罩
  panel(ctx, L.panel.x, L.panel.y, L.panel.w, L.panel.h, { variant: 'wood', r: 14 });
  // 标题
  ctx.fillStyle = PAL.goldBright; ctx.font = FONT.head(24);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('作弊菜单', view.w / 2, L.panel.y + 30);
  // 行标签(左对齐)
  ctx.textAlign = 'left'; ctx.font = FONT.head(17); ctx.fillStyle = PAL.cream;
  const lx = L.panel.x + PAD;
  ctx.fillText('解锁所有关卡', lx, L.rowY(0) + ROW_H / 2);
  ctx.fillText('初始金币：' + (cheats.goldOverride != null ? cheats.goldOverride : '未设'), lx, L.rowY(1) + ROW_H / 2);
  ctx.fillText('解锁所有武将', lx, L.rowY(2) + ROW_H / 2);
  // 按钮(开关态 jade 高亮)
  button(ctx, L.levelsOn, { label: cheats.allLevels ? '已解锁' : '解锁', variant: cheats.allLevels ? 'jade' : 'wood' });
  button(ctx, L.levelsReset, { label: '还原', variant: 'wood' });
  button(ctx, L.goldSet, { label: '设置', variant: cheats.goldOverride != null ? 'jade' : 'wood' });
  button(ctx, L.goldReset, { label: '还原', variant: 'wood' });
  button(ctx, L.generalsToggle, { label: cheats.allGenerals ? '已解锁' : '解锁', variant: cheats.allGenerals ? 'jade' : 'wood' });
  button(ctx, L.close, { label: '关闭', variant: 'gold' });
}
```

> `panel`/`button`/`FONT`/`PAL` 来自 `theme.js`（与暂停菜单同套）。`button(ctx, rect, {label, variant})` 是既有签名（见 `theme.js` 用法）。

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/cheatPanel.test.mjs`
Expected: `ok cheatPanel`

- [ ] **Step 5: Commit**

```bash
git add src/ui/cheatPanel.js tests/cheatPanel.test.mjs
git commit -m "feat(tower-defender): 作弊面板 ui/cheatPanel.js(木牌风格·layout/hit/draw)"
```

---

## Task 5: main.js 装配作弊系统（功能2 整合）

main.js 是装配层（触 DOM/canvas，不进单测）；验证 = `node --check` + 全量 `scripts/test.sh` 全绿（证明未破坏 enterLevel/makeStoryState 契约）+ 浏览器手动验收。**逐处精确替换**：

**Files:**
- Modify: `src/main.js`（imports / 模块 vars / `selSave` / `startLevel` / `enterLevel` / `makeStoryState` / boot 预建 state / `onPointerDown` 选关分支 / `render` 选关分支 / `__td`）

- [ ] **Step 1: 改 imports**

`src/main.js` 第20行：

```js
import { unlockedGenerals, newlyUnlocked } from './data/unlocks.js';
```
→
```js
import { newlyUnlocked } from './data/unlocks.js';
```

第23行：

```js
import { hitLevelSelect, drawLevelSelect } from './ui/levelSelect.js';
```
→
```js
import { hitLevelSelect, drawLevelSelect, cheatHotspot } from './ui/levelSelect.js';
```

在第23行下方新增两行：

```js
import { hitCheatPanel, drawCheatPanel } from './ui/cheatPanel.js';
import { defaultCheats, effectiveUnlockedLevel, effectiveRoster, effectiveStartGold } from './core/cheats.js';
```

- [ ] **Step 2: 加作弊模块 vars + selSave 助手**

在第58行 `let isFs = false;` 之后新增：

```js
let cheats = defaultCheats();   // [作弊] 纯内存叠加层,刷新即还原;绝不写存档(见 core/cheats.js)
let cheatOpen = false;          // [作弊] 选关屏作弊面板是否打开(模态)
// [作弊] 选关用 shim save:allLevels 时把有效最高可玩关号抬到总关数;levelSelect/startLevel 据此判解锁,内部零改
function selSave() { return { ...save, unlockedLevel: effectiveUnlockedLevel(save, cheats, LEVELS.length) }; }
```

- [ ] **Step 3: `startLevel` 解锁校验改用 selSave**

第108行：

```js
  if (!isUnlocked(save, n + 1)) return false;
```
→
```js
  if (!isUnlocked(selSave(), n + 1)) return false;   // [作弊] allLevels 时放行全关
```

- [ ] **Step 4: `enterLevel` roster + 金币 override**

第98行：

```js
  Object.assign(state, newGameState(LEVELS[n], { unlocked: unlockedGenerals(save) }));
```
→
```js
  Object.assign(state, newGameState(LEVELS[n], { unlocked: effectiveRoster(save, cheats, Object.keys(GENERALS)) }));
  state.gold = effectiveStartGold(state.gold, cheats);   // [作弊] goldOverride 覆盖起始金币(applyResume 随后用快照金币覆盖→续玩不受影响)
```

- [ ] **Step 5: `makeStoryState` roster（点将随作弊一致）**

第67行：

```js
  return newStoryState(storyContentFor(LEVELS[n], unlockedGenerals(save)), { hasResume, review });
```
→
```js
  return newStoryState(storyContentFor(LEVELS[n], effectiveRoster(save, cheats, Object.keys(GENERALS))), { hasResume, review });
```

- [ ] **Step 6: boot 预建 state 的 roster**

第419行：

```js
  state = newGameState(LEVELS[nextPlayableIndex(save, LEVELS.length)], { unlocked: unlockedGenerals(save) });   // 预建有效 state(供 resize/loop)
```
→
```js
  state = newGameState(LEVELS[nextPlayableIndex(save, LEVELS.length)], { unlocked: effectiveRoster(save, cheats, Object.keys(GENERALS)) });   // 预建有效 state(供 resize/loop;boot 时 cheats 全关→等价 unlockedGenerals)
```

- [ ] **Step 7: `onPointerDown` 选关分支——作弊路由**

第295-300行整块：

```js
  if (screen === 'select') {
    const r = hitLevelSelect(view, save, LEVELS, selectChapter, sx, sy);
    if (r && r.kind === 'level') startLevel(r.index);
    else if (r && r.kind === 'chapter') selectChapter = Math.max(0, Math.min(CHAPTERS.length - 1, selectChapter + r.delta));
    return;
  }
```

替换为：

```js
  if (screen === 'select') {
    // [作弊] 面板打开=模态,优先消费(空白/未命中也吞,不穿透选关)
    if (cheatOpen) {
      const a = hitCheatPanel(view, sx, sy);
      if (a === 'levels-on') cheats.allLevels = true;
      else if (a === 'levels-reset') cheats.allLevels = false;
      else if (a === 'generals-toggle') cheats.allGenerals = !cheats.allGenerals;
      else if (a === 'gold-set') {
        const v = window.prompt('设置初始金币（留空取消）', cheats.goldOverride != null ? String(cheats.goldOverride) : '');
        const n = parseInt(v, 10);
        if (Number.isInteger(n) && n >= 0) cheats.goldOverride = n;   // 空/NaN/负→不变
      } else if (a === 'gold-reset') cheats.goldOverride = null;
      else if (a === 'close') cheatOpen = false;
      if (a) audio.sfx('ui');
      return;
    }
    // [作弊] 隐藏热区:点"卫"字 → 密码 111 → 开面板;错/取消静默
    const hs = cheatHotspot(ctx, view, LEVELS, selectChapter);
    if (sx >= hs.x && sx <= hs.x + hs.w && sy >= hs.y && sy <= hs.y + hs.h) {
      const pw = window.prompt('请输入作弊密码');
      if ((pw || '').trim() === '111') { cheatOpen = true; audio.sfx('ui'); }
      return;
    }
    const r = hitLevelSelect(view, selSave(), LEVELS, selectChapter, sx, sy);
    if (r && r.kind === 'level') startLevel(r.index);
    else if (r && r.kind === 'chapter') selectChapter = Math.max(0, Math.min(CHAPTERS.length - 1, selectChapter + r.delta));
    return;
  }
```

- [ ] **Step 8: `render` 选关分支——shim save + 画面板**

第204行：

```js
  if (screen === 'select') { drawLevelSelect(ctx, view, save, LEVELS, selectChapter); drawFsButton(); return; }
```
→
```js
  if (screen === 'select') { drawLevelSelect(ctx, view, selSave(), LEVELS, selectChapter); if (cheatOpen) drawCheatPanel(ctx, view, cheats); drawFsButton(); return; }
```

- [ ] **Step 9: `__td` QA 钩子**

在 `window.__td = {` 对象内（第450行 `voiceSrc: ...` 一行之后、`};` 之前）新增：

```js
    get cheats() { return cheats; },
    openCheat() { cheatOpen = true; },   // [作弊] QA:绕过密码直接开面板
```

- [ ] **Step 10: 语法检查**

Run: `node --check src/main.js`
Expected: 无输出（exit 0）

- [ ] **Step 11: 全量门禁**

Run: `bash scripts/test.sh`
Expected: 末行 `✅✅ 全部门禁通过`（含 cheats/cheatPanel/buildBar/levelSelect 全绿、verify-levels 0 漏怪、check-imports 自含）

- [ ] **Step 12: Commit**

```bash
git add src/main.js
git commit -m "feat(tower-defender): main.js 装配作弊系统(卫字热区/面板路由/roster/金币override)"
```

---

## Task 6: 浏览器手动验收（对照 spec 验收标准）

> main.js 无单测覆盖，此步用真机/浏览器走查。本地起静态服务（如 `python3 -m http.server` 于 game-hub 根，开 `games/tower-defender/index.html`），或用既有 host-side puppeteer 冒烟流程。逐条核对：

- [ ] **1. 武将栏全显示**：清空 localStorage 起新档 → 底部建造栏即 12 将，五虎+诸葛灰底🔒+「过10/20/30关」；点之不建塔、按 Q/W/E/R/T/Y 不选中。
- [ ] **2. 隐藏热区**：选关页点标题「卫」字 → 弹框；输错或取消 → 无反应、外观不变；输 `111` → 出木牌作弊菜单。
- [ ] **3. 解锁所有关卡**：点「解锁」→ 全 50 关可点可进；「还原」后回真实进度（仅已通关+下一关）；**武将不被连带解锁**。
- [ ] **4. 一键解锁所有武将**：点「解锁」→ 建造栏 12 将全可建、热键可用；**关卡不被连带解锁**。
- [ ] **5. 设初始金币**：点「设置」输 9999 → 进任意关起始金币=9999；「还原」后回关卡默认；进行中续玩（切后台再回）金币不被 override 顶满。
- [ ] **6. 刷新还原**：刷新页面 → 作弊全失效，回真实进度/默认金币（菜单需重输 111）。
- [ ] **7. 门禁**：`bash scripts/test.sh` 全绿（已在 Task 5 Step 11 覆盖）。

- [ ] **验收记录**：如发现问题，回到对应 Task 修正并补测；全通过则本计划完成，交 James 实玩终验（按其惯例 develop 暂不 push）。

---

## Self-Review（计划自审）

**1. Spec 覆盖**
- 功能1 全显示 → Task 1 ✓
- 关键设计「独立叠加层不碰存档」→ Task 2（`cheats.js` 三纯函数）✓
- 隐藏「卫」热区 → Task 3 ✓
- 作弊面板（3 组 + 关闭，木牌风格）→ Task 4 ✓
- main 装配（路由/roster/金币/shim/__td）→ Task 5 ✓
- 还原语义（levels-reset/gold-reset/generals-toggle）→ Task 4 action + Task 5 Step 7 ✓
- 边界：密码错静默(Step7)、金币 NaN/负忽略(Step7)、不污染存档(cheats 只读)、金币不覆盖续玩(Step4 排序 + applyResume 后写)✓
- 验收标准 7 条 → Task 6 ✓

**2. Placeholder 扫描**：无 TBD/TODO；每个代码步给出完整代码与精确行号。

**3. 命名/类型一致性**
- action 串集全程统一：`levels-on / levels-reset / gold-set / gold-reset / generals-toggle / close / panel`（Task 4 实现、测试、Task 5 Step 7 分派三处一致）✓
- layout key 统一：`levelsOn / levelsReset / goldSet / goldReset / generalsToggle / close / panel / rowY`（Task 4 实现与测试一致）✓
- `cheatHotspot(ctx, view, levels, chapterIdx)` 签名：Task 3 定义、测试、Task 5 Step 7 调用一致 ✓
- `effectiveRoster(save, cheats, allIds)`/`effectiveStartGold(levelStartGold, cheats)`/`effectiveUnlockedLevel(save, cheats, total)` 签名：Task 2 定义、Task 5 调用一致（allIds 传 `Object.keys(GENERALS)`）✓
- 移除 main 对 `unlockedGenerals` 的全部直接调用（Step 5/6/7 替换为 effectiveRoster），故 Step 1 从 import 删之，无悬空引用 ✓
