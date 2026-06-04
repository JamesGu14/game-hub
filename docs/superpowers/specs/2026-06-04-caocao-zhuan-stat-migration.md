# 《群雄逐鹿·孟德篇》五维迁移（批次0 闸门）— 设计稿（待审）

> **批次0 · 闸门级权威稿**。本稿钉死最终**字段模型**与**迁移顺序**：现状 4 维（`atk/def/int/spd` + `maxHp`）→ 目标五维 **攻/精/防/爆/士**（canonical 命名）+ 新增 **MP**（`maxMp/curMp`）。
> 原创设计：数值/结构/迁移函数全本作自定，仅借公有领域三国设定文案解释人设；不照搬任何商业游戏数据。
> **本稿是字段模型的唯一权威**。progression-leveling §9、ui-ux §13、damage-preview 三处分散的迁移指引在此合并，其它稿一律**引用本稿**、不再各自定义字段名/迁移顺序/存档版本。
> 状态：**待 James 审阅**。

- 日期：2026-06-04 · 作者：James + Claude · 项目：`games/caocao-zhuan/`
- 关联权威：class-system §0（五维含义，命名权威）；本稿（字段/迁移/存档版本权威）；balance-master（数值/公式倍率链权威，本稿不定数值）。

---

## 0. 闸门定位与「唯一权威」边界

| 谁定义什么 | 权威稿 |
|---|---|
| 五维**含义**（攻/精/防/爆/士各管什么、由哪个六维换算） | class-system §0 |
| 五维**字段名 / Unit 与 Def 形状 / 新增 MP / 旧→新映射 / 迁移顺序 / 存档版本** | **本稿（唯一）** |
| 成长 SABC 档机制、成长率表、经验曲线、HP_STEP/MP_STEP | progression-leveling |
| 伤害/命中**公式与倍率链、clamp、具体数值** | balance-master |

> 凡涉及「字段叫什么、Unit 上有没有这个字段、存档第几版、缺字段怎么兜底」——以本稿为准。其它稿出现冲突表述时，以本稿覆盖之，并在该稿改为「见 stat-migration」。

**为什么是批次0 闸门**：五维字段贯穿 combat / leveling / forecast / hud / intermission / generals / classes / gameState 存档，是所有其它批次的地基。先在引擎层把字段模型与存档版本钉死，后续批次（damage-preview、enemy-ai、economy、progression 数值）才能在稳定字段名上并行，避免各写一份字段、各自迁移、互相打架。

---

## 1. 最终字段模型（钉死）

### 1.1 五维 canonical 命名（中文显示名 / 代码字段名 一一对应）

| 维 | 中文显示名 | **代码字段名（canonical）** | 含义（class-system §0） | 六维来源 |
|---|---|---|---|---|
| 攻 | 攻击 | `atk` | 物理伤害 | 武力/2 + 兵种成长 |
| 精 | 精神 | `int` | 计略威力 + 计略抗性(魔抗) | 智力/2 + 兵种成长 |
| 防 | 防御 | `def` | 减免物理（对计略无效） | 统率/2 + 兵种成长 |
| 爆 | 爆发 | `crit`（**新增**） | 连击/会心 发动率与威力 | 敏捷/2 + 兵种成长 |
| 士 | 士气 | `morale`（**新增**） | 命中/反击/必杀 发挥 | 运气/2 + 兵种成长 |

> **关键决策**：保留现有 `atk/int/def` 三个字段名不改（精=`int`、防=`def` 维持现状代码），仅**新增** `crit`(爆) / `morale`(士) 两个字段；现有 `spd`（敏捷/速度）在迁移完成后**退役为 `crit`**（见 §3 命中式切换与 §2.3）。这样把字段改动面压到最小，避免对 `atk/int/def` 做大范围重命名（rename 风险高、收益低）。
>
> 即：**精用 `int`、爆用 `crit`、士用 `morale`** —— 不引入 `spirit/burst/spd2` 等别名。全代码库唯一一套字段名，任何稿引用即用这五个英文字段名。

