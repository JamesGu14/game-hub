# 成都保卫战 · 武将栏全显示 + 隐藏作弊菜单 设计稿

> 日期：2026-06-13
> 范围：两个独立小特性，共享一次 spec→plan→实现循环。
> 铁律对齐：纯 canvas UI、render-free 数据层、不破坏既有存档 schema。

## 背景与目标

两个面向「家长 + 一年级孩子」的小更新：

1. **武将栏全显示**：游戏一开始（第1章）就把全部 12 将显示在底部建造栏；剧情尚未解锁的将显示为锁定态（🔒 + 解锁提示），作为孩子可见的「收集目标」。
2. **隐藏作弊菜单**：选关页标题「成都保卫战」的「卫」字是一个隐藏热区；点击 → 浏览器弹框输入作弊密码 `111` → 弹出木牌风格菜单，提供三组作弊：①解锁所有关卡 / 还原 ②设置初始金币 / 还原 ③一键解锁所有武将。供 James 自己测试 / 临时放权。

## 非目标（YAGNI）

- 不做多套密码 / 权限分级。
- 不做作弊状态的持久化（明确决定：纯内存，刷新即还原）。
- 不做锁定武将的「点击预览英雄卡」（现有 🔒 + 解锁提示已足够传达收集目标）。
- 不改任何关卡数值 / 经济 / 平衡。
- 作弊菜单只在选关屏入口，不做对局中途调用。

## 关键设计选择：作弊用「独立叠加层」而非改存档

`save.unlockedLevel` 同时驱动**关卡解锁**（`isUnlocked`）和**武将解锁**（`unlocks.js / unlockedGenerals`）。两种实现路径：

- **A. 直接改 `save.unlockedLevel`**：解锁关卡会必然连带解锁全部武将（阈值 10/20/30 全 < 50），两者无法独立；「还原」还需记忆原值；且把作弊写进真实存档，有污染 / schema 风险。
- **B. 独立 `cheats` 叠加层（采用）**：三个开关作为**读取时叠加**，**完全不触碰存档**：
  - `allLevels`：选关时把「有效 unlockedLevel」抬到总关数。
  - `allGenerals`：把「有效武将集」替换为全部将 id。
  - `goldOverride`：进关时覆盖起始金币。

  关卡与武将彻底独立；「还原」=关开关，真实进度毫发无损；配合「刷新即还原」=纯内存，零 schema 迁移、零污染。

---

## 功能1 · 武将栏全显示 + 锁定

地基已存在：`src/ui/buildBar.js` 已能渲染锁定将（灰底 `globalAlpha 0.42` + 🔒 + `UNLOCK_HINT` 文案「过10关/20关/30关」），`hitBuildBar` 已对 `locked` 返回 `null`（静默不建塔）。当前唯一限制在 `buildBarLayout`：

```js
// 现状（第25-26行）：五虎+诸葛整排在「任一五虎解锁前」被隐藏
const showPremium = ROW_PREMIUM.some(has);
const ids = showPremium ? [...ROW_CHEAP, ...ROW_PREMIUM] : ROW_CHEAP;
```

### 改动

| 点 | 做法 |
|---|---|
| 全显示 | `ids` 永远 = `[...ROW_CHEAP, ...ROW_PREMIUM]`，删除 `showPremium` 条件分支 |
| 锁定态 | 复用现有 `locked` 渲染与解锁提示，**不新增渲染代码** |
| 点锁定将 | `hitBuildBar` 对 `locked` 返回 `null`（已有），保持静默 |
| 热键 | `onKey` 已用 `state.unlocked.has(id)` 门禁，锁定将按热键不选中（已有），保持 |

### 布局风险评估：无新增风险

`buildBarLayout` 已有自适应（满宽放不下先压 `gap` 再缩 `bw`，地板 ≈56px > 44px 触控底线）。**过 L10 后游戏本就一次性显示 12 将单行**（其中未解锁的 huang/guan/ma/zhuge 仍为 locked），即「12 将单行 + 自适应缩牌」是已上线、已在 iPad 验证的现实。本改动只是把这一状态提前到 L1，不引入新布局形态。

### 测试

- `tests/buildBar.test.mjs`：更新断言——给「仅基础 6 将」的存档（`unlockedLevel=1`），`buildBarLayout` 返回 **12** 项；`ROW_PREMIUM` 段全部 `locked=true`、`ROW_CHEAP` 段 `locked=false`；命中 locked 牌 `hitBuildBar` 返回 `null`。

---

## 功能2 · 隐藏作弊菜单

新增 **2 个文件** + 改 **main.js** 装配；`src/ui/levelSelect.js` 内部渲染零改动（仅追加一个导出的几何函数）。

### ① 数据层 `src/core/cheats.js`（新建，纯函数、render-free、可单测）

