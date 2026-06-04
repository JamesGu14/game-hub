# 《群雄逐鹿·孟德篇》recruitment-allies — 设计稿（待审）

> 原创致敬作。武将与事件取自公有领域《三国演义》/正史；招募流程、分支条件、阵营规则与数值均为本作自定，
> **不照搬任何商业游戏的招募脚本/文案/数值表**。本稿与设计语料一致：沿用 5 维（攻/精/防/爆/士）、
> 11 系职业、计略/单挑、`faction` 字段、`map.deploy/enemies/victory/defeat/triggers`、`gameState.roster`、
> `scenarioRunner` 剧本步等既有契约。
>
> - 日期：2026-06-04 · 作者：James + Claude · 状态：设计稿待 review
> - 上游：`2026-06-03-...-srpg-design.md`（§3.1 武将 faction、§3.9 胜负、§3.11 整军、§4 剧情分支）、
>   `...-class-system.md`（§5 名册→职业、客将归类）、`...-item-system.md`（宝物/印绶）。
> - 范围：**招募与友军系统** —— 武将加入流程、客将（本战限定可控）、友军 NPC（AI 自动·不可控·可作护送/坚守目标·阵亡可致败）、
>   roster 管理（常驻/客将/离队）、与剧情分支（忠义线）联动。给出数据表达与 `battleController`/`gameState` 接入。
> - **本稿只做设计，不实现。** 大块标注 phaseable。

---

## 0. 术语与三类阵营（与现有 `faction` 对齐）

现状（已读代码）：`GeneralDef.faction` 契约声明四值 `'wei'|'foe'|'ally'|'npc'`，但当前数据只用 `wei`/`foe`；
`battleController.makeUnit` 只从 `map.deploy`(wei) 与 `map.enemies`(foe) 造单位；`victory.js` 把**一切非 `wei`** 当敌人、
**仅 `wei` 全灭**才算败北。本稿在不破坏既有契约的前提下，补齐 `ally`/`npc` 两条边并引入「客将」概念。

| 类别 | 战场 faction | 玩家可控 | 经验/养成归玩家 | 进 `gameState.roster` | 阵亡后果 | 典型用例 |
|---|---|---|---|---|---|---|
| **常驻（roster）** | `wei` | ✅ | ✅ 永久 | ✅ | 计入「我方」败北判定 | 曹军本部、剧情收入的荀彧/典韦 |
| **客将（guest）** | `wei`（带 `guest:true` 标记） | ✅ 仅本战 | ❌（战后还原，不持久化） | ❌ | 计入我方判定（与常驻同袍） | 虎牢关刘关张三英 |
| **友军（ally）** | `ally` | ❌（AI 自动） | ❌ | ❌ | 可配置：阵亡/被破即**败北**或仅失奖励 | 孙坚军、护送的乡民、坚守的盟军 |
| **中立/被护送 NPC** | `npc` | ❌（AI 自动或静止） | ❌ | ❌ | 同上（多用于护送/保护目标） | 逃难百姓、献刀的伯奢、需保全的使者 |

> **客将 = `wei` + `guest:true`**：玩家可控、与本部同阵营（不互相误伤、共享胜负），但**战后不入 roster、不保留升级**。
> 这与现状 b4「三英 faction 'wei' 仅本战」一致，本稿把它从「靠注释约定」升级为「数据字段 + 引擎清理」。
> **友军/NPC = `ally`/`npc`**：独立第三阵营，对 `foe` 敌对、对 `wei`/`ally` 友好，由 AI 驱动，玩家不能选中下令。

---

## 1. 招募来源与加入流程（4 类）

所有加入最终都收束到 `gameState.addToRoster(generalId, init?)`（已存在，幂等）。区别只在**触发条件**与**init 起始值**。

### 1.1 剧情登场（无条件，主线必得）
最常见。某战 `intro`/`outro`/触发剧情里 `setFlag` 标记登场，章节循环（`main.js`）在该战开打前/结束后把武将并入 roster。

- 数据：在 `GeneralDef` 加 `recruit` 字段（见 §3）：`{ type:'story', joinsAfter:'ch01_b1' }`。
- 时机：进入 `joinsAfter` 之后那一战的「整军（intermission）」时，集成层调用 `addToRoster`。
- 例：戏志才/荀彧在「会盟酸枣」后入幕（按 class-system §5 定位为策士/道士）。

