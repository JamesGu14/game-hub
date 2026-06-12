# 加载屏动效实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为《成都保卫战 · 三国塔防》增加一个带真实进度和阶段文字的古风加载屏，加载完成后淡出进入游戏。

**Architecture:** `src/core/assets.js` 的 `preload()` 增加可选 `onProgress` 回调，按每张图片加载完成数实时汇报进度；`src/ui/loadingScreen.js` 负责创建/更新/淡出加载屏 DOM 与失败提示；`src/main.js` 的 `boot()` 把三者串起来；样式写入 `src/style.css`。

**Tech Stack:** 原生 ES Module、DOM API、CSS transition。

---

## 文件结构

| 文件 | 变更 | 职责 |
|---|---|---|
| `src/core/assets.js` | 修改 | 资源预加载，新增 `onProgress` 进度回调 |
| `src/ui/loadingScreen.js` | 新建 | 加载屏 DOM 创建、更新、淡出、失败提示 |
| `src/main.js` | 修改 | 在 `boot()` 中集成加载流程 |
| `src/style.css` | 修改 | 加载屏与失败提示样式 |
| `tests/assets.test.mjs` | 修改 | 验证 `onProgress` 回调行为 |

---

## Task 1: 让 `preload()` 支持进度回调

**Files:**
- Modify: `src/core/assets.js`
- Test: `tests/assets.test.mjs`

- [ ] **Step 1: 写失败测试**

在 `tests/assets.test.mjs` 末尾新增：

```js
// 6) onProgress 回调：进度递增到 100，且阶段标签存在
{
  const stages = [];
  const progress = [];
  await preload(
    (src) => Promise.resolve(fakeImg(src)),
    MANIFEST,
    ({ loaded, total, stage, percent, failed }) => {
      progress.push({ loaded, total, percent, failed });
      if (!stages.includes(stage)) stages.push(stage);
    }
  );
  assert.equal(progress.length, Object.keys(MANIFEST).length, '每张图完成都触发回调');
  assert.equal(progress.at(-1).percent, 100, '最终 percent=100');
  assert.equal(progress.at(-1).failed, 0, '全成功时 failed=0');
  assert.ok(stages.length >= 1, '至少有一个阶段标签');
}
```

- [ ] **Step 2: 运行测试确认失败**

```bash
node tests/assets.test.mjs
```

Expected: 断言失败，提示 `progress.length` 不等于图片总数，或 `onProgress` 未调用。

- [ ] **Step 3: 修改 `src/core/assets.js` 实现回调**

在文件顶部添加阶段分类函数（放在 `defaultLoadImage` 之前或之后）：

```js
const STAGES = [
  { label: '加载武将立绘…', match: (id) => id.startsWith('gen_') },
  { label: '加载敌军图鉴…', match: (id) => id.startsWith('enemy_') },
  { label: '加载名将 Boss…', match: (id) => id.startsWith('boss_') },
  { label: '加载建筑城防…', match: (id) => id.startsWith('building_') },
];

function stageFor(id) {
  for (const s of STAGES) if (s.match(id)) return s.label;
  return '加载资源中…';
}
```

把 `preload` 函数替换为：

```js
export async function preload(loadImage = defaultLoadImage, manifest = MANIFEST, onProgress = null) {
  assets.images = {};
  assets.ready = false;
  const entries = Object.entries(manifest);
  const total = entries.length;
  let loaded = 0;
  let failed = 0;

  await Promise.allSettled(
    entries.map(async ([id, src]) => {
      let img = null;
      try {
        img = await loadImage(src);
      } catch {
        img = null;
      }
      if (img) assets.images[id] = img;
      else failed++;
      loaded++;
      if (onProgress) {
        onProgress({
          loaded,
          total,
          stage: stageFor(id),
          percent: Math.round((loaded / total) * 100),
          failed,
        });
      }
    })
  );

  assets.ready = true;
  return assets;
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
node tests/assets.test.mjs
```

Expected: 输出 `ok assets`。

- [ ] **Step 5: 提交**

```bash
git add src/core/assets.js tests/assets.test.mjs
git commit -m "feat(assets): add onProgress callback to preload"
```

---

## Task 2: 创建加载屏 UI 模块

**Files:**
- Create: `src/ui/loadingScreen.js`

- [ ] **Step 1: 创建文件并写入实现**

创建 `src/ui/loadingScreen.js`：

