# 《群雄逐鹿·孟德篇》progression-leveling — 设计稿（待审）

> 原创致敬作。沿用原版《三国志曹操传》的**成长体系结构与 SABC 成长率档位概念**（事实性设定）；
> 经验曲线、成长率档位的具体数值、HP/MP 公式均为本作自定，**不照搬任何商业游戏的数值表/文本**。
> 与设计语料一致：复用 5 维（攻/精/防/爆/士）、11 系职业、印绶 Lv15/30 转职、五维由武将六维（武力/智力/统率/敏捷/运气）换算、计略消耗 MP。
>
> - **日期**：2026-06-04
> - **作者**：James（顾嘉晟）+ Claude
> - **状态**：设计稿待 review
> - **范围**：成长 / 升级系统（经验来源与曲线、等级上限、升级属性成长、SABC 成长率机制、能力特性、印绶转职对成长的影响、HP/MP 公式、果子接入预留、与现有 `leveling.js` / `battleController` 的迁移校准）
> - **关联**：master design §3.5；class-system §0/§2/§3；item-system §2/§5；damage-preview（伤害公式只读消费成长产物）；weather（不直接交互）

---

## 0. 概览与设计目标

本系统回答一个问题：**一个武将从 Lv1 打到 Lv50，属性如何长、长多快、长多少。**

设计目标（与「引擎/内容分离」「数据驱动一切」一致）：
1. **可复现**：成长是 `(基础成长率 + 兵种成长率) × 档位 → 每级增量` 的确定函数，不依赖战斗 RNG，存档只需 `{level, exp}` 即可重建全属性。
2. **数据驱动**：成长率档位（SABC）、经验来源、曲线参数全部在 `data/` 与一个 `progression.js` 配置里，调参不动引擎。
3. **忠实但精简**：保留原版「兵种成长率 + 武将基础成长率取均」的精髓与 SABC 直觉；果子/压级练果**本期暂缓**（见 item-system §5），先用确定成长，预留接口。
4. **向后兼容**：现有 `leveling.js` 的 `gainExp(unit, amt) -> {leveledUp, gains}` 契约**保留签名**，内部换算改为 SABC，battleController 不变。

---

## 1. 五维 / 六维与成长的关系（与 class-system §0 对齐）

class-system 定义：战斗中实际参与公式的是 **5 维 攻/精/防/爆/士**，它们由武将的**六维基础值**换算 + 兵种成长叠加：

| 战斗 5 维 | 由武将哪项换算 | 成长来源 |
|---|---|---|
| 攻 | 武力/2 | 武力成长率 + 兵种攻成长 |
| 精 | 智力/2 | 智力成长率 + 兵种精成长 |
| 防 | 统率/2 | 统率成长率 + 兵种防成长 |
| 爆 | 敏捷/2 | 敏捷成长率 + 兵种爆成长 |
| 士 | 运气/2 | 运气成长率 + 兵种士成长 |

> **本作实现取径（与现状妥协，避免推倒重来）**：现有 `Unit` 直接持有 `atk/def/int/spd`（4 项）+ `maxHp`，尚无独立的「爆/士」字段。本稿**以 5 维为目标模型**，并给出**两阶段迁移**（§9）：
> - **阶段 1（最小改动）**：成长直接作用在现有 `atk/def/int/spd/maxHp` 上，沿用 `gainExp` 契约，只把「每级固定增量」换成「SABC 档位算出的增量」。`spd` 暂时承载「爆」语义，「士」延后。
> - **阶段 2（5 维完备）**：补 `crit(爆)`、`morale(士)` 两字段与对应六维（武力/智力/统率/敏捷/运气）来源，成长按 5 维各自档位独立计算。本稿数据结构按阶段 2 设计，阶段 1 取其子集即可跑。

**字段命名约定**（跨模块契约，沿用现有英文键 + 新增两项）：

| 5 维 | Unit 字段 | 武将六维源字段（GeneralDef.base 内） |
|---|---|---|
| 攻 | `atk` | `wuli`（武力） |
| 精 | `int` | `zhili`（智力） |
| 防 | `def` | `tongshuai`（统率） |
| 爆 | `crit`（新） | `minjie`（敏捷） |
| 士 | `morale`（新） | `yunqi`（运气） |