### 1.2 达成条件加入（半隐藏，可错过）
在指定战内满足条件（如「让某敌将存活并以特定我将与其相邻对话」「占据某格」「保某 NPC 不死」），
通过 `storyFlags` 记录达成，战后据 flag 决定是否入伙。

- 数据：`recruit:{ type:'condition', battle:'ch01_b4', requires:['lubu_routed_not_killed'], joinFlag:'recruit_xxx' }`。
- 时机：`scenarioRunner` 在条件满足时 `setFlag`；战后整军读 `joinFlag` → `addToRoster`。
- 例（典韦投奔）：现数据典韦已是 `wei`；可改为「某战护主达成」后正式入幕的条件收人，作为模板。

### 1.3 分支收人（忠义线 · 互斥分支）★本稿重点
玩家在剧情 `choice` 处做价值取向选择，写入「**忠义线**」旗标，决定一个武将**归我 / 留客将 / 不收**三态。
以「**忠义线收关羽**」为蓝本（公有领域典故骨：虎牢关并肩、关羽重义；本作原创对白与分支，不抄原作）。

忠义线状态机（`storyFlags.loyaltyLine` 累计分 + 关键旗标）：

```
choice@b4(虎牢关战前)         choice@b4(战后)               结果(战后整军判定)
  ├ "并肩斩贼,以诚相待"  →   ├ "请云长共扶汉室"  →  guanyu.recruit.condition 满足 → 入 roster(常驻)
  │   loyalty += 2          │   且 loyalty>=3
  └ "各为其主,点到即止"  →   └ "就此别过,后会有期" → 仅客将,战后离队(不入 roster)
      loyalty += 0                                  （保留 storyFlags 供后续章节再遇）
```

- 数据：`recruit:{ type:'branch', line:'loyalty', requires:{ flag:'loyaltyLine>=3', battle:'ch01_b4' }, fallback:'guest' }`。
- `fallback:'guest'`：分支未达成时退化为**客将**（本战可控、战后离队），既不浪费登场、又为后续章节留再遇接口。
- **互斥**：忠义线达成会写 `storyFlags.guanyuJoined=true`，并可对其它分支（如某「以力服人」线）置反，影响后续对白。
- **版权红线**：分支文本全原创，仅借公有领域「重义」母题；不复制任何商业脚本的台词/章节结构。

### 1.4 商店/野招（后置 · phaseable）
关间整军「招贤」面板招募通用兵或在野士人（按曹操等级解锁名额）。**v1 不做**，留 `recruit:{type:'hire', cost, unlockFlag}` 接口占位。

---

## 2. 客将（guest）——本战限定可控

### 2.1 行为
- 战场上以 `faction:'wei'` 参战，`guest:true`：可被玩家选中、移动、攻击、用计、单挑（与本部完全同权）。
- 共享胜负：与本部同算「我方」（`victory.js` 的 `wei` 全灭判负把客将一并计入；**见 §6 的 defeat 选项**）。
- **战后不持久化**：不进 `roster`，其战内升级/扣血一律丢弃；下次登场（若有）按 def/剧情指定等级重建。
- 经验：客将可在本战吃经验、升级、习计略（用于演出/手感），但战后归零。

### 2.2 数据表达
客将不写进 `gameState.roster`，而由**地图**声明（沿用现 b4 把三英放进 `map.deploy` 的做法，加显式标记）：

```js
// map.deploy 条目扩展：guest + 可选 level/skills 覆盖（覆盖 GeneralDef.base 的临场强度）
deploy: [
  { generalId: 'caocao', c: 2, r: 7 },                         // 常驻（roster 覆盖其等级/经验）
  { generalId: 'guanyu', c: 7, r: 8, guest: true, level: 12 }, // 客将：本战 12 级演出强度,战后不留
  { generalId: 'zhangfei', c: 5, r: 8, guest: true, level: 12 },
  { generalId: 'liubei',  c: 6, r: 8, guest: true, level: 10 },
]
```

> 规则：`deploy` 条目若 `guest:true`，`battleController` **忽略 roster 覆盖**（客将不在 roster），改用条目自带 `level/exp/skills/items`，
> 缺省回落 `GeneralDef`。这样客将强度由关卡设计者钉死，不受玩家本部进度影响（演出可控）。

