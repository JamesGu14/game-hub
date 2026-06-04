# 《群雄逐鹿·孟德篇》terrain-affinity — 设计稿（待审）

> 原创致敬作。沿用原版《三国志曹操传》的「天气 × 兵种 × 地形」三角博弈**机制结构**（事实性设定）
> 与公有领域《三国演义》/正史的地理意象（关隘、林山、津渡）；**所有数值、适性档位、ZOC 规则均为本作自定**，
> 不照搬任何商业游戏的数据表/文本。
>
> - **日期**：2026-06-04
> - **作者**：James（顾嘉晟）+ Claude
> - **状态**：**待 James 审阅**
> - **项目**：game-hub / `games/caocao-zhuan/`
> - **配套语料**：master 设计（§3.4 地形）、class-system（11 系 + footprint + 印绶）、item-system、weather-system（雾对远程、火/雷天气）、damage-preview（修正标签）。

本稿在既有 `data/terrain.js`（`moveCost{foot,horse}` / `defBonus` / `avoidBonus` / `passable` / `capture`）之上，
**增量扩展**「兵种地形适性（affinity）」「ZOC 控制区/卡位」「地形对计略与远程视野」「据点/城/关/桥/水的占领与通行」四块，
并给出 `combat` / `pathfind` / `attackReach` / `victory` / `weather` 的接入点。沿用语料术语：五维 **攻/精/防/爆/士**、11 系职业、`moveType`、`atkRange/counterRange`、`map.tiles[r][c]=terrainId`、`weather`。

---

## 0. 术语与现状对齐（重要）

- **坐标**：`c`=列、`r`=行；`map.tiles[r][c] = terrainId`（与 `grid.js` 一致）。
- **移动型 moveType**：当前代码两值 `'foot'|'horse'`。本稿引入**第三型 `'fly'` 占位**（后续象兵/特殊；本期不实装，仅在表里留列），并把 `moveCost` 由「双键」升级为「按 moveType 取值的字典」（向后兼容，见 §5.1）。
- **职业 classId 双轨现状**：
  - 代码现役 6 系：`infantry/spear/cavalry/archer/strategist/leader`（`moveType` 仅 foot/horse）。
  - class-system 定稿 11 系：`leader君主 / infantry步 / cavalry骑 / archer弓 / horse_archer弓骑 / martial武术家 / rogue盗贼 / artillery炮车 / strategist策士 / taoist道士 / fengshui风水士`（id 暂拟，转职链见该稿）。
  - **本稿适性表以「适性族 affinityClass」为主键**（见 §1.2），不绑定某一轮职业 id：每个 classId 映射到一个 affinityClass，使 6 系 → 11 系迁移时**只改映射、不改地形表**。这与 master「引擎/内容分离」一致。
- **天气联动**：地形修正与天气修正**相乘叠加**（见 §3、§5.4），与 weather-system 的 `weatherMods` 同一管线。

---

## 1. 兵种 × 地形适性表（affinity）

### 1.1 适性是什么（四类修正，全部数据驱动）
对「某 affinityClass 站在某 terrain 上」给出一组修正，作用面与原版一致地分三处落地：

| 修正字段 | 含义 | 落地点 | 说明 |
|---|---|---|---|
| `move` | 进入该格的**移动消耗倍率/覆盖** | `pathfind.enterCost` | 见 §5.1：优先按 affinityClass 查 `moveCost`，回退旧 foot/horse。 |
| `atkMod` | 站在该格时**有效攻击**倍率 | `combat.strike`（替换现 `terrainAtkMod=1` 占位） | 攻方所站格决定。 |
| `defMod` | 站在该格时**有效防御**倍率（叠加在 `defBonus` 之上） | `combat.strike` `defEff` | 守方所站格决定；与 `terrain.defBonus`（加法）并存：`defEff = (def + defBonus) * defMod`。 |
| `avoidMod` | 站在该格时**回避**加成（百分点，加到 `terrain.avoidBonus`） | `combat.strike` 命中式 | 守方所站格决定。 |

