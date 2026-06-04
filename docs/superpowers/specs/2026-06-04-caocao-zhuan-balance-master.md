# 《群雄逐鹿·孟德篇》balance-master — 设计稿（待审）

> 原创致敬作。沿用原版《三国志曹操传》式 SRPG 的**伤害/命中/相克/地形/天气博弈的机制结构**（事实性设定）+ 公有领域三国题材；
> **所有公式系数、难度表、目标区间、TTK 标的均为本作自定**，不照搬任何商业游戏的数值表/文本。
>
> 本稿是**全部数值的对齐基准（single source of truth）**：伤害/命中总公式、统一伤害乘法链与钳制、合并后的唯一难度表、
> Lv1/15/30/50 的攻防 HP/MP 目标区间与 TTK 标的、调参方法论、平衡模拟脚本规范。
> 其它稿（campaign-structure / enemy-ai / economy-shop / terrain-affinity / weather-system / progression-leveling / damage-preview / class-system）
> **引用本稿**，不再各自定义重叠数值。
>
> - **日期**：2026-06-04 ｜ **作者**：James（顾嘉晟）+ Claude ｜ **状态**：**待 James 审阅**
> - **项目**：game-hub / `games/caocao-zhuan/` ｜ **代号**：`caocao-zhuan`
> - **配套语料**：master §3.3 战斗结算；class-system §0 五维含义 + 伤害公式参考；progression-leveling（成长产物）；
>   damage-preview（forecast 与本公式同核）；terrain-affinity（地形 atk/def/avoid 适性）；weather-system（计略可用性/威力、雾对远程）；
>   enemy-ai（boss 狂暴 + 难度 AI）；economy-shop（经济难度系数）；campaign-structure（敌方等级/数值难度 + NG+）。

---

## 0. 现状盘点（对接基线，本稿在其上对齐，不推翻可跑代码）

读 `battle/combat.js` / `battle/skillEngine.js` / `battle/statuses.js` / `data/classes.js` / `data/generals.js` / `data/terrain.js` 后确认现状：

| 维度 | 现状（代码） | 5 维目标模型（本稿对齐目标） |
|---|---|---|
| 单位属性 | `atk/def/int/spd` + `maxHp`，**无 crit/morale/maxMp/curMp** | 五维 **攻 atk / 精 int / 防 def / 爆 crit / 士 morale** + `maxHp/curHp` + `maxMp/curMp` |
| 物理伤害（combat.js） | `dmg=max(1,round((atk·tri·terrainAtkMod − defEff)·jitter))`，`terrainAtkMod=1`（占位） | 见 §1.1 目标式：乘法链 + 钳制（§2） |
| 物理命中（combat.js） | `clamp(85 + (atk.spd − def.spd) − avoidBonus, 30, 100)` | 见 §1.2：`spd 差` → `爆/士 差`，地形/天气/高地修正 |
| 计略伤害（skillEngine.js） | `max(1,round(power·(1+int/40)·elementMul·jitter − defEff))`，`defEff=(def·mods.def·0.6)+defBonus+int·0.5` | 见 §1.3：保留现核，明确把 weather/terrain `powerMod` 接入同乘法链 |
| 计略命中（skillEngine.js） | `clamp(85 + (caster.int − target.int), 30, 100)` | 见 §1.4：`int 差 + 士 差`（精/士 看命中，class-system §0） |
| 相克 triangleMul | `spear>cav 1.5; cav>archer 1.4/inf 1.3/<spear 0.7; archer>inf 1.3/<cav 0.8; vs strategist 1.2` | 保留为相克层（§2.1 链第 2 环），11 系迁移见 §2.7 |
| 抖动 jitter | `0.9 + rng()·0.2` → `[0.9,1.1)` | 统一为 §1.6 全局 `JITTER=[0.90,1.10)`（物理/计略同） |
| 地形 | `defBonus`(加法)/`avoidBonus`(加法)；`terrainAtkMod` 占位 1 | terrain-affinity 的 `atkMod/defMod/avoidMod` 接入（§2.1 链第 3 环） |
| **三套难度表分散** | campaign-structure `data/difficulty.js`、enemy-ai `data/aiTuning.js`、economy-shop `data/economy.js DIFFICULTY_MUL` | **合并为唯一 `data/difficulty.js`（§3）**，三稿改为引用 |

**核心承诺**：本稿只定**数值与公式骨架**；调参全部落在 `data/` 常量（`difficulty.js` / `affinity.js` / `economy.js` / `progression.js` / `skills.js`），调数不改引擎逻辑（master §1 / §9）。

---

## 1. 伤害与命中总公式（与 combat.js 现状对齐 + 给目标式）

### 1.1 物理伤害总公式（目标式）

```
phys_dmg = max( DMG_FLOOR , round( ( ATK_eff − DEF_eff ) × JITTER ) )

ATK_eff = atk_base
            × Π(MUL_CHAIN)          // 见 §2：相克×地形适性×天气×阵型×狂暴×装备
DEF_eff = ( def_base + terrain.defBonus ) × terrain.defMod   // 守方所站格；适性 defMod 乘在加法之后
        // （阵型/装备对防御的乘子并入 DEF 侧链，见 §2.4 / §2.6 —— 与攻击链分列，钳制各自做）
JITTER  ∈ [0.90, 1.10)             // 单次掷骰，确定性 rng（§1.6）
DMG_FLOOR = 1                      // 命中必造成 ≥1（破甲下限，原作风味）
```

- **与现状映射**：现 combat.js `raw=(atk·tri·terrainAtkMod − defEff)·jitter`。本稿把 `tri·terrainAtkMod` 展开为完整乘法链 `Π(MUL_CHAIN)`（§2），把现 `defEff=def+defBonus` 升级为含 `defMod` 的 DEF 侧；`max(1,...)` 与 `round` 与 `jitter` 形态不变。**combat.js 改动是「替换占位 terrainAtkMod=1 为真实链」+「DEF 侧加 defMod」**，不重写结构。
- **「攻减防」量级取向（与 class-system §0 参考式呼应）**：class-system 给的参考是 `((攻−防)/2 + 等级 + 25)×系数`。本作**采用 combat.js 现行「直接攻减防、不除 2、不加等级常量」**的更直白模型（已实装、可单测），因为：① 我方 atk 量级（Lv1 ~22–26）与 def（~15–18）之差本就落在「一次打掉对方 1/4~1/3 HP」的健康区间（§4 验证）；② 不引入 `+等级+25` 常量可避免高级数值膨胀失控。**class-system §0 的参考式仅作设计意图说明，本稿公式为权威实现式。** → 列入待确认 1。