> 现有 generals.js 的 `base:{hp,atk,def,int,spd}` 是「已换算好的 5 维近似」（spd≈爆）。阶段 1 直接沿用；阶段 2 可选地引入六维原值并在 makeUnit 时换算，或继续直接维护 5 维成长率（更轻，推荐：**直接对 5 维定义成长率档位，不强制引入六维原值**——六维仅作为设定/立绘文案的「人设解释」）。

---

## 2. 等级上限与经验曲线

### 2.1 等级上限
- **Lv 上限 = 50**（与 class-system §3「等级 1–50」一致）。
- 达 Lv50 后仍可获经验，但**不再升级**；溢出经验**丢弃**（不留作转职/果子货币——保持简单；若日后果子系统落地可改为「满级经验转练果」，见 §8）。

### 2.2 「每级 100 exp」与变曲线
现状：`leveling.js` 固定 `EXP_PER_LEVEL = 100`，每满 100 升 1 级，支持一次大经验跨多级。这条**保留为默认（线性档）**，但本稿引入**可配的「升级所需经验」曲线**，以便高级更慢、低级速成（曹操传式手感：前期蹭经验快、后期慢）：

```
expToNext(level)  // 从 level 升到 level+1 所需经验
```

三档曲线（`progression.js` 配置，默认 `flat`，可整局切换；不影响存档可复现性）：

| 曲线 id | 公式（取整） | 手感 | 备注 |
|---|---|---|---|
| `flat`（默认/向后兼容） | `100` | 与现状完全一致 | 阶段 1 直接用，零行为变化 |
| `gentle` | `80 + 4*(level-1)` | 缓慢加码（Lv1→81…Lv49→272） | 推荐正式手感 |
| `step` | `60 + 20*floor((level-1)/10)` | 每 10 级一台阶 | 与转职阶段（15/30）呼应 |

> **可复现性**：升级判定只读 `unit.exp` 与 `expToNext`，无 RNG。存档仍只存 `{level, exp}`，重进游戏由 makeUnit 重建全属性（见 §5.3）。

### 2.3 经验来源（与 master §3.5 + battleController 现状对齐）
现有 battleController 已发以下经验（沿用，集中成 `progression.js` 常量，便于调参）：

| 行为 | 常量（现值） | 接入点（现状） |
|---|---|---|
| 普攻命中 | `HIT_EXP = 10` | `battleController` 攻方结算 |
| 普攻击杀 | `KILL_EXP = 50` | 同上（击杀给 KILL，不再额外给 HIT） |
| 反击命中/击杀 | 同 HIT / KILL | 守方反击结算 |
| 计略命中（每目标） | `SKILL_HIT_EXP = 10`，击杀 +`KILL_EXP` | 计略结算，AOE 逐目标累计 |
| 单挑胜者 | `DUEL_EXP = 40` | 单挑结算 |

**本稿新增经验来源（建议，留接口、可分批启用）**：

| 行为 | 建议值 | 说明 |
|---|---|---|
| 治疗/辅助命中 | `SUPPORT_EXP = 12` | 让奶/辅助（风水士）能跟上等级（原版精髓）。按「有效治疗量 > 0」给；过量治疗减半。 |
| 增益/解状态命中 | `BUFF_EXP = 8` | 鼓舞/坚固/觉醒等 |
| 达成关卡目标 | `OBJECTIVE_EXP = 0`（默认关闭） | 数据驱动可在 victory 配置里给「占领/坚守」单位补经验 |
| **等级差修正** | 见 §2.4 | 低级打高级多给、高级欺负低级少给（防呆 + 帮落后单位追） |

### 2.4 等级差经验修正（建议，可配开关）
为避免「等级雪球」（强者越强、弱者永远跟不上），最终发放量乘一个由**目标与攻击者等级差**决定的系数：

```
expAwarded = round(baseExp * levelDiffMul(attackerLv, targetLv))
levelDiffMul(a, t):
  d = t - a                      // 目标比我高 d 级
  return clamp(1 + 0.08 * d, 0.4, 1.8)   // 高 1 级 +8%，封顶 ±
```

- 打高 5 级目标：×1.4；欺负低 5 级目标：×0.6。范围夹在 [0.4, 1.8]。
- **默认关闭**（`levelDiffExp:false`），先用现有固定值跑通；正式平衡期再开。开关与系数都在 `progression.js`。

---

## 3. 成长率档位机制（SABC，核心）

