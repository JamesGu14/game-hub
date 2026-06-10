# 炮炮虫 BOOM WORMS — M1（选关 + 15 关骨架）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把炮炮虫从「6 关、无选关」升级为「15 关、闯关路线图选关」，目标全为 `eliminate`、`hazards` 全空，但 15 关可选可逐关打通 —— 为 M2（致命地形）/ M3（关卡目标）预留好全部接口，零返工。

**Architecture:** 纯数据层（`levels.js` 6→15 + `objective`/`hazards` 字段）+ 纯逻辑层（`progress.js` 解锁计算、`turns.js`/`physics.js` 向后兼容签名）+ DOM 选关界面（新 `overlay-levelselect`，作为新的 `game.state === 'levelselect'`，复用现有 overlay 体系）。可单测的逻辑走 node:test TDD；DOM/视觉走 puppeteer smoke + 手动清单（spec §11.9 三层）。

**Tech Stack:** Vanilla JS ES modules、HTML5 canvas、`node:test`（无 DOM 纯逻辑）、puppeteer-core + 系统 Chrome（浏览器 smoke）。无构建、无 `package.json` —— 测试用 `node --test` 直接跑 `.mjs`。

**权威来源：** `docs/superpowers/specs/2026-06-07-boom-worms-level-select-and-15-levels-design.md`，尤其 **§8（里程碑）/§9（15 关表）/§11（实现参数）/§11.13（M1 必做接口预留）**。

**纪律（James 约定）：**
- 当前在 `develop` 分支，commit 到 `develop`。
- 每个 task 末尾 `git add` **只列 boom-worms 文件**，绝不 `git add -A` —— 工作区里 pixel-quest / tower-defender 的改动与本任务无关，不要碰。
- commit message 结尾加：`Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- checkpoint-driven：每 task 测试绿 + 可独立 commit；UI 任务后浏览器实玩可通。

---

## File Structure

| 文件 | 角色 | 本计划改动 |
|------|------|-----------|
| `games/boom-worms/src/progress.js` | **新建** · 纯解锁逻辑（无 DOM/storage） | Task 1 |
| `games/boom-worms/tests/progress.test.mjs` | **新建** · progress 单测 | Task 1 |
| `games/boom-worms/src/config.js` | 常量 | Task 2：`STORAGE_KEY` → v2 |
| `games/boom-worms/src/levels.js` | 关卡数据 + `buildLevel` | Task 2：6→15 关、加 `objective`/`hazards`、`buildLevel` 转发 |
| `games/boom-worms/src/terrain.js` | 地形生成 + 顶纹 | Task 2：`_toppingColor` 支持 9 新主题 |
| `games/boom-worms/tests/levels.test.mjs` | 关卡数据单测 | Task 2：重写为 15 关 |
| `games/boom-worms/src/turns.js` | 胜负判定 | Task 3：`checkOutcome` 三参默认签名（向后兼容） |
| `games/boom-worms/tests/turns.test.mjs` | turns 单测 | Task 3：加向后兼容 + 三参用例 |
| `games/boom-worms/src/physics.js` | worm 物理 | Task 4：`stepWorm` opts 预留 `hazards = []` |
| `games/boom-worms/tests/physics.test.mjs` | physics 单测 | Task 4：加 hazards 预留不改行为用例 |
| `games/boom-worms/src/game.js` | 状态机 | Task 5：import `LEVELS`、`nextLevel` 解硬编码、加 `showLevelSelect()` |
| `games/boom-worms/index.html` | DOM 结构 | Task 6：加 `overlay-levelselect`、清空 `win-msg` |
| `games/boom-worms/style.css` | 样式 | Task 6：选关路线图样式 |
| `games/boom-worms/src/main.js` | 引导 + overlay 同步 + 按钮 | Task 6：选关流程、节点注入、`win-msg` 动态 |
| `games/boom-worms/tests/smoke-m1.mjs` | **新建** · 加载级 puppeteer smoke | Task 7 |

---

## Task 1: 纯解锁逻辑 `progress.js`（TDD）

选关界面的「已通关 / 下一关 / 锁定」判定抽成无副作用纯函数，便于单测（spec §7 的 `unlock` 测试要求）。`best` = 已通关最高关（1-based，0=未通关）；`total` = `LEVELS.length`。

**Files:**
- Create: `games/boom-worms/tests/progress.test.mjs`
- Create: `games/boom-worms/src/progress.js`

- [ ] **Step 1: 写失败测试**

Create `games/boom-worms/tests/progress.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxPlayableLevel, isPlayable, levelNodeState } from '../src/progress.js';

const TOTAL = 15;

test('maxPlayableLevel: 未通关 → 只有第 1 关可玩', () => {
  assert.equal(maxPlayableLevel(0, TOTAL), 1);
});

test('maxPlayableLevel: 中段进度 → 已通关 + 下一关', () => {
  assert.equal(maxPlayableLevel(7, TOTAL), 8);
});

test('maxPlayableLevel: 全通关 → 封顶在 total（没有第 16 关）', () => {
  assert.equal(maxPlayableLevel(15, TOTAL), 15);
});

test('maxPlayableLevel: 越界/损坏存档被 clamp', () => {
  assert.equal(maxPlayableLevel(99, TOTAL), 15);
  assert.equal(maxPlayableLevel(-3, TOTAL), 1);
});

test('isPlayable: 边界 —— 下一关可玩，再往后不可玩', () => {
  assert.equal(isPlayable(8, 7, TOTAL), true);   // next
  assert.equal(isPlayable(9, 7, TOTAL), false);  // locked
  assert.equal(isPlayable(1, 0, TOTAL), true);
  assert.equal(isPlayable(0, 0, TOTAL), false);  // 没有第 0 关
});

test('levelNodeState: cleared / next / locked', () => {
  assert.equal(levelNodeState(3, 5, TOTAL), 'cleared');
  assert.equal(levelNodeState(5, 5, TOTAL), 'cleared');
  assert.equal(levelNodeState(6, 5, TOTAL), 'next');
  assert.equal(levelNodeState(7, 5, TOTAL), 'locked');
});

test('levelNodeState: 全通关 → 每个节点都 cleared、没有 next', () => {
  for (let n = 1; n <= TOTAL; n++) assert.equal(levelNodeState(n, 15, TOTAL), 'cleared');
});