> **「110% 适性」概念**：当某 affinityClass 在某 terrain「擅长」时，给一个**温和正向**修正（≈ +10%，即 `atkMod`/`defMod` 取 1.1，或 `avoidMod` +10pt、`move` 打折）；
> 「不适」给 ≈ 0.9 或移动加费/不可入。**默认 1.0**（无修正）。这是「适性」而非「相克」——相克仍走 `classTriangle`，二者相乘（见 §3.2）。
> 之所以取 ±10% 量级：避免地形喧宾夺主压过兵种相克（克制可达 ×1.5），让地形是「锦上添花/扬长避短」的战术层。

### 1.2 适性族 affinityClass（11 系 → 6 族）
按机动与作战习性归族，降低维护面：

| affinityClass | 含 11 系 | 直觉 |
|---|---|---|
| `foot_melee` | 步兵 infantry、武术家 martial | 平原均衡、林山可走不亏 |
| `mounted` | 骑兵 cavalry、弓骑 horse_archer | 平原/路冲锋强、林山大亏 |
| `ranged_foot` | 弓兵 archer | 高地射程/命中加成、林中视野差 |
| `rogue` | 盗贼 rogue | 山林之王（移动+战斗双强） |
| `caster` | 策士 strategist、道士 taoist、风水士 fengshui | 地形对其物攻影响小、看视野/高地施法 |
| `siege` | 炮车 artillery | 路上强、林山/水极弱、攻城建筑加成 |
| `lord` | 君主 leader | 通用，略偏均衡（接近 foot_melee 但不亏林山） |

> **君主**单列 `lord` 而非并入 foot_melee：剧情主将不应因地形吃大亏（容错），与 master「曹操阵亡=败」一致。

### 1.3 适性矩阵（affinityClass × terrain）
单元格写 `{move, atk, def, avoid}`：
- `move`：进入消耗的**绝对值**（覆盖该族在该地形的消耗；`-` = 用地形缺省 foot 值；`×` = 不可入）。
- `atk/def`：倍率（1.0 缺省）。`avoid`：回避加成百分点（叠加在 `terrain.avoidBonus` 上，默认 0）。

| 地形＼族 | foot_melee | mounted | ranged_foot | rogue | caster | siege | lord |
|---|---|---|---|---|---|---|---|
| **草地 grass** | 1 / 1.0/1.0/0 | 1 / 1.05/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 |
| **道路 road** | 1 / 1.0/1.0/0 | **1 / 1.1/1.0/0** | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | **1 / 1.05/1.0/0** | 1 / 1.0/1.0/0 |
| **平原 plain**(新, 见§4) | **1 / 1.1/1.0/0** | **1 / 1.1/1.05/0** | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.05/1.0/0 |
| **森林 forest** | 1 / 1.0/1.05/+5 | **3 / 0.9/1.0/0** | 1 / 0.95/1.0/+5（视野−，见§3.3） | **1 / 1.1/1.1/+15** | 1 / 1.0/1.05/+10 | **× / —/—/—** | 1 / 1.0/1.05/+10 |
| **丘陵 hill** | 2 / 1.0/1.05/0 | 3 / 0.95/1.0/0 | **2 / 1.1/1.0/+5**（高地+射程,§3.1） | **1 / 1.05/1.05/+10** | 2 / 1.05/1.0/+5（高地+施法,§3.2） | 3 / 0.9/1.0/0 | 2 / 1.0/1.05/0 |
| **山地 mountain** | 3 / 0.95/1.1/+5 | **× / —/—/—** | **3 / 1.1/1.05/+10**（高地强,§3.1） | **2 / 1.1/1.15/+20** | 3 / 1.0/1.05/+10 | **× / —/—/—** | 3 / 0.95/1.1/+5 |
| **关门 gate** | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 | 1 / 1.0/1.0/0 |
| **桥 bridge**(新) | 1 / 1.0/0.9/−5 | 1 / 1.0/0.9/−5 | 1 / 1.0/0.9/−5 | 1 / 1.0/0.95/0 | 1 / 1.0/0.9/−5 | 2 / 1.0/0.9/−5 | 1 / 1.0/0.9/−5 |
| **浅滩/水 water** | × | × | × | × | × | × | × |
| **城墙/城内 fort**(新) | 1 / 1.0/1.1/+10 | 2 / 0.95/1.05/0 | 1 / 1.05/1.05/+10 | 1 / 1.05/1.1/+10 | 1 / 1.0/1.1/+10 | **守强攻弱,§4.4** | 1 / 1.0/1.1/+10 |

