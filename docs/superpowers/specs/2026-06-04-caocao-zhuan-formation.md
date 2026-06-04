# 《群雄逐鹿·孟德篇》阵型系统 — 设计稿（待审）

> 原创致敬作。采用《三国志曹操传》一脉 SRPG 的「全军阵型给取舍加成」**机制结构**（事实性玩法范式）
> 与公有领域兵法意象（鱼鳞、锋矢、雁行、方圆、锥行——皆出自公有领域兵书/战阵传统）；
> **所有阵型档位、加成数值、限制规则均为本作自定**，不照搬任何商业游戏的数据表/文本。
>
> - **日期**：2026-06-04
> - **作者**：James（顾嘉晟）+ Claude
> - **状态**：**待 James 审阅**
> - **项目**：game-hub / `games/caocao-zhuan/`
> - **覆盖**：master 设计 §3.8（阵型与转职）中「阵型」一半——这是 master 列举的核心系统里**唯一尚无专稿**的一块。
> - **配套语料**：class-system（五维 攻/精/防/爆/士、11 系、footprint、印绶转职）、terrain-affinity（适性族 affinityClass、ZOC、地形修正乘法链）、weather-system（天气乘法链）、damage-preview（修正标签 mods）、enemy-ai（性格 + 难度缩放 + boss/援军）、campaign-structure（难度三档、存档 settings/campaign）、economy-shop（消耗资源）、recruitment-allies（客将 guest）、**balance-master**（伤害乘法链与三难度表的唯一权威，本稿引用其序，不重定义）。

---

## 0. 定位与现状对齐（重要）

### 0.1 阵型在本作里是什么
- **阵型 = 玩家在整军/战前为「全军」选定的一种队形**，给**我方全体单位**一组**取舍式**修正（增一项必减一项），影响**攻 / 防 / 移动 / 攻击范围**几个维度的偏向。它是**关级（per-battle）战术抉择**，不是单兵装备、不是兵种相克，也不是地形适性。
- 与既有系统的关系（**全部相乘、互不替代**，见 §3）：
  - **兵种相克**（`classTriangle.triangleMul`）：阵型不改它。
  - **地形适性**（terrain-affinity `affinityOf`）：阵型不改它。
  - **天气**（weather-system `weatherMods`）：阵型不改它。
  - **印绶转职 / 五维成长**（class-system）：阵型是**临时乘子**，不写进 roster 的持久属性。
- 一句话定位：**阵型是「全军层面的一次性偏好旋钮」**——锋矢则攻强守弱、方圆则守强攻钝。它让「同一支队伍在不同关卡用不同打法」，是 master「完整拟真」清单里的战术层。

### 0.2 术语对齐（沿用语料，勿新造）
- **五维**：攻 / 精 / 防 / 爆 / 士（class-system §0）。本稿加成默认作用于**攻 / 防**两维 + **移动 mov** + **攻击范围 footprint.max**；精/爆/士默认不动（留字段，见 §2.3）。
- **乘法链**：伤害结算中各乘子相乘的**唯一规范序由 balance-master 定义**；本稿只声明「阵型贡献两个乘子 `formAtkMul` / `formDefMul`，作为该链中的两项」，**不重排该链、不定 clamp**（§3.1）。
- **affinityClass**：terrain-affinity 的适性族（foot_melee/mounted/ranged_foot/rogue/caster/siege/lord）。阵型的**兵种契合（synergy）**复用同一族键（§6）。
- **moveType**：`'foot'|'horse'`（现役），terrain-affinity 预留 `'fly'`。
- **难度**：`settings.difficulty ∈ {easy,normal,hard}`（campaign-structure §6 字段已存在）。阵型对 AI 的启用与难度联动以 **balance-master / enemy-ai 为准**（§5）。

### 0.3 代码现状（接入面）
- `battle/combat.js` `strike()`：`const terrainAtkMod = 1; // 预留` 一行——**阵型乘子与之同位插入**（§3.2），与 terrain-affinity 替换该占位的做法是**同一管线、相乘**。`defEff = defender.def + defTerrain.defBonus`——阵型的 `formDefMul` 乘在 `defEff` 上（§3.2）。
- `data/difficulty.js`（campaign-structure 新增）、`data/affinity.js`（terrain-affinity 新增）已是「集中数值表」的先例——本稿照此新建 **`data/formations.js`**。
- `core/gameState.js`：`state` 当前有 `chapter/battleIndex/roster/inventory/storyFlags/settings`。阵型选择是**全军级、跨战持久**的偏好 → 新增 `state.formationId`（§4.2，含存档迁移）。
- `ui/intermission.js` `run(ctx)`（整军，返回 Promise）：**选阵主入口**挂这里（§4.1）。
- `battle/battleController.js`：`makeUnit` 归一单位、难度乘数注入点（enemy-ai §345）——阵型乘子由 controller 在装配/结算时按 `unit.faction` 决定是否套用（我方=玩家所选阵；敌/友军见 §5、§7）。
- `battle/forecast.js`（damage-preview）：`mods` 标签需新增「阵型」项（§3.3）。

