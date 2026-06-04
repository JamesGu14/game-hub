# 《群雄逐鹿·孟德篇》content-pipeline — 设计稿（待审）

> 原创致敬作。沿用原版《三国志曹操传》式 SRPG 的**内容/引擎分离结构惯例**（事实性设定）+ 公有领域三国题材；
> 所有 schema 字段名、校验规则、谓词命名、步类型语义均为本作自定，**不照搬任何商业游戏的数据表/脚本/文案**。
> 与设计语料一致：复用 5 维 **攻/精/防/爆/士** + MP、11 系职业、计略 `kind`、天气 `require/blockedIn/powerMod`、
> footprint、道具 3 槽、印绶转职、`faction`、`storyFlags`、`STORY{intro,outro,scenarios,triggers}`、`CHNN{battles:[{map,story,joinsAfter?}]}`。
> 状态：**待 James 审阅**。

- **日期**：2026-06-04 · **作者**：James（顾嘉晟）+ Claude · **项目**：game-hub / `games/caocao-zhuan/`
- **范围**：内容创作管线 + 数据校验 + 跨系统契约统一。本稿是**总线 / 契约层**，把 14 篇姊妹稿散落的数据形状、谓词、剧本步**汇成单一权威目录**，并定义启动/CI 期的数据校验脚本与文案集中约束。
- **定位**：设计稿（非实现）。本稿**不重新定义**别稿已经拥有权威的数值/公式/平衡（那些指向对应权威稿）；本稿只统一「**契约形状 + 引用完整性 + 共享库的唯一出处**」。
- **本稿要消解的跨稿冲突（见 §0）**：5 维属性迁移引用、谓词三处重叠、scenarioRunner 步类型分散登记、`victory.rout` 含 ally bug、客将 `guest` 字段化。

---

## 0. 权威指向表（single source of truth — 本稿不抢别稿的权威）

为避免「同一件事三处各写一份、实现期打架」，先钉死**每件事的唯一权威稿**。本稿其余章节凡引用这些，一律**指针引用、不复制数值**。

| 主题 | 唯一权威 | content-pipeline 的角色 |
|---|---|---|
| **5 维属性字段模型**（攻/精/防/爆/士 + maxMp/curMp，由旧 atk/def/int/spd 迁移） | **stat-migration 稿**（字段模型权威） | §1 schema 目录里**引用**其字段名；data-validate 校验「字段齐全/范围」，但字段语义以 stat-migration 为准 |
| **难度系数表**（easy/normal/hard 的 lv/atk/def/hp/aiAggression…） | **balance-master 稿**（唯一难度权威） | campaign-structure §6.1、enemy-ai §7.1 的两份 `DIFFICULTY` 表**合并指向 balance-master**；data-validate 只校验「difficulty 枚举值合法」 |
| **伤害乘子链与钳制**（triangle × terrainAtk × weatherAtk × affinityDef × formation × bossRage + clamp） | **balance-master 稿**（唯一公式权威） | 本稿不写公式；只在 schema 里登记参与乘子的字段来源（terrain.defBonus / weather.powerMod / affinity / formation / boss.enrage） |
| **伤害预测干跑**（predictAttack/predictSkill 纯函数） | **damage-preview 稿**（forecast 权威） | AI(§enemy-ai §8)、本稿谓词 `canKillThisTurn` 都复用 forecast；本稿只登记其签名 |
| **职业/印绶/转职树** | **class-system 稿** | §1 schema 引用 `promoteTo`、`seal` Lv15/30 |
| **道具/宝物/消耗品** | **item-system 稿（已定稿）** | §1 schema 直接采用其 `Item` 形状 |
| **经济/商店** | **economy-shop 稿** | §1 schema 采用其 `shop.js` / `ECON` / `money` 形状 |
| **叙事倾向/路由/达成** | **narrative-branching 稿** | §3 谓词库收纳其 `when` 判据；§4 步目录登记 `branch`；本稿提供**它们共用的谓词实现** |
| **敌方 AI / boss / 援军 / 撤退** | **enemy-ai 稿** | §3 谓词库供 AI 复用；§4 步目录登记 `spawnWave/setBossPhase/retreat` |
| **招募/客将/友军** | **recruitment-allies 稿** | §1 schema 登记 `guest/recruit/allies`；§3 谓词收纳 `escort/protect`；§4 登记 `recruit/leave` |
| **天气** | **weather-system 稿** | §1 schema 登记 `map.weather` + SkillDef.weather；§4 登记 `setWeather` |

> **一句话**：本稿是"目录与海关"，不是"立法者"。它保证 14 套数据**形状自洽、互相能引用得上**，并把三处重复的东西（谓词/步/难度）**收口到一份共享实现**。

---

## 1. 数据 Schema 总目录（全字段，按文件）

> 约定：`?` = 可选字段（缺省安全默认）；`[]` = 数组；`{}` = 对象映射 `{[id]: Def}`。
> **坐标**：`c`=列(0-based)、`r`=行(0-based)，`tiles[r][c]`（与现有 map 一致）。
> **5 维迁移注记**：下表凡出现 `atk/def/int/spd` 处，**stat-migration 稿**将其迁移为 `攻(atk)/精(int→精)/防(def)/爆(crit)/士(morale)` + `maxMp/curMp`，`spd` 并入命中/行动序衍生。本目录**保留现字段名占位**并在每处标注 `→5维`，迁移完成后由 stat-migration 统一改名，data-validate 同步切换校验集（见 §2.6）。

### 1.1 `data/classes.js` — 兵种（11 系；现 6 系已实装）