### 1.2 物理命中总公式（目标式）

```
phys_hit% = clamp( HIT_BASE
                   + (atk.morale − def.morale)      // 士气差（命中/反击/必杀发挥；class-system §0「士」）
                   + (atk.crit   − def.crit) × CRIT_HIT_W   // 爆发差小幅助命中（次要项）
                   − avoid_eff                        // 守方地形回避 + 适性 avoidMod + 天气
                   + highGroundHit                    // 远程居高临下 +HIGH_GROUND_HIT（terrain-affinity §3.1）
                 , HIT_LO , HIT_HI )

avoid_eff   = terrain.avoidBonus + affinity.avoidMod + weather.avoidMod(雾对远程等)
HIT_BASE=85   HIT_LO=30   HIT_HI=100   CRIT_HIT_W=0.5   HIGH_GROUND_HIT=5
```

- **与现状映射**：现 combat.js 用 `(atk.spd − def.spd)`。**5 维迁移**：`spd` 拆为 **爆 crit（连击/会心）** 与 **士 morale（命中/反击/必杀）**。命中**主看士气差**（morale），爆发差作小权重次要项（`CRIT_HIT_W=0.5`）。
- **阶段 1 兼容**：5 维未落地前，`spd` 暂承载「爆」语义，命中式退化为现行 `85 + (spd差) − avoid`（progression-leveling §9 阶段 1）。本稿命中式以**爆/士分离后**为目标，阶段 1 用 `morale := spd, crit := 0` 子集即等价现状。

### 1.3 计略伤害总公式（保留 skillEngine 现核，明确接链）

```
skill_dmg = max( 1, round( power × INT_SCALE_F(caster.int) × Π(SKILL_MUL_CHAIN) × JITTER − SKILL_DEF_eff ) )

INT_SCALE_F(int) = 1 + int / INT_SCALE          // INT_SCALE=40（现值，保留）
SKILL_MUL_CHAIN  = elementTerrainMul            // 火克林1.4/丘1.2、水域1.4（现 ELEMENT_TERRAIN）
                 × weather.powerMod[当前天气]    // 火晴1.2/雨0.5…（weather §3，本稿接入）
                 × terrain.powerByTargetTerrain  // 目标地形调威力（terrain-affinity §3.2）
                 × formation.scMul × boss.scMul × equip.scMul   // 阵型/狂暴/装备对计略威力
SKILL_DEF_eff = (target.def × statMods.def × DEF_SCALE) + terrain.defBonus + (target.int × INT_DEF)
                // DEF_SCALE=0.6（计略比物理更难被纯防挡）, INT_DEF=0.5（谋抗谋）—— 现值保留
```

- **与现状映射**：skillEngine.js 现有 `power·(1+int/40)·elementMul·jitter − defEff` **结构不变**；本稿要求把现仅 `elementMul` 的乘子位**扩为 `Π(SKILL_MUL_CHAIN)`**（接 weather `powerMod`、terrain `powerByTargetTerrain`、formation/boss/equip 的计略乘子）。enrage 的 `scMul`（enemy-ai §2.3）即走 `boss.scMul`，**不另开计略公式**。
- **治疗**：`heal = max(1, round(power·INT_SCALE_F(int)·JITTER))`，**不被 def 抵**，不走伤害链（现状保留）。可受 formation/equip 的 `healMul`（并入 SKILL_MUL_CHAIN 的治疗变体，缺省 1）。

### 1.4 计略命中总公式

```
skill_hit% = clamp( HIT_BASE + (caster.int − target.int) + (caster.morale − target.morale) × MOR_HIT_W
                  , HIT_LO , HIT_HI )    // 'always' 类计略跳过此判定（必中）
MOR_HIT_W = 0.5
```

- **与现状映射**：skillEngine.js 现 `clamp(85 + (caster.int − target.int), 30, 100)`。**5 维**：计略命中**主看精差（int）**（class-system §0「计略看 精/士 差」），加士气差小权重。阶段 1 `morale` 缺省 → 退化为现状。
- `kind:'heal'/'buff'`（对友方）命中恒 `always`；`kind:'control'/'debuff'/'damage'` 对敌走 `intDiff`（现状一致）。

### 1.5 反击 / 连击 / 致命（衍生项，与公式同核）

| 项 | 触发 | 公式 | 说明 |
|---|---|---|---|
| **反击** | 守方存活 + 攻方在守方 counterRange 曼哈顿区间内（弓 `[0,0]`=无反击） | 攻守互换跑 §1.1/§1.2（同核） | combat.js 现状；狂暴/buff 经 statMods 自然带入 |
| **连击（爆）** | `combo% = clamp(COMBO_BASE + crit_diff × COMBO_W, 0, COMBO_CAP)` | 命中后掷骰；触发=再结算一次 §1.1（同 jitter 重掷） | `COMBO_BASE=0, COMBO_W=2, COMBO_CAP=50`（爆差每 +1 → +2% 连击，封顶 50%） |
| **致命/会心** | `crit% = clamp(CRIT_BASE + morale_diff × CRIT_W, 0, CRIT_CAP)` | 命中后掷骰；触发=该次伤害 ×`CRIT_MUL` | `CRIT_BASE=3, CRIT_W=1, CRIT_CAP=30, CRIT_MUL=1.5`（士差每 +1 → +1% 致命，封顶 30%） |