test('levelNodeState: 新存档 → 第 1 关 next、其余 locked', () => {
  assert.equal(levelNodeState(1, 0, TOTAL), 'next');
  for (let n = 2; n <= TOTAL; n++) assert.equal(levelNodeState(n, 0, TOTAL), 'locked');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test games/boom-worms/tests/progress.test.mjs`
Expected: FAIL —— `Cannot find module '.../src/progress.js'`

- [ ] **Step 3: 写最小实现**

Create `games/boom-worms/src/progress.js`:

```js
// Pure progress / unlock logic for the level-select route map. No DOM, no storage.
// `best`  = highest cleared level (1-based; 0 = none cleared).
// `total` = number of levels (LEVELS.length).

// Clamp a possibly-stale / corrupt saved value into [0, total].
function _clampBest(best, total) {
  const b = Math.floor(Number(best) || 0);
  return Math.max(0, Math.min(b, total));
}

// Highest level (1-based) the player may currently enter: cleared ones + the next.
export function maxPlayableLevel(best, total) {
  return Math.min(_clampBest(best, total) + 1, total);
}

// Whether level `num` (1-based) is currently playable.
export function isPlayable(num, best, total) {
  return num >= 1 && num <= maxPlayableLevel(best, total);
}

// Node state for the route map: 'cleared' | 'next' | 'locked'.
export function levelNodeState(num, best, total) {
  const b = _clampBest(best, total);
  if (num <= b) return 'cleared';
  if (num === b + 1 && num <= total) return 'next';
  return 'locked';
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test games/boom-worms/tests/progress.test.mjs`
Expected: PASS（8 tests）

- [ ] **Step 5: Commit**

```bash
git add games/boom-worms/src/progress.js games/boom-worms/tests/progress.test.mjs
git commit -m "$(cat <<'EOF'
feat(boom-worms): pure level-unlock logic (progress.js) + tests

M1 选关基础：maxPlayableLevel / isPlayable / levelNodeState 纯函数，
含越界存档 clamp。无 DOM/storage，供 main.js 选关界面与单测复用。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 15 关数据 + v2 存档 + 主题顶纹（TDD + 视觉）

把 `LEVELS` 从 6 扩到 15，每关加 `objective`（M1 全 `eliminate`）和 `hazards`（M1 全 `{}`）；`buildLevel` 转发这两个字段；`STORAGE_KEY` 换 v2 让老存档自然失效（spec §11.1 重置）；`terrain.js` 的 `_toppingColor` 支持 9 个新主题。

主题/配色/`terrainParams`/`enemyCount`/`aiError` 均为**最终值**（不依赖 hazard/objective）；`aiError` 严格按 spec §11.12 值表。

**Files:**
- Modify: `games/boom-worms/src/config.js:38`
- Modify: `games/boom-worms/src/levels.js`（替换 `LEVELS` + `buildLevel` 返回体）
- Modify: `games/boom-worms/src/terrain.js`（`_toppingColor` + `_paintTopping` 传 theme）
- Test: `games/boom-worms/tests/levels.test.mjs`（重写）

- [ ] **Step 1: 重写 levels.test.mjs 为 15 关（失败测试）**

Replace the **entire** contents of `games/boom-worms/tests/levels.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildLevel } from '../src/levels.js';
import { FIELD } from '../src/config.js';

const VALID_OBJECTIVES = ['eliminate', 'timed', 'capture', 'decapitate'];

test('there are 15 levels', () => {
  assert.equal(LEVELS.length, 15);
});

test('aiError is monotonic non-increasing (later levels = sharper AI)', () => {
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].aiError <= LEVELS[i - 1].aiError,
      `level ${i + 1} aiError ${LEVELS[i].aiError} > level ${i} ${LEVELS[i - 1].aiError}`);
  }
});

test('aiError spans the full difficulty ramp (≈0.9 → ≈0.08)', () => {
  assert.ok(LEVELS[0].aiError >= 0.85, 'first level should be very forgiving');
  assert.ok(LEVELS[LEVELS.length - 1].aiError <= 0.12, 'last level should be sharp');
});

test('every level has a complete 6-hex palette', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const p = LEVELS[i].palette;
    for (const k of ['sky', 'land', 'land2', 'water']) {
      assert.ok(typeof p[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(p[k]),
        `level ${i + 1} palette.${k} invalid: ${p[k]}`);
    }
  }
});

test('every level has a unique theme', () => {
  const themes = LEVELS.map((l) => l.theme);
  assert.equal(new Set(themes).size, themes.length, 'theme names must be unique');
});

test('every level has valid terrainParams (ruggedness 0..1, peaks ≥ 1, counts ≥ 0)', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const tp = LEVELS[i].terrainParams;
    assert.ok(tp.ruggedness >= 0 && tp.ruggedness <= 1, `level ${i + 1} ruggedness`);
    assert.ok(Number.isInteger(tp.peaks) && tp.peaks >= 1, `level ${i + 1} peaks`);
    for (const k of ['platforms', 'caves', 'floors']) {
      assert.ok(Number.isInteger(tp[k]) && tp[k] >= 0, `level ${i + 1} ${k}`);
    }
  }
});

test('every level has a structurally valid objective and a hazards bag', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const o = LEVELS[i].objective;
    assert.ok(o && VALID_OBJECTIVES.includes(o.type), `level ${i + 1} objective.type invalid`);
    assert.ok(LEVELS[i].hazards && typeof LEVELS[i].hazards === 'object' && !Array.isArray(LEVELS[i].hazards),
      `level ${i + 1} hazards must be a plain object`);
  }
});

test('enemyCount is sane and the campaign gets more crowded', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].enemyCount >= 2 && LEVELS[i].enemyCount <= 6, `level ${i + 1} enemyCount`);
    assert.ok(LEVELS[i].playerCount >= 2, `level ${i + 1} playerCount`);
  }
  assert.ok(LEVELS[LEVELS.length - 1].enemyCount >= LEVELS[0].enemyCount);
});

test('buildLevel resolves spawns in-field, matching counts, and forwards data', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const lv = buildLevel(i);
    assert.equal(lv.index, i);
    assert.equal(lv.spawns[0].length, lv.playerCount, `level ${i + 1} player spawns`);
    assert.equal(lv.spawns[1].length, lv.enemyCount, `level ${i + 1} enemy spawns`);
    for (const arr of [lv.spawns[0], lv.spawns[1]])
      for (const x of arr) assert.ok(x > 0 && x < FIELD.W, `level ${i + 1} spawn x ${x} out of field`);
    assert.ok(lv.waterY > 0 && lv.waterY <= FIELD.H);
    // objective + hazards forwarded for M2/M3
    assert.deepEqual(lv.objective, LEVELS[i].objective);
    assert.deepEqual(lv.hazards, LEVELS[i].hazards);
    // terrainParams passed through by reference (terrain.generate reads them)
    assert.equal(lv.terrainParams, LEVELS[i].terrainParams);
  }
});

test('final level is at least as rugged as the first (rising challenge)', () => {
  assert.ok(LEVELS[LEVELS.length - 1].terrainParams.ruggedness >= LEVELS[0].terrainParams.ruggedness);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test games/boom-worms/tests/levels.test.mjs`
Expected: FAIL —— `there are 15 levels` 断言失败（当前 6 关），以及 objective/hazards 相关断言失败。

- [ ] **Step 3: `config.js` 换存档 key（v2 重置）**

In `games/boom-worms/src/config.js`, change line 38:

old:
```js
export const STORAGE_KEY = 'boom-worms-progress';
```
new:
```js
export const STORAGE_KEY = 'boom-worms-progress-v2'; // bumped for the 15-level reset (spec §11.1)
```

- [ ] **Step 4: 重写 `levels.js` 的 `LEVELS`（6→15）**

Replace the `export const LEVELS = [ ... ];` array (lines 4–65) with the 15-level data below. `aiError` 严格按 spec §11.12；M1 `objective` 全 `eliminate`、`hazards` 全 `{}`（注释标注 M2/M3 将填什么）：

```js
export const LEVELS = [
  // 1 · 绿草训练场 — 入门 · 平缓教学
  {
    name: '绿草训练场', theme: 'grass',
    palette: { sky: '#87ceeb', land: '#5a8a3c', land2: '#3d6b24', water: '#1a6db5' },
    terrainParams: { ruggedness: 0.28, peaks: 3, platforms: 1, caves: 0, floors: 0 },
    playerCount: 3, enemyCount: 2, aiError: 0.90, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 2 · 糖果乐园 — 入门 · 平台
  {
    name: '糖果乐园', theme: 'candy',
    palette: { sky: '#ffb3d9', land: '#ff69b4', land2: '#c2185b', water: '#80deea' },
    terrainParams: { ruggedness: 0.42, peaks: 4, platforms: 2, caves: 0, floors: 0 },
    playerCount: 3, enemyCount: 3, aiError: 0.80, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 3 · 阳光海滩 — 简单 · 缓坡 + 水
  {
    name: '阳光海滩', theme: 'beach',
    palette: { sky: '#87ceeb', land: '#e8c97a', land2: '#c9a84c', water: '#1a8fc7' },
    terrainParams: { ruggedness: 0.38, peaks: 3, platforms: 1, caves: 0, floors: 0 },
    playerCount: 3, enemyCount: 3, aiError: 0.70, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 4 · 神秘丛林 — 简单 · 洞穴 + 楼层   (M3: objective→timed)
  {
    name: '神秘丛林', theme: 'jungle',
    palette: { sky: '#2d5a27', land: '#1a7a1a', land2: '#0f5c0f', water: '#1a5c3a' },
    terrainParams: { ruggedness: 0.55, peaks: 5, platforms: 3, caves: 2, floors: 3 },
    playerCount: 3, enemyCount: 3, aiError: 0.62, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 5 · 溶洞深渊 — 进阶 · 尖刺首秀   (M2: hazards.spikes)
  {
    name: '溶洞深渊', theme: 'cave',
    palette: { sky: '#241d33', land: '#6b5a7a', land2: '#46384f', water: '#16263a' },
    terrainParams: { ruggedness: 0.52, peaks: 4, platforms: 2, caves: 3, floors: 2 },
    playerCount: 3, enemyCount: 3, aiError: 0.55, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 6 · 火山熔岩 — 进阶 · 熔岩池   (M2: hazards.lava, M3: objective→decapitate)
  {
    name: '火山熔岩', theme: 'volcano',
    palette: { sky: '#3a1410', land: '#6e3b2a', land2: '#4a2418', water: '#2a0a06' },
    terrainParams: { ruggedness: 0.62, peaks: 5, platforms: 2, caves: 1, floors: 2 },
    playerCount: 3, enemyCount: 3, aiError: 0.48, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 7 · 云端天空 — 进阶 · 多浮空平台   (M3: objective→capture)
  {
    name: '云端天空', theme: 'sky',
    palette: { sky: '#b3d9ff', land: '#ffffff', land2: '#d0e8ff', water: '#4a90d9' },
    terrainParams: { ruggedness: 0.48, peaks: 4, platforms: 4, caves: 0, floors: 4 },
    playerCount: 3, enemyCount: 3, aiError: 0.42, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 8 · 冰雪世界 — 困难 · 冰面打滑   (M2: hazards.ice)
  {
    name: '冰雪世界', theme: 'ice',
    palette: { sky: '#cfe8f5', land: '#bfe0ec', land2: '#8fc0d8', water: '#3a7aa0' },
    terrainParams: { ruggedness: 0.45, peaks: 4, platforms: 3, caves: 0, floors: 3 },
    playerCount: 3, enemyCount: 4, aiError: 0.37, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 9 · 沙漠绿洲 — 困难 · 沙丘起伏
  {
    name: '沙漠绿洲', theme: 'desert',
    palette: { sky: '#f0d9a8', land: '#d8a85a', land2: '#b0824a', water: '#2a9ec0' },
    terrainParams: { ruggedness: 0.50, peaks: 5, platforms: 2, caves: 0, floors: 2 },
    playerCount: 3, enemyCount: 4, aiError: 0.32, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 10 · 毒沼泽 — 困难 · 酸水 + 楼层   (M2: hazards.acid)
  {
    name: '毒沼泽', theme: 'swamp',
    palette: { sky: '#34402f', land: '#5a7a3c', land2: '#3a5424', water: '#5f7a1f' },
    terrainParams: { ruggedness: 0.42, peaks: 4, platforms: 2, caves: 1, floors: 4 },
    playerCount: 3, enemyCount: 4, aiError: 0.28, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 11 · 机关工厂 — 精英 · 弹床 + 迷宫   (M2: hazards.bounce, M3: objective→capture)
  {
    name: '机关工厂', theme: 'factory',
    palette: { sky: '#33333f', land: '#7a7a8a', land2: '#55555f', water: '#23303f' },
    terrainParams: { ruggedness: 0.50, peaks: 4, platforms: 4, caves: 1, floors: 4 },
    playerCount: 3, enemyCount: 4, aiError: 0.24, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 12 · 黄昏废墟 — 精英 · 尖刺 + 熔岩   (M2: hazards.spikes+lava, M3: objective→decapitate)
  {
    name: '黄昏废墟', theme: 'ruins',
    palette: { sky: '#5a3a32', land: '#8a6a4a', land2: '#5e4632', water: '#352636' },
    terrainParams: { ruggedness: 0.60, peaks: 5, platforms: 3, caves: 2, floors: 3 },
    playerCount: 3, enemyCount: 4, aiError: 0.20, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 13 · 暗夜墓园 — 精英 · 冰面 + 洞穴   (M2: hazards.ice, M3: objective→timed)
  {
    name: '暗夜墓园', theme: 'night',
    palette: { sky: '#16163a', land: '#46466a', land2: '#2a2a4a', water: '#141426' },
    terrainParams: { ruggedness: 0.55, peaks: 5, platforms: 2, caves: 3, floors: 2 },
    playerCount: 3, enemyCount: 5, aiError: 0.16, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 14 · 彩虹山 — 地狱 · 崎岖 + 楼层
  {
    name: '彩虹山', theme: 'rainbow',
    palette: { sky: '#1a0533', land: '#9b59b6', land2: '#6c3483', water: '#1a0a2e' },
    terrainParams: { ruggedness: 0.80, peaks: 6, platforms: 2, caves: 2, floors: 5 },
    playerCount: 3, enemyCount: 5, aiError: 0.12, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 15 · 终焉决战 — 地狱 · 熔岩 + 弹床   (M2: hazards.lava+bounce, M3: objective→decapitate)
  {
    name: '终焉决战', theme: 'finale',
    palette: { sky: '#2a0a1a', land: '#7a2a3a', land2: '#561a28', water: '#16060f' },
    terrainParams: { ruggedness: 0.78, peaks: 6, platforms: 3, caves: 2, floors: 5 },
    playerCount: 3, enemyCount: 5, aiError: 0.08, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
];
```

- [ ] **Step 5: `buildLevel` 转发 `objective` / `hazards`**

In `games/boom-worms/src/levels.js`, in the `return { ... }` of `buildLevel` (currently lines 86–98), add two fields after `spawns,`:

old:
```js
    waterY: WATER.defaultY,
    spawns,
  };
```
new:
```js
    waterY: WATER.defaultY,
    spawns,
    objective: lv.objective ?? { type: 'eliminate' },  // forwarded for M3 checkOutcome
    hazards: lv.hazards ?? {},                          // forwarded for M2 terrain/physics
  };
```

- [ ] **Step 6: 跑 levels 测试确认通过**

Run: `node --test games/boom-worms/tests/levels.test.mjs`
Expected: PASS（10 tests）

- [ ] **Step 7: `terrain.js` 的 `_toppingColor` 支持 9 新主题**

`_toppingColor` 改为按 `theme` 取色（现有 `map` 对象本就按主题键、却被无视 —— 现在真正用它），保留旧的 land-color 兜底。三处改动：

(a) Replace the whole `_toppingColor` function (currently lines 398–415):

old:
```js
function _toppingColor(palette) {
  // Pick a bright accent for the terrain top stripe based on theme
  const map = {
    grass: '#7ec850',
    candy: '#ff9fce',
    beach: '#f5d479',
    jungle: '#39b54a',
    sky: '#e8f4ff',
    rainbow: '#c678dd',
  };
  // Try to detect theme from palette sky color heuristic, fall back to land
  if (palette.land === '#ffffff') return '#d0eaff';      // sky theme
  if (palette.land === '#e8c97a') return '#f5d479';      // beach
  if (palette.land === '#ff69b4') return '#ffb3d9';      // candy
  if (palette.land === '#1a7a1a') return '#39b54a';      // jungle
  if (palette.land === '#9b59b6') return '#c678dd';      // rainbow
  return '#7ec850';                                       // grass default
}
```
new:
```js
function _toppingColor(palette, theme) {
  // Bright accent stripe painted on solid tops — one entry per level theme (spec §4).
  const map = {
    grass: '#7ec850', candy: '#ff9fce', beach: '#f5d479', jungle: '#39b54a',
    sky: '#e8f4ff', rainbow: '#c678dd',
    cave: '#8a78a0', volcano: '#ff7a3c', ice: '#dff2fb', desert: '#f0c878',
    swamp: '#9ada4a', factory: '#aab0c0', ruins: '#c9a878', night: '#7a7ac0',
    finale: '#ff5a6a',
  };
  if (theme && map[theme]) return map[theme];
  // Legacy fallback: detect by land color (kept so a theme-less call still works).
  if (palette.land === '#ffffff') return '#d0eaff';
  if (palette.land === '#e8c97a') return '#f5d479';
  if (palette.land === '#ff69b4') return '#ffb3d9';
  if (palette.land === '#1a7a1a') return '#39b54a';
  if (palette.land === '#9b59b6') return '#c678dd';
  return '#7ec850';
}
```

(b) In `generate()`, pass the theme to `_paintTopping`. Change line 133:

old:
```js
    this._paintTopping(palette);
```
new:
```js
    this._paintTopping(palette, level.theme);
```

(c) In `_paintTopping`, accept `theme` and pass it through. Change the signature (line 285) and the `_toppingColor` call (line 290):

old:
```js
  _paintTopping(palette) {
```
new:
```js
  _paintTopping(palette, theme) {
```

old:
```js
    const topColor = _toppingColor(palette);
```
new:
```js
    const topColor = _toppingColor(palette, theme);
```

- [ ] **Step 8: 静态检查 + 全 node 测试不回归**

Run: `node --check games/boom-worms/src/terrain.js && node --check games/boom-worms/src/levels.js && node --check games/boom-worms/src/config.js`
Expected: 无输出（语法 OK）

Run: `node --test games/boom-worms/tests/*.mjs`
Expected: 全绿（levels + progress + 现有 ai/aim/combat/math/physics/terrain/trajectory/turns）。注：`terrain.test.mjs` 只测纯 mask helper，不碰 `_toppingColor`，不受影响。

> 顶纹的视觉正确性（9 新主题各自颜色）属视觉项，在 Task 7 浏览器 smoke / 手动清单验证。

- [ ] **Step 9: Commit**

```bash
git add games/boom-worms/src/config.js games/boom-worms/src/levels.js \
        games/boom-worms/src/terrain.js games/boom-worms/tests/levels.test.mjs
git commit -m "$(cat <<'EOF'
feat(boom-worms): 15-level campaign data + v2 save reset + theme toppings

- LEVELS 6→15（9 新主题：cave/volcano/ice/desert/swamp/factory/ruins/night/finale）
- 每关加 objective(M1 全 eliminate) / hazards(M1 全 {})；buildLevel 转发
- aiError 按 spec §11.12 值表（0.90→0.08 单调）
- STORAGE_KEY → v2（老存档自然失效＝进度重置，spec §11.1）
- _toppingColor 按 theme 取色（含 9 新主题），保留 land-color 兜底
- levels.test 重写为 15 关数据完整性校验

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `checkOutcome` 三参默认签名（TDD，向后兼容）

把 `checkOutcome(teams)` 升级为 `checkOutcome(teams, objective = {type:'eliminate'}, state = {})`（spec §11.7）。M1 只实现 `eliminate`（= 现有逻辑），`objective`/`state` 参数先就位、暂不使用，让 M3 不必改签名也不必改现有调用点。

**Files:**
- Modify: `games/boom-worms/src/turns.js:18-23`
- Test: `games/boom-worms/tests/turns.test.mjs`（追加用例）

- [ ] **Step 1: 追加测试（先红）**

Append to the end of `games/boom-worms/tests/turns.test.mjs`:

```js
test('checkOutcome stays backward-compatible with the single-arg call', () => {
  // 现有调用点（game.js _updateResolve）只传 teams；默认参数必须保持旧行为。
  assert.equal(checkOutcome(teams([false, false], [true])), 1);
  assert.equal(checkOutcome(teams([true], [false])), 0);
  assert.equal(checkOutcome(teams([true], [true])), null);
  assert.equal(checkOutcome(teams([false], [false])), -1);
});

test('checkOutcome accepts the explicit eliminate objective + state (3-arg, §11.7)', () => {
  const obj = { type: 'eliminate' };
  assert.equal(checkOutcome(teams([true], [false]), obj, { turnCount: 3 }), 0);
  assert.equal(checkOutcome(teams([false], [false]), obj, {}), -1);
  assert.equal(checkOutcome(teams([true], [true]), obj), null);
});
```

- [ ] **Step 2: 跑测试确认现状**

Run: `node --test games/boom-worms/tests/turns.test.mjs`
Expected: 前两个新用例 PASS（单参仍工作），第二个新用例 PASS 也可能（现签名忽略多余实参）。**关键**：此步确保追加用例语法正确、且不破坏现有 3 个用例。若全绿也 OK —— 重点是 Step 3 把签名显式化、加注释锁定契约。

> 说明：JS 多余实参被忽略，所以三参调用在改签名前“碰巧”能过。Step 3 的价值是把契约写进签名与注释，并让 `objective`/`state` 成为正式入参，供 M3 扩展。

- [ ] **Step 3: 更新 `checkOutcome` 签名**

In `games/boom-worms/src/turns.js`, replace lines 18–23:

old:
```js
export function checkOutcome(teams) {
  const live = teams.filter((t) => t.worms.some((w) => w.alive));
  if (live.length === 1) return live[0].id;
  if (live.length === 0) return -1; // draw
  return null;
}
```
new:
```js
// Decide a round's outcome: returns winning team id (0|1), -1 draw, or null = continue.
// M1 implements only the `eliminate` objective (= last team standing). The objective
// and state params are accepted now (forward-compatible signature, spec §11.7) so M3
// can add timed / capture / decapitate branches without touching call sites. They are
// intentionally unused in M1.
export function checkOutcome(teams, objective = { type: 'eliminate' }, state = {}) {
  const live = teams.filter((t) => t.worms.some((w) => w.alive));
  if (live.length === 1) return live[0].id;
  if (live.length === 0) return -1; // draw
  return null;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test games/boom-worms/tests/turns.test.mjs`
Expected: PASS（原 3 + 新 2 = 5 tests）

- [ ] **Step 5: Commit**

```bash
git add games/boom-worms/src/turns.js games/boom-worms/tests/turns.test.mjs
git commit -m "$(cat <<'EOF'
feat(boom-worms): forward-compatible checkOutcome(teams, objective, state)

三参默认签名（spec §11.7）：M1 仅实现 eliminate（=现状），objective/state
先就位供 M3 timed/capture/decapitate 扩展。单参调用向后兼容，现有调用点不动。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `stepWorm` 预留 `hazards` 入参（TDD，非破坏）

`stepWorm` 的 `opts` 解构加 `hazards = []`（spec §11.13）。`opts` 是对象，加可选字段属**非破坏性**变更；M1 不使用 `hazards`，但所有 5 处调用点已天然 M2-ready。

**Files:**
- Modify: `games/boom-worms/src/physics.js:10`
- Test: `games/boom-worms/tests/physics.test.mjs`（追加用例）

- [ ] **Step 1: 追加测试（先验证现状）**

Append to the end of `games/boom-worms/tests/physics.test.mjs`（该文件已 `import { stepWorm } from '../src/physics.js'`；若未导入则补一行）：

```js
test('stepWorm accepts a reserved hazards option without changing behavior (§11.13)', () => {
  // 空 mask（全 0）→ 无实体，worm 自由下落；对比有无 hazards:[] 两次步进结果一致。
  const mask = { w: 400, h: 400, cells: new Uint8Array(400 * 400) };
  const mk = () => ({ alive: true, hp: 100, x: 100, y: 100, vx: 0, vy: 0, facing: 1, onGround: false });
  const a = mk();
  const b = mk();
  stepWorm(a, 0.016, mask, { waterY: 9999, moveX: 1 });
  stepWorm(b, 0.016, mask, { waterY: 9999, moveX: 1, hazards: [] });
  assert.equal(a.x, b.x);
  assert.equal(a.y, b.y);
  assert.equal(a.vx, b.vx);
  assert.equal(a.vy, b.vy);
});
```

- [ ] **Step 2: 跑测试**

Run: `node --test games/boom-worms/tests/physics.test.mjs`
Expected: PASS（现签名忽略多余 `hazards` key，两次结果本就一致）。此步确认用例正确、不回归。

- [ ] **Step 3: 把 `hazards` 显式纳入 opts 解构**

In `games/boom-worms/src/physics.js`, change line 10:

old:
```js
  const { waterY, moveX = 0, wantJump = false } = opts;
```
new:
```js
  // `hazards` reserved for M2 (ice friction / bounce / lava / acid / spikes). Destructured
  // now so all 5 call sites are already M2-ready (spec §11.13); unused in M1.
  const { waterY, moveX = 0, wantJump = false, hazards = [] } = opts;
```

- [ ] **Step 4: 跑测试 + 静态检查**

Run: `node --test games/boom-worms/tests/physics.test.mjs`
Expected: PASS

Run: `node --check games/boom-worms/src/physics.js`
Expected: 无输出

- [ ] **Step 5: Commit**

```bash
git add games/boom-worms/src/physics.js games/boom-worms/tests/physics.test.mjs
git commit -m "$(cat <<'EOF'
feat(boom-worms): reserve stepWorm hazards opt (M2-ready, non-breaking)

opts 解构加 hazards=[]（spec §11.13）；M1 不使用，5 处调用点天然就绪。
追加用例锁定“有无 hazards 行为一致”契约。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `game.js` —— 解 `nextLevel` 硬编码 + `showLevelSelect`

三处小改：import `LEVELS`、`nextLevel` 把 `6` 改成 `LEVELS.length`、新增 `showLevelSelect()`（设 `state='levelselect'`，供选关 overlay 使用）。`game.js` 依赖 DOM（Terrain 用 `document`），不走 node:test；由 Task 7 浏览器/手动验证（`?level=15` 通关 → win）。

**Files:**
- Modify: `games/boom-worms/src/game.js:7`（import）
- Modify: `games/boom-worms/src/game.js:150-157`（nextLevel）
- Modify: `games/boom-worms/src/game.js`（toMenu 后加 showLevelSelect）

- [ ] **Step 1: import `LEVELS`**

In `games/boom-worms/src/game.js`, change line 7:

old:
```js
import { buildLevel } from './levels.js';
```
new:
```js
import { buildLevel, LEVELS } from './levels.js';
```

- [ ] **Step 2: `nextLevel` 解硬编码**

Replace `nextLevel` (lines 150–157):

old:
```js
  nextLevel() {
    const next = this.levelIndex + 1;
    if (next >= 6) {
      this.state = 'win';
    } else {
      this.startGame(next, this.mode);
    }
  }
```
new:
```js
  nextLevel() {
    const next = this.levelIndex + 1;
    if (next >= LEVELS.length) {
      this.state = 'win';
    } else {
      this.startGame(next, this.mode);
    }
  }
```

- [ ] **Step 3: 新增 `showLevelSelect()`**

In `games/boom-worms/src/game.js`, immediately AFTER the `toMenu()` method (it ends at line 167 with its closing `}`), insert:

```js

  /** Show the pre-game level-select route map (its own state → overlay-levelselect). */
  showLevelSelect() {
    this.state = 'levelselect';
  }
```

- [ ] **Step 4: 静态检查**

Run: `node --check games/boom-worms/src/game.js`
Expected: 无输出

> 行为验证（reach win after L15、选关 state 切换）在 Task 7。

- [ ] **Step 5: Commit**

```bash
git add games/boom-worms/src/game.js
git commit -m "$(cat <<'EOF'
feat(boom-worms): uncap nextLevel to LEVELS.length + add showLevelSelect()

- nextLevel 的硬编码 6 → LEVELS.length（通关第 15 关才进 win）
- 新增 showLevelSelect()：state='levelselect'，驱动选关 overlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: 选关路线图 UI（index.html + style.css + main.js）+ win 文案动态

新增 `overlay-levelselect`（横向滚动闯关路线图，15 节点三态）；`btn-solo` → 选关（`?level=N` 跳过，spec §11.13）；节点点击 → `startGame`；「返回菜单」→ `toMenu`；`win-msg` 改由 `syncOverlays` 动态生成。这是 M1 的集成检查点。

**Files:**
- Modify: `games/boom-worms/index.html`（加 overlay + 清空 win-msg）
- Modify: `games/boom-worms/style.css`（追加选关样式）
- Modify: `games/boom-worms/src/main.js`（import、OVERLAY_IDS、populate、按钮、win-msg）

- [ ] **Step 1: index.html 加 `overlay-levelselect`**

In `games/boom-worms/index.html`, insert this block BETWEEN the menu overlay (ends line 59 `</div>`) and the pause overlay comment (line 61). 即紧跟 `<!-- ── Overlay: Main Menu ──...` 那个 div 的闭合之后：

```html

  <!-- ── Overlay: Level Select (route map) ──────────────────────────── -->
  <div id="overlay-levelselect" class="overlay">
    <div class="panel panel-wide">
      <h1 class="game-title">🗺️ 选择关卡</h1>
      <p id="levelselect-progress" class="best-line">🏆 还未通关任何关卡</p>
      <div id="levelselect-scroll">
        <div id="levelselect-track"><!-- nodes injected by main.js --></div>
      </div>
      <div class="btn-col">
        <button id="btn-ls-back" class="big-btn ghost" type="button">← 返回菜单</button>
      </div>
      <p class="tiny">点亮的关卡可重玩 · ▶ 为下一关 · 🔒 尚未解锁</p>
    </div>
  </div>
```

- [ ] **Step 2: index.html 清空写死的 win 文案**

Change line 103:

old:
```html
      <p id="win-msg" class="best-line">恭喜打败彩虹山 BOSS！</p>
```
new:
```html
      <p id="win-msg" class="best-line"></p>
```

- [ ] **Step 3: style.css 追加选关路线图样式**

Append to the end of `games/boom-worms/style.css`:

```css

/* ---- Level select (route map) ------------------------------------------ */
.panel.panel-wide {
  max-width: 760px;
}
#levelselect-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  padding: 6px 4px 12px;
  margin: 10px 0 16px;
  -webkit-overflow-scrolling: touch;
}
#levelselect-track {
  display: flex;
  align-items: center;
  gap: 24px;
  min-width: max-content;
  position: relative;
  padding: 30px 18px;
}
/* the winding path line behind the nodes */
#levelselect-track::before {
  content: '';
  position: absolute;
  left: 24px;
  right: 24px;
  top: 50%;
  height: 4px;
  transform: translateY(-50%);
  background: repeating-linear-gradient(90deg,
    rgba(255, 159, 67, 0.5) 0 14px, transparent 14px 26px);
  z-index: 0;
}
.ls-node {
  position: relative;
  z-index: 1;
  flex: 0 0 auto;
  width: 96px;
  height: 96px;
  border-radius: 16px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  background: rgba(20, 8, 40, 0.85);
  color: #fff;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 6px;
  transition: transform 0.12s, box-shadow 0.12s;
}
/* meander via margin so transform stays free for hover */
.ls-node:nth-child(odd)  { margin-bottom: 36px; }
.ls-node:nth-child(even) { margin-top: 36px; }
.ls-node .ls-num  { font-size: 22px; font-weight: 900; line-height: 1; }
.ls-node .ls-name { font-size: 11px; opacity: 0.85; text-align: center; }
.ls-node .ls-badge { font-size: 13px; height: 14px; line-height: 1; }
.ls-node:not(.locked):hover {
  transform: translateY(-4px) scale(1.06);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}
/* cleared: solid theme color, replayable */
.ls-node.cleared {
  background: var(--node-color, #5a8a3c);
  border-color: rgba(255, 255, 255, 0.55);
  color: #0d0618;
}
/* next: orange highlight, the call-to-action */
.ls-node.next {
  border-color: #ff9f43;
  background: rgba(255, 159, 67, 0.18);
  box-shadow: 0 0 0 3px rgba(255, 159, 67, 0.35), 0 6px 18px rgba(0, 0, 0, 0.5);
}
/* locked: dim, not interactive */
.ls-node.locked {
  opacity: 0.4;
  filter: grayscale(0.7);
  cursor: not-allowed;
}
```

- [ ] **Step 4: main.js —— import `LEVELS` + progress 函数**

In `games/boom-worms/src/main.js`, after the existing imports (lines 5–8), add:

old:
```js
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound, Music } from './audio.js';
```
new:
```js
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound, Music } from './audio.js';
import { LEVELS } from './levels.js';
import { levelNodeState } from './progress.js';
```

- [ ] **Step 5: main.js —— OVERLAY_IDS 加 levelselect**

Change the `OVERLAY_IDS` object (lines 32–38):

old:
```js
const OVERLAY_IDS = {
  menu:       'overlay-menu',
  paused:     'overlay-pause',
  levelclear: 'overlay-levelclear',
  gameover:   'overlay-gameover',
  win:        'overlay-win',
};
```
new:
```js
const OVERLAY_IDS = {
  menu:        'overlay-menu',
  levelselect: 'overlay-levelselect',
  paused:      'overlay-pause',
  levelclear:  'overlay-levelclear',
  gameover:    'overlay-gameover',
  win:         'overlay-win',
};
```

- [ ] **Step 6: main.js —— win-msg 动态生成**

In `syncOverlays()`, after the Game-over message block (ends line 89 `}`), insert:

```js

  // Win message (all levels cleared) — dynamic, replaces the old hardcoded text (§11.13)
  const winMsg = document.getElementById('win-msg');
  if (winMsg && game.state === 'win') {
    winMsg.textContent = '恭喜通关全部 ' + LEVELS.length + ' 关！🎉';
  }
```

- [ ] **Step 7: main.js —— populateLevelSelect()**

Insert this function just BEFORE the `// Button wiring` comment block (line 142–144). 放在 `_aimConfigRef` 那段 import().then 之后、`const BTN = ...` 之前：

```js

// ---------------------------------------------------------------------------
// Level select route map
// ---------------------------------------------------------------------------
function populateLevelSelect() {
  const track = document.getElementById('levelselect-track');
  const prog = document.getElementById('levelselect-progress');
  if (!track) return;
  const best = (game.best && game.best.level) ? game.best.level : 0; // highest cleared, 1-based
  const total = LEVELS.length;
  if (prog) {
    prog.textContent = best > 0
      ? '🏆 最远进度：第 ' + best + ' 关已通关'
      : '🏆 还未通关任何关卡';
  }
  track.innerHTML = '';
  let nextNode = null;
  LEVELS.forEach((lv, idx) => {
    const num = idx + 1;
    const stt = levelNodeState(num, best, total); // 'cleared' | 'next' | 'locked'
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'ls-node ' + stt;
    node.style.setProperty('--node-color', lv.palette.land);
    node.disabled = (stt === 'locked');
    const badge = stt === 'locked' ? '🔒' : (stt === 'next' ? '▶' : '✓');
    node.innerHTML =
      '<span class="ls-num">' + num + '</span>' +
      '<span class="ls-name">' + lv.name + '</span>' +
      '<span class="ls-badge">' + badge + '</span>';
    if (stt !== 'locked') {
      node.addEventListener('click', () => {
        Sound.resume();
        Sound.ui();
        game.startGame(idx, 'solo');
      });
    }
    track.appendChild(node);
    if (stt === 'next') nextNode = node;
  });
  // Auto-scroll to the next playable node — deferred one frame so the overlay
  // (toggled to display:flex by the next syncOverlays) is laid out first.
  const target = nextNode || track.lastElementChild;
  if (target && target.scrollIntoView) {
    requestAnimationFrame(() => target.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }
}
```

- [ ] **Step 8: main.js —— btn-solo 走选关；加 btn-ls-back**

Change the `btn-solo` handler (lines 154–158):

old:
```js
BTN('btn-solo', () => {
  Sound.resume();
  Sound.ui();
  game.startGame(startIndex, 'solo');
});
```
new:
```js
BTN('btn-solo', () => {
  Sound.resume();
  Sound.ui();
  if (Number.isFinite(levelParam)) {
    game.startGame(startIndex, 'solo'); // ?level=N debug shortcut → skip the select screen
  } else {
    populateLevelSelect();
    game.showLevelSelect();
  }
});
BTN('btn-ls-back', () => {
  Sound.ui();
  game.toMenu();
});
```

- [ ] **Step 9: 静态检查**

Run: `node --check games/boom-worms/src/main.js`
Expected: 无输出

- [ ] **Step 10: Commit**

```bash
git add games/boom-worms/index.html games/boom-worms/style.css games/boom-worms/src/main.js
git commit -m "$(cat <<'EOF'
feat(boom-worms): level-select route map UI + dynamic win text

- overlay-levelselect：横向滚动闯关路线图，15 节点 cleared/next/locked 三态
- btn-solo → 选关（?level=N 跳过，spec §11.13）；节点→startGame；返回菜单→toMenu
- 解锁判定复用 progress.levelNodeState；打开自动滚到“下一关”
- win-msg 改由 syncOverlays 动态生成（替换写死的“彩虹山 BOSS”）

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 浏览器 smoke + 全测试 + 手动清单（M1 门禁）

加载级 puppeteer smoke（spec §11.9，复用 memory `boom-worms-smoke-test-setup` 的去锈配方），验证选关界面真的能开、15 节点状态正确、点第 1 关能进游戏、零 JS error。**不**自动化完整通关。

> 环境提示（来自 memory）：sandbox 的 localhost 走代理返 502；务必用 `dangerouslyDisableSandbox: true`、清空 `*_PROXY`、Chrome 加 `--no-proxy-server --proxy-bypass-list=*`；server+client 必须在**同一个** Bash 调用里；smoke 脚本要 `cp` 进 `/tmp/bw-pup` 才能 bare-import puppeteer-core。

**Files:**
- Create: `games/boom-worms/tests/smoke-m1.mjs`

- [ ] **Step 1: 写 smoke 脚本**

Create `games/boom-worms/tests/smoke-m1.mjs`:

```js
// M1 load-level smoke for 炮炮虫. Run via puppeteer-core + system Chrome.
// See memory boom-worms-smoke-test-setup. Exit non-zero on any failure.
import puppeteer from 'puppeteer-core';

const URL = 'http://localhost:8850/games/boom-worms/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const errors = [];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--no-proxy-server', '--proxy-bypass-list=*'],
});
const page = await browser.newPage();
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('requestfailed', (r) => {
  if (!r.url().endsWith('/favicon.ico')) errors.push('requestfailed: ' + r.url());
});