---

## 1. 阵型种类（5 基础 + 1「无阵」缺省，全军取舍加成）

> 设计基线：**温和量级**（与 terrain-affinity「±10% 适性」一致的克制观）——单个阵型对攻/防的偏向控制在 **±8%~12%**，移动 **±1**，footprint **+0/+1**。绝不让阵型压过兵种相克（可达 ×1.5）或地形（×1.1）。阵型是「整体性格」，不是「胜负开关」。

| id | 名称 | 直觉一句话 | 攻 | 防 | 移动Δ | 远程射程Δ | 主取舍 |
|---|---|---|---|---|---|---|---|
| `none` | 无阵（散阵） | 缺省，无偏向 | 1.00 | 1.00 | 0 | 0 | 基准，永远可用 |
| `fish_scale` | 鱼鳞 | 厚密防御阵，结硬寨 | 0.95 | **1.12** | **−1** | 0 | 守强 / 攻略钝 / 行动慢 |
| `arrow` | 锋矢 | 集中突破、一点凿穿 | **1.12** | 0.92 | 0 | 0 | 攻强 / 防弱 |
| `wild_goose` | 雁行 | 张两翼、利远程与包夹 | 1.00 | 0.96 | 0 | **+1** | 远程/包夹强 / 防略弱 |
| `square` | 方圆 | 四面环卫、稳如磐石 | 0.90 | **1.10** | −1 | 0 | 极守 / 攻最弱（守城/被围用） |
| `awl` | 锥行 | 长驱奔袭、快打快走 | 1.05 | 0.95 | **+1** | 0 | 机动+小攻 / 防略弱（追击/抢点） |

**读表要点**：
- **每阵必有取舍**：没有「全正向」阵；`none` 是中性基准。锋矢攻高必防低，鱼鳞/方圆防高必慢/攻钝。
- **移动Δ 与 footprintΔ 是整数加减**（作用于 `mov` 与远程 `attackShape.max`，clamp 见 §3.2），不是乘子——更可读、对休闲玩家直观。
- **雁行 +1 射程**只对**远程兵种**（affinityClass ∈ {ranged_foot, siege}，或 `attackShape.kind==='ranged'`）生效；近战阵无意义 → 由 footprint 类型自然过滤（§3.2）。
- **方圆**是「守城/被围/坚守 N 回合」关的专用解（master §3.9「坚守」胜利条件），攻最弱逼玩家「先稳后破」。
- **锥行**是「护送到达 / 抢占据点 / 追击」关的解（master §3.9，配合 terrain-affinity 占领玩法）。

> 数值是**起步基线**，集中在 `data/formations.js` 一处调参（master §9「数值集中在 data/」、balance-master 平衡权威）。

---

## 2. 数据形状（`data/formations.js`，build-ready）