### 2.3 与忠义线衔接
当 §1.3 分支达成（关羽转常驻），战后整军把 `guanyu` `addToRoster({ level: <该战客将等级或固定起始>, skills:[...] })`，
其装备清空（客将身上的临时装备不带走，宝物归还军备库 `inventory`）。未达成则什么都不做（保持纯客将，离场）。

---

## 3. 友军 NPC（ally / npc）——AI 自动·不可控·可致败

### 3.1 行为
- 独立第三阵营，`faction:'ally'`（会主动作战的盟军）或 `'npc'`（被护送/静止的对象）。
- **玩家不能选中、不能下令**；由 AI 驱动（复用现有 `battle/ai.js` 性格：reckless/cautious/strategist/guard，新增 `escort`/`hold`，见 §5）。
- 敌我关系：`ally`/`npc` 与 `foe` 互相敌对、与 `wei` 友好（不互相攻击、不挡视野阻击 ZOC 视设计而定）。
- **阵亡/失守可致败**：作为「护送到达 / 坚守 NPC 存活」类目标的核心（srpg-design §3.9）。

### 3.2 数据表达（新增 `map.allies`）
不挤进 `enemies`/`deploy`，新开一段，语义清晰、引擎易分流：

```js
// 战役地图新增字段
allies: [
  // 会战斗的盟军（孙坚军）——AI 'cautious'，阵亡不直接致败,但全灭则失去其增援/宝物
  { generalId: 'sunjian', c: 4, r: 1, faction: 'ally', ai: 'cautious' },
  // 被护送的百姓——NPC,沿 path 向出口移动,被破即败
  { generalId: 'refugees', c: 0, r: 8, faction: 'npc', ai: 'escort',
    escort: { to: { c: 11, r: 0 }, speed: 1 } },
],
```

> 若不想新增字段，回退方案：复用 `enemies`/`deploy` 但靠 `faction` 分流。**推荐新增 `allies`** —— 更直观，且
> `battleController` 构造时一眼分清三阵营。两方案二选一，列入待确认。

### 3.3 新增 GeneralDef（护送/盟军对象）
护送对象可是「非战斗单位」：低/零攻击、移动型 `foot`、专用外观（百姓/车驾）。沿用既有 `appearance` 参数即可，
新增可选 `appearance.kind:'civilian'|'cart'` 供 `unitFactory` 画成非武装造型（render3d 侧，phaseable）。

---

## 4. roster 管理（常驻 / 客将 / 离队）

### 4.1 三态与 `gameState`
- **常驻**：`gameState.state.roster`（已存在）。`addToRoster` 幂等加入；离队用新增 `removeFromRoster(generalId)`（见下）。
- **客将**：**不进 roster**，只活在当前 `BattleController.units`。战后由集成层丢弃。
- **离队**：剧情需要（如客将走、或某将因分支离去），从 roster 移除并把其装备退回 `inventory`。

### 4.2 `gameState` 新增 API（最小增量，纯逻辑可单测）
```js
// 移除常驻武将；其已装备 items 退回 inventory（避免宝物丢失）。返回被移除的 RosterEntry|null。
removeFromRoster(generalId)        // 找到→splice；把 entry.items 并入 state.inventory→返回 entry

// 查询：是否在常驻名册
hasInRoster(generalId) -> boolean

// 出战名单（后续多于上阵格时用；v1 全员上阵可先全返回 roster）
selectDeployable(battle) -> generalId[]
```
> `addToRoster` 已支持 `init`（level/exp/items/skillsLearned/curHp），分支收人时直接带初始等级与已学计略。

### 4.3 存档影响
- 常驻随 `roster` 持久化（已有）。客将/友军**不持久化**（不写存档）——它们是关卡数据派生的，载入时由地图重建。
- 忠义线等分支结果落在 `storyFlags`（已持久化），保证读档后「关羽是否在队」可由 flag + roster 一致复原。
- `removeFromRoster` 退回的装备进 `inventory`（已持久化），不丢失。

---

## 5. `battleController` 接入

### 5.1 构造期：补齐三阵营建单位
当前 `constructor` 只遍历 `map.deploy`(wei) 与 `map.enemies`(foe)。改为三段（保持现有两段不变，新增第三段 + guest 分支）：

