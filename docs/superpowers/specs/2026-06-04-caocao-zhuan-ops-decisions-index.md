# 《群雄逐鹿·孟德篇》ops-decisions-index — 设计稿（待审）

> 原创致敬作（致敬《三国志曹操传》式 Web 战棋 RPG）。本稿是整套设计的**导航与裁决日志**，
> 不引入新玩法：①运维 / 性能与移动端预算；②**白纸黑字的关闭项**（明确不做 / 后置）；
> ③**设计总索引 README**（全部 ~21 份 specs 一行摘要 + 实现批次 0–7 顺序 + 跨稿冲突的最终裁决记录）。
> 与既有语料术语完全一致：五维 **攻/精/防/爆/士** + MP、十一系职业、计略 `kind/element`、天气、3 槽道具 + 印绶、
> faction、storyFlags、`scenarioRunner`/`battleController`/`leveling`/`ai`/`victory` 等既有命名。
> 状态：**待 James 审阅**。
>
> - 日期：2026-06-04 ｜ 作者：James（顾嘉晟）+ Claude ｜ 项目：game-hub / `games/caocao-zhuan/`
> - 对接现状（已读代码）：`src/main.js`(1223 行)、`render3d/{sceneManager,terrainFactory,unitFactory,fx,camera}.js`、
>   `battle/{victory,scenarioRunner…}`、`core/gameState.js`。本稿在其上做**预算与裁决**，不改玩法。

---

## 0. 本稿定位（读法）

这是「**裁决稿 + 导航稿**」：当任意两份设计稿在难度表、乘法叠加序、战场谓词、scenarioRunner 步、`victory.rout`、`guest` 字段
等问题上不一致时，**以本稿 §5 的裁决为准**；当需要知道某个系统在哪份 spec、属于哪个实现批次时，**查本稿 §4 的总索引**。
性能 / 关闭项（§2/§3）是工程护栏，写明上限与「明确不做」，避免实现期范围蔓延（呼应 master「长篇不烂尾」）。

---

## 1. 现状基线（性能相关，已测量）

| 维度 | 现状（读码所得） | 含义 |
|---|---|---|
| 第一章地图规模 | 10–12 列 × 8–9 行（≈ 80–108 格） | 单战格数小 |
| 同屏单位数 | ch01 deploy 条目 b1=11 / b2=17 / b3=14 / **b4=22** / b5=19 | b4 虎牢关已是当前峰值 |
| 单位 mesh | `unitFactory` 每单位 ≈ 一个多 mesh `THREE.Group`（≈ 数十次 `.add`），**无实例化** | 单位数 ↑ → draw-call 线性 ↑ |
| 地块 mesh | `terrainFactory` 每格独立 `THREE.Mesh`（Box）+ 林/山装饰锥，**无实例化** | 格数 ↑ → draw-call 线性 ↑ |
| 渲染器 | `antialias:true`、`pixelRatio≤2`、`shadowMap 2048² PCFSoft`、`ACESFilmic` tone map、`scene.fog` | 阴影 / AA 是低端机主要开销 |
| 帧循环热点 | `sceneManager.restingY(id)` 在 `frame()` 内对**每个单位**做 O(格数) 最近格搜索（每帧 `单位数 × 格数`） | **随单位数 × 格数二次增长**——大军关的头号隐患 |
| 高亮 | `highlightTiles` 每次重建 Plane mesh 列表 | 移动范围越大重建越多 |

> **关键发现**：真正的性能拐点不是「画得多」，而是 `frame()` 里 `units × tiles` 的 `restingY` 二次扫描。
> 大军关（ch04 官渡 / ch05 邺城，预计 40+ 单位 × 200+ 格）若不优化，单这一项每帧 ≈ 8000+ 次距离比较。**§2.5 给修法**。

---

## 2. 性能与移动端预算（工程护栏）

### 2.1 帧率目标（分档）

| 设备档 | 目标帧率 | 判定（启动期一次性探测，存 `settings.perfTier`） |
|---|---|---|
| **高**（桌面独显 / M 系） | 60 fps | `devicePixelRatio≥2` 且首帧渲染 < 8ms |
| **中**（普通笔记本 / 高端手机） | 45–60 fps | 缺省档 |
| **低**（旧手机 / 集显 / 低电量） | ≥ 30 fps（可接受 24） | 探测到掉帧或 `prefers-reduced-motion` 或小屏 + 低 DPR |

- 帧率是**软目标**：低于目标时自动触发 §2.6 降级，不弹错误、不卡死。
- 探测落 `core/perf.js`（新，纯逻辑可测的探测规则 + 一个 60 帧滑动均值采样器；不 import three 的部分单测，three 部分实玩走查）。

### 2.2 同屏单位数上限（设计 + 引擎双保险）

| 章段 | 设计目标同屏单位 | 引擎硬上限（`MAX_UNITS`） |
|---|---|---|
| ch01–ch03（常规关） | ≤ 24（含敌/友/客将） | 32 |
| **ch04 / ch05（大军会战 = 性能拐点）** | ≤ 48 峰值（含援军波次刷出后） | **64**（再多用「分批登场 + 退场回收」摊薄） |
| 后续攻城 / 水战 | ≤ 48 | 64 |