**读表要点（与语料一致的「110% 适性」落点）**：
- **步兵/武术家 平原强**：plain `atk 1.1`（master §3.2「步均衡」+ 平原扬长）。
- **骑兵 林山弱**：forest `move 3` 且 `atk 0.9`；mountain `×`（不可入，与现 terrain.js「horse 上山 99」一致，本稿改为族级 `×` 更直观）。骑兵 road/plain `atk 1.1`（冲锋）。
- **盗贼 山林强**：forest/hill/mountain 全族最佳——`move` 不加费、`atk/def/avoid` 全正向（呼应 class-system「盗贼·山林移动/战斗强」「山岚」计略）。
- **弓在高地**：hill/mountain `atk 1.1` + 射程 +1（§3.1），呼应 master「弓克远程」「高地射程」。
- **水战**：本期 `water` 全不可入（passable:false 不变）；真正水战（楼船/水军）作后续章节扩展（§7 待确认 + §4.5）。

> 数值是**起步基线**，集中在 `data/affinity.js` 便于一处调参（master §9「数值集中在 data/」）。

---

## 2. ZOC（控制区 / 卡位）规则

原版「控制区」让前排能拦住敌方穿插，是战棋的战术骨架。本作引入**轻量 ZOC**，数据驱动、可整关开关。

### 2.1 定义
- **敌方单位的 ZOC** = 其**正交四邻**格（沿用 `grid.neighbors` 的四向，不含斜角，与攻击/移动一致）。
- **移动穿越规则**：单位寻路时，**进入**一个「位于敌方 ZOC 内」的格后**必须停止**（该格仍可作为终点，但不能继续向外扩展）。即 ZOC 不增加进入消耗，而是**截断后续移动**（原版风味；比「ZOC 加费」更可读、对 7 岁/休闲也友好）。
- **自身/友方 ZOC 不拦自己人**：只有**敌对阵营**的 ZOC 才截断本单位。
- **可豁免**：
  - `class.ignoreZoc:true`（如盗贼「义贼」高机动、君主酌情）——穿 ZOC 不停（数据驱动，先给盗贼）。
  - 飞行型 `moveType:'fly'`（后续）默认 `ignoreZoc`。
- **terrain 也可声明 `zocFlag`**：`gate`/`fort`/`bridge` 的**占据者** ZOC **加强**（见 §2.3 卡关），用 `terrain.zocStrong:true` 标记，效果=「站在该地形上的单位，其 ZOC 截断更硬（连斜角也算，或对周围两格生效）」——本期先做「关/桥占据者 ZOC 正常但**该地形本身狭窄**靠地图布局卡位」，`zocStrong` 留字段、默认关。

### 2.2 ZOC 对寻路的接入（关键）
`reachable` 与 `path` 在松弛邻居时，新增「**进入 ZOC 格后不再扩展**」：
```
扩展节点 cur 的邻居 nb：
  正常算 enterCost、累计 nd<=mov；
  若 nb 是合法落点 → 记入 dist（可作终点）；
  若 cur 本身位于敌方 ZOC（且本单位不 ignoreZoc）→ 不从 cur 继续扩展其邻居。
```
即「ZOC 性质挂在节点上，进入即封口」。`occupied`（敌我占格）仍照旧不可停留/穿越。

