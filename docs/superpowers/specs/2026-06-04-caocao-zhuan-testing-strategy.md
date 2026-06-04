# 《群雄逐鹿·孟德篇》testing-strategy — 设计稿（待审）

> 测试策略总纲：怎么把这套原创三国 SRPG（5 维属性 攻/精/防/爆/士 + MP、11 系职业、计略、天气、印绶、道具、faction、storyFlags、伤害预测、跨章 runCampaign）测稳、测准、测得起。
> 核心主张：**纯逻辑层用 Node 直跑 `.mjs` 断言测全；render3d/ui 用 Playwright 只做冒烟（不做像素回归）；「预测=实跑」一致性用一套统一 property-based 框架兜，而非各模块各写各的。**
> 本稿只定**测试口径与基础设施**，不重定义数值/谓词/步骤——数值以 `balance-master` 为准、战场谓词与 scenario 步骤目录以 `content-pipeline` 为准、字段模型以 `stat-migration` 为准，本稿一律 **import / 引用** 这三份权威稿。状态：**待 James 审阅**。

---

## 0. 现状盘点（事实，作为基线）

- 测试 = 纯 Node ESM `.mjs`，**无测试框架**：每文件 `import assert from 'node:assert'`，跑断言，末尾 `console.log('<mod> ok')`，靠退出码（断言抛错=非 0）判定。运行方式：`node games/caocao-zhuan/tests/<x>.test.mjs`。
- 现有 **12 个**纯逻辑单测（`tests/*.test.mjs`）：`combat / skillEngine / statuses / victory / classTriangle / leveling / pathfind / ai / ai_strategist / duel / duelAi / battleController`。
- 被测纯逻辑模块（`src/battle/*` + `core/rng.js`）严格禁止 `import three` / 触 DOM；`gameState.js` 仅碰 `localStorage`（且有 `getStore()` 兜底，Node 下返回 `null` 不崩）。
- 随机性已可注入：`core/rng.js` 的 `makeRng(seed)`（mulberry32，seed 可数字/字符串）→ 所有结算（`resolveAttack`/`resolveSkill`/`Duel`/`ai`）都吃外部 `rng`。**确定性测试的地基已经在了。**
- `package.json` 无 `scripts`、无 devDeps；Playwright 仅以 `npx`（缓存版 1.60.0）形式可用；项目以 `start.sh`（python http.server 或 `npx serve`）做静态服务。
- 存档：键 `save_caocao_v1_slot{n}`，`version` 现为 **1**；campaign-structure 稿将升 **v2**（新增 `campaign` 段 + `load` 迁移）。本稿负责定**迁移测试矩阵**。

> 结论：基础设施轻量但够用，**不引入 vitest/jest**（成本敏感 + 当前 0 依赖很干净）。本稿只加一个**零依赖 runner 脚本**统一跑全量 + 出退出码，外加 Playwright 冒烟脚本。

---

## 1. 纯逻辑单测口径（第一层，覆盖率主力）

### 1.1 测试风格（沿用现状，固化为规范）
- 文件：`tests/<module>.test.mjs`，一文件对一个 `src/` 模块（或一个紧耦合簇）。
- 只 import 被测纯模块 + `node:assert` + `core/rng.js`；**禁止** import `render3d/* | ui/* | audio/* | three`。若某测试需要这些，说明被测模块越界了，应先重构。
- 随机性一律走注入 rng：定值桩（`() => 0.5`）测确定分支，或 `makeRng(固定seed)` 测序列。**绝不**用 `Math.random()`。
- 断言带中文 message（与现有风格一致）；末尾 `console.log('<mod> ok')` 作人读信号。
- 纯函数原则：被测结算函数**不得 mutate 入参**（`resolveAttack`/`resolveSkill` 已遵守，返回 effects 由 controller 应用）——测试里复用同一 unit 对象多次调用、断言入参未变，作为纯度回归。

### 1.2 新增模块单测清单（跟随各设计稿落地，逐个补）
按 corpus 各稿引入的新模块，每个**至少**列出必测契约点（具体数值以 `balance-master` 为准，本稿只列“测什么”）：

