# 《群雄逐鹿·孟德篇》narrative-branching — 设计稿（待审）

> 原创致敬作。剧情分支结构与机制为本作自定；人物/事件取自公有领域《三国演义》与正史，
> 对白/剧本/路由表全原创，**不复制任何商业游戏的剧情脚本、分支表或文本**。
> 与既有设计语料一致（沿用 `storyFlags`、`scenarioRunner`、`STORY{intro,outro,scenarios,triggers}`、
> `CH01{battles:[{map,story,joinsAfter?}]}`、五维 攻/精/防/爆/士、计略、天气、3 槽道具等术语与字段名）。
> 状态：**待 James 审阅**。

- **日期**：2026-06-04
- **作者**：James（顾嘉晟）+ Claude
- **范围**：剧情分支与多结局（结构性大件）——史实/忠义/霸道 三线、分歧点、章节分叉与汇合、多结局，
  及其在数据层的表达与对既有 story / 章节清单 / `gameState` 的扩展。
- **定位**：设计稿（非实现）。本期（M1·第一章）只落**地基与第一章已有 flag 的接入**，三线分化与多结局**逐章/逐期 phaseable**。

---

## 0. 设计目标与一句话主张

让长篇正传不只是「同一条线换皮」，而是「**同一段历史，玩家选择如何当这个枭雄**」。

- **一条主干、三种姿态**：曹孟德从讨董义士走到挟天子、定河北、临天下，沿途反复面对「**忠于汉室 / 顺天行权 / 唯力是图**」的取舍。三线不是平行宇宙，而是**主干上的三种倾向染色**，多数章节共用战役、在关键节点分叉再汇合，少数章节/结局专属。
- **可玩性优先**：分支必须**省成本**——绝大多数内容复用，分支体现在「**对白变体 + 少量专属战役/事件 + 结局**」，而非整章重做。这是「引擎/内容分离、长篇不烂尾」原则在叙事层的落地。
- **可见但克制**：玩家能感到选择有分量（倾向值变化、阵营态度、可见提示），但不被数值表淹没；不可逆节点要**显式预警**。

---

## 1. 三条叙事线（倾向 lean，非硬阵营）

不设硬性「选边」开关，而用一个**倾向向量**累积玩家在分歧点的姿态，章节边界据此「染色」对白与路由。

| 线 | 代号 | 内核 | 典型选择 | 招牌母题 |
|---|---|---|---|---|
| **史实线** | `loyal`→后期`han`（忠义） | 大致沿正史/演义走向：迎天子、奉天子以令不臣、终身不称帝 | 克制、护汉室名分、容人 | 「周文王」自况、不夺神器 |
| **忠义线** | `righteous` | 理想化的「匡扶汉室」：更重情义、护宗亲与降将、宁失地不负人 | 救友军、纳降不杀、还政 | 义旗、与刘备「双义」对照 |
| **霸道线** | `hegemon` | 唯力是图、宁我负人：高压扩张、屠戮立威、早行僭越 | 屠城/坑降、逼宫、夺玺称王 | 「宁教我负天下人」枭雄相 |

> 命名说明：三线代号用 `lean` 维度的三个轴 `righteous / pragmatic / hegemon`（见 §2）。
> 「史实线」≈ `pragmatic` 居中、两端不偏；"忠义"=`righteous` 高；"霸道"=`hegemon` 高。
> 这样**史实线天然是默认/居中线**，不偏科即走出最接近正史的那条，符合"致敬原作主线"的预期。

**与既有名册/客将的呼应**（沿用 class-system §5）：刘备（客将·君主）作为「忠义」的镜像参照；
郭嘉/贾诩（道士）在霸道线给出更冷酷的进言；荀彧（策士）是「汉室」良心的声音——
同一战前会议，**不同 lean 下不同人发言、同一人不同台词**（对白变体，零新战役成本）。

---

## 2. 倾向数据模型（lean）：写进 storyFlags

不新增顶层存档字段（保持 `gameState` 存档格式稳定），把倾向**收纳进现有 `storyFlags`** 的一个保留子对象，
随存档天然持久化（`game.save/load` 已整体序列化 `storyFlags`）。

```js
// game.state.storyFlags.lean —— 倾向累计（三轴打分；不写则视为全 0）
storyFlags.lean = {
  righteous: 0,   // 忠义
  hegemon:   0,   // 霸道
  // pragmatic 不单独计分：= 既不忠义也不霸道的"居中"，由派生函数算出
};
```