### 2.3 卡位/卡关战术（与据点联动）
- **关门 gate / 桥 bridge** 多为**单宽**通道（地图设计层保证），一名带 ZOC 的前排站桥头/关口即可**封锁通行**——这是「以少守关」的核心玩法（master 第一章汜水关/虎牢关）。
- AI（master §3.10「守备」性格）应理解 ZOC：守点单位优先卡在通道格。

---

## 3. 地形对计略 / 远程 / 视野（与天气稿联动）

### 3.1 远程射程与高地（弓/弓骑/炮）
- **高地加程**：站在 `hill`/`mountain`/`fort`(城墙) 的**远程单位**，其 `attackReach` 的 `attackShape.max` **+1**（呼应「弓在高地射程」）。
- **命中**：高地远程额外 +5% 命中（叠加在适性 `avoid`/士气之外，作为「居高临下」标签）。
- **与天气叠加**：weather-system「雾 → 远程 max −1、命中 −15%」与本高地 +1/+5% **代数相加**（雾中高地弓：max 净 +0、命中净 −10%）。统一在 `attackReach`/命中管线结算，预测面板（damage-preview）显示「高地+1 · 雾−1」两枚标签。

### 3.2 计略与地形（施法可用性 + 威力）
沿用 weather-system 的 `SkillDef.weather{require,blockedIn,powerMod}` 范式，**新增对位的 `terrain` 字段**：
```js
// 扩 SkillDef（与 weather 同管线，相乘叠加）
terrain: {
  blockedCasterOn: ['water'],          // 施法者站此地形不可施法（占位；本期空）
  blockedTargetOn: ['fort_inner'],     // 目标格此地形免疫（如城内免火？默认不设）
  powerByTargetTerrain: { forest: 1.2, hill: 1.1, water: 0.8 }, // 目标所在地形调威力
}
```
- **火系 × 林**：火计/火阵命中**林 forest** 目标 `×1.2`（草木易燃；与「晴↑雨↓」相乘）——经典「火烧连营/博望坡」意象（公有领域）。森林着火可选**留「燃烧」地形状态**（§4.6，后置）。
- **高地施法**：caster 站 hill/mountain，计略命中 +5%（同 §3.1 居高临下，作命中标签）。
- **风系不受天气**（weather 稿）且**不受林/城限制可选**：本稿规定**风系 `terrainImmune:true`**（与 `weatherImmune` 并列），简化（原版风系在林/城内受限，本作为可读性先全程可用，留字段后调）。
- **水系 × 桥/水**：浊流等水系对**桥 bridge / 临水**目标 `×1.2`（地利）。

### 3.3 视野（先轻量，留接口）
- master/weather 已有「雾降视野」。本稿补**地形视野**：`forest`/`fort` 内单位**降低被远程预瞄的可见性**（先做表现层与「视野遮挡」占位字段 `terrain.blocksSight:true`），**本期不做真 LOS（视线遮挡命中）**——第一章地图开阔，远程靠射程而非 LOS。
- 留 `terrain.sightCost`（进入后视野半径修正）与 `blocksSight` 字段，供后续「伏兵/雾林突袭」与 AI 感知使用（master §3.10）。

---

## 4. 特殊地形：据点 / 城 / 关隘 / 桥 / 水 的占领与通行

### 4.1 现有 `gate` 关门（保留 + 强化）
- 现状：`capture:true`、`defBonus:3`。本稿补**占领判定**字段 `captureBy`（见 §5.3）与 ZOC 卡关（§2.3）。
- **占领规则**：我方单位**停留**在 `capture:true` 格，回合结束时该格归属切换为该阵营（`map.captureOwner[key]`）。胜负条件 `holdGate`/`captureGate` 在 `victory` 读取（master §3.9「占领据点」）。