### 2.1 `FormationDef`
```js
// data/formations.js — 阵型定义（纯数据，禁止 import three / 触碰 DOM）
//
// 设计：每个阵型给全军一组「取舍式」修正。乘子默认作用于 攻/防；
//       整数 Δ 作用于 移动 与 远程射程。精/爆/士默认不动（留字段）。
//
// 接入：combat.js strike() 取 formAtkMul/formDefMul（相乘，与地形/天气/相克同链，
//       规范叠加序见 balance-master）；pathfind 取 movDelta；attackReach 取 rangeDelta。

export const FORMATIONS = {
  none: {
    id: 'none', name: '无阵', short: '散',
    desc: '不结阵，无偏向。随时可用。',
    mods: { atkMul: 1.00, defMul: 1.00, movDelta: 0, rangeDelta: 0 },
    // 留字段（本期不动，balance-master 后续可启用）：
    // spdMul/critMul/moraleMul，rangeAppliesTo:'ranged'|'all'，aoeRadiusDelta
    synergy: {},                 // affinityClass -> 额外乘子覆盖（§6），缺省空
    restrictions: {},            // 解锁/使用限制（§2.2），缺省无
    icon: 'scatter',             // render3d/UI 图标键（程序化）
  },

  fish_scale: {
    id: 'fish_scale', name: '鱼鳞', short: '鳞',
    desc: '层叠如鱼鳞，正面厚实。守强，但攻略钝、行动迟缓。',
    mods: { atkMul: 0.95, defMul: 1.12, movDelta: -1, rangeDelta: 0 },
    synergy: { foot_melee: { defMul: 1.04 }, mounted: { movDelta: 0 } }, // 步兵更稳；骑兵抵消减速
    restrictions: {},
    icon: 'scale',
  },

  arrow: {
    id: 'arrow', name: '锋矢', short: '矢',
    desc: '聚力于锋，一点凿穿。攻强，防偏弱。',
    mods: { atkMul: 1.12, defMul: 0.92, movDelta: 0, rangeDelta: 0 },
    synergy: { mounted: { atkMul: 1.04 } },     // 骑兵突击更利
    restrictions: {},
    icon: 'arrow',
  },

  wild_goose: {
    id: 'wild_goose', name: '雁行', short: '雁',
    desc: '张两翼，利远射与包夹。远程射程+1，防略弱。',
    mods: { atkMul: 1.00, defMul: 0.96, movDelta: 0, rangeDelta: 1, rangeAppliesTo: 'ranged' },
    synergy: { ranged_foot: { atkMul: 1.05 }, siege: { rangeDelta: 1 } },
    restrictions: {},
    icon: 'goose',
  },

  square: {
    id: 'square', name: '方圆', short: '方',
    desc: '四面环卫，稳如磐石。极守，攻最弱。守城/被围首选。',
    mods: { atkMul: 0.90, defMul: 1.10, movDelta: -1, rangeDelta: 0 },
    synergy: { foot_melee: { defMul: 1.05 }, lord: { defMul: 1.04 } }, // 护主
    restrictions: {},
    icon: 'square',
  },

  awl: {
    id: 'awl', name: '锥行', short: '锥',
    desc: '长驱奔袭，快打快走。移动+1、小攻，防略弱。追击/抢点用。',
    mods: { atkMul: 1.05, defMul: 0.95, movDelta: 1, rangeDelta: 0 },
    synergy: { mounted: { movDelta: 1 }, rogue: { movDelta: 1 } }, // 骑/盗更快
    restrictions: {},
    icon: 'awl',
  },
};

// 缺省阵 id（无存档/旧档迁移兜底）
export const DEFAULT_FORMATION = 'none';

/**
 * 取某阵型对某 affinityClass 的合并修正（base mods 叠加 synergy 覆盖）。
 * synergy 中的同名键「覆盖/相乘」规则：乘子相乘、整数Δ相加（见下）。
 * @param {string} formationId
 * @param {string} affinityClass  terrain-affinity 的适性族键（由 classId 映射而来）
 * @returns {{atkMul:number, defMul:number, movDelta:number, rangeDelta:number, rangeAppliesTo:string}}
 */
export function formationMods(formationId, affinityClass) {
  const f = FORMATIONS[formationId] || FORMATIONS[DEFAULT_FORMATION];
  const base = f.mods || {};
  const syn = (f.synergy && affinityClass && f.synergy[affinityClass]) || {};
  return {
    atkMul:   (base.atkMul   ?? 1) * (syn.atkMul   ?? 1),   // 乘子：相乘
    defMul:   (base.defMul   ?? 1) * (syn.defMul   ?? 1),
    movDelta: (base.movDelta ?? 0) + (syn.movDelta ?? 0),   // 整数Δ：相加
    rangeDelta:(base.rangeDelta?? 0) + (syn.rangeDelta?? 0),
    rangeAppliesTo: base.rangeAppliesTo || 'ranged',
  };
}
```
> **synergy 合并约定**（与 terrain-affinity `affinityOf` 风格一致）：乘子相乘、整数Δ相加；缺省即 base。这样「鱼鳞 −1 移动 + 骑兵 synergy +1」= 骑兵在鱼鳞阵净 0 移动（抵消减速），数据可读、易调。

### 2.2 限制 `restrictions`（解锁 / 使用约束，本期最小化）
```js
restrictions: {
  unlockFlag: null,        // 需某 storyFlag 才可选（如高级阵后续章节解锁）；null=默认解锁
  minChapter: 1,           // 最早可用章（缺省 1）
  requireClasses: null,    // 需队中含某 affinityClass 才可结（如方圆需≥1步兵）；null=无要求
  guestExempt: true,       // 客将(guest:true)是否仍吃阵型加成（见 §7）；缺省 true=吃
  // 后续(P4)：consumeOnSwitch（战中切阵消耗气力/资源）、cooldownTurns
}
```
- **第一章（M1）**：仅 `none`（缺省）+ `fish_scale`（鱼鳞）+ `arrow`（锋矢）三阵**默认解锁**、无限制；其余三阵 `unlockFlag` 留空但在 UI 标「后续解锁」或直接全开（§8 待确认 1）。
- `requireClasses` 本期不强制（留字段）；`minChapter`/`unlockFlag` 给后续章节「学阵」叙事用钩子（可由 scenarioRunner 的 `setFlag` 步骤点亮——content-pipeline 步骤目录权威）。

