# 极速飞车 TURBO DRIFT 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 7 岁孩子构建一款 Web 端伪3D 第三人称漂移竞速游戏（从下往上开，类似 QQ 飞车简化版），含完整漂移攒氮气、道具战、4 条主题赛道、4 辆解锁车、3 圈对 3 个橡皮筋 AI 的比赛，全程儿童友好。

**Architecture:** 纯 HTML + Canvas 2D + ES Modules，无构建、无外部资源。可测的纯逻辑（投影/物理/漂移/名次/解锁/AI/道具/碰撞）与浏览器绑定层（render/audio/input/main）严格分离。逻辑用 Node 内置 test runner 做 TDD；渲染与手感用 Playwright 冒烟 + 人工试玩。沿用项目现有游戏（jungle-blitz/pixel-quest）的目录与测试约定。

**Tech Stack:** HTML5 Canvas 2D, vanilla ES Modules, Web Audio API, localStorage, `node --test`（`.test.mjs`）, Playwright（冒烟）。

参考设计文档：`docs/superpowers/specs/2026-06-03-turbo-drift-racing-design.md`

---

## 文件结构

```
games/turbo-drift/
  index.html        # 画布 + 浮层 + 返回HUB + 静音（结构骨架）
  style.css         # 浮层/HUD/按钮样式（仿 jungle-blitz）
  src/
    config.js       # 所有可调参数（VIEW/RENDER/PHYSICS/DRIFT/NITRO/RACE/AI/ITEMS）
    util/math.js    # clamp/lerp/wrap/randFrom + project()（纯函数）
    track.js        # buildSegments() + TRACKS（4 条）+ 主题配色
    cars.js         # CARS + 解锁规则（纯）
    save.js         # localStorage 读写（注入 storage 便于测试）
    player.js       # stepPlayer()/driftStep() 纯物理步进
    race.js         # 名次/圈数/倒计时/完赛（纯）
    ai.js           # stepAI()/rubberMul()（纯）
    items.js        # 道具效果/时长/护盾（纯）
    input.js        # 键盘 + 手柄 → 统一输入（浏览器）
    audio.js        # Web Audio 程序化音效（浏览器）
    render.js       # 伪3D 渲染（浏览器，已用原型验证）
    main.js         # 状态机 + 浮层绑定 + 主循环（浏览器）
  tests/
    math.test.mjs
    track.test.mjs
    cars.test.mjs
    save.test.mjs
    player.test.mjs
    drift.test.mjs
    race.test.mjs
    ai.test.mjs
    items.test.mjs
    smoke.spec.mjs
  README.md
```

**职责边界：** `src/util/math.js`、`track.js`、`cars.js`、`save.js`、`player.js`、`race.js`、`ai.js`、`items.js` 都不引用 `window`/`document`/`canvas`，可被 Node 直接 import 做单测。`input.js`/`audio.js`/`render.js`/`main.js` 是浏览器层，不单测（render.js 顶层只 import 纯模块、不触碰 document，故可被 Node 解析做 import 冒烟）。

**测试运行：** 在 `games/turbo-drift/` 下 `node --test`（Node ≥ 18 内置）。

---

## Task 0: 脚手架 — 目录、HTML 骨架、注册到 HUB

**Files:**
- Create: `games/turbo-drift/index.html`
- Create: `games/turbo-drift/style.css`
- Create: `games/turbo-drift/README.md`
- Create: `games/turbo-drift/src/main.js`（占位，仅画一帧确认链路）
- Modify: `js/games.js`（追加卡片）

- [ ] **Step 1: 创建 index.html 骨架**

参照 `games/jungle-blitz/index.html` 的浮层模式。创建 `games/turbo-drift/index.html`：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#0a1230" />
  <title>极速飞车 TURBO DRIFT · 伪3D 竞速</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <canvas id="game"></canvas>
  <a id="back-to-hub" href="../../index.html" title="返回游戏中心 / Back to Hub">← HUB</a>
  <button id="btn-mute" type="button" title="静音 / 声音 (M)">🔊</button>
  <div id="banner" class="banner"><span id="banner-text"></span></div>

  <!-- 菜单 -->
  <div id="overlay-menu" class="overlay show">
    <div class="panel">
      <h1 class="game-title">🏎️ 极速飞车</h1>
      <p class="game-sub">伪3D 漂移竞速 · 从下往上开</p>
      <button id="btn-play" class="big-btn" type="button">▶ 开始游戏</button>
      <p id="menu-best" class="best-line"></p>
      <div class="hints">
        <span><b>← →</b> 转向</span>
        <span><b>↑/W</b> 加速</span>
        <span><b>空格</b> 漂移（+转向）</span>
        <span><b>Z/↓</b> 道具</span>
        <span><b>Shift</b> 氮气</span>
        <span><b>Esc</b> 暂停</span>
        <span><b>手柄</b> 摇杆转向 · RT 加速 · L1 漂移 · □ 道具</span>
      </div>
    </div>
  </div>

  <!-- 车库（选车） -->
  <div id="overlay-garage" class="overlay">
    <div class="panel">
      <h1 class="game-title">🚗 选择赛车</h1>
      <div id="garage-cars" class="garage-grid"></div>
      <div class="btn-col">
        <button id="btn-garage-go" class="big-btn" type="button">选好了 →</button>
        <button id="btn-garage-back" class="big-btn ghost" type="button">← 返回</button>
      </div>
    </div>
  </div>

  <!-- 选赛道 -->
  <div id="overlay-track" class="overlay">
    <div class="panel">
      <h1 class="game-title">🗺️ 选择赛道</h1>
      <div id="track-list" class="garage-grid"></div>
      <button id="btn-track-back" class="big-btn ghost" type="button">← 返回</button>
    </div>
  </div>

  <!-- 暂停 -->
  <div id="overlay-pause" class="overlay">
    <div class="panel">
      <h1 class="game-title">⏸ 暂停</h1>
      <div class="btn-col">
        <button id="btn-resume" class="big-btn" type="button">▶ 继续</button>
        <button id="btn-restart" class="big-btn ghost" type="button">↻ 重新开始</button>
        <a class="big-btn ghost" href="../../index.html">← 返回 HUB</a>
      </div>
    </div>
  </div>

  <!-- 结算 -->
  <div id="overlay-finish" class="overlay">
    <div class="panel">
      <h1 id="finish-title" class="game-title">🏁 完赛！</h1>
      <p id="finish-place" class="best-line"></p>
      <p id="finish-unlock" class="tiny"></p>
      <div class="btn-col">
        <button id="btn-next" class="big-btn" type="button">继续 →</button>
        <button id="btn-finish-menu" class="big-btn ghost" type="button">主菜单</button>
        <a class="big-btn ghost" href="../../index.html">← 返回 HUB</a>
      </div>
    </div>
  </div>

  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 创建 style.css**

复制 `games/jungle-blitz/style.css` 作为基底（保留其 .overlay/.panel/.big-btn/.hints/.banner/.game-title/.best-line/.tiny/.btn-col 等类），改主色为赛车蓝紫（把根色相关变量/强调色调成 `#5161ff`），并在末尾追加车库/赛道网格样式：

```css
/* 追加到从 jungle-blitz 拷来的 style.css 末尾 */
:root { --bg-accent: #5161ff; }
.garage-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin: 12px 0; }
.garage-card { border: 2px solid #ffffff22; border-radius: 12px; padding: 10px; cursor: pointer; background: #ffffff0e; text-align: center; transition: transform .1s, border-color .1s; }
.garage-card:hover, .garage-card.sel { border-color: var(--bg-accent, #5161ff); transform: translateY(-2px); }
.garage-card.locked { opacity: .45; filter: grayscale(.7); cursor: not-allowed; }
.garage-card .swatch { width: 52px; height: 34px; border-radius: 8px; margin: 0 auto 6px; }
.garage-card .stat { font-size: 11px; opacity: .85; }
```

- [ ] **Step 3: 占位 main.js（验证链路）**

```js
// games/turbo-drift/src/main.js — 占位：仅证明 canvas + 模块链路可用，后续任务替换
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
function fit() { cv.width = cv.clientWidth; cv.height = cv.clientHeight; }
new ResizeObserver(fit).observe(cv);
fit();
ctx.fillStyle = '#0a1230'; ctx.fillRect(0, 0, cv.width, cv.height);
ctx.fillStyle = '#fff'; ctx.font = '20px system-ui';
ctx.fillText('TURBO DRIFT — 脚手架就绪', 24, 48);
```

- [ ] **Step 4: 注册到 HUB**

在 `js/games.js` 的 `GAMES` 数组末尾（最后一个对象的 `}` 之后、`]` 之前）追加：

```js
  {
    id: 'turbo-drift',
    title: '极速飞车 TURBO DRIFT',
    subtitle: '伪3D 漂移竞速 · 从下往上开',
    desc: '伪3D 第三人称竞速 · 漂移攒氮气 · 道具战 · 4 赛道 4 车 · 键鼠/手柄',
    icon: '🏎️',
    accent: '#5161ff',
    accent2: '#1a2270',
    tags: ['竞速', '漂移', '键鼠/手柄'],
    path: 'games/turbo-drift/index.html',
  },
```

- [ ] **Step 5: 创建 README.md**

```markdown
# 极速飞车 TURBO DRIFT 🏎️

伪3D 第三人称漂移竞速。从下往上开，和 3 个 AI 比名次，3 圈定胜负。漂移攒氮气、道具战、4 条主题赛道、4 辆解锁车。专为 7 岁友好调校。

## 操作
- 转向：← → / A D / 手柄左摇杆
- 加速：↑ / W / 手柄 RT（松手也有巡航底速，不熄火）
- 漂移：空格（按住 + 转向）/ 手柄 L1 —— 攒满放氮气
- 道具：Z / ↓ / 手柄 □
- 氮气：Shift / 手柄 R1
- 暂停：Esc

## 运行
项目根目录 `./start.sh`，浏览器开 `games/turbo-drift/index.html`（须经 http，不能 file://）。

## 测试
`cd games/turbo-drift && node --test`
```

- [ ] **Step 6: 冒烟验证链路**

Run: `cd /Users/james/Projects/game-hub && ./start.sh 8123 &`（或已运行的服务器），浏览器打开 `http://localhost:8123/games/turbo-drift/index.html`
Expected: 看到深蓝背景 + 「TURBO DRIFT — 脚手架就绪」，左上「← HUB」可返回；HUB 首页出现「极速飞车」卡片可进入。