| 新模块 | 来源稿 | 必测点 |
|---|---|---|
| `battle/forecast.js`（`predictAttack`/`predictSkill`） | damage-preview | 命中%/伤害区间[min,max]/willKill/反击预测/连击%/致命%——**全部由 §4 一致性框架覆盖**，外加边界（miss 区间、克制极值、def 压满 floor=1）|
| `battle/combat.js` 重构出的 `coreHit()`/`coreDamage()` 纯算核 | damage-preview | 无随机、给定 jitter 返回确定值；`resolveAttack` 与 `forecast` 都调它（§4 锚点）|
| 5 维属性派生（`武力/智力/统率/敏捷/运气 ÷2 + growth → 攻/精/防/爆/士`）+ MP | **stat-migration**（权威） | 派生公式 round 口径、成长曲线、MP `maxMp/curMp` 钳制；从 4 维旧档迁移到 5 维（见 §5）|
| 爆发(crit)/士气(morale) 衍生：连击率、致命率、命中 | stat-migration + balance-master | 公式输入是“爆差/士差”而非旧 spd；clamp 边界 |
| `battle/weather.js`（晴/雨/雾/雪…对命中/计略/移动/火属性的修正） | weather-system | `setWeather` 后修正乘子；雨削火、雾削命中等方向正确；缺省晴=恒等 |
| `battle/affinity.js`（兵种×地形 footprint 相性 atk/def 修正） | terrain-affinity | 相性表查表、缺省 1；与 combat/skill 的乘子接入点 |
| `data/items.js` + 道具效果（3 槽、印绶 Lv15/30 转职） | item-system / class-system | 装备改派生属性、印绶解锁转职门槛、3 槽上限 |
| `economy/shop.js`（金钱、买卖、掉落） | economy-shop | 价格表、买卖差价、库存/上限；难度三档系数（引 balance-master）|
| `recruit/recruitment.js`（招降、客将 `guest:true`） | recruitment-allies | 招降判定、`addToRoster` 幂等、**客将 guest 字段**进/不进常驻 roster |
| `progression/leveling.js` 扩展（印绶转职、技能习得） | progression-leveling | 升级属性增量、转职改 classId 后派生重算、技能解锁等级 |
| `data/chapters/registry.js`（章节注册表） | campaign-structure | `byId`/`byIndex`、`next` 链、解锁推断 |
| `core/gameState.js` campaign 段 + 读写助手 | campaign-structure | 解锁/通关/NG+ 圈数读写（迁移见 §5）|
| **共享谓词库** `battle/predicates.js`（`allyAlive`/`reachedCell`/`foeFled`/`clearedByTurn`…）| **content-pipeline**（权威） | 每个谓词对给定 battleState 的真值；victory/achievements/ai **都 import 同一份**（见 §6.1）|
| **scenario 步骤目录**（`branch`/`setWeather`/`retreat`/`spawnWave`/`setBossPhase`/`tutorial`/`recruit`/`leave` + 现有 `narrate/say/choice/camera/setFlag/duel`）| **content-pipeline**（权威，注册到 scenarioRunner）| 每个 step 类型的解释结果 + **未知 step 静默跳过**的向前兼容（现 `scenarioRunner` 已有此兜底）|

> 凡“数值是否合理”的判断（伤害是否过高、金钱是否够用、难度系数取值）**不在单测里硬编码具体数**，而是在 `balance-master` 稿里定基线、单测只断言“按引入的常数算出来等于 X”。常数改了，改 balance 稿 + 改一处期望值，不散落。

---

## 2. 集成测试（第二层：跨模块 + 跨章流程）

集成测试也是纯 Node `.mjs`（仍禁 three/DOM），但**多模块协同**、跑“一整段流程”。放 `tests/integration/`。

### 2.1 `runCampaign` 跨章流程（headless 推进）
campaign-structure 把单章 `runChapter` 上提为 `runCampaign()`。但现 `main.js` 里编排与渲染/UI 耦合。**前置重构（列入实现 plan）**：把 runCampaign 的**纯状态机内核**抽到不依赖 three/DOM 的模块（如 `core/campaign.js`），渲染/音频只经 bus 被动消费。测得到的是这个内核。

