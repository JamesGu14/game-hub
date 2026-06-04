# 《群雄逐鹿·孟德篇》campaign-structure — 设计稿（待审）

> 原创致敬作。章节路线取自公有领域《三国演义》与正史脉络，对白/剧本/数值全原创；
> **不复制任何商业游戏的关卡表、剧本脚本或数值**。与现有设计语料一致（沿用五维 攻/精/防/爆/士、
> 11 系职业、印绶 Lv15/30 转职、计略、天气、3 槽道具、伤害预测）。
> 本稿只定**战役/章节总体结构与流程、存档、章节选择、NG+、难度**，不含实现。
> 状态：**待 James 审阅**。
> 日期：2026-06-04 · 项目：game-hub / `games/caocao-zhuan/`

---

## 0. 当前已建（对接基线，勿重造）

读 `src/main.js` 与 `src/core/gameState.js` 后确认现状——本稿在其上**增量扩展**，不推翻：

| 现状 | 位置 | 本稿如何用 |
|---|---|---|
| 章节清单 `CH01 = { id, name, battles:[{map, story, joinsAfter?}] }` | `data/chapters/ch01/index.js` | 抽象为**通用 Chapter schema**，新增章按同构追加 |
| 流程编排：`showTitle → runChapter → runBattle(setupBattle: intro→建场→玩家/敌方相→onBattleEnd→outro)→ intermission + 自动存档 → 下一战 / showChapterEnd` | `main.js` | 形式化为**全游戏状态机**，并把「单章 runChapter」上提为「跨章 runCampaign」 |
| 存档：`save_caocao_v1_slot{n}`，字段 `chapter/battleIndex/roster/inventory/storyFlags/settings{muted,difficulty,textSpeed}` | `gameState.js` | 复用；新增 `campaign` 段（章进度位图、NG+ 圈数、章节解锁）与存档迁移 |
| 3 存档槽 + 标题「开始/继续」、`result()`、`saveLoad()` | `ui/menus.js` | 扩展为「新游戏(选难度)/继续/章节选择/NG+」，存档槽显示章名 |
| 战役地图 schema：`{id,name,cols,rows,tiles,deploy,enemies:[{generalId,c,r,ai}],victory,defeat,intro/outroScenario}` | `*.map.js` | 复用；难度作用于 `enemies` 的等级/AI/数值（见 §6），不改地图内容文件 |
| `settings.difficulty='normal'` 已存在但**未被消费** | `gameState.js` | 本稿定义其语义并接入战场装配 |

**核心承诺（沿用 master §1 原则）**：加新章 = 加 `data/chapters/chNN/` 数据 + 在章节注册表挂一条，**不改引擎**。

---

## 1. 全游戏章节路线图（北极星，逐章交付）

主线单线推进（致敬原作的线性战役流），每章一条 `data/chapters/chNN/index.js`。下表给**章纲 + 战役要点占位**；除第一章已建外，均为后续 spec→实现循环的内容占位（数值/剧本到各章 spec 再定）。