- [ ] **Step 7: Commit**

```bash
git add games/turbo-drift js/games.js
git commit -m "feat(turbo-drift): scaffold game dir, HTML shell, hub registration"
```

---

## Task 1: config.js + util/math.js（含投影）TDD

**Files:**
- Create: `games/turbo-drift/src/config.js`
- Create: `games/turbo-drift/src/util/math.js`
- Test: `games/turbo-drift/tests/math.test.mjs`

- [ ] **Step 1: 写 config.js（被测试与各模块引用的常量）**

```js
// games/turbo-drift/src/config.js
export const VIEW = { W: 640, H: 360 };

export const RENDER = {
  segLen: 200,      // 每段世界长度
  roadW: 2000,      // 赛道半宽（世界单位）
  camDepth: 0.84,   // 1/tan(fov/2)
  camH: 1500,       // 相机高度
  drawDist: 160,    // 绘制段数
  rumble: 5,        // 每几段一节路肩
};

export const PHYSICS = {
  maxSpeed: 12000,    // 基准极速（世界单位/秒）
  accel: 9000,        // 加速度
  brake: 16000,       // 主动减速
  cruise: 2600,       // 自动巡航底速（绝不熄火）
  offRoadMul: 0.5,    // 出界时的极速倍率
  steer: 2.4,         // 横向转向系数
  centrifugal: 0.0009,// 弯道把车甩向外侧的强度（乘 speed*curve）
  assistSteer: 0.5,   // 辅助转向强度（0..1）
};

export const DRIFT = {
  enterSteer: 0.35,        // 触发漂移的最小转向量
  chargeRate: 1.0,         // 每秒攒气
  tierThresholds: [0.5, 1.1, 1.8], // 1/2/满 档位的秒数
  maxCharge: 1.8,
  steerBoost: 1.5,         // 漂移时转向更灵
};

export const NITRO = {
  speedMul: 1.5,           // 氮气期间极速倍率
  accelMul: 2.2,
  durationByTier: [0, 0.8, 1.4, 2.4], // tier 0/1/2/3 的氮气时长（秒）
};

export const RACE = { laps: 3, racers: 4, countdownSec: 3 };

export const AI = {
  baseSkill: [0.9, 0.94, 0.98], // 三个对手的极速比例
  rubberAheadEase: 0.86,        // 玩家落后时，领先 AI 极速 ×
  rubberBehindBoost: 1.12,      // 玩家领先时，落后 AI 极速 ×
  rubberDeadZone: 1600,         // 里程差死区（之内不触发）
  itemUseChance: 0.5,
};

export const ITEMS = {
  boost:   { dur: 1.2, mul: 1.4 },
  shield:  { dur: 6 },
  oil:     { life: 8, spinDur: 1.0 },
  shrink:  { dur: 2.5, slowMul: 0.7 },
  missile: { spinDur: 1.0, speed: 26000 },
};
export const ITEM_KINDS = ['boost', 'shield', 'oil', 'shrink', 'missile'];
```

- [ ] **Step 2: 写失败测试 math.test.mjs**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, wrap, project } from '../src/util/math.js';
import { RENDER, VIEW } from '../src/config.js';