- **预算规则**：大军关用 **援军波次（enemy-ai §3）分批刷**，而非开局全摆——任一时刻活体 ≤ 上限；
  阵亡 / 逃脱单位（`unit:died` / `unit:fled`）**立即 `removeUnit` 回收 mesh**（现 `removeUnit` 已支持），让峰值可控。
- `MAX_UNITS` 仅作**装配期断言**（超限在 `buildBattle` / `spawnReinforcement` 时 `console.warn` + 内容侧报错），防止某张地图数据写爆。

### 2.3 Draw-call 预算 + 实例化策略

| 类别 | 现状 | 预算 | 优化（phaseable） |
|---|---|---|---|
| 地块 | 每格 1 Mesh（Box）+ 装饰 | 单战 ≤ 250 tile draw | **同材质地块合并 / `InstancedMesh`**（按 terrainId 一类一 instanced batch）：ch04/ch05 必做（B 批次） |
| 单位 | 每单位多 mesh Group | ≤ 64 单位 × 「程序化体」 | 大军关用**简模 LOD**（远 / 多单位时切低多边形版 unitFactory 体；§2.6）；旗 / 配件可裁 |
| 高亮 | 每格 1 Plane | 移动范围 ≤ 64 格 | 复用 Plane 池（`clearHighlights` 改为隐藏复用而非销毁重建） |
| 天气粒子 | 见 §2.4 | 见 §2.4 | — |
| ZOC 描边 | 移动范围边界格描边（terrain-affinity §6） | 仅画**被 ZOC 截断的边界格**（≤ 移动范围周长，非全图） | 用高亮同一 Plane 池 + 描边材质 |
| Boss / 必杀特效 | `fx.js` burst/ring/bolt | 单次特效粒子 ≤ 200，并发特效 ≤ 2 | 低档减半（§2.6）；必杀 letterbox 期间暂停 idle bob |

> **总预算（中档机，单战常态帧）**：draw-call ≤ ~400、活跃 mesh ≤ ~600、每帧 JS < 6ms（留 ~10ms 给 GPU）。
> 大军关靠**实例化地块 + LOD 单位 + 粒子封顶**把 draw-call 压回常态级。

### 2.4 天气粒子 / 小地图 / 其它覆盖层开销

- **天气粒子（weather-system / audio §2.5）**：
  - 雨 / 雪用**单个 `Points` 系统**（一个 draw-call），粒子数按档：高 ≤ 1200 / 中 ≤ 600 / 低 ≤ 0（低档雨雪改为「全屏半透色罩 + 偶发条纹」DOM 表现，零 three 粒子）。
  - 雾 = `scene.fog` 调近 / 降饱和（**零额外 draw-call**，已有 fog 基建）——优先用雾表达天气，最省。
  - 粒子只在「当前天气需要」时存在；`setWeather` 切换即建 / 拆，不常驻。
- **小地图（ui-ux §5）**：独立 2D `<canvas>`，**事件驱动重绘**（订阅 `unit:moved/died/turn:changed/weather`），**不每帧重绘**；约 160×120，低档可折叠为图标（停重绘）。零 three 开销。
- **HUD / 预测浮层 / toast**：纯 DOM，`pointer-events` 分层（ui-ux §1.2），不进 three 帧循环；预测浮层（damage-preview）只在目标态显示，移开即隐。
- **BGM（audio §1）**：WebAudio 前瞻 scheduler 提前 ~200ms 排一小节，**不在 rAF 里调度**，与渲染解耦；移动端 / 默认音量见 §3 关闭项裁决。

### 2.5 帧循环热点修复（必做，B 批次 / ch04 前）

`sceneManager.restingY` 二次扫描必须消除：
- **修法**：`placeUnit` 时把该单位所站 tile 的 `top`（顶面 y）直接缓存到 `group.userData.restY`；
  移动结束（`fx.moveAlong` 落点）回写新 `restY`。`frame()` 内 idle bob 直接读 `group.userData.restY`，**O(1)**。
- 移除 `frame()` 里对 `tileMeshes` 的全扫；`restingY(id)` 仅保留为「换格后一次性查」工具（非每帧）。
- 旗飘 / idle bob 在**低档或 reduceMotion 下整体关闭**（§2.6）。

### 2.6 reduceMotion / 低配降级（统一开关）

降级由两源触发：① `settings.a11y.reduceMotion`（或系统 `prefers-reduced-motion`）；② §2.1 探测到的「低」档（`settings.perfTier='low'`）。统一收敛到一个 `getRenderProfile()`（`core/perf.js`）供各模块查：

| 降级项 | 高 | 中 | 低 / reduceMotion |
|---|---|---|---|
| 阴影 | 2048² PCFSoft | 1024² PCF | **关阴影**（`shadowMap.enabled=false`） |
| 抗锯齿 | on | on | off + `pixelRatio≤1.25` |
| idle bob / 旗飘 | on | on | **off** |
| 天气粒子 | ≤1200 | ≤600 | DOM 色罩（0 粒子） |
| 运镜 / 震屏 / 闪白（audio §3.4） | 全 | 全 | 缩短 / 关；单挑改瞬切 + 文字战报（ui-ux §11） |
| 单位模型 | 全配件 | 全配件 | 简模 LOD（裁旗 / 配件） |
| 过场 CG（audio §4） | 全 | 全 | 可一键跳过 |