### 1.2 六维原值（武力/智力/统率/敏捷/运气）—— **不进 Unit、不进存档**

class-system §0 用六维解释五维由来；本作落地**直接维护五维成长**（progression §1 注：六维仅作人设/立绘文案，不引入六维原值字段）。故：

- `GeneralDef` **不**新增 `wuli/zhili/tongshuai/minjie/yunqi` 字段（除非将来做「武将图鉴展示原值」，那是展示层，另开 `lore` 字段，不参与公式）。
- `GeneralDef.base` 直接给**已换算好的五维**：`{ hp, mp, atk, int, def, crit, morale, mov }`。
- 六维→五维的「÷2 + 兵种成长」只在**填表时心算**用（写 generals 数值时参考），运行期无此换算。

### 1.3 Unit（运行态，battleController.makeUnit 产出）最终形状

```js
Unit {
  // 身份
  id, name, title, faction, classId,
  // 进度
  level, exp,
  // —— 五维 + HP/MP/移动（本稿钉死）——
  maxHp, curHp,
  maxMp, curMp,          // 新增；物理纯系恒 0（见 §1.5）
  atk,                   // 攻
  int,                   // 精
  def,                   // 防
  crit,                  // 爆（新；迁移期 = 旧 spd 值）
  morale,                // 士（新）
  mov,
  // 战场态 / 其它（与本稿无关，原样保留）
  pos, hasMoved, hasActed, alive, ai, skills, items, appearance, statuses, ...
}
```

> **退役字段 `spd`**：阶段2 完成后 Unit 上不再有 `spd`；其数值迁入 `crit`。阶段1 过渡期 `spd` 仍在（见 §2.2）。任何模块读 `spd` 都视为「读旧·待迁」标记。

### 1.4 GeneralDef.base（generals.js）最终形状

```js
base: { hp, mp, atk, int, def, crit, morale, mov }
//      ^现有: hp,atk,int,def,spd,mov →
//      新增 mp / crit / morale；spd 拆给 crit（见 §4 一次性重写口径）
```

### 1.5 MP（maxMp/curMp）规则（字段层；数值/档归 progression §4）

- **新增** `maxMp/curMp` 两字段。计略消耗 MP（取代设计早期「气力/次数」措辞，全稿统一 MP）。
- **物理纯系**（步兵/枪兵/骑兵/弓兵/弓骑兵，class-system §4 标「无计略」）：`maxMp` 恒 0，`curMp` 恒 0；UI 不显示 MP 条（ui-ux §2「物理纯系隐藏 MP」）。
- **缺字段兜底**：任何旧数据/旧存档缺 `maxMp` → 视为 0；缺 `curMp` → 视为 `maxMp`（满蓝）。
- `curMp` **关末回满**为 `maxMp`（intermission 行为）；存档可不存 `curMp`（重进按 maxMp 满），见 §5。

---

## 2. 唯一的旧→新 映射 + 两阶段迁移顺序

### 2.1 唯一映射表（任何稿引此表，不再自定义）

| 五维 | 旧 Unit 字段（现状） | 目标 Unit 字段 | 旧 base/growth 键 | 目标 base/growthGrade 键 | 处置 |
|---|---|---|---|---|---|
| 攻 | `atk` | `atk` | `atk` | `atk` | 原地保留 |
| 精 | `int` | `int` | `int` | `int` | 原地保留 |
| 防 | `def` | `def` | `def` | `def` | 原地保留 |
| 爆 | `spd` | `crit` | `spd` | `crit` | **重命名/拆分**：spd 数值迁入 crit |
| 士 | （无） | `morale` | （无） | `morale` | **新增**：填表给值 |
| HP | `maxHp/curHp` | `maxHp/curHp` | `hp` | `hp`（HP 档） | 原地保留 |
| MP | （无） | `maxMp/curMp` | （无） | `mp`（MP 档） | **新增** |
| 移动 | `mov` | `mov` | `mov` | `mov` | 原地保留 |