### 3.1 档位定义
每一项 5 维都有一个**成长率档位**，决定该维**每级的「成长权重」**：

| 档位 | 权重值 `gradeValue` | 直觉 |
|---|---|---|
| S | 4 | 极优（招牌维） |
| A | 3 | 优 |
| B | 2 | 中 |
| C | 1 | 平 |

（与 class-system §2 表头「成长攻精防爆士 = S/A/B/C」完全同义；那张表就是**兵种成长率**。）

### 3.2 两路成长率：兵种 + 武将基础，取均向下取整
忠实复刻原版精髓「**兵种成长率 与 武将基础成长率 取平均**」：

```
对每一维 stat ∈ {atk, int, def, crit, morale}:
  classGrade = CLASS_GROWTH[classId][stat]      // 兵种成长率档（来自 class-system §2 表）
  baseGrade  = GENERAL_GROWTH[generalId][stat]  // 武将「基础能力」成长率档
  effGrade   = floor( (gradeValue(classGrade) + gradeValue(baseGrade)) / 2 )   // 取均，向下取整
```

- `effGrade` 是「**有效成长权重**」(1~4)，即每级该维的「成长点」。
- **向下取整**：例如 兵种 S(4) + 武将 B(2) = 6/2 = 3 → A 档权重 3；兵种 A(3) + 武将 B(2) = 5/2 = 2.5 → floor=2（B 档权重）。这制造了「兵种和人都强才顶」的张力，与原版手感一致。

> 现状代码里武将与兵种用的是**固定每级增量**（如 `growth:{hp:9,atk:4,...}`），不是档位。迁移见 §9：把这些固定增量**反推/重标**为 SABC 档（一次性 data 重写），引擎改读档位。

### 3.3 能力特性：基础能力可被「特性」±1 档
class-system 未明列「能力特性」，本稿定义其为**武将级修饰符**（致敬原版「能力特性」对成长率档的微调），叠加在「武将基础成长率」上、参与取均**之前**：

```
GeneralDef.traits = [ { stat:'atk', delta:+1, label:'天生神力' }, { stat:'int', delta:-1, label:'有勇无谋' } ]

baseGradeRaw = GENERAL_GROWTH[generalId][stat]
baseGrade    = clamp(baseGradeRaw + sum(traits where stat matches .delta), C..S)  // 即权重夹在 [1,4]
```

- 特性 `delta` 仅取 `±1`（一档）；同一维多个特性可叠加但最终夹在 C(1)~S(4)。
- 特性是**纯人设/数值标签**，UI 在档案卡（statCard）可展示 `label`，不另开养成入口（果子系统才会动态改档，见 §8）。
- 例：夏侯惇 步兵(攻 B) + 武将基础(攻 A) + 特性「天生神力 攻+1」→ 武将基础攻 = A→S(4)；取均 floor((2+4)/2)=3 → 攻 A 档 / 每级 +3。

### 3.4 每级增量公式（5 维）
```
perLevelGain(stat) = effGrade(stat)            // = 1~4，直接作为该维每级增量基数
```
- 即「权重 = 每级加点」。Lv1→Lv50 共 49 次成长，一项 S 档累计 +4×49=+196，C 档 +49。
- **抖动可选**：原版有 ±1 随机成长。本稿**默认无抖动**（保可复现 + 防存档膨胀）；若要手感，提供 `growthJitter:false` 开关 + 用 `core/rng.js` 的**按 (generalId, level, stat) 派生的确定性种子**抖动（同一武将同一级抖动恒定，仍可复现）。**默认关闭**。

---

## 4. HP / MP 成长公式

HP（=兵力/`maxHp`）与 MP（计略点）**独立于 5 维**，各有自己的成长，量级远大于 5 维（HP 以「人头数」量级计）。

### 4.1 HP 成长
HP 也走 SABC，但**权重映射到更大的每级增量**（HP 档不是 1~4，而是档位→HP 步长）：

```
HP_STEP = { S: 9, A: 7, B: 5, C: 3 }   // 每级 maxHp 增量（progression.js 可调）

hpGradeClass = CLASS_GROWTH[classId].hp      // 兵种 HP 档（新增到 class 表）
hpGradeBase  = GENERAL_GROWTH[generalId].hp  // 武将 HP 档
hpEffGrade   = floorAvgGrade(hpGradeClass, hpGradeBase)   // 同 §3.2 取均向下取整 → S/A/B/C
perLevelHp   = HP_STEP[hpEffGrade]
```