- reduceMotion 与「低档」**正交但共用同一降级管线**：reduceMotion 主要关「动效」，低档额外关「画质」（阴影 / AA / 粒子）。
- 所有降级**不改逻辑层**（battle/story 不受影响，存档 / 可复现不变），仅作用于 `render3d` / 演出 / `audio`。

### 2.7 内存 / 加载

- 无构建步骤、原生 ESM、Three.js **本地 vendored**（master §2）——首屏不拉 CDN；按场景**懒建** three 资源（标题 / 整军不建战场）。
- 战间 `dispose()` 已遍历释放 geometry / material / texture（现状 ok）；大军关切战前确保旧战场 `dispose` 再建新场，避免 mesh 泄漏。
- 程序化美术 / 音频 = **零外部资源文件**，包体小、离线可玩（master / audio §1.1）。

---

## 3. 决定关闭项（白纸黑字 · 不做 / 后置）

> 这些是**已拍板的范围裁决**，写死以止血范围蔓延。其余系统的「待确认」留在各自 spec。

| # | 项 | 裁决 | 理由 / 备注 |
|---|---|---|---|
| C1 | **世界地图行军 / 大地图移动** | **不做（永久砍）** | 主线**单线推进**（campaign-structure §1），章节选择 = 列表 / 卷轴节点（ui-ux §3），无行军格 / 遭遇战 / 资源点。master §8 已列「后置」，本稿升级为「不做」。 |
| C2 | **外交 / 势力面板 / 内政** | **不做（永久砍）** | 同上，单线战役流不需要势力经营层。 |
| C3 | **成就墙 / 收集成就系统** | **可选后置（默认不做）** | 与 narrative `achievements`（写 flag）**不同物**——后者是分支判据（保留）；前者指「成就墙 UI / 奖杯」，列入二期可选，不进 v1。 |
| C4 | **i18n / 多语言** | **暂缓（不做切换）**，但**文案集中** | 现在不做语言切换；但**所有中文标签 / 文案集中在 `data/*`**（ui-ux §0.5：兵种 / 计略 / 状态 / 天气 / 道具标签走 data，不散落 UI），为未来 i18n 留单一抽取面。 |
| C5 | **设置持久化** | **独立全局键** | settings（音量 / 难度默认 / 文本速度 / 无障碍 / perfTier）存**独立 localStorage 键** `ccz_settings_v1`，**跨存档槽共享**，与战局存档 `save_caocao_v1_slotN` 解耦（ui-ux 待确认#6、audio §6 取此裁决）。战局内的 `settings` 仍随存档走（难度对该周目锁定），但**偏好类**（音量 / 无障碍 / perfTier）以全局键为准、载入时回填。 |
| C6 | 果子 / 压级练果系统 | 后置（仅留 `fruitOnSell` no-op 钩子） | item-system §5 / economy §3.4 / progression §3.3 已定；本稿确认 v1 不实装。 |
| C7 | 手柄输入 | 后置（v1 仅留事件抽象 `ui/input.js` 占位） | ui-ux §10 默认二期。 |
| C8 | 攻城 / 水战 / 器械 / 真 LOS 视野 / 动态地形（除泥泞） | 后置到对应章节（ch05/ch06） | terrain-affinity §7；引擎留字段 / 接口，不实装。 |
| C9 | 永久战死 | 默认关（v1 = 满血复出） | campaign §6.3 / enemy-ai；硬核选项后置。 |
| C10 | 招募在野 / 雇佣（`recruit.type:'hire'`） | 后置（留接口占位） | recruitment-allies §1.4；v1 仅剧情 / 条件 / 分支收人。 |
| C11 | 轻量原创音轨备选通道 | 后置（默认纯程序化，零文件） | audio §1.6。 |
| C12 | 战斗中途存档 | 不做 | campaign §4.3：续进点只在战 / 章边界，不存战斗中途态（避免回放复杂度）。 |
| C13 | **内容存储用数据库 / CMS / 后端** | **不做（永久砍）** | 剧情 / 对话 / 关卡 / 武将 = **文件化数据驱动**（content-pipeline §0.5：现 JS 数据模块 **A** → 内容铺开后转纯数据 + 校验器 **B**；将来可选剧本编辑器）。纯静态单机游戏无运行时编辑 / UGC 需求，上 DB 需后端 / 部署 = 过度工程；存档 = `localStorage`。 |

> **C4 i18n 文案集中 = 同时是 ui-ux §0.5「数据单一事实源」原则的落点**：即使不做多语言，也强制「标签走 data」，顺带支撑图鉴 / 列传 / 提示文案统一。

---

## 4. 设计总索引 README（全部 specs + 实现批次）

### 4.1 全部设计稿一行摘要（按主题）

> 路径前缀均为 `docs/superpowers/specs/`。共 **15 份 caocao-zhuan 稿**（master 1 + 6/4 专题 13 + 本稿 1）；
> 「~21」含各稿内部分篇 / 后续待写的逐章 spec（ch02+ 路线占位，campaign §1）。