### 2.3 留字段（P4 全量，本期不实装但占位）
- `spdMul`/`critMul`/`moraleMul`：作用于 精/爆/士 的乘子（如「虚实阵」加爆发会心）——**待 balance-master 纳入乘法链后**再启用。
- `aoeRadiusDelta`：阵型改 AOE 半径（如「圆阵」缩计略波及自损）。
- `rangeAppliesTo:'all'`：罕见阵让近战也加 footprint（本期仅 `'ranged'`）。
- 多阵并存 / 分队阵（不同分队不同阵）：**明确不做**，本作一军一阵（§8 待确认 4）。

---

## 3. 加成如何接入伤害乘法链（引用 balance-master 的统一叠加序）

### 3.1 阵型是链中的两个乘子，**不是新链**
balance-master 定义**唯一规范叠加序**（示意，**以 balance-master 为准**，本稿不复制其最终式/clamp）：
```
有效攻击侧乘子链（相乘）：
  triangle(相克) × terrainAtk(地形适性) × weatherAtk(天气) × formationAtk(本稿) × bossRage(...) × ...
有效防御侧：
  defEff = (def + terrain.defBonus) × terrainDef × formationDef × ...
```
- **阵型只贡献 `formAtkMul` 与 `formDefMul` 两项**，插在上述链中**与地形/天气并列的位置**（攻侧乘进有效攻击、守侧乘进 `defEff`）。
- **顺序无关性**（乘法可交换）使「插在哪两项之间」不影响结果；但**clamp 与下限（如 `max(1, …)`）由 balance-master 统一收口**，本稿不自定 clamp，避免与其它稿重复定义。
- **谁套阵子**：由 `unit.faction` 决定取哪一方的阵型（§5）——我方单位取 `game.state.formationId`；敌/友军取各自阵型字段或 `none`。combat 是纯函数，阵型乘子作为**已解析好的标量**随单位传入（见 §3.2 解析点），combat 不直接 import `gameState`（保纯逻辑可单测，与 terrain-affinity「combat 只收解析结果」一致）。

### 3.2 `combat.js` 接入（最小改动，与地形/天气同位）
当前 `strike()` 内有占位 `const terrainAtkMod = 1;` 与 `defEff = defender.def + defTerrain.defBonus;`。改为（与 terrain-affinity 的改法叠加、相乘）：
```js
// attacker/defender 上已挂解析好的阵型乘子（由 controller 装配时写入，见 §3.4）
const formAtkMul = attacker.formAtkMul ?? 1;     // 攻方所属阵型的攻乘子
const formDefMul = defender.formDefMul ?? 1;     // 守方所属阵型的防乘子

const tri = triangleMul(attacker.classId, defender.classId);
const terrainAtkMod = atkAff.atk;                // terrain-affinity 替换占位
// —— 攻击侧：阵型乘子与相克/地形/天气相乘（规范序见 balance-master）——
// raw = (attacker.atk * tri * terrainAtkMod * weatherAtkMul * formAtkMul - defEff) * jitter
// —— 防御侧：阵型乘子乘在 defEff（地形 defBonus 之后，与 terrain-affinity defMul 相乘）——
const defEff = (defender.def + defTerrain.defBonus) * defAff.def * formDefMul;
```
- 移动 `movDelta`：**不在 combat**，在装配单位时改 `unit.mov`（§3.4）→ `pathfind.reachable/path` 自然吃到；clamp `mov ≥ 1`。
- 射程 `rangeDelta`：**在 `attackReach`**（class-system 第 3 点 / terrain-affinity §5.5），对**远程**单位 `attackShape.max += rangeDelta`（仅当 `rangeAppliesTo==='ranged'` 且该单位远程），与「高地 +1 / 雾 −1」**代数相加**后 clamp（`max ≥ min ≥ 1`）。
- **counterRange 同步**：弓系 `counterRange[0,0]` 不因阵型获得近战反击（rangeDelta 只动 `attackShape.max`，不动 counter 的 [0,0] 空区间）。

### 3.3 预测面板（damage-preview）一致性
- `forecast.predictAttack/predictSkill` 必须**走同一 `formationMods` + 同一 combat 纯核**，保证「预测=实际」（damage-preview §3/§5 自洽要求）。
- `mods` 标签新增阵型项：`{ label:'锋矢 攻×1.12', kind:'up' }` / `{ label:'鱼鳞 守×1.12', kind:'up' }` / `{ label:'鱼鳞 移−1', kind:'down' }` / `{ label:'雁行 射程+1', kind:'up' }`。颜色：利=绿、不利=红、中性=灰（与地形/天气标签并列）。
- 计略预测：阵型默认**不改计略威力**（计略走 精，本期阵型不动精）；若 §2.3 `spdMul`/精类启用后再纳入（留待 balance-master）。