### 4.2 新增地形一览（扩 `TERRAIN`）
| id | 名称 | passable | moveCost(foot基) | defBonus | avoid | capture | 备注 |
|---|---|---|---|---|---|---|---|
| `plain` | 平原 | true | 1 | 0 | 0 | — | 比 grass 更「空旷」，骑/步扬长（§1.3）。 |
| `bridge` | 桥 | true | 1 | 0 | −5（暴露） | — | 单宽要冲；落水风险占位（§4.5）。 |
| `fort` | 城墙/城内 | true | 1 | 4 | +10 | true | 城防最高；攻城专属规则 §4.4。 |
| `gate_castle` | 城门 | true | 1 | 4 | 0 | true | 城的占领点；破门=占领=胜利目标。 |
| `shoal` | 浅滩 | true | 3(foot)/×(horse) | 0 | 0 | — | 可涉水（步可过、骑不可），水陆过渡。 |
| `wall` | 城垛(不可入) | false | × | — | — | — | 纯阻挡（攻城时弓可越打、人不可入）。 |
| `camp` | 营寨/帐 | true | 1 | 2 | 0 | true | 偷营/守营目标（呼应「劫营」桥段）。 |

> `water` 维持 `passable:false`（除非水军章节）；`shoal` 提供「步兵涉滩、骑兵绕行」的轻度水陆差异，无需上水战系统即可有「津渡」战术。

### 4.3 关隘通行（关门/城门）
- **通过即占领点**：`gate`/`gate_castle` 是胜负落点；敌方守关 = 玩家须打掉守军 + 站上去。
- **狭口 + ZOC**：关前一格往往单宽，守军 ZOC 卡死，玩家须正面强攻或用计略/远程清场（master 教学「攻坚/关隘地形」）。

### 4.4 攻城（siege 与 fort/wall，phaseable）
- `fort`/`wall`：**守方** def 极高、avoid 高；**炮车 siege** 对**站在 `fort`/`wall`/`gate_castle` 的目标**或对建筑本身 `atkMod` **+50%**（攻城专长，呼应 class-system「炮车·城战强」）。
- 其余兵种攻城吃满 `defBonus`，逼迫玩家「带炮车/用计略/破门」——形成攻城关的解法多样性。
- **phaseable**：城/攻城在「城战章节」实装；第一章只用 `gate`（关门）即可跑通占领玩法。

### 4.5 桥 / 水 / 浅滩
- `bridge`：单宽、`avoid −5`（桥上无遮蔽、易被远程/计略集火）；**炮车过桥 move 2**（笨重）。可选「落水」事件（被击退到 water 即落水退场/重伤）——**占位，本期不做击退**。
- `water`：不可入、不可越（寻路阻挡，现状不变）；计略可越水打（远程/AOE 不受 passable 限制，只看 `attackReach`/AOE 形状）。
- `shoal`：步可涉（move 3，慢）、骑不可，给「绕滩 vs 涉滩」的取舍。

### 4.6 地形动态状态（后置占位）
- `terrain` 可被计略改变：火系命中林 → 该格转「燃烧 forest_fire」（每回合灼伤 + 阻挡）；水系/雨 → 路转「泥泞」（移动 +1，已在 weather 稿）。
- 本期**只做泥泞**（weather 稿已含）；**燃烧/水淹/塌桥**等动态地形留 `map.terrainOverrides[key]` 接口（§5.5），后续章节实装。

---

## 5. 数据结构与接入点（build-ready）

### 5.1 `data/terrain.js` 字段扩展（向后兼容）
在每个 `TerrainDef` 上**增量**加（旧字段全保留）：
```js
TerrainDef {
  id, name,
  // —— 旧（保留）——
  moveCost: { foot, horse },   // 兼容回退：affinity.moveCost 缺该族时用此
  defBonus,                    // 加法（仍生效）
  avoidBonus,                  // 加法基线（仍生效）
  passable,                    // 不变
  capture,                     // 不变（占领点）

  // —— 新（本稿）——
  category: 'open'|'cover'|'high'|'water'|'fort'|'gate'|'bridge', // 归类，给 AI/UI/视野用
  zocStrong: false,            // 占据者 ZOC 是否加强（卡关，默认 false）
  blocksSight: false,          // 是否遮挡视野（后续 LOS/伏兵用，本期仅占位/表现）
  sightCost: 0,                // 进入后视野半径修正（占位）
  captureBy: 'any'|'wei'|'foe',// 谁可占领（缺省 'any'）
  // 真正的「兵种适性」不写在 terrain，而是独立矩阵（见 5.2），保持地形表干净。
}
```