- 升级时 `maxHp += perLevelHp`；**curHp 同步 += perLevelHp**（沿用现状「升级回血/扩容」语义，见 leveling.js 第 43 行）。
- 量级校准（与现有 generals 一致）：步兵/骑兵 HP 档偏 A/S（夏侯惇现 growth.hp=9 → S；曹操 7 → A），谋士/道士偏 C/B（现 strategist hp=4 → C）。§9 给反推映射表。

### 4.2 MP 成长（新增 —— 现状无 MP 字段）
计略消耗 MP（class/skills 已假定计略系靠 MP），但当前 `Unit` 无 MP。本稿引入：

```
Unit.maxMp / curMp        // 新增字段
GeneralDef.base.mp        // 起始 MP（计略系给值；纯物理系可为 0/小值）
MP_STEP = { S: 3, A: 2, B: 1, C: 0 }   // 每级 maxMp 增量

mpEffGrade = floorAvgGrade(CLASS_GROWTH[classId].mp, GENERAL_GROWTH[generalId].mp)
perLevelMp = MP_STEP[mpEffGrade]
maxMp += perLevelMp; curMp = maxMp(关末满血满蓝结算时)
```

- **MP 档建议**：计略系（策士/道士/风水士/君主）mp 档 A~S；物理系（步兵/骑兵/弓/武术/盗贼）mp 档 C（每级 +0，靠转职/道具拿少量 MP 跑自用计略，如君主霸气）。
- 战斗内 MP 回复：默认每回合 +1（或 `太平要术` 等宝物加成，见 item-system §4）；细则归 skillEngine/combat，本稿只定**成长**部分。
- **物理纯特技兵种**（步兵/骑兵/弓兵/弓骑兵，class-system §4 标「无计略」）：`maxMp` 可恒 0，UI 不显示 MP 条。

### 4.3 成长结算时机
- **战斗内**：`gainExp` 即时升级（沿用现状），即时 `maxHp/curHp` 扩容、5 维 +、MP 扩容；播放「升级！」FX（render3d/fx + audio）。
- **关末**：master §3.5「关末统一结算并播放成长演出」——本稿建议**战斗内即时升级**为准（手感即时），**关末做汇总演出**（列出本关每人升了几级 / 学了什么计略），不二次发放。`curHp/curMp` 在关末整军**回满**（intermission 行为，非本稿强约束）。

---

## 5. 数据结构（build-ready）

### 5.1 兵种成长率（class-system §2 表 → 数据）
扩展 `data/classes.js` 的 `ClassDef`，把现有 `growth:{固定增量}` 替换为**档位表**，并补 HP/MP 档：

```js
// data/classes.js（阶段 2 目标形态；阶段 1 可只填用到的维）
ClassDef {
  id, name, moveType, atkRange, counterRange,
  // 成长率档位（SABC）：来自 class-system §2 那张表
  growthGrade: { hp:'A', mp:'C', atk:'S', int:'B', def:'A', crit:'B', morale:'B' },
  //            ^^ 例：骑兵 攻S 精B 防A 爆B 士B（与 §2 表「骑兵 S|B|A|B|B」一致）
  skills, promoteTo,
  // 转职后覆盖（见 §6）
  tier: 1,                 // 1初级/2中级/3高级
  promote: { mov, atkShape, growthGradeDelta? }   // 转职带来的变化，详见 §6
}
```

> class-system §2 表逐行即为各系初级的 `atk|int|def|crit|morale` 档；本稿仅额外要求补 `hp` 与 `mp` 两档（见 §4 校准建议）。

### 5.2 武将基础成长率 + 特性（generals.js）
```js
// data/generals.js
GeneralDef {
  id, name, title, faction, classId,
  base: { hp, mp, atk, int, def, crit, morale, mov },   // 起始 5 维(+HP/MP/mov)；阶段1 沿用 hp/atk/def/int/spd
  growthGrade: { hp:'A', mp:'C', atk:'A', int:'C', def:'B', crit:'B', morale:'B' }, // 武将基础成长率档
  traits: [ { stat:'atk', delta:+1, label:'天生神力' } ],   // 能力特性 ±1 档（§3.3）
  skills, items, ai, appearance, storyFlags
}
```
- **旧 `growth:{固定数}` 字段**：迁移期保留为「兜底/未标档者」，但**优先读 `growthGrade`**（见 §9 兼容顺序）。