### 3.4 解析点：谁把阵型乘子写进 unit（关键，保 combat 纯）
- **`battleController` 装配单位时**（`makeUnit` 或紧随其后，与难度乘数注入同一 hook，enemy-ai §345）：
  1. 取该 unit 阵型 id：我方 = `game.state.formationId`（缺省 `none`）；敌方 = `map.enemyFormation || 'none'`（§5）；友军/客将见 §7。
  2. `affinityClass = AFFINITY_CLASS[unit.classId]`（terrain-affinity §5.2 映射）。
  3. `const m = formationMods(formationId, affinityClass)`。
  4. 写入 `unit.formAtkMul=m.atkMul`、`unit.formDefMul=m.defMul`；`unit.mov = clamp(baseMov + m.movDelta, 1, ∞)`；远程单位 `attackShape.max += m.rangeDelta`（§3.2 clamp）。
- 这样 **combat / pathfind / attackReach 都是纯函数收解析后的标量**，可单测、可被 forecast 干跑复用，且 combat **不依赖 gameState**（与既有「difficulty 在 controller 注入、combat 不感知」一致）。

---

## 4. 选阵入口、切换代价与限制

### 4.1 入口：整军（主）+ 战前快切（次）
- **主入口 · 整军界面**（`ui/intermission.js` `run(ctx)`）：新增「布阵」分区/按钮 → 列六阵（图标 + 名 + 一句取舍 + 当前阵高亮），点选即写 `game.state.formationId`，随整军一起**自动存档**（章边界存档已含 settings；formationId 入 state，见 §4.2）。这是 master「关间整军」养成层的一部分（§3.11）。
- **次入口 · 战前部署（deploy）阶段**：进入战斗、玩家部署单位时，HUD 给一个「当前阵型：◻锋矢　[换阵]」小入口，允许**开打前**再改一次（不耗代价）。开打后默认锁定（§4.3）。
- **缺省**：新游戏 `formationId='none'`；从无该字段的旧档载入时迁移为 `none`（§4.2）。

### 4.2 持久化（`gameState`，含存档迁移）
- `core/gameState.js`：
  - `defaultState()` 增 `formationId: 'none'`。
  - `save()` 快照增 `formationId`（与 chapter/battleIndex 同级，或并入既有 `settings`——**建议并入 `settings.formationId`** 以复用现有 settings 持久化与迁移兜底，减少 schema 面；§8 待确认 5）。
  - `load()`/normalize：缺字段兜底 `DEFAULT_FORMATION`（旧档 v1 无此字段 → `none`，无破坏）。
- **NG+/章节**（campaign-structure §7）：阵型选择**随周目持续**（不因 NG+ 重置，属玩家偏好）；后续若做「分章解锁高级阵」，解锁状态记 `storyFlags`（content-pipeline 谓词/flag 权威）。

### 4.3 切换代价与限制（本期从简，留 P4 钩子）
- **关间切换**：免费、随时（整军里）。这是主要切阵时机——「看下一关地形/目标，回整军换阵」。
- **战前（deploy）切换**：免费、一次（开打前）。
- **战斗中切换**：**本期不开放**（默认锁定）。P4 可加「战中变阵」作为高级机制：消耗**全军一回合行动**或**气力/MP**（class-system 有 MP），并带 `cooldownTurns`（`restrictions.consumeOnSwitch`/`cooldownTurns` 已留字段）。**先不做**，避免与回合状态机/AI 增复杂度（§8 待确认 3）。
- **解锁限制**：见 §2.2（第一章三阵默认开，余阵后续解锁/或全开待确认）。
- **`requireClasses`**：留字段不强制（如真要「方圆需有步兵」，UI 灰置 + tooltip 说明，本期不做）。

### 4.4 UX（曹操传式，鼠标优先 + 键盘，国风）
- 布阵面板：六枚阵型卡（程序化国风图标 `icon` + 名 + 取舍标签：绿「守×1.12」红「攻×0.95 移−1」），当前阵高亮金框。
- 选阵即时在面板侧显示「对本队各兵种的净效果」预览（如「骑兵：攻×1.16 移0」——base×synergy 已合并，呼应 §2.1 抵消示例），帮玩家理解 synergy。
- HUD 角标常显当前阵型名（如「阵：锋矢」），与难度角标并列（campaign-structure §6.4）。
- 全程含「← HUB」与静音（master 工程约定，引擎层已有）。

---

## 5. AI 是否/如何受阵型影响