- **测点**：
  1. 注册表驱动：`CHAPTERS.byIndex` 顺序、`next` 链；末章 `next` 空 → 结算返回。
  2. 自动战斗推进：注入一个**脚本化 AI / 自动决胜钩子**（见下），让 `BattleController` 跑到 `battle:win`，断言 `chapter/battleIndex` 正确 +1、`storyFlags`/`campaign.clearedChapters` 更新、章末触发 NG+ 提示。
  3. 续进钳制：`load` 一个 `battleIndex=2` 的档 → `runCampaign` 从该战续进，不重跑前两战。
  4. NG+：通关 ch01 → NG+ 圈数 +1、等级继承、进度重置、难度叠加（系数引 balance-master）。
- **自动决胜钩子**：集成测试不真打满图，提供测试专用 helper `forceWin(controller)` / `forceLose(controller)`（直接置敌方 `alive=false` 或 wei 全灭后调 `_checkEnd()`），验证 runCampaign 对 `battle:win`/`battle:lose` 事件的编排反应，而非验证战斗本身（战斗由 §1 单测保证）。
- **bus 录制断言**：集成测试订阅 `bus`，记录 emit 序列（`turn:changed`/`battle:win`/`scenario:done`/`camera:cinematic`…），断言**事件序列**符合预期（编排正确性的主要观测面，因为内核不渲染）。

### 2.2 一战完整流程（部署→玩家相→敌方相→胜负→结算→存档）
- 用 `ch01/b1_chenliu` 真实 map+story 构 `BattleController`，固定 seed。
- 脚本化若干玩家动作（move/attack/skill）→ `endPlayerTurn` → `runEnemyTurn`（AI 吃固定 seed，结果可复现）→ 直到 `battle:win`。
- 断言：经验结算（KILL_EXP/HIT_EXP/DUEL_EXP）落到 roster、`persistRosterFromBattle` 把 `curHp/level/exp` 写回、客将不入常驻 roster。
- **触发器**：在 `turn:changed`/`unit:died` 时机断言 `triggersFor(on)` 命中正确的 scenarioId（剧情 trigger 与战斗时机对齐）。

### 2.3 scenarioRunner 解释器集成
- 喂一段含 `branch/choice/setFlag/setWeather/recruit/spawnWave` 的合成 story，注入 mock ctx（`controller` 用真 BattleController，`duelView`/`camera` 用记录式 mock，`audio` 缺省静默）。
- 断言：`branch` 按 `track`/flag 走对子 steps、`setFlag` 写进 `storyFlags`、`setWeather` 改战场天气、`recruit`/`leave` 改 roster、`spawnWave` 往 controller 加敌、`scenario:done` emit。
- **向前兼容回归**：故意塞一个未知 `type` step，断言被静默跳过、后续 step 照跑（这是现有契约，content-pipeline 扩步骤目录后必须保持）。

### 2.4 存档迁移往返（v1 ↔ v2）
独立成 §5（矩阵），此处只声明它属于集成层、用内存 mock localStorage（见 §5.1）。

---

## 3. render3d / ui Playwright 渲染冒烟脚本规范（第三层：只冒烟，不像素回归）

**定位**：three/DOM 层不写单测（成本与脆性都高）。Playwright 只回答两个问题：**(a) 页面能起、关键场景能进、无 console error / 未捕获异常；(b) 关键场景的画面“非空且结构对”（截图人工核对 + 少量 DOM/canvas 断言），不做逐像素 diff。**