### 5.3 重建函数（makeUnit 的成长叠加，纯函数、可单测）
新增 `battle/progression.js` 集中成长逻辑（leveling.js 调它，battleController.makeUnit 也调它）：

```js
// battle/progression.js
export const GRADE_VALUE = { S:4, A:3, B:2, C:1 };
export const HP_STEP = { S:9, A:7, B:5, C:3 };
export const MP_STEP = { S:3, A:2, B:1, C:0 };
export const MAX_LEVEL = 50;

// 取均向下取整 → 返回 'S'|'A'|'B'|'C'
export function avgGrade(g1, g2) { /* floor((GV[g1]+GV[g2])/2) → 反查档 */ }

// 解析某武将某维的有效成长档（含特性 ±1）
export function effGrade(def, stat) {
  const classG = CLASSES[def.classId].growthGrade[stat];
  let baseG = def.growthGrade?.[stat] ?? 'C';
  baseG = applyTraits(baseG, def.traits, stat);   // ±1，夹 C..S
  return avgGrade(classG, baseG);
}

// 每级各维增量（5 维 + hp + mp）
export function perLevelGains(def) { /* 用 effGrade + GRADE_VALUE / HP_STEP / MP_STEP */ }

// 从 base + level 重建全属性（makeUnit 用；纯函数）
export function statsAtLevel(def, level) {
  const g = perLevelGains(def); const n = Math.min(level, MAX_LEVEL) - 1;
  return {
    maxHp: base.hp + g.hp*n, maxMp: base.mp + g.mp*n,
    atk: base.atk + g.atk*n, int: base.int + g.int*n,
    def: base.def + g.def*n, crit: base.crit + g.crit*n, morale: base.morale + g.morale*n,
  };
}

// 升级所需经验
export function expToNext(level, curve='flat') { /* §2.2 */ }
```

- **存档不变**：仍只存 `{generalId, level, exp, items, skillsLearned, hp}`（master §6）。重进由 `statsAtLevel` 重算，再用 `hp` 覆盖 `curHp`（带伤进度）。`curMp` 关末满，存档可不存（重算为 maxMp）或存一份。

---

## 6. 印绶转职对成长的影响（与 class-system §3 / item-system §3 联动）

转职=用一枚**印绶**（item-system §2）在关间整军执行，Lv15 转中级、Lv30 转高级，30+ 可选中/直高。本稿只定**转职对成长/HP/MP/移动/范围的影响**（转职流程归 `battle/promotion.js` + intermission）：

### 6.1 转职瞬间（一次性跃升）
执行转职时：
1. **兵种 id 切换** → `classId = promoteTo[...]`，随之 `growthGrade`（兵种档）、`atkRange/atkShape`、`moveType`、`mov` 全部切到新 tier 的值（class-system §2 列了初/中/高的 移动 与 footprint）。
2. **HP/MP 满状态**（item-system §2「满血满蓝」）：`curHp=maxHp, curMp=maxMp`，并给一次**转职奖励跃升**（一次性 +，非每级）：
   ```
   PROMOTE_BONUS = {
     toMid:  { maxHp:+10, maxMp:+3, allStats:+2 },   // Lv15 转中级
     toHigh: { maxHp:+16, maxMp:+5, allStats:+3 },   // Lv30 转高级
   }
   ```
   `allStats` 对 5 维各 +。数值可调，置于 `progression.js`。
3. **移动 / 攻击范围**：直接取新 tier 的 `mov` 与 `atkShape`（footprint 升级，如 cross1→star、diamond[1,2]→[1,3]）。这影响 `attackReach` 高亮与移动范围，归 battle/attack-reach（class-system 实现影响 §3），本稿只声明「转职后立即生效」。
4. **解锁高阶计略**：转职 tier 提升后，后续按职业表 §4 的高阶 Lv 阈值（如策士 Lv12 火阵、Lv28 爆焰）才可习得——见 §7。

