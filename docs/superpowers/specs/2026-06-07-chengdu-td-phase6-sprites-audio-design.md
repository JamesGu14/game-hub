# 成都保卫战 — Phase 6 设计稿：战场美术 sprite + 音效（M4 表现层）

> 状态：brainstorming 定稿（2026-06-07，James 确认）。下一步 → writing-plans 出实现计划。
> 前置：Phase 1-5 已完成并 commit（核心循环/战斗系统/8 关战役/存档选关/UI 三国主题）。
> 本期 = 把战场实体从「色块占位」升级为「半写实卡通 sprite + UI 立绘」+ 程序音效。**纯表现层，不碰玩法/平衡/关卡。**

---

## 1. 目标 / 现状 / 决策

**现状**：`render/entityRenderer.js` 用色块画塔（`g.color` 方块 + 将名首字）、圆画敌兵；`core/assets.js` 是空 stub（`preload()` 立即就绪）；UI 卡片用色块头像（Phase 5）。`render/board.js` 程序绘制草地/蜀道/成都/敌营。

**目标观感**：类《王国保卫战》——近正俯视盘面 + billboard 半写实卡通武将/兵立绘；六将各具辨识（关羽红脸长髯青龙刀、张飞豹头环眼、赵云白袍银枪、马超狮盔银甲、黄忠老将硬弓、诸葛羽扇纶巾）。

**已确认决策（brainstorming）**：
1. **产线** = Gemini API key → Nano Banana（Gemini 2.5 Flash Image）**免费层**（500/天）生成；fal.ai 作退路。**消费版 Gemini 订阅 ≠ API**，需在 Google AI Studio 单独建免费 API key。地区限制（中国大陆直连常被拒）待 James 在实现会话前确认可取得 key。
2. **画风** = 王国保卫战式半写实卡通（比例正常、细节丰富、厚描边、暖色调）。
3. **v1 范围** = 核心集·打通管线（南蛮战役 L1-3 全覆盖），东吴/曹魏延后 v2。
4. **立绘** = 战场 sprite + UI 半身立绘（替换 Phase 5 色块头像）。
5. **音效** = 程序 WebAudio（SFX + 轻量 BGM + 静音），零音频素材、自包含。
6. **动画** = 变换补间（浮动/缩放/受击闪白），**不做逐帧动画**（§11）。

---

## 2. v1 资产清单（17 张核心 + 2 可选）

| 类别 | 资产 | 数量 |
|---|---|---|
| 六将战场 sprite | huang/zhang/guan/zhao/ma/zhuge | 6 |
| 六将 UI 半身立绘 | 同上（建造栏/塔面板用） | 6 |
| 南蛮兵种 sprite | footman 蛮兵 / wolf 狼骑 / tengjia 藤甲兵 | 3 |
| 南蛮 BOSS sprite | 木鹿大王(L2) / 兀突骨(L3) | 2 |
| *可选* props | 成都城楼 / 敌营 | 0–2 |

**延后 v2**：东吴兵种（吴卒/江东轻骑/楼船甲士/飞鸢/吴术士）+ BOSS（甘宁/陆逊）；曹魏兵种（魏卒/虎豹骑/重甲铁骑/斥候鹰/军师）+ BOSS（张辽/张郃/许褚/司马懿）；升阶立绘（v1 每将 1 张，升级靠现有 FX 表现）。

> 共享皮肤层（`data/factions.js`）：东吴/曹魏的 footman/wolf 等复用同 `enemyType` 的 sprite + 势力 tint 染色，**可大幅减少 v2 生成量**（同一兵种基底图，三势力换色/换旗）。v1 先按南蛮基底出，v2 评估是否换色复用 vs 重绘。

---

## 3. 关键安全网：优雅降级 ⭐

`entityRenderer` / UI：**有 sprite 用 `drawImage`，无 sprite 回退现有色块/圆/色块头像**。后果：
- L4-8（东吴/曹魏）在 v2 美术补齐前**照常可玩**（色块）。
- 美术可分批上线，游戏全程不破、可随时实玩验证。
- 单测覆盖「有图/无图」两条路径。

---

## 4. 技术架构

### 4.1 资源目录与契约
```
games/tower-defender/assets/sprites/
  generals/   huang.png zhang.png ...        # 战场 billboard（全身、透明底、居中、脚底锚点）
  portraits/  huang.png ...                  # UI 半身立绘（胸像、透明底）
  enemies/    nanman_footman.png wolf.png tengjia.png
  bosses/     mulu.png wutugu.png
  props/      chengdu.png camp.png           # 可选
```
- 格式：PNG 透明底。源分辨率统一（战场 sprite 512×512、立绘 512×640、BOSS 768×768；运行时缩放）。
- 命名契约：`generals/<generalId>.png`、`enemies/<enemyType>.png`（南蛮基底）、`bosses/<bossKey>.png`、`portraits/<generalId>.png`。
- 锚点约定：战场 sprite 角色**脚底**位于图像底部中线 → 贴图时锚到实体 `py`（billboard 立在格上）。

### 4.2 `core/assets.js`（真 preloader）
- 维护 manifest（id → 路径）；`preload()` 改为并行 `Image()` 加载，全部 settled 后 `assets.ready=true`。
- **缺图/加载失败不阻塞**：该项留空，渲染层回退。`assets.images[id]` 为 `HTMLImageElement|undefined`。
- `main.js` 已 `await preload()` 再 boot → 首帧前 sprite 就绪。