### 5.1 敌方阵型（数据驱动，地图可配）
- **战役地图 schema**（campaign-structure §22 `*.map.js`）增**可选**字段 `enemyFormation: 'fish_scale'`（缺省 `none`）——内容层给某些关的敌军「定一个阵」（如汜水关守军用**方圆**死守、追击关西凉骑兵用**锥行/锋矢**猛冲），是**叙事/关卡设计旋钮**，不改引擎。
- controller 装配**敌方**单位时，同 §3.4 用 `map.enemyFormation` 解析乘子 → 敌军也吃阵型加成。**AI 决策逻辑本身不必“理解”阵型**：阵型已体现在敌单位的 `atk/def/mov/range` 解析值里，现有 `ai.js`（追击/集火/计略阈值，enemy-ai）照常跑即可——**阵型对 AI 是「被动数值染色」，不是新决策维度**（最小复杂度）。

### 5.2 AI 是否「主动选阵 / 变阵」
- **本期不做** AI 主动选阵或战中变阵——敌军阵型是关卡预设的静态值。
- **难度联动以 balance-master / enemy-ai 为准**：是否在 `hard` 给敌军更优阵型、或 boss 阶段切阵（配合 enemy-ai 的 `_checkBossPhase`），**由 balance-master 难度表统一决定**，本稿只提供「敌军可带阵型」的机制与数据位（`map.enemyFormation` + 可选 `boss.phaseFormation` 留字段），**不自定难度数值**（避免与 enemy-ai §7 / campaign §6 / balance-master 三处重复）。
- **友军 NPC AI**（enemy-ai 友军简易 AI）：友军默认**吃玩家所选阵型**（视作同一军）或 `none`，见 §7。

### 5.3 AI 与阵型的交互上限（明确边界，防膨胀）
- AI **不**因「我方在锋矢（防弱）」就改变集火目标加权——目标加权仍按 enemy-ai 的残血/价值/距离权重（那些已读阵型染色后的实际数值）。即**阵型不引入新的 AI 谓词/权重**，保持 enemy-ai 的目标优先级体系单一权威。

---

## 6. 与兵种 / 地形的配合（synergy，不另起系统）

### 6.1 兵种契合（synergy，复用 affinityClass 族键）
- `FormationDef.synergy[affinityClass]` 给**特定兵种族**在该阵的**额外覆盖**（§2.1 表已示例）：
  - 鱼鳞×步兵：再 `defMul 1.04`（步兵结鳞阵更稳）；鱼鳞×骑兵：`movDelta +1` 抵消减速（骑兵不擅死守但不至太亏）。
  - 锋矢×骑兵：`atkMul 1.04`（突击）。
  - 雁行×弓：`atkMul 1.05`；雁行×炮：再 `rangeDelta +1`。
  - 方圆×步兵/君主：`defMul` 护主。
  - 锥行×骑/盗：`movDelta +1`（奔袭）。
- **合并规则**（§2.1 `formationMods`）：乘子相乘、Δ相加。这让「阵型 + 兵种」形成**组合战术**而非孤立旋钮，且**全部数据驱动、一处可调**（balance-master 平衡）。
- synergy 复用 terrain-affinity 的**同一套 `AFFINITY_CLASS` 映射**（§0.2），**不新建分类**——6 系→11 系迁移时阵型 synergy 自动跟随（terrain-affinity 已保证「只改映射、不改表」）。

### 6.2 与地形的配合（相乘叠加，不互改）
- 阵型乘子与 terrain-affinity 的 `atk/def/avoid/move` **相乘/相加叠加**，互不替代（§3.1）：
  - 例：弓兵站**丘陵**（地形 `atk1.1` + 高地射程 +1）+ **雁行**（射程 +1，弓 synergy `atk1.05`）→ 攻 ×(1.1×1.05)、射程 +2（高地+1、雁行+1，再 clamp）——**地利 × 阵法**叠加，但每项温和，合计仍可控（balance-master clamp 收口）。
  - 例：骑兵在**森林**（地形 `move3`、`atk0.9`）+ **锥行**（`movDelta+1`，骑 synergy 再 +1）→ 进林仍贵但略缓，攻 ×0.9——**地形劣势不被阵型完全消除**（保留地形战术意义）。
- **移动叠加序**：`unit.mov = baseMov + formationMovDelta`（装配期，§3.4）；进入每格的消耗仍由 terrain-affinity `enterCost`（地形/适性）决定——**阵型改“总移动力”，地形改“每格消耗”**，两者天然正交、不冲突。