### 6.2 转职后的成长率（持续影响）
- **兵种成长率随新 tier 变化**：本稿规则——**中级/高级兵种的 `growthGrade` 不低于初级**（转职是变强），招牌维可再 +1 档（如骑兵高级亲卫队 攻 S 保持、防 A→S）。具体各 tier 档表是 class-system 的数据职责；本稿要求：`growthGrade(tier3) ≥ growthGrade(tier1)` 每维（单调不降）。
- **取均仍生效**：转职后每级增量 = `floorAvg(新兵种档, 武将基础档+特性)`。所以「武将基础成长率」是贯穿三段的人物底色，兵种 tier 提升只抬「兵种这一路」。
- **君主线例外**（class-system §3）：群雄→英雄→霸王**不靠印绶**，随主线/剧情成长（视为在固定剧情点自动转 tier，等级阈值同样 15/30 或由剧情 flag 触发）。无印绶消耗。

### 6.3 重算一致性
- 转职改变了 `classId`，因此**存档需额外存当前 `tier`/`classId`**（不能只靠 generalId 推），否则 `statsAtLevel` 用错兵种档。建议存档 roster 项扩为 `{generalId, classId, tier, level, exp, items, skillsLearned, hp, mp?}`。
- `statsAtLevel` 重建时：base 用「当前 tier 的起始 base」还是「初级 base + 各段成长」？**采用后者**（初级 base 起算，每级用「当时所在 tier 的兵种档」）——这要求记录**转职发生的等级**才能精确重算。**简化方案（推荐）**：转职时把跃升与档变化**固化进存档的当前属性快照**（存 `statSnapshot` 或直接存满五维），重进直接读快照，避免重算路径分叉。本稿建议存快照（见 §9 待确认）。

---

## 7. 逐级技能习得（成长系统的触发钩子）

升级是「按职业表授予计略/特技」的触发点（class-system §4、§实现影响 §5）。本稿定义**成长侧的钩子**，技能内容归 skills.js / skillEngine：

```
// 升级到 newLevel 时
for skillEntry in CLASS_SKILL_TABLE[classId]:   // [{ lv, skillId }]，来自 class-system §4 各系表
   if skillEntry.lv === newLevel and tierAllows(skillEntry, currentTier):
      learn(unit, skillEntry.skillId)            // 加入 unit.skills / roster.skillsLearned
      emit('skill:learned', {unitId, skillId})   // 关末演出列出
```

- `tierAllows`：高阶计略要求已转到对应 tier（如策士 Lv28 爆焰需 tier3）。未达 tier 而到达 Lv 阈值：**记为「待解锁」**，转职达成 tier 时**补发**该 tier 已越过的所有计略。
- 物理系特技（突击/连击/反击强化/不被相克…）多为**被动/兵种自带**，在转职/到 tier 时一次性获得，同样走 `skill:learned` 演出。

---

## 8. 果子 / 压级练果（暂缓子项 —— 仅说明将如何接入）

**本期暂缓**（item-system §5 已记 TODO）。当前用确定成长（固定档），不实装练果。预留接口如下，待装备/印绶/宝物落地后再评估：

- **果子=改成长率档**：吃一颗「武力果」→ 该武将 `growthGrade.atk` **+1 档**（夹 C..S），等价于追加一条 `trait{stat:'atk',delta:+1}`。即果子在数据层就是**永久特性叠加**，§3.3 的 trait 机制就是它的落点——**已预留**。
- **压级练果**（装备练级 99 经验/3 档 → 卖出出果）：是「果子货币」的产出侧，属 item/intermission 经济，**与本成长系统解耦**；本系统只在 trait/growthGrade 上消费其产物。
- **接入点（未来）**：
  1. `progression.applyTrait(def, {stat, delta})` —— 已是 §3.3 的同一函数，果子复用。
  2. 重算：吃果后 `statsAtLevel` 重算或快照刷新（与 §6.3 同一致性策略）。
  3. **压级**：玩家故意压低等级刷果——本系统不阻止低级长留；满级经验丢弃规则（§2.1）届时可改为「满级转练果经验」。
- **本稿不实现任何果子数据/UI**；仅保证 trait/档位机制能无缝承接。

---

## 9. 与现有 `leveling.js` / `battleController` 的迁移校准

目标：**不破坏现有契约**，分两阶段切换到 SABC。