> 备忘（completeness-critic 一致性）：本稿确认现状代码确为 `atk/def/int/spd + maxHp`、无 `crit/morale/MP`、combat 命中式用 `spd`。本稿即解决该 5-STAT GATE。

### 2.2 阶段1 ·「先扩字段并兼容」（最小改动，零行为回归）

目标：**字段先到位、行为不变、单测口径不变**。

1. **Unit 扩字段**（battleController.makeUnit）：在产出 Unit 时**同时**写出 `crit/morale/maxMp/curMp`：
   - `crit = base.crit ?? base.spd ?? 0`（兜底：无 crit 用旧 spd）；
   - `morale = base.morale ?? 0`；
   - `maxMp = base.mp ?? 0`；`curMp = maxMp`；
   - **`spd` 仍保留并等于 `crit`**（`spd = crit`），供尚未切换的 combat 命中式继续用 → 行为完全不变。
2. **不动 combat 命中式**：阶段1 命中式仍读 `spd`（此时 `spd===crit`，等价）。
3. **不动 leveling 返回形状**：`gainExp` 仍返回 `gains:{hp,atk,def,int,spd}`（progression §9.2 已约定 spd 槽承载 crit 增量；本稿与之对齐）。阶段1 的 `crit/morale/MP` 成长可先不发（morale/MP 增量为 0），保持现有 leveling 单测全绿。
4. **数据可分批**：generals/classes 的 `crit/morale/mp` 列允许暂缺，由兜底补 0/沿用 spd。

> 阶段1 结束验收：所有现有单测（combat/leveling/battleController/duel…）**零修改全绿**；Unit 上肉眼可见 `crit/morale/maxMp/curMp` 四新字段；存档已升 v2（§5），旧 v1 档能载入。

### 2.3 阶段2 ·「再切公式与单测口径」（五维完备）

目标：命中式从 `spd` 切到 **爆/士**；leveling 发五维；数据按五维一次性重写；退役 `spd`。

**切换顺序（务必按此序，避免半切态 bug）**：

1. **数据先行**（§4 一次性重写）：generals/classes 全部填齐 `crit/morale/mp`（base）与 `growthGrade`（含 crit/morale/hp/mp 档）。此时 `spd` 数据列可删（base 不再出 spd）。
2. **makeUnit 去 spd**：不再写 `spd` 字段；`crit` 直接取 `base.crit`（不再 fallback spd）。
3. **combat 命中式切爆/士**（§3）：命中改读 `morale`(士)/`crit`(爆)，与 damage-preview「命中看爆/士差」对齐。**此步同时改 combat.test 口径**（命中相关用例从 spd 改 crit/morale；见 §6 矩阵 T-COMBAT）。
4. **leveling 发五维**：`gainExp` 返回 `gains:{hp,mp,atk,int,def,crit,morale}`；同步改 leveling.test 口径（§6 T-LEVEL）。
5. **duel 命中切士**：duel 的 retreat 成功率与命中目前用 `spd`（duel.js `(self.spd-foe.spd)*3`、attack 命中~90%）→ 改读 `morale`；改 duel.test 口径（§6 T-DUEL）。
6. **UI 五维**：hud `showUnit` / intermission `computeStats` 属性栏 `攻/防/智/速` → `攻/精/防/爆/士(+移)`，标签走 data（ui-ux §13，本稿仅声明时点=阶段2 step6）。
7. **退役 spd**：全代码库搜 `\.spd`，确认仅余 mov 相关/已迁；删 `spd` 概念。

> **「命中式切换的时点」= 阶段2 step3**，且必须与「combat.test 口径修改」同一提交（公式与测试同步切，避免预测=实际不自洽）。damage-preview 的 forecast 在此步后才接五维（forecast 复用 combat 纯核，自动跟随）。

---

## 3. combat 命中式：从 `spd` 切到 爆/士（时点与形状）