| # | 文件 | 一行摘要 | 权威范围（谁是单一事实源） |
|---|---|---|---|
| S0 | `2026-06-03-caocao-zhuan-srpg-design.md` | **master**：定位 / 完整拟真要素 / 模块架构 / 第一章 5 战 / 里程碑拆分。 | 架构、模块边界、第一章战役清单、原则 |
| S1 | `2026-06-04-caocao-zhuan-class-system.md` | 五维含义 + **物理 / 计略伤害公式** + 11 系职业表 + footprint + 印绶 Lv15/30 转职 + 名册→职业。 | **五维口径、职业表、footprint、转职阈值、基础伤害公式** |
| S2 | `2026-06-04-caocao-zhuan-item-system.md` | 3 槽装备（兵种限制 + 皮 / 铜 / 钢）、消耗品（原版命名）、印绶、第一章起步宝物清单。 | **道具 Item schema、宝物效果、印绶** |
| S3 | `2026-06-04-caocao-zhuan-weather-system.md` | 晴 / 雨 / 雪 / 雾 / 阴；`SkillDef.weather{require,blockedIn,powerMod}`；雾对远程。 | **天气类型、计略天气联动字段** |
| S4 | `2026-06-04-caocao-zhuan-terrain-affinity.md` | 兵种 × 地形适性矩阵（±10%）、ZOC、地形对计略 / 远程 / 视野、据点 / 城 / 关 / 桥 / 水。 | **地形适性 `affinityOf`、ZOC 规则、`terrain`/`affinity` 数据** |
| S5 | `2026-06-04-caocao-zhuan-damage-preview.md` | 攻 / 计略前预测面板（命中 / 伤害区间 / 击杀 / 反击 / 修正标签）；`forecast.js` 纯函数。 | **forecast 纯函数契约、combat 纯算核拆分** |
| S6 | `2026-06-04-caocao-zhuan-economy-shop.md` | 军资 money、战后结算公式 + 战利品、关间「军市」买卖、物价 / 平衡曲线、`data/economy.js`。 | **货币 / 价格 / 结算公式、`gameState.money/shopState`** |
| S7 | `2026-06-04-caocao-zhuan-recruitment-allies.md` | 三阵营（wei/guest/ally/npc）、客将 `guest:true`、招募 4 类、护送 / 坚守、`victory.rout` 修正。 | **faction / guest / ally 阵营契约、招募流程、`isHostile`** |
| S8 | `2026-06-04-caocao-zhuan-narrative-branching.md` | 三线倾向 lean（写 storyFlags）、分歧点、菱形分叉汇合、`branch` step、章节路由、多结局。 | **lean 模型、`chapterRouter.resolveBattles`、`achievements`、`branch` step** |
| S9 | `2026-06-04-caocao-zhuan-progression-leveling.md` | 经验曲线 / 上限 50、SABC 成长率、HP/MP 公式、能力特性、`statsAtLevel` 单一来源、两阶段五维迁移。 | **成长公式、SABC、`leveling.gainExp` 内核、五维迁移阶段** |
| S10 | `2026-06-04-caocao-zhuan-campaign-structure.md` | 章 / 战役 / 事件层级、`runCampaign` 跨章状态机、存档 `campaign` 段 + 迁移 v1→v2、章节选择、**难度三档**、NG+。 | **章节注册表 / 状态机 / 存档迁移 / NG+** |
| S11 | `2026-06-04-caocao-zhuan-ui-ux.md` | IA / z 分层、战斗 HUD、整军、章节地图、图鉴 / 列传、小地图、教程、设置、输入、无障碍、视觉语言。 | **UI 模块映射、z-index 分层、a11y、设置项** |
| S12 | `2026-06-04-caocao-zhuan-audio-presentation.md` | 程序化 BGM 8 曲 + intensity、扩 SFX、计略 / 单挑 / 必杀演出、过场 CG、镜头语言、`bgm/sfx/cg/shake/flash` step。 | **音频架构、演出规格、过场 step** |
| S13 | `2026-06-04-caocao-zhuan-enemy-ai.md` | 四性格扩展、boss 多阶段 / 狂暴、援军波次、撤退 / 逃跑、仇恨权重、守点 / 拴绳 / 护送、**难度对 AI**、友军 AI、`retreat/spawnWave/setBossPhase` step。 | **AI 行为模型、`aiConfig`、boss / 援军、AI 难度作用** |
| S14 | **本稿** `…-ops-decisions-index.md` | 性能 / 移动端预算、关闭项裁决、设计总索引 + 跨稿冲突裁决日志。 | **性能预算、关闭项、跨稿裁决（§5）** |
| — | 逐章 spec（占位） | ch02 濮阳…ch10 魏王（campaign §1 路线图），每章独立 spec（地图 / 剧本 / 数值 / 新系统）。 | 各章内容（后续逐章交付） |

### 4.2 实现批次 0–7（建造顺序，跨稿合并的依赖排序）

> 把各稿的「实现要点 / phase」合并成**全局 8 批**。原则：**先地基冻接口（避免并行冲突）→ 纯逻辑层 → 渲染 / UI → 内容 → 演出 → 集成调优**。
> 每批末可玩 / 可存档（master 原则）。批内可多 subagent 并行（对着上一批冻结的接口写）。