**派生（纯函数，建议落 `story/leanState.js`，不依赖 three/DOM，可单测）**：

```js
// 主导倾向：阈值制，钝感、滞后，避免单次选择就翻线
export function leanProfile(flags) {
  const { righteous = 0, hegemon = 0 } = (flags && flags.lean) || {};
  const spread = righteous - hegemon;
  let track = 'pragmatic';                 // 史实/居中（默认）
  if (spread >= LEAN_THRESHOLD) track = 'righteous';
  else if (spread <= -LEAN_THRESHOLD) track = 'hegemon';
  return { track, righteous, hegemon, spread };
}
// LEAN_THRESHOLD 建议 = 3（约 2~3 个同向关键选择才定调），章末才据此染色。
```

设计约束：
- **章内不变线**：`leanProfile` 只在**章节边界**（`runChapter` 推进前/`showChapterEnd` 时）求值并缓存为 `storyFlags.track`，章内对白一致，避免一战中途变脸。
- **钝感滞后**：单个分歧点对某轴 +1/+2（极端不可逆点可 +3），靠阈值与累计，不一锤定音。
- **可逆与不可逆**：多数选择只挪倾向（可被后续中和）；少数「**点（point-of-no-return）**」选择会**直接置专属 flag**（如 `slaughtered_xuzhou:true`），其影响**不可中和**——这类点单独标记并对玩家预警（§6）。

---

## 3. 分歧点（decision point）：两种来源 → 同一套 flag → 同一套路由

分歧点统一产出 `storyFlags`（含 `lean` 加分或专属布尔 flag），下游一切（对白/事件/战役选择/结局）都只读 flag，
**不读"玩家点了哪个按钮"**——这让分支可测、可存档、可被多处复用。

### 3.1 来源 A：剧情选择（scenario `choice` step）—— 已支持
现有 `choice` step 已经把 `setFlag` 写进 `storyFlags`（`dialogue.playStep` 内处理，`scenarioRunner` 已验证）。
**扩展点**：约定 `setFlag` 可带 `lean` 增量，并由一个**集中归并器**累加（而非 `Object.assign` 覆盖）。

```js
{
  type: 'choice',
  prompt: '徐州陶谦已死，城门洞开。将军，如何处置满城百姓？',
  options: [
    { text: '约束三军，秋毫无犯', setFlag: { lean: { righteous: +2 } }, note: '忠义' },
    { text: '取其府库，余者不问', setFlag: { lean: {} },               note: '中庸' },
    { text: '屠城三日，以儆诸侯', setFlag: { slaughtered_xuzhou: true, lean: { hegemon: +3 } },
      irreversible: true, warn: '此举将永久改变天下对你的看法。' }
  ]
}
```

**新增解析约定**（`story/leanState.js` 暴露 `applyChoiceFlag(flags, setFlag)`，由 `dialogue`/`scenarioRunner` 调用）：
- `setFlag.lean` 为**增量对象**（`{righteous?:+n, hegemon?:+n}`），归并器做**累加**而非覆盖；其余键照旧 `Object.assign`。
- `irreversible:true` + `warn`：标记不可逆点，UI 二次确认（§6）。`note`：可选的线别标签，用于 UI 角标提示。

> 兼容：旧 `setFlag` 不带 `lean` 仍按 `Object.assign` 工作；归并器对「值为对象且键为 `lean`」特判累加，其余不变。第一章既有 flag 全部不受影响。

### 3.2 来源 B：战场达成条件（battle achievement）→ flag
有些"姿态"不是嘴上选，而是**打出来的**：保护友军存活、纳降不杀、限回合速胜、放走败将等。
这些在战斗结算时由 `scenarioRunner.triggersFor(on)` 的**新 `on` 类型**或 outro 前的一次评估写 flag。

约定一个**战后达成评估**（在 `battle:win` 后、`outro` 前跑一次，建议落 `battle/achievements.js`，纯逻辑可单测）：

