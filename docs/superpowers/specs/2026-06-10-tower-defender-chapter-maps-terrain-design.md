# Tower Defender · 每章专属主题板型 + 致命地形 设计文档

- 日期：2026-06-10
- 状态：brainstorm 定稿，待实施（两段交付）
- 起因：James 实玩发现地图重样。实测确认：**50 关只有 6 张几何完全相同的地图，且每张横跨两章复用**（指纹比对：2营图×4关 / 3营图×10关 / 4营图×10关 / 5营图×10关 / 6营图×10关 / 8营图×6关）。
- 范围：`games/tower-defender`。本 spec 合并了原"检查点C·致命地形"的地形机制部分。

## 1. 已确认决策（brainstorm 对话定稿）

| 决策点 | 结论 |
|---|---|
| 范围 | **板型 + 致命地形一体设计**，两段交付（先换图、后活地形） |
| 营数结构 | **逐关营数与现状完全一致** → cities.js 城名池（26/36/46/56/72）、cityAssign 测试、样板贴题岛全部零改动 |
| 图量要求 | James 原话："尽量多图，实在图不够用，至少塔格子摆放要有变化" |
| 实现路线 | **A · 基板 × 镜像 × 将位重布**：10 张手写主题基板 → 三维变体（镜像×4 / 将位套×2-3 / 路子集）→ 50 关路线或将位全部唯一 |
| 五章主题与机制 | 见 §2 表（浏览器草图已过 James 确认） |
| 机制基调 | 全部为"利好/约束型"（高台/卡口/减速/环境输出），无惩罚型威胁——适合 7 岁 |

## 2. 五章主题与地形机制（每章引入 1 个新机制，渐进教学）

| 章 | 主题 | 基板意象 | 新机制 | 教学点 |
|---|---|---|---|---|
| 1 讨董中原 | 平原烽火 | 开阔平原、烽火台装饰、S 形蜀道 | **高台 plateau**：其上将位的塔射程 +0.5 格 | 位置很重要 |
| 2 官渡河北 | 河流渡口 | 横贯河流、两处渡口/浮桥 | **河流 river**：禁建+敌不走水，敌只能从渡口过 | 卡口集火 |
| 3 赤壁江面 | 大江浮桥 | 下半幅长江、栈桥跨江 | **浅滩 shallow**：路过敌人 ×0.7 减速 | 减速带前堆输出 |
| 4 汉中山道 | 峡谷险道 | 两侧山壁（mountain 禁建）夹窄路 | **落石 rockfall**：6s 周期、1s 前摇、AoE 砸路面敌人 | 环境替你输出 |
| 5 北伐渭原 | 上方谷火地 | 渭水塬地、谷地火区 | **火谷 firegully**：路过敌人持续灼烧 DoT（复用灼烧栈，藤甲被火克照常） | 集大成 |

**L50 大雨彩蛋**：终关 flag 使火谷失效 + 渲染雨丝 + 故事卡补一句"天降大雨"——呼应火烧上方谷天命剧情（司马懿终关本就有 rampMax:1.0 豁免，重验 winnable）。

## 3. 数据层

### 3.1 基板（新 `src/data/baseBoards.js`，替代 boardTemplates.js）

- 10 张手写基板：每章 A/B 两张，**均带该章最大营数**（3/4/5/6/8 营，等于该章样板关营数）。
- 章内**前半关取路子集**复刻现状营数（如 ch1 前半 L2-5 取 2 路、ch2 前半 L12-15 取 3 路）。`levels.js` 的 `CITY_AT` 与 `cities.test.mjs` 的需求推导都按 `(pathSubset?.length) || 全路数` 计算——子集大小逐关等于现状营数 ⇒ **城名池切片完全不动**（已核对兼容）。
- 每基板字段：`{ id, chapter, half:'A'|'B', cols:24, rows:14, castle:{c:11,r:6,w:2,h:2}, camps, paths, slotsVariants:[slots×2-3], terrain:[{type,cells:[{x,y}]}] }`。
- `slotsVariants`：用 `tools/suggest-slots.mjs`（不同种子/偏好参数）离线生成、verify 筛选后**写死进数据文件**——运行时零随机、确定性保持。
- terrain type 枚举：`plateau / river / shallow / mountain / rockfall / firegully`。语义：river/mountain = 禁建+敌不走（设计期保证路径避开，verify 硬校验）；plateau = 含将位格才有意义；shallow/rockfall/firegully = 必须覆盖路径段（verify 校验）。
- 旧 `boardTemplates.js` 删除（50 关全部切新板后无引用，防死代码）；`boardTemplates.test.mjs` 重写为 baseBoards 全量校验（10 基板 × 全部变体过 verifyLevel 0 errors/0 leaks）。

### 3.2 变体引擎（新 `src/data/boardVariants.js`，纯函数）