await page.goto(URL, { waitUntil: 'networkidle2' });

// 1) Open level select from the menu
await page.click('#btn-solo');
await page.waitForSelector('#overlay-levelselect.show', { timeout: 3000 });

// 2) 15 nodes, fresh save (v2 key) → node 1 = next, 2..15 = locked
const states = await page.$$eval('#levelselect-track .ls-node', (ns) =>
  ns.map((n) => n.classList.contains('cleared') ? 'c'
    : n.classList.contains('next') ? 'n'
    : n.classList.contains('locked') ? 'l' : '?'));
const nodeCount = states.length;
const freshOk = states[0] === 'n' && states.slice(1).every((s) => s === 'l');
await page.screenshot({ path: '/tmp/bw-m1-select.png' });

// 3) Click the next node (level 1) → game starts, overlay hides
await page.click('#levelselect-track .ls-node.next');
await page.waitForFunction(
  () => !document.getElementById('overlay-levelselect').classList.contains('show'),
  { timeout: 3000 });
// terrain should now exist (game running)
const inPlay = await page.evaluate(() => {
  const c = document.getElementById('game');
  return !!(c && c.width > 0);
});
await page.screenshot({ path: '/tmp/bw-m1-play.png' });

await browser.close();

console.log(`nodes=${nodeCount} fresh-unlock=${freshOk} in-play=${inPlay} errors=${errors.length}`);
if (errors.length) console.log(errors.join('\n'));
if (nodeCount !== 15 || !freshOk || !inPlay || errors.length) {
  console.log('M1 SMOKE FAIL');
  process.exit(1);
}
console.log('M1 SMOKE PASS');
```

- [ ] **Step 2: 装 puppeteer-core（后台，首次 ~1-7 分钟）**

Run（`run_in_background: true` + `dangerouslyDisableSandbox: true`）:
```bash
npm install --prefix /tmp/bw-pup puppeteer-core
```
Expected: 完成后 `/tmp/bw-pup/node_modules/puppeteer-core` 存在。（npm 全局缓存常使其很快。）

- [ ] **Step 3: 跑 smoke（单个 Bash 调用，server+client 同调用）**

Run（`dangerouslyDisableSandbox: true`）:
```bash
mkdir -p /tmp/bw-pup
cp /Users/james/Projects/game-hub/games/boom-worms/tests/smoke-m1.mjs /tmp/bw-pup/smoke-m1.mjs
http_proxy= https_proxy= HTTP_PROXY= HTTPS_PROXY= ALL_PROXY= all_proxy= no_proxy='*' \
  python3 -m http.server 8850 --directory /Users/james/Projects/game-hub & SRV=$!