### 5.2 新建 `data/affinity.js`（适性矩阵主表）
```js
// classId -> affinityClass 映射（迁移期一处维护；6系/11系都映射到 6 族）
export const AFFINITY_CLASS = {
  // 现役 6 系
  infantry:'foot_melee', spear:'foot_melee', cavalry:'mounted',
  archer:'ranged_foot', strategist:'caster', leader:'lord',
  // 11 系（class-system 落地后启用，id 以该稿为准）
  martial:'foot_melee', horse_archer:'mounted', rogue:'rogue',
  taoist:'caster', fengshui:'caster', artillery:'siege',
};

// affinityClass × terrainId -> { move, atk, def, avoid }
//   move: number（进入消耗）| 'block'（不可入）| null（用 terrain.moveCost 回退）
//   atk/def: 倍率（默认 1）；avoid: 百分点加成（默认 0）
export const AFFINITY = {
  foot_melee: { grass:{}, road:{}, plain:{atk:1.1}, forest:{def:1.05,avoid:5},
                hill:{move:2,def:1.05}, mountain:{move:3,atk:0.95,def:1.1,avoid:5}, /* ... */ },
  mounted:    { road:{atk:1.1}, plain:{atk:1.1,def:1.05}, forest:{move:3,atk:0.9},
                hill:{move:3,atk:0.95}, mountain:{move:'block'}, /* ... */ },
  // ranged_foot / rogue / caster / siege / lord 同 §1.3 表
};

// 查询：返回合并后的修正（缺省值兜底）
export function affinityOf(classId, terrainId) {
  const fam = AFFINITY_CLASS[classId] || 'foot_melee';
  const cell = (AFFINITY[fam] && AFFINITY[fam][terrainId]) || {};
  return { move: cell.move ?? null, atk: cell.atk ?? 1, def: cell.def ?? 1, avoid: cell.avoid ?? 0 };
}
```

### 5.3 `pathfind.js` 接入（移动消耗 + ZOC）
- **enterCost 升级**（最小改动、向后兼容）：
```js
function enterCost(map, c, r, moveType, classId) {       // 新增 classId 形参（可选）
  const tid = tileAt(map, c, r); if (tid==null) return Infinity;
  const def = TERRAIN[tid]; if (!def || def.passable===false) return Infinity;
  if (classId) {
    const a = affinityOf(classId, tid);
    if (a.move === 'block') return Infinity;             // 族级不可入（如骑兵上山）
    if (typeof a.move === 'number') return a.move;       // 族级覆盖
  }
  const mc = def.moveCost ? def.moveCost[moveType] : undefined; // 回退旧逻辑
  return typeof mc === 'number' ? mc : Infinity;
}
```
  `reachable`/`path` 把 `unit.classId` 透传给 `enterCost`（`path` 已收 `moveType`，再加可选 `classId`）。
- **ZOC 接入**（§2.2）：`reachable`/`path` 需要敌方占格集合 `enemyCells`（controller 已知阵营）。在松弛时：
  - 计算 `zocCells`（enemyCells 的四邻并集，排除 enemyCells 本身，除非 `unit` 之 class `ignoreZoc`）。
  - 节点 `cur` 若 `zocCells.has(curKey)` 且 `!ignoreZoc` → **不扩展其邻居**（但 cur 仍是合法落点）。
  - 签名建议：`reachable(unit, map, occupied, { enemyCells, classes })`（可选第 4 参，缺省=无 ZOC，保单测兼容）。