test('clamp & lerp', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('wrap keeps value in [0, n)', () => {
  assert.equal(wrap(5, 4), 1);
  assert.equal(wrap(-1, 4), 3);
  assert.equal(wrap(0, 4), 0);
});

test('project: nearer segment is bigger and lower on screen', () => {
  const cam = { x: 0, y: RENDER.camH, z: 0 };
  const near = project(cam, { x: 0, y: 0, z: 1000 });
  const far  = project(cam, { x: 0, y: 0, z: 8000 });
  assert.ok(near.scale > far.scale, 'near scale larger');
  assert.ok(near.w > far.w, 'near width larger');
  assert.ok(near.y > far.y, 'near is lower (greater y) on screen');
  assert.equal(near.x, VIEW.W / 2, 'centered x when worldX==camX');
});

test('project: positive worldX shifts right on screen', () => {
  const cam = { x: 0, y: RENDER.camH, z: 0 };
  const p = project(cam, { x: 500, y: 0, z: 2000 });
  assert.ok(p.x > VIEW.W / 2);
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd games/turbo-drift && node --test tests/math.test.mjs`
Expected: FAIL（`project` / `wrap` 未定义）

- [ ] **Step 4: 实现 util/math.js**

```js
// games/turbo-drift/src/util/math.js
import { RENDER, VIEW } from '../config.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrap = (v, n) => ((v % n) + n) % n;

// 伪3D 投影：相机坐标 cam{x,y,z}，世界点 world{x,y,z} → 屏幕 {x,y,w,scale}
export function project(cam, world) {
  const dz = world.z - cam.z;
  const scale = RENDER.camDepth / (dz <= 0 ? 0.0001 : dz);
  return {
    x: Math.round(VIEW.W / 2 + scale * (world.x - cam.x) * VIEW.W / 2),
    y: Math.round(VIEW.H / 2 - scale * (world.y - cam.y) * VIEW.H / 2),
    w: Math.round(scale * RENDER.roadW * VIEW.W / 2),
    scale,
  };
}

export function randFrom(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd games/turbo-drift && node --test tests/math.test.mjs`
Expected: PASS（4 个测试）

- [ ] **Step 6: Commit**

```bash
git add games/turbo-drift/src/config.js games/turbo-drift/src/util/math.js games/turbo-drift/tests/math.test.mjs
git commit -m "feat(turbo-drift): config + math utils with pseudo-3D projection (TDD)"
```

---

## Task 2: track.js — 4 条赛道几何与主题 TDD

**Files:**
- Create: `games/turbo-drift/src/track.js`
- Test: `games/turbo-drift/tests/track.test.mjs`

赛道模型：每条赛道由若干段 `{ curve, y, worldY }` 组成（`buildSegments(parts)` 用 cos 缓动累积），`length = segs.length * segLen`。含主题配色、道具箱段索引、装饰类型。

- [ ] **Step 1: 写失败测试 track.test.mjs**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, buildSegments } from '../src/track.js';
import { RENDER } from '../src/config.js';

test('there are exactly 4 tracks with required fields', () => {
  assert.equal(TRACKS.length, 4);
  for (const t of TRACKS) {
    assert.ok(t.id && t.name && t.theme, `track ${t.id} has id/name/theme`);
    assert.ok(Array.isArray(t.segs) && t.segs.length > 50, 'has segments');
    assert.ok(t.length === t.segs.length * RENDER.segLen, 'length matches segs');
    assert.ok(t.theme.sky && t.theme.road && t.theme.grass, 'theme colors present');
    assert.ok(Array.isArray(t.itemBoxes) && t.itemBoxes.length >= 3, 'has item boxes');
  }
});

test('item box segment indices are within the track', () => {
  for (const t of TRACKS) {
    for (const seg of t.itemBoxes) {
      assert.ok(seg >= 0 && seg < t.segs.length, `box ${seg} inside ${t.id}`);
    }
  }
});

test('worldY accumulates so the track has hills (not all flat)', () => {
  const t = TRACKS.find(x => x.id === 'track3'); // 沙漠：有大坡
  const ys = t.segs.map(s => s.worldY);
  const span = Math.max(...ys) - Math.min(...ys);
  assert.ok(span > 0, 'track3 has elevation change');
});

test('buildSegments produces worldY accumulation', () => {
  const segs = buildSegments([{ n: 3, curve: 0, hill: 100 }]);
  assert.equal(segs.length, 3);
  assert.ok(segs[2].worldY >= segs[0].worldY);
});

test('track1 (tutorial) is gentler than track4 (hardest) by max abs curve', () => {
  const maxAbs = t => Math.max(...t.segs.map(s => Math.abs(s.curve)));
  const t1 = TRACKS.find(x => x.id === 'track1');
  const t4 = TRACKS.find(x => x.id === 'track4');
  assert.ok(maxAbs(t1) < maxAbs(t4), 'track1 curves milder than track4');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd games/turbo-drift && node --test tests/track.test.mjs`
Expected: FAIL（`TRACKS` 未定义）

- [ ] **Step 3: 实现 track.js**

```js
// games/turbo-drift/src/track.js
import { RENDER } from './config.js';

// 用 cos 缓动把一段弯/坡平滑展开；返回 {curve,y,worldY}[]
export function buildSegments(parts) {
  const segs = [];
  for (const p of parts) {
    const n = p.n, curve = p.curve || 0, hill = p.hill || 0;
    for (let i = 0; i < n; i++) {
      const t = i / n;
      const ease = -Math.cos(t * Math.PI) / 2 + 0.5; // 0→1 平滑
      segs.push({ curve: curve * ease, y: hill * ease });
    }
  }
  let acc = 0;
  for (const s of segs) { acc += s.y; s.worldY = acc; }
  return segs;
}

function pickBoxes(segCount, count) {
  const boxes = [];
  for (let i = 1; i <= count; i++) boxes.push(Math.floor((segCount * i) / (count + 1)));
  return boxes;
}

const RAW = [
  {
    id: 'track1', name: '草原日间', theme: {
      sky: ['#5ec8ff', '#bfeaff'], grass: ['#4caf50', '#43a047'],
      road: ['#5a5a66', '#52525e'], rumble: ['#ff5555', '#ffffff'], deco: 'tree', night: false,
    },
    parts: [
      { n: 50, curve: 0, hill: 0 }, { n: 40, curve: 1.6 }, { n: 40, curve: 0, hill: 40 },
      { n: 40, curve: -1.6 }, { n: 40, curve: 0, hill: -40 }, { n: 50, curve: 1.2 }, { n: 40, curve: 0 },
    ],
  },
  {
    id: 'track2', name: '城市夜赛', theme: {
      sky: ['#0a0420', '#5e2a7e'], grass: ['#0d0a1f', '#120e28'],
      road: ['#23202e', '#1c1a26'], rumble: ['#00e5ff', '#ff2d95'], deco: 'neon', night: true,
    },
    parts: [
      { n: 44, curve: 0 }, { n: 40, curve: 2.2 }, { n: 36, curve: 0, hill: 50 },
      { n: 40, curve: -2.0 }, { n: 40, curve: 1.5, hill: -30 }, { n: 44, curve: -1.2 }, { n: 36, curve: 0 },
    ],
  },
  {
    id: 'track3', name: '沙漠黄昏', theme: {
      sky: ['#ff9a3c', '#ffd56b'], grass: ['#caa45a', '#b8924a'],
      road: ['#6b5a44', '#5e4e3a'], rumble: ['#ffffff', '#c0392b'], deco: 'cactus', night: false,
    },
    parts: [
      { n: 50, curve: 0, hill: 0 }, { n: 60, curve: 1.8, hill: 90 }, { n: 50, curve: -1.4, hill: -90 },
      { n: 40, curve: 2.4 }, { n: 50, curve: 0, hill: 60 }, { n: 40, curve: -2.0, hill: -60 }, { n: 40, curve: 0 },
    ],
  },
  {
    id: 'track4', name: '雪地夜境', theme: {
      sky: ['#0b1a3a', '#22406e'], grass: ['#dfe9f5', '#cdd9ea'],
      road: ['#3a4256', '#2f3648'], rumble: ['#9fd3ff', '#ffffff'], deco: 'pine', night: true, ice: true,
    },
    parts: [
      { n: 40, curve: 0 }, { n: 36, curve: 3.0 }, { n: 30, curve: -3.0 }, { n: 30, curve: 3.2, hill: 40 },
      { n: 30, curve: -2.6, hill: -40 }, { n: 40, curve: 2.0 }, { n: 30, curve: -3.0 }, { n: 30, curve: 0 },
    ],
  },
];

export const TRACKS = RAW.map(r => {
  const segs = buildSegments(r.parts);
  return {
    id: r.id, name: r.name, theme: r.theme, segs,
    length: segs.length * RENDER.segLen,
    itemBoxes: pickBoxes(segs.length, 4),
  };
});

export const trackById = id => TRACKS.find(t => t.id === id);
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd games/turbo-drift && node --test tests/track.test.mjs`
Expected: PASS（5 个测试）

- [ ] **Step 5: Commit**

```bash
git add games/turbo-drift/src/track.js games/turbo-drift/tests/track.test.mjs
git commit -m "feat(turbo-drift): 4 themed tracks with segment builder (TDD)"
```

---

## Task 3: cars.js — 车辆名册与解锁规则 TDD

**Files:**
- Create: `games/turbo-drift/src/cars.js`
- Test: `games/turbo-drift/tests/cars.test.mjs`

- [ ] **Step 1: 写失败测试 cars.test.mjs**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById, isUnlocked, unlockFor, TRACK_UNLOCKS } from '../src/cars.js';

test('4 cars, only lightning starts unlocked', () => {
  assert.equal(CARS.length, 4);
  const lightning = carById('lightning');
  assert.equal(lightning.unlock, null);
  assert.equal(CARS.filter(c => c.unlock === null).length, 1);
});

test('every car has top/accel/grip multipliers and a color', () => {
  for (const c of CARS) {
    assert.ok(c.top > 0 && c.accel > 0 && c.grip > 0, `${c.id} has stats`);
    assert.ok(typeof c.color === 'string');
  }
});

test('isUnlocked: locked car requires being in save.unlocked', () => {
  assert.equal(isUnlocked(carById('lightning'), { unlocked: [] }), true);
  assert.equal(isUnlocked(carById('blaze'), { unlocked: [] }), false);
  assert.equal(isUnlocked(carById('blaze'), { unlocked: ['blaze'] }), true);
});

test('unlockFor: top-3 finish unlocks that track car; 4th unlocks nothing', () => {
  assert.equal(unlockFor('track1', 1), 'blaze');
  assert.equal(unlockFor('track1', 3), 'blaze');
  assert.equal(unlockFor('track1', 4), null);
  assert.equal(unlockFor('track2', 2), 'gust');
  assert.equal(unlockFor('track3', 1), 'star');
  assert.equal(unlockFor('track4', 1), null); // 终极赛道不再发车
});

test('TRACK_UNLOCKS maps tracks 1-3 only', () => {
  assert.deepEqual(Object.keys(TRACK_UNLOCKS).sort(), ['track1', 'track2', 'track3']);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd games/turbo-drift && node --test tests/cars.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 cars.js**

```js
// games/turbo-drift/src/cars.js
export const CARS = [
  { id: 'lightning', name: '闪电', color: '#3aa0ff', top: 1.00, accel: 1.00, grip: 1.00, unlock: null },
  { id: 'blaze',     name: '烈焰', color: '#ff3b30', top: 1.15, accel: 1.00, grip: 0.85, unlock: 'track1' },
  { id: 'gust',      name: '疾风', color: '#3cd070', top: 1.00, accel: 1.20, grip: 1.15, unlock: 'track2' },
  { id: 'star',      name: '星耀', color: '#b388ff', top: 1.15, accel: 1.20, grip: 1.00, unlock: 'track3' },
];

export const carById = id => CARS.find(c => c.id === id);

export const isUnlocked = (car, save) => car.unlock === null || (save.unlocked || []).includes(car.id);

// 完成某赛道时解锁的车（赛道3解锁星耀；赛道4为终极挑战不再发车）
export const TRACK_UNLOCKS = { track1: 'blaze', track2: 'gust', track3: 'star' };

// place 为名次（1 最好）。前 3 名解锁该赛道对应车。
export function unlockFor(trackId, place) {
  if (place <= 3 && TRACK_UNLOCKS[trackId]) return TRACK_UNLOCKS[trackId];
  return null;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd games/turbo-drift && node --test tests/cars.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add games/turbo-drift/src/cars.js games/turbo-drift/tests/cars.test.mjs
git commit -m "feat(turbo-drift): car roster + top-3 unlock rules (TDD)"
```

---

## Task 4: save.js — localStorage 存档（注入 storage）TDD

**Files:**
- Create: `games/turbo-drift/src/save.js`
- Test: `games/turbo-drift/tests/save.test.mjs`

设计：`defaultSave()` / `loadSave(storage)` / `writeSave(storage, data)` / `applyResult(save, trackId, place, lapMs)` 纯函数 + `browserLoad/browserWrite` 薄封装。`storage` 接口 = `{ getItem, setItem }`，测试传内存假对象。

- [ ] **Step 1: 写失败测试 save.test.mjs**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, loadSave, writeSave, applyResult } from '../src/save.js';

function memStorage(init) {
  const m = new Map(init ? [['turbo-drift.save', JSON.stringify(init)]] : []);
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), _m: m };
}

test('defaultSave has only lightning unlocked', () => {
  const s = defaultSave();
  assert.deepEqual(s.unlocked, ['lightning']);
  assert.deepEqual(s.bestLap, {});
  assert.equal(s.lastCar, 'lightning');
});

test('loadSave returns default when storage empty', () => {
  assert.deepEqual(loadSave(memStorage()).unlocked, ['lightning']);
});

test('loadSave recovers from corrupt JSON', () => {
  const st = { getItem: () => '{bad json', setItem: () => {} };
  assert.deepEqual(loadSave(st).unlocked, ['lightning']);
});

test('applyResult: top-3 adds car, records best lap, no dupes', () => {
  let s = defaultSave();
  s = applyResult(s, 'track1', 1, 41200);
  assert.ok(s.unlocked.includes('blaze'));
  assert.equal(s.bestLap.track1, 41200);
  s = applyResult(s, 'track1', 4, 50000); // 慢且第4 → bestLap 不退步、不重复加车
  assert.equal(s.bestLap.track1, 41200);
  assert.equal(s.unlocked.filter(x => x === 'blaze').length, 1);
  s = applyResult(s, 'track1', 2, 39000); // 更快 → 更新 bestLap
  assert.equal(s.bestLap.track1, 39000);
});

test('writeSave persists JSON to storage', () => {
  const st = memStorage();
  writeSave(st, defaultSave());
  assert.ok(st.getItem('turbo-drift.save').includes('lightning'));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd games/turbo-drift && node --test tests/save.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 save.js**

```js
// games/turbo-drift/src/save.js
import { unlockFor } from './cars.js';

const KEY = 'turbo-drift.save';

export function defaultSave() {
  return { unlocked: ['lightning'], bestLap: {}, lastCar: 'lightning', progress: {} };
}

export function loadSave(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw);
    const def = defaultSave();
    return {
      unlocked: Array.isArray(d.unlocked) && d.unlocked.length ? d.unlocked : def.unlocked,
      bestLap: d.bestLap && typeof d.bestLap === 'object' ? d.bestLap : {},
      lastCar: typeof d.lastCar === 'string' ? d.lastCar : def.lastCar,
      progress: d.progress && typeof d.progress === 'object' ? d.progress : {},
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage, save) {
  try { storage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
  return save;
}

// 完赛结果合入存档（纯函数，返回新对象）
export function applyResult(save, trackId, place, lapMs) {
  const next = {
    unlocked: [...save.unlocked],
    bestLap: { ...save.bestLap },
    lastCar: save.lastCar,
    progress: { ...save.progress },
  };
  const car = unlockFor(trackId, place);
  if (car && !next.unlocked.includes(car)) next.unlocked.push(car);
  if (lapMs != null && (next.bestLap[trackId] == null || lapMs < next.bestLap[trackId])) {
    next.bestLap[trackId] = lapMs;
  }
  next.progress[trackId] = place === 1 ? 'win' : (place <= 3 ? 'podium' : 'raced');
  return next;
}

// 浏览器便捷封装
export const browserLoad = () => loadSave(window.localStorage);
export const browserWrite = save => writeSave(window.localStorage, save);
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd games/turbo-drift && node --test tests/save.test.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add games/turbo-drift/src/save.js games/turbo-drift/tests/save.test.mjs
git commit -m "feat(turbo-drift): localStorage save with injectable storage (TDD)"
```

---

## Task 5: player.js — 物理步进 + 辅助转向 TDD

**Files:**
- Create: `games/turbo-drift/src/player.js`
- Test: `games/turbo-drift/tests/player.test.mjs`

模型：玩家状态 `{ z, x, speed, spinTimer }`（`z`=沿赛道里程，`x`=横向 -1..1 为路面，`speed`=世界单位/秒）。`stepPlayer(state, input, ctx, dt)` 推进一步并返回新 state。`input = { throttle:bool, steer:-1..1, drifting:bool, nitro:0|1 }`。`ctx = { car, curve, onRoad, assist:bool }`。

- [ ] **Step 1: 写失败测试 player.test.mjs**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepPlayer } from '../src/player.js';
import { carById } from '../src/cars.js';
import { PHYSICS } from '../src/config.js';

const ctxFlat = { car: carById('lightning'), curve: 0, onRoad: true, assist: false };

test('throttle accelerates up toward car top speed', () => {
  let s = { z: 0, x: 0, speed: 0, spinTimer: 0 };
  for (let i = 0; i < 600; i++) s = stepPlayer(s, { throttle: true, steer: 0, drifting: false, nitro: 0 }, ctxFlat, 1 / 60);
  assert.ok(s.speed > PHYSICS.maxSpeed * 0.9, 'reaches near top speed');
  assert.ok(s.speed <= PHYSICS.maxSpeed * carById('lightning').top + 1, 'capped at car top');
});

test('auto-cruise: never stalls to zero even with no throttle', () => {
  let s = { z: 0, x: 0, speed: 5000, spinTimer: 0 };
  for (let i = 0; i < 600; i++) s = stepPlayer(s, { throttle: false, steer: 0, drifting: false, nitro: 0 }, ctxFlat, 1 / 60);
  assert.ok(s.speed >= PHYSICS.cruise - 1, 'settles at cruise floor, not zero');
});

test('steering moves x laterally', () => {
  let s = { z: 0, x: 0, speed: 8000, spinTimer: 0 };
  s = stepPlayer(s, { throttle: true, steer: 1, drifting: false, nitro: 0 }, ctxFlat, 0.2);
  assert.ok(s.x > 0, 'steer right increases x');
});

test('z advances by roughly speed*dt', () => {
  let s = { z: 0, x: 0, speed: 6000, spinTimer: 0 };
  s = stepPlayer(s, { throttle: true, steer: 0, drifting: false, nitro: 0 }, ctxFlat, 0.5);
  assert.ok(Math.abs(s.z - 3000) < 800, 'advanced roughly speed*dt');
});

test('spin: while spinning, speed bleeds and timer counts down', () => {
  let s = { z: 0, x: 0.5, speed: 9000, spinTimer: 1.0 };
  const before = s.speed;
  s = stepPlayer(s, { throttle: true, steer: 1, drifting: false, nitro: 0 }, ctxFlat, 1 / 60);
  assert.ok(s.spinTimer < 1.0, 'spin timer counts down');
  assert.ok(s.speed < before, 'loses speed while spinning');
});

test('nitro raises effective top speed above base cap', () => {
  let s = { z: 0, x: 0, speed: PHYSICS.maxSpeed, spinTimer: 0 };
  s = stepPlayer(s, { throttle: true, steer: 0, drifting: false, nitro: 1 }, ctxFlat, 0.3);
  assert.ok(s.speed > PHYSICS.maxSpeed, 'nitro pushes past base top');
});

test('assist steer limits outward drift on a curve', () => {
  let s = { z: 0, x: 0, speed: 9000, spinTimer: 0 };
  const ctx = { car: carById('lightning'), curve: 2, onRoad: true, assist: true };
  s = stepPlayer(s, { throttle: true, steer: 0, drifting: false, nitro: 0 }, ctx, 0.3);
  assert.ok(s.x > -0.6, 'assist keeps car from being flung too far outward');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd games/turbo-drift && node --test tests/player.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 player.js**

```js
// games/turbo-drift/src/player.js
import { PHYSICS, NITRO, DRIFT } from './config.js';
import { clamp } from './util/math.js';

// 单步推进玩家。返回新的 state（不可变更原对象）。
export function stepPlayer(state, input, ctx, dt) {
  let { z, x, speed, spinTimer } = state;
  const car = ctx.car;
  const baseTop = PHYSICS.maxSpeed * car.top;
  const top = input.nitro ? baseTop * NITRO.speedMul : baseTop;
  const topEff = ctx.onRoad ? top : top * PHYSICS.offRoadMul;

  if (spinTimer > 0) {
    spinTimer = Math.max(0, spinTimer - dt);
    speed = Math.max(PHYSICS.cruise * 0.4, speed - PHYSICS.brake * 1.4 * dt);
    z += speed * dt;
    return { z, x, speed, spinTimer };
  }

  // 纵向：油门加速 / 松油回落到巡航底速（绝不熄火）
  const accel = PHYSICS.accel * car.accel * (input.nitro ? NITRO.accelMul : 1);
  if (input.throttle) {
    speed += accel * dt;
  } else {
    if (speed > PHYSICS.cruise) speed -= PHYSICS.brake * 0.35 * dt;
    else speed += PHYSICS.accel * 0.5 * dt;
  }
  speed = clamp(speed, PHYSICS.cruise * 0.5, topEff);

  // 横向：转向 + 离心力 + 辅助转向
  const speedRatio = speed / baseTop;
  const driftMul = input.drifting ? DRIFT.steerBoost : 1;
  let dx = input.steer * PHYSICS.steer * driftMul * speedRatio * dt;
  dx -= ctx.curve * PHYSICS.centrifugal * speed * dt;                 // 离心：弯外
  if (ctx.assist) dx += ctx.curve * PHYSICS.centrifugal * speed * PHYSICS.assistSteer * dt; // 辅助：抵消部分
  dx *= (2 - car.grip);                                              // 抓地差→更滑

  x = clamp(x + dx, -1.8, 1.8);
  z += speed * dt;
  return { z, x, speed, spinTimer };
}

export function chargeToTier(charge) {
  const th = DRIFT.tierThresholds;
  if (charge >= th[2]) return 3;
  if (charge >= th[1]) return 2;
  if (charge >= th[0]) return 1;
  return 0;
}

// 漂移步进：返回 { state:{charge,active}, released:{tier,nitroDur}|null }
export function driftStep(drift, input, dt) {
  const engaging = input.drifting && Math.abs(input.steer) >= DRIFT.enterSteer;
  if (engaging) {
    const charge = Math.min(DRIFT.maxCharge, drift.charge + DRIFT.chargeRate * dt);
    return { state: { charge, active: true }, released: null };
  }
  if (drift.active) {
    const tier = chargeToTier(drift.charge);
    return { state: { charge: 0, active: false }, released: { tier, nitroDur: NITRO.durationByTier[tier] } };
  }
  return { state: { charge: 0, active: false }, released: null };
}
```

> 说明：`driftStep`/`chargeToTier` 与 `stepPlayer` 同文件，共享 `DRIFT/NITRO` import（Task 6 的 drift 测试直接覆盖它们）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd games/turbo-drift && node --test tests/player.test.mjs`
Expected: PASS（7 个测试）

- [ ] **Step 5: Commit**

```bash
git add games/turbo-drift/src/player.js games/turbo-drift/tests/player.test.mjs
git commit -m "feat(turbo-drift): player physics with auto-cruise + assist steer (TDD)"
```

---

## Task 6: 漂移攒气→氮气 测试（覆盖 player.js 的 driftStep/chargeToTier）

**Files:**
- Test: `games/turbo-drift/tests/drift.test.mjs`

> `driftStep`/`chargeToTier` 已在 Task 5 的 player.js 实现。本任务补它们的针对性测试（TDD 顺序上可在 Task 5 写实现前先写，但为减少文件来回，这里单列）。

- [ ] **Step 1: 写测试 drift.test.mjs**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { driftStep, chargeToTier } from '../src/player.js';
import { DRIFT, NITRO } from '../src/config.js';

test('chargeToTier maps charge to 0..3 by thresholds', () => {
  assert.equal(chargeToTier(0), 0);
  assert.equal(chargeToTier(DRIFT.tierThresholds[0] + 0.01), 1);
  assert.equal(chargeToTier(DRIFT.tierThresholds[1] + 0.01), 2);
  assert.equal(chargeToTier(DRIFT.tierThresholds[2] + 0.01), 3);
});

test('holding drift with steer accumulates charge', () => {
  let d = { charge: 0, active: false };
  for (let i = 0; i < 60; i++) d = driftStep(d, { drifting: true, steer: 1 }, 1 / 60).state;
  assert.ok(d.active, 'is drifting');
  assert.ok(d.charge > DRIFT.chargeRate * 0.9, '~1s of charge');
});

test('drift needs steering input to engage', () => {
  const r = driftStep({ charge: 0, active: false }, { drifting: true, steer: 0 }, 1 / 60);
  assert.equal(r.state.active, false, 'no steer → no drift');
  assert.equal(r.state.charge, 0);
});

test('releasing drift returns a nitro burst sized by tier, then resets', () => {
  let d = { charge: 0, active: false };
  for (let i = 0; i < 90; i++) d = driftStep(d, { drifting: true, steer: -1 }, 1 / 60).state; // ~1.5s → tier 2
  const rel = driftStep(d, { drifting: false, steer: 0 }, 1 / 60);
  assert.ok(rel.released, 'released payload present');
  assert.equal(rel.released.tier, 2);
  assert.equal(rel.released.nitroDur, NITRO.durationByTier[2]);
  assert.equal(rel.state.charge, 0, 'charge reset');
  assert.equal(rel.state.active, false);
});

test('releasing with too-little charge gives tier 0 (no nitro)', () => {
  let d = { charge: 0, active: false };
  d = driftStep(d, { drifting: true, steer: 1 }, 1 / 60).state; // ~1 frame
  const rel = driftStep(d, { drifting: false, steer: 0 }, 1 / 60);
  assert.equal(rel.released.tier, 0);
  assert.equal(rel.released.nitroDur, 0);
});
```

- [ ] **Step 2: 跑测试确认通过**

Run: `cd games/turbo-drift && node --test tests/drift.test.mjs`
Expected: PASS（5 个测试）

- [ ] **Step 3: Commit**

```bash
git add games/turbo-drift/tests/drift.test.mjs
git commit -m "test(turbo-drift): drift charge -> nitro tiers"
```

---

## Task 7: race.js — 圈数、名次、倒计时、完赛 TDD

**Files:**
- Create: `games/turbo-drift/src/race.js`
- Test: `games/turbo-drift/tests/race.test.mjs`

模型：racer `{ id, z, lap, _prevZ }`。`progress(racer, trackLen) = lap*trackLen + wrap(z, trackLen)`。`rank(racers, trackLen)` 按 progress 降序返回 id 顺序。`updateLap(racer, trackLen)` 过线计圈（仅前进且越过 0 点）。`place(racers, trackLen, id)`。`RaceClock`。

- [ ] **Step 1: 写失败测试 race.test.mjs**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progress, rank, updateLap, RaceClock } from '../src/race.js';

const LEN = 10000;

test('progress combines laps and position', () => {
  assert.equal(progress({ lap: 0, z: 2500 }, LEN), 2500);
  assert.equal(progress({ lap: 2, z: 100 }, LEN), 20100);
});

test('rank orders racers by total progress (leader first)', () => {
  const rs = [
    { id: 'p', lap: 1, z: 500 },
    { id: 'a', lap: 1, z: 9000 },
    { id: 'b', lap: 2, z: 10 },
  ];
  assert.deepEqual(rank(rs, LEN), ['b', 'a', 'p']);
});

test('updateLap increments when crossing start line forward', () => {
  let r = { lap: 0, z: 200, _prevZ: 9800 };
  r = updateLap(r, LEN);
  assert.equal(r.lap, 1);
});

test('updateLap does NOT count on normal forward motion', () => {
  let r = { lap: 0, z: 5200, _prevZ: 5000 };
  r = updateLap(r, LEN);
  assert.equal(r.lap, 0);
});

test('updateLap ignores backward jitter (no reverse exploit)', () => {
  let r = { lap: 1, z: 9700, _prevZ: 9800 };
  r = updateLap(r, LEN);
  assert.equal(r.lap, 1);
});

test('RaceClock counts down then runs, reports elapsed', () => {
  const c = new RaceClock(3);
  assert.equal(c.phase, 'countdown');
  c.tick(1); c.tick(1); c.tick(1);
  assert.equal(c.phase, 'racing');
  c.tick(0.5);
  assert.ok(Math.abs(c.elapsedMs - 500) < 20);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd games/turbo-drift && node --test tests/race.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 race.js**

```js
// games/turbo-drift/src/race.js
import { wrap } from './util/math.js';

export const progress = (r, trackLen) => r.lap * trackLen + wrap(r.z, trackLen);

export function rank(racers, trackLen) {
  return [...racers]
    .sort((a, b) => progress(b, trackLen) - progress(a, trackLen))
    .map(r => r.id);
}

// 过起跑线计圈：上一帧在末段、这一帧绕回首段 → +1 圈。仅前进方向。
export function updateLap(racer, trackLen) {
  const prev = racer._prevZ ?? racer.z;
  const cur = racer.z;
  const prevW = wrap(prev, trackLen);
  const curW = wrap(cur, trackLen);
  let lap = racer.lap;
  if (cur > prev && prevW > trackLen * 0.6 && curW < trackLen * 0.4) lap += 1;
  return { ...racer, lap, _prevZ: cur };
}

export function place(racers, trackLen, id) {
  return rank(racers, trackLen).indexOf(id) + 1;
}

export class RaceClock {
  constructor(countdownSec) {
    this.phase = 'countdown';
    this.countdown = countdownSec;
    this.elapsedMs = 0;
  }
  tick(dt) {
    if (this.phase === 'countdown') {
      this.countdown -= dt;
      if (this.countdown <= 0) this.phase = 'racing';
    } else if (this.phase === 'racing') {
      this.elapsedMs += dt * 1000;
    }
    return this.phase;
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd games/turbo-drift && node --test tests/race.test.mjs`
Expected: PASS（6 个测试）

- [ ] **Step 5: Commit**

```bash
git add games/turbo-drift/src/race.js games/turbo-drift/tests/race.test.mjs
git commit -m "feat(turbo-drift): lap counting, ranking, race clock (TDD)"
```

---

## Task 8: ai.js — 走线 + 橡皮筋 TDD

**Files:**
- Create: `games/turbo-drift/src/ai.js`
- Test: `games/turbo-drift/tests/ai.test.mjs`

模型：`rubberMul(aiProgress, playerProgress, cfg)`、`aiTargetX(curve)`、`stepAI(ai, ctx, dt)`（ctx 含 car/curve/playerProgress/aiProgress/onRoad）。

- [ ] **Step 1: 写失败测试 ai.test.mjs**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rubberMul, aiTargetX, stepAI } from '../src/ai.js';
import { AI } from '../src/config.js';
import { carById } from '../src/cars.js';

test('rubberMul = 1 inside dead zone', () => {
  assert.equal(rubberMul(10000, 10000 + AI.rubberDeadZone - 1, AI), 1);
});

test('player far behind => leading AI eases (mul < 1)', () => {
  const mul = rubberMul(30000, 10000, AI); // AI 远在玩家前
  assert.ok(mul < 1 && mul >= AI.rubberAheadEase - 1e-9);
});

test('player far ahead => trailing AI boosts (mul > 1)', () => {
  const mul = rubberMul(10000, 30000, AI);
  assert.ok(mul > 1 && mul <= AI.rubberBehindBoost + 1e-9);
});

test('aiTargetX steers into the curve (apex), bounded', () => {
  assert.ok(aiTargetX(2) > 0, 'right curve → positive target');
  assert.ok(aiTargetX(-2) < 0, 'left curve → negative target');
  assert.ok(Math.abs(aiTargetX(99)) <= 1, 'bounded within road');
});

test('stepAI advances z forward and eases x toward apex', () => {
  let s = { z: 0, x: -1, speed: 6000, spinTimer: 0 };
  const ctx = { car: carById('gust'), curve: 2, playerProgress: 0, aiProgress: 0, onRoad: true };
  const before = s.x;
  s = stepAI(s, ctx, 1 / 60);
  assert.ok(s.z > 0, 'moved forward');
  assert.ok(s.x > before, 'x eased toward positive apex');
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd games/turbo-drift && node --test tests/ai.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 ai.js**

```js
// games/turbo-drift/src/ai.js
import { AI, PHYSICS } from './config.js';
import { clamp, lerp } from './util/math.js';

// 玩家落后 → 领先的 AI 减速等待；玩家领先 → 落后的 AI 加速追赶
export function rubberMul(aiProgress, playerProgress, cfg) {
  const diff = playerProgress - aiProgress; // >0: 玩家领先该 AI
  if (Math.abs(diff) < cfg.rubberDeadZone) return 1;
  if (diff > 0) return cfg.rubberBehindBoost; // 此 AI 落后 → 加速
  return cfg.rubberAheadEase;                 // 此 AI 领先 → 减速
}

// 理想走线：朝弯内切，限制在路面内
export function aiTargetX(curve) {
  return clamp(curve * 0.28, -0.9, 0.9);
}

export function stepAI(state, ctx, dt) {
  let { z, x, speed, spinTimer } = state;
  const car = ctx.car;
  const top = PHYSICS.maxSpeed * car.top * rubberMul(ctx.aiProgress, ctx.playerProgress, AI);

  if (spinTimer > 0) {
    spinTimer = Math.max(0, spinTimer - dt);
    speed = Math.max(PHYSICS.cruise * 0.4, speed - PHYSICS.brake * 1.2 * dt);
    z += speed * dt;
    return { z, x, speed, spinTimer };
  }

  const corner = 1 - Math.min(0.25, Math.abs(ctx.curve) * 0.05); // 过弯轻微减速
  speed += PHYSICS.accel * car.accel * dt;
  speed = clamp(speed, PHYSICS.cruise, top * corner);

  const target = aiTargetX(ctx.curve);
  x = lerp(x, target, Math.min(1, 3 * dt));
  z += speed * dt;
  return { z, x, speed, spinTimer };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd games/turbo-drift && node --test tests/ai.test.mjs`
Expected: PASS（5 个测试）

- [ ] **Step 5: Commit**

```bash
git add games/turbo-drift/src/ai.js games/turbo-drift/tests/ai.test.mjs
git commit -m "feat(turbo-drift): AI line-follow + rubber-band (TDD)"
```

---

## Task 9: items.js — 道具效果与时长 TDD

**Files:**
- Create: `games/turbo-drift/src/items.js`
- Test: `games/turbo-drift/tests/items.test.mjs`

模型：`rollItem(rng)`、`applyHit(target, spinDur)`（有护盾消耗护盾、否则打转；永不淘汰）、`missileTarget(racers, trackLen, selfId)`（名次紧邻 self 前一名）。

- [ ] **Step 1: 写失败测试 items.test.mjs**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollItem, applyHit, missileTarget, ITEM_KINDS } from '../src/items.js';
import { ITEMS } from '../src/config.js';

test('rollItem returns a known kind', () => {
  const seq = [0, 0.25, 0.5, 0.75, 0.99]; let i = 0;
  const rng = () => seq[i++ % seq.length];
  for (let k = 0; k < 5; k++) assert.ok(ITEM_KINDS.includes(rollItem(rng)));
});

test('applyHit sets spin and never removes the racer', () => {
  const t = { id: 'a', spinTimer: 0, shield: 0 };
  const after = applyHit(t, ITEMS.missile.spinDur);
  assert.equal(after.spinTimer, ITEMS.missile.spinDur);
  assert.ok('id' in after, 'racer still exists (not eliminated)');
});

test('shield blocks the hit and is consumed instead of spinning', () => {
  const t = { id: 'a', spinTimer: 0, shield: 5 };
  const after = applyHit(t, ITEMS.missile.spinDur);
  assert.equal(after.spinTimer, 0, 'no spin when shielded');
  assert.equal(after.shield, 0, 'shield consumed');
});

test('missileTarget hits the racer one place ahead of self', () => {
  const racers = [
    { id: 'a', lap: 1, z: 9000 },
    { id: 'b', lap: 1, z: 6000 },
    { id: 'self', lap: 1, z: 3000 },
    { id: 'c', lap: 1, z: 1000 },
  ];
  assert.equal(missileTarget(racers, 10000, 'self'), 'b');
});

test('missileTarget returns null when self is the leader', () => {
  const racers = [{ id: 'self', lap: 2, z: 100 }, { id: 'b', lap: 1, z: 100 }];
  assert.equal(missileTarget(racers, 10000, 'self'), null);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd games/turbo-drift && node --test tests/items.test.mjs`
Expected: FAIL

- [ ] **Step 3: 实现 items.js**

```js
// games/turbo-drift/src/items.js
import { ITEM_KINDS } from './config.js';
import { rank } from './race.js';

export { ITEM_KINDS };

export function rollItem(rng) {
  return ITEM_KINDS[Math.floor(rng() * ITEM_KINDS.length)];
}

// 命中：有护盾则消耗护盾、不打转；否则设打转计时。永不淘汰。
export function applyHit(target, spinDur) {
  if (target.shield && target.shield > 0) {
    return { ...target, shield: 0 };
  }
  return { ...target, spinTimer: Math.max(target.spinTimer || 0, spinDur) };
}

// 名次紧邻 self 前一名的 racer id；self 是头名则 null
export function missileTarget(racers, trackLen, selfId) {
  const order = rank(racers, trackLen); // leader first
  const idx = order.indexOf(selfId);
  if (idx <= 0) return null;
  return order[idx - 1];
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd games/turbo-drift && node --test tests/items.test.mjs`
Expected: PASS（5 个测试）

- [ ] **Step 5: 跑全部单测回归**

Run: `cd games/turbo-drift && node --test`
Expected: 所有单测文件 PASS

- [ ] **Step 6: Commit**

```bash
git add games/turbo-drift/src/items.js games/turbo-drift/tests/items.test.mjs
git commit -m "feat(turbo-drift): item effects, shield, missile targeting (TDD)"
```

---

## Task 10: input.js — 键盘 + 手柄统一输入（浏览器层）

**Files:**
- Create: `games/turbo-drift/src/input.js`

无单测（浏览器 API）。参照 `games/jungle-blitz/src/input.js`，导出 `readInput()` 返回 `{ throttle, steer, drifting, item, nitro, pause }`（每帧调用，main.js 自行做边沿判定）。

- [ ] **Step 1: 实现 input.js**

```js
// games/turbo-drift/src/input.js
const keys = new Set();

window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

export function readInput() {
  let steer = 0;
  if (keys.has('arrowleft') || keys.has('a')) steer -= 1;
  if (keys.has('arrowright') || keys.has('d')) steer += 1;
  let throttle = keys.has('arrowup') || keys.has('w');
  let drifting = keys.has(' ');
  let nitro = keys.has('shift');
  let item = keys.has('z') || keys.has('arrowdown');
  let pause = keys.has('escape') || keys.has('p');

  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = [...pads].find(Boolean);
  if (pad) {
    const ax = pad.axes[0] || 0;
    if (Math.abs(ax) > 0.2) steer += ax;
    if (pad.buttons[14]?.pressed) steer -= 1;
    if (pad.buttons[15]?.pressed) steer += 1;
    if (pad.buttons[7]?.pressed || pad.buttons[0]?.pressed) throttle = true; // RT / ✕
    if (pad.buttons[4]?.pressed) drifting = true; // L1
    if (pad.buttons[5]?.pressed) nitro = true;    // R1
    if (pad.buttons[2]?.pressed) item = true;     // □
    if (pad.buttons[9]?.pressed) pause = true;    // Start
  }

  steer = Math.max(-1, Math.min(1, steer));
  return { throttle, steer, drifting, nitro, item, pause };
}
```

- [ ] **Step 2: 冒烟（人工）**

浏览器 console：`import('./src/input.js').then(m => setInterval(()=>console.log(m.readInput()),500))`，按方向键确认 steer/throttle 变化；插手柄确认摇杆生效。

- [ ] **Step 3: Commit**

```bash
git add games/turbo-drift/src/input.js
git commit -m "feat(turbo-drift): unified keyboard + gamepad input layer"
```

---

## Task 11: audio.js — Web Audio 程序化音效（浏览器层）

**Files:**
- Create: `games/turbo-drift/src/audio.js`

参照 `games/jungle-blitz/src/audio.js`。导出 `Audio` 对象。

- [ ] **Step 1: 实现 audio.js**

```js
// games/turbo-drift/src/audio.js
let ctx = null, muted = false;
let engineOsc = null, engineGain = null;

function ac() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }

function blip(freq, dur, type = 'triangle', vol = 0.15) {
  if (muted) return;
  try {
    const c = ac(); const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  } catch {}
}

export const Audio = {
  unlock() { try { ac().resume(); } catch {} },
  setMuted(m) { muted = m; if (m && engineGain) engineGain.gain.value = 0; },
  startEngine() {
    if (muted || engineOsc) return;
    try {
      const c = ac(); engineOsc = c.createOscillator(); engineGain = c.createGain();
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 80;
      engineGain.gain.value = 0.05;
      engineOsc.connect(engineGain).connect(c.destination); engineOsc.start();
    } catch {}
  },
  engine(speedRatio) {
    if (muted || !engineOsc) return;
    engineOsc.frequency.value = 70 + speedRatio * 180;
    engineGain.gain.value = 0.03 + speedRatio * 0.04;
  },
  stopEngine() { try { engineOsc && engineOsc.stop(); } catch {} engineOsc = null; engineGain = null; },
  drift() { blip(180, 0.08, 'sawtooth', 0.08); },
  nitro() { blip(520, 0.4, 'square', 0.16); },
  pickup() { blip(880, 0.12, 'triangle', 0.16); },
  hit() { blip(120, 0.25, 'square', 0.18); },
  countdownBeep(go) { blip(go ? 880 : 440, go ? 0.4 : 0.15, 'square', 0.2); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.18), i * 140)); },
};
```

- [ ] **Step 2: Commit**

```bash
git add games/turbo-drift/src/audio.js
git commit -m "feat(turbo-drift): procedural Web Audio engine/drift/nitro/sfx"
```

---

## Task 12: render.js — 伪3D 渲染（浏览器层，原型已验证）

**Files:**
- Create: `games/turbo-drift/src/render.js`

无单测（canvas）。把 brainstorm 原型的渲染逻辑产品化为 `render(ctx, world)`。

- [ ] **Step 1: 实现 render.js**

```js
// games/turbo-drift/src/render.js
import { RENDER, VIEW } from './config.js';
import { project } from './util/math.js';

function trap(ctx, x1, y1, w1, x2, y2, w2, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x1 - w1, y1); ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2); ctx.lineTo(x2 - w2, y2); ctx.closePath(); ctx.fill();
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill();
}

function drawCar(ctx, x, y, w, color, tilt = 0, glow = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt * 0.15);
  const h = w * 0.62;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath();
  ctx.ellipse(0, h * 0.2, w * 0.55, h * 0.18, 0, 0, 7); ctx.fill();
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
  ctx.fillStyle = color; rr(ctx, -w / 2, -h * 0.5, w, h * 0.7, 8); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; rr(ctx, -w * 0.3, -h * 0.4, w * 0.6, h * 0.32, 5);
  ctx.fillStyle = '#111'; rr(ctx, -w / 2 - 4, -h * 0.1, 8, h * 0.4, 3); rr(ctx, w / 2 - 4, -h * 0.1, 8, h * 0.4, 3);
  ctx.fillStyle = '#ffd54f'; ctx.fillRect(-w * 0.4, h * 0.1, w * 0.18, 5); ctx.fillRect(w * 0.22, h * 0.1, w * 0.18, 5);
  ctx.restore();
}

// world = { track, cam:{x,y,z}, player:{color,tilt,nitro}, ai:[{n,x,color}], boxes:[{n,x}], hud }
export function render(ctx, world) {
  const W = VIEW.W, H = VIEW.H;
  const track = world.track, segs = track.segs, N = segs.length, theme = track.theme;
  const cam = world.cam;
  const baseSeg = Math.floor(cam.z / RENDER.segLen) % N;

  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, theme.sky[0]); sky.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  // 赛道：从远到近，记录每段投影供精灵使用
  let x = 0, dx = 0, maxy = H;
  const proj = [];
  for (let n = 0; n < RENDER.drawDist; n++) {
    const idx = ((baseSeg + n) % N + N) % N;
    const s = segs[idx];
    const worldZ = (Math.floor(cam.z / RENDER.segLen) + n) * RENDER.segLen;
    dx += s.curve * 0.06; x += dx;
    const p = project({ x: cam.x - x * RENDER.roadW, y: cam.y, z: cam.z }, { x: 0, y: s.worldY, z: worldZ });
    proj[n] = { p };
    if (n === 0) continue;
    const prev = proj[n - 1].p;
    if (prev.y >= maxy || prev.scale <= 0) continue;
    maxy = prev.y;
    const dark = Math.floor(n / RENDER.rumble) % 2 === 0;
    const grass = dark ? theme.grass[0] : theme.grass[1];
    const road = dark ? theme.road[0] : theme.road[1];
    const rumble = dark ? theme.rumble[0] : theme.rumble[1];
    ctx.fillStyle = grass; ctx.fillRect(0, p.y, W, prev.y - p.y + 1);
    trap(ctx, prev.x, prev.y, prev.w, p.x, p.y, p.w, road);
    trap(ctx, prev.x, prev.y, prev.w * 1.12, p.x, p.y, p.w * 1.12, rumble);
    if (dark) trap(ctx, prev.x, prev.y, prev.w * 0.04, p.x, p.y, p.w * 0.04, '#f5f5f5');
  }

  // 道具箱（先画，远）
  ctx.textAlign = 'center';
  for (const b of world.boxes || []) {
    const pr = proj[b.n]; if (!pr || pr.p.scale <= 0) continue;
    ctx.font = `${Math.max(10, pr.p.w * 0.5)}px system-ui`;
    ctx.fillText('❓', pr.p.x + b.x * pr.p.w, pr.p.y);
  }
  // AI 车
  for (const a of world.ai || []) {
    const pr = proj[a.n]; if (!pr || pr.p.scale <= 0 || pr.p.y < H * 0.45) continue;
    drawCar(ctx, pr.p.x + a.x * pr.p.w, pr.p.y, pr.p.w * 0.9, a.color, 0, theme.night);
  }
  ctx.textAlign = 'left';

  // 玩家车 + 氮气尾焰
  const pl = world.player;
  if (pl.nitro) {
    ctx.fillStyle = 'rgba(0,229,255,0.7)';
    ctx.beginPath(); ctx.moveTo(W / 2 - 14, H - 14); ctx.lineTo(W / 2 + 14, H - 14);
    ctx.lineTo(W / 2, H - 14 + 22); ctx.fill();
  }
  drawCar(ctx, W / 2 + (pl.tilt || 0) * 40, H - 46, 150, pl.color, pl.tilt, pl.nitro);

  drawHud(ctx, world.hud);
}

function drawHud(ctx, hud) {
  if (!hud) return;
  const W = VIEW.W;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(12, 12, 160, 64);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui';
  ctx.fillText(`🏁 第 ${hud.place}/${hud.total} 名`, 22, 32);
  ctx.fillText(`圈 ${hud.lap}/${hud.laps}`, 22, 52);
  ctx.fillText(`⏱ ${hud.time}`, 100, 32);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(W - 172, 14, 160, 10);
  ctx.fillStyle = '#ffd54f'; ctx.fillRect(W - 172, 14, 160 * (hud.driftPct || 0), 10);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(W - 172, 28, 160, 10);
  ctx.fillStyle = '#00e5ff'; ctx.fillRect(W - 172, 28, 160 * (hud.nitroPct || 0), 10);
  if (hud.item) { ctx.font = '20px system-ui'; ctx.fillText(hud.item, W - 40, 66); }
}
```

> 说明：渲染按 `VIEW.W/H` 逻辑分辨率绘制，main.js 用 `ctx.setTransform` 缩放到实际像素（letterbox）。AI/道具箱的 `n`（相对当前 baseSeg 的段偏移）与 `x`（横向）由 main.js 每帧计算。

- [ ] **Step 2: import 冒烟（Node 解析）**

Run: `cd games/turbo-drift && node -e "import('./src/render.js').then(()=>console.log('ok')).catch(e=>{console.error(e);process.exit(1)})"`
Expected: 输出 `ok`（render.js 顶层只 import config/math，不触碰 document，可被 Node 解析）。

- [ ] **Step 3: Commit**

```bash
git add games/turbo-drift/src/render.js
git commit -m "feat(turbo-drift): pseudo-3D renderer (road/sprites/HUD)"
```

---

## Task 13: main.js — 状态机 + 主循环 + 浮层装配（浏览器层）

**Files:**
- Modify: `games/turbo-drift/src/main.js`（替换占位）

把所有模块组装成游戏。无单测；用 Task 14 的 Playwright 冒烟验证。

- [ ] **Step 1: 实现 main.js**

```js
// games/turbo-drift/src/main.js
import { VIEW, RENDER, RACE, AI, DRIFT, ITEMS } from './config.js';
import { TRACKS, trackById } from './track.js';
import { CARS, carById, isUnlocked } from './cars.js';
import { loadSave, writeSave, applyResult } from './save.js';
import { stepPlayer, driftStep } from './player.js';
import { stepAI } from './ai.js';
import { progress, updateLap, place, RaceClock } from './race.js';
import { rollItem, applyHit, missileTarget } from './items.js';
import { readInput } from './input.js';
import { render } from './render.js';
import { Audio } from './audio.js';
import { wrap, clamp } from './util/math.js';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let scale = 1, offX = 0, offY = 0;
function fit() {
  cv.width = cv.clientWidth; cv.height = cv.clientHeight;
  scale = Math.min(cv.width / VIEW.W, cv.height / VIEW.H);
  offX = (cv.width - VIEW.W * scale) / 2; offY = (cv.height - VIEW.H * scale) / 2;
}
new ResizeObserver(fit).observe(cv); fit();

const storage = window.localStorage;
let save = loadSave(storage);
let muted = false;

const $ = id => document.getElementById(id);
const overlays = ['menu', 'garage', 'track', 'pause', 'finish'];
function show(name) { overlays.forEach(o => $(`overlay-${o}`).classList.toggle('show', o === name)); state.screen = name; }
function hideAll() { overlays.forEach(o => $(`overlay-${o}`).classList.remove('show')); }

const state = {
  screen: 'menu', carId: save.lastCar || 'lightning', trackId: 'track1',
  player: null, ai: [], clock: null, drift: { charge: 0, active: false },
  nitroTimer: 0, item: null, boxesTaken: new Set(), oilSlicks: [], finishedPlace: 0,
  pausePrev: false, itemPrev: false,
};

function buildGarage() {
  const grid = $('garage-cars'); grid.innerHTML = '';
  for (const c of CARS) {
    const unlocked = isUnlocked(c, save);
    const card = document.createElement('div');
    card.className = 'garage-card' + (unlocked ? '' : ' locked') + (c.id === state.carId ? ' sel' : '');
    card.innerHTML = `<div class="swatch" style="background:${c.color}"></div>
      <div><b>${c.name}</b></div>
      <div class="stat">极速 ${'★'.repeat(Math.round(c.top * 3))} 加速 ${'★'.repeat(Math.round(c.accel * 3))}</div>
      <div class="stat">${unlocked ? '' : '🔒 通关解锁'}</div>`;
    if (unlocked) card.onclick = () => { state.carId = c.id; buildGarage(); };
    grid.appendChild(card);
  }
}

function buildTrackList() {
  const grid = $('track-list'); grid.innerHTML = '';
  for (const t of TRACKS) {
    const card = document.createElement('div');
    card.className = 'garage-card' + (t.id === state.trackId ? ' sel' : '');
    const best = save.bestLap[t.id];
    card.innerHTML = `<div><b>${t.name}</b></div>
      <div class="stat">${t.id === 'track4' ? '❄️ 最难' : ''}</div>
      <div class="stat">${best ? '最佳 ' + (best / 1000).toFixed(1) + 's' : '未完成'}</div>`;
    card.onclick = () => { state.trackId = t.id; startRace(); };
    grid.appendChild(card);
  }
}

function startRace() {
  hideAll();
  const car = carById(state.carId);
  state.player = { id: 'player', z: 0, x: 0, speed: 0, spinTimer: 0, shield: 0, lap: 0, _prevZ: 0, color: car.color, car };
  const oppCars = CARS.filter(c => c.id !== car.id).slice(0, 3);
  state.ai = oppCars.map((c, i) => ({
    id: 'ai' + i, z: -(i + 1) * 300, x: (i - 1) * 0.4, speed: 0, spinTimer: 0, shield: 0, lap: 0, _prevZ: 0,
    color: c.color, car: c, itemCooldown: 3 + i * 2,
  }));
  state.drift = { charge: 0, active: false }; state.nitroTimer = 0; state.item = null;
  state.boxesTaken = new Set(); state.oilSlicks = []; state.finishedPlace = 0;
  state.clock = new RaceClock(RACE.countdownSec);
  state.screen = 'racing';
  save.lastCar = state.carId; writeSave(storage, save);
  Audio.unlock(); Audio.startEngine();
  lastT = performance.now(); acc = 0;
}

let lastT = performance.now(), acc = 0;
const STEP = 1 / 60;
function loop(now) {
  const frameDt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (state.screen === 'racing') { acc += frameDt; while (acc >= STEP) { update(STEP); acc -= STEP; } }
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  const track = trackById(state.trackId);
  const len = track.length;
  const input = readInput();

  if (input.pause && !state.pausePrev) { state.pausePrev = true; pause(); return; }
  state.pausePrev = input.pause;

  const phase = state.clock.tick(dt);
  if (phase === 'countdown') return;

  const pseg = wrap(Math.floor(state.player.z / RENDER.segLen), track.segs.length);
  const curve = track.segs[pseg].curve;
  const onRoad = Math.abs(state.player.x) < 1.1;

  // 漂移 → 氮气
  const dr = driftStep(state.drift, { drifting: input.drifting, steer: input.steer }, dt);
  if (dr.state.active && !state.drift.active) Audio.drift();
  state.drift = dr.state;
  if (dr.released && dr.released.nitroDur > 0) { state.nitroTimer = dr.released.nitroDur; Audio.nitro(); }
  const nitroOn = state.nitroTimer > 0; if (nitroOn) state.nitroTimer = Math.max(0, state.nitroTimer - dt);

  // 玩家物理（倒计时结束后自动带油门底速，throttle 取按键或恒 true 保证不停）
  const np = stepPlayer(state.player,
    { throttle: input.throttle, steer: input.steer, drifting: state.drift.active, nitro: nitroOn ? 1 : 0 },
    { car: state.player.car, curve, onRoad, assist: true }, dt);
  Object.assign(state.player, np);
  if (state.player.shield > 0) state.player.shield = Math.max(0, state.player.shield - dt);
  const lapBefore = state.player.lap;
  Object.assign(state.player, updateLap(state.player, len));
  if (state.player.lap > lapBefore) state.boxesTaken.clear();

  // 道具箱拾取
  for (const segIdx of track.itemBoxes) {
    const boxZ = segIdx * RENDER.segLen;
    if (!state.boxesTaken.has(segIdx) && !state.item &&
        Math.abs(wrap(state.player.z, len) - boxZ) < RENDER.segLen) {
      state.item = rollItem(Math.random); state.boxesTaken.add(segIdx); Audio.pickup();
    }
  }
  if (input.item && state.item && !state.itemPrev) useItem(state.item);
  state.itemPrev = input.item;

  // AI
  const playerProg = progress(state.player, len);
  for (const a of state.ai) {
    const aseg = wrap(Math.floor(a.z / RENDER.segLen), track.segs.length);
    const acurve = track.segs[aseg].curve;
    Object.assign(a, stepAI(a, { car: a.car, curve: acurve, onRoad: true,
      playerProgress: playerProg, aiProgress: progress(a, len) }, dt));
    Object.assign(a, updateLap(a, len));
    a.itemCooldown -= dt;
    if (a.itemCooldown <= 0 && Math.random() < AI.itemUseChance * dt * 6) {
      a.itemCooldown = 7;
      const tgt = missileTarget([state.player, ...state.ai], len, a.id);
      hitRacer(tgt, ITEMS.oil.spinDur);
    }
  }

  // 油渍
  for (const oil of state.oilSlicks) {
    for (const r of [state.player, ...state.ai]) {
      if (Math.abs(wrap(r.z, len) - oil.z) < 120 && Math.abs(r.x - oil.x) < 0.3) hitRacerObj(r, ITEMS.oil.spinDur);
    }
    oil.life -= dt;
  }
  state.oilSlicks = state.oilSlicks.filter(o => o.life > 0);

  // 车-车碰撞（仅减速 + 轻推，永不出局）
  const all = [state.player, ...state.ai];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const A = all[i], B = all[j];
    if (Math.abs(wrap(A.z, len) - wrap(B.z, len)) < 100 && Math.abs(A.x - B.x) < 0.28) {
      A.speed *= 0.93; B.speed *= 0.93;
      const push = A.x < B.x ? 0.02 : -0.02; A.x -= push; B.x += push;
    }
  }

  Audio.engine(clamp(state.player.speed / 12000, 0, 1.4));

  if (state.player.lap >= RACE.laps && !state.finishedPlace) finishRace();
}