- 连击/致命是 **5 维「爆/士」的输出落点**（class-system §0）；阶段 1（无 crit/morale）默认**关闭**（`COMBO_BASE=CRIT_BASE=0` 且差值项为 0），行为=现状无连击无致命。
- damage-preview 的 `comboPct/critPct` 直接读这两式（同核，预测=实际）。
- **rng 调用顺序（确定性，全链统一）**：① 命中判定 → ② 命中后取 jitter → ③ 致命判定 → ④ 连击判定（触发则再 ②③ 一次）→ ⑤ 反击（守方存活时，再走 ①②③④）。与 combat.js / skillEngine.js「先命中后 jitter」同序，**便于回放/单测**。

### 1.6 全局抖动与钳制常量（集中 `data/balance.js` 或 `battle/combat.js` 顶部）

```js
// 唯一伤害/命中常量源（其它模块 import，勿各自硬编码）
export const BAL = {
  JITTER_LO: 0.90, JITTER_SPAN: 0.20,   // [0.90,1.10)  物理/计略同
  DMG_FLOOR: 1,                          // 命中必 ≥1
  HIT_BASE: 85, HIT_LO: 30, HIT_HI: 100, // 命中钳制
  CRIT_HIT_W: 0.5, MOR_HIT_W: 0.5, HIGH_GROUND_HIT: 5,
  COMBO_BASE: 0, COMBO_W: 2, COMBO_CAP: 50,
  CRIT_BASE: 3, CRIT_W: 1, CRIT_CAP: 30, CRIT_MUL: 1.5,
  INT_SCALE: 40, DEF_SCALE: 0.6, INT_DEF: 0.5,   // 计略（skillEngine 现值）
  CHAIN_CLAMP: { atkMulMin: 0.25, atkMulMax: 4.0 }, // §2.5 总乘子钳制
};
```

---

## 2. 统一伤害乘法链与顺序 + 上限钳制（唯一权威）

**`Π(MUL_CHAIN)` 是物理 `ATK_eff` 的攻击侧总乘子**，按下列**固定顺序**相乘（顺序只影响舍入/可读性，乘法本身可交换，但**钳制必须在全链相乘后统一做一次**，故定序以便单测对齐）：

### 2.1 攻击侧链（ATK 乘子，顺序固定）

```
ATK_eff = atk_base
        × m1_triangle        // 兵种相克   triangleMul(atkClass, defClass)         [§2.1 环1]
        × m2_terrainAtk      // 地形适性   affinityOf(atkClass, atkTile).atk        [§2.1 环2]
        × m3_weatherAtk      // 天气对物攻 weather.atkMul（默认 1；雾不改物攻，仅改远程命中/射程）[环3]
        × m4_formationAtk    // 阵型加成   formation.atkMul（鱼鳞/锋矢…默认 1）      [环4]
        × m5_bossRage        // boss 狂暴  enrage.atkMul（enemy-ai §2.3；非 boss=1） [环5]
        × m6_equipAtk        // 装备       Σ装备 atk 乘子（武器/宝物；默认 1）        [环6]
```

- **环序记忆口诀**：相克 → 地形 → 天气 → 阵型 → 狂暴 → 装备（**克地天阵暴装**）。
- 每环**缺省 1.0**（无该系统时不影响），保证分阶段落地：第一章先有 1(相克)+2(地形)，3–6 随各系统上线接入，全程链结构不变。

### 2.2 防御侧链（DEF 乘子，顺序固定，与攻击链分列）

```
DEF_eff = ( def_base + terrain.defBonus )           // 现状加法基线（terrain.js defBonus）
        × d1_terrainDef     // 地形适性   affinityOf(defClass, defTile).def         [环1]
        × d2_formationDef    // 阵型       formation.defMul（默认 1）                 [环2]
        × d3_statusDef       // 增减益     statMods(def).def（def_up/def_down，现状） [环3]
        × d4_equipDef        // 装备       Σ装备 def 乘子（防具；默认 1）             [环4]
```

- DEF 侧链与 ATK 侧链**互不相乘进对方**：先各自算出 `ATK_eff` 与 `DEF_eff`，再做 §1.1 的 `ATK_eff − DEF_eff`。这避免「攻方乘子被守方乘子重复缩放」的歧义。
- **statMods 现状**：statuses.js 的 `def_up/def_down` 走 `d3`，`atk_up/atk_down` 走攻击侧（作为 m4 之外的状态乘子，建议并入 `m4_formationAtk` 同一「状态/阵型」乘子位，或单列 `m4b_statusAtk`——见 §2.6 实现注）。

### 2.3 命中侧（加法，不进乘法链）

命中是**加法**修正（§1.2），不属乘法链：`avoid_eff` = `terrain.avoidBonus + affinity.avoidMod + weather.avoidMod`，与士气差/爆发差/高地命中**代数相加**后 clamp。**不要把命中修正塞进伤害乘法链。**

### 2.4 计略侧链（§1.3 的 `SKILL_MUL_CHAIN`，顺序固定）

```
SKILL_MUL_CHAIN = s1_elementTerrain   // 火×林1.4/丘1.2、水×水域1.4（ELEMENT_TERRAIN 现状）
                × s2_weatherPower      // weather.powerMod[当前天气]（火晴1.2/雨0.5…）
                × s3_terrainTargetPow  // terrain.powerByTargetTerrain（林1.2…）
                × s4_formationSc        // 阵型计略乘子（默认 1）
                × s5_bossRageSc         // enrage.scMul（默认 1）
                × s6_equipSc            // 计略书/宝物计略乘子（默认 1）
```

- 计略**不吃兵种相克**（相克是物理概念），故计略链无 triangle 环。计略防御侧固定为 §1.3 `SKILL_DEF_eff`（不再叠 DEF 侧链，避免双重抗性）。

### 2.5 上限钳制（clamp，全链相乘后统一一次）

```
total_atk_mul = clamp( Π(MUL_CHAIN), CHAIN_CLAMP.atkMulMin, CHAIN_CLAMP.atkMulMax )   // [0.25, 4.0]
ATK_eff = atk_base × total_atk_mul
// 计略同理：total_sc_mul = clamp(Π(SKILL_MUL_CHAIN), 0.25, 4.0)
```