### 3.1 现状（combat.js strike）

```js
hit% = clamp(85 + (attacker.spd - defender.spd) - terrain.avoidBonus, 30, 100)
```

### 3.2 切换后（阶段2 step3；具体系数归 balance-master，本稿只定**读哪个字段**）

- **物理命中看 爆/士 差**（class-system §0「命中：物理看 爆/士 差」）：命中由攻方士气与守方爆/士共同决定。本稿钉死**字段口径**：
  - 命中项使用 `attacker.morale`（士=命中发挥）与 `defender.crit`/`defender.morale`（爆/士=回避）。
  - 形如 `hit% = clamp(BASE + k1*(atk.morale - def.morale) + k2*(... crit ...) - terrain.avoidBonus, LO, HI)`。
  - **`BASE/k1/k2/LO/HI` 的数值由 balance-master 定**；本稿只规定「命中读 morale/crit，不再读 spd」。
- **连击/会心** 由 `crit`(爆) 触发、**致命/必杀** 由 `morale`(士) 触发（class-system §0 / damage-preview「连击爆发差、致命士气差」）——本稿仅声明字段归属（爆→combo/crit，士→fatal/hit），概率公式归 balance-master。
- **计略命中看 精/士 差**（`int`/`morale`），同样字段口径在此钉死，数值归 balance-master。

> 切换原子性：combat 公式改 + combat.test 口径改 + forecast 自动跟随（forecast 复用 combat 纯核），**同一批提交**。这保证 damage-preview「预测=实际」不被半切态破坏。

---

## 4. generals / classes 数据一次性重写口径

阶段2 step1 的一次性 data 重写（与 progression §9.4 SABC 反推**协同**：progression 定档机制与反推映射，本稿定**字段落位与五维取值口径**）。

### 4.1 base 五维取值口径（填表心算规则）

- `atk/int/def` 保持现值（已是换算好的五维近似）。
- `crit`（爆）= 取现 `spd` 值为起点（敏捷/2 语义一致），按兵种微调（武术家/盗贼/弓兵爆偏高，谋士偏低）。
- `morale`（士）= **新填**：建议基线 `≈ round((atk+def)/2 * 0.5)` 量级起步，按人设微调（君主/名将士气高，杂兵低）；具体数值随 balance-master 数值表定稿，本稿只给量级指引。
- `mp`（base 起始 MP）：计略系给正值（君主/策士/道士/风水士），物理纯系 0（§1.5）。

### 4.2 growth → growthGrade（SABC 档）

- 删除旧固定 `growth:{hp,atk,def,int,spd}`，改 `growthGrade:{hp,mp,atk,int,def,crit,morale}`（progression §9.4 反推映射把旧固定增量→档）。
- `spd` 增量 → `crit` 档；新增 `morale`/`mp` 档（progression §4 校准建议：物理系 mp 档 C、morale 档按兵种；计略系 mp 档 A~S）。
- **兼容读取顺序**（progression §9.5，本稿确认沿用）：`def.growthGrade > 由旧 def.growth 反推 > CLASS.growthGrade > 全C`。允许分批重写不阻塞。

### 4.3 重写覆盖面（一次性）

- `data/classes.js`：所有兵种（infantry/spear/cavalry/archer/strategist/leader + 后续）补 `crit/morale` 成长档、`mp` 档、各 base 不在此（base 在 generals）。
- `data/generals.js`：所有 GENERALS 条目 `base` 补 `mp/crit/morale`、`growth`→`growthGrade`。
- 重写后跑 §6 量级回归（Lv50 总属性偏差 ±10% 内，progression §9.4）。

---

## 5. 存档 schema 版本治理（v1 → v2）

### 5.1 现状

