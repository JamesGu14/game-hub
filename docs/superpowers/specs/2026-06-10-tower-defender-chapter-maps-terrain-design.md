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
| 1 中原逐鹿 | 平原烽火 | 开阔平原、烽火台装饰、S 形蜀道 | **高台 plateau**：其上将位的塔射程 +0.5 格 | 位置很重要 |
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
- **terrain 区域简写**：手写基板可用 `rects:[{x,y,w,h}]` 表示大片区域（河流/山体），加载期（或烘焙时）展开为 cells；`cells` 与 `rects` 可并存取并集。渡口/浮桥 = 路径格，**不属于** river 区域（rects 挖洞或 cells 枚举时避开）。
- **pathSubset 确定性规则**：前半关（k=0..4，样板关除外）取子集，子集选择按 `(章, k)` 确定性轮换——例如 ch1 前半 2 路：k=1 取 [a,b]、k=2 取 [b,c]、k=3 取 [a,c]、k=4 取 [a,b]（窗口轮换，写死在分配表）。**城名分配顺序 = 子集 camps 按模板 camps 数组原序过滤后的顺序**（与现状 `tmpl.camps.filter(...)` 行为一致），子集规则确定 ⇒ 城名分配确定。
- 旧 `boardTemplates.js` 删除（50 关全部切新板后无引用，防死代码）；`boardTemplates.test.mjs` 重写为 baseBoards 全量校验（10 基板 × 全部变体过 verifyLevel 0 errors/0 leaks）。

### 3.2 变体引擎（新 `src/data/boardVariants.js`，纯函数）

- `mirrorBoard(board, mode)`：mode ∈ none/h/v/hv。坐标变换 `x→cols-1-x`、`y→rows-1-y`，camps/paths/slots(全部套)/terrain（cells 与 rects）同步翻转；castle 2×2 居中（c=11,w=2 于 cols=24）水平镜像后位置不变。
- **对外接口**（levels.js 以 `resolveBoard` 替代现 `TEMPLATES[templateId]`）：
  - `variantFor(chapter, k) → { boardId, mirror, slotsIdx, pathSubset }`（纯查表/纯数学）
  - `resolveBoard(chapter, k) → board`（完整对象：已镜像、已选 slots 套、terrain 已展开为 cells、按 pathSubset 过滤 camps/paths）
- **映射算法（写死，加载期零随机）**：
  ```js
  // 章 ch(1-5)、章内位置 k(0-9)；样板关由 SAMPLES 显式覆盖四元组
  boardId  = k < 5 ? `ch${ch}A` : `ch${ch}B`;
  mirror   = ['none', 'h', 'v', 'hv'][k % 4];
  slotsIdx = (ch + k) % SLOTS_VARIANTS;          // 每板 2-3 套将位
  pathSubset = SUBSET_TABLE[ch][k];               // §3.1 轮换窗口表（后半=全路）
  ```
- 分配目标与**防撞校验**：章内 10 关两两不同（A 板 5 变体 + B 板 5 变体）；**若基板自身有轴对称，镜像变体可能指纹撞车** → 单测对每基板做"4 镜像指纹去重"断言（撞车则该基板必须打破对称或调整分配表），另对 50 关全量做指纹两两比对断言（见 §10.1）。
- `campaign.js`：章 `templates` 字段与样板关 `templateId` 切到新基板 id（`ch1A`…`ch5B`）；生成关骨架补 `pathSubset`（前半子集）。

## 4. 系统层（新 `src/systems/terrainSystem.js`）