| 批 | 名称 | 内容（合并各稿） | 关键依赖 / 产出 |
|---|---|---|---|
| **0** | 共享地基（冻接口） | ①**共享战场谓词库** `battle/predicates.js`（§5.4）；②`scenarioRunner` **步目录** 注册化（§5.5）；③`core/perf.js` 探测 + `getRenderProfile`（§2.1/2.6）；④存档 `campaign` 段 + 迁移 v1→v2（S10 §4.2）+ settings 独立键（C5）；⑤`victory.rout` 修正 + `isHostile`（§5.6）。 | 下游全靠这批的接口；**先冻结再并行** |
| **1** | 五维 / 成长内核 | S1 五维口径 + S9 `statsAtLevel` 单一来源 + `leveling.gainExp` 内核换 SABC + S5 拆 `combat.coreDamage/coreHit` 纯算核。 | 伤害 / 预测 / AI 全依赖此口径（§5.1 五维裁决） |
| **2** | 战斗规则层 | S4 `affinityOf` + ZOC（pathfind）+ combat 接适性；S3 天气 `weatherMods` + 计略可用性；S5 `forecast.predictAttack/Skill`；**乘法叠加序**统一（§5.3）。 | 纯逻辑、可单测；forecast 先于 AI 精确判定 |
| **3** | 职业 / 道具 / 转职 / 计略 | S1 11 系职业数据 + footprint `attackReach`；S2 道具 3 槽 + 宝物 special + 印绶；S1/§4 逐级习得 + 新计略 skillEngine 扩展。 | 依赖批 1/2 |
| **4** | AI / boss / 援军 | S13 `aiConfig` 归一 + objective 层 + 仇恨权重 + boss 阶段 / 狂暴 + 援军波次 + 撤退 + 友军 AI；AI 难度乘数（引用 §5.2 难度表）。 | 复用批 2 forecast / 谓词；新 step 经批 0 步目录 |
| **5** | 渲染 / UI / 演出地基 | render3d 实例化地块 + LOD + §2.5 restY 修复 + 天气粒子 + ZOC 描边；S11 HUD 五维卡 / 行动菜单 / 小地图 / 预测浮层 / 整军三槽 + 转职 / 设置 / 教程；S12 BGM 8 曲 + SFX 扩 + 计略音画同步 + 单挑 / 必杀 + 过场 CG。 | 对批 1–4 的状态作画；降级管线（§2.6） |
| **6** | 内容 / 叙事 / 经济 | S10 `runCampaign` + 章节注册表 + 章节选择 + NG+；S8 lean + `resolveBattles` + `achievements` + `branch` 对白变体；S6 经济结算 + 军市；S7 招募 / 客将 / 友军内容；第一章 5 战数据接全系统。 | 内容驱动；引擎零改动接纳 |
| **7** | 集成 / 调优 / 验收 | 集成到状态机、逻辑层单测、Hub 注册、性能实测（中 / 低档走查大军关原型）、平衡走查、NG+ 闭环、无障碍走查。 | master §10 验收标准 |

> v1（M1）= 批 0–7 跑通 **引擎 + 第一章**。ch02+ 为逐章交付，引擎对其「零改动」（加注册表一条 + 数据目录）。
> 注：第一章峰值 b4=22 单位仍属常规档；**大军关性能优化（实例化 / LOD）虽在批 5，但对 ch04/ch05 才是硬需求**——v1 可先做 §2.5 的 `restY` 修复（廉价、立竿见影），实例化 / LOD 可随 ch04 spec 一起落地（标 phaseable）。

---

## 5. 跨稿冲突的最终裁决记录（裁决日志）

> 以下每条都是「多份稿对同一事重复定义 / 互相矛盾」的**消解**。**各稿应引用本裁决，不再各自重定义**。

### 5.1 五维 / MP 字段模型 —— 以 S1(class-system) + S9(progression) 为权威

- **冲突**：所有专题稿假设 5 维 **攻/精/防/爆/士** + MP（`maxMp/curMp`）；**代码现为 4 维** `atk/def/int/spd` + `maxHp`，无 `crit(爆)`/`morale(士)`/MP，且 `combat` 命中式用 `spd`。
- **裁决**：**字段模型以 S9 progression-leveling 的「两阶段迁移」为唯一权威**（S1 定义五维语义与公式，S9 定义字段迁移路径）；其余稿（damage-preview / enemy-ai / terrain-affinity / ui-ux / economy）**只引用、不重定义**。
  - 阶段 1（批 1）：成长作用在现有 `atk/def/int/spd/maxHp`，`spd` 暂承载「爆」，`int`→「精」语义；保留 `gainExp` 签名。
  - 阶段 2（批 1 完备）：补 `crit(爆)`/`morale(士)` + 六维来源（武力 / 智力 / 统率 / 敏捷 / 运气）+ `maxMp/curMp`，五维各自档位独立成长。
  - **MP 显示**：ui-ux 待确认#7 取「v1 信息卡 / 整军至少显示 MP 数值」（计略系需要）。
- **下游约束**：combat 命中式从「用 `spd`」迁移到「物理看 爆/士 差、计略看 精/士 差」（S1 §0），随阶段 2 完成。

### 5.2 难度表 —— **合一**：以 S10(campaign §6.1) 为单一权威，AI 行为参数留 S13