| # | 章 id | 章名 | 史/演义脉络 | 战役要点（占位，约 4–6 战/章） | 招牌演出 | 新登场/系统 |
|---|---|---|---|---|---|---|
| 1 | `ch01` | 起兵讨董 | 陈留矫诏→十八路会盟→关东联军 | 陈留起兵·会盟酸枣·汜水关·虎牢关·荥阳追击 | 三英战吕布(单挑)、温酒斩华雄(过场) | 教学全系统；荀彧/戏志才/典韦来投 |
| 2 | `ch02` | 鏖战濮阳 | 兖州牧→吕布袭兖州→濮阳拉锯 | 收兖州·复东郡·濮阳火攻·定陶决战·下吕布 | 濮阳火计(天气=火/风)、夜袭 | 风水士(满宠/荀攸)；火攻+天气showcase |
| 3 | `ch03` | 经略中原 | 迎天子→挟天子以令诸侯→宛城 | 许都奉迎·讨袁术(寿春)·宛城之变·复宛城·徐州 | 宛城之殇(典韦死战·剧情单挑) | 招募/客将分支雏形；道具商店开放 |
| 4 | `ch04` | 决战官渡 | 袁曹相争→白马延津→乌巢 | 白马解围·延津诱敌·官渡相持·夜烧乌巢·仓亭追击 | 关羽斩颜良(过场)、火烧乌巢(夜战+天气) | 大军会战(高单位数关)；坚守N回合关 |
| 5 | `ch05` | 平定河北 | 袁氏内乱→邺城→远征 | 仓亭余烬·邺城攻坚·南皮决·白狼山(乌桓) | 邺城水攻、白狼山骑战(雪) | 攻城战(城门/器械)；炮车(刘晔)登场 |
| 6 | `ch06` | 南征荆襄 | 下荆州→长坂→江陵 | 新野·当阳长坂·夺江陵·乌林前哨 | 长坂坡(赵云·张飞过场)、水军集结 | 水战雏形;舟船地形;雾战 |
| 7 | `ch07` | 赤壁风云 | 联军抗曹→火攻→败退 | 三江口·借东风(剧情)·赤壁火攻·华容道(撤退战) | 赤壁火攻(借东风改天气)、华容道义释(剧情) | **可败章**(史败)：以「撤退/减损」为胜利条件；情绪转折 |
| 8 | `ch08` | 西征关右 | 抚关中→潼关→渭水 | 潼关·渭水抹书反间·安定·汉中前奏 | 许褚裸衣斗马超(单挑)、抹书离间(剧情分支) | 离间/计略分支;反间影响敌阵 |
| 9 | `ch09` | 汉中风骨 | 取汉中→定军山→退守 | 阳平关·定军山·汉水·撤汉中 | 定军山(夏侯渊战死·剧情) | 山地攻坚;又一处「未必全胜」转折 |
| 10 | `ch10` | 魏王霸业（结局章） | 进魏王→功业总结→身后 | 樊城驰援·摩陂阅兵·终幕（按 storyFlags 分支结局） | 终幕长镜头、群臣朝贺/托孤 | **多结局**：按全程 storyFlags 与 NG+ 选不同尾声 |

> 节奏：每 2–3 章一个情绪拐点（讨董未竟·宛城丧典韦·赤壁折戟·定军失夏侯），与「枭雄基调」呼应。
> **交付边界**：v1 = 引擎 + `ch01`。`ch02+` 为路线占位，逐章独立 spec（地图/剧本/数值/新系统）后再实现；
> 引擎侧本稿要求的只有「跨章状态机 + 存档扩展 + 章节注册表 + 难度 + NG+」(§3–§7)，这些**与具体章内容无关**，可在 ch01 之上先落地。

### 1.1 结局分支（ch10，占位）
- 末章读取累计 `storyFlags`（如 `xuchang_diplomacy`、`huarong_release`、关键武将存亡）+ `campaign.ngPlus` 圈数，
  在 ch10 的 story 内用既有 `scenarioRunner` 分支步选择 2–3 段不同尾声字幕（「治世能臣/乱世奸雄」基调）。
- 引擎无需新机制——分支即 story 数据 + `if(flag)` 步（`scenarioRunner` 已支持 storyFlags 读写，见 master §4.1）。

---

## 2. 内容层级与数据形态（章 → 战役 → 事件）

沿用 master §4.1「章 → 战役 → 事件」。把现有 `CH01` 形状抽象为可复制的 **Chapter schema**（向后兼容，现 ch01 无需改写）：

```js
// data/chapters/chNN/index.js
export const CHNN = {
  id: 'chNN',                 // 'ch01'…'ch10'
  index: N,                   // 1-based 章序（用于 UI/解锁判断；可由注册表推导）
  name: '第N章 · 章名',
  subtitle?: '一句话章引',     // 章节选择 UI 副标题（可选）
  battles: [                  // 已有形状，保持不变
    { map, story, joinsAfter? },
    …
  ],
  // —— 以下为本稿新增、全部可选（缺省=安全默认），不破坏 ch01 —— 
  recommendedLevel?: 5,       // 章建议曹操等级（NG+/章节选择提示用；非强制）
  carryGuests?: false,        // 客将是否跨战留队（默认 false=仅本战；见 §2.1）
  endingBranch?: false,       // 是否结局分支章（ch10=true）
};
export default CHNN;
```