```js
import { unlockedGenerals } from '../data/unlocks.js';

export function defaultCheats() {
  return { allLevels: false, allGenerals: false, goldOverride: null };
}
// 有效最高可玩关号：allLevels → 总关数；否则真实存档值
export function effectiveUnlockedLevel(save, cheats, total) {
  return cheats.allLevels ? total : save.unlockedLevel;
}
// 有效武将集：allGenerals → 全部 id；否则按真实存档派生
export function effectiveRoster(save, cheats, allIds) {
  return cheats.allGenerals ? new Set(allIds) : unlockedGenerals(save);
}
// 有效起始金币：goldOverride 有值则覆盖
export function effectiveStartGold(levelStartGold, cheats) {
  return cheats.goldOverride != null ? cheats.goldOverride : levelStartGold;
}
```

- 不 import 渲染 / DOM / localStorage（与 `unlocks.js` 同层）。
- `allIds` 由调用方传 `Object.keys(GENERALS)`，保持数据层不反向依赖 generals 渲染色等。

### ② 隐藏热区 `cheatHotspot()`（加在 `src/ui/levelSelect.js`）

标题用 `title(ctx, '成都保卫战', view.w/2, L.header.titleY, 46)` 居中绘制，字体 `FONT.head(46)`（STKaiti，无字间距）。「卫」是 5 字中第 4 个（index 3）。

```js
// 返回「卫」字形屏幕矩形 {x,y,w,h}（含触控外扩）；无任何视觉绘制
// TITLE_PX 与 drawLevelSelect 内 title(...,46) 同源；如改标题字号需同步
const TITLE_PX = 46;
export function cheatHotspot(ctx, view, levels, chapterIdx) {
  const L = levelSelectLayout(view, levels, chapterIdx); // 仅取 header.titleY
  ctx.save();
  ctx.font = FONT.head(TITLE_PX);
  const full = ctx.measureText('成都保卫战').width;
  const before = ctx.measureText('成都保').width;
  const w = ctx.measureText('卫').width;
  ctx.restore();
  const left = view.w / 2 - full / 2;
  const pad = 6;
  return { x: left + before - pad, y: L.header.titleY - TITLE_PX / 2 - pad, w: w + pad * 2, h: TITLE_PX + pad * 2 };
}
```

- 高度 46 居中于 `titleY`（±23），副标题在 `titleY+50`，间隙充足，**不重叠**。
- 隐藏：不画任何提示，外观与现在完全一致。
- `cheatHotspot(ctx, view, levels, chapterIdx)`：main.js 调用时传 `LEVELS`；`TITLE_PX` 常量与标题字号单一来源，避免漂移。

### ③ 作弊面板 `src/ui/cheatPanel.js`（新建，layout/hit/draw 单一来源，木牌风格，模态盖在选关屏）

```
┌──────── 作弊菜单 ────────┐
│  解锁所有关卡   [开/关]  [还原] │   行1
│  初始金币: 9999/未设 [设置][还原]│   行2
│  解锁所有武将   [开/关]        │   行3（切换式）
│         [  关闭  ]          │
└────────────────────────┘
```

- `cheatPanelLayout(view)` → 居中木牌面板矩形 + 各按钮矩形（行1 解锁/还原、行2 设置/还原、行3 切换、关闭）。
- `hitCheatPanel(view, sx, sy)` → 返回 action：`'levels-on' | 'levels-off' | 'gold-set' | 'gold-off' | 'generals-toggle' | 'close' | 'panel'`（`'panel'`=点在面板内空白，吞掉点击，模态不穿透）。
- `drawCheatPanel(ctx, view, cheats)` → 用 `theme.js` 的 `panel/button/roundRect/FONT/PAL` 绘制；按钮态反映 `cheats`（开/关高亮，金币显示当前值或「未设」）。
- 复用既有主题组件，风格与暂停菜单 / 选关一致。

### ④ main.js 装配

- 模块级新增：`let cheats = defaultCheats();`、`let cheatOpen = false;`（**纯内存，刷新即还原**）。
- **选关屏点击顺序**（`onPointerDown` 内 `screen === 'select'` 分支）：
  1. 若 `cheatOpen` → `hitCheatPanel`，按 action 改 `cheats` / 弹 prompt / 关闭；**消费点击**（模态）。
  2. 否则先判 `cheatHotspot` 命中 → `window.prompt('请输入作弊密码')`，`(v||'').trim() === '111'` → `cheatOpen = true`；错 / 取消 → 静默返回（热区仍隐藏）。
  3. 否则走原 `hitLevelSelect`（关卡 / 章节导航）。