```js
// map.achievements: 战后据战场终态评估 → 写 storyFlags（含 lean 增量）
map.achievements = [
  { id: 'spared_huaxiong', when: { foeFled: 'huaxiong' },         setFlag: { lean:{righteous:+1}, spared_huaxiong:true } },
  { id: 'gongsun_alive',   when: { allyAlive: 'gongsun_zan' },    setFlag: { lean:{righteous:+1} } },
  { id: 'blitz_clear',     when: { clearedByTurn: 6 },            setFlag: { lean:{hegemon:+1}, blitz:true } },
  { id: 'no_retreat',      when: { weiCasualties: 0 },            setFlag: { honor_intact:true } },
];
```

`when` 判据（对战场终态/事件日志求值，全部纯函数）：
- `foeFled / foeAlive / foeKilledBy`、`allyAlive / allyDead`、`clearedByTurn:n`、`weiCasualties:n`（≤n）、`captured:'siteId'`、`reached:{c,r,by}`。
- 复合：`all:[...]` / `any:[...]`，与既有 victory 复合条件风格一致（§victory 留口子见 srpg-design §3.9）。

> 也允许**战中即时**写 flag：扩展 `STORY.triggers` 的 `on` 取值（现仅 `'turnStart'`）到 `'unitDied' | 'reached' | 'captured'`——
> 这些事件 battleController 已 emit（`unit:died` / `unit:moved` / capture 评估）。触发器除播 `scenarioId` 外可带 `setFlag`，
> 由 `scenarioRunner` 在派发时归并进 `storyFlags`。第一章先只用战后 `achievements`，战中即时写 flag 列为后续。

### 3.3 分歧点 ≠ 每章都有
节奏建议：**每章 0~2 个有效分歧点**（多为对白选择，偶有战场达成），其中**不可逆点全篇 ≤4 个**，集中在天下观转折处
（如：徐州、奉迎天子、官渡处置降卒、晚年僭越）。其余选择只做对白/小事件变体，不动倾向值——避免"选择疲劳"和分支爆炸。

---

## 4. 章节分叉与汇合（菱形结构，不是树）

**核心结构 = 钻石（diamond）**：主干 → 在节点按 `track` 短暂分叉（专属战役/事件）→ **下一章汇合回主干**。
绝不让三线无限发散成三棵独立的树（那是烂尾之源）。

```
        ┌─(righteous 变体战/事件)─┐
主干章 ──┼─(pragmatic：直接主干)──┼──→ 汇合 → 下一主干章 → …
        └─(hegemon 变体战/事件)──┘
```

实现成三类**章节产物**：
1. **共享战役（绝大多数）**：同一 `map` + 同一 `story`，story 内对白用 `track` 做**变体**（§5）。零分叉成本。
2. **变体战役（少数）**：同一章里，按 `track` 选**不同 `map`/`story`**（如霸道线打"屠城阻击"、忠义线打"护民撤退"）。
3. **专属章/专属结局战（极少数）**：仅某 `track` 可达（如霸道线"逼宫"小章）。

**汇合纪律**：任何分叉**最迟在下一章开头汇合**，汇合点对"分叉期间发生的事"只用 flag 记一笔（影响后续对白/可用宝物/某人生死），
不让战役结构持续分裂。这样 N 章的战役总数 ≈ 主干数 + 少量变体，可控。

---

## 5. 数据层表达：章节清单按 route 选战役 + story 对白变体

### 5.1 章节清单扩展（`CH0x/index.js`：`battles[]` 增 `route` 与 `variants`）

现状（ch01）：`CH01 = { id, name, battles:[ { map, story, joinsAfter? } ] }`。
**向后兼容地扩**为：每个 `battle` 既可是「单一 map/story」（如今），也可声明**按 route 取变体**。

```js
// 通用战役条目（两种写法二选一；保持旧写法 100% 兼容）
// A) 固定战（现状，主干共享战役最常用）：
{ map, story, joinsAfter? }

// B) 变体战（同一战序位，按 track 选不同 map/story）：
{
  id: 'b3',                 // 该战序位的稳定 id（存档/路由引用）
  joinsAfter?: [...],
  variants: {
    default:   { map: b3Map,    story: b3Story    },  // 必填：主干/兜底
    righteous: { map: b3RMap,   story: b3RStory   },  // 选填：忠义线变体
    hegemon:   { map: b3HMap,   story: b3HStory   },  // 选填：霸道线变体
  },
  // 可选：整条战序位仅某些 track 出现（条件战）。不满足则该序位被跳过。
  appearsWhen?: { trackIn: ['hegemon'] },             // 例：霸道线专属"逼宫"战
}
```