```js
// src/ui/loadingScreen.js — 启动加载屏与失败提示

export function createLoadingScreen() {
  const el = document.createElement('div');
  el.id = 'loading';
  el.className = 'loading-screen';
  el.innerHTML = `
    <div class="loading-scroll">
      <div class="loading-title">成都保卫战</div>
      <div class="loading-bar">
        <div class="loading-fill" style="width:0%"></div>
      </div>
      <div class="loading-meta">
        <span class="loading-stage">准备军资…</span>
        <span class="loading-percent">0%</span>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

export function updateLoadingScreen(el, { percent, stage }) {
  const fill = el.querySelector('.loading-fill');
  const stageEl = el.querySelector('.loading-stage');
  const percentEl = el.querySelector('.loading-percent');
  if (fill) fill.style.width = `${percent}%`;
  if (stageEl) stageEl.textContent = stage || '加载中…';
  if (percentEl) percentEl.textContent = `${percent}%`;
}

export function fadeOutLoadingScreen(el) {
  return new Promise((resolve) => {
    if (!el || !el.parentNode) { resolve(); return; }
    el.classList.add('loading-fade-out');
    const cleanup = () => {
      if (el.parentNode) el.remove();
      resolve();
    };
    el.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 600);
  });
}

export function showRetryDialog({ onContinue }) {
  const dialog = document.createElement('div');
  dialog.className = 'loading-retry-dialog';
  dialog.innerHTML = `
    <div class="loading-retry-box">
      <div class="loading-retry-title">军情未达</div>
      <p>部分军情图卷未能送达，是否继续出征？</p>
      <div class="loading-retry-actions">
        <button class="loading-retry-continue">继续出征</button>
        <button class="loading-retry-retry">重新整备</button>
      </div>
    </div>
  `;
  dialog.querySelector('.loading-retry-continue').addEventListener('click', () => {
    dialog.remove();
    onContinue();
  });
  dialog.querySelector('.loading-retry-retry').addEventListener('click', () => {
    location.reload();
  });
  document.body.appendChild(dialog);
}
```

- [ ] **Step 2: 语法检查**

```bash
node --check src/ui/loadingScreen.js
```

Expected: 无输出（通过）。

- [ ] **Step 3: 提交**

```bash
git add src/ui/loadingScreen.js
git commit -m "feat(ui): add loading screen helpers"
```

---

## Task 3: 添加加载屏样式

**Files:**
- Modify: `src/style.css`

- [ ] **Step 1: 在文件末尾追加样式**

```css
/* 加载屏 */
.loading-screen {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  background: #1a120b;
  color: #ffe0a8;
  transition: opacity 0.4s ease-out;
}
.loading-screen.loading-fade-out { opacity: 0; }

.loading-scroll {
  width: min(420px, 86vw);
  padding: 32px;
  background: #24180f;
  border: 2px solid #6b4c35;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0,0,0,.5);
}

.loading-title {
  font: 800 22px system-ui, sans-serif;
  color: #d4a574;
  letter-spacing: 6px;
  margin-bottom: 28px;
}

.loading-bar {
  width: 100%; height: 10px;
  background: #3e2b1f;
  border-radius: 5px;
  overflow: hidden;
  margin-bottom: 14px;
}

.loading-fill {
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #c49a6c, #ffe0a8);
  border-radius: 5px;
  transition: width 0.15s ease-out;
}

.loading-meta {
  display: flex; justify-content: space-between;
  font: 600 14px system-ui, sans-serif;
}