- **选关 draw / hit 传 shim save**：`const selSave = cheats.allLevels ? { ...save, unlockedLevel: LEVELS.length } : save;` 传入 `drawLevelSelect` / `hitLevelSelect`。`levelSelect.js` 内部零改。
- **`enterLevel(n)`**：`unlocked` 改用 `effectiveRoster(save, cheats, Object.keys(GENERALS))`；`Object.assign(state, newGameState(...))` 之后追加 `if (cheats.goldOverride != null) state.gold = cheats.goldOverride;`（等价于 `effectiveStartGold`）。
- **故事屏 roster**：`makeStoryState` 内 `unlockedGenerals(save)` 同样改 `effectiveRoster(...)`，使「点将」与作弊一致。
- **金币输入**：`'gold-set'` action → `const v = window.prompt('设置初始金币（留空取消）', cheats.goldOverride ?? '');` → `const n = parseInt(v, 10);` → `if (Number.isInteger(n) && n >= 0) cheats.goldOverride = n;`（空 / NaN / 负 → 不变）。
- **render**：`screen === 'select'` 时，`drawLevelSelect` 后若 `cheatOpen` 再 `drawCheatPanel`。
- **QA 钩子**：`window.__td.cheats`（getter 返回 `cheats`）、可选 `window.__td.openCheat = () => { cheatOpen = true; }` 供冒烟绕过 prompt。

### 还原语义

| 操作 | 效果 |
|---|---|
| 解锁所有关卡 → 还原 | `cheats.allLevels = false`（真实进度无损，关卡按 `save.unlockedLevel` 重新上锁） |
| 初始金币 → 还原 | `cheats.goldOverride = null`（回关卡默认 `startGold`） |
| 一键解锁所有武将 | 切换式：开 `allGenerals=true`，再点关；刷新也自动还原 |

### 边界与不变量

- 密码错 / 取消 → 静默，热区保持隐藏，不开面板。
- 金币 `NaN` / 负数 / 空 → 忽略，保持原值。
- `cheats` 是**只读叠加**，从不写 `save`；真打通关时 `applyClear` 照常写真实星数 / unlockedLevel（玩家确实赢了的进度合法保留）。
- 金币 override **只作用于全新 `enterLevel`**，**不覆盖续玩** `applyResume`（resume 用快照自身的中盘金币，避免「续玩瞬间回满金币」）。
- 作弊面板模态：打开时章节导航 / 关卡点击被吞，避免误触。
- 全屏 ⛶ 按钮：现有 `onPointerDown` 首行已优先消费 `hitHud === 'fs'`，位于作弊判定之前，互不影响。

### 测试

- `tests/cheats.test.mjs`（新）：4 个纯函数——
  - `effectiveUnlockedLevel`：`allLevels` 真→返回 total，假→返回 `save.unlockedLevel`。
  - `effectiveRoster`：`allGenerals` 真→返回含全部 id 的 Set，假→等于 `unlockedGenerals(save)`。
  - `effectiveStartGold`：`goldOverride` 为 `0`（边界）/正数→覆盖，`null`→原值。
  - `defaultCheats`：三字段初值。
- `tests/cheatPanel.test.mjs`（新）：`hitCheatPanel` 对各按钮矩形中心返回正确 action；面板内空白返回 `'panel'`；面板外返回 `null`；`cheatPanelLayout` 矩形不重叠。
- `tests/levelSelect.test.mjs`（改）：`cheatHotspot` 返回矩形落在标题带内（`y+h < header.chapterY`，不压副标题）、水平位置对应第 4 字（中心 > view.w/2）。
- `tests/buildBar.test.mjs`（改）：见功能1。

## 风险

- **measureText 字体回退**：测试环境若无 STKaiti，`measureText` 用回退字体，宽度数值不同但**比例与命中逻辑成立**（热区仍覆盖第 4 字相对位置）；断言用相对关系（中心 > 中线、不压副标题）而非绝对像素，规避字体差异。
- **prompt 在某些环境被拦截**：James 目标设备 iPad Safari / Mac 均支持 `window.prompt`；冒烟用 `__td.openCheat` + 直接置 `cheats` 字段绕过，不依赖 prompt。
- **12 将单行在窄屏更小**：仅影响 < iPad 的窄屏（本游戏面向 iPad/Mac），且为已存在的自适应行为，非回归。

## 验收标准

1. 新档（第1章）底部建造栏即显示 12 将，五虎+诸葛为锁定态（🔒 + 解锁提示），点之不可建、热键不选中。
2. 选关页点「卫」字 → 弹框输 `111` → 出木牌作弊菜单；输错 / 取消无反应且外观无变化。
3. 解锁所有关卡：全 50 关可点可进；还原后回真实进度。武将不被连带解锁。
4. 一键解锁所有武将：建造栏全 12 将可建、可用热键；不连带解锁关卡。
5. 设置初始金币 N：之后进关起始金币 = N；还原后回关卡默认值；续玩不受影响。
6. 刷新页面 → 作弊全部失效，回真实进度 / 默认金币。
7. 全部既有测试 + 新增测试通过；`tools` 经济 / winnable 门禁不受影响（作弊不进存档、不改数据）。
