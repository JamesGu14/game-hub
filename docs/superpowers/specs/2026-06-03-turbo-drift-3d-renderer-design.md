# 极速飞车 TURBO DRIFT — 3D 渲染重构设计文档

> 把 turbo-drift 的 Canvas-2D 伪3D 渲染换成 three.js 真 3D，**复用全部现有游戏逻辑与 52 个单测**。
> 方向：B（3D 重写渲染层、复用现有逻辑）。美术：简约低多边卡通 v1。
> 立项：2026-06-03（在 5 路架构分析之后）。

## 1. 背景与动机

现版 turbo-drift 是 OutRun 式 Canvas-2D 分段投影伪3D。两个不满：
- **转弯像平移、不像车头在转**——根因是车在代码里是无朝向的点、相机焊死在赛道中线（伪3D 投影只能把弯当成屏幕横移，无法绕相机旋转世界）。
- **画面风格不满意**——伪3D 无法做真车头旋转、真弯道、真相机、真光照。

架构分析结论：**手感与「真 3D 感」需要真 3D 引擎；但游戏逻辑（物理/AI/道具/漂移/解锁）与渲染无关、已被 52 测试覆盖，应原样复用。** 故只换渲染层。

## 2. 核心原则：只换视图层，逻辑与测试全保

**不动**（renderer-agnostic，含其单测）：
`config.js`、`cars.js`、`save.js`、`player.js`（stepPlayer/driftStep）、`ai.js`、`race.js`、`items.js`、`track.js`（赛道段数据 curve/worldY/itemBoxes/theme）、`input.js`、`audio.js`，以及 `tests/` 下全部 9 个测试文件。

**替换/新增**：
- 删除 2D 渲染用法：`render.js`（2D 梯形）、`util/math.js` 的 `project()`（伪3D 投影）不再被游戏使用（保留文件或删，见 §11）。
- 新增 `src/geometry.js`（**纯函数、可单测**）：把 track 段数据转成真实 3D 赛道中线路径。
- 新增 `src/render3d.js`（浏览器层）：three.js 场景、相机、赛道/车/道具/景物网格、每帧根据世界状态更新。
- 改写 `src/main.js` 的 `draw()` 与相机部分：状态机/定步长 sim 循环不变，渲染改调 render3d。
- `index.html` 增加 three.js import map + 调整画布；HUD 浮层沿用现有 DOM。

## 3. 坐标契约：sim 的 (z, x) → 真 3D 世界坐标

sim 用 `z`=沿赛道里程、`x`=横向归一化(-0.98..0.98，±1=路沿)。`geometry.js` 把每段的标量 `curve` 在地面平面累积成真实朝向，得到中线 3D 路径：

```
buildCenterline(track):
  heading = 0; pos = {x:0, z:0}
  for each segment i (worldZ = i*segLen):
    heading += segs[i].curve * CURVE_TO_RAD      // 弯度→地面转角
    pos.x   += sin(heading) * segLen
    pos.z   += cos(heading) * segLen
    point[i] = { x: pos.x, y: segs[i].worldY * Y_SCALE, z: pos.z, heading }
  return points[]   // 闭环跑道：可选首尾平滑
```

由里程 z 求世界点（线性插值相邻段）：
```
worldAt(z, lateral):
  seg = z / segLen; i = floor(seg); f = frac(seg)
  p = lerp(point[i], point[i+1], f); h = lerpAngle(headings)
  right = { x: cos(h), z: -sin(h) }           // 朝向的右法向
  return { x: p.x + right.x * lateral * roadHalfW,
           y: p.y,
           z: p.z + right.z * lateral * roadHalfW }, heading: h
```

- 玩家/AI 的网格位置 = `worldAt(racer.z, racer.x)`；车头朝向 = `headingAt(racer.z) + racer.steerAngle * STEER_YAW`（车头可见地转向）。
- 这样 `player.js/ai.js` 完全不改（仍输出 z/x/steerAngle），只是被放进真 3D 世界。
- `geometry.js` 是纯函数：单测断言「直段中线直、右弯朝向递增、闭环长度=段数×segLen、worldAt 在 lateral=±1 时偏移 roadHalfW」。

## 4. three.js 集成（无构建、本地 vendored）

沿用仓库既有模式（tactical-strike / caocao-zhuan 都本地 vendored three.js + import map）：
- 在 `games/turbo-drift/lib/three.module.js` 放一份 three（建议 r170，与 caocao-zhuan 一致）。
- `index.html` 加：
  ```html
  <script type="importmap">{ "imports": { "three": "./lib/three.module.js" } }</script>
  ```
- 源码 `import * as THREE from 'three'`。零构建、零 CDN 依赖、可离线。
- 注意：`lib/three.module.js` 体积 ~1.3MB，提交进 git（与现有两份一致）。

## 5. 场景构成（简约低多边卡通）