function useItem(kind) {
  const len = trackById(state.trackId).length;
  if (kind === 'boost') { state.nitroTimer = Math.max(state.nitroTimer, ITEMS.boost.dur); Audio.nitro(); }
  else if (kind === 'shield') { state.player.shield = ITEMS.shield.dur; }
  else if (kind === 'oil') { state.oilSlicks.push({ z: wrap(state.player.z - 150, len), x: state.player.x, life: ITEMS.oil.life }); }
  else if (kind === 'shrink') { for (const a of state.ai) a.speed *= ITEMS.shrink.slowMul; }
  else if (kind === 'missile') { hitRacer(missileTarget([state.player, ...state.ai], len, 'player'), ITEMS.missile.spinDur); }
  state.item = null; Audio.pickup();
}

function hitRacer(id, dur) {
  if (!id) return;
  if (id === 'player') return hitRacerObj(state.player, dur);
  const a = state.ai.find(x => x.id === id); if (a) hitRacerObj(a, dur);
}
function hitRacerObj(r, dur) {
  const res = applyHit({ spinTimer: r.spinTimer || 0, shield: r.shield || 0 }, dur);
  r.spinTimer = res.spinTimer; r.shield = res.shield;
  if (res.spinTimer > 0) Audio.hit();
}

function finishRace() {
  const len = trackById(state.trackId).length;
  const p = place([state.player, ...state.ai], len, 'player');
  state.finishedPlace = p; state.screen = 'finish';
  Audio.stopEngine(); if (p <= 3) Audio.win();
  const lapMs = Math.round(state.clock.elapsedMs / RACE.laps);
  const prevUnlocked = new Set(save.unlocked);
  save = applyResult(save, state.trackId, p, lapMs); writeSave(storage, save);
  const newCar = save.unlocked.find(c => !prevUnlocked.has(c));
  $('finish-title').textContent = p === 1 ? '🏆 第一名！' : (p <= 3 ? '🎉 上台领奖！' : '😺 完赛啦！');
  $('finish-place').textContent = `第 ${p} / ${RACE.racers} 名 · 用时 ${(state.clock.elapsedMs / 1000).toFixed(1)}s`;
  $('finish-unlock').textContent = newCar ? `🔓 解锁新车：${carById(newCar).name}！` : '';
  show('finish');
}