```
CLASSES = { [classId]: {
  id, name,
  moveType: 'foot'|'horse'|'fly'?,            // fly 后续兵种(器械/象?)预留
  atkRange:[min,max], counterRange:[min,max], // 曼哈顿；[0,0]=空区间(弓无近战反击)
  attackShape?: 'cross'|'star'|'diamond'|'area',  // footprint(enemy-ai/affinity 用)；缺省按 atkRange 推
  growth:{ hp, atk, def, int, spd },          // →5维：{ hp, atk, int, def, crit, morale, mp }
  skills:[skillId...], promoteTo:[classId...], // promoteTo 权威=class-system
} }
```
- 现有 6 系 id：`infantry/spear/cavalry/archer/strategist/leader`；进阶 id：`guard_elite/spear_elite/cavalry_elite/crossbow/grand_strategist/lord`。
- 11 系完整目录以 **class-system 稿**为权威；本稿只要求 data-validate 校验「`promoteTo`/`skills` 引用存在、`learnableBy` 双向自洽」。

### 1.2 `data/skills.js` — 计略

```
SKILLS = { [skillId]: {
  id, name,
  kind:'damage'|'heal'|'buff'|'debuff'|'control',
  target:'enemy'|'ally'|'self'|'tile',
  range:[min,max], area:0,                    // 施法距离 / AOE 曼哈顿半径
  uses:3,                                       // 每战次数(MP 制后→ mpCost，见 stat-migration；过渡期二者并存)
  mpCost?:0,                                     // →5维：MP 消耗(stat-migration 接入后启用)
  power:0, hit:'always'|'intDiff',             // intDiff→精差(stat-migration 改名后为 'intDiff'/'morale' 衍生)
  element:null|'fire'|'thunder'|'water'|'dark',
  status:null|{ type, turns, magnitude },      // statuses.js 状态机
  weather?:{ require:[w...], blockedIn:[w...], powerMod:{[w]:mul}, weatherImmune?:bool },  // 权威=weather-system
  learnableBy:[classId...],
} }
```
- 状态 `type` 全集（statuses.js）：`poison/confuse/immobilize/atk_up/atk_down/def_up/def_down/spd_up`（→5维后增 `crit_up/morale_up/...`）。
- data-validate：`learnableBy` 的 classId 必须存在；`status.type` 必须在状态全集内；`weather.require/blockedIn` 必须是合法天气枚举。

### 1.3 `data/terrain.js` — 地形

```
TERRAIN = { [terrainId]: {
  id, name,
  moveCost:{ foot, horse, fly? },             // 进入消耗(按 unit.moveType 取)
  defBonus, avoidBonus,                         // 守方防御加成 / 回避(命中扣减)
  passable:bool, capture?:bool,                 // capture=据点(gate)可占领
  weatherMoveMod?:{ [weather]:+n },             // 雨雪泥泞移动+成本(权威=weather-system)
} }
```
- 现有 id：`grass/road/forest/hill/mountain/water/gate`。新增地形（泥/城内/舟船/雪原…）随对应章 spec 追加，**加地形=改本文件，不改引擎**。

### 1.4 `data/affinity.js` — 相性（terrain-affinity 稿）

```
// 兵种×地形 适性(走位/防御加成系数)；以 terrain-affinity 稿为权威
AFFINITY = { [classId]: { [terrainId]: { atkMul?, defMul?, moveMod? } } }   // 缺省 ×1 / +0
```
- data-validate：所有 `classId`/`terrainId` 键必须存在于 §1.1/§1.3。乘子参与 §0 的伤害链（terrainAtk/affinityDef 位），公式权威=balance-master。

### 1.5 `data/formations.js` — 阵型（阵型加成）

```
FORMATIONS = { [formationId]: {
  id, name, desc?,
  mods:{ atk?, def?, mov?, avoid? },           // 全体乘/加成(参与 §0 乘子链 formation 位)
  requires?:{ minUnits?, classMix? },          // 解锁条件(可选)
} }
```
- 阵型 id 示意：`yulin(鱼鳞)/fengshi(锋矢)/yanxing(雁行)/changshe(长蛇)`。具体加成数值权威=balance-master；本稿只锁形状。

### 1.6 `data/generals.js` — 武将静态档案

```
GENERALS = { [generalId]: {
  id, name, title,
  faction:'wei'|'foe'|'ally'|'npc',
  classId,
  base:{ hp, atk, def, int, spd, mov },        // →5维：{ hp, mp, atk, int, def, crit, morale, mov }
  growth:{ hp, atk, def, int, spd },           // 覆盖兵种 growth；→5维同上
  skills:[skillId...], items:[itemId...],
  ai:null | 'reckless'|'cautious'|'strategist'|'guard'   // 玩家方 null；可升级为对象(见 §1.8 enemy-ai)
     | { persona, ...aiConfig },
  recruit?:{ type:'story'|'condition'|'branch'|'hire', ... },  // 权威=recruitment-allies §3
  appearance:{ armor, accent, skin, helmet, weapon, mount, scale,
               banner:{char,color}, portraitSeed, kind?:'civilian'|'cart' },
} }
```
- **客将 `guest` 不写在 GeneralDef**，而在 `map.deploy[].guest:true`（关卡限定，见 §1.7）——这是 recruitment-allies 的约定，本稿据此让 data-validate 检查「`map.deploy[].guest` 单位有 def 且 faction='wei'」。
- 现名册（ch01）：wei `caocao/xiahoudun/xiahouyuan/caoren/caohong/xunyu/xizhicai/dianwei` + 客将 `liubei/guanyu/zhangfei`；foe 黄巾/西凉/董卓系含 `lubu/huaxiong/xurong/dongzhuo/lijru/...`。

### 1.7 `data/chapters/chNN/*.map.js` — 战役地图（全字段）