### 5.4 `combat.js` 接入（atk/def/avoid 适性，替换占位）
当前 `strike` 内：`const terrainAtkMod = 1; // 预留`、`defEff = defender.def + defTerrain.defBonus`、命中扣 `defTerrain.avoidBonus`。改为：
```js
const atkAff = affinityOf(attacker.classId, terrainIdAt(map, attacker.pos)); // 攻方所站
const defAff = affinityOf(defender.classId, terrainIdAt(map, defender.pos)); // 守方所站
const terrainAtkMod = atkAff.atk;                                  // 替换占位 1
const defEff = (defender.def + defTerrain.defBonus) * defAff.def;  // 适性乘在加法之后
const avoid = defTerrain.avoidBonus + defAff.avoid;                // 适性回避叠加
const hitChance = clamp(85 + (attacker.spd - defender.spd) - avoid + highGroundHit, 30, 100);
// raw = (attacker.atk * tri * terrainAtkMod * weatherAtkMod - defEff) * jitter;  // 天气相乘
```
- 与 `triangleMul`（相克，§3.2）**相乘**：`atk.atk * tri * terrainAtkMod`，互不替代。
- 与 **weather** 相乘（§3.2 同管线）。
- `highGroundHit`：远程在高地 +5%（§3.1），由调用方/combat 据 `attackShape.kind==ranged && terrain.category==='high'` 给。

### 5.5 其它接入点
- **`attackReach(unit, map)`**（class-system 第 3 点）：远程在高地 `attackShape.max + 1`（§3.1），与 weather「雾 −1」代数相加后 clamp。
- **`battle/forecast.js`（damage-preview）**：`mods` 标签新增 `地形:林 守×1.05`、`高地 射程+1`、`高地 命中+5%`、`骑·林 攻×0.9` 等（kind: up/down/info），保证「预测=实际」走同一 `affinityOf`/`combat` 核。
- **`battle/victory.js`**：`captureGate`/`holdGate N`/`raidCamp`/`breakCastleGate` 读 `map.captureOwner` 与 `capture/captureBy`（master §3.9）。
- **`skillEngine`**：读 `SkillDef.terrain`（§3.2）：`powerByTargetTerrain`、`blockedTargetOn`、`terrainImmune`；与 weather 的 `powerMod` 相乘。
- **`render3d/terrainFactory.js`**：新地形（plain/bridge/fort/wall/shoal/camp/gate_castle）的程序化 mesh + 颜色；占领归属用旗/染色表现；ZOC 可选高亮（移动范围里被 ZOC 截断的边界格描边）。
- **`ai.js`**：守备性格优先卡 `zocStrong`/通道格；骑兵 AI 回避 `mountain`（block）/`forest`（高费）；远程 AI 抢 `hill`（高地）。
- **map 动态覆盖**：`map.terrainOverrides[`c,r`]=terrainId`（§4.6 燃烧/泥泞/塌桥后续），`tileAt` 读取时优先覆盖层（占位，本期不实装动态）。

---

## 6. UX（曹操传式，与既有高亮一致）
- **移动范围**：蓝格（class-system 第 1 点）；被**敌方 ZOC 截断**的格用「半透蓝 + 锁链描边」提示「到此为止」。
- **地形信息卡**：光标悬停地块 → 小卡显示「地形名 · 防+X · 回避+Y% · 对本选中单位：移动N/攻×/防×/避+」（即时看适性，鼠标优先，master §2 操作）。
- **预测面板**（damage-preview）：把地形/高地/天气/相克作为彩色标签并列，绿=利、红=不利、灰=miss 风险。
- **占领点**：`capture` 地块画占领进度/归属旗；可被占领时高亮提示。
- 全程**鼠标优先 + 键盘**，含「← HUB」与静音（master 工程约定，引擎层已有）。

---