function pause() { show('pause'); }
function resume() { hideAll(); state.screen = 'racing'; lastT = performance.now(); acc = 0; }

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!state.player) return;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, offX, offY);
  ctx.beginPath(); ctx.rect(0, 0, VIEW.W, VIEW.H); ctx.clip();

  const track = trackById(state.trackId); const len = track.length;
  const baseSeg = wrap(Math.floor(state.player.z / RENDER.segLen), track.segs.length);
  const pZ = wrap(state.player.z, len);
  const aiSprites = state.ai.map(a => ({
    n: Math.round((wrap(a.z, len) - pZ + len) % len / RENDER.segLen), x: a.x, color: a.color,
  })).filter(s => s.n >= 0 && s.n < RENDER.drawDist);
  const boxes = track.itemBoxes.filter(b => !state.boxesTaken.has(b)).map(b => ({
    n: Math.round(((b * RENDER.segLen - pZ + len) % len) / RENDER.segLen), x: 0,
  })).filter(s => s.n >= 0 && s.n < RENDER.drawDist);

  const pPlace = place([state.player, ...state.ai], len, 'player');
  render(ctx, {
    track,
    cam: { x: state.player.x * RENDER.roadW, y: RENDER.camH + track.segs[baseSeg].worldY, z: state.player.z },
    player: { color: state.player.color, tilt: state.drift.active ? clamp(state.player.x * 0.4, -0.8, 0.8) : 0, nitro: state.nitroTimer > 0 },
    ai: aiSprites, boxes,
    hud: {
      place: pPlace, total: RACE.racers, lap: Math.min(state.player.lap + 1, RACE.laps), laps: RACE.laps,
      time: (state.clock.elapsedMs / 1000).toFixed(1), driftPct: state.drift.charge / DRIFT.maxCharge,
      nitroPct: clamp(state.nitroTimer / 2.4, 0, 1),
      item: state.item ? ({ boost: '🚀', shield: '🛡️', oil: '🍌', shrink: '⚡', missile: '🎯' })[state.item] : '',
    },
  });

  if (state.clock.phase === 'countdown') {
    const n = Math.ceil(state.clock.countdown);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 80px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(n > 0 ? n : 'GO!', VIEW.W / 2, VIEW.H / 2); ctx.textAlign = 'left';
  }
  ctx.restore();
}