### 3.1 基础设施
- 复用缓存 Playwright 1.60.0：脚本走 `node tests/e2e/<x>.smoke.mjs`，内部 `import { chromium } from 'playwright'`（解析到 npx 缓存目录；或在 game 目录 `npm i -D playwright` 后本地解析——**二选一，待确认**，倾向后者以稳定）。
- 起服务：脚本内 spawn `python3 -m http.server <port>`（复用 start.sh 的逻辑，但**不**自动 open 浏览器），`baseURL = http://localhost:<port>/games/caocao-zhuan/`。结束 kill 子进程。
- **localhost / 代理注意（关键，易踩坑）**：CI / 本机可能设了 `HTTP_PROXY`/`HTTPS_PROXY`，会让 headless Chromium 把 `localhost` 也走代理 → 连不上本地 http.server。脚本启动前**强制** `NO_PROXY=localhost,127.0.0.1`（并清掉对 localhost 的代理），或给 chromium `launch({ proxy: { server: 'direct://' } })`。这条写进规范，避免“本地能跑 CI 连不上”。
- 浏览器：`chromium.launch({ headless: true })`；视口固定（如 1280×720）保证截图可比。

### 3.2 必测冒烟场景（每个：进入 → 等就绪信号 → 截图 → 断言）
| 场景 | 进入方式 | 就绪信号 | 断言 |
|---|---|---|---|
| 标题页 | `goto baseURL` | DOM 出现标题菜单节点 | 无 console error；菜单按钮存在 |
| 战斗主视图（ch01 b1） | 走“新游戏→跳过过场→进战” 或 `?battle=b1&skipIntro=1` 调试参数（**需在 main.js 加调试入口，列入实现 plan**） | `bus` emit `battle:ready` → 页面置一个 `data-battle-ready` 标记或 `window.__battleReady=true` 供 `waitForFunction` | canvas 尺寸 > 0；HUD 节点存在；截图存盘 `e2e/__shots__/battle.png` |
| 计略/伤害预测浮层 | 进战 → 选我方 → 攻击模式 → hover 敌人 | forecast 浮层节点可见 | 浮层含命中%/伤害文本（断言文本格式，不断言具体数）；截图 |
| 单挑演出 duelView | 触发剧情 duel（合成或调试入口） | `duel:start` → duelView 节点 | 无异常；演出结束 emit；截图 |
| 过场对白 | 标题→新游戏 intro | dialogue 节点出现文字 | 文字非空；choice 可点；截图 |

- **截图核对**：截图归档到 `tests/e2e/__shots__/`（git ignore 或单独目录）。规范是**人工目检 + 尺寸/非全黑校验**（可加一个“截图非纯色”的轻量像素抽样断言，防白屏/黑屏），**不**做 baseline diff（渲染稿仍在演进，逐像素 baseline 会天天红）。后期稳定后再考虑对“标题页”这类静态场景加 baseline。
- **就绪信号契约（要 audio-presentation / ui-ux 配合）**：渲染层在关键节点 emit bus 事件并设 `window.__caocaoReady` 标记，Playwright 用 `waitForFunction` 等它，**禁止 `waitForTimeout` 硬等**（脆 + 慢）。这条作为对渲染/UI 稿的接口要求记在待确认。

> 范围声明：Playwright 层**可 phase 后置**——v1 先保“标题页 + 战斗主视图能起且无 error”两条命脉冒烟即可上 CI；预测浮层/单挑/过场截图随对应 UI 落地再补。

---

## 4. 「预测=实跑」property-based 一致性框架（核心，统一兜底）

**问题**：damage-preview 要 `forecast.predictAttack/predictSkill` 与 `combat.resolveAttack`/`skillEngine.resolveSkill` **同输入、同公式**。若各模块各写各的期望值，公式一改两边漂移、测试也漂移。**方案：一套统一的 property-based 一致性校验器，对随机生成的大量场景，断言“实跑落在预测区间内、预测概率与实跑频率自洽”。**

### 4.1 前提（依赖 damage-preview 的重构落地）
damage-preview 已规定把 `combat.js` 拆出**无随机纯算核** `coreHit()`/`coreDamage()`，`resolveAttack` 与 `forecast` 都调它。skillEngine 同理拆 `coreSkillHit()`/`coreSkillDamage()`。一致性框架**就锚在这层**——只要两边都过同一算核，区间端点必然来自同一 `jitter∈[LO, LO+SPAN)` 与同一命中公式。