- **冲突**：难度系数表出现**三处**：S10 `data/difficulty.js DIFFICULTY`、S13 `data/aiTuning.js DIFFICULTY`、S6 `data/economy.js ECON.DIFFICULTY_MUL`。
- **裁决（balance-master 即本稿在此项的角色）**：
  1. **`data/difficulty.js` 是唯一难度表**（S10 §6.1），含敌方 lv / atk / def / hp 乘数、`aiAggression`、`playerExpMul`、`allowAiSmart`。
  2. S13 的 `aiTuning.js` **不再持有自己的 `DIFFICULTY`**，改为 `import { DIFFICULTY } from '../data/difficulty.js'`，只保留**AI 专属行为映射**（如 `useForecast/reinforceActThisTurn/leashTighten/focusFire/bossPhaseAggro`）作为 `difficulty.js` 同一档下的**子字段**或独立 `AI_DIFFICULTY` 表，但**键名 / 档名（easy/normal/hard）与值口径与 `difficulty.js` 对齐**。建议合并为一张表的「战斗 / AI / 经济」三组字段：
     ```js
     // data/difficulty.js（合一后，单一事实源）
     export const DIFFICULTY = {
       easy:   { /* 战斗 */ enemyLvDelta:-1, enemyAtkMul:.85, enemyDefMul:.85, enemyHpMul:.85,
                 /* AI   */ aiAggression:.7, allowAiSmart:false, useForecast:false,
                            reinforceActThisTurn:false, leashTighten:1.0, focusFire:false, bossPhaseAggro:.8,
                 /* 养成 */ playerExpMul:1.25,
                 /* 经济 */ rewardMul:1.2, label:'简单 · 体验剧情' },
       normal: { enemyLvDelta:0, enemyAtkMul:1, enemyDefMul:1, enemyHpMul:1,
                 aiAggression:1, allowAiSmart:true, useForecast:true,
                 reinforceActThisTurn:false, leashTighten:1.0, focusFire:false, bossPhaseAggro:1,
                 playerExpMul:1, rewardMul:1, label:'普通 · 标准战阵' },
       hard:   { enemyLvDelta:+2, enemyAtkMul:1.15, enemyDefMul:1.1, enemyHpMul:1.2,
                 aiAggression:1.3, allowAiSmart:true, useForecast:true,
                 reinforceActThisTurn:true, leashTighten:1.5, focusFire:true, bossPhaseAggro:1.25,
                 playerExpMul:.9, rewardMul:.8, label:'困难 · 沙场宿将' },
     };
     ```
  3. S6 经济 `DIFFICULTY_MUL` 改为读上表的 `rewardMul`（不再自持一份；economy §2.2 的 `difficultyMul` = `DIFFICULTY[diff].rewardMul`）。
  4. **NG+ 加成**（S10 §7.3 `ngPlusMod`）在所选难度系数**之上叠加**（相乘 / 相加按 S10 §7.3 合成），封顶不变。
- **结果**：一处调难度，战斗 / AI / 经济三层同步；单测断言「三处消费的是同一张表」。

### 5.3 伤害乘法叠加序（canonical chain）—— 本稿定义唯一链路 + 钳制

- **冲突**：相克(S1)、地形适性(S4)、天气(S3/S4)、阵型 / boss 狂暴 / 装备(S1/S2/S13) 多处提「相乘」，但**未定全局顺序与钳制**，易在不同模块算出不同结果。
- **裁决（唯一规范链）**：物理 / 计略有效输出按**固定顺序**结算，`combat.coreDamage` 与 `forecast` **共用同一实现**（保证「预测 = 实际」，S5 要求）：
  ```
  rawAtk = baseAtk(五维 + 装备加成)            // 装备 stats 已并入有效属性（批 1/3）
  effAtk = rawAtk
         × triangleMul        // ① 兵种相克（classTriangle，S1）  ——典型 0.75~1.5
         × terrainAtkMod      // ② 攻方所站地形适性 atk（affinityOf，S4） ——典型 0.9~1.1
         × weatherAtkMod      // ③ 天气对物理：默认 1（天气主要作用于计略 / 远程，S3 §4）
         × formationMod       // ④ 阵型（后置，缺省 1）
         × bossRageMod        // ⑤ boss 狂暴 enrage.atkMul（S13，缺省 1；走 statuses buff 通道）
  effDef = (def + terrain.defBonus) × defAffMod   // 守方：加法防御 + 地形适性 def（S4 §5.4）
  pre = max(MIN_DMG, effAtk - effDef)             // 物理：攻防相减后下限钳制
  dmg = round( clamp(pre, MIN_DMG, MAX_DMG) × jitter )   // jitter∈[0.9,1.1]（rng；预测取 min/max 区间）

  // 计略（element 系）：用 ((自精 − 敌精)/3 + lv + 25) × 计略系数，再 × weatherPowerMod(S3) × terrainPowerByTargetTerrain(S4 §3.2)
  //   计略不吃 triangleMul / 物理 terrainAtkMod；防御对计略无效（S1 §0）。
  ```
  - **顺序固定**：①相克 → ②地形 → ③天气 → ④阵型 → ⑤boss 狂暴，全部**相乘**作用于攻方有效攻击；防御侧地形适性单独乘在 `(def+defBonus)` 上。
  - **钳制**：`MIN_DMG`（建议 1，保证有效攻击至少蹭血）、`MAX_DMG`（防溢出）、`jitter∈[0.9,1.1]`、命中 `clamp(…,30,100)`%（S4 §5.4 已有）。
  - **计略与物理分流**：计略走精差公式 + `weatherPowerMod × terrainPowerMod`，**不复用物理的相克 / 地形 atk**；二者各自一条链，但**都在 `coreDamage` 同一文件实现**，AI/forecast/实战三方同源。
- **下游约束**：S13 boss 狂暴、S2 宝物 special（连带 / 反击无双 / 免远程）作为**乘数 / 旁路**接在此链的指定环节（狂暴=⑤；免远程=命中 / 适性侧；连带=结算后追加一次 `coreDamage`），不另起公式。