```
for d of map.deploy:
  faction = 'wei'
  if d.guest:  用 d 自带 level/exp/skills/items（忽略 roster 覆盖），并在 unit 上置 unit.guest=true
  else:        沿用 roster 覆盖（现状）
for e of map.enemies:  faction='foe'（现状不变）
for a of map.allies:   faction = a.faction || 'ally'；ai 取 a.ai；unit.ai 设值（ally/npc 都吃 AI）
                       若 a.escort：把 escort 配置挂到 unit.escort（供 escort AI 读）
```
`makeUnit` 增参：`makeUnit(def, placement, faction)` 已有 faction 参数；扩展 placement 支持 `guest/skills/items/escort`，
并把 `unit.guest`、`unit.escort` 写入运行态。**玩家方可控判定**改为 `unit.faction==='wei'`（含 guest），ally/npc 不可控。

### 5.2 相位：友军行动归入敌方相位之后的「友军相位」
现状两相位（player/enemy）。新增**友军相位**（或并入敌方相位末尾，二选一）：

- 推荐：`runEnemyTurn()` 末尾、`turn++` 之前，插入 `runAllyTurn()`：遍历 `faction in {ally,npc}` 且 `alive` 的单位，
  调 `ai.planTurn(unit, allyState)` 执行 move/attack（NPC 护送只 move）。复用现有 `_runOneEnemy` 的执行骨架，
  抽出公共 `_runOneAI(unit, state)`。
- AI 目标选择：`ally` 视 `foe` 为敌；`npc(escort)` 不主动攻击，按 `escort.to` 寻路前进（用现成 `pathfind.path`）。
- 相位事件：`bus.emit('phase:ally')` / 沿用 `turn:changed`。可控性：UI 在友军相位禁用玩家输入（与敌方相位一致）。

### 5.3 误伤与目标过滤
`combat`/`ai` 的敌我判定需从「`!== 'wei'`」升级为**阵营关系表**：

```
function isHostile(a, b):
  hostilePairs = { wei↔foe, ally↔foe, npc↔foe }   // wei/ally/npc 之间均友好
  return pair(a.faction, b.faction) in hostilePairs
```
- `ai.js` 选目标、`battleController._inAttackRange`/攻击合法性、计略 `skillEngine` 目标筛选，统一改走 `isHostile`。
- 玩家攻击：只能以 `wei`（含 guest）对 `isHostile` 为真的目标出手；不能打 ally/npc（UI 不高亮）。

### 5.4 新增 AI 性格（`battle/ai.js`）
- `escort`：朝 `escort.to` 最短路移动；遇敌阻路时可绕行；不主动攻击（除非 `escort.fight:true`）。到达目标格 → emit `escort:arrived`。
- `hold`：守在初始格 ±N（坚守目标），不远离；被攻击可反击；用于「坚守 NPC 存活」类。
> 这两者是「保护/护送」目标的 AI；与现有四性格并列，phaseable（先 escort，再 hold）。

---

## 6. 胜负条件接入（`battle/victory.js`）★需改

当前 `victory.js` 两个硬假设会与友军冲突，必须修：

1. **`'rout'` 把一切非 `wei` 当敌**：有 `ally`/`npc` 在场时，rout 会因 ally 未死而永不达成。
   → 改为「所有 **`foe`** 单位死亡」（只数敌对阵营）。
2. **败北只看 `wei` 全灭**：友军/护送目标阵亡不致败。
   → 保留 wei 全灭兜底，新增可配败北/胜利类型（下表）。

新增 `victory.type` / `defeat.type`（数据驱动，每关可配；与 srpg-design §3.9 复合条件一致）：

| 类型 | 字段 | 语义 | 用例 |
|---|---|---|---|
| `escort`（胜） | `{ type:'escort', generalId, to:{c,r} }` | 该 NPC 存活且到达 `to` → win | 护送百姓/使者出境 |
| `protect`（败） | `{ type:'protect', generalId }` | 该 ally/npc 阵亡 → lose | 坚守某盟将/保全伯奢 |
| `protectAny`（败） | `{ type:'protect', faction:'ally' }` | 指定阵营全灭 → lose | 友军全军覆没即败 |
| 复合 | `victory:{ all:[...] }` / `{ any:[...] }` | 组合既有/新类型 | 「斩敌将且护送到达」 |

实现要点：`checkVictory` 的 `rout` 改数 `foe`；新增 `escort` 分支（查 NPC 到达 `to` 且 alive）；
`checkDefeat` 新增 `protect`（指定单位/阵营阵亡）；复合 `all/any` 递归求值。**保持「先判 lose 再判 win」顺序不变**。

---

## 7. `scenarioRunner` / 剧情接入（招募与离队的剧情步）