`core/gameState.js`：`SAVE_PREFIX='save_caocao_v1_slot'`、`SAVE_VERSION=1`。roster 条目存 `{generalId, level, exp, items, skillsLearned, curHp}`。**注意**：存档**不存五维快照**，五维由 `statsAtLevel(def, level)` 重算 + `curHp` 覆盖（progression §9 / master §6）。这意味着**五维字段迁移本身不直接改存档结构**——但有三处必须治理：(a) `curMp` 关末满需不需要存；(b) 印绶转职后五维需存 `statSnapshot`（progression §6 待确认 6）；(c) 版本号与迁移函数。

### 5.2 v2 存档结构（钉死）

```js
const SAVE_VERSION = 2;          // 1 → 2
// SAVE_PREFIX 维持 'save_caocao_v1_slot'（key 前缀不动，避免丢档；版本走 snapshot.version 字段）

snapshot {
  version: 2,
  savedAt,
  chapter, battleIndex,
  roster: RosterEntryV2[],
  inventory, storyFlags, settings,
}

RosterEntryV2 {
  generalId, level, exp,
  items, skillsLearned,
  curHp,                  // null = 满血
  // —— v2 新增 ——
  curMp,                  // null = 满蓝（= maxMp）；物理系存 0/null 皆可
  classId,                // 转职后真实兵种（缺=GENERALS[id].classId）
  classTier,              // 1/2/3 转职阶（缺=1）
  statSnapshot,           // 可选：转职后固化五维 {maxHp,maxMp,atk,int,def,crit,morale} ;
                          //   缺=由 statsAtLevel(def,level) 重算（见 §5.5 决策）
}
```

> **key 前缀不变**：现有 key 已是 `save_caocao_v1_slot${n}`（字面含 v1 但只是命名）。**不改前缀**（改了会让玩家旧档「消失」）；版本判定一律读 `snapshot.version` 字段。本稿钉死：**前缀字面恒为 `save_caocao_v1_slot`，逻辑版本走 `version` 字段**。

### 5.3 迁移函数 `migrateSave(data)`（load 时调用）

```js
// core/saveMigrate.js（新；纯逻辑，可单测）
const SAVE_VERSION = 2;

export function migrateSave(data) {
  let v = (data && typeof data.version === 'number') ? data.version : 1;  // 缺 version 视为 v1
  let d = data;
  if (v < 2) { d = v1_to_v2(d); v = 2; }
  // 未来：if (v < 3) { d = v2_to_v3(d); v = 3; }
  if (v > SAVE_VERSION) d = downgradeFrom(d, v);   // §5.4 未来版本降级
  d.version = SAVE_VERSION;
  return d;
}

function v1_to_v2(d) {
  // v1 无 curMp/classId/classTier/statSnapshot → 用兜底补；其余原样
  const roster = (Array.isArray(d.roster) ? d.roster : []).map((e) => ({
    ...e,
    curMp: (typeof e.curMp === 'number') ? e.curMp : null,   // null=满蓝
    classId: e.classId ?? null,        // null → 载入时回退 GENERALS[id].classId
    classTier: (typeof e.classTier === 'number') ? e.classTier : 1,
    statSnapshot: e.statSnapshot ?? null,
  }));
  return { ...d, roster, version: 2 };
}
```

`game.load(slot)` 改：`data = migrateSave(JSON.parse(raw))` 后再 normalize。`normalizeRosterEntry` 扩展兜底新字段（见 §5.6）。

### 5.4 未来版本降级（向后兼容护栏）

- **场景**：玩家在新版存了 `version:3` 档，又回退到只懂 v2 的旧客户端 → 必须**不崩**。
- **策略**：`migrateSave` 见 `version > 本地 SAVE_VERSION` 时调 `downgradeFrom(d, v)`：
  - **保守降级**：剥离本地不认识的字段、保留 `generalId/level/exp/items/skillsLearned/curHp` 等核心可重算字段；toast 提示「存档来自更新版本，部分新内容已忽略」。
  - 决不静默丢弃整档；决不抛异常导致黑屏。核心进度（章节/等级/名册）必须存活。
- **写存档恒写当前 `SAVE_VERSION`**（不回写更高版本号）。