- `mirrorBoard(board, mode)`：mode ∈ none/h/v/hv。坐标变换 `x→cols-1-x`、`y→rows-1-y`，camps/paths/slots(全部套)/terrain.cells 同步翻转；castle 2×2 居中（c=11,w=2 于 cols=24）水平镜像后位置不变。
- `variantFor(levelId)`：按 `level.id` 确定性映射（章内位置 k → 镜像 mode、slotsVariant 序号、前半路子集选择）。加载期纯数学、无随机。
- 分配目标：章内 10 关两两不同（A 板 5 变体 + B 板 5 变体），全局 50 关"路线几何或将位布点"至少一维不同。
- `campaign.js`：章 `templates` 字段与样板关 `templateId` 切到新基板 id（`ch1A`…`ch5B`）；生成关骨架补 `pathSubset`（前半子集）。

## 4. 系统层（新 `src/systems/terrainSystem.js`）

- 加载期把 terrain cells 烘焙成 `terrainAt[r][c]` 查找表（挂 level 展开产物）。
- **shallow**：敌所在格为浅滩 → 施加减速（复用 statusEffects 减速通道，与塔减速"取最强不叠加"规则一致）。
- **firegully**：敌在格内 → 灼烧 DoT（复用灼烧栈，标记环境来源；出区残留 1.5s）。
- **rockfall**：每区独立计时器（state 持久，确定性步进）：6s 周期 → 1s 前摇（渲染读 state 画警示）→ 落石 AoE（半径 1.2 格、伤 30×scale）砸区内路径格上的敌人。
- **plateau**：建塔时检测 slot ∈ plateau cells → `tower.rangeBonus = 0.5`（静态字段，射程计算链路读取；升级/重读档保持）。
- **禁建**：运行时零代码——slots 即建造白名单，基板作者保证 + verify 硬校验，不需要 build 时判定。
- **L50 雨**：level flag `disableTerrain:['firegully']` → terrainSystem 跳过该类型；渲染画雨丝；storyCard 文案补一句（仅 L50 样板字段，story 系统不改架构）。

## 5. 渲染层（`src/render/board.js` 增量）

草地与蜀道之间画 terrain tiles，全部程序化（沿用烟雾的 ctx save/restore 模式、动效读 `state.time`）：river/江面=蓝带+波纹线、shallow=亮蓝波纹、plateau=黄土台+描边、mountain=深色岩壁+棱线、firegully=橙红地+火苗摆动、rockfall=岩壁+前摇警示圈+落石动画。章节 faction tint 照常，terrain 叠加其上。

## 6. 数值初值（实现期 balance-report + winnable 重校）

| 机制 | 初值 |
|---|---|
| plateau | 射程 +0.5 格 |
| shallow | 敌速 ×0.7（与塔减速取最强） |
| firegully | 灼烧 6×scale/s，出区残留 1.5s |
| rockfall | 周期 6s、前摇 1s、半径 1.2 格、伤 30×scale |

地形利好会让部分关变松：winnable 是真模拟、自然计入地形效果，实现期全 50 关重跑 + balance-report 复核，必要时调 difficulty 或缩地形区。L50（rampMax 1.0 + 火谷失效）单独重验。

## 7. 门禁与测试

- `tools/verify-levels.mjs` 扩展：①全部 slots（每套变体）不落 river/mountain/禁建格 ②路径不穿 river/mountain（渡口/浮桥=路径格不属 river cells）③shallow/rockfall/firegully 至少覆盖 1 个路径格 ④10 基板 × 全部镜像变体 × 全部 slots 套逐一过无漏怪门禁。
- 新单测：mirrorBoard 性质（双镜=恒等、castle 不动、terrain 同步、slots 套逐套翻转）、variantFor 确定性与章内不重复、terrainAt 烘焙、shallow/firegully/rockfall 效果与计时确定性、plateau rangeBonus、L50 disableTerrain。
- 存量：45 单测全绿；**cities.test / cityAssign.test 零改动**（营数承诺的回归证明）；levels-winnable 50 关重验。
- 冒烟：每章截图 1 关（5 张）+ 落石/火谷动效目检 + James+娃实玩。

## 8. 两段交付（各自可玩可验收）

- **段1「换图」**：baseBoards 10 基板 + boardVariants 引擎 + campaign/levels 接线 + 静态地形渲染 + plateau 射程加成 + verify 扩展 + 测试 → 验收点："50 关图图不同、章主题肉眼可辨、高台生效、全门禁绿"。
- **段2「活地形」**：terrainSystem（shallow/firegully/rockfall）+ 动效 + L50 大雨彩蛋 + 全量平衡重校 → 验收点："三动态机制可见可感、winnable 50/50、娃实玩"。

## 9. 范围外（本期不做）

- 经济曲线调参（检查点B 独立做，但 winnable 重校中顺带观察）。
- 关卡目标多样化（护送/限时等，原检查点C 另一半，后续）。
- 新敌人/新塔/音频/故事文案架构（L50 一句雨文案除外）。
- 程序化随机地图（路线 C 已否决）。

## 10. 验收标准

1. 几何指纹复测：50 关两两比对，无任意两关"路线几何 + 将位布点"完全相同；章与章主题视觉明显不同。
2. 营数逐关与现状一致（自动断言）；cities/cityAssign 测试不改一行且全绿。
3. 五章机制各自可演示：高台射程圈变大、渡口卡口、浅滩减速可见、落石砸中敌人、火谷灼烧跳字；L50 下雨火谷熄灭。
4. 全门禁绿：全部单测 + verify-levels（含变体全量）+ check-imports + winnable 50/50 + 每章冒烟截图。