### 2.1 武将入队/离队规则（已建，明确化）
- **常驻入队**：`battle.joinsAfter:[generalId…]`（胜+outro 后 `game.addToRoster`，幂等）——已建。
- **客将（guest）**：列在该战 `map.deploy`、`faction:'wei'`、`GENERALS[].guest=true`；战后**不**回写 roster（`persistRosterFromBattle` 已按 faction+guest 过滤）。本稿仅补：跨战留队的客将由 `chapter.carryGuests` 或 per-battle 标志驱动（后续章用，ch01 不用）。
- **退场/战死**：v1 宽松——魏方阵亡者下战满血复出（`persistRosterFromBattle` 现行）。后续可加「永久战死」开关（按难度，见 §6.3），列入待确认。

---

## 3. 游戏流程状态机（形式化）

把 `main.js` 现有隐式流程提炼为显式状态机（实现期可仍以 async 编排，不强制引入状态枚举，但以此为权威流程图）。新增 **campaign 层** 包住现有「单章 runChapter」。

```
            ┌─────────────────────────────────────────────────────────┐
            ▼                                                         │
        ┌────────┐  开始征途(选难度)   ┌──────────────┐               │
START → │ TITLE  │ ───────────────►  │ NEW_GAME     │               │
        │ 标题   │  继续→读档槽       │ (newGame+难度)│               │
        │        │ ◄────────────┐    └──────┬───────┘               │
        └───┬────┘  章节选择     │           │ seedRoster            │
            │ (NG+/已通关)       │           ▼                       │
            ▼                    │    ┌──────────────┐               │
     ┌──────────────┐           │    │ CHAPTER_INTRO│ (章开场字幕)   │
     │ CHAPTER_SELECT│──────────┘    └──────┬───────┘               │
     └──────────────┘                       ▼                       │
                              ┌──────────────────────────────┐      │
                              │        BATTLE LOOP (单战)       │      │
                              │  PREP(整军,可选) → BRIEF(intro) │      │
                              │  → BUILD(建场) → PLAYER ⇄ ENEMY │      │
                              │  → RESOLVE(胜/负)               │      │
                              └───────┬───────────────┬────────┘      │
                                 胜利 │               │ 战败           │
                                      ▼               ▼               │
                              ┌─────────────┐  ┌──────────────┐       │
                              │ AFTERMATH   │  │ DEFEAT_SCREEN│       │
                              │ outro+joins │  │ 重打/回标题   │───────┘(回 TITLE)
                              │ +升级总结    │  └──────────────┘
                              └──────┬──────┘
                          非末战│            │末战
                                ▼            ▼
                       ┌──────────────┐ ┌──────────────┐
                       │ INTERMISSION │ │ CHAPTER_END  │ 章末结算
                       │ 整军+自动存档 │ └──────┬───────┘
                       └──────┬───────┘        │ 有下一章?
                              │ idx++          ├── 有 → 解锁下一章 + 自动存档 → CHAPTER_INTRO(下一章)
                              ▼                 └── 无(末章) → 通关结算 → NG+提示 → TITLE
                      (回 BATTLE LOOP)
```

### 3.1 状态职责表（对应现函数 / 新增点）

| 状态 | 职责 | 现函数 | 本稿新增 |
|---|---|---|---|
| TITLE | 标题；开始(选难度)/继续/章节选择 | `showTitle` | 难度选择步、章节选择入口、NG+ 入口 |
| NEW_GAME | `game.newGame()`+难度+seedRoster+`campaign` 初始化 | `onStart` 内 | 写 `settings.difficulty`、init `campaign` 段 |
| CHAPTER_SELECT | 列已解锁章；选定→从该章首战起 | — | 新增（§5） |
| CHAPTER_INTRO | 章开场字幕（章名/引子/天气基调） | （部分在 b1 intro）| 章级 `chapter.story.chapterIntro?`（可选，缺省跳过） |
| PREP/INTERMISSION | 整军：装备/印绶转职/学计略/(商店)/存档 | `intermission.run` | 章首可选「战前整军」（首战前也给一次，见 §3.3） |
| BRIEF | 战前剧情 intro | `runScenario(STORY.intro)` | — |
| BUILD | 按难度装配 controller/单位（§6 注入敌方等级/AI） | `setupBattle` | 难度修正注入点 |
| PLAYER/ENEMY | 回合相位 | `beginPlayerPhase`/`endPlayerTurn` | — |
| RESOLVE | 胜负 | `onBattleEnd` | — |
| AFTERMATH | outro+joins+持久化+升级总结 | `onBattleEnd(win)` 分支 | — |
| DEFEAT_SCREEN | 战败：重打本战/回标题 | `onBattleEnd(false)`+`menus.result` | （可选）难度下调建议提示 |
| CHAPTER_END | 章末结算字幕→解锁下一章/通关 | `showChapterEnd` | **跨章推进**（见 §3.2）；NG+ 触发 |