- **渲染器**：`WebGLRenderer({ canvas, antialias:true })`，`setPixelRatio`，`setSize`，随窗口自适应。
- **相机**：`PerspectiveCamera(fov~60)`。**追尾相机**：目标 = 玩家车后上方一点（沿赛道切向后退 `camBack`、抬高 `camHeight`），`camera.position.lerp(target, ~0.12)`，`lookAt(玩家车前方一点)`。相机朝向跟赛道切向（保证前方赛道居中、孩子不晕），玩家车相对它按 steerAngle 旋转 → **既看得见前方弯道、又看得见自车车头转向**。
- **光照**：`HemisphereLight`（天/地补光）+ 一盏 `DirectionalLight`（太阳，给低多边面柔和明暗，可选软阴影）。
- **天空**：场景背景用主题渐变（或一个大半球/天空盒），随赛道主题切换（草原蓝天 / 夜城紫 / 沙漠橙 / 雪地冷蓝）。
- **赛道网格**：由中线路径生成一条 3D 带状 mesh（左右各 roadHalfW）。路面深灰、两侧路肩红白（独立窄带或顶点色）、中线白虚线（贴花/小方块沿中线）。带轻微厚度或仅平面。坡度由中线 y 体现。
- **地面**：大平面（主题草色），或沿赛道两侧的地形带。
- **车**：低多边 = 车身 Box + 驾驶舱小 Box + 4 个轮子（Cylinder）+ 颜色用车的 `color`。玩家车 + 3 AI，复用 `cars.js` 颜色。可加车底 blob 阴影（贴地半透明圆）。
- **道具箱**：旋转的发光问号方块/八面体，放在 `track.itemBoxes` 段位置。
- **路边景物**（低成本大提升观感）：按 `theme.deco`（tree/neon/cactus/pine）沿赛道两侧用 `InstancedMesh` 摆低多边树/灯/仙人掌/雪松。
- **特效**：氮气尾焰（粒子或锥体）、漂移火花/烟、被击打转（车体旋转动画）。

## 6. HUD 与浮层

- 菜单/选车/选赛道/暂停/结算 浮层：**沿用现有 DOM 浮层与 main.js 绑定逻辑**，不动。
- 比赛内 HUD（名次 N/4、圈数、计时、漂移槽、氮气条、当前道具、倒计时大字）：用一个**叠在 three.js 画布上的 DOM/2D-canvas 覆盖层**绘制（复用现有 HUD 数据与逻辑），不放进 3D 场景，最省事。

## 7. 主循环改造（main.js）

状态机（menu→garage→track→countdown→racing→finish）、定步长 sim（stepPlayer/stepAI/driftStep/items/碰撞/race）**全部不变**。仅：
- `draw()` 改为：用 `geometry.worldAt` 把玩家/AI/道具/相机换算到 3D，更新各 mesh 的 position/rotation，调 `renderer.render(scene, camera)`。
- 切赛道时重建赛道 mesh + 主题（天空/景物/地面色）。
- 相机每帧 lerp 跟随。

## 8. 美术方向（v1 = 简约低多边卡通）

- 纯几何体 + 平面/标准材质 + 柔和光照 + 主题渐变天空。无外部模型/贴图。
- 目标观感：干净、现代独立游戏风、孩子讨喜；真 3D 纵深、真车头转向、真弯道。
- 后续可选：换 GLTF 车模型、加贴图/天空盒（独立素材任务，本期不做）。

## 9. 测试策略

- **新增** `tests/geometry.test.mjs`：纯函数中线/worldAt 的单测（直段、弯段朝向、闭环长度、lateral 偏移、坡度 y）。
- **保留** 现有 9 个测试文件全绿（逻辑未动）。
- render3d 浏览器层不单测：用 agent-browser 真机冒烟（进比赛、车头随转向旋转、过弯赛道在 3D 里弯、能完赛）+ 人工试玩手感。

## 10. 验收标准

1. 从 HUB 进入，three.js 场景渲染，返回 HUB 正常。
2. **车头随转向可见旋转**；过弯时赛道在 3D 里真的弯、相机跟切向、有纵深——「像在开车转弯」而非平移。
3. 键盘 + 手柄完整可玩（复用 input.js）。
4. 漂移攒氮气、道具战、4 赛道、4 解锁车、3 圈 3 AI、儿童护栏——行为与 2D 版一致（逻辑复用）。
5. 简约低多边卡通观感，主题各异，路边有景物。
6. 现有 9 测试 + 新 geometry 测试全绿。
7. 纯静态、本地 vendored three.js、无构建、可离线、经 http 访问。
8. 桌面 ~60fps。

## 11. 非目标 / 处置

- 不改任何游戏逻辑与其测试（纯复用）。
- 不引入构建步骤（保持无构建静态）。
- 不引入 babylon.js（仓库已标准化 three.js）。
- 不做 GLTF 模型/贴图/天空盒/动态阴影贴图（v1 用几何体 + 简单光照；列入后续）。
- 不做真实物理引擎（cannon/rapier）——会破坏 7 岁友好的护栏；继续用现有运动学 sim。
- 旧 `render.js` 与 `project()`：实现期保留文件不被引用（避免破坏可能的引用），收尾时若确认无引用再删除，并保留 `math.js` 的 clamp/lerp/wrap（仍被复用）。

## 12. 风险

- 中线由「伪3D 弯度标量」还原成真实地面曲线，闭环首尾需平滑对接（否则接缝突变）——geometry 里做端点缓和 + 单测覆盖。
- 现有 4 条赛道是为伪3D 设计的缓弯，在真 3D 里不会有发卡弯（够用；若想要更激进弯道是后续赛道设计任务）。
- vendored three.js +~1.3MB 进仓库（与现状一致，可接受）。
- 相机手感（lerp 系数、后退/抬高、是否跟车头 vs 跟切向）需真机调——按 §5 默认值起步，再微调。