**章节选战解析器**（`story/chapterRouter.js`，纯逻辑、可单测）：
```js
// 给定一章 battles[] + 当前 storyFlags → 解析出"本周目实际要打的战役序列"
export function resolveBattles(chapter, flags) {
  const track = (flags && flags.track) || leanProfile(flags).track;
  const out = [];
  for (const b of chapter.battles) {
    if (b.appearsWhen && !matchAppears(b.appearsWhen, flags, track)) continue; // 条件战跳过
    if (b.variants) {
      const pick = b.variants[track] || b.variants.default;
      out.push({ id: b.id, map: pick.map, story: pick.story, joinsAfter: b.joinsAfter });
    } else {
      out.push(b); // 旧写法：固定战
    }
  }
  return out;
}
```

`main.js` 接入点（最小改动，见 §7）：`runChapter` 不再直接读 `CHAPTER.battles`，而是
`const battles = resolveBattles(CHAPTER, game.state.storyFlags)`；其余循环（intro→战斗→outro→joins→存档）不变。

> **存档稳定性**：用 `battle.id`（'b3'）而非数组下标作为续进锚点，避免"换 track 后下标错位"。
> `game.state.battleIndex` 仍是序号（兼容现状），但建议**追加** `storyFlags.lastBattleId`，
> 载入时优先按 id 在 `resolveBattles` 结果里定位续进点，找不到再回退到 `battleIndex`。该追加项可后置。

### 5.2 story 对白变体（同一 `story` 内按 track 走不同 steps）

绝大多数分支只是**话不同**。为此扩 `scenario` 的 step 一个**条件分组**类型，`scenarioRunner` 解释时按当前 `track`/flag 取分支：

```js
// 新 step 类型：'branch'（按 flag/track 选择一组子 steps；选不中走 else）
intro: {
  id: 'ch0x_b1_intro',
  steps: [
    { type: 'narrate', text: '官渡对垒，粮尽援绝，许攸夜来献策……' },
    { type: 'branch', on: 'track', cases: {
        righteous: [ { type:'say', who:'caocao', text:'纵得袁绍之地，岂可坑此降卒？传令，编入行伍。' } ],
        hegemon:   [ { type:'say', who:'caocao', text:'降而复叛，徒留后患。——尽坑之。' },
                     { type:'setFlag', flag:{ keng_jiangzu:true, lean:{ hegemon:+2 } } } ],
      },
      else: [ { type:'say', who:'caocao', text:'择其精壮录用，老弱遣归乡里。' } ]   // pragmatic/史实
    },
    { type: 'camera', preset: 'iso' }
  ]
}
```

`scenarioRunner` 对 `'branch'`：求 `on`（`'track'` 或某 `flag` 键）→ 命中 `cases[key]` 则**递归执行其子 steps**，否则跑 `else`。
向前兼容：未知 step 现有逻辑已"忽略"，故旧 story 不受影响；`'branch'` 子 steps 复用同一 `run` 循环（含 `choice/setFlag/duel/camera`）。

> 这样一份 story 文件即可承载三线对白，**无需为变体多开文件**——只有"打的地图都不同"时才用 §5.1 的 `variants` 多文件。

---

## 6. 给玩家的可见度与不可逆提示（UX）

叙事分支若玩家无感，等于没做；若处处弹窗，又劝退。原则：**倾向无声累积，转折显式预警，回顾随时可查**。

1. **选项角标（轻提示）**：`choice` 选项可带 `note`（'忠义'/'霸道'/'中庸'）→ 对话框在选项右侧显示小角标（沿用 `ui/dialogue` 的对话框样式）。让玩家**知道这是个有倾向的选择**，但不剧透后果数值。
2. **不可逆二次确认（强提示）**：选项带 `irreversible:true` → 选中后弹一行确认（`warn` 文案，如"此抉择无法挽回，确定？"）+「确定/再想想」。仅不可逆点才弹，保持稀有与分量。
3. **倾向风向标（可查不强推）**：整军界面（`ui/intermission`）加一处只读「天下声望」面板，用**文字描述**当前姿态（如"诸侯多以义士目你"/"枭雄之名渐起"），**不暴露原始分值**，避免玩家"刷数值"。鼠标悬停给一句解释。
4. **章末染色回顾**：`showChapterEnd` 字幕里据 `track` 给一句定调旁白（史实/忠义/霸道各一版），让玩家感到"这一章我走出了某种味道"。
5. **存档可读性**：`listSaves` 元信息可附 `track` 标签（如"霸道·官渡前"），让多周目玩家分辨存档走向（后置项）。
6. **多周目友好**：结局后解锁"已见结局"记录（存 `localStorage` 独立键，跨存档），鼓励再走另一条线——这是三线设计的复玩价值兑现处。