```
MAP = {
  id, name, cols, rows,
  tiles: [[terrainId × cols] × rows],          // tiles[r][c]
  weather?: 'sun'|'rain'|'snow'|'fog'|'cloudy',// 初始天气(缺省 'sun')；权威=weather-system
  formationAllowed?: [formationId...],          // 本战可选阵型(缺省全部)
  deploy: [ { generalId, c, r,
              guest?:true, level?, exp?, skills?:[], items?:[] } ],  // wei；guest 用条目自带强度(忽略 roster 覆盖)
  enemies: [ { generalId, c, r,
               ai?: persona | aiConfigObj,      // 权威=enemy-ai §1
               level?, boss?:{...}, guardCell?, leashCell?, escortId?, hatred?, fleeBelowHpPct?,... } ],  // foe
  allies?: [ { generalId, c, r, faction:'ally'|'npc',
               ai?: persona|'escort'|'hold', escort?:{ to:{c,r}, speed?, fight? } } ],  // 权威=recruitment-allies §3
  reinforcements?: [ ReinforceWave ],           // 援军波次；权威=enemy-ai §3(形状见 §1.8)
  victory: VictoryCond, defeat: DefeatCond,     // 类型见 §3(谓词库统一)
  achievements?: [ { id, when:Predicate, setFlag:{...} } ],  // 战后达成→flag；权威=narrative-branching §3.2
  introScenario: scenarioId, outroScenario: scenarioId,
  triggers?: [ Trigger ],                        // 战中触发(见 §1.7.1)；注：现引擎读 map.triggers，story.triggers 由 main.js 合并
}
```

#### 1.7.1 `Trigger` / `ReinforceWave`（战中事件形状）

```
Trigger = {
  on:'turnStart'|'unitDied'|'reached'|'captured'|'flag'|'bossPhase',  // 现仅 turnStart 实装；其余 narrative/enemy-ai 扩
  turn?, generalId?, c?, r?, by?, flag?, bossId?, phaseIndex?,        // 按 on 取用(见 §3 谓词)
  scenarioId?,                                                        // 命中→播此剧本
  setFlag?:{...},                                                     // 命中→归并写 storyFlags(lean 累加,见 narrative)
  retreat?:[generalId...],                                            // 命中→令这些 foe 撤退(enemy-ai §4.2)
}

ReinforceWave = {                                                     // 权威=enemy-ai §3.1
  id, on:'turnStart'|'flag'|'bossPhase'|'summon'|'survive',
  turn?, flag?, bossId?, phaseIndex?, every?,
  side:'foe'|'wei', units:[{ generalId, c, r, ai?, level? }],
  spawnGuard:'edgeOnly'|'nearestFree'|'skip', once?:true,
  actThisTurn?:false, say?:scenarioId, cinematic?:{focus,zoom},
}
```

### 1.8 `data/chapters/chNN/*.story.js` — 战役剧本

```
STORY = {
  intro:  { id, steps:[ Step ] },
  outro:  { id, steps:[ Step ] },
  scenarios?: { [scenarioId]: { id, steps:[ Step ] } },  // 触发器/显式播放的临场小演出
  triggers?: [ Trigger ],                                 // 见 §1.7.1(main.js 合并进 map.triggers)
  chapterIntro?: { id, steps:[ Step ] },                  // 章级开场(campaign-structure §3.1，可选)
}
```
- `Step` 类型全集 = **§4 权威步目录**。

### 1.9 `data/chapters/chNN/index.js` — 章节清单

```
CHNN = {
  id, index?, name, subtitle?,
  battles: [ BattleEntry ],
  recommendedLevel?, carryGuests?:false, endingBranch?:false,   // campaign-structure §2
}

// BattleEntry 两种写法(向后兼容)：
//  A) 固定战(现状)： { map, story, joinsAfter?:[generalId...] }
//  B) 变体战(按 track)： { id, joinsAfter?, variants:{ default:{map,story}, righteous?:{...}, hegemon?:{...} },
//                        appearsWhen?:{ trackIn:[...] } }   // 权威=narrative-branching §5.1
```

### 1.10 `data/chapters/chNN/shop.js` — 关间商店（economy-shop 稿）

```
SHOP_CHNN = {
  consumables:[ { itemId, unlockBattle? } ],
  equipment:[ { itemId, unlockBattle? } ],
  seals?:{ price, stock },                       // 限量(shopState 记已购)
}
// 经济常量(ECON/PRICE)与纯函数(baseReward/priceOf/sellPrice/...)在 data/economy.js；权威=economy-shop
```

### 1.11 `data/items.js` — 道具（item-system 稿，已定稿）

```
Item = { id, name,
  slot:'weapon'|'armor'|'accessory', kind?:'equip'|'consumable'|'seal'|'treasure',
  classes:[classId...],                          // 兵种限制(空=通用)
  stats:{ atk?,def?,int?,spd?,mov?,hp?,mp? },     // →5维同步改名
  special?:'effectId', tier?, price?,
  use?:'healHp'|'healMp'|'cure'|'buff'|...,        // consumable 行为
}
```

### 1.12 章节注册表 `data/chapters/registry.js`（campaign-structure §8）

```
export const CHAPTERS = [ CH01, /* CH02… */ ];   // 按序；byId/byIndex 查询；加章=push 一条
```

### 1.13 难度 / AI 调参表（指针——**不在本稿定值**）

`data/difficulty.js`（campaign-structure §6.1）与 `data/aiTuning.js`（enemy-ai §7.1）当前**各写了一份 `DIFFICULTY`**。
→ **本稿裁定**：二者合并为**单一 `data/balance.js`（balance-master 稿权威）**导出的难度块，campaign 与 ai 都从它 import；保留各自模块只作"取用层"（re-export 或薄封装），避免两份表漂移。data-validate 校验「只有一处定义 DIFFICULTY 原值」。

---

## 2. `data-validate` 脚本规范（启动期 + CI 校验）

新建 `games/caocao-zhuan/tools/validate-content.mjs`（纯 Node ESM，import 各 `data/*` 真实模块跑断言；无第三方依赖；可被 `npm test` 与 CI 调用，也可在 dev 启动时 `?validate=1` 触发轻量版）。**只读不写**，输出人类可读的错误清单（文件:位置 + 原因），有任一 error 则进程退出码非 0。

### 2.1 设计原则
- **引用即真理**：所有跨模块 id（itemId/generalId/skillId/classId/terrainId/scenarioId/formationId）必须解析得到。断链是最常见的内容 bug，必须在加载/CI 期挡住。
- **分级**：`error`（断链/越界/不可达=必挂）vs `warn`（可疑但不致命：孤儿定义、空 deploy、未引用 scenario）。
- **可在浏览器降级**：dev 模式 `import` 同一份校验函数，跑 `error` 子集（不做磁盘遍历），把结果打到 console + 一个 HUD 角标"内容校验：N 错 M 警"。
- **确定性**：纯逻辑、不掷随机；同输入同结论，便于单测自身。

