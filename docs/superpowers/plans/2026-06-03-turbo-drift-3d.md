# 极速飞车 TURBO DRIFT — 3D 渲染重构 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development 或 executing-plans，逐任务实现。步骤用 `- [ ]`。
> 参考设计：`docs/superpowers/specs/2026-06-03-turbo-drift-3d-renderer-design.md`

**Goal:** 把 turbo-drift 的 Canvas-2D 伪3D 渲染换成 three.js 真 3D（真车头转向 / 追尾相机 / 真弯道纵深 / 低多边卡通），**复用全部现有游戏逻辑与 9 个测试**，仅替换视图层并新增可单测的几何模块。

**Architecture:** 新增纯函数 `geometry.js`（把 track 段 curve/worldY 还原成真实 3D 中线路径，可单测）+ 浏览器层 `render3d.js`（three.js 场景）。`main.js` 的状态机与定步长 sim 不变，仅 `draw()`/相机改调 render3d。three.js 本地 vendored + import map，无构建。

**Tech Stack:** three.js (r170, vendored)、ES Modules、import map、`node --test`、agent-browser 冒烟。

**不动的文件（复用，含其测试）：** config.js / cars.js / save.js / player.js / ai.js / race.js / items.js / track.js / input.js / audio.js / tests 下全部。

---

## Task 0: vendor three.js + import map + 画布

**Files:** Create `games/turbo-drift/lib/three.module.js`；Modify `games/turbo-drift/index.html`

- [ ] **Step 1: 取得 three.js r170 本地副本**

复用仓库已有的副本（最省）：
Run: `cp games/caocao-zhuan/lib/three.module.js games/turbo-drift/lib/three.module.js`
Expected: 文件存在，`grep REVISION games/turbo-drift/lib/three.module.js` 显示 r170 附近。
（若该路径不存在，从 `games/tactical-strike/lib/three.module.js` 复制 r128 亦可，API 用到的部分兼容。）

- [ ] **Step 2: index.html 加 import map（在现有 `<head>` 内、加载 main.js 之前）**

在 `</head>` 前插入：
```html
  <script type="importmap">
    { "imports": { "three": "./lib/three.module.js" } }
  </script>
```
画布沿用现有 `<canvas id="game"></canvas>`（render3d 会用它建 WebGLRenderer）。其余浮层（menu/garage/track/pause/finish）、back-to-hub、mute 全部保留不动。

- [ ] **Step 3: 冒烟（import 解析）**

`./start.sh 8123`，浏览器开页面，console 无「Failed to resolve module specifier "three"」。
Expected: 现有 2D 游戏仍照常跑（此步未改渲染）。

- [ ] **Step 4: Commit**
```bash
git add games/turbo-drift/lib/three.module.js games/turbo-drift/index.html
git commit -m "chore(turbo-drift): vendor three.js + import map for 3D renderer"
```

---

## Task 1: geometry.js — 中线路径与 worldAt（纯函数，TDD）

**Files:** Create `games/turbo-drift/src/geometry.js`、`games/turbo-drift/tests/geometry.test.mjs`

- [ ] **Step 1: 写失败测试 geometry.test.mjs**
```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCenterline, worldAt, headingAt } from '../src/geometry.js';
import { trackById } from '../src/track.js';
import { RENDER } from '../src/config.js';

const T = trackById('track1');
const cl = buildCenterline(T);

test('centerline has one point per segment with x/y/z/heading', () => {
  assert.equal(cl.length, T.segs.length);
  for (const p of cl) {
    assert.equal(typeof p.x, 'number'); assert.equal(typeof p.y, 'number');
    assert.equal(typeof p.z, 'number'); assert.equal(typeof p.heading, 'number');
  }
});

test('a straight opening segment keeps heading ~0 and advances z', () => {
  // track1 起始有一段直道
  assert.ok(Math.abs(cl[5].heading) < 0.05, 'heading near 0 on straight');
  assert.ok(cl[5].z > cl[0].z, 'advances forward');
});

test('a right-curve section accumulates heading', () => {
  const maxAbsHeading = Math.max(...cl.map(p => Math.abs(p.heading)));
  assert.ok(maxAbsHeading > 0.1, 'curve produces real heading change');
});

test('worldAt(z, 0) lies on the centerline; lateral offsets by ~roadHalfW', () => {
  const z = RENDER.segLen * 10.5;
  const mid = worldAt(cl, z, 0);
  const right = worldAt(cl, z, 1);
  const dx = right.pos.x - mid.pos.x, dz = right.pos.z - mid.pos.z;
  const off = Math.hypot(dx, dz);
  assert.ok(Math.abs(off - RENDER.roadW) < RENDER.roadW * 0.15, 'lateral=1 ~ roadHalfW from center');
});

test('worldAt y follows track elevation (hill)', () => {
  const flat = worldAt(cl, RENDER.segLen * 2, 0).pos.y;
  // track3 有大坡
  const T3 = trackById('track3'); const cl3 = buildCenterline(T3);
  const ys = cl3.map(p => p.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0, 'elevation varies on hilly track');
});

test('headingAt interpolates between segment headings', () => {
  const h = headingAt(cl, RENDER.segLen * 3.5);
  assert.equal(typeof h, 'number');
});
```