### 4.3 `render/entityRenderer.js`（sprite + 回退）
- `drawTower`：有 `assets.images['gen_'+id]` → billboard `drawImage`（脚底锚 `py`、按格宽缩放、保留投影椭圆）；**保留全部信息层**（血条不适用塔；等级金点/目标角标/招牌充能条/震慑灰罩/受击闪白）。无图 → 现色块。
- `drawEnemy`：同理（有图贴图 + 投影 + 状态染色叠加：减速蓝环/灼烧火点/定身/治疗十字/BOSS 金冠/血条/BOSS 名）；无图 → 现圆。东吴/曹魏用南蛮基底 sprite + 势力 tint 叠色（`globalCompositeOperation` 或半透色罩）。
- 变换补间：待机浮动（`sin(time)` 微缩放/位移）、出手缩放弹、受击闪白（命中时短暂白罩）。

### 4.4 y-sort（遮挡）
- `main.js` render：把当帧 towers + enemies 合并为绘制列表，按 `py` 升序排序后绘制（低 y 先画、被高 y 盖）。projectiles/fx 仍最后画。board 最先。

### 4.5 UI 立绘
- `ui/buildBar.js`：将牌头像区改用 `portraits/<id>`（缺图回退 Phase 5 色块+楷体首字）。
- `ui/towerPanel.js`：面板头用半身立绘（缺图回退色点）。
- `ui/resultPanel.js`：保留 Phase 5 朱印（已够好），v1 不强加立绘。

### 4.6 音效 `core/audio.js`（程序 WebAudio）
- 懒初始化（首次用户手势创建 AudioContext，避开 autoplay 限制）。
- `sfx(name)` 程序合成：开火（按攻击类型可微变）/命中/建造/升级/拆除/出兵/胜/败。
- 轻量 BGM：程序循环（oscillator/简单动机），暂停淡出。
- **静音**：复用 `save.settings.muted`（schema 已有字段）；开关入口加在**暂停菜单**（继续/重开/选关/静音/← HUB）。
- 事件驱动：挂 `eventBus`（`enemyKilled` 等）+ UI 动作直调。core/audio 只读事件，不改 gameState。

---

## 5. 生成产线（实现会话执行，不在本会话）

1. James 取得 Gemini API key（AI Studio 免费层）；或退 fal.ai。
2. **风格 preamble**（固定前缀保一致性）：`近正俯视 3/4 视角，半写实卡通，厚描边，暖色调，三国蜀汉，透明背景，角色居中全身，脚底在底部中线`。
3. **测试先行**：先生成 1 张（黄忠）→ James 确认风格 + 验 key → 定稿 preamble。
4. **一致性手法**：用过稿的黄忠做**参考图**喂后续生成（Nano Banana 支持图+文 → 统一画风/笔触/光照）。
5. 逐角色 specifics（§11 武将特征）→ 批量生成 → 去背/裁切/补边到契约尺寸 → 存 `assets/`。
6. 工具：`tools/gen-sprites.mjs`（curl Gemini API + 后处理）或 fal.ai skill；脚本可重跑单个角色。

---

## 6. 测试策略

| 测试 | 内容 |
|---|---|
| `assets.test`（mock Image） | manifest 加载 + 缺图降级（ready 仍 true、缺项 undefined） |
| `entityRenderer` sprite/回退 | 注入 assets stub：有图调 `drawImage`、无图走色块；信息层照画 |
| `ysort` 排序 | 纯函数：按 py 升序、稳定 |
| `audio.test`（stub AudioContext） | `sfx()` 不抛、muted 时不发声、懒初始化 |

> 渲染 helper 多为绘制：沿用 Phase 5 stub-ctx 风格测「不抛 + 行为分支」。

---

## 7. 不做（v1 边界）
- 东吴/曹魏 sprite + 名将 BOSS（v2）。
- 升阶立绘 variants（v1 每将 1 张）。
- 逐帧精灵动画（变换补间替代）。
- AI 生成 BGM 音频文件（程序 BGM）。
- 地形 tile 大改（board 草地/蜀道保留程序绘制；仅可选加成都/敌营 sprite）。
- 复杂转场/时间轴动画。

---

## 8. 铁律 / 风险

**自包含**：assets 在本游戏目录、无跨游戏 import；`gameState/gameLoop` 仍 render-free（`assets.js`/`audio.js` 属 core 资源/音频层，可触 `Image`/`AudioContext`）；无构建步骤（PNG 运行时加载）。

| 风险 | 缓解 |
|---|---|
| **美术一致性（最大）** | 风格 preamble + 参考图链式生成；v1 先核心集打通再铺量；测试先行 |
| Gemini key 地区受限（CN） | James 实现前确认；退路 fal.ai；再退路 James 手动出图按契约填 |
| 透明背景/去背质量 | Nano Banana 直出透明或后处理去背；契约固定尺寸/锚点 |
| sprite 缩小后辨识度 | 半写实 + 脸谱化特征（§11）；俯视 3/4 视角 |
| 性能（贴图+y-sort 每帧） | 实体数有限；Image 已解码；必要时离屏缓存静态 |

---

## 9. 验收标准
- [ ] 南蛮战役（L1-3）战场武将/兵/BOSS 显示为 sprite；UI 建造栏/塔面板显示立绘。
- [ ] 缺 sprite 的实体（L4-8）优雅回退色块、游戏可玩不报错。
- [ ] 程序音效（SFX + BGM + 静音）工作；静音持久化。
- [ ] y-sort 遮挡正确；变换补间动感（浮动/出手/受击）。
- [ ] 全量测试绿（含新增 assets/entityRenderer/ysort/audio）+ verify-levels 不回归 + check-imports 自包含 + 浏览器零 JS 错。
- [ ] `core/gameState`、`core/gameLoop` 仍 render-free；无构建步骤。