### 5.4 战场谓词库（shared predicate library）—— **统一** `battle/predicates.js`

- **冲突**：S10 victory（rout/defeatLeader/survive/capture）、S8 achievements（`foeFled/allyAlive/clearedByTurn/weiCasualties/captured/reached`）、S13 AI（`canKillThisTurn` 等）**各自定义重叠的战场谓词**。
- **裁决**：建**一个共享纯函数库** `battle/predicates.js`，**victory / achievements / ai / recruitment 全部 import 它**，不各写一份：
  ```js
  // battle/predicates.js（纯逻辑，不 import three / 不碰 DOM；可单测）
  // 输入统一为 { units, turn, map, log? }（战场终态 / 实时态）
  export const pred = {
    foeFled(state, id),        foeAlive(state, id),       foeKilledBy(state, id, byId),
    allyAlive(state, id),      allyDead(state, id),
    weiCasualties(state, n),   // 我方阵亡 ≤ n（含 guest 计入我方，§5.6）
    clearedByTurn(state, n),   reached(state, {c,r,by}),  captured(state, siteId|cellKey),
    allHostileDead(state),     // = rout 的正确语义（用 isHostile，§5.6）
    leaderDead(state, id),     canKillThisTurn(state, attacker, target),  // AI 复用
    all(state, list),          any(state, list),          // 复合
  };
  ```
  - `victory.js` 的 4 类条件改为调 `pred`（`rout→allHostileDead`、`capture→captured`/`reached`、`survive→turn>=n`、`defeatLeader→leaderDead`）。
  - `achievements.evaluate` 的 `when` 判据**全部映射到 `pred`**（S8 §3.2 的 `when` DSL = `pred` 的声明式包装）。
  - AI 的击杀 / 价值判定复用 `pred.canKillThisTurn`（S13 §5.1，内部可走 forecast）。
- **结果**：「allyAlive / reachedXY / foeFled / clearedByTurn…」**只有一处实现**，victory / achievements / ai 行为一致、单测一处。

### 5.5 scenarioRunner 步目录（canonical step catalog）—— **注册化**，本稿登记全集

- **冲突**：现 `scenarioRunner` 的 `switch` 只处理 `narrate/say/choice/camera/setFlag/duel`；各稿要新增步：
  S12 `bgm/sfx/cg/shake/flash`、S13 `retreat/spawnWave/setBossPhase`、S3 `setWeather`、S11 `tutorial`、S8 `branch`、S10 `chapterIntro`、S7（可选）`recruit/leave`。
- **裁决**：把 `switch` 改造为**步处理器注册表**（`registerStep(type, handler)`），**本稿登记唯一的 step 全集**；各稿只「认领」自己的步、注册 handler，不各自改 `switch`：

  | step type | 语义 | 来源稿 | 批次 | 备注 |
  |---|---|---|---|---|
  | `narrate`/`say`/`choice` | 对白 / 旁白 / 选项（写 flag） | 现状 | — | `choice.setFlag` 走 §5.7 lean 归并器 |
  | `camera` | 运镜（preset/focus/zoom） | 现状 | — | 已有 |
  | `setFlag` | 写 storyFlags | 现状 | — | 经 `applyChoiceFlag`（lean 累加，S8 §3.1） |
  | `duel` | 强制单挑 | 现状 | — | 已有 |
  | `branch` | 按 track/flag 选子 steps（递归 run，else 兜底） | S8 §5.2 | 6 | 向前兼容 |
  | `setWeather` | 切天气（→ `weather.setWeather` + 演出） | S3 | 2/5 | |
  | `bgm` | 切 / duck / unduck / stop BGM | S12 §4.2 | 5 | |
  | `sfx` | 触发一次性音效 | S12 §4.2 | 5 | |
  | `cg` | 程序化 CG 过场（bg/fg/text/hold/fade） | S12 §4.2 | 5 | 走 `story/cutscene.js` |
  | `shake`/`flash` | 震屏 / 闪白 | S12 §3.4 | 5 | 尊重 reduceMotion（§2.6） |
  | `tutorial` | 教学聚光提示（anchor/tip） | S11 §8 | 5 | 看过写 `tut_*` flag |
  | `retreat` | 剧情撤退 / 脱离（units/to） | S13 §4.2 | 4 | → `controller.retreatUnits` |
  | `spawnWave` | 显式触发援军波次（waveId） | S13 §3.2 | 4 | → `controller.spawnReinforcement` |
  | `setBossPhase` | 剧情强制 boss 切阶段 | S13 §2 | 4 | → `controller._checkBossPhase`(force) |
  | `recruit`/`leave` | 即时收人 / 离队（可选，先不做） | S7 §7 | 6 | 默认用 `setFlag` + 集成层；step 为便利项 |

  - **向前兼容**：未注册的 step 仍「忽略」（现状语义保留），故任何尚未实现的步不报错。
  - **解耦**：`retreat/spawnWave/setBossPhase` 等需要 controller 的步，handler 从 `ctx.controller` 取（与现 `duel` step 同模式）；纯过场无 controller 时静默跳过。

### 5.6 `victory.rout` 修复 + `isHostile` —— 以 S7(recruitment) 为权威