---

## 7. 模块触点（最小侵入；逻辑层可单测）

| 模块 | 改动 | 性质 |
|---|---|---|
| `story/leanState.js` **(新)** | `leanProfile(flags)`、`applyChoiceFlag(flags,setFlag)`（lean 累加归并）、阈值常量 | 纯逻辑·可单测 |
| `story/chapterRouter.js` **(新)** | `resolveBattles(chapter, flags)`、`matchAppears(...)` | 纯逻辑·可单测 |
| `battle/achievements.js` **(新)** | `evaluateAchievements(map, finalUnits, log) -> setFlag[]`（`when` 判据求值） | 纯逻辑·可单测 |
| `story/scenarioRunner.js` | 新增 `'branch'` step 解释；`choice/setFlag` 改走 `applyChoiceFlag`（lean 累加）；触发器可携 `setFlag`（后续） | 解释器扩展·向前兼容 |
| `story/dialogue.js` | `choice` 选项渲染 `note` 角标 + `irreversible` 二次确认；`setFlag` 走归并器 | UI |
| `core/gameState.js` | **无需改存档格式**；倾向/专属 flag 都进现有 `storyFlags`。可选追加 `storyFlags.lastBattleId`、`listSaves` 附 `track` | 兼容·可选 |
| `main.js` | `runChapter` 改用 `resolveBattles(CHAPTER, storyFlags)` 取战序；`battle:win` 后 `outro` 前调 `evaluateAchievements` 写 flag；章末按 `track` 求 `leanProfile` 并缓存 `storyFlags.track` | 编排接线 |
| `ui/intermission.js` | 「天下声望」只读面板（文字描述当前姿态） | UI·可后置 |
| `data/chapters/ch0x/index.js` | 战役条目支持 `variants`/`appearsWhen`/`id`（旧 `{map,story}` 仍可用） | 数据 schema 扩展·兼容 |
| `data/chapters/ch0x/*.story.js` | 用 `'branch'` step 写对白变体；`choice` 选项加 `lean`/`note`/`irreversible` | 内容 |

**边界**：路由/倾向/达成判定全在 `story/`、`battle/` 纯逻辑层（不依赖 three/DOM，进 `tests/`）；`main.js` 仅接线；UI 仅展示。符合 srpg-design §5「battle/story 纯逻辑可测、render3d/ui 各司其职」的模块边界。

---

## 8. 第一章已有 flag 如何接入（不返工，渐进点亮）

第一章 5 战已写入这些 flag（来自现有 story 文件）：
`ch01_b1_started / raisedBanner / clearYellowFirst / ch01_b1_cleared / ch01_b1_reinforced …`（b2–b5 同理各自 cleared/分支 flag）。

接入策略——**第一章不引入真正的三线分叉**（保持现有 5 战线性、可玩、已联调），只做"地基铺设 + 倾向起步"：

1. **现有 flag 全部保留**，语义不变；它们继续驱动各战 outro/后续对白的细节（如 `clearYellowFirst` 影响 b2 开场一句台词）。
2. **给第一章的关键选择补 `lean`/`note`（轻量）**：
   - b1「起兵！讨贼以正天下」→ `lean:{righteous:+1}`，note '忠义'；「先扫黄巾，再图董卓」→ 中庸（不加分）。
   - b4 三英战吕布相关、b5 荥阳追击的"力主追击/持重待时"等既有/可加选择，按姿态各给 ±1 倾向 + note。
   - 这些只让**倾向值起步**，第一章内**不据此分叉战役**（`track` 直到第二章边界才生效），玩家无感但已在攒姿态。
3. **接入 `chapterRouter`（透明）**：`runChapter` 改用 `resolveBattles(CH01, storyFlags)`——因 ch01 全是旧写法 `{map,story}`，
   解析结果与现状**完全一致**，零行为变化，只是把接线就位，方便后续章节直接用 `variants`。