// 浮层按钮
$('btn-play').onclick = () => { buildGarage(); show('garage'); };
$('btn-garage-go').onclick = () => { buildTrackList(); show('track'); };
$('btn-garage-back').onclick = () => show('menu');
$('btn-track-back').onclick = () => { buildGarage(); show('garage'); };
$('btn-resume').onclick = resume;
$('btn-restart').onclick = startRace;
$('btn-next').onclick = () => { buildTrackList(); show('track'); };
$('btn-finish-menu').onclick = () => { refreshMenu(); show('menu'); };
$('btn-mute').onclick = () => { muted = !muted; Audio.setMuted(muted); $('btn-mute').textContent = muted ? '🔇' : '🔊'; };
window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'm') $('btn-mute').click(); });

function refreshMenu() {
  const best = Object.entries(save.bestLap).map(([k, v]) => `${trackById(k)?.name || k} ${(v / 1000).toFixed(1)}s`).join(' · ');
  $('menu-best').textContent = `🏆 已解锁 ${save.unlocked.length}/4 车${best ? ' · ' + best : ''}`;
}
refreshMenu(); show('menu'); requestAnimationFrame(loop);
```

- [ ] **Step 2: 冒烟（人工）**

`./start.sh 8123`，开 `http://localhost:8123/games/turbo-drift/index.html`：开始 → 选车（锁定灰显）→ 选赛道 → 倒计时 3-2-1-GO → 能开/转向/漂移攒槽/松手氮气/吃道具箱/HUD 名次圈数更新 → 跑完 3 圈进结算 → 前 3 名解锁提示 → 返回。
Expected: 全链路可玩，无 console 报错。