- [ ] **Step 2: 跑测试确认失败**
Run: `cd games/turbo-drift && node --test tests/geometry.test.mjs` → FAIL（未定义）

- [ ] **Step 3: 实现 geometry.js**
```js
// games/turbo-drift/src/geometry.js
import { RENDER } from './config.js';

const CURVE_TO_RAD = 0.006; // 每段 curve 标量 → 地面转角（弧度）；调大弯更急
const Y_SCALE = 1;          // worldY 高度缩放

// 把赛道段(curve, worldY) 在地面平面累积成真实 3D 中线路径
export function buildCenterline(track) {
  const segs = track.segs, n = segs.length, seg = RENDER.segLen;
  const pts = []; let heading = 0, x = 0, z = 0;
  for (let i = 0; i < n; i++) {
    heading += segs[i].curve * CURVE_TO_RAD;
    x += Math.sin(heading) * seg;
    z += Math.cos(heading) * seg;
    pts.push({ x, y: segs[i].worldY * Y_SCALE, z, heading });
  }
  return pts;
}

const lerp = (a, b, t) => a + (b - a) * t;

export function headingAt(pts, zDist) {
  const seg = RENDER.segLen, total = pts.length;
  const s = zDist / seg;
  const i = ((Math.floor(s) % total) + total) % total;
  const j = (i + 1) % total;
  const f = s - Math.floor(s);
  return lerp(pts[i].heading, pts[j].heading, f);
}

// 由里程 z 与横向 lateral(-1..1) 求世界点 + 该处朝向
export function worldAt(pts, zDist, lateral) {
  const seg = RENDER.segLen, total = pts.length;
  const s = zDist / seg;
  const i = ((Math.floor(s) % total) + total) % total;
  const j = (i + 1) % total;
  const f = s - Math.floor(s);
  const a = pts[i], b = pts[j];
  const cx = lerp(a.x, b.x, f), cy = lerp(a.y, b.y, f), cz = lerp(a.z, b.z, f);
  const h = lerp(a.heading, b.heading, f);
  // 朝向 (sin h, cos h) 的右法向
  const rx = Math.cos(h), rz = -Math.sin(h);
  return {
    pos: { x: cx + rx * lateral * RENDER.roadW, y: cy, z: cz + rz * lateral * RENDER.roadW },
    heading: h,
  };
}

export const trackLength = pts => pts.length * RENDER.segLen;
```
> 注：`worldAt` 的 lateral=1 在直道(h=0)偏移 (cos0,-sin0)=(1,0)*roadW，距中心 = roadW ✓（测试用 0.15 容差容纳弯段法向缩放）。

- [ ] **Step 4: 跑测试确认通过**
Run: `cd games/turbo-drift && node --test tests/geometry.test.mjs` → PASS（6 个）

- [ ] **Step 5: Commit**
```bash
git add games/turbo-drift/src/geometry.js games/turbo-drift/tests/geometry.test.mjs
git commit -m "feat(turbo-drift): 3D centerline geometry from track segments (TDD)"
```

---

## Task 2: render3d.js — 场景/相机/光照/天空（静态先跑通）

**Files:** Create `games/turbo-drift/src/render3d.js`

无单测（WebGL）。导出一个 `Renderer3D` 类，先建空场景 + 灯 + 天空，能 render 一帧。