`scenarioRunner` 已支持 `narrate/say/choice/camera/setFlag/duel`。招募/离队**不必新增 step 类型**——用 `setFlag` + 集成层（main.js）在整军时据 flag 调 `addToRoster`/`removeFromRoster` 即可（保持 story 层纯净）。

可选新增（便利，phaseable）：
- `{ type:'recruit', generalId, init? }`：剧本里即时收人（写 flag 并 `addToRoster`），用于「战中即入伙」的演出。
- `{ type:'leave', generalId }`：剧本里即时离队。
> 推荐先走「`setFlag` + 整军结算」最小路径，确认手感后再加便利 step。`choice.options[].setFlag` 已能驱动忠义线累分（见 §1.3）。

集成层（`main.js`）章节循环钩子（不改引擎，符合 srpg-design「内容/引擎分离」）：
- 进入某战前：扫描 `GENERALS` 中 `recruit.joinsAfter <= 当前进度` 且未在 roster 的 `story` 类 → `addToRoster`。
- 某战结束后：读本战相关 `joinFlag`/分支 flag（如 `loyaltyLine`、`guanyuJoined`）→ 决定 `addToRoster`/保持客将/离队。
- 客将清理：战斗结束销毁 `BattleController` 时，`guest`/`ally`/`npc` 单位自然随之丢弃（本就不在 roster）。

---

## 8. 忠义线收关羽 · 端到端示例（数据流串讲）

1. 进入虎牢关（b4）：`map.deploy` 含 `guanyu/zhangfei/liubei`（`guest:true, level:12`）。引擎按 §5.1 造客将（可控、不读 roster）。
2. 战前 `intro.choice`：选「并肩斩贼,以诚相待」→ `setFlag:{ loyaltyLine: +2 }`（集成层做累加；或用独立旗标 `b4_loyalChoice1:true`）。
3. 战中：三英战吕布（现有 `duel` step），关羽并肩立功。可在「吕布退/被斩」触发剧情再给一次忠义 `choice`。
4. 战后 `outro.choice`：「请云长共扶汉室」→ `setFlag:{ b4_inviteGuan:true }`。
5. `GeneralDef.guanyu.recruit = { type:'branch', line:'loyalty', requires:{ flag:'b4_inviteGuan', minLoyalty:3 }, fallback:'guest' }`。
6. 整军结算：集成层判 `b4_inviteGuan && storyFlags.loyaltyLine>=3` → `game.addToRoster('guanyu', { level:12, skills:[...] })` + `setFlag:{ guanyuJoined:true }`。
7. 未达成：不调 addToRoster；关羽随客将身份离场，`storyFlags` 保留以便后续章节再遇（如「千里走单骑」线，后续 spec）。
8. 存读档：`guanyuJoined` 在 storyFlags（已持久化）；关羽若已入则在 roster（已持久化）。读档后状态一致。

---

## 9. 第一章 招募/友军 落点建议（与现有 5 战对齐，全 phaseable）

| 战 | 招募/友军元素 | 类型 | 备注 |
|---|---|---|---|
| b1 陈留起兵 | 曹军本部固定登场 | story 常驻 | 现状即如此，无需改 |
| b2 会盟酸枣 | 荀彧/戏志才入幕 | story 常驻（joinsAfter:'ch01_b1'/'ch01_b2'） | 按 class-system §5 定位 |
| b3 汜水关 | 孙坚军作 `ally` 并肩（华雄事件过场） | ally（AI cautious） | 友军在场,全灭失古锭刀馈赠(item-system §4),不直接致败 |
| b4 虎牢关 | 刘关张三英客将 + **忠义线收关羽** | guest → branch 常驻 | 本稿重点;现 b4 已是 guest 雏形 |
| b5 荥阳追击 | 败战中护送残部撤离(可选) | npc escort / protect | 「虽败犹荣」基调,护送目标活下来=战略胜 |

> 以上为内容层建议，加它们=改 `data/`（generals/map/story），**不改引擎**（除 §5/§6 的引擎一次性补强）。

---

## 10. 模块触点小结（建造时对照）