### 9.1 现状盘点
- `leveling.js`：`gainExp(unit, amt) -> {leveledUp, gains:{hp,atk,def,int,spd}}`；每满 100 升级；每级加 `growthOf(unit)`（unit.growth 优先，否则 CLASSES[classId].growth），固定增量；`maxHp/curHp` 同步 +hp。
- `battleController.makeUnit`：`base` 起算，`level>1` 叠加 `(level-1)*growth`（同一 `growthOf`）。
- 发经验常量 `KILL_EXP=50/HIT_EXP=10/DUEL_EXP=40/SKILL_HIT_EXP=10` 在 battleController 顶部。
- `Unit` 字段：`maxHp/curHp/atk/def/int/spd/mov`，**无 crit/morale/maxMp/curMp**。
- generals/classes 用**固定 growth 增量**，非档位。

### 9.2 阶段 1（最小改动，零行为回归风险可控）
1. 新建 `battle/progression.js`，承载常量（MAX_LEVEL/EXP/STEP/GRADE_VALUE）、`expToNext`、`avgGrade`、`effGrade`、`perLevelGains`、`statsAtLevel`。
2. **成长率档数据**：给 classes/generals 增 `growthGrade`（不删旧 `growth`）。一次性把现有固定增量**反推为档**（见 §9.4 映射）。
3. `leveling.gainExp` 内部改为：
   - `EXP_PER_LEVEL` → `expToNext(level, curve)`（默认 `flat=100`，行为不变）。
   - 每级增量 → `perLevelGains(def)` 的 `{hp,atk,def,int}` 子集（spd 暂映射 crit；morale/mp 阶段 2 再加）。**保持返回 `gains:{hp,atk,def,int,spd}` 形状不变**（spd 槽放 crit 增量，battleController/HUD 无感）。
   - 加 `level >= MAX_LEVEL` 时停止升级、丢弃溢出 exp。
4. `makeUnit` 的 `level>1` 叠加改调 `statsAtLevel(def, level)`（同一套档位逻辑，保证「即时升级」与「重建」一致——目前两处各写一份，迁移后**单一来源**，消除潜在分叉 bug）。
5. 经验常量集中到 `progression.js`（battleController import），值不变。
6. 单测：`tests/` 加 `progression.test`（avgGrade 取均向下取整、特性 ±1 夹边界、statsAtLevel 与逐级 gainExp 结果一致、满级停长、expToNext 三曲线）。现有 leveling 行为在 `flat` 曲线下回归不变。

### 9.3 阶段 2（5 维完备 + MP）
1. `Unit` 加 `crit/morale/maxMp/curMp`；generals.base 加 `mp/crit/morale`（或由 spd 拆分迁移）。
2. `gainExp` 返回 `gains` 扩展为 `{hp,mp,atk,int,def,crit,morale}`（HUD/升级演出同步显示新维）。
3. damage-preview / combat 改读 5 维（爆=连击会心、士=命中反击必杀）；与 damage-preview spec 对齐字段名。
4. HUD/statCard 显示 MP 条与 5 维；物理纯系隐藏 MP。
5. 印绶转职 promotion.js 接 §6（存 tier/classId/快照）。

### 9.4 固定增量 → SABC 档反推映射（一次性 data 重写指引）
把现有 `growth.<stat>` 数值按区间映射为档（用于 5 维；HP 用 HP 专表）：

| 5 维固定增量 | → 档 | | HP 固定增量 | → HP 档 |
|---|---|---|---|---|
| 4 | S | | ≥9 | S |
| 3 | A | | 7–8 | A |
| 2 | B | | 5–6 | B |
| ≤1 | C | | ≤4 | C |

> 注意：现有固定增量是「武将 growth **已含兵种**的合并值」；改档后变成「兵种档 + 武将档**取均**」。因此不能简单把合并值整体当武将档，否则取均会减半。**重写策略**：先按 class-system §2 表填**兵种档**（权威来源），再为每个武将填**武将基础档**使「floorAvg(兵种, 武将)→ 每级增量」≈ 旧合并值（用 §9.4 表反查目标档，解出武将档）。少数解不出整洁档的，用**特性 ±1**微调补差。重写后跑 §9.2.6 单测核对量级（Lv50 总属性与旧体系偏差控制在 ±10% 内）。

### 9.5 兼容读取顺序（迁移期并存）
```
成长档来源优先级：def.growthGrade > 由旧 def.growth 反推 > CLASS.growthGrade > 全 C
```
保证未及重写的武将仍能跑（按旧 growth 反推档），不阻塞分批迁移。