### 2.2 引用完整性校验（error）
| 检查 | 规则 |
|---|---|
| classId | `generals[].classId`、`skills[].learnableBy[]`、`classes[].promoteTo[]`、`affinity` 键、`items[].classes[]` 全部 ∈ `CLASSES` |
| skillId | `generals[].skills[]`、`classes[].skills[]`、`SKILLS[].id` 自洽；`learnableBy` 双向（武将持有的计略其职业须 `learnableBy` 列出，否则 warn） |
| itemId | `generals[].items[]`、`map.deploy[].items[]`、`shop.*[].itemId`、`achievements/lootItems` 引用 ∈ `ITEMS` |
| generalId | `map.deploy/enemies/allies[].generalId`、`reinforcements.units[].generalId`、`joinsAfter[]`、`recruit` 引用、`boss.guards[]`、`escortId`、`hatred.assassinId` ∈ `GENERALS` |
| terrainId | `map.tiles[r][c]` 每格 ∈ `TERRAIN`；`affinity` 键 ∈ `TERRAIN` |
| scenarioId | `map.introScenario/outroScenario`、`trigger.scenarioId`、`wave.say`、`boss.phases[].onEnter.say` 能在对应 `story`（intro/outro/scenarios/chapterIntro）中 `resolve` 到 |
| formationId | `map.formationAllowed[]`、`deploy` 默认阵型 ∈ `FORMATIONS` |
| difficulty | `settings.difficulty`、难度键 ∈ `{easy,normal,hard}` |
| weather | `map.weather`、`skill.weather.require/blockedIn[]` ∈ `{sun,rain,snow,fog,cloudy}` |

### 2.3 地图维度与坐标（error）
- `tiles.length === rows`，每行 `tiles[r].length === cols`。
- 所有 `c,r`（deploy/enemies/allies/reinforcements/trigger/victory.capture/escort.to/cinematic.focus）满足 `0<=c<cols && 0<=r<rows`。
- **无单位重叠初始格**：deploy ∪ enemies ∪ allies 的 `(c,r)` 互不相同（reinforcements 例外，落点冲突由 `spawnGuard` 运行期处理，但仍校验在界内）。

### 2.4 部署/敌人**可达且非阻挡**（error）
- 每个 deploy/enemy/ally 初始格的 `TERRAIN[tiles[r][c]].passable === true`（不能把单位放进 `water` 等不可通行格）。
- **连通性**：以全体 deploy 格为源做一次 BFS（按 `foot` 的 moveCost>0 且 `passable` 邻接，仅四邻），要求**至少能到达**：① 所有 enemy 初始格的某个相邻可攻击位（即敌人非完全被 `water`/`mountain(horse99)` 围死到玩家永远打不到——用 foot 可达性近似，warn 级，避免误报高消耗山地）；② `victory` 需要到达的格（capture 据点、escort.to、reached 目标）必须从 deploy 区 foot 可达（error）。
- 阻挡：若某 enemy 被不可通行地形完全包围导致 `rout`/`defeatLeader` 永不可达 → error。

### 2.5 route / 战役链自洽（error/warn）
- **CHNN.battles**：A 型 `{map,story}` 与 B 型 `{variants}` 结构合法；B 型必须有 `variants.default`（兜底，error）。
- `joinsAfter[]` 的 generalId 在该战**之前不应已在固定 deploy 常驻**（warn：重复入队）。
- `appearsWhen.trackIn[]` 的 track ∈ `{pragmatic,righteous,hegemon}`（narrative §1）。
- **章链**：`registry.CHAPTERS` 的 `id` 唯一、`index` 连续（warn 若跳号）；每章 `battles` 非空；`map.introScenario===story.intro.id`、`outroScenario===story.outro.id` 对得上（error，最易错）。
- **scenario 闭包**：`branch.cases[*]` / `choice.options[].setFlag` 引用的后续条件不悬空（弱校验，warn）。

### 2.6 5 维迁移门（过渡期专用，error→迁移完成后切换）
- 校验脚本带一个 **`STAT_MODEL` 开关**（读 stat-migration 暴露的常量）：
  - `legacy4`（现状）：要求 `base/growth` 含 `{hp,atk,def,int,spd}` + `mov`。
  - `five`（迁移后）：要求 `{hp,mp,atk,int,def,crit,morale}` + `mov` + 计略 `mpCost`。
- 切换由 stat-migration 落地时翻开关；本脚本对两套字段集分别有断言，**保证迁移期不出现半套字段的脏数据**。这是 §0「stat-migration 为字段权威」的执行点。

### 2.7 输出与接入
- `node tools/validate-content.mjs` → 打印 `✓ 通过 / ✗ N errors, M warnings`，error>0 退出码 1。
- `tests/` 增 `content.validate.test`：对 ch01 全量数据跑校验，断言 0 error（回归网，防止后续加章/改数据时悄悄断链）。
- CI（若有）在测试前跑一次；dev 在 `main.js` boot 时（`location.search` 含 `validate`）跑 error 子集。

---

## 3. 统一「战场谓词库」`battle/predicates.js`（victory / achievements / ai 共用）★本稿核心

**问题**：`victory.js`（rout/defeatLeader/survive/capture）、narrative-branching（foeFled/allyAlive/clearedByTurn/weiCasualties/reached/captured/all/any）、recruitment（escort/protect/protectAny）、enemy-ai（canKillThisTurn 等 AI 判定）**各自写了一套战场判据**，语义重叠、措辞不一、容易漂移。

**裁定**：新建 `battle/predicates.js` —— **唯一的战场谓词实现**，三处全部 import 它，不再各写。纯逻辑（不 import three / 不碰 DOM / 可单测）。