- [ ] **Step 3: Commit**

```bash
git add games/turbo-drift/src/main.js
git commit -m "feat(turbo-drift): wire state machine, race loop, overlays"
```

---

## Task 14: Playwright 冒烟测试

**Files:**
- Create: `games/turbo-drift/tests/smoke.spec.mjs`

- [ ] **Step 1: 写冒烟测试**

```js
// games/turbo-drift/tests/smoke.spec.mjs
import { test, expect } from '@playwright/test';

const URL = process.env.HUB_URL || 'http://localhost:8123/games/turbo-drift/index.html';

test('enters race without page errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL);
  await page.click('#btn-play');
  await expect(page.locator('#overlay-garage')).toHaveClass(/show/);
  await page.click('#btn-garage-go');
  await expect(page.locator('#overlay-track')).toHaveClass(/show/);
  await page.locator('#track-list .garage-card').first().click();
  await page.waitForTimeout(5000);
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(2000);
  await page.keyboard.up('ArrowUp');
  expect(errors, 'no page errors').toEqual([]);
});
```

- [ ] **Step 2: 跑冒烟**

另开终端 `./start.sh 8123`，然后 Run: `cd games/turbo-drift && npx playwright test tests/smoke.spec.mjs`
Expected: PASS（无页面错误）。若项目未配置 Playwright，可用 `agent-browser` skill 手动按同样步骤操作并截图确认。