### 6.3 与 ZOC / 占领的配合（terrain-affinity §2/§4）
- **方圆/鱼鳞 + 守关**：高防 + 守点（gate/桥单宽 + ZOC 卡位）= 「以少守关」的强组合（master 汜水关/虎牢关、terrain-affinity §2.3）。
- **锥行 + 抢点**：高移动 + 占领点（capture）/护送到达 = 抢滩/奔袭解（terrain-affinity §4、master §3.9）。
- 阵型**不改 ZOC 规则本身**（ZOC 是地形/兵种 `ignoreZoc` 的事），只通过 `mov` 影响「能不能赶到卡位格」。

---

## 7. 客将 / 友军与阵型（resolve 跨稿）

- **客将 guest**（recruitment-allies / master）：阵型乘子是「全军级偏好」。客将（`guest:true` 字段——recruitment-allies 权威，combat 现仅注释提及）**默认吃玩家所选阵型**（视作随军同阵，`FormationDef.restrictions.guestExempt:true`=吃）。若某剧情要「客将自成一阵」可后续给客将独立 `formationId`（**本期不做**，留 §2.2 钩子）。
- **友军 NPC**（enemy-ai 友军 AI）：同一阵营（如 `ally`）默认吃玩家阵型或 `none`（地图可配 `allyFormation`，留字段，本期缺省 `none`——友军是“友方但非我直辖”，给中性最稳，避免误强化/削弱友军打乱平衡）。
- **解析归属表**（§3.4 第 1 步的明确版）：
  | faction | 取哪个 formationId |
  |---|---|
  | `wei`（我方） | `game.state.formationId` |
  | `guest`（客将，随我军） | `game.state.formationId`（`guestExempt` 控制是否吃） |
  | `ally`（友军 NPC） | `map.allyFormation || 'none'`（缺省中性） |
  | `foe`（敌方） | `map.enemyFormation || 'none'` |
- > 注意（completeness-critic）：阵型解析**按 faction 取阵**，因此客将/友军不会错吃敌方阵型；这与 `victory.rout` 把非 `wei` 一律当 foe 的旧 bug **不同层**——本稿不引入该 bug（解析只读 faction 标签取阵，不做敌我归并）。`guest:true` 字段以 recruitment-allies 为准，本稿仅消费、不定义。

---

## 8. 范围与分期（phaseable）

- **第一章（M1，先留接口 + 1~2 基础阵）**：
  1. `data/formations.js` + `formationMods()`：实现 `none` + `fish_scale`（鱼鳞，守向）+ `arrow`（锋矢，攻向）**三阵**（master「先做实际用到的、轻量启用」）。
  2. `gameState` 加 `formationId`（建议 `settings.formationId`）+ 存档迁移兜底 `none`。
  3. `combat.strike` 接 `formAtkMul/formDefMul`（与 terrain-affinity 占位替换叠加、相乘）；`pathfind` 经装配期 `mov` 自然吃 `movDelta`；`attackReach` 接 `rangeDelta`（为雁行预留，本期雁行可不上）。
  4. controller §3.4 解析点（与难度乘数同 hook，按 faction 取阵）。
  5. `ui/intermission` 布阵入口（三阵）+ HUD 阵型角标；forecast/UI 阵型标签。
  6. 单测（§9）。
- **后续（P4 全量，留接口、不实装）**：
  - 余三阵 `wild_goose/square/awl` 全开 + synergy 全量 + 解锁叙事（`unlockFlag/minChapter`）。
  - **战中变阵**（`consumeOnSwitch`/`cooldownTurns`，耗回合/MP）。
  - 精/爆/士乘子（`spdMul/critMul/moraleMul`，待 balance-master 纳入链）、`aoeRadiusDelta`、`rangeAppliesTo:'all'`。
  - AI 主动选阵 / boss 阶段切阵（`boss.phaseFormation`，以 enemy-ai/balance-master 为准）。
  - 客将/友军独立阵、分队多阵（默认不做）。

---

## 9. 单元测试（纯逻辑层，放 `tests/`）

- `formationMods`：未知 formationId 回退 `DEFAULT_FORMATION`/`none`（全 1/0）；未知 affinityClass 只回 base（无 synergy）；synergy 乘子相乘、Δ相加（鱼鳞×骑兵净 mov 0：base −1 + syn +1）。
- `combat`：守方所属阵 `square` → `defEff` ×1.10（与地形 defBonus 之后相乘）；攻方 `arrow` → 有效攻击 ×1.12；阵型乘子与 `triangleMul`/地形/天气**相乘不互相覆盖**（同输入逐项验证）；`none` 阵全 1（与未接阵型前数值一致——回归保护）。
- `attackReach`：弓兵 + 雁行 `attackShape.max +1`；近战 + 雁行 `max` 不变（`rangeAppliesTo:'ranged'` 过滤）；与高地 +1 代数相加后 clamp。
- 装配（controller §3.4）：我方单位取 `state.formationId`、敌方取 `map.enemyFormation`、缺省 `none`；按 faction 取阵正确（客将吃我方阵、敌方不串阵）。
- `mov` clamp：`fish_scale` 使 mov 不低于 1；`awl` +1 生效于 `pathfind.reachable` 步数。
- 与 `forecast`：predict 的阵型修正与 `resolveAttack` 实跑同输入一致（damage-preview 自洽）。
- `gameState`：旧档（无 formationId）load → 迁移为 `none`；save→load 往返保 `formationId`。