- **为何钳制**：相克 1.5 × 地形 1.1 × 阵型 1.15 × 狂暴 1.3 × 装备 1.2 ≈ **3.0**，若再叠极端可破 4×；钳上限 4.0 防「叠满秒杀」，钳下限 0.25 防「层层削成 0 伤」（DMG_FLOOR=1 是减法后的最终地板，total_atk_mul 下限是乘法前的护栏，二者各管一层）。
- **钳制时机**：① 乘法链 clamp（本节）；② 减法后 `max(DMG_FLOOR, ...)`（§1.1）；③ 命中 `clamp(.,30,100)`（§1.2）；④ 连击/致命概率各自 cap（§1.5）。**四处钳制互不干扰、各管一段。**
- damage-preview 的 forecast **必须复用同一钳制顺序**，否则预测≠实际（damage-preview §5 自洽要求）。

### 2.6 实现注（combat.js 单点改造，最小侵入）

把现 `strike()` 的 `const tri=...; const terrainAtkMod=1; const defEff=def+defBonus;` 三行，替换为一个**纯函数 `coreDamage(ctx)`**（damage-preview §5.1 已要求拆「无随机核」）：

```js
// battle/combat.js（新增纯核，resolveAttack 与 forecast 共用）
function atkChain(atk, def, atkTile, defTile, weather, formation, rage, equip) {
  const m = [ triangleMul(atk.classId, def.classId),
              affinityOf(atk.classId, atkTile).atk,
              weather.atkMul ?? 1, formation?.atkMul ?? 1,
              rage?.atkMul ?? 1, equip?.atkMul ?? 1,
              statMods(atk).atk ];                // 状态 atk_up/down 并此（m4b）
  return clamp(m.reduce((a,b)=>a*b,1), BAL.CHAIN_CLAMP.atkMulMin, BAL.CHAIN_CLAMP.atkMulMax);
}
function defValue(def, defTile, formation, equip) {
  const base = (def.def + TERRAIN[defTile].defBonus);
  const dmul = (affinityOf(def.classId, defTile).def) * (formation?.defMul ?? 1)
             * statMods(def).def * (equip?.defMul ?? 1);
  return base * dmul;
}
export function coreDamage(atk, def, atkTile, defTile, env, jitter) {
  const eff = atk.atk * atkChain(...) - defValue(...);
  return Math.max(BAL.DMG_FLOOR, Math.round(eff * jitter));   // forecast 用 min/max jitter 求区间
}
```

- `resolveAttack` 掷 `jitter=JITTER_LO+rng()*JITTER_SPAN` 调 `coreDamage`；`forecast.predictAttack` 用 `jitter=JITTER_LO`（min）与 `JITTER_LO+JITTER_SPAN`（max）各调一次得区间 —— **同核，预测=实际**。
- 第一章可只接 `triangle + affinity`（其余环传 `{}` 缺省 1），随系统上线逐环填，不改 `coreDamage` 签名（env 是可选字段袋）。

### 2.7 11 系迁移对相克的影响

triangleMul 现以 6 系 id 为键（infantry/spear/cavalry/archer/strategist/leader）。class-system 落 11 系后，相克按**相克族**查表（与 terrain-affinity 的 affinityClass 同思路：classId → 相克族），表本身不随职业 id 改名而改：建议族 `{ melee(步/武术/盗/君主) , spear(枪—若 11 系保留) , horse(骑/弓骑) , bow(弓) , caster(策/道/风水) , siege(炮) }`，矩阵在 `classTriangle.js` 维护。**6 系先跑、迁移时只补映射**（与 terrain-affinity §0 同策略）。→ 列入待确认 5。

---

## 3. 合并三套 DIFFICULTY 为单一权威表（`data/difficulty.js`）

三稿各有一份难度表，字段重叠且数值不一致（campaign `enemyAtkMul:hard 1.15` vs enemy-ai `foeAtkMul:hard 1.1`；economy `DIFFICULTY_MUL:hard 0.8`）。**本稿合并为唯一 `data/difficulty.js`**，三稿改为引用其字段。

### 3.1 唯一难度表（权威）

```js
// data/difficulty.js —— 唯一难度系数源（campaign/enemy-ai/economy 全部 import 此表）
// 纯数据，不 import three / 不碰 DOM。
export const DIFFICULTY = {
  easy: {
    label: '简单 · 体验剧情',
    // —— 敌方强度（campaign §6 + enemy-ai §7 合并）——
    enemyLvDelta: -1, enemyAtkMul: 0.85, enemyDefMul: 0.85, enemyHpMul: 0.85,
    // —— 敌方 AI（enemy-ai §7）——
    aiAggression: 0.7, allowAiSmart: false, useForecast: false,
    reinforceActThisTurn: false, leashTighten: 1.0, fleeBelowHpBonus: +0.05,
    bossPhaseAggro: 0.8, focusFire: false,
    // —— 玩家成长 / 经济（campaign §6.3 + economy §2.2）——
    playerExpMul: 1.25, moneyMul: 1.20,
  },
  normal: {
    label: '普通 · 标准战阵',
    enemyLvDelta: 0, enemyAtkMul: 1.0, enemyDefMul: 1.0, enemyHpMul: 1.0,
    aiAggression: 1.0, allowAiSmart: true, useForecast: true,
    reinforceActThisTurn: false, leashTighten: 1.0, fleeBelowHpBonus: 0,
    bossPhaseAggro: 1.0, focusFire: false,
    playerExpMul: 1.0, moneyMul: 1.0,
  },
  hard: {
    label: '困难 · 沙场宿将',
    enemyLvDelta: +2, enemyAtkMul: 1.12, enemyDefMul: 1.10, enemyHpMul: 1.18,
    aiAggression: 1.3, allowAiSmart: true, useForecast: true,
    reinforceActThisTurn: true, leashTighten: 1.5, fleeBelowHpBonus: -0.05,
    bossPhaseAggro: 1.25, focusFire: true,
    playerExpMul: 0.9, moneyMul: 0.8,
  },
};
export const DEFAULT_DIFFICULTY = 'normal';
```