- [ ] **Step 3: Commit**

```bash
git add games/turbo-drift/tests/smoke.spec.mjs
git commit -m "test(turbo-drift): playwright smoke for race entry"
```

---

## Task 15: 平衡与手感调校 + 全量回归 + 收尾

**Files:**
- Modify: `games/turbo-drift/src/config.js`（数值微调）

- [ ] **Step 1: 7 岁友好调校（人工试玩逐项确认，按需调 config.js）**

- 松开油门不熄火（巡航底速 OK）
- 漂移容易进入、不会失控自旋；满槽氮气有明显推背
- 一直撞墙也能完赛、AI 不会甩太远（橡皮筋生效）
- 道具不会让玩家被连续针对（必要时降 `AI.itemUseChance`）
- 4 条赛道难度递增、雪地最难仍可完赛
- 帧率桌面 ~60fps

- [ ] **Step 2: 全量单测回归**

Run: `cd games/turbo-drift && node --test`
Expected: 所有测试文件 PASS。

- [ ] **Step 3: 从 HUB 完整走查**

`./start.sh` → HUB 选「极速飞车」→ 完整玩一局 → 返回 HUB 正常。确认其他游戏卡片不受影响。

- [ ] **Step 4: Commit**

```bash
git add games/turbo-drift
git commit -m "balance(turbo-drift): kid-friendly tuning pass + docs"
```

---

## 自检（plan vs spec 覆盖）

- 伪3D 视角 → Task 1（project）+ Task 12（render）✓
- 漂移→氮气 → Task 5（实现）+ Task 6（测试）✓
- 4 主题赛道 → Task 2 ✓
- 道具战（含温和攻击/护盾/导弹定位）→ Task 9 + Task 13（装配）✓
- 多车解锁 → Task 3 + Task 4 ✓
- 3 圈 + 3 AI + 名次 → Task 7 ✓
- 橡皮筋 AI → Task 8 ✓
- 儿童护栏（巡航底速/撞车不出局/辅助转向/总能完赛）→ Task 5 + Task 13 ✓
- 键盘+手柄 → Task 10 ✓
- 音频 → Task 11 ✓
- 存档 → Task 4 ✓
- 注册到 HUB → Task 0 ✓
- 测试策略 → 各 Task TDD + Task 14 冒烟 ✓

**类型一致性：** `stepPlayer/stepAI` 均用 `{z,x,speed,spinTimer}`；`driftStep` 返回 `{state:{charge,active}, released:{tier,nitroDur}|null}`；`rank/place/progress/updateLap` 统一用 `{id,lap,z,_prevZ}` + trackLen；`applyHit` 用 `{spinTimer,shield}`；racer 在 main.js 里带 `shield` 字段，与 `applyHit`/护盾道具一致。

**装配层备注：** main.js（Task 13）依赖前序所有纯模块的真实签名；执行时若发现某处与纯模块签名不符，以纯模块（已单测）为准微调装配层。