### 4.2 框架 API（新文件 `tests/lib/consistency.mjs`，零依赖）
```js
// 通用属性断言器：对 N 个随机场景，逐个校验 forecast 与实跑自洽。
// genCase()        -> { attacker, defender, map, weather }（随机但合法的对局快照）
// runOnce(case,rng)-> resolveAttack 的实跑结果（吃注入 rng）
// predict(case)    -> forecast 的纯预测（无随机）
checkAttackConsistency({ seed, n, genCase });
checkSkillConsistency({ seed, n, genCase });
```
内部对每个 case：
1. **区间正确性**：用同一 seed 的 rng 实跑 K 次（K 跑遍 jitter 谱的两端附近），断言每次 `dmg ∈ [predict.dmgMin, predict.dmgMax]`，且实测 min/max 收敛到预测端点（容差 0：因端点来自同一算核给定 jitter 端点）。
2. **命中频率↔预测概率**：实跑 M 次（大样本），断言命中频数 / M ≈ `predict.hitPct/100`（二项分布容差，如 `|freq − p| < 3·sqrt(p(1−p)/M)`，3σ）。连击/致命率同理（若引入）。
3. **willKill 自洽**：当 `predict.willKill === true`，断言任意实跑（命中时）都 `killed===true`（即预测“必杀”当且仅当 `defender.curHp ≤ dmgMin`）；`false` 时存在不杀的实跑或 `dmgMax < curHp`。
4. **反击对称**：`predict.counter` 的有/无与实跑 `res.counter` 的有/无一致（取决于 counterRange 与存活，纯几何，必须 100% 一致）。
5. **纯度**：predict 与 runOnce 都不得 mutate `case`（前后深比较）。

### 4.3 覆盖矩阵（genCase 的随机维度）
随机但合法地撒点覆盖：兵种克制三角全 11×11 组合的代表、地形（grass/forest/hill/water/gate…）、天气（晴/雨/雾/雪）、状态（中毒/虚弱/士气增减）、装备修正、爆/士极值、HP 临界（正好够杀 / 差 1）。每维度固定 seed 可复现；失败时打印 `case` + seed 便于定位。

### 4.4 为什么是一套而非各写各
- victory/ai/forecast/UI 全都“读同一公式”；一致性框架是**公式正确性的单一真相点**——公式改了，这套测一处红，而不是“UI 测过了但 AI 算的伤害不一样”。
- AI（`ai.js`/`ai_strategist.js`）做决策时若用 forecast 估收益，则 AI 估的伤害=玩家看的伤害=实际打的伤害——三者同源。框架顺带覆盖“AI 用的是同一 forecast”这条（断言 AI 内部估值调用的就是 `forecast`，而非另算一份）。

> 这套是**新增的、横切的**，不属于任何单一系统稿；它消解了 damage-preview / enemy-ai / ui-ux 三处“各自验证伤害预测”的潜在重复（见 §7）。

---

## 5. 存档迁移测试矩阵（v1 → v2 往返）

### 5.1 测试基建：内存 localStorage
Node 下 `gameState.getStore()` 返回 `null`（存档静默 no-op），无法测迁移。**测试用内存 polyfill**：在 import `gameState.js` 前 `globalThis.localStorage = makeMemStore()`（实现 `getItem/setItem/key/length/removeItem`）。放 `tests/lib/memStorage.mjs`。这样 `save/load/listSaves` 全可测。

### 5.2 迁移规则（来自 campaign-structure，本稿只测，不定义）
- v1 snapshot：`{version:1, chapter, battleIndex, roster[], inventory[], storyFlags, settings}`，**无 `campaign` 段**。
- v2 `load` 读到 `version<2` 或缺 `campaign`：按 `chapter` 推断 `unlocked`（≤当前章全解锁）、`clearedChapters`（<当前章已清）、`ngPlus=0`，置 `version=2`。`serializeRosterEntry/normalizeRosterEntry` 不变。
- **stat-migration 维度**：若 5 维属性也影响存档（roster 持久化的是 `generalId/level/exp/items/skillsLearned/curHp`——**派生属性不入档**，进战时由 base+成长重算），则旧档无需改 roster 字段；但 `curHp` 在 4 维→5 维下 maxHp 公式可能变 → 旧档 `curHp` 可能超新 maxHp，`load`/建场时须 `clamp(curHp, 0, maxHp)`。这条**必测**（旧高 curHp 档不应出现超额血量）。