**合并裁决（消解三稿冲突）**：
- `enemyAtkMul` hard：campaign 1.15 / enemy-ai 1.1 → **取 1.12**（折中，偏 enemy-ai 的温和，避免 hard 一击占比过高，见 §4.4）。
- `enemyHpMul` hard：campaign 1.2 / enemy-ai 1.15 → **取 1.18**（拉长 hard 的 TTK 比加攻更安全，敌更肉但不更痛）。
- `enemyDefMul` hard：取 campaign 1.10（enemy-ai 无此字段）。
- `moneyMul`（=economy `difficultyMul`）：easy 1.2 / normal 1.0 / hard 0.8 —— **字段统一更名 `moneyMul`**，economy 的 `ECON.DIFFICULTY_MUL` 删除、改读 `DIFFICULTY[diff].moneyMul`。
- AI 字段（aiAggression/allowAiSmart/useForecast/reinforceActThisTurn/leashTighten/fleeBelowHpBonus/bossPhaseAggro/focusFire）全部来自 enemy-ai §7，原样并入。
- 成长字段（playerExpMul）来自 campaign §6.3。

### 3.2 三稿引用改法（去重）

| 稿 | 原文件/表 | 改为 |
|---|---|---|
| campaign-structure §6.1 | 自定义 `data/difficulty.js DIFFICULTY` | **删自定义表，import 本稿权威 `DIFFICULTY`**；BUILD 注入读 `enemyLvDelta/enemyAtkMul/enemyDefMul/enemyHpMul/playerExpMul` |
| enemy-ai §7.1 | `data/aiTuning.js DIFFICULTY` | **删 `aiTuning.js` 的 DIFFICULTY，import 本稿**；`applyDifficulty(unit,diff)` 读 `enemyHpMul→foeHpMul`、`enemyAtkMul→foeAtkMul`、其余 AI 字段同名 |
| economy-shop §4.1 | `ECON.DIFFICULTY_MUL` | **删，改 `DIFFICULTY[diff].moneyMul`**；`reward = base × moneyMul × objectiveMul + lootCash` |

> 字段命名统一以本表为准（敌方强度用 `enemy*Mul`，enemy-ai 内部把 `enemyHpMul/enemyAtkMul` 别名为 `foeHpMul/foeAtkMul` 仅作局部可读，不另存表）。

### 3.3 难度修正作用点（唯一注入序，避免重复缩放）

难度修正**只在两处注入**，各管各：

```
[A] BUILD 期（battleController.makeUnit，faction==='foe' 时）：
    foe.level += enemyLvDelta（钳 ≥1）→ 经 statsAtLevel 自然抬五维
    foe.maxHp *= enemyHpMul; foe.curHp = foe.maxHp（同比）
    foe.atk   *= enemyAtkMul; foe.def *= enemyDefMul
    （NG+ 叠加：先套 DIFFICULTY，再乘 ngPlusMod，见 §3.4）
[B] 运行期（AI / 经济 / 经验）：
    ai.js 读 aiAggression/allowAiSmart/...（不改属性，只改行为）
    leveling.js 玩家经验 ×playerExpMul
    economy settleRewards ×moneyMul
```

- **关键**：敌方 `atk/def/maxHp` 的难度缩放在 **BUILD 期一次性写入单位**，**不在 combat.js 每次结算时再乘**（否则与乘法链 §2 重复缩放）。combat.js 看到的 `atk/def` 已是难度调整后的最终值。
- 玩家方**永不**被难度缩放（只敌方 + 经济 + 玩家经验/智能）。

### 3.4 NG+ 叠加（campaign §7.3，接本表）

```js
// campaign-structure §7.3，作用于 BUILD 期、在 DIFFICULTY 之后再乘/加
ngPlusMod(ng) = { enemyLvDelta: +Math.min(ng*3, 15),
                  enemyHpMul:   1 + Math.min(ng*0.10, 0.6),
                  enemyAtkMul:  1 + Math.min(ng*0.08, 0.5) };
// 合成：finalLvDelta = DIFFICULTY.enemyLvDelta + ngPlusMod.enemyLvDelta
//       finalHpMul   = DIFFICULTY.enemyHpMul   × ngPlusMod.enemyHpMul   （封顶后再 clamp ≤ HP_MUL_CAP=2.5）
//       finalAtkMul  = DIFFICULTY.enemyAtkMul  × ngPlusMod.enemyAtkMul  （clamp ≤ ATK_MUL_CAP=2.0）
```

- 等级用**加**（lvDelta 相加），乘子用**乘**（Mul 相乘），各封顶后再 clamp 总上限（HP ≤2.5×、ATK ≤2.0×），防 NG+ 无限膨胀（§2.5 同护栏精神）。

---

## 4. Lv1/15/30/50 目标区间 + 一击占比 + TTK 标的

> 以 normal 难度、第一章登场名册的现有 base（caocao atk22/def15/hp62/int25；xiahoudun atk26/def16/hp78；通用兵更低）+ progression SABC 成长为锚。**这是数值校准的「靶心」，平衡模拟脚本（§6）核对实际是否落区间。**

### 4.1 玩家方目标属性区间（主力武将，含转职跃升）

| 等级 | 攻 atk | 防 def | HP maxHp | MP maxMp（计略系/物理系） | 备注 |
|---|---|---|---|---|---|
| **Lv1** | 18–28 | 13–18 | 60–80 | 6–12 / 0–2 | 起始 base（现状） |
| **Lv15（中级转职后）** | 40–58 | 26–36 | 150–200 | 14–22 / 0–5 | +14 级成长 A/S 档 + toMid 跃升 |
| **Lv30（高级转职后）** | 70–95 | 44–60 | 260–340 | 24–36 / 0–8 | +29 级成长 + toMid+toHigh 跃升 |
| **Lv50（满级）** | 110–150 | 66–90 | 380–500 | 36–54 / 0–12 | 满级（progression MAX_LEVEL=50） |