sleep 1.5
http_proxy= https_proxy= HTTP_PROXY= HTTPS_PROXY= ALL_PROXY= all_proxy= no_proxy='*' \
  node /tmp/bw-pup/smoke-m1.mjs
RC=$?
kill $SRV 2>/dev/null
exit $RC
```
Expected: `M1 SMOKE PASS`，`nodes=15 fresh-unlock=true in-play=true errors=0`。

- [ ] **Step 4: 看截图确认视觉**

Read `/tmp/bw-m1-select.png`（选关路线图：15 节点、第 1 关橙色 ▶、其余灰锁 🔒、蜿蜒路径线）和 `/tmp/bw-m1-play.png`（第 1 关已开打、绿草主题地形 + 顶纹）。

> 若 smoke 因 console error 失败且报错来自 `render.js`（`levelselect` 状态）：在 `render.js` 渲染分发处，让 `'levelselect'` 与 `'menu'` 同路径（菜单态 `terrain` 同为 null 且能正常渲染），或在 terrain 绘制前加 `if (!game.terrain) { /* 仅画背景 */ }` 守卫，重跑本步。

- [ ] **Step 5: 全 node:test 套件回归**

Run: `node --test games/boom-worms/tests/*.mjs`
Expected: 全绿（progress / levels / turns / physics 新增与改写 + 原有 ai/aim/combat/math/terrain/trajectory）。

- [ ] **Step 6: 手动实玩清单（spec §11.9 · M1）**

人工在浏览器（或上一步截图 + 抽查）确认：
1. 主菜单「🎮 单人闯关」→ 选关路线图：15 节点；首次只有第 1 关 ▶ 可点，2-15 灰锁 🔒。
2. 点第 1 关 → 进入游戏，横幅「第 1 关 · 绿草训练场」；通关后第 1 关变 ✓ 实色、第 2 关变 ▶。
3. 选关页「← 返回菜单」回主菜单；主菜单「最远进度」随通关数更新。
4. `?level=15` 直接进第 15 关（跳过选关）；通关后出现「🏆 全部通关」结算，文案为「恭喜通关全部 15 关！🎉」（非旧的彩虹山 BOSS）。
5. 抽查 3-4 个新主题关（如 6 火山 / 8 冰雪 / 11 工厂 / 15 终焉）：配色与地形顶纹各异、能正常生成与开打。

- [ ] **Step 7: Commit**

```bash
git add games/boom-worms/tests/smoke-m1.mjs
git commit -m "$(cat <<'EOF'
test(boom-worms): M1 load-level puppeteer smoke (level-select + start L1)

加载级 smoke（spec §11.9）：开选关→15 节点三态校验→点第 1 关进游戏→零 JS error。
配方见 memory boom-worms-smoke-test-setup（host-side puppeteer-core + 系统 Chrome）。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 更新项目 memory（M1 完成）

把 `boom-worms-game` memory 从「spec 定稿待实现」更新为「M1 done」，记录已 commit 的内容与下一步 M2。

**Files:**
- Modify: `/Users/james/.claude/projects/-Users-james-Projects-game-hub/memory/boom-worms-game.md`

- [ ] **Step 1: 更新 memory 正文的「状态」「Roadmap」「下次继续」**

把状态段更新为：现有 **15 关**、闯关路线图选关已上线（M1 done，develop 上分任务 commit）；M1 范围：progress.js 解锁逻辑、15 关数据（9 新主题）、v2 存档重置、checkOutcome 三参签名、stepWorm 预留 hazards、nextLevel 解硬编码、选关 UI、win 文案动态、puppeteer smoke。Roadmap 勾掉 M1，下次继续指向 **M2（致命/特殊地形）**：plan 路径 `docs/superpowers/plans/2026-06-07-boom-worms-m1-level-select-15-levels.md`，spec §11.5/§11.6/§11.10。

- [ ] **Step 2: 确认 MEMORY.md 索引行无需改**（描述仍准确即可，可微调为「M1 done」）。

- [ ] **Step 3（可选）: Commit memory 不入 git**（memory 在 `~/.claude`，不属于 repo —— 无需 git 操作）。

---

## Self-Review（plan vs spec）

**1. Spec 覆盖（§8 M1 + §11.13）**
- 选关路线图 + 解锁 → Task 1（逻辑）+ Task 6（UI）✓
- 15 关数据（主题/palette/难度/aiError 表）→ Task 2 ✓（aiError 按 §11.12）
- objective 全 eliminate / hazards 全空 → Task 2 数据 ✓
- `nextLevel` 解硬编码 → Task 5 ✓
- 9 新主题 palette + `_toppingColor` → Task 2 ✓
- `STORAGE_KEY` v2 → Task 2 ✓
- stepWorm 预留 `hazards=[]` → Task 4 ✓（§11.13）
- checkOutcome 三参默认签名 → Task 3 ✓（§11.7/§11.13）
- 选关流程 btn-solo / `?level=N` 跳过 / 返回菜单 → Task 6 ✓（§11.13）
- win 文案动态 → Task 6 ✓（§11.13）
- 测试三层（node:test + puppeteer smoke + 手动清单）→ Task 1-4（node）+ Task 7（smoke + 手动）✓（§11.9）
- 门禁：15 关可选可逐关打通 + 测试绿 + 浏览器实玩 → Task 7 ✓

**2. 占位符扫描**：无 TBD/TODO；每个 code step 给出完整代码与精确旧→新串；命令含预期输出。Task 7 Step 4 的 render.js 兜底是**有明确触发条件 + 明确改法**的条件补救，非空泛占位。

**3. 类型/命名一致性**：`progress.js` 导出 `maxPlayableLevel/isPlayable/levelNodeState` —— Task 1 定义、Task 6 main.js import `levelNodeState`、progress.test 用全部三个，一致。`showLevelSelect`（Task 5 定义、Task 6 调用）一致。`overlay-levelselect` / `levelselect-track` / `levelselect-progress` / `ls-node` / `--node-color` / `btn-ls-back` 在 index.html（Task 6 Step 1）、style.css（Step 3）、main.js（Step 7-8）、smoke（Task 7）四处拼写一致。`checkOutcome(teams, objective, state)` 签名（Task 3）与调用（game.js 单参，默认生效）一致。`STORAGE_KEY` 仅 config.js 定义、game.js import，无第二处硬编码。

**4. 歧义检查**：`best` 全程定义为「已通关最高关，1-based，0=未通关」（progress.js 注释 + main.js 注释）；`levelNodeState` 的 'next' 唯一对应 `best+1`；全通关时无 'next'、smoke 与 UI 均回退到末节点 —— 行为明确。

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-boom-worms-m1-level-select-15-levels.md`. Two execution options:

1. **Subagent-Driven (recommended)** — 每个 task 派新 subagent、task 间 review、快速迭代。（注意 memory：本仓 subagent 大型构建会因 cost hook 自阻塞，除非 prompt 明确授权花费 —— 派单时要在 prompt 里授权 spend。）
2. **Inline Execution** — 本会话内按 executing-plans 分段执行 + 检查点 review。

Which approach?