---

## 10. 模块触点小结（build-ready）

| 模块 | 改动 |
|---|---|
| `data/formations.js`（新增） | `FORMATIONS` 表 + `formationMods()` + `DEFAULT_FORMATION`（§2）。集中调参（balance-master 平衡）。 |
| `core/gameState.js` | `defaultState` 加 `formationId`（建议入 `settings`）；save/load/normalize 迁移兜底 `none`（§4.2）。 |
| `battle/combat.js` | `strike()` 收 `attacker.formAtkMul`/`defender.formDefMul`，攻侧乘进有效攻击、守侧乘进 `defEff`（与地形/天气/相克相乘，序见 balance-master）（§3.2）。 |
| `battle/battleController.js` | 装配期（同难度乘数 hook）按 `unit.faction` 取阵 → `formationMods` 解析 → 写 `formAtkMul/formDefMul`、改 `mov`、远程改 `attackShape.max`（§3.4）。 |
| `battle/pathfind.js` | 无需改（吃装配期已改的 `unit.mov`）；clamp `mov≥1` 在装配期。 |
| `battle/attackReach`（class-system/terrain 既定接口） | 远程 `attackShape.max += rangeDelta`，与高地/雾代数相加后 clamp（§3.2）。 |
| `battle/forecast.js`（damage-preview） | 走同一 `formationMods`+combat 纯核；`mods` 加阵型标签（§3.3）。 |
| `ui/intermission.js` | 布阵分区（六阵卡，第一章三阵）；写 `game.state.formationId`（§4.1/4.4）。 |
| `ui/hud.js` | 阵型角标常显；战前 deploy「换阵」小入口（§4.1）。 |
| `*.map.js`（内容层，campaign §22） | 可选 `enemyFormation`/`allyFormation`（缺省 `none`）（§5/§7）——内容旋钮，不改引擎。 |
| `render3d`（可选） | 阵型程序化图标 `icon`；（后续）队形落位视觉暗示，本期仅 UI 图标。 |
| `tests/` | §9 列表。 |

---

## 11. 待确认（请 James 拍板）

1. **第一章阵型数量**：建议先做 `none`+`fish_scale`(鱼鳞守)+`arrow`(锋矢攻) 三阵；其余三阵（雁行/方圆/锥行）是**第一章直接全开**，还是 `unlockFlag` 随后续章节「学阵」叙事解锁？（本稿默认：第一章三阵全开、余三阵留接口可后开。）
2. **加成量级**：攻/防 ±8%~12%、移动±1、射程+1 是否合适？（与 terrain-affinity「±10% 适性」一致的温和观；balance-master 为最终平衡权威——本稿数值为起步基线，是否就此定基线交 balance-master 调？）
3. **战中变阵**：本期**不做**（仅整军/战前可切）对吗？P4 若做，代价取「全军一回合行动」还是「消耗 MP/气力 + cooldown」？
4. **一军一阵 vs 分队多阵**：本作明确**一军一阵**（全军同阵），分队不同阵**不做**——确认？
5. **存档位置**：`formationId` 放 `state` 顶层还是并入 `settings`？（建议并入 `settings.formationId` 复用现有持久化与迁移兜底，schema 面更小。）
6. **synergy 强度**：兵种契合的额外覆盖（如鱼鳞×骑兵抵消减速、雁行×弓 +5% 攻）是否保留？还是第一章先只做 base mods、synergy 留 P4？（本稿：第一章三阵可带少量 synergy 以体现「阵×兵」乐趣，余留 P4。）
7. **敌军/友军阵型**：敌军 `map.enemyFormation` 内容旋钮第一章是否使用（如汜水关守军方圆、追击关西凉锋矢）？友军默认 `none` 是否可接受？
8. **AI 与阵型**：确认本期 AI 对阵型为「被动数值染色、不改决策」，且**难度是否给敌军更优阵/ boss 变阵由 balance-master 统一决定**，本稿不自定难度数值——对吗？
9. **五维其余维度**：精/爆/士 的阵型乘子（如「虚实阵」加会心）本期**不做**、留字段待 balance-master 纳入乘法链——对吗？