### 3.1 统一上下文 `PredCtx`（谓词的唯一输入）

```js
// 所有谓词只读这个 ctx；由 victory/achievements/ai 各自包好后传入。
PredCtx = {
  units,          // Unit[]（含 faction/alive/curHp/maxHp/pos/id/guest）
  turn,           // 当前回合
  map,            // {cols,rows,tiles,victory,defeat,...}
  log?,           // 事件日志(达成判据用)：[{ t:'unitDied'|'fled'|'captured'|'reached', unitId, c?,r?, byId? }]
  forecast?,      // damage-preview 的 predictAttack/predictSkill(AI 击杀判定复用；缺省退化 estimateDamage)
}
```

### 3.2 阵营关系（先统一这一条，消解 `victory.rout` 含 ally 的 bug）

```js
// recruitment-allies §5.3 的 isHostile 收口到这里——victory/ai/combat/skillEngine 全走它。
export const FRIENDLY = { wei:['wei','ally','npc','guest'], ally:['wei','ally','npc'], npc:['wei','ally','npc'], foe:['foe'] };
export function isHostile(a, b)          // 敌对(wei↔foe / ally↔foe / npc↔foe)；同侧/友侧=false
export function isAlive(u)               // u && u.alive!==false && (curHp===undefined||curHp>0)
export function factionOf(u)             // guest 归 'wei'(共享胜负)，但 unit.guest 标记保留
export function livingOf(ctx, faction)   // 某阵营存活单位
export function enemiesOf(unit, ctx)     // unit 视角的敌对存活单位(foe 看 wei+ally+npc；wei/ally 看 foe)
```

> **现 `victory.rout` 修正**（语料明确的 bug）：当前数「所有非 wei 死亡」，有 ally/npc 时永不达成。**改为数 `foe`**：`rout = livingOf(ctx,'foe').length===0 && everHadFoe`。本稿把它实现在谓词库的 `routCleared(ctx)`，victory.js 调用之，**一处修复，三处受益**。

### 3.3 谓词全集（命名 = 跨稿统一口径）

**A. 胜负类（victory.js / recruitment §6 用）**——每个返回 bool，输入 `ctx`：

```js
routCleared(ctx)                         // 所有 foe 死亡(修正版，§3.2)
leaderDead(ctx, generalId)               // 指定单位阵亡
survivedTo(ctx, turns)                   // turn >= turns
captured(ctx, { faction='wei', site? })  // 某 faction 存活单位站在 capture 地形(或指定 siteId)上
escortArrived(ctx, { generalId, to })    // 该 npc 存活且 pos==to
protectFailed(ctx, { generalId?, faction? })  // 指定单位/阵营全灭(败北用)
weiWiped(ctx)                            // wei(含 guest) 全灭(败北兜底)
```

**B. 达成/分支类（narrative §3.2 `when` 判据 / achievements 用）**——返回 bool，多读 `ctx.log`：

```js
foeFled(ctx, generalId)                  // 该 foe 在 log 里有 'fled'(退场而非斩杀)
foeAlive(ctx, generalId) / foeKilledBy(ctx, generalId, byId)
allyAlive(ctx, generalId) / allyDead(ctx, generalId)
clearedByTurn(ctx, n)                    // 胜利达成 且 turn<=n(速通)
weiCasualties(ctx, maxN)                 // wei 阵亡数 <= maxN(默认 0=无伤)
reached(ctx, { c, r, by? })              // 某(可指定 by=generalId) wei 到达过(c,r)
capturedSite(ctx, siteId)                // 占领某据点
```

**C. AI 判定类（enemy-ai §5/§8 用，纯函数复用 forecast）**：

```js
canKillThisTurn(ctx, attacker, defender) // 有 forecast 用 willKill；否则退化 estimateDamage(保 fallback)
willCounter(ctx, attacker, defender)     // 守方是否会反击(counterRange + 存活)
incomingThreat(ctx, unit, atCell)        // 站在 atCell 会被多少敌对单位打到(风险评分)
targetValue(unit)                        // 价值目标权重(君主1.0/谋士0.8/弓0.6/炮0.7/其余0.2)，enemy-ai §5.3
```

**D. 组合子（复合条件，narrative `all/any` + victory 复合）**：

```js
allOf(ctx, conds[])  /  anyOf(ctx, conds[])   // conds 是 {pred:'foeFled', args:{...}} 描述对象(数据驱动)
evalCond(ctx, cond)                            // 把数据里的 {type:'rout'} / {when:{foeFled:'huaxiong'}} 解析到上面函数
```

### 3.4 数据→谓词的解析约定（让 victory/achievements 的数据形状收敛到一个 evaluator）

```js
// victory/defeat 数据形状(统一)：
{ type:'rout' }
{ type:'defeatLeader', generalId }
{ type:'survive', turns }
{ type:'capture', faction?, site? }
{ type:'escort', generalId, to:{c,r} }       // 胜
{ type:'protect', generalId? , faction? }    // 败(放 defeat)
{ all:[ cond, ... ] } / { any:[ cond, ... ] }

// achievements.when 数据形状(narrative §3.2，键名=谓词名)：
{ foeFled:'huaxiong' } | { allyAlive:'sunjian' } | { clearedByTurn:6 } | { weiCasualties:0 }
| { reached:{c,r,by?} } | { captured:'gate_main' } | { all:[...] } | { any:[...] }
```
- `evalCond(ctx, cond)` 把上述任一形状派发到 §3.3 的对应函数。victory.js 的 `evaluate(state)` 重写为：先 `protectFailed/weiWiped`（lose 兜底），再 `evalCond(ctx, map.victory)`，否则 null——**判定顺序"先 lose 再 win"不变**。
- `battle/achievements.js`（narrative）`evaluateAchievements(map, finalUnits, log)` = 对每条 `achievements[].when` 跑 `evalCond` → 收集命中条目的 `setFlag`。