### 3.2 跨章推进（runCampaign：把 runChapter 上提）
现 `runChapter` 仅跑 `CH01`；末战后 `showChapterEnd → backToTitle`。本稿改为**章节注册表驱动的 runCampaign**：

```
runCampaign():
  while 有当前章:
    chapter = CHAPTERS[state.chapter-1]            // 1-based → 注册表
    (可选) 播 chapter.story.chapterIntro
    win = await runChapter(chapter)                // 复用现 runChapter 逻辑(改成吃 chapter 参数)
    if !win: return                                // 战败让出(DEFEAT_SCREEN 接管)
    标记 campaign.clearedChapters[chapter.id]=true
    next = CHAPTERS[state.chapter]                 // 下一章
    if next:
      state.chapter += 1; state.battleIndex = 0
      campaign.unlocked[next.id] = true
      game.save(AUTO_SLOT)                          // 章边界自动存档
      continue                                      // → 下一章 CHAPTER_INTRO
    else:
      await showGameEnd()                           // 全篇通关结算
      offerNewGamePlus()                            // §7
      return
```
- **最小改动**：`runChapter` 增一个 `chapter` 入参（默认 `CH01`，保持现签名兼容）；`main.js` 顶部 `CHAPTER=CH01` 改为读注册表当前章。
- v1 注册表只含 `ch01`，`next` 恒为空 → 行为与现状一致（通关 ch01 即结算返回），NG+ 提示可在 v1 即上（仅一章也能 NG+）。

### 3.3 整军时机
- **战间**（现状）：每战胜后、非末战 → `intermission.run` + 自动存档。保留。
- **章首/首战前**（新增，可选）：进章首战 BRIEF 前给一次「战前整军」入口（默认开），让玩家分配上章累积的印绶/宝物/装备。实现：`runChapter` 开头、首战 `idx===章起点` 时先调一次 `intermission.run({preBattle:true})`。可由设置项关闭以保持紧凑。

---

## 4. 存档系统

### 4.1 槽位与触发
- **多槽手动**：现 3 槽（`menus.saveLoad`）。手动存档入口：整军界面 + 暂停菜单（暂停存档为本稿新增到位的小项）。
- **章节边界自动存档**：写 `AUTO_SLOT=1`（现状）。本稿建议**自动槽与手动槽分离**：自动存档用专槽 `slot=0`（或保留 1，但 UI 标注「自动」），避免覆盖玩家手存。→ 列入待确认（改 `AUTO_SLOT` 与 `SLOT_COUNT` 语义）。
- **存档时点**：①每战胜后推进时（现状，续进点=下一战开头）；②章边界推进时（§3.2，新增）；③全篇通关时（写 NG+ 可用标记）。

### 4.2 存档结构扩展（向后兼容 + 迁移）
在现 snapshot 上**新增 `campaign` 段**（旧存档无此段时由 `load` 补默认 → 迁移）：