### 5.3 矩阵（每行一条用例）
| # | 输入档 | 期望 |
|---|---|---|
| M1 | 全新 v2 save → load | 完全往返相等（roster/flags/inventory/settings/campaign 逐字段）|
| M2 | 手写 v1 档（无 campaign）→ load | `version` 升 2、`campaign` 按 chapter 推断、roster 不变 |
| M3 | v1 档 `chapter=3` → load | `unlocked` 含 1..3、`clearedChapters` 含 1,2、`ngPlus=0` |
| M4 | v1 档 `curHp` 超新 maxHp → load→建场 | curHp 被 clamp 到 maxHp（无超额血）|
| M5 | 缺字段档（无 settings / 无 inventory）→ load | 用默认补齐（`defaultSettings()`、`[]`），不崩 |
| M6 | 坏 JSON 档 → load | 返回 false、不抛、不污染当前 state；`listSaves` 标 `corrupt:true` |
| M7 | v2 档再 save 再 load（v2→v2 往返）| 幂等、字段无漂移、`savedAt` 更新 |
| M8 | 客将 `guest:true` 单位 | 不出现在持久化 roster（客将不入档，recruitment-allies 契约）|
| M9 | NG+ 档（`ngPlus=1`）→ load | 圈数保留、等级继承、进度位图正确 |

- **往返不变式（property）**：`load(save(X)) deep-equals normalize(X)`（除 `savedAt`）。把它做成一个 helper `assertRoundTrip(state)`，M1/M7/M9 都调它。
- **前向不变式**：`load(v1档)` 后再 `save` 再 `load`，第二次结果与第一次相等（迁移幂等，不会每次 load 都“重新迁移”出不同结果）。

---

## 6. 跨稿冲突的测试侧消解（本稿如何强制一致）

### 6.1 共享谓词库 → 一处定义、三处 import（测试强制）
content-pipeline 定 `battle/predicates.js`（`allyAlive/reachedCell/foeFled/clearedByTurn/leaderDead/captured…`）。本稿要求 **victory.js / achievements / ai 必须 import 这一份**，不得各写一份判活/判到达逻辑。
- **测试守门**：加 `tests/predicates.contract.test.mjs` 单测谓词库本身；再加一条**结构断言**——victory/achievements/ai 模块**不得**自带重复的“is unit alive / reached cell”实现。轻量做法：grep 守卫脚本（CI 里跑 `node tests/lib/no-dup-predicate.mjs`，扫这几个文件里是否出现裸 `u.alive !== false` / 曼哈顿到达判断的重复实现，命中则 fail 并提示改 import）。现 `victory.js` 内有本地 `isAlive`、`combat.js`/`skillEngine.js` 各有 `isAlive`——迁移后这些应收敛到谓词库/共享 util，守卫脚本盯住回归。

### 6.2 victory.rout 把非 'wei' 都当敌（与盟友冲突）→ 回归用例
现 `victory.js` `rout` 与 `checkDefeat` 都按 `faction!=='wei'` / `faction==='wei'` 二分。一旦引入**盟友 faction**（非 wei 也非敌，如 `ally`/客将阵营），`rout` 会把盟友算进“敌人未清”从而永不胜、`leaderDead` 兜底也可能误判。
- **测试**：`tests/victory.test.mjs` 增用例——存在 `faction:'ally'` 存活单位时，敌方（真 foe）全灭应判 `win`（盟友不算敌）。这条**现在就会红**，作为驱动 victory 改用谓词库 `foeAllDead()`（明确区分 foe / ally / wei）的 TDD 锚点。（消解 completeness-critic 标记的 rout bug。）