| 模块 | 改动 | 性质 |
|---|---|---|
| `data/generals.js` | 新增 `recruit` 字段；按需加孙坚/百姓等 ally/npc def | 数据 |
| `data/chapters/**/*.map.js` | `deploy` 加 `guest`；新增 `allies`；`victory/defeat` 用新类型 | 数据 |
| `data/chapters/**/*.story.js` | 忠义线 `choice/setFlag`；离队/收人剧情 | 数据 |
| `core/gameState.js` | 新增 `removeFromRoster`/`hasInRoster`(+`selectDeployable` 占位) | 纯逻辑·可单测 |
| `battle/battleController.js` | 构造三阵营 + guest 分支；`runAllyTurn`/抽 `_runOneAI`；可控判定=`wei` | 纯逻辑·可单测 |
| `battle/victory.js` | `rout` 改数 `foe`；新增 `escort/protect/protectAny`/复合 `all/any` | 纯逻辑·可单测 |
| `battle/ai.js` | 阵营关系 `isHostile`；新增 `escort`/`hold` 性格 | 纯逻辑·可单测 |
| `battle/combat.js`/`skillEngine.js` | 敌我判定改走 `isHostile`（不再 `!=='wei'`） | 纯逻辑·可单测 |
| `story/scenarioRunner.js` | 可选 `recruit`/`leave` step（先不做） | 纯逻辑 |
| `main.js`（集成） | 章节循环：进战前/战后据 `recruit`+flags 收人/离队；销毁客将 | 集成 |
| `ui/intermission.js` | 显示常驻名册(含新入);(后置)招贤面板 | DOM |
| `render3d/unitFactory.js` | (可选)`appearance.kind` 画百姓/车驾;ally/npc 旗色区分 | 渲染·后置 |
| `tests/` | 三阵营建单位、`isHostile`、escort/protect 胜负、收人/离队往返、guest 不入档 | 单测 |

### 分阶段（phaseable）
- **P1 阵营地基**：`isHostile` + 三阵营建单位 + guest 标记 + `victory.rout` 修正 + gameState 增 API + 单测。（解锁现有 b4 客将语义正规化）
- **P2 友军 AI 与目标**：`runAllyTurn` + escort/hold + `escort/protect` 胜负类型 + b3 孙坚 ally。
- **P3 忠义线收关羽**：branch recruit + 整军结算 + b4 剧情分支 + 收人/离队往返单测。
- **P4 后置**：招贤(hire)面板、百姓/车驾外观、复合胜负、后续章节再遇线。

---

## 11. 平衡与体验注意
- **客将强度钉死**：guest 用关卡指定 `level`，不随玩家进度（避免「养肥本部后客将相对变弱/变强」破坏演出）。
- **友军不能太能打**：ally AI 给 `cautious` 基调，避免抢玩家击杀/经验；护送 NPC 默认不攻击。
- **护送失败要可读**：`protect`/`escort` 失败前给预警剧情/UI 提示（NPC 残血、被围），降低「莫名其妙就败了」挫败。
- **忠义线可错过但不致命**：分支未达成 → 客将离场，不影响主线推进；收人是奖励而非门槛。
- **誤伤防呆**：玩家无法选中/攻击友军；UI 攻击高亮只覆盖 `isHostile` 目标（沿用 class-system §1 红色威胁范围逻辑）。

---

## 12. 待确认
1. **友军数据位置**：新增 `map.allies` 字段（推荐，直观）vs. 复用 `deploy/enemies` 靠 `faction` 分流？
2. **友军相位**：独立「友军相位」事件 vs. 并入敌方相位末尾（实现更轻）？
3. **客将共享胜负**：客将（guest=wei）阵亡是否计入「我方全灭」致败？建议**计入**（同袍），但虎牢关三英若设计为「可战死不致败」需特例（用 `protect` 反向豁免？）——需拍板。
4. **忠义线累分机制**：用单一数值 `storyFlags.loyaltyLine` 累加（灵活）vs. 一串布尔旗标（直观）？本稿示例两者混用，统一其一。
5. **关羽收入后定位**：入魏后是常驻可练（与史不符但游戏向）vs. 仅本章客将、后续章节按「降汉不降曹」线再处理？影响是否真正 `addToRoster` 持久化。
6. **ally 与 wei 的 ZOC/挡格**：友军是否阻挡我方移动/形成 ZOC？建议「占格但不形成对我 ZOC」。
7. **护送 NPC 是否可被玩家用治疗计略奶**：建议**可**（鼓励保护），但需 `isHostile=false` 下放开「友方目标」给治疗系计略。
8. **第一章是否真的上忠义线**：还是把收关羽留到后续章节（虎牢关只做客将演出）？涉及 v1 范围。