### 5.5 重算 vs 快照（决定 statSnapshot 是否必填）

承接 progression §6 / §9.6 待确认：

- **默认**：未转职武将 → 不存 `statSnapshot`，五维由 `statsAtLevel(def, level)` 重算（master §6 既定，最省存档）。
- **转职武将** → **必须**存 `statSnapshot`（固化转职跃升 + 档变化，避免重算路径分叉，progression §6 推荐）。
- 缺字段兜底：`statSnapshot` 缺 → 重算；存在 → 直接用并以 `curHp`/`curMp` 覆盖当前血蓝。
- 本稿钉死：**「转职 → 存快照」是字段层硬约束**（promotion.js 写存档时必写 statSnapshot）。

### 5.6 缺字段兜底（v2 normalize 总表）

| 字段 | 缺失/异常时 |
|---|---|
| `version` | 缺 → 视为 1 → 走 v1_to_v2 |
| `curHp` | 非 number → null（载入战斗由 maxHp 补满） |
| `curMp` | 非 number → null（→ maxMp 满蓝） |
| `classId` | 缺/null → `GENERALS[generalId].classId` |
| `classTier` | 非 number → 1 |
| `statSnapshot` | 缺/null → 重算（statsAtLevel） |
| `maxMp`（Unit 层） | 缺 → 0（物理系） |
| `crit/morale`（Unit 层，旧逻辑产物） | 缺 → crit 用旧 spd 兜底、morale → 0（仅阶段1 过渡，阶段2 后数据齐不触发） |
| 整档 JSON 损坏 | listSaves 标 `corrupt:true`；load 返回 false（现状行为保留） |

---

## 6. 迁移测试矩阵

| ID | 测试 | 阶段 | 断言要点 |
|---|---|---|---|
| **T-SAVE-1** | `migrateSave` v1→v2 | 1 | v1 档（无新字段）迁后 roster 项含 `curMp:null/classId:null/classTier:1/statSnapshot:null`；核心字段不变 |
| **T-SAVE-2** | v2 往返 | 1 | save→load 后 roster 五维相关字段一致；`version===2` |
| **T-SAVE-3** | 缺 version 兜底 | 1 | `{roster:[...]}`（无 version）按 v1 迁移成功，不抛 |
| **T-SAVE-4** | 未来版本降级 | 1 | `version:99` 档 load 不崩、保留核心进度、剥离未知字段、回写 version=2 |
| **T-SAVE-5** | 损坏档 | 1 | 坏 JSON → load false、listSaves 标 corrupt（现状回归） |
| **T-SAVE-6** | 转职快照 | 2 | 转职后存档含 `statSnapshot`；重进直接读快照而非重算（值一致） |
| **T-UNIT-1** | makeUnit 五维齐 | 1 | 产出 Unit 必有 `crit/morale/maxMp/curMp`；物理系 maxMp===0 |
| **T-UNIT-2** | 阶段1 spd===crit | 1 | 过渡期 `unit.spd===unit.crit`（命中式等价、零回归） |
| **T-COMBAT** | 命中式切爆/士 | 2 | 命中读 morale/crit（非 spd）；连击由 crit、致命由 morale；combat.test 用例口径同步改 |
| **T-LEVEL** | gainExp 发五维 | 2 | `gains` 形状 `{hp,mp,atk,int,def,crit,morale}`；leveling.test 口径同步改 |
| **T-DUEL** | duel 命中切士 | 2 | retreat/命中读 morale；duel.test 口径同步改 |
| **T-RECALC** | 重算一致 | 2 | `statsAtLevel(def,L)` 与逐级 gainExp 五维结果一致（progression 单一来源） |
| **T-SCALE** | 量级回归 | 2 | 重写后 Lv50 总属性 vs 旧体系偏差 ≤±10%（progression §9.4） |
| **T-COMPAT** | 旧 growth 兼容 | 1→2 | 未重写武将按 `growth` 反推档仍可跑（progression §9.5 优先级） |