- 推导：Lv15 攻 ≈ base 22 + (攻 A=3)×14 + toMid allStats+2 = 22+42+2 = **66**？ → 偏高。**校准取向**：主力攻不应人均 A 档满成长，多数维 B 档（+2/级）。以 caocao A 档全维为上限锚（攻 22+3×14+2≈66 落区间上沿外）→ 故**君主全 A 是「天花板个例」**，区间上沿按主力典型（攻多为 A、其余 B）定，君主略超属设计内（主角强）。区间是「典型主力」靶，非「最强个例」。

### 4.2 敌方目标属性区间（同级对位，normal）

| 等级 | 杂兵 攻/防/HP | 精英/将 攻/防/HP | boss 攻/防/HP |
|---|---|---|---|
| Lv1–5（ch01） | 14–20 / 10–14 / 45–70 | 20–28 / 14–18 / 75–110 | 26–34 / 18–24 / 140–200 |
| Lv15 | 32–44 / 22–30 / 120–170 | 44–58 / 30–40 / 180–250 | 55–72 / 40–55 / 320–460 |
| Lv30 | 58–78 / 38–52 / 220–300 | 78–98 / 52–68 / 320–440 | 100–130 / 70–95 / 600–820 |

- 敌方区间 ≈ 玩家同级 **0.85–1.0×**（杂兵更低、将持平、boss HP 1.6–2.0× 玩家主力，靠 §1.5 衍生与计略才能高效啃）。
- boss HP 显著高（关底战拉长），但 atk 不超玩家主力太多（防一击秒玩家肉盾，§4.4）。

### 4.3 一击占比（single-hit % of target HP）目标

| 对位 | 命中后单击占目标 HP | 设计意图 |
|---|---|---|
| 玩家主力 → 同级杂兵（顺克 1.3–1.5×） | **45–75%**（2 击内杀，克制时近乎 1 击） | 克制爽快、鼓励兵种博弈 |
| 玩家主力 → 同级杂兵（无克 1.0×） | **25–40%**（约 3 击杀） | 标准节奏 |
| 玩家主力 → 同级杂兵（逆克 0.7–0.8×） | **12–22%**（4–6 击，劝退硬碰） | 逼走位/换兵种 |
| 杂兵 → 玩家主力 | **10–20%**（玩家肉盾耐揍） | 玩家容错，避免被秒 |
| boss → 玩家主力（非狂暴） | **20–35%** | 有压力但 2–3 击不死 |
| boss（狂暴 ×1.3）→ 玩家主力 | **30–48%**（≤ HARD_ONE_SHOT_CAP=50%） | 狂暴有威胁但不秒，留反应 |
| 计略（同级精差 ~0）→ 群目标 | 每目标 **20–35%** | AOE 软化、配合普攻收割 |

- **硬上限 `ONE_SHOT_CAP`**：任何**单次命中**（含致命 ×1.5、狂暴）对**玩家君主/主力**占比**不应 >55%（normal）/ >60%（hard）**——即「再倒霉也不会一击被秒」，给玩家反应窗口。模拟脚本（§6）把此作为 **fail 断言**。
- 反之对敌方无此保护（玩家克制 + 致命可一击秒杂兵=爽点）。

### 4.4 TTK（Time-To-Kill，回合/出手数）标的

| 场景 | TTK 标的 | 说明 |
|---|---|---|
| 玩家主力单挑同级杂兵（顺克） | **1–2 次出手** | 克制秒杀感 |
| 玩家主力单挑同级杂兵（无克） | **2–3 次出手** | 标准 |
| 玩家小队（3–4 人）集火同级精英将 | **1 回合内** | 集火有回报 |
| 玩家全队 vs 关底 boss（非狂暴段） | **3–5 回合** | 关底战份量 |
| 杂兵 vs 玩家主力肉盾 | **≥5 次命中** | 玩家肉盾抗线 |
| 计略奶（风水士群疗）抵消的伤害 | 约 1 次普攻伤害/目标 | 奶有用但不无敌 |

- **整关 TTK**：第一章单关**8–15 回合**为健康区（speedrun objectiveMul 阈值 `turnsUnder` 锚此，economy §2.3）。>20 回合=过肉（调 enemyHpMul 或玩家攻），<5 回合=过软。
- **节奏护栏**：①玩家「2–3 击杀杂兵、集火秒精英」=爽；②「啃 boss 要几回合 + 用计略/克制/地形」=有挑战；③「玩家肉盾不被秒、君主有反应窗口」=容错。三者由 §4.3 占比 + 本表 TTK 共同保证。

### 4.5 MP / 计略经济（与 progression §4.2 联动）

- 计略系起始 maxMp 6–12，每回合自然回 **+1**（progression §4.2），招牌计略耗 MP 见 skills.js（建议小计略 2–4 MP、AOE 大计略 6–10 MP）。
- 标的：计略系**每 2–3 回合可放一次主力计略**（攒回 + 神秘水/酒补 MP，economy）；不应「每回合无脑 AOE」（MP 经济限制）也不应「整关放不出几次」。
- 物理系 maxMp 0（隐藏 MP 条），不参与计略经济。

---

## 5. 调参方法论（如何把实际拉回 §4 靶心）

### 5.1 旋钮分层（改哪个调什么，避免乱调）

| 想调整 | 首选旋钮（data/，不改逻辑） | 影响面 |
|---|---|---|
| 整体战斗变快/慢（TTK） | 敌方 `enemyHpMul`（difficulty）+ 各 general `base.hp`/HP 成长档 | 全局 TTK |
| 克制更/更不重要 | `classTriangle.js` 系数（1.3/1.5…）+ §2.5 上限 | 兵种博弈强度 |
| 地形喧宾夺主 | `affinity.js` atk/def/avoid 幅度（±10% 基线） | 地形战术权重 |
| 命中波动太大 | `HIT_BASE`/`HIT_LO`/`HIT_HI` + 士气差权重 | 随机性/手感 |
| 某武将过强/弱 | 该 general 的 `growthGrade` 档 + `traits` ±1 | 单角色 |
| 经济过松/紧 | difficulty `moneyMul` + economy `PRICE`/`seal` | 资源压力 |
| 一击占比超 cap | 敌方 `enemyAtkMul` ↓ 或玩家 `base.def`/HP ↑ | 容错/被秒风险 |