### 3.5 单测要求（谓词库自身回归网）
- 每个谓词给定构造的 `ctx` → 期望 bool，含边界（空 foe、ally 在场不误判 rout、guest 计入 wei 败北、escort 到达、log 缺失时达成判据安全 false）。
- `evalCond` 对每种数据形状的派发正确；`all/any` 递归。
- victory.js 改用谓词库后，**现有 victory 单测全绿**（rout/defeatLeader/survive/capture 行为不变，只是 rout 修正了 ally bug）。

---

## 4. `scenarioRunner` 步类型权威登记表 ★本稿核心

**现状**（已实装，`scenarioRunner.run` 的 `switch`）：`narrate / say / choice / camera / setFlag / duel`（共 6 种，未知步静默忽略=向前兼容）。
姊妹稿各自要求新增步：narrative(`branch`)、weather(`setWeather`)、enemy-ai(`retreat`/`spawnWave`/`setBossPhase`)、recruitment(`recruit`/`leave`)、ui-ux(`tutorial`)。**本稿把它们收成一张权威表**，逐个给 step 形状 + 语义 + 对接点 + 阻塞性，实现期照此一次性扩 `scenarioRunner`（仍保持"未知步忽略"的兼容兜底）。

> **通则**：
> - 所有步**只读 ctx + 发事件 / 调注入的句柄**，纯过场（无 controller/render）时该步**静默跳过**，绝不抛错（现 duel 已是此风格）。
> - 涉及战场状态变更的步（retreat/spawnWave/setBossPhase/recruit/leave）**通过 `ctx.controller` 的方法**执行，scenarioRunner 不直接 mutate `units`——保持"剧本驱动、引擎执行"。
> - 文案字段（text/say）一律是**字符串或 data 标签**（§5 i18n 路），不内联复杂逻辑。

### 4.1 现有 6 步（保持不变，登记备查）

| type | 形状 | 语义 | 对接 |
|---|---|---|---|
| `narrate` | `{ type:'narrate', text }` | 旁白行 | `dialogue.playStep` |
| `say` | `{ type:'say', who:generalId, text }` | 立绘对白(who→portrait) | `dialogue.playStep` |
| `choice` | `{ type:'choice', prompt, options:[{ text, setFlag?, note?, irreversible?, warn? }] }` | 分支选项；`setFlag` 经**归并器**写 `storyFlags`(lean 累加)；`note` 角标 / `irreversible` 二确认(narrative §6) | `dialogue.playStep` + `leanState.applyChoiceFlag` |
| `camera` | `{ type:'camera', preset?:'iso'|'reset'|'cinematic', focus?:{c,r}, zoom? }` | 运镜；广播 `camera:cinematic` | `ctx.camera` |
| `setFlag` | `{ type:'setFlag', flag:{...} }` | 直接置旗(经归并器，lean 累加) | `gameState.storyFlags` |
| `duel` | `{ type:'duel', a:generalId, b:generalId, forced?:true }` | 剧情强制单挑→`duelView.run`→`applyDuelOutcome` | `ctx.controller`+`ctx.duelView` |

> **变更点（narrative）**：`choice`/`setFlag` 的写旗从 `Object.assign` 改为 `leanState.applyChoiceFlag`（对 `flag.lean` 累加、其余 assign）。向后兼容旧旗。

### 4.2 新增步（本稿登记，权威形状）

| type | 形状 | 语义 | 阻塞? | 对接 / 权威 |
|---|---|---|---|---|
| **`branch`** | `{ type:'branch', on:'track'|'flag', flag?, cases:{ [key]:[Step...] }, else?:[Step...] }` | 按 `track`(leanProfile) 或某 `flag` 值选一组**子步递归执行**；不中走 `else` | 否(子步各自阻塞性) | narrative §5.2；`run` 内递归同一循环 |
| **`setWeather`** | `{ type:'setWeather', weather:'sun'|'rain'|'snow'|'fog'|'cloudy'\|null }` | 改当前天气(null=清除特殊)；广播 `weather:changed` | 否 | weather §2；`ctx.controller.setWeather` / `weather.setWeather` |
| **`spawnWave`** | `{ type:'spawnWave', waveId }` | 显式触发一波援军(`on:'summon'` 的 wave)；boss `onEnter.summonWaveId` 也走它 | 否(刷怪后发 `units:spawned`) | enemy-ai §3；`ctx.controller.spawnReinforcement(waveId)` |
| **`setBossPhase`** | `{ type:'setBossPhase', bossId, phaseIndex }` | 剧情强制把某 boss 切到指定阶段(配合过场)；发 `boss:phase` | 否 | enemy-ai §2.2/§10；`ctx.controller.setBossPhase` |
| **`retreat`** | `{ type:'retreat', units:[generalId...], to?:{c,r} }` | 令指定 foe 撤退/脱离(剧情撤退，非 AI 自决) | 否 | enemy-ai §4.2；`ctx.controller.retreatUnits(ids,to)` |
| **`recruit`** | `{ type:'recruit', generalId, init?:{ level?,exp?,skills?,items? } }` | 剧本里即时收人(写 `joinFlag` + `addToRoster`)，用于"战中即入伙"演出 | 否 | recruitment §7；`gameState.addToRoster` |
| **`leave`** | `{ type:'leave', generalId }` | 剧本里即时离队(`removeFromRoster`，装备退回 inventory) | 否 | recruitment §7；`gameState.removeFromRoster` |
| **`tutorial`** | `{ type:'tutorial', id, text?, highlight?:'menu'|'cell'|'unit', target?, requireAction?:string }` | 弹教学提示/高亮 UI；`requireAction` 时**阻塞等玩家做出该操作**(教学战用) | **可阻塞** | ui-ux 稿；`ctx.ui.tutorial`(纯过场时跳过) |

### 4.3 派发表（实现期 `scenarioRunner.run` 的 switch 目标）