## 7. 范围与分期（phaseable）
- **第一章（M1）必做**：
  1. `data/affinity.js` + `affinityOf`；`AFFINITY_CLASS` 覆盖现役 6 系。
  2. `combat` 接 atk/def/avoid 适性（替换占位 `terrainAtkMod=1`）。
  3. `pathfind` enterCost 接 affinity `move`/`block`；骑兵上山/入林按表。
  4. **ZOC**（核心卡关玩法，汜水关/虎牢关教学）；盗贼 `ignoreZoc`。
  5. 新地形：`plain`/`bridge`/`gate`（已有）+ 关前狭口；`forest/hill/mountain` 适性。
  6. 远程**高地 +1 射程/+5% 命中**；火系 ×林 1.2；与 weather 相乘。
  7. forecast/UI 标签 + 地形信息卡。
- **后续章节（留接口、不实装）**：攻城（fort/wall/城门 + 炮车攻城）、水战（water 可入 + 楼船/水军 affinity）、动态地形（燃烧/泥泞已部分/塌桥/水淹）、真 LOS 视野与伏兵、`zocStrong` 强卡关、落水击退、果子未涉。

---

## 8. 单元测试（纯逻辑层，放 `tests/`）
- `affinityOf`：未知 classId/terrain 回退默认 `{move:null,atk:1,def:1,avoid:0}`；6 系映射正确。
- `pathfind`：骑兵 `mountain`→不可达；骑兵 `forest` move=3；步兵 `mountain` move=3；`shoal` 步可骑不可。
- **ZOC**：单敌单位四邻成 ZOC；穿 ZOC 进入即截断（终点合法、邻居不扩展）；`ignoreZoc` 单位不被截断；友方不拦自己。
- `combat`：守方在 `forest` `defEff` 乘 1.05 且回避 +20（盗贼林）；骑兵站 `forest` 攻 ×0.9；与 `triangleMul`/天气**相乘**不互相覆盖；高地远程命中 +5%。
- `attackReach`：远程在 hill `max+1`；雾中高地净 +0。
- 与 `forecast`：预测的 atk/def/avoid 修正与 `resolveAttack` 实跑同输入一致（damage-preview 自洽要求）。

---

## 9. 待确认（请 James 拍板）
1. **职业 id 终稿**：11 系最终 id（`martial/rogue/horse_archer/taoist/fengshui/artillery`）以 class-system 定为准；本稿 `AFFINITY_CLASS` 映射键需对齐——是否现在就把代码 6 系迁到 11 系，还是 6 系先跑、迁移时只补映射？（本稿默认后者。）
2. **适性强度量级**：`±10%`（110% 适性）是否合适？是否要让「盗贼·山」更夸张（如 def 1.2 / avoid +25）以凸显特色？还是保守压在 ±10~15%？
3. **ZOC 模型**：采「进入即截断后续移动」（本稿）还是「ZOC 加移动费」？是否四向（不含斜角，与攻击一致）？哪些职业 `ignoreZoc`（盗贼必给；君主？弓骑？）。
4. **骑兵上山**：用族级 `move:'block'`（不可达，更直观）替换现 `moustain horse:99`，可否？（行为等价，可读性更好。）
5. **新地形清单**：第一章是否需要 `plain`/`bridge`/`shoal`，还是先只用现有 7 种地形 + 适性，新地形随城战/水战章节再加？（建议至少 `plain`+`bridge` 进第一章，配合关隘卡位。）
6. **火 × 林 ×1.2** 与「燃烧地形」：本期只做威力加成、不做动态着火地形，可否？
7. **高地 +1 射程**：仅 `hill/mountain/fort` 还是也含某些 `gate_castle`？命中 +5% 是否合并进士气而非单列标签？
8. **视野/LOS**：第一章确认**不做真视线遮挡**（仅留 `blocksSight` 字段），靠射程+天气雾即可，对吗？
9. **据点占领判定**：「停留到回合结束即占领」是否够？是否需要「连续占领 N 回合」或「驱逐原占据者」更严格规则？