### 5.2 调参流程（迭代闭环）

```
1. 跑 §6 模拟脚本 → 得「实际占比/命中/TTK 分布」报表
2. 与 §4 靶心区间对比，列出超界项（红：硬 fail / 黄：偏离>15%）
3. 按 §5.1 旋钮分层「单旋钮、小步长」改 data 常量（一次只动一类）
4. 重跑模拟 → 收敛到区间；硬 fail（ONE_SHOT_CAP/命中钳/链 clamp）必须清零
5. 浏览器实玩第一章走查（手感复核：克制爽感、boss 份量、奶有用、不被秒）
6. 锁定 → 写回 data 常量注释「校准于 vN 模拟 + 实玩」
```

- **单旋钮原则**：一次只动一个数值类（攻 or 防 or HP or 克制），避免多旋钮互相掩盖导致「调不收敛」。
- **量级守恒**：progression §9.4 要求「Lv50 总属性与旧体系偏差 ±10% 内」——本稿的目标区间（§4.1）即该约束的下游靶。

---

## 6. 平衡模拟脚本规范（纯逻辑，跑伤害/命中分布）

### 6.1 目标与定位

- **纯逻辑离线脚本**（不依赖 three/DOM/浏览器），跑大量确定性样本，输出**伤害区间 / 命中% / 一击占比 / TTK / 衍生触发率**分布，核对 §4 靶心，作 §5 调参的客观依据。
- 复用引擎纯核（`combat.coreDamage`/`coreHit`、`skillEngine.resolveSkill`、`progression.statsAtLevel`、`classTriangle`、`affinity`、`difficulty`），**与游戏同公式**（不另写一份算法，否则模拟失真）。

### 6.2 位置与形态

```
games/caocao-zhuan/tools/balanceSim.mjs     # 离线脚本（node 直跑；ES module；import src/battle 纯核）
games/caocao-zhuan/tools/README.md          # 用法
# 输出：stdout 表格 + 可选 tools/out/balance-report.json（CI/diff 用）
```

- 仅 import **纯逻辑层**（`src/battle/combat.js`、`skillEngine.js`、`progression.js`、`data/*`）——这些已约定「不 import three / 不碰 DOM」，故 node 直接可跑。
- 用 `core/rng.js` 的**可种子 RNG**（固定 seed → 可复现报表，便于 diff 两次调参差异）。

### 6.3 输入矩阵（笛卡尔积采样）

```js
const SIM = {
  levels:   [1, 15, 30, 50],
  difficulties: ['easy','normal','hard'],
  attackers: ['caocao','xiahoudun','典型骑兵','典型弓兵','典型策士'],  // 取 generals + statsAtLevel
  defenders: ['同级杂兵','同级精英','同级boss'],                       // 合成对位单位
  terrains: ['grass','forest','hill','gate'],     // 取 atk方/守方所站组合
  weathers: ['sun','rain','fog'],
  triangle: ['顺克','无克','逆克'],               // 选 attacker/defender classId 触发对应 tri
  samples:  2000,                                  // 每组合掷 2000 次 jitter+命中 求分布
};
```

### 6.4 输出指标（每个组合一行）

| 指标 | 算法 | 对应靶 |
|---|---|---|
| `hitPct` | 命中判定命中数 / samples | §1.2 |
| `dmgMin/dmgMax/dmgMean` | 命中样本的伤害分布 | §1.1 |
| `oneShotPct` | dmgMean / defender.curHp | §4.3 |
| `ttkHits` | ceil(defHP / dmgMean)（含命中率折算：`/hitPct`） | §4.4 |
| `comboRate/critRate` | 衍生触发计数 / samples | §1.5 |
| `chainMul` | 实际 Π(MUL_CHAIN)（验证 §2.5 clamp 生效） | §2.5 |
| `PASS/FAIL` | 是否落 §4 区间；ONE_SHOT_CAP 超界=硬 FAIL | §4.3/§4.4 |

### 6.5 断言（硬 fail，CI 可挂）

```
assert oneShotPct(boss狂暴 → 玩家君主, hard) <= 0.60        // ONE_SHOT_CAP
assert oneShotPct(任意 → 玩家主力) <= 0.55 (normal)
assert all hitPct ∈ [30,100]                               // 命中钳生效
assert all chainMul ∈ [0.25, 4.0]                          // 链 clamp 生效
assert ttkHits(玩家主力→同级杂兵,顺克) ∈ [1,2]
assert ttkHits(全队→boss非狂暴) ∈ [3,5] 回合（按出手数折算）
assert dmg >= 1 恒成立                                       // DMG_FLOOR
```

- 软警告（黄，不挂 CI）：偏离区间 >15% 打印提示，供 §5 调参参考。

### 6.6 与单测的分工

- `tests/`（既有单测框架）测**点**：公式正确性、边界、钳制、rng 顺序、forecast=resolveAttack 自洽（damage-preview §5）。
- `tools/balanceSim.mjs` 测**面**：海量样本的**分布与靶心**（平衡感），输出报表给人看 + CI 断言护栏。二者互补，不重复。

---

## 7. 模块触点（实现期对接清单）