- **冲突 / bug**：现 `victory.checkVictory` 的 `rout` 用 `units.filter(u => u.faction !== 'wei')` 当敌人 ——
  **把 `ally`/`npc`（友军 / 被护送 NPC）误算成敌人**，一旦有友军在场，rout 永远无法满足（友军不死 = 打不赢）。
- **裁决**：引入**单一阵营敌对判定** `isHostile(a, b)`（S7 §0/§3，放 `battle/predicates.js` 或 `battle/factions.js`）：
  ```
  isHostile(u, other):
    wei / guest(=wei+guest:true) / ally / npc  —— 对 foe 敌对；
    foe —— 对 wei / guest / ally / npc 敌对；
    同阵营 / ally↔wei / npc↔wei 互不敌对。
  ```
  - `rout` 改判 `pred.allHostileDead(state)` = 「场上无存活的、对 wei 敌对的单位（即无存活 foe）」，**不再把 ally/npc 当敌**。
  - **败北判定**：`wei` 全灭 = lose（含 guest 计入我方？——guest 阵亡**不致败**，只 roster 常驻 wei 全灭才败；`weiCasualties` 谓词把 guest 计入「我方阵亡数」用于成就，但**败北只看常驻 wei**）。ally/npc 阵亡是否致败由该单位 / 关卡 `ally.fatalIfDead` 配置（S7），不写死在 victory 默认。
- **`guest:true` 字段正式化**：现状客将仅靠注释约定；裁决采纳 S7 —— `map.deploy` 条目可带 `guest:true`（+ 临场 `level/skills/items`），`battleController.makeUnit` 写 `unit.guest=true`、`unit.faction='wei'`，**战后不回写 roster**（`persistRosterFromBattle` 按 `faction==='wei' && !guest` 过滤）。可控判定 = `faction==='wei'`（含 guest）。

### 5.7 其余小裁决（一并登记）

- **lean / setFlag 归并**：`choice.setFlag.lean` 为**增量累加**（S8 §3.1 `applyChoiceFlag`），非 `Object.assign` 覆盖；`scenarioRunner` 的 `setFlag` 步统一走该归并器。其余 flag 键仍 `Object.assign`。
- **续进锚点**：v1 沿用 `battleIndex` 下标；变体战（S8 `variants`）真正出现时再追加 `storyFlags.lastBattleId` 按战 id 续进（S8 待确认#6，本稿取「后置追加」）。
- **存档版本**：campaign 段触发 `version 1→2` 迁移（S10 §4.2 权威）；economy 的 `money/shopState` 为**纯增字段、向后兼容、不单独升版**（S6 §4.5）——二者不冲突（`load` 同一处补默认）。
- **`statsAtLevel` 单一来源**：`makeUnit` 的 `level>1` 叠加与升级即时成长**共用** S9 的 `statsAtLevel`，消除现状两处各写一份的潜在分叉 bug（S9 §9）。
- **难度可改时机**：campaign §6.3 取「**可降不可升**」（防滥用），NG+ 锁难度下限（待 James 终裁，列 §6）。

---

## 6. 待确认

1. **性能档探测口径**：用「首帧渲染耗时 + DPR + 屏宽」启发式定 perfTier，还是只读 `prefers-reduced-motion` + 让玩家手动选档？大军关（ch04/ch05）原型实测前能否先按本稿预算冻结上限（`MAX_UNITS=64`、draw-call ≤400）？
2. **大军关优化时机**：实例化地块 + 单位 LOD 是 v1（批 5）就做，还是随 ch04 spec 落地（v1 只做廉价的 `restY` 修复）？本稿默认后者。
3. **关闭项确认**：C1 世界地图 / C2 外交「永久砍」是否同意（vs 留作极后期可选）？C3 成就墙「可选后置」是否够，还是直接砍？
4. **i18n 文案集中（C4）**：是否现在就强制「所有中文标签走 `data/*`、UI 不内联文案」作为硬约束（会影响 HUD/ menus 等现有内联中文的小重构）？
5. **settings 独立键（C5）**：偏好类（音量 / 无障碍 / perfTier）走全局键 `ccz_settings_v1`、难度随存档锁周目——这个「偏好全局 / 难度随档」的二分是否合预期？
6. **难度表合一（§5.2）**：三表合并进 `data/difficulty.js` 一张（战斗 / AI / 经济三组字段）是否同意？还是保留 `difficulty.js` + `AI_DIFFICULTY` 两表但共享档名 / 由前者派生？
7. **乘法叠加序（§5.3）**：①相克 ②地形 ③天气 ④阵型 ⑤boss 狂暴的固定顺序与 `MIN_DMG=1`/`jitter[0.9,1.1]`/命中 clamp[30,100] 钳制是否拍板？计略与物理分两条链、同文件实现是否同意？
8. **谓词库（§5.4）**：victory/achievements/ai/recruitment 全部 import `battle/predicates.js` 单一实现是否同意？`when` DSL = `pred` 的声明式包装这个对应关系 OK 吗？
9. **step 注册表（§5.5）**：把 `scenarioRunner` 的 `switch` 改注册表、本稿登记的 step 全集（含批次）是否完整、命名是否合适（`spawnWave` vs `reinforce`、`setBossPhase` 等）？
10. **rout 修复 + 败北口径（§5.6）**：`isHostile` 单一判定、guest 阵亡不致败 / 只 roster wei 全灭才败、ally/npc 致败与否由关卡配置——这套阵营 / 胜负口径是否拍板？