```js
switch (step.type) {
  case 'narrate': case 'say': case 'choice': await playStep(step); break;   // dialogue(choice 经 leanState)
  case 'camera':       applyCamera(step, ctx); break;
  case 'setFlag':      applyFlag(step.flag, /*merge=*/leanState.applyChoiceFlag); break;
  case 'duel':         await applyDuel(step, ctx); break;
  // —— 新增 ——
  case 'branch':       await runBranch(step, ctx); break;                    // 递归 run(子steps)
  case 'setWeather':   ctx.controller?.setWeather?.(step.weather); bus.emit('weather:changed',{weather:step.weather}); break;
  case 'spawnWave':    ctx.controller?.spawnReinforcement?.(step.waveId); break;
  case 'setBossPhase': ctx.controller?.setBossPhase?.(step.bossId, step.phaseIndex); break;
  case 'retreat':      ctx.controller?.retreatUnits?.(step.units, step.to); break;
  case 'recruit':      game.addToRoster?.(step.generalId, step.init); bus.emit('roster:recruited',{id:step.generalId}); break;
  case 'leave':        game.removeFromRoster?.(step.generalId); bus.emit('roster:left',{id:step.generalId}); break;
  case 'tutorial':     await ctx.ui?.tutorial?.(step); break;                // 无 ui→跳过；requireAction 时阻塞
  default: break;                                                            // 未知步：忽略(向前兼容)
}
```

- **`ctx` 扩展**（在现 `{camera,sceneManager,controller,duelView,fx,audio,rng}` 上加）：`ui?`（tutorial 高亮）、`weather?`（可选直接句柄）。全部可选——纯过场/单测时缺则对应步跳过，**不破坏现有 6 步行为与单测**。
- **`branch` 递归**：`runBranch` 求 `on`（`'track'`→`leanProfile(storyFlags).track`；`'flag'`→`storyFlags[step.flag]`）→ 取 `cases[key]||else||[]` → 复用同一 `for(step of subSteps)` 循环（含再嵌套 branch）。
- **`triggersFor(on)` 扩展**：现仅过滤 `on==='turnStart'`；登记表要求支持 §1.7.1 的 `on` 全集（`unitDied/reached/captured/flag/bossPhase`），controller 在对应事件时机调用，命中的 trigger 既可 `scenarioId`（播剧本）也可 `setFlag`/`retreat`（数据驱动副作用，经归并器/controller）。

### 4.4 步类型与谓词库的接缝
- `branch on:'flag'`、`trigger.on:'flag'`、`achievements.when` 的判据求值**统一走 §3 `evalCond`**（剧本侧只读 storyFlags 时直接读；涉及战场终态时由 controller 包 `PredCtx` 传入）。这样"剧本分支"和"战后达成"用**同一套谓词**，不再各判各的。

---

## 5. 文案集中约束（v1 中文，为 i18n 留路）

**现状**：对白文本直接内联在 `*.story.js` 的 `text`/`prompt` 里（如 b1）。v1 不强制抽离（成本敏感、单语言），但**立约束，避免日后改 i18n 时全量返工**。

### 5.1 约束（v1 即遵守，零额外成本）
1. **文案只许出现在 `data/*`**（`*.story.js`、`data/*` 的 `name`/`label`/`desc`），**引擎/UI/render 层不得硬编码玩家可见中文字串**（除纯结构性占位）。UI 文案（按钮/提示/HUD 标签）走一个集中字典 `data/ui-strings.js`（key→中文），而非散落在 `ui/*.js`。
2. **所有可见文本可被"取串函数"包裹**：约定 `t(key|literal)` 占位——v1 实现为恒等返回（直接吐中文），但**调用点就位**，将来换成查表即得 i18n，无需改调用处。剧本 `text` 字段过渡期仍可直接写中文字面量（量大），但**新写的 UI/系统提示一律走 `t('ui.xxx')` + 字典**。
3. **不可见 id 与可见 name 分离**：所有 `id` 是稳定 ASCII（generalId/skillId…），`name`/`title` 是可显示中文——校验脚本保证 id 唯一、ASCII（§2）。i18n 时只翻 name/text，不动 id。
4. **标签即数据**：相克/地形/天气/状态在伤害预测面板(damage-preview §2)、HUD 上显示的"修正标签"（如「兵种克制↑」「林 防+2」「晴」），文案统一来自 `data/`（terrain.name / weather label / status label），UI 只拼装、不写死。

### 5.2 i18n 就位形状（设计占位，v1 不实现多语）
```js
// data/ui-strings.js（v1：单一中文表；将来 → { zh:{...}, en:{...} }）
export const UI = { 'btn.start':'开始征途', 'toast.noMoney':'军资不足', 'label.weather.fog':'雾', ... };
export const t = (key) => UI[key] ?? key;     // 缺串回落 key 本身(开发可见)
```
- 剧本内对白量大且高度本地化(文言)，**v1 维持内联中文**；约束 §5.1.1 保证它们至少都在 `data/*.story.js` 内，未来抽 i18n 时是"搬运 + 上 key"，不是"满代码库找字串"。

### 5.3 校验接缝
- data-validate 增一条 warn：扫 `ui/*.js`/`render3d/*.js`/`battle/*.js` 中**裸中文字面量**（正则 `[一-龥]`，排除注释），命中即 warn「玩家可见文案应移入 data/」。逻辑层注释中文不算（只查字符串字面量且疑似 UI 文案的）；阈值宽松，避免噪音。

---

## 6. 模块触点（实现期对接清单）