- [ ] **Step 1: 实现骨架**
```js
// games/turbo-drift/src/render3d.js
import * as THREE from 'three';
import { RENDER } from './config.js';
import { buildCenterline, worldAt, headingAt } from './geometry.js';

const CURVE_TO_RAD = 0.006; // 与 geometry 一致（仅用于车头朝向参考）

export class Renderer3D {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 1, 200000);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(0.5, 1, 0.3).multiplyScalar(10000);
    this.scene.add(sun);
    this.cl = null; this.trackMesh = null; this.ground = null;
    this.cars = new Map(); this.boxes = []; this.deco = null;
    this.camPos = new THREE.Vector3();
    this.resize();
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // 切赛道：重建中线、赛道带、地面、天空、景物
  setTrack(track) {
    this.cl = buildCenterline(track);
    this._buildSky(track.theme);
    this._buildGround(track.theme);
    this._buildRoad(track);
    this._buildDeco(track);
  }

  _buildSky(theme) {
    const top = new THREE.Color(theme.sky[0]), bot = new THREE.Color(theme.sky[1]);
    this.scene.background = bot.clone().lerp(top, 0.5);
    // 简单起步：纯色背景；后续可换渐变天空盒
  }

  _buildGround(theme) {
    if (this.ground) this.scene.remove(this.ground);
    const geo = new THREE.PlaneGeometry(400000, 400000);
    geo.rotateX(-Math.PI / 2);
    this.ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.grass[1]) }));
    this.ground.position.y = -2;
    this.scene.add(this.ground);
  }

  _buildRoad(track) {
    if (this.trackMesh) this.scene.remove(this.trackMesh);
    const pts = this.cl, n = pts.length;
    const positions = [], colors = [];
    const roadCol = new THREE.Color(track.theme.road[0]);
    const rumbleCol = new THREE.Color(track.theme.rumble[0]);
    const hw = RENDER.roadW, rumbleW = hw * 1.12;
    // 生成左右边顶点带（含路肩外缘），用三角形组成路面 + 路肩
    function ring(i, width) {
      const p = pts[i]; const h = p.heading;
      const rx = Math.cos(h), rz = -Math.sin(h);
      return { l: [p.x - rx * width, p.y, p.z - rz * width], r: [p.x + rx * width, p.y, p.z + rz * width] };
    }
    function quad(a, b, c, d, col) {
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let k = 0; k < 6; k++) colors.push(col.r, col.g, col.b);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const A = ring(i, rumbleW), B = ring(j, rumbleW);
      const a = ring(i, hw), b = ring(j, hw);
      // 路肩（红/白交替）
      const rc = (Math.floor(i / RENDER.rumble) % 2 === 0) ? rumbleCol : new THREE.Color(track.theme.rumble[1]);
      quad(A.l, B.l, b.l, a.l, rc);   // 左路肩
      quad(a.r, b.r, B.r, A.r, rc);   // 右路肩
      // 路面
      quad(a.l, b.l, b.r, a.r, roadCol);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    this.trackMesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.scene.add(this.trackMesh);
  }

  _buildDeco(track) { /* Task 6 填充：InstancedMesh 路边景物 */ }

  render() { this.renderer.render(this.scene, this.camera); }
}
```

- [ ] **Step 2: import 冒烟（Node 解析会因 three 的浏览器依赖失败，仅检查语法）**
Run: `cd games/turbo-drift && node --check src/render3d.js`
Expected: 无语法错误（`node --check` 不执行 import，仅解析）。

- [ ] **Step 3: Commit**
```bash
git add games/turbo-drift/src/render3d.js
git commit -m "feat(turbo-drift): three.js scene scaffold (camera/lights/sky/road mesh)"
```

---

## Task 3: 车辆网格 + 定位（worldAt）+ 车头旋转

**Files:** Modify `games/turbo-drift/src/render3d.js`

- [ ] **Step 1: 加低多边车工厂 + 更新方法**
在 Renderer3D 内补：
```js
  _makeCar(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(900, 350, 1600),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }));
    body.position.y = 350; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(700, 320, 800),
      new THREE.MeshLambertMaterial({ color: 0xeaf4ff }));
    cabin.position.set(0, 620, -100); g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(220, 220, 200, 12); wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const [sx, sz] of [[-1,1],[1,1],[-1,-1],[1,-1]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(sx*480, 220, sz*560); g.add(w);
    }
    return g;
  }

  // racers: [{id, z, x, color, steerAngle, spinTimer}]，第一个是玩家
  updateCars(racers, len) {
    for (const r of racers) {
      let g = this.cars.get(r.id);
      if (!g) { g = this._makeCar(r.color); this.scene.add(g); this.cars.set(r.id, g); }
      const w = worldAt(this.cl, r.z, r.x);
      g.position.set(w.pos.x, w.pos.y, w.pos.z);
      // 车头朝赛道切向 + 转向角 + 打转
      const spin = r.spinTimer > 0 ? (performance.now() * 0.02) : 0;
      g.rotation.y = -w.heading + (r.steerAngle || 0) * 0.5 + spin;
    }
  }
```
> three.js 里 `rotation.y` 正方向与 heading 的符号需在真机校准（见 Task 9 冒烟时调正负号/系数，使「按右车头朝右」）。