4. **接入 `evaluateAchievements`（可选起步）**：给 b1 加一条无害成就（如 `weiCasualties:0 → honor_intact`），验证战后写 flag 通路；不影响胜负。
5. **章末染色**：`showChapterEnd` 末尾据 `leanProfile` 加一句旁白变体（史实/忠义/霸道），作为三线"第一次发声"，并缓存 `storyFlags.track` 供第二章读取。

> 结论：第一章作为"地基章"——既有内容零返工，新增的是**可被忽略的倾向积累 + 路由/达成接线**。三线的真正分叉从**第二章（濮阳/兖州）**起步，多结局在北极星后期收束。

---

## 9. 多结局（北极星后期，phaseable）

结局 = 一组**专属结局战 + 结局过场**，由终章 `appearsWhen`/`branch` 按 `track` 与若干关键 flag 选定。建议 3 主结局 + 若干尾声变体：

| 结局 | 触发（示意） | 基调 |
|---|---|---|
| **周文王**（史实/默认） | `track==='pragmatic'`，未僭越（无 `usurped`） | 奉天子终身，遗业付子——最接近正史的收束 |
| **匡汉义雄**（忠义） | `track==='righteous'` 且 `righteous` 高、关键护汉 flag 齐 | 还政或扶汉，与刘备"双义"对照的理想化结局 |
| **乱世奸雄**（霸道） | `track==='hegemon'` 且 `usurped/keng_jiangzu/slaughtered_*` 等 | 称王僭越、孤家寡人式的枭雄登顶 |
| **尾声变体** | 由分散 flag（某将生死、某宝物、某降将去留）拼装 | 同一结局下的小字幕差异，低成本提复玩 |

结局战与终章在对应章 spec 里再细化；本稿只锁定**用同一套 `track` + flag + `appearsWhen/branch` 机制**表达，不引入新机制。
"已见结局"记录存 `localStorage` 独立键（不污染战局存档），用于多周目解锁与回顾。

---

## 10. 防分支爆炸的纪律（写给实现期）

1. **菱形优先**：能用对白 `branch` 解决的，绝不开新战役；能在下一章汇合的，绝不让分叉跨多章。
2. **flag 命名规范**：倾向走 `storyFlags.lean.{righteous|hegemon}`；事件留痕走 `snake_case` 布尔（`keng_jiangzu`/`spared_*`/`slaughtered_*`）；章战进度沿用现有 `chNN_bM_*` 前缀。
3. **专属内容预算**：每章变体战 ≤2、专属章 ≤1；不可逆点全篇 ≤4。超预算先砍内容、再谈结构。
4. **可测性**：每个分歧点的 flag 产出、每条 `resolveBattles` 路由、每个结局触发，都要有 `tests/` 用例（给定 flags → 期望 track/战序/结局）。
5. **存档前向兼容**：新 flag 只增不删；老存档缺 `lean` 视为全 0（`pragmatic`）；schema 不破坏。

---

## 待确认

1. **三线命名**：对外用「史实/忠义/霸道」还是内部代号 `pragmatic/righteous/hegemon`？是否要把"史实线"显式叫"史实"以呼应致敬定位？
2. **倾向可见度**：整军面板用**纯文字描述**姿态（不露分值）是否够？还是要一个直观的"忠义↔霸道"刻度条？
3. **不可逆点数量与位置**：全篇 ≤4 个是否合适？徐州/奉迎天子/官渡降卒/晚年僭越 这 4 个候选点认可吗？
4. **第二章起分叉**：三线真正分叉放在第二章（濮阳/兖州）起步，是否与后续章节 spec 的节奏一致？
5. **`branch` step vs 多 story 文件**：对白变体走单文件内 `'branch'`（省文件、长文件）；地图不同才多开 `variants` 文件——这个分界 OK 吗？
6. **续进锚点**：是否本期就追加 `storyFlags.lastBattleId`（按战 id 续进，换 track 更稳），还是先沿用 `battleIndex` 下标、待变体战真正出现再加？
7. **achievements 战中即时 vs 战后评估**：第一章只用**战后 `evaluateAchievements`**，战中即时写 flag（扩 trigger `on` 类型）列后续——认可吗？
8. **多结局数量**：3 主结局 + 尾声变体的规模是否符合预期，还是后期愿意扩到 5+？
9. **倾向阈值 `LEAN_THRESHOLD=3` 与单次加分（±1/±2，不可逆 +3）** 的手感，是否需要在第一章实玩后再调？