- 加载期把 terrain cells（含 rects 展开）烘焙成 `terrainAt[r][c]` 查找表（挂 level 展开产物）。
- **shallow**（集成选型=每帧维持，零接口改动）：terrainSystem 每 tick 对"所在格为浅滩"的敌人调 `applySlow(e, 0.3, 0.2, now)`（dur 0.2s 略大于帧间隔，出格自然衰退）——复用现有减速通道，与塔减速"取最强不叠加"规则天然一致；不改 statusEffects 接口。性能：≤数百敌 × O(1) 查表，可忽略。
- **firegully**（**独立环境灼烧槽，不共享塔灼烧 3 层栈**）：敌实例加 `envBurn = { dps, until }`，在区内每 tick 刷新（until = now+1.5s 即出区残留），statusSystem 结算处与塔灼烧栈**并行叠加**，走同一火系抗性通道（藤甲×2 照常）。理由：共享栈会让低值环境灼烧抢占诸葛/灼烧塔的层位，独立单槽实现同样简单且无干扰。
- **rockfall**：每区独立计时器（state 持久、确定性步进）：6s 周期 → 1s 前摇（渲染读 state 画警示圈）→ **落石时刻按"当时在区内"的敌人结算** AoE（敌所在格 ∈ 区域 cells 即命中，伤 30×scale）。语义取舍：不做"前摇锁定"（锁定后敌人跑出区外仍被砸更违和）；偶尔砸空可接受（环境氛围），由设计期保证区域覆盖足够长的路径段+周期对齐敌流密度来压低砸空率。
- **plateau**：plateau cells 属基板数据（将位坐标集合的子集）。建塔时检测 `slot ∈ plateauCells` → `tower.rangeBonus = 0.5`（实例静态字段）；**射程计算链路**（targeting/combat 与渲染范围圈）统一改读 `g.range + (t.rangeBonus || 0)`；**中断续玩恢复**：resume 重建塔时按 slot 坐标重算 rangeBonus（不依赖快照新字段，快照零迁移）。
- **禁建**：运行时零代码——slots 即建造白名单，基板作者保证 + verify 硬校验，不需要 build 时判定。
- **L50 雨**：level flag `disableTerrain:['firegully']` → terrainSystem 跳过该类型；渲染画雨丝；storyCard 文案补一句（仅 L50 样板字段，story 系统不改架构）。

## 5. 渲染层（`src/render/board.js` 增量）

全部程序化（沿用烟雾的 ctx save/restore 模式、动效读 `state.time`）。**绘制顺序（写死）**：草地 → **terrain 基底**（river/mountain/shallow/firegully/plateau 底图）→ 蜀道（路压在河上 = 渡口/浮桥的视觉天然成立）→ **terrain 特效**（rockfall 前摇警示圈/落石、火谷火苗摆动、浅滩波纹高光）→ 将位 → 敌营/成都建筑与名牌。样式：river/江面=蓝带+波纹线、shallow=亮蓝、plateau=黄土台+描边、mountain=深色岩壁+棱线、firegully=橙红地。章节 faction tint 照常，terrain 叠加其上。

## 6. 数值初值（实现期 balance-report + winnable 重校）

| 机制 | 初值 |
|---|---|
| plateau | 射程 +0.5 格 |
| shallow | 敌速 ×0.7（与塔减速取最强） |
| firegully | 灼烧 6×scale/s，出区残留 1.5s |
| rockfall | 周期 6s、前摇 1s、半径 1.2 格、伤 30×scale |

地形利好会让部分关变松：winnable 是真模拟、自然计入地形效果，实现期全 50 关重跑 + balance-report 复核，必要时调 difficulty 或缩地形区。L50（rampMax 1.0 + 火谷失效）单独重验。

## 7. 门禁与测试

- `tools/verify-levels.mjs` 扩展（**双入口**）：规则=①全部 slots（每套变体）不落 river/mountain 格 ②路径不穿 river/mountain（渡口/浮桥=路径格不属 river 区域）③shallow/rockfall/firegully 至少覆盖 1 个路径格。入口 1（硬门禁，现有 CLI 不变）：对展开后 LEVELS 50 关全量校验（自动覆盖全部**被使用**的变体组合）；入口 2（单测层 `tests/boardVariants.test.mjs`，仿 boardTemplates.test 模式 import `verifyLevel`）：10 基板 × 4 镜像 × 全部 slots 套**全组合**逐一过 verifyLevel + 每基板镜像指纹去重断言（防对称基板撞图）。
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

1. 几何指纹复测（**自动化断言，进单测**）：指纹 = `hash(序列化(paths) + 序列化(slots))`，50 关两两比对无相同指纹；章与章主题视觉明显不同（冒烟截图人工判）。
2. 营数逐关与现状一致（自动断言）；cities/cityAssign 测试不改一行且全绿。
3. 五章机制各自可演示：高台射程圈变大、渡口卡口、浅滩减速可见、落石砸中敌人、火谷灼烧跳字；L50 下雨火谷熄灭。
4. 全门禁绿：全部单测 + verify-levels（含变体全量）+ check-imports + winnable 50/50 + 每章冒烟截图。