```js
// gameState 快照（扩展后）
{
  version: 2,                 // 从 1→2：load 见旧 version 时补 campaign 默认(迁移)
  savedAt, slot,
  chapter, battleIndex,       // 现状：当前进度（续进点）
  roster, inventory, storyFlags,
  settings: { muted, difficulty, textSpeed },
  // —— 新增 ——
  campaign: {
    clearedChapters: {},      // { ch01:true, … } 已通关章(章节选择/NG+ 用)
    unlocked: { ch01:true },  // 已解锁章(默认仅 ch01；通关解锁下一章)
    ngPlus: 0,                // New Game+ 圈数(0=初周目)
    seed?: 'campaignXXXX',    // 可选：本周目战役级种子(可复现)
  }
}
```
- **迁移**：`load()` 读到 `version<2` 或缺 `campaign` 时，按当前 `chapter` 推断 `unlocked`（≤当前章全解锁）、`clearedChapters`（<当前章视为已清）、`ngPlus=0`，并 `version=2`。`serializeRosterEntry/normalizeRosterEntry` 不变。
- `inventory` 已存在（未分配物品/宝物/印绶）——与道具系统 spec 对齐，无需新字段。

### 4.3 读档续进
- 现 `load(slot)` 恢复 `chapter/battleIndex/roster/...`，`runChapter` 从 `battleIndex` 钳制续进——已建。本稿仅把「续进」从单章扩到跨章：`load` 后调 `runCampaign()`（按 `state.chapter` 进对应章、按 `battleIndex` 进对应战）。
- 续进点语义：自动存档写在**战/章边界**，故读档总是从「某战开头（含其 intro）」开始，**不存战斗中途态**（与现状一致；战斗中途态不持久化，避免复杂回放）。

---

## 5. 章节选择（Chapter Select）

### 5.1 入口与可见性
- 标题屏新增「章节选择」按钮（仅当**有已通关章**或处于 NG+ 时显示；初周目首次进游戏不显示，避免剧透/误入）。
- 也可从「继续」流程旁挂：读档后若该槽 `campaign.clearedChapters` 非空，提供「回放/跳章」。

### 5.2 行为
- 列 `CHAPTERS` 中 `campaign.unlocked[id]===true` 的章（含已通关章，可重玩）。
- 选定某章 → `state.chapter=该章序`、`state.battleIndex=0`、（按设置）保留当前 roster 或回到「该章建议起点 roster」。**默认**：用当前存档 roster（带着练度回头打/跳章），避免重置养成。
- **跳章用途**：①通关后回放喜欢的章；②NG+ 起点选择；③（调试/容错）卡关时换章。
- **数据驱动**：章节选择列表由注册表 + `campaign` 段直接生成，无需额外内容文件。

### 5.3 与存档关系
- 从章节选择进入会**继续写入当前存档槽**（或先提示「另存为新槽以免覆盖正常进度」）。→ 细节列入待确认。

---

## 6. 难度选项（简单 / 普通 / 困难）

`settings.difficulty ∈ {'easy','normal','hard'}`（字段已存在，本稿赋予语义并接入 BUILD）。**只在战场装配期（`setupBattle`/controller 构造）做数值/AI 注入，不改地图内容文件**——满足「加章不改引擎、调难不改内容」。

### 6.1 难度配置表（数据驱动，集中一处便于调参）
```js
// data/difficulty.js（新增；集中难度修正系数）
export const DIFFICULTY = {
  easy:   { enemyLvDelta:-1, enemyAtkMul:0.85, enemyDefMul:0.85, enemyHpMul:0.85,
            aiAggression:0.7, playerExpMul:1.25, allowAiSmart:false,
            label:'简单 · 体验剧情' },
  normal: { enemyLvDelta: 0, enemyAtkMul:1.0,  enemyDefMul:1.0,  enemyHpMul:1.0,
            aiAggression:1.0, playerExpMul:1.0,  allowAiSmart:true,
            label:'普通 · 标准战阵' },
  hard:   { enemyLvDelta:+2, enemyAtkMul:1.15, enemyDefMul:1.1,  enemyHpMul:1.2,
            aiAggression:1.3, playerExpMul:0.9,  allowAiSmart:true,
            label:'困难 · 沙场宿将' },
};
```