| 模块 | 改动 | 性质 |
|---|---|---|
| `battle/predicates.js` **(新)** | §3 全部谓词 + `isHostile/enemiesOf/evalCond/all/any`；唯一战场判据实现 | 纯逻辑·可单测 |
| `battle/victory.js` | 改为 import 谓词库；`rout` 数 `foe`(修 ally bug)；`evaluate` 走 `evalCond`；顺序"先 lose 后 win"不变 | 纯逻辑·行为兼容 |
| `battle/achievements.js` **(新, narrative)** | `evaluateAchievements` 走谓词库 `evalCond` | 纯逻辑·可单测 |
| `battle/ai.js` | 击杀/威胁/价值判定改调谓词库(`canKillThisTurn/incomingThreat/targetValue`)，去重内联估算；`enemiesOf` 用谓词库版 | 纯逻辑 |
| `story/scenarioRunner.js` | §4 派发表：新增 `branch/setWeather/spawnWave/setBossPhase/retreat/recruit/leave/tutorial`；`choice/setFlag` 走 `leanState` 归并；`triggersFor` 支持 `on` 全集；`ctx` 加 `ui?/weather?` | 解释器扩展·向前兼容 |
| `story/leanState.js` **(narrative)** | `applyChoiceFlag`(lean 累加)、`leanProfile`——scenarioRunner/dialogue 共用 | 纯逻辑·可单测 |
| `data/balance.js` **(balance-master)** | 唯一 `DIFFICULTY` + 乘子链常量；campaign/ai 从此 import | 数据·单一来源 |
| `data/ui-strings.js` **(新)** | UI 文案字典 + `t()` 占位(§5) | 数据 |
| `data/affinity.js / formations.js` **(新)** | §1.4/§1.5 形状 | 数据 |
| `tools/validate-content.mjs` **(新)** | §2 校验脚本(引用完整性/维度/可达/route/链/5维门/裸文案 warn) | 工具·CI |
| `tests/content.validate.test` **(新)** | 对 ch01 全量数据跑校验断言 0 error；谓词库回归；scenarioRunner 新步派发 | 单测 |
| `data/chapters/*` | map/story 采用 §1.7/§1.8 扩展字段(achievements/reinforcements/allies/weather/variants 等，全可选) | 数据·兼容 |

**边界**：谓词库与校验函数全在纯逻辑层（不依赖 three/DOM，进 `tests/`）；scenarioRunner 仍是"解释 + 派发"，副作用走 controller/gameState；UI 仅展示。符合 srpg-design §5 模块边界与 master「内容/引擎分离」。

---

## 7. 分阶段（phaseable）

- **P0 契约冻结（先行，配合各稿实现）**：本稿 §1 schema 目录 + §3 谓词库接口 + §4 步登记表"纸面定稿"，作为其余实现 subagent 的对接基线（不写代码也已消解冲突）。
- **P1 谓词库 + victory 收口**：`battle/predicates.js` 落地，`victory.js`/`achievements` 改用之（修 rout ally bug），现有 victory 单测全绿。**解锁 ally/npc/guest 与达成判据的统一**。
- **P2 校验脚本 + 回归网**：`tools/validate-content.mjs`(error 子集) + `content.validate.test` 对 ch01 跑通；dev boot `?validate` 接入。**防止后续加章断链**。
- **P3 scenarioRunner 步扩展**：按 §4 派发表逐步加 `branch`(narrative)→`setWeather`(weather)→`spawnWave/setBossPhase/retreat`(enemy-ai)→`recruit/leave`(recruitment)→`tutorial`(ui-ux)，每加一步配单测；保持"未知步忽略"兜底。
- **P4 文案集中 + i18n 就位**：`data/ui-strings.js` + `t()` 占位；裸文案 warn；剧本内联中文维持(v1 单语)。
- **P5 5 维迁移门**：随 stat-migration 落地翻 `STAT_MODEL` 开关，校验从 `legacy4` 切 `five`(+mpCost)。

---

## 8. 与设计语料的一致性自检
- **术语**：沿用 章/战役/事件、五维(攻/精/防/爆/士)+MP、11 系职业、计略 `kind`、印绶 Lv15/30 转职、`faction`(wei/foe/ally/npc + guest)、`storyFlags`/`lean`、天气枚举、footprint、`STORY{intro,outro,scenarios,triggers}`、`CHNN{battles}`、`scenarioRunner`/`victory`/`ai`/`leveling` 既有命名。
- **原则**：加章/加敌/加事件=改 `data/`，不改引擎(master §1)；`battle/`/`story/` 纯逻辑可单测、不 import three/不碰 DOM(srpg-design §5)；数值集中在 `data/`。
- **不抢权威**：难度/乘子/公式指向 balance-master；字段模型指向 stat-migration；本稿只统一形状、引用完整性、共享库(谓词/步)的**唯一出处**。

---

## 待确认
1. **谓词库落点**：`battle/predicates.js` 单文件，还是拆 `predicates.js`(胜负/达成) + `aiPredicates.js`(AI 判定)？本稿倾向**单文件**(避免循环依赖、一处可查)，AI 类谓词标注"依赖 forecast(可选注入)"。
2. **`victory.rout` 修正的迁移**：改"数 foe"会影响**现有 b1–b5 全 rout 关**(现无 ally，行为不变；但若 b3 上孙坚 ally，则修正后才正确)。确认在 P1 一次性改、并补「ally 在场不误判」单测。
3. **校验脚本严格度**：连通性/可达校验对"高消耗山地围敌"易误报——本稿定为 enemy 可达近似=warn、victory 目标可达=error。这个分级 OK 吗？
4. **`DIFFICULTY` 合并**：campaign-structure §6.1 与 enemy-ai §7.1 两份表合并到 balance-master 的单一 `data/balance.js`，原两模块改为薄取用层——确认由 balance-master 持表、本稿只校验"单一定义"。
5. **`tutorial` 步的阻塞**：`requireAction` 阻塞等玩家操作(教学战)是否需要超时/跳过兜底，避免卡死？建议给「可跳过」开关。
6. **裸文案 warn 阈值**：扫逻辑层中文字面量易误伤(注释/调试)。是否仅扫 `ui/`+`render3d/` 的字符串字面量、且默认 warn 不阻断 CI？
7. **5 维迁移开关时点**：`STAT_MODEL` 切换由 stat-migration 主导；本稿校验脚本两套字段集并存。确认迁移期"半套字段"一律判 error(防脏数据)的严格度。
8. **触发器 `setFlag` 副作用**：扩 `triggersFor` 的 `on` 全集后，trigger 既能播剧本又能直接写 flag/retreat。是否限制"战中即时写 flag"仅用于明确白名单 `on`，避免内容层滥用导致难调试(narrative §3.2 倾向第一章只用战后 achievements)？