.loading-stage { color: #d4a574; }
.loading-percent { color: #ffe0a8; }

/* 加载失败提示 */
.loading-retry-dialog {
  position: fixed; inset: 0; z-index: 60;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,.6);
}

.loading-retry-box {
  width: min(320px, 80vw);
  padding: 24px;
  background: #24180f;
  border: 2px solid #6b4c35;
  border-radius: 8px;
  color: #ffe0a8;
  text-align: center;
}

.loading-retry-title {
  font: 800 18px system-ui, sans-serif;
  color: #d4a574;
  margin-bottom: 12px;
}

.loading-retry-box p { margin: 0 0 20px; font-size: 14px; }

.loading-retry-actions {
  display: flex; gap: 12px; justify-content: center;
}

.loading-retry-actions button {
  padding: 8px 16px;
  border: none; border-radius: 6px;
  font: 600 14px system-ui, sans-serif;
  cursor: pointer;
}

.loading-retry-continue {
  background: #c49a6c;
  color: #1a120b;
}

.loading-retry-retry {
  background: #3e2b1f;
  color: #ffe0a8;
  border: 1px solid #6b4c35;
}
```

- [ ] **Step 2: 语法检查**

```bash
node --check src/main.js
```

（注：`style.css` 无 JS 语法检查，稍后通过浏览器验证。）

- [ ] **Step 3: 提交**

```bash
git add src/style.css
git commit -m "style: add loading screen and retry dialog styles"
```

---

## Task 4: 在 `main.js` 集成加载流程

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1: 在 imports 区新增加载屏导入**

在 `import { button, panel, backdrop, vignette } from './ui/theme.js';` 之后新增：

```js
import { createLoadingScreen, updateLoadingScreen, fadeOutLoadingScreen, showRetryDialog } from './ui/loadingScreen.js';
```

- [ ] **Step 2: 在 `boot()` 开头包一层加载屏逻辑**

把原来的：

```js
async function boot() {
  await preload();
  save = browserLoad();
  ...
}
```

改为：

```js
async function boot() {
  const loadingEl = createLoadingScreen();
  let lastFailed = 0;

  await preload(undefined, MANIFEST, ({ percent, stage, failed }) => {
    lastFailed = failed;
    updateLoadingScreen(loadingEl, { percent, stage });
  });

  if (lastFailed > 0) {
    showRetryDialog({
      onContinue: async () => {
        await new Promise((r) => setTimeout(r, 200));
        await fadeOutLoadingScreen(loadingEl);
      },
    });
  } else {
    await new Promise((r) => setTimeout(r, 200));
    await fadeOutLoadingScreen(loadingEl);
  }

  save = browserLoad();
  ...
}
```

注意：需要确保 `MANIFEST` 已在 `src/main.js` 被导入。当前 `main.js` 第 4 行是 `import { preload } from './core/assets.js';`，需要改为：

```js
import { preload, MANIFEST } from './core/assets.js';
```

- [ ] **Step 3: 语法检查**

```bash
node --check src/main.js
```

Expected: 无输出（通过）。

- [ ] **Step 4: 浏览器验证**

```bash
# 在项目根目录起一个本地服务器，例如：
npx serve . -p 8080
# 或 python3 -m http.server 8080
```

打开 `http://localhost:8080`，观察：
- 首次进入应看到加载屏，进度条从 0% 走到 100%。
- 阶段文字会切换。
- 100% 后停留约 0.2 秒，然后淡出。

- [ ] **Step 5: 提交**

```bash
git add src/main.js
git commit -m "feat(main): integrate loading screen into boot flow"
```

---

## Task 5: 失败提示流程验证

**Files:**
- Modify: 临时修改 `src/core/assets.js` 模拟失败，验证后回滚（不提交）

- [ ] **Step 1: 临时制造失败**

把 `src/core/assets.js` 里的 `defaultLoadImage` 临时改为一定返回 `null`：

```js
function defaultLoadImage(src) {
  return Promise.resolve(null);
}
```

- [ ] **Step 2: 浏览器验证**

刷新页面，观察：
- 进度走到 100%。
- 弹出「军情未达」提示框。
- 点击「继续出征」：停留 0.2 秒后淡出，进入选关界面。
- 点击「重新整备」：页面刷新。

- [ ] **Step 3: 回滚临时修改**

```bash
git checkout -- src/core/assets.js
```

---

## Task 6: 全量测试与门禁

**Files:**
- 全项目

- [ ] **Step 1: 运行完整测试脚本**

```bash
bash scripts/test.sh
```

Expected: 输出 `✅✅ 全部门禁通过`。

- [ ] **Step 2: 浏览器再次验证**

正常网络下刷新页面，确认加载屏出现并正常淡出。

- [ ] **Step 3: 最终提交（如有未提交改动）**

```bash
git add -A
git commit -m "feat(loading): full loading screen with progress, stages and retry dialog"
```

---

## Spec Coverage Checklist

| 设计文档要求 | 实现任务 |
|---|---|
| 进度条 + 百分比 | Task 1（回调）、Task 2（DOM 更新）、Task 3（样式） |
| 阶段文字按资源类别切换 | Task 1（`stageFor`） |
| 古风卷轴视觉 | Task 2 + Task 3 |
| 100% 后停留 0.2s 再淡出 | Task 4（`setTimeout(200)`） |
| 资源失败弹出提示 | Task 2（`showRetryDialog`）+ Task 4 |
| 继续出征用色块代替 | 失败时 `assets.images` 无该键，渲染层已有回退逻辑 |
| 重新整备刷新页面 | Task 2（`location.reload()`） |
| 单测覆盖 | Task 1（新增测试） |

## Placeholder Scan

- 无 TBD/TODO。
- 所有代码块完整。
- 所有命令与期望输出明确。
- 无未定义函数引用。