### 6.2 三处作用点（注入，不改内容）
1. **敌方等级**：BUILD 时对 `map.enemies` 每个敌将 `level += enemyLvDelta`（钳制≥1）；等级经现 `leveling` 成长公式自然抬升五维。
2. **敌方数值**：构造敌方运行态单位后，对其 `atk/def/maxHp` 乘 `enemyAtkMul/enemyDefMul/enemyHpMul`（curHp 同比例）。集中在 controller 单位工厂的一个 hook，玩家方不受影响。
3. **敌方 AI**：
   - `aiAggression` 调 `battle/ai.js` 的进攻倾向（追击距离/集火残血权重/计略释放阈值）。
   - `allowAiSmart=false`（简单）时，把 `strategist`/`cautious` 性格**降级**为更直白的行为（少放控场计略、不极限拉扯），减轻新手压力；`normal/hard` 用完整 AI。
   - 现 `enemies[].ai` 性格标签**保留**（内容定的「角色性格」），难度只作全局**强度/智能上限**调节，二者叠加。

### 6.3 难度其它影响（可选，列待确认）
- `playerExpMul`：简单升级更快（鼓励体验剧情）、困难略慢。接 `leveling` 经验结算。
- **永久战死**：困难可选开启「魏方阵亡=本周目退场」（v1 现行=满血复出）。默认**关**（即便困难也宽松），作为后续硬核选项。
- 难度**可在整军界面更改**（除 NG+ 锁定外）；或仅新游戏时定、中途不可改 → 待确认（建议：可降不可升，防滥用）。

### 6.4 UX
- 标题「开始征途」→ 先出难度三选（带 `label` 说明）→ 再进 NEW_GAME。
- HUD/暂停菜单角标显示当前难度；整军界面可改（按 §6.3 规则）。

---

## 7. 通关继承 New Game+

### 7.1 触发
全篇末章通关结算后（CHAPTER_END 的「无下一章」分支），提示「以现有军容再启征途（New Game+）」。

### 7.2 继承内容（默认方案）
| 继承 | 重置 |
|---|---|
| roster 武将**等级/经验/已学计略**（练度保留） | `chapter=1, battleIndex=0`（从头打） |
| 已获**宝物**（inventory 中的 treasure 类） | `storyFlags` 清空（剧情重走；保留 `ngClearedEndings` 记忆） |
| `campaign.ngPlus += 1` | 普通消耗品/印绶可选保留或清（→待确认） |
| 解锁**章节选择全开**（已通关章可任选起点） | 战场单位为各战 deploy 重新生成（带继承练度） |

### 7.3 NG+ 难度加成（数据驱动，叠加难度系数）
```js
// 接 §6：NG+ 在所选难度基础上再叠加
ngPlusMod(ng) = { enemyLvDelta:+ Math.min(ng*3, 15),
                  enemyHpMul: 1 + Math.min(ng*0.1, 0.6),
                  enemyAtkMul:1 + Math.min(ng*0.08, 0.5) }
// 上限封顶，避免无限膨胀；与 DIFFICULTY 系数相乘/相加合成最终修正。
```
- ngPlus 圈数显示在标题/章节选择/HUD（如「征途 · 第2周目」）。
- **结局影响**：ch10 多结局可读 `campaign.ngPlus` 解锁额外尾声（§1.1）。

### 7.4 v1 范围
- v1 仅 ch01：通关 ch01 即可触发一次 NG+（带等级继承 + 难度叠加），用于验证机制；多章 NG+ 行为随后续章自然生效（注册表驱动）。

---

## 8. 模块触点（实现期对接清单）