---

## 10. 示例（端到端走一遍）

**夏侯惇**（步兵 infantry，class-system §2 步兵档 `攻B 精A 防S 爆B 士B`，HP 档设 A）：
- 武将基础成长档（重写后设）：`攻A 精C 防A 爆B 士C`，HP 档 S；特性「天生神力 攻+1」。
- 有效攻档：武将攻 A(3)+特性+1 → S(4)；取均 floor((B=2 + S=4)/2)=3 → **A 档，每级 +3**。
- 有效防档：floor((S=4 + A=3)/2)=3 → **A 档，每级 +3**。
- 有效 HP 档：floor((A=3 + S=4)/2)=3 → **A 档，每级 +7 maxHp**。
- 从 base.hp=78 起，Lv1→Lv15（+14 级）：maxHp = 78 + 7×14 = 176；Lv15 用印绶转「重步兵」满血满蓝 + 转职跃升 maxHp+10 → 186，footprint 仍 cross1，移动不变（步兵 4/4/5，中级仍 4）。
- Lv30 转「近卫兵」：footprint 升 star（八向）、移动 4→5、再跃升 maxHp+16；攻已 S 档…（按新 tier 档）。

**曹操**（君主 leader，§2 君主全 A；HP 档设 A，MP 档 A）：
- base.int=25 起；精档 floor((A + 武将精档)/2)。君主线随剧情转 tier（无印绶），群雄→英雄→霸王在剧情点自动升 footprint/移动/计略。

---

## 11. 模块触点小结

| 模块 | 改动 |
|---|---|
| `battle/progression.js`（新） | SABC 取均、特性、每级增量、statsAtLevel、expToNext、常量；纯逻辑可单测 |
| `battle/leveling.js` | gainExp 内部改调 progression；保签名；加满级停长 + 可配曲线 |
| `battle/battleController.js` | makeUnit 改调 statsAtLevel（单一来源）；经验常量移入 progression；（阶段2）发治疗/辅助经验、等级差修正 |
| `data/classes.js` | 加 `growthGrade`（5维+hp+mp 档）、各 tier 的 mov/atkShape/promote |
| `data/generals.js` | 加 `growthGrade` + `traits`；base 加 mp/crit/morale（阶段2） |
| `battle/promotion.js`（新，class/item 系已规划） | 印绶转职：切 classId/tier、满血满蓝、跃升、补发计略；写存档快照 |
| `core/gameState.js` | roster 项扩 `{classId,tier,(statSnapshot?)}`；存档版本 +1 + 迁移 |
| `ui/hud.js`/`statCard.js` | 显示 MP 条、5 维、升级 gains、特性 label |
| `render3d/fx.js`/`audio` | 升级 / 转职演出 |
| `tests/` | progression 单测（取均、特性、重建一致、满级、曲线、量级回归） |

---

## 12. 待确认

1. **经验曲线**：采用哪条（`flat` 兼容 / `gentle` / `step`）？建议默认 `flat` 跑通，正式手感切 `gentle`。
2. **等级差经验修正**：是否启用 `levelDiffExp`？默认关闭可先不做。
3. **5 维落地时机**：阶段 2 的 `crit/morale/MP` 是否本期就上，还是先 4 维（spd≈爆）跑第一章？影响 damage-preview/combat 字段对齐。
4. **成长抖动**：保确定无抖动（推荐），还是要确定性种子的 ±1 手感抖动？
5. **HP/MP/转职跃升步长**（HP_STEP / MP_STEP / PROMOTE_BONUS）是否接受本稿建议值，待实玩平衡调。
6. **转职重算一致性**：采用「存满五维/属性快照」（推荐，简单）还是「记录转职等级精确重算」？决定存档结构与 `statsAtLevel` 复杂度。
7. **满级经验处理**：丢弃（本稿默认）还是为将来果子系统预留「满级转练果经验」？
8. **武将基础成长档 + 特性的全表**：需逐武将填表（§9.4 反推 + 微调），是否随本稿一起出，还是开「数值表」专项？
9. **君主线转 tier 触发**：靠等级阈值（15/30）自动，还是绑定具体剧情 flag？
10. **治疗/辅助经验**：是否本期启用（让风水士跟等级），值 SUPPORT_EXP=12 是否合适？