### 6.3 客将 guest 字段 → 字段存在性测试
recruitment-allies 要 `guest:true`（现仅注释）。本稿要求：单位有 `guest` 布尔字段；客将进战但不进持久化 roster。
- **测试**：§5 M8 + 一条建场单测（客将出现在 `controller.units` 但 `persistRosterFromBattle` 后不在 `game.roster`）。

### 6.4 scenario 步骤目录 → 解释器契约测试
content-pipeline 注册 step 目录到 `scenarioRunner`。本稿 §2.3 的解释器集成测试**逐 step 类型**断言行为 + 未知 step 兼容，作为“目录改了不破解释器”的回归网。

### 6.5 三难度表 / 乘子链 / 字段模型 → 全引权威稿，不抄数
- **难度**：所有用到难度系数的测试（economy/runCampaign NG+/敌方数值）**import** `balance-master` 导出的难度表，断言“按该表算 = X”；本稿不内联任何难度数字。
- **乘子链**：`balance-master` 定唯一伤害乘子链（triangle × terrainAtk × weatherAtk × affinityDef × formation × bossRage + clamps）。§4 一致性框架的算核**就是这条链的代码实现**；测试断言 forecast/resolve 都按这条链、顺序一致。本稿不另列链。
- **字段模型**：5 维 + MP 的派生与迁移以 `stat-migration` 为准；本稿 §1.2 / §5.2 只测“按它算/迁对了”。

---

## 7. 本稿消解的跨稿测试重复

| 潜在重复 | 散落在 | 本稿的单一收口 |
|---|---|---|
| “验证伤害预测=实际” | damage-preview §5 单测、enemy-ai（AI 估值）、ui-ux（浮层数值） | §4 一套 property-based 一致性框架，三处共用 |
| “战场谓词真值测试” | victory / achievements / enemy-ai 各自 | §6.1 谓词库契约测 + 去重守卫，三处 import 同一份 |
| “存档往返/迁移” | campaign-structure §6 列了迁移单测、progression/economy 各自可能测自己的档段 | §5 一个迁移矩阵 + `assertRoundTrip` 不变式，覆盖所有段 |
| “scenario step 解释” | narrative-branching（branch）、recruitment（recruit/leave）、weather（setWeather）、enemy-ai（spawnWave/setBossPhase）各自验证 | §2.3 解释器集成测试逐 step 一处覆盖 |
| 各 unit “判活”重复实现 | combat/skillEngine/victory 各有 `isAlive` | §6.1 去重守卫驱动收敛到共享 util/谓词库 |

---

## 8. CI 钩子建议（轻量、零/少依赖、成本敏感）

### 8.1 零依赖测试 runner（替代框架）
新增 `tests/run-all.mjs`：扫 `tests/**/*.test.mjs`，逐个 `child_process` 跑 `node <file>`，汇总通过/失败、聚合退出码（任一失败 → 非 0）。`package.json` 加：
```json
"scripts": {
  "test": "node tests/run-all.mjs",
  "test:unit": "node tests/run-all.mjs --dir tests",
  "test:int": "node tests/run-all.mjs --dir tests/integration",
  "test:e2e": "node tests/e2e/run-smoke.mjs",
  "test:consistency": "node tests/consistency.test.mjs"
}
```
单测+集成**零运行依赖**；e2e 仅需 playwright（可选 devDep 或 npx）。

### 8.2 分层执行（快慢分离）
- **每次 commit / PR（必跑，秒级）**：`test:unit` + `test:int` + `test:consistency`。纯 Node、无浏览器、无网络。这是主门禁。
- **PR / 夜间（分钟级）**：`test:e2e`（Playwright 冒烟，先两条命脉场景）。失败只警告不阻断（v1 阶段），稳定后转阻断。
- **不引入**覆盖率工具（c8 等）作为门禁；成本敏感，靠 §1.2 模块清单人审“每个新模块有没有对应 test”代替覆盖率数字。可选：一个 `tests/lib/coverage-checklist.mjs` 扫 `src/battle|core` 下每个 `.js` 是否有同名 `.test.mjs`，缺则 warn。