> 测试落 `games/caocao-zhuan/tests/`：新增 `saveMigrate.test.mjs`（T-SAVE-*）；扩 `leveling.test.mjs`（T-LEVEL）、`combat.test.mjs`（T-COMBAT）、`duel.test.mjs`（T-DUEL）；progression 单测（T-RECALC/T-SCALE/T-COMPAT）归 progression 稿的 `progression.test`。

---

## 7. 模块触点（build-ready 清单）

| 模块 | 阶段1 | 阶段2 |
|---|---|---|
| `battle/battleController.js`（makeUnit） | 产出 Unit 写 `crit/morale/maxMp/curMp`（兜底）；`spd=crit` | 去 spd；`crit=base.crit` 直取 |
| `battle/combat.js`（strike 命中式） | 不动（读 spd，==crit） | 命中读 morale/crit；连击/致命字段归属（数值见 balance-master） |
| `battle/leveling.js`（gainExp） | 形状不变（spd 槽放 crit 增量，progression §9.2） | 返回 `{hp,mp,atk,int,def,crit,morale}` |
| `battle/duel.js` | 不动 | 命中/retreat 读 morale |
| `battle/promotion.js`（新，class/item/progression 已规划） | — | 转职写存档 `statSnapshot/classId/classTier`（§5.5 硬约束） |
| `data/classes.js` | 可暂缺新档（兜底） | `growthGrade` 补 crit/morale/mp 档 |
| `data/generals.js` | 可暂缺（兜底） | base 补 `mp/crit/morale`；`growth`→`growthGrade`；删 spd |
| `core/gameState.js` | `SAVE_VERSION=2`；load 调 migrateSave；normalize 扩兜底 | — |
| `core/saveMigrate.js`（新） | `migrateSave`/`v1_to_v2`/`downgradeFrom` | 追加 `v2_to_v3` 占位 |
| `ui/hud.js`（showUnit）/`ui/intermission.js`（computeStats） | 不动 | 属性栏 `攻/防/智/速`→`攻/精/防/爆/士+移`；MP 条（物理系隐藏）；标签走 data（ui-ux §13） |
| `battle/forecast.js`（damage-preview） | — | 复用 combat 纯核，自动跟随五维（damage-preview） |

---

## 8. 待确认

1. **字段命名复核**：精=`int`、爆=`crit`、士=`morale`（保留 atk/int/def 不 rename）是否最终拍板？（备选：把 int 改名 `spi` 更直观，但需全库 rename，本稿不推荐。）
2. **morale 基线数值**：base.morale 起始量级谁定——本稿给「≈(atk+def)/2×0.5」量级指引，确切值待 balance-master 数值表。
3. **curMp 是否进存档**：本稿默认存（带蓝量进度）；若一律「关末满、关内不跨档」则可不存（重进按 maxMp）。倾向：**存**（与 curHp 对称）。
4. **statSnapshot 范围**：仅转职武将必存（本稿决策）vs 全员存满五维（更省重算、存档略大）？本稿选前者。
5. **命中式切换批次**：combat 命中切爆/士 + combat.test 改口径是否与 leveling/duel 切换**同一 PR**（推荐，避免半切态预测不自洽），还是按 §2.3 序分多 PR（每 PR 自洽）？
6. **key 前缀**：维持字面 `save_caocao_v1_slot`（推荐，保旧档）vs 借迁移机会改为 `save_caocao_slot`（需把旧 key 数据搬迁，多一步风险）？本稿选维持。
7. **降级提示**：未来版本降级是否需要 UI 二次确认（「此档来自更新版本，继续将忽略新内容」）还是静默 toast？

---

> 引用约定：其它稿凡涉字段名/Unit 形状/旧→新映射/迁移顺序/命中式切换时点/存档版本与迁移函数/缺字段兜底——一律「见 stat-migration」，不再复述。class-system §0 仍是五维**含义**权威，balance-master 仍是**数值/倍率链**权威，本稿是**字段与迁移**权威。