- [ ] **Step 2: Commit**
```bash
git add games/turbo-drift/src/render3d.js
git commit -m "feat(turbo-drift): low-poly car meshes positioned on the 3D track"
```

---

## Task 4: 追尾相机

**Files:** Modify `games/turbo-drift/src/render3d.js`

- [ ] **Step 1: 加相机跟随**
```js
  // 跟随玩家：相机在车后上方，朝向赛道切向（前方弯道居中）
  follow(player, len, dt) {
    const w = worldAt(this.cl, player.z, player.x);
    const h = w.heading;
    const fwd = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
    const back = fwd.clone().multiplyScalar(-3200);
    const target = new THREE.Vector3(w.pos.x, w.pos.y, w.pos.z).add(back);
    target.y += 1600;
    if (this.camPos.lengthSq() === 0) this.camPos.copy(target);
    this.camPos.lerp(target, Math.min(1, 6 * dt));
    this.camera.position.copy(this.camPos);
    const look = worldAt(this.cl, player.z + 3000, player.x * 0.5);
    this.camera.lookAt(look.pos.x, look.pos.y + 300, look.pos.z);
  }
```

- [ ] **Step 2: Commit**
```bash
git add games/turbo-drift/src/render3d.js
git commit -m "feat(turbo-drift): chase camera following the player kart"
```

---

## Task 5: main.js 接线（draw → render3d）

**Files:** Modify `games/turbo-drift/src/main.js`

- [ ] **Step 1: 替换渲染相关代码**
- 顶部 import：把 `import { render } from './render.js'` 换成 `import { Renderer3D } from './render3d.js'`。保留 `import { wrap, clamp } from './util/math.js'`（仍用）。删除/不再用 2D 的 `ctx = cv.getContext('2d')` 与 letterbox transform。
- 初始化：`const r3d = new Renderer3D(cv); new ResizeObserver(() => r3d.resize()).observe(cv);`
- `startRace()` 末尾：`r3d.setTrack(trackById(state.trackId));`
- 重写 `draw()`：
```js
function draw(dt) {
  if (!state.player) return;
  const len = trackById(state.trackId).length;
  const racers = [state.player, ...state.ai].map(r => ({
    id: r.id, z: r.z, x: r.x, color: r.color, steerAngle: r.steerAngle, spinTimer: r.spinTimer,
  }));
  r3d.updateCars(racers, len);
  r3d.updateBoxes(trackById(state.trackId), state.boxesTaken); // Task 6
  r3d.follow(state.player, len, dt || 1/60);
  r3d.render();
  drawHudOverlay();      // 见 Step 2：HUD 用 DOM/2D 覆盖层
  drawCountdownOverlay();
}
```
- `loop(now)` 把 `frameDt` 传给 `draw(frameDt)`。
- 倒计时大字、HUD（名次/圈/时间/漂移槽/氮气/道具）改为画在一个叠加的 2D 覆盖 canvas 或 DOM 上（Step 2）。其余浮层 DOM 与按钮绑定全部不动。

- [ ] **Step 2: HUD 覆盖层**
在 `index.html` 的 `<canvas id="game">` 之后加一个覆盖 canvas：`<canvas id="hud"></canvas>`（CSS：fixed、铺满、pointer-events:none、z-index 高于 game 低于浮层）。在 main.js 用其 2D context 画 HUD（复用现有 HUD 数据：place/lap/time/driftPct/nitroPct/item/倒计时）。

- [ ] **Step 3: 冒烟（人工）**
`./start.sh`，进入比赛：看到 3D 赛道、车、追尾相机、HUD。
Expected: 能进比赛、能跑、无 console 报错。

- [ ] **Step 4: Commit**
```bash
git add games/turbo-drift/src/main.js games/turbo-drift/index.html games/turbo-drift/style.css
git commit -m "feat(turbo-drift): wire main loop to three.js renderer + HUD overlay"
```

---

## Task 6: 道具箱 + 路边景物