| 模块 | 改动 | 说明 |
|---|---|---|
| `data/chapters/registry.js`（新增） | 章节注册表 `export const CHAPTERS=[CH01, …]`（按序）；`byId`/`byIndex` 查询 | runCampaign / 章节选择 / 解锁的单一数据源；加章=往这里 push 一条 |
| `data/chapters/chNN/index.js` | 采用 §2 扩展后 Chapter schema（新字段全可选） | ch01 现状即合法，无需改写 |
| `data/difficulty.js`（新增） | §6.1 难度系数表 | 集中调参；BUILD 读取 |
| `core/gameState.js` | snapshot 加 `campaign` 段；`load` 迁移(version1→2)；新增 `campaign` 读写助手（解锁/通关/NG+ 圈数） | 不 import three、不触 DOM（localStorage 除外，保持现约） |
| `main.js` | `runChapter(chapter)` 参数化；上层 `runCampaign()`；TITLE 接难度选择/章节选择/NG+；BUILD 注入难度修正；章边界存档 | 仍为「编排+事件绑定」，不内置战斗规则 |
| `battle/battleController` 或单位工厂 | 敌方单位构造时按难度系数缩放 lv/atk/def/hp（一个 hook） | 玩家方不受影响；可复现(种子不变) |
| `battle/ai.js` | 读 `aiAggression`/`allowAiSmart` 调进攻性与智能上限 | 与内容 `enemies[].ai` 性格叠加 |
| `battle/leveling.js` | 经验结算乘 `playerExpMul`（§6.3，可选） | — |
| `ui/menus.js` | 难度选择屏；章节选择屏；NG+ 提示；存档槽显示章名(`CHAPTERS.byIndex(chapter).name`)；自动/手动槽区分 | 复用现 `.panel/.big-btn/.ccz-slot` 样式 |
| `ui/intermission.js` | 章首「战前整军」入口（§3.3）；（可选）难度切换入口 | 与道具/职业 spec 的装备/印绶/学计略合并实现 |
| `story/scenarioRunner.js` | 章级 `chapterIntro` 播放；结局分支按 storyFlags/ngPlus（已支持 flags 分支） | 内容侧，引擎已具备 |
| `tests/` | 单测：①存档迁移(v1→v2) 往返；②难度系数应用到敌方数值/等级；③runCampaign 跨章推进与解锁；④NG+ 继承(等级保留/进度重置)；⑤章节注册表 byId/byIndex | 纯逻辑层(不依赖 three) |

---

## 9. 范围 / 分期

- **v1（随引擎+ch01 一起或紧随其后）**：runCampaign 状态机（含单章注册表）、存档 `campaign` 段+迁移、难度三档+BUILD 注入、章末→NG+ 闭环、存档槽显示章名。**这些与具体章内容无关**，ch01 之上即可落地验证。
- **逐章交付**：`ch02…ch10` 路线（§1）每章独立 spec→实现；本稿的引擎层对它们「零改动」接纳（加注册表一条 + 数据目录）。
- **后置/待评估**：永久战死、商店经济（ch03 起）、攻城/水战/器械(ch05/06)、多结局完整树(ch10)、客将跨战留队、战斗中途存档。

---

## 10. 与设计语料的一致性自检
- 术语：沿用 章/战役/事件、roster、joinsAfter、storyFlags、印绶、宝物、天气、五维（攻/精/防/爆/士）、11 系职业、`scenarioRunner`/`intermission`/`leveling`/`ai` 等既有命名。
- 原则：加章不改引擎（master §1）、数据驱动、每步可玩可存档、game-hub 约定（←HUB/静音/localStorage）。
- 数值：难度/NG+ 系数为本作自定占位（实现期与各章一起调平衡），非任何商业作数据。

---

## 待确认
1. **自动存档槽是否独立**：建议自动存档用专槽（`slot=0` 或保留 1 但 UI 标「自动」），避免覆盖玩家手存；是否扩 `SLOT_COUNT`/调整 `AUTO_SLOT`？
2. **章节选择写哪个槽**：跳章/回放是否要求「另存新槽」以保护正常进度，还是直接续写当前槽？
3. **难度可否中途更改**：建议「可降不可升」防滥用，或「仅新游戏定」；NG+ 是否锁难度下限？
4. **NG+ 继承粒度**：消耗品/印绶/普通装备是否继承？storyFlags 是否保留「结局已见」记忆而清其余？是否允许 NG+ 选难度？
5. **永久战死**：困难/NG+ 是否开启「魏方阵亡=本周目退场」（v1 现行=满血复出）？默认关？
6. **章首战前整军**：每章首战前是否默认给一次整军入口（§3.3），还是仅靠战间整军？
7. **结局分支条件**：ch10 多结局以哪些 storyFlags + ngPlus 阈值区分（赤壁/华容/宛城/定军等关键节点的旗标命名约定）？
8. **章数最终定型**：§1 路线图 10 章是否最终（含赤壁「可败章」、定军/宛城转折）；是否需要番外/分支章？