### 8.3 GitHub Actions 草案（`.github/workflows/caocao-test.yml`，路径过滤只在改动 caocao 时跑）
```yaml
on:
  pull_request:
    paths: ['games/caocao-zhuan/**']
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4   # node 20+，原生 ESM
      - run: node games/caocao-zhuan/tests/run-all.mjs   # 单测+集成+一致性
  e2e:
    runs-on: ubuntu-latest
    needs: unit
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npx --yes playwright@1.60.0 install --with-deps chromium
      - env: { NO_PROXY: 'localhost,127.0.0.1' }   # §3.1 代理坑
        run: node games/caocao-zhuan/tests/e2e/run-smoke.mjs
        continue-on-error: true   # v1 阶段不阻断
```
- 截图作为 artifact 上传（`actions/upload-artifact`），人工目检；不做 baseline diff。

### 8.4 本地一键
`start.sh` 旁加 `test.sh`（或文档化 `npm test`）：跑全量纯逻辑层 + 提示 e2e 需先 `npx playwright install chromium`。

---

## 9. 实施阶段（phaseable）

| 阶段 | 内容 | 依赖 |
|---|---|---|
| **P0（即可）** | `tests/run-all.mjs` 零依赖 runner + `package.json` scripts + `tests/lib/memStorage.mjs`；现有 12 单测纳入 run-all | 无（现状即可） |
| **P1** | §5 存档迁移矩阵（待 campaign-structure v2 落地）；§6.2 victory rout/ally 回归（TDD 驱动修 bug）；§6.3 guest 字段测 | campaign-structure / recruitment 字段定 |
| **P2** | §4 一致性框架（待 damage-preview 的 coreHit/coreDamage 重构 + forecast.js 落地） | damage-preview 重构 |
| **P3** | §6.1 谓词库契约测 + 去重守卫；§2.3 step 目录解释器测 | content-pipeline 落地 |
| **P4** | §2.1/§2.2 runCampaign 跨章 + 一战流程集成（待 campaign 内核抽离不依赖 three） | campaign 内核重构 |
| **P5（后置）** | §3 Playwright 冒烟（先标题页+战斗主视图两条命脉，再补预测/单挑/过场截图）；§8.3 CI e2e job | 渲染/UI 就绪信号契约 |

---

## 待确认（James 审阅）

1. **不引框架**：坚持零依赖 `.mjs` + `node:assert` + 自写 `run-all.mjs`（成本/干净），还是上 `node --test`（Node 内置 test runner，仍零 devDep，但要把现有 12 个文件改成 `test()` 包裹）？倾向**先 run-all、不动现有写法**。
2. **Playwright 解析方式**：在 `games/caocao-zhuan/` 加 `playwright` 为 devDep（稳定、可锁版），还是继续靠 npx 缓存（零落盘、但版本飘）？倾向加 devDep。
3. **e2e 调试入口**：是否允许在 `main.js` 加 `?battle=&skipIntro=&seed=` 调试 URL 参数（e2e 直达战斗 + 固定 seed）？这会侵入产物代码（可 `import.meta.env`/查询参数 guard）。
4. **就绪信号契约**：要求渲染/UI 层 emit `battle:ready` 并设 `window.__caocaoReady`，供 Playwright `waitForFunction`——这条接口要写进 audio-presentation/ui-ux 稿吗？
5. **去重守卫的力度**：§6.1 grep 式“禁止重复 isAlive/到达判断”守卫，是硬 fail 还是 warn？误报风险（合法的局部判活）如何豁免（注释白名单 `// predicate-ok`）？
6. **截图核对**：v1 仅人工目检 + 非纯色断言；何时对“标题页”等静态场景升级到 baseline diff？需不需要选一个像素 diff 库（pixelmatch，会引依赖）？
7. **一致性框架样本量**：§4 大样本频率断言的 M（如 2000）与 σ 容差，在 CI 上跑会不会偶发 flaky？是否固定 seed 跑“确定性子集”做门禁、大样本概率检验只夜间跑？