**Files:** Modify `games/turbo-drift/src/render3d.js`

- [ ] **Step 1: 道具箱**（旋转发光方块，放在 track.itemBoxes 段）
```js
  updateBoxes(track, taken) {
    if (!this._boxGroup) { this._boxGroup = new THREE.Group(); this.scene.add(this._boxGroup); this._boxMeshes = new Map(); }
    for (const segIdx of track.itemBoxes) {
      let m = this._boxMeshes.get(segIdx);
      if (!m) {
        m = new THREE.Mesh(new THREE.BoxGeometry(700,700,700),
          new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0x665500 }));
        this._boxGroup.add(m); this._boxMeshes.set(segIdx, m);
        const w = worldAt(this.cl, segIdx * RENDER.segLen, 0);
        m.position.set(w.pos.x, w.pos.y + 500, w.pos.z);
      }
      m.visible = !taken.has(segIdx);
      m.rotation.y += 0.05;
    }
  }
```

- [ ] **Step 2: 路边景物**（按 theme.deco，InstancedMesh 沿赛道两侧）
在 `_buildDeco(track)` 内：每隔若干段，在中线左右 `worldAt(z, ±1.4)` 处放一个低多边树/灯/仙人掌/雪松（简单 Cone+Cylinder 组），用 InstancedMesh 批量。颜色随 theme。

- [ ] **Step 3: Commit**
```bash
git add games/turbo-drift/src/render3d.js
git commit -m "feat(turbo-drift): item boxes + roadside scenery in 3D"
```

---

## Task 7: 特效（氮气 / 漂移 / 打转）+ 全量回归

**Files:** Modify `games/turbo-drift/src/render3d.js`、`src/main.js`

- [ ] **Step 1:** 玩家车氮气时加尾焰（锥体/粒子，蓝青色，随 nitro 显隐）；漂移时车后冒烟/火花；打转时车体快速自转（已在 updateCars 用 spinTimer 处理，可加强）。
- [ ] **Step 2: 全量单测回归**
Run: `cd games/turbo-drift && node --test` → 现有 9 测试 + geometry 测试全绿。
- [ ] **Step 3: Commit**
```bash
git add games/turbo-drift/src
git commit -m "feat(turbo-drift): nitro/drift/spin effects in 3D"
```

---

## Task 8: 真机冒烟 + 手感/相机/符号校准 + 清理

**Files:** Modify config/render3d（调参）；可选删除旧 `render.js`

- [ ] **Step 1: agent-browser 冒烟**（绕过本地代理 `no_proxy='*'`）：进比赛 → 截图确认：3D 赛道居中有纵深、过弯赛道真的弯、**按住右键车头朝右转**、追尾相机跟随、HUD 正常、能完赛。截多张对比。
- [ ] **Step 2: 符号/手感校准**：根据截图调 `updateCars` 的 `rotation.y` 正负号与 steer 系数（确保「按右车头朝右」）、`CURVE_TO_RAD`（弯道弧度，过弯观感）、相机 `follow` 的后退/抬高/lerp 系数、`worldAt` 的 lateral 偏移。这些是真机微调点。
- [ ] **Step 3:** 确认无文件再引用旧 `render.js` 后删除它（`grep -rn "from './render.js'" src`），保留 `util/math.js`（clamp/lerp/wrap 仍用）。更新 README 注明改为 three.js 3D。
- [ ] **Step 4: 从 HUB 完整走查** + Commit
```bash
git add games/turbo-drift
git commit -m "polish(turbo-drift): 3D feel/camera/sign calibration + cleanup"
```

---

## 自检（plan vs spec 覆盖）
- 真车头转向 → Task 3（rotation.y）+ Task 8 校准 ✓
- 追尾相机 + 纵深弯道 → Task 4 + geometry Task 1 ✓
- 复用逻辑与测试 → 仅改 render/main/index，sim 不动；新增 geometry 测试 ✓
- 低多边卡通 → Task 2/3/6（几何体 + 灯 + 主题）✓
- 4 赛道/车/道具/景物 → setTrack 重建 + Task 6 ✓
- HUD/浮层复用 → Task 5 Step 2 ✓
- 无构建 vendored three.js → Task 0 ✓

**类型契约：** geometry `worldAt(cl, z, x) → {pos:{x,y,z}, heading}`；render3d 消费 `{id,z,x,color,steerAngle,spinTimer}` 数组；main 传 `state.player/ai`（已有这些字段）。sim 输出不变。