| 模块 | 改动 | 说明 |
|---|---|---|
| `data/balance.js`（新增，或并入 combat.js 顶部） | §1.6 `BAL` 常量 + §2.5 `CHAIN_CLAMP` | 唯一伤害/命中常量源；其它模块 import |
| `data/difficulty.js`（新增/收敛） | §3.1 唯一 `DIFFICULTY` 表 + `DEFAULT_DIFFICULTY` + `ngPlusMod` | campaign/enemy-ai/economy 全部 import；删各自表 |
| `battle/combat.js` | 抽 `coreDamage/coreHit` 纯核（§2.6）；`terrainAtkMod=1` → 真实 `atkChain`；DEF 侧加 `defMod`；命中 spd→爆/士（阶段2）；连击/致命（§1.5） | resolveAttack 与 forecast 共用核 |
| `battle/skillEngine.js` | `elementMul` 乘子位扩为 `SKILL_MUL_CHAIN`（接 weather/terrain/formation/boss/equip）；常量引 `BAL` | 不重写结构 |
| `battle/forecast.js`（damage-preview 新增） | `predictAttack/predictSkill` 复用 `coreDamage`（min/max jitter 求区间）+ 同钳制顺序 | 预测=实际的关键 |
| `battle/battleController.js` | BUILD 期对 foe 套难度乘子（§3.3 [A]，含 NG+ §3.4）；运行期注入 AI/经验/经济读 difficulty；boss 狂暴 enrage 走 §2.1 m5/ §2.4 s5（statuses buff 通道） | 难度只此一处缩放敌方属性 |
| `battle/leveling.js` / `progression.js` | 玩家经验 ×`playerExpMul`（§3.3 [B]）；statsAtLevel 产出喂 §4 区间 | — |
| `data/economy.js` | 删 `ECON.DIFFICULTY_MUL`，`reward` 改读 `DIFFICULTY[diff].moneyMul`（§3.2） | — |
| `data/aiTuning.js`（enemy-ai） | 删自有 `DIFFICULTY`，import 本稿；保留 `applyDifficulty`（属性乘数）与 AI 行为读取 | — |
| `data/classTriangle.js` | 维持系数；11 系迁移按相克族查表（§2.7） | — |
| `data/affinity.js`（terrain-affinity） | `atk/def/avoid` 喂乘法链 m2/d1 与命中 §2.3 | — |
| `tools/balanceSim.mjs`（新增） | §6 模拟脚本（纯核 + 可种子 RNG + 报表 + 断言） | 调参客观依据 |
| `tests/` | 公式/钳制/rng 顺序/forecast 自洽/难度合并后字段引用正确 | 点测；面测交给 balanceSim |

---

## 8. 范围与分期（phaseable）

- **Phase 1（随引擎+ch01）**：①统一常量 `BAL`/`CHAIN_CLAMP`；②combat 抽纯核 `coreDamage` + 接相克(m1)+地形适性(m2)，DEF 加 defMod；③合并 `data/difficulty.js` 唯一表 + 三稿改引用 + BUILD 期敌方缩放；④`tools/balanceSim.mjs` 最小版（Lv1–5 ch01 对位 + ONE_SHOT_CAP 断言）；⑤现 spd→暂作「爆/士」单维兼容（progression 阶段1）。→ 第一章可调平衡、可跑模拟。
- **Phase 2（5 维完备 + 计略链）**：①crit/morale/MP 落地，命中式爆/士分离，连击/致命启用；②skillEngine 接全 SKILL_MUL_CHAIN（weather/terrain/formation）；③forecast 复用纯核（damage-preview）；④balanceSim 全矩阵（Lv1/15/30/50 × 三难度 × 地形 × 天气）。
- **Phase 3（后置）**：阵型(m4/d2/s4)、装备乘子(m6/d4/s6)、boss 狂暴(m5/s5)接满；NG+ 难度叠加(§3.4)；balanceSim CI 集成 + report.json diff。

---

## 9. 与设计语料的一致性自检

- **术语**：五维 攻/精/防/爆/士、11 系职业、计略 `power/kind/element`、天气 `require/blockedIn/powerMod`、地形适性 `atk/def/avoid`、印绶转职、`storyFlags`、roster、faction —— 全部沿用。
- **原则**：数值集中 `data/`、调数不改逻辑（master §1/§9）；纯逻辑层不 import three/不碰 DOM（balanceSim 可 node 直跑）；预测=实际同核（damage-preview）。
- **跨稿对齐**：本稿是难度/乘法链/公式/靶心的**唯一权威**；campaign §6、enemy-ai §7、economy §2/§4 的难度表与系数，terrain-affinity §5.4 的乘子接入，weather §3 的 powerMod，全部**引用本稿**，不再各自定义。
- **数值原创**：所有系数/区间/TTK 为本作自定占位，实现期由 §6 模拟 + 实玩校准；非任何商业作数据。

---

## 待确认（请 James 拍板）

1. **攻减防模型**：采用 combat.js 现行「直接攻减防、不除 2、不加等级常量」（本稿权威式），还是切到 class-system §0 参考的 `((攻−防)/2+等级+25)×系数`？前者已实装、量级健康、防膨胀；后者更贴原作手感但需重标全表。建议**前者**。
2. **乘法链上限 4.0 / 下限 0.25**：是否合适？克制 1.5×地形 1.1×阵型 1.15×狂暴 1.3×装备 1.2≈3.0，留 4.0 余量；是否需更紧（如 3.5）防极限叠秒。
3. **难度合并裁决**：hard `enemyAtkMul 1.12 / enemyHpMul 1.18 / enemyDefMul 1.10`（折三稿）是否认可？hard 偏「更肉」而非「更痛」的取向（保 ONE_SHOT_CAP）是否符合预期？
4. **ONE_SHOT_CAP**：玩家主力单次命中占比上限 normal 55% / hard 60%（含致命/狂暴）——是否够保「不被秒」又不过度保护？
5. **相克 11 系迁移**：6 系先跑、迁移时只补「相克族」映射（不改矩阵），与 terrain-affinity 同策略，是否认可？11 系是否仍保留「枪克骑」独立环（11 系表无独立「枪兵」系，枪并入步/武术？）。
6. **TTK 标的**：单关 8–15 回合、boss 非狂暴段 3–5 回合、克制 1–2 击杀杂兵——节奏是否符合「怀旧成年向」预期（vs 更快/更慢）？
7. **连击/致命公式**：爆差每 +1 → 连击 +2%（cap 50%）、士差每 +1 → 致命 +1%（cap 30%、×1.5）——量级是否合适？是否本期（Phase 2）就上，还是 Phase 3？
8. **balanceSim 落地时机**：是否 Phase 1 即出最小版（ch01 对位 + ONE_SHOT_CAP 断言），还是随 5 维完备一起？建议 Phase 1 最小版先护栏。
9. **MP 经济**：每回合自然回 +1、计略系每 2–3 回合一次主力计略——是否符合「计略系续航」预期？小计略 2–4 / 大 AOE 6–10 MP 区间是否合适（与 skills.js 对齐）。
