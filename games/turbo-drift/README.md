# 极速飞车 TURBO DRIFT 🏎️

真 3D（three.js）第三人称漂移竞速。和 3 个 AI 比名次，3 圈定胜负。真车头转向、真弯道纵深、追尾相机；漂移攒氮气、道具战、4 条主题赛道（草原 / 夜城霓虹 / 沙漠 / 雪夜）、4 辆解锁车。专为 7 岁友好调校。

## 操作
- 转向：← → / A D / 手柄左摇杆（车头会真的转向）
- 加速：↑ / W / 手柄 RT（松手也有巡航底速，不熄火）
- 漂移：空格（按住 + 转向）/ 手柄 L1 —— 攒满松开自动放氮气
- 道具：Z / ↓ / 手柄 □
- 暂停：Esc

## 运行
项目根目录 `./start.sh`，浏览器开 `games/turbo-drift/index.html`（须经 http，不能 file://）。纯静态、本地 vendored three.js（`lib/three.module.js` + import map），无构建、可离线。

## 测试
`cd games/turbo-drift && node --test`

## 架构
渲染层是 three.js 真 3D；游戏逻辑（物理 / AI / 漂移 / 道具 / 解锁）与渲染无关、原样复用、由单测覆盖。

- `src/geometry.js` — **纯函数**：把赛道段标量数据（curve/worldY）累积成真实 3D 中线路径（`buildCenterline` / `worldAt` / `headingAt`），可单测（`tests/geometry.test.mjs`）。
- `src/render3d.js` — 浏览器层：three.js 场景、追尾相机、赛道带 / 草坪裙边 / 车 / 道具箱 / 路边景物（InstancedMesh）/ 氮气漂移特效；每帧按 sim 状态更新。
- `src/main.js` — 状态机 + 定步长 sim 循环不变，`draw()` 改调 render3d；HUD 用叠在画布上的 2D 覆盖层绘制。
- 不动的逻辑模块：`config / cars / save / player / ai / race / items / track / input / audio` 及其全部单测。
