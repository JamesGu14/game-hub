# 《群雄逐鹿·孟德篇》enemy-ai — 设计稿（待审）

> 原创致敬作。沿用原版《三国志曹操传》式 SRPG 的**敌方/友军行为结构惯例**（事实性设定）+ 公有领域三国题材；
> 所有行为参数、阈值、优先级权重均为本作自定，不照搬任何商业游戏的脚本/数值表。
> 与设计语料一致：复用 5 维 **攻/精/防/爆/士**、11 系职业、计略 `kind`(damage/heal/control/debuff)、天气 `require/blockedIn/powerMod`、
> footprint(`cross/star/diamond/area`)、道具 3 槽、伤害预测纯函数、胜负条件类型(rout/defeatLeader/survive/capture)。
> 状态：**待 James 审阅**。

- 日期：2026-06-04
- 范围：敌方与友军 AI 总览 —— 在现有 `reckless / cautious / guard / strategist` 上扩展：boss 机制、援军波次、撤退/逃跑、护目标/守据点、仇恨与目标优先级、难度缩放、友军 NPC 简易 AI。
- 对接：`battle/ai.js`、`battle/battleController.js`、`story/scenarioRunner.js`、`data/chapters/*`（地图/剧本）。
- 实现原则承袭主设计：**引擎与内容分离**（加敌人/波次/boss = 改数据，不改引擎）；`battle/` 纯逻辑可单测、不 import three/不碰 DOM。

---

## 0. 现状基线（已实装，本稿在其上扩展）

`battle/ai.js` 已有的入口与行为（保持兼容，不破坏现有单测）：
- `planTurn(enemyUnit, battleState) -> 动作序列`，动作 `{kind:'move'|'attack'|'skill', ...}`；**只返回计划，不改状态**（controller 执行）。
- 四种性格：`reckless`（逼近最近 wei、移动后择优攻击，持「明显划算」伤害计略则改放）、`cautious`（仅在本回合可击杀时出手，否则待机）、`guard`（从不移动，仅原地射程内攻击）、`strategist`（计略价值评估 → 群疗 → 控场/弱体 → 安全走位）。
- `battleState` 门面由 `battleController._aiState()` 注入：`units / map / occupied / reachable(unit) / path(from,to) / inAttackRange / triangleMul`，AI 内含 fallback 几何，测试夹具下可独立运行。
- 计略感知已用真实 `skillEngine`（`skillTargets/aoeCells/resolveSkill`）+ `statuses.statMods` 做确定性打分（`MID_RNG=()=>0.5`）。

> 本稿新增的一切都以「**扩展 `enemyUnit` 上的可选字段 + 扩 `battleState` 门面 + 新建 `battle/aiObjectives.js` 辅助**」实现，默认不改变上述四性格的既有判定，保证回归安全。

---

## 1. 统一 AI 配置：`ai` 字段从「字符串」升级为「对象」（向后兼容）

当前 `enemy.ai` 是字符串（`'reckless'` 等）。扩展为**可字符串可对象**，由 `makeUnit` / `_aiState` 归一化：

```js
// data 里（map.enemies[i].ai）既可写字符串（旧），也可写对象（新）：
ai: 'reckless'                       // 旧写法 → 归一为 { persona:'reckless' }
ai: {
  persona: 'cautious',               // 基础性格（沿用四种 + 新增见 §3）
  // —— 行为开关 / 参数（全部可选，缺省=保守默认）——
  leashCell: { c, r }, leashRadius: 4,   // 拴绳：离锚点超过半径则回防，不无脑追
  guardCell: { c, r }, guardRadius: 0,   // 守据点：守在某格/某区域（0=钉死原地）
  escortId: 'gen_xxx',                   // 护送/护卫目标 unitId（贴身保护）
  fleeBelowHpPct: 0.0,                   // 残血逃跑阈值（0=不逃）；触发见 §4
  fleeToCell: { c, r },                  // 逃跑撤往的安全格/出口（缺省=远离 wei）
  noFlee: false,                         // 钉死的死士（boss/必死剧情敌），永不逃
  hatred: { ... },                       // 目标优先级权重覆盖（§5），缺省用全局默认
  skillEager: 1.0,                       // 计略积极度（×计略价值阈值，<1 更爱放计略）
  boss: { ... },                         // boss 机制（§2），仅 boss 单位有
  reinforce: false,                      // 标记：本单位是援军波次刷出的（§3），影响首回合行为
}
```

归一化点：`battleController.makeUnit` 里把 `placement.ai` 规整为对象存 `unit.aiConfig`，并保留 `unit.ai = aiConfig.persona`（现有 `planTurn` 的 `switch(enemyUnit.ai)` 不变即可工作）。新行为读 `unit.aiConfig.*`。

---

## 2. Boss 机制（多阶段 / 狂暴 / 护卫）

Boss = 带 `aiConfig.boss` 的 foe 单位（如吕布@虎牢、华雄@汜水、徐荣@荥阳、董卓/李儒等）。Boss 本体仍走某个 persona（多为 `reckless`/`strategist`），`boss` 块叠加「阶段切换 + 狂暴 + 护卫联动」。

### 2.1 数据形状

```js
boss: {
  // —— 多阶段：按本体 HP% 自上而下匹配第一个满足的阶段，切阶段时一次性应用 ——
  phases: [
    { atHpPct: 1.00, persona: 'cautious',   skillEager: 0.8 },        // 开局：谨慎试探
    { atHpPct: 0.60, persona: 'reckless',   onEnter: { say:'吕布_phase2', buff:{atk:1.15, dur:99} } },
    { atHpPct: 0.30, persona: 'strategist', enrage: true,             // 残血狂暴
      onEnter: { say:'吕布_phase3', setWeather:null, summonWaveId:'lubu_laststand' } },
  ],
  // —— 狂暴（可由 phase.enrage 触发，或独立阈值）——
  enrageBelowHpPct: 0.30,
  enrage: { atkMul: 1.3, scMul: 1.25, extraMove: 1, ignoreLeash: true, fleeImmune: true },
  // —— 护卫联动 ——
  guards: ['gen_a','gen_b'],          // 这些 foe 是 boss 护卫：boss 在场时它们 escort=boss
  enrageOnGuardsDead: true,           // 护卫全灭 → boss 提前狂暴（「亲卫尽墨」）
  // —— 表演 / 剧情联动（通过 bus，由 story/render 层消费，纯逻辑只发事件）——
  cinematicOnPhase: true,             // 切阶段时 emit 'boss:phase' 让上层放运镜/台词
}
```

### 2.2 阶段切换（每个 boss 单位行动前 + 受击后判定）

- 判定时机：`runEnemyTurn` 里轮到 boss 行动前，以及**任意攻击/计略结算后**（`attack`/`useSkill` 末尾）调 `controller._checkBossPhase(boss)`。
- 取当前 `curHp/maxHp`，从 `phases` 里**自上而下找第一个 `atHpPct >= hp%` 的阶段**（即跌破阈值进入更凶的阶段）；与 `boss._phaseIndex` 不同才算「进入新阶段」。
- 进入新阶段一次性应用：切 `unit.ai`（persona）、覆盖 `skillEager`、`onEnter.buff`（用 `statuses.applyStatus` 给自身上增益）、`onEnter.summonWaveId`（触发一波援军，见 §3）、`onEnter.setWeather`（调 `weather.setWeather`）。
- `cinematicOnPhase` → `bus.emit('boss:phase', { unitId, phaseIndex, say })`，story 层可挂运镜/台词（与 `camera:cinematic` 同风格）；纯逻辑层只发事件、**不阻塞**。

### 2.3 狂暴（enrage）

- 触发：`phase.enrage:true`、或 `curHp%` 跌破 `enrageBelowHpPct`、或 `enrageOnGuardsDead` 且护卫全灭。
- 效果（写入 `unit._enraged=true` + 一次性上「狂暴」buff 状态）：
  - 攻击/计略威力 ×`enrage.atkMul`/`scMul`（接 combat/skillEngine 的有效属性修正，复用 `statuses` 的 buff 通道，**不新开伤害公式**）。
  - `extraMove`：本回合移动力 +N（临时改 `unit.mov` 或在 `reachable` 注入加成）。
  - `ignoreLeash:true`：解除拴绳，全图扑杀。
  - `fleeImmune:true`：狂暴中不逃（等价临时 `noFlee`）。

### 2.4 护卫（guards / escort）

- boss 在场时，其 `guards` 列出的 foe 自动获得 `escortId = bossId`（§6 护送/护卫行为）：贴身站在 boss 与最近 wei 之间，优先拦截威胁 boss 的 wei。
- 「拦截」实现：护卫的目标优先级（§5）对「能在下回合打到 boss 的 wei」加权重；走位优先选「夹在 boss 与该 wei 连线上」的可达格（取 boss→威胁连线上、离 boss 1~2 格、可达且能攻击到威胁的格）。

---

## 3. 援军波次（回合触发 / 条件触发）

援军 = 战中**动态向 `controller.units` 注入新 foe（或友军）**。数据驱动、引擎只提供注入与触发钩子。

### 3.1 数据形状（放 `map.reinforcements`，与 `map.triggers` 并列）

```js
map.reinforcements = [
  {
    id: 'lubu_laststand',
    on: 'turnStart', turn: 6,            // 触发条件（见 §3.2）
    // 或 on:'bossPhase', bossId:'lubu', phaseIndex:2
    // 或 on:'flag', flag:'gate_broken'
    // 或 on:'summon'（仅被 boss.onEnter.summonWaveId 显式调用，不自触发）
    side: 'foe',                         // 'foe' | 'wei'（友军援军，少见但支持）
    units: [
      { generalId:'xiliang_spear', c:18, r:2, ai:{ persona:'reckless' }, level:5 },
      { generalId:'xiliang_archer', c:18, r:3, ai:'cautious' },
    ],
    spawnGuard: 'edgeOnly',              // 落点占用/越界时的处理：'edgeOnly'|'nearestFree'|'skip'
    once: true,                          // 默认 true：同一波只触发一次（记 _firedReinforcements）
    say: 'ch01_b4_reinforce',            // 可选：触发时播一段剧情（emit，由 story 层 run）
    cinematic: { focus:{c:18,r:2}, zoom:1.1 },  // 可选运镜
  },
];
```

### 3.2 触发时机（controller 钩子，全部在已有相位流转里挂载）

- `on:'turnStart' + turn:N`：复用现有 `_fireTurnStartTriggers()` 的时机，新增 `_fireReinforcements('turnStart', this.turn)`。
- `on:'flag' + flag`：在 `setFlag`（scenarioRunner 写入 `storyFlags`）后，由 story 层回灌 controller，或 controller 每回合开始扫一遍 `game.state.storyFlags`（轻量，n 小）。
- `on:'bossPhase'`：`_checkBossPhase` 切阶段时检查匹配波次。
- `on:'survive 残局'`（可选）：守城类关卡，每 K 回合刷一波压迫玩家（`every:K`）。
- 显式 `summonWaveId`：boss `onEnter` 或剧情 step 调 `controller.spawnReinforcement(waveId)`。

### 3.3 注入实现（`controller.spawnReinforcement(wave)`）

- 对 `wave.units` 逐个 `makeUnit(GENERALS[generalId], placement, wave.side)`；落点被占/越界时按 `spawnGuard` 调整（`nearestFree`=四邻 BFS 找最近空可通行格；`edgeOnly`=只在地图边缘空格；`skip`=放弃该单位）。
- 新单位 `hasMoved/hasActed` 初值：**当回合是否能立刻行动可配**（`actThisTurn:false` 默认——刷出的当回合先「集结」不动，下回合才动，避免突然斩杀玩家，符合儿童/休闲也照顾的难度观；boss 末战可设 true 制造压迫）。
- `push` 进 `this.units` → `emit 'units:spawned' {units, waveId}`（render 层补建 mesh、播登场表演）→ `emit 'scenario:request' {scenarioId: wave.say}`（story 层按需 `run`）→ `_checkEnd()`（援军可能改变胜负，如 rout 条件下又出现了 foe）。
- `once` 去重：`this._firedReinforcements:Set` 记 `wave.id`。
- **胜负交互**：注意 `victory 'rout'` 关卡有「未死光的预定援军」时不应提前判胜——`evaluateVictory` 维持「现存活 foe 全灭」语义即可；只要援军已刷出就计入。**未刷出的波次**不阻止判胜（设计取舍：避免「明明打完了还要等刷怪」）。如需「必须挡完所有波次才算赢」，用 `survive` 或 `flag` 胜利条件表达，而非靠 rout。

---

## 4. 撤退 / 逃跑（残血 or 剧情）

两类语义，分别表达：

### 4.1 残血逃跑（emergent，参数驱动）

- 触发：`aiConfig.fleeBelowHpPct > 0` 且 `curHp/maxHp < fleeBelowHpPct` 且非 `noFlee`/非狂暴 `fleeImmune`。
- 行为（在 `planTurn` 最前面短路，优先级高于 persona 的进攻逻辑）：
  - 若身边有可用治疗/治疗道具（自疗计略 `kind:'heal'` 命中自身、或 `heal_*` 消耗品）→ **先自救**（放疗/喝药）再撤。
  - 走位 = 远离最近 wei 的 `retreatStep`（已存在）升级版 `retreatStepTo(fleeToCell)`：有 `fleeToCell` 则朝它走（沿 `path`，取 reachable 内最深格），否则最大化「离最近 wei 的曼哈顿距离」。
  - 撤退时**不主动攻击**（除非原地被逼到角落、攻击是唯一自保——可选 `coverFire`，默认关）。
- **逃出场**：若 `fleeToCell` 是地图边缘/指定出口格，且逃跑者到达 → `emit 'unit:fled' {unitId}` → controller 把其 `alive=false`（视为脱离战场，不计阵亡台词，可由 boss `say` 区分）。胜负上「逃脱的敌将」按关卡意图：默认**视同退场**（对 `rout` 算「场上无存活 foe」成立）。若剧情要求「必须斩杀不可放跑」，关卡用 `defeatLeader` + 不给该将 flee 来表达。

### 4.2 剧情撤退（scripted，触发器驱动）

- 由 `map.triggers`/剧本控制，不靠 AI 自决：
  - `{ on:'turnStart', turn:N, retreat:['gen_a','gen_b'] }` 或剧本 step `{ type:'retreat', units:[...], to:{c,r} }`。
  - controller 新增 `retreatUnits(ids, toCell?)`：给这些 foe 一次性 `aiConfig.fleeToCell + fleeBelowHpPct=1.0`（强制视为残血逃）或直接判定脱离（瞬时退场，配 `say`）。
  - 典型用例：**荥阳追击**徐荣埋伏后「董卓军主力先撤、留断后」；**汜水/虎牢**败将退入关内的过场。

---

## 5. 仇恨与目标优先级（targeting）

把现有 `pickBest`（相克↑→估伤↑→残血↓→id）升级为**加权评分**，可被 `aiConfig.hatred` 覆盖。新增 `battle/aiTargeting.js`（或并入 ai.js 的辅助区）。

### 5.1 默认优先级（题述顺序，转成可解释权重）

对每个「本回合站位可攻击到的 wei」算 `score`，取最高：

```
score(target) =
    W_kill   * canKillThisTurn(estDmg >= curHp ? 1 : 0)            // 人头：能本回合击杀最高优先
  + W_squish * (1 - target.curHp / target.maxHp)                   // 高血量/残血：默认偏好「打得动的」——
                                                                    //  题述「高血量」指优先咬住主力肉盾以撕开阵线，
                                                                    //  「我方残血」指补刀；两者由 W_hpHigh / W_hpLow 分别表达
  + W_hpHigh * (target.curHp / target.maxHp)                       // 偏好高血量主力（撕肉盾流，boss/猛将常用）
  + W_hpLow  * (1 - target.curHp / target.maxHp)                   // 偏好残血补刀（谨慎/收割流）
  + W_noCounter * (willCounter(target) ? 0 : 1)                    // 不会反击的目标加分（白嫖）
  + W_triangle  * (triangleMul(self,target) - 1)                   // 相克有利加分
  + W_value     * targetValue(target)                              // 价值目标：君主/谋士/奶/弓 等点名（见 §5.3）
  + W_near      * (1 / (1 + manhattanToReach))                     // 就近：减少多余移动
  - W_risk      * incomingThreatIfEngage(self,target)              // 风险：贴上去会被多少 wei 围殴（智将/谨慎更看重）
```

- `canKillThisTurn` 用 AI 内既有 `estimateDamage`（或更准的 `forecast.predictAttack` 干跑，见 §8）。
- 并列用 `id` 字典序兜底，保证确定性（与现有约定一致，单测可复现）。

### 5.2 各 persona 的默认权重（`hatred` 缺省值）

| persona | W_kill | W_hpHigh | W_hpLow | W_noCounter | W_triangle | W_value | W_near | W_risk |
|---|---|---|---|---|---|---|---|---|
| reckless | 100 | 0.2 | 0.1 | 0.1 | 0.4 | 0.3 | 0.2 | 0.0 |
| cautious | 100 | 0.0 | 0.6 | 0.5 | 0.5 | 0.6 | 0.1 | 0.6 |
| guard | 100 | 0.0 | 0.4 | 0.4 | 0.5 | 0.7 | 0.0 | 0.3 |
| strategist | 100 | 0.0 | 0.3 | 0.2 | 0.2 | 0.9 | 0.1 | 0.8 |

- `W_kill=100` 让「能击杀」几乎总是压倒一切（人头最高优先，符合题述）。
- reckless 偏 `W_hpHigh + triangle`（莽夫咬主力、吃相克）；cautious/guard 偏 `W_hpLow + noCounter + risk`（猥琐补刀、怕反击、怕被围）；strategist 偏 `W_value + risk`（点名君主/奶/谋士、极重自保）。
- 单个敌将可在 `aiConfig.hatred` 里覆盖任意权重，做出「专盯曹操」「专杀谋士」等个性（如李儒 `W_value` 对谋士再加权）。

### 5.3 价值目标 `targetValue`（点名权重，按职业/身份）

```
君主(曹操) 1.0 · 谋士/道士/风水士(奶与控) 0.8 · 弓兵/弓骑兵(远程脆) 0.6 · 炮车 0.7 · 其余 0.2
```
- 「斩首流」boss/刺客可叠 `hatred.W_value` 高 + `hatred.assassinId:'caocao'`（绝对优先打某 id，若可达）。
- 护卫单位（§2.4）的 `targetValue` 改为「对威胁 boss 的 wei 加权」，而非通用价值。

---

## 6. 护目标 / 守据点 / 护送（objective AI）

新建 `battle/aiObjectives.js`，在 persona 决策**之前**插入「目标约束层」（拴绳/守点/护送），约束 persona 的走位与攻击选择。

### 6.1 守据点（guardCell / 守关）

- `aiConfig.guardCell + guardRadius`：单位被「钉」在以 guardCell 为心、半径 guardRadius 内（`guardRadius=0`=钉死原地，等价强化版 `guard`；>0=可在区域内机动但不远离）。
- 行为：先按 persona 选目标/走位，但**落点必须满足 `manhattan(stand, guardCell) <= guardRadius`**；若进攻落点超界，则放弃追击，改在区域内选「能打到 wei 且最贴边」的格，或原地待机。
- 用于：汜水关/虎牢关守军、城门据点守备（与 `victory 'capture'` 对应——玩家要冲进据点，守军围着据点死守）。

### 6.2 拴绳（leash，反「钓引」）

- `aiConfig.leashCell + leashRadius`：与守点类似但更宽松——可追击，但**离锚点超过 leashRadius 就回防**（朝 leashCell 走，途中遇 wei 在射程内仍可打）。狂暴/`ignoreLeash` 解除。
- 用于：避免玩家用一个高回避诱饵把整队敌人一格一格钓散（SRPG 常见 exploit）。reckless 敌默认给中等 leash（如 6），boss 狂暴解除。

### 6.3 护送 / 护卫（escortId）

- `aiConfig.escortId`：贴身保护某友方单位（boss 护卫，或友军护送的反例——敌方护送粮车/重要 NPC）。
- 行为优先级：
  1. 若被护送者**正被威胁**（有 wei 能在本/下回合打到它）→ 走到「护送者与威胁之间」的可达格并优先攻击该威胁（§5 护卫权重）。
  2. 否则贴身跟随：走到护送者四邻/2 格内的可达格（保持队形）。
  3. 自身残血仍遵守 §4 逃跑（除非 `noFlee`）。
- 护送目标若是「会移动的载具/NPC」（如敌方粮队向出口移动），护送者随其移动；玩家胜利条件可设为「阻止粮队到达出口」(survive 反向) 或「击破护送者+载具」。

### 6.4 决策合流顺序（`planTurn` 顶层重排）

```
planTurn(unit, state):
  1. 若 fleeBelowHp 命中 → 逃跑/自救（§4.1），return
  2. 取 objectiveContext = aiObjectives.resolve(unit, state)   // 给出允许落点集 allowedTiles + 目标加权 hatredOverride
  3. 按 persona 决策，但：
       - 走位候选 ∩ allowedTiles（守点/拴绳约束）
       - 攻击/计略目标评分用 §5 加权（含 hatredOverride）
  4. boss：决策前先 _checkBossPhase 已切好 persona/enrage（controller 侧），planTurn 照常跑当前 persona
```

> 关键：objective 层只**收窄**候选与**调整**权重，不重写四性格的核心算法 → 现有单测与行为基本不变，新行为是叠加。

---

## 7. 难度缩放如何作用于 AI

难度来自 `gameState.settings.difficulty`（主设计存档已含 `difficulty`）：`'easy' | 'normal' | 'hard'`（默认 normal）。**不改数据文件**，由 controller 在构造 foe / 跑 AI 时套一层乘数。

### 7.1 缩放维度（`data/aiTuning.js` 集中放表，便于调参）

```js
export const DIFFICULTY = {
  easy:   { foeHpMul:0.85, foeAtkMul:0.85, skillEager:0.6, useForecast:false,
            reinforceActThisTurn:false, leashTighten:1.0, fleeBelowHpBonus:+0.05,
            bossPhaseAggro:0.8 },
  normal: { foeHpMul:1.0,  foeAtkMul:1.0,  skillEager:1.0, useForecast:true,
            reinforceActThisTurn:false, leashTighten:1.0, fleeBelowHpBonus:0,
            bossPhaseAggro:1.0 },
  hard:   { foeHpMul:1.15, foeAtkMul:1.1,  skillEager:1.3, useForecast:true,
            reinforceActThisTurn:true,  leashTighten:1.5, fleeBelowHpBonus:-0.05,
            bossPhaseAggro:1.25, focusFire:true },
};
```

- **属性缩放**：`foeHpMul/foeAtkMul` 在 `makeUnit`（faction==='foe'）后乘到 maxHp/curHp/atk（不动玩家方）。
- **行为缩放**：
  - `skillEager`：乘到计略价值阈值（`DMG_WORTH_MIN`、`lightDamagePlay` 门槛）——hard 更爱放计略、更早放控场。
  - `useForecast`：normal/hard 用精确 `forecast.predictAttack` 干跑做击杀判定（§8），easy 用粗略 `estimateDamage`（更易漏判击杀，对玩家更宽容）。
  - `reinforceActThisTurn`：hard 援军刷出即动（压迫感）。
  - `leashTighten`：缩短/放宽拴绳（hard 拴绳更长=更主动）。
  - `fleeBelowHpBonus`：调残血逃跑阈值（easy 敌更早逃=玩家更轻松；hard 敌死战）。
  - `bossPhaseAggro`：乘 boss 阶段 persona 的积极度 / enrage 倍率。
  - `focusFire`（hard）：同回合多敌**集火同一 wei**（见 §7.2）。

### 7.2 集火（focusFire，仅 hard 默认开）

- 在 `runEnemyTurn` 开头建一个「本回合集火目标」缓存：第一个出手的敌按 §5 选定 `state._focusTargetId`；后续敌的 `W_value`/评分对该目标额外加权，倾向打同一个，制造「秒人」压力。每回合重置。
- easy/normal 不开（各打各的，玩家更好分摊伤害）。

---

## 8. 与伤害预测（forecast）共用判定

`damage-preview` 稿已规划 `battle/forecast.js`（`predictAttack/predictSkill` 纯函数，复用 combat 核）。AI 的「能否击杀 / 攻击划不划算」应**优先复用 forecast**，确保 AI 的判断与玩家看到的预测一致：

- `battleState.forecastAttack(attacker, defender) -> {hitPct,dmgMin,dmgMax,willKill,...}`（controller 门面注入，包 forecast）。
- AI 击杀判定：`useForecast` 时用 `willKill`（或 `dmgMin >= curHp` 保守）；否则退化现有 `estimateDamage`（保留 fallback，测试夹具无 forecast 时仍可跑）。
- 计略价值打分同理：`predictSkill` 替代当前 `resolveSkill(MID_RNG)` 干跑（语义一致，更精确含命中率/抖动区间）。
- **天气**：forecast 已接 `weather`，AI 的计略可用性判断须同样尊重 `require/blockedIn`（如雨天不放火计、雾天远程射程−1）——`usableSkills` 增加「按当前天气过滤不可用计略」，调 `weather.weatherMods(skill)`/`skillEngine` 的可用性查询。

---

## 9. 友军 NPC 简易 AI（ally / npc）

主设计有 `faction: 'ally' | 'npc'`（客将刘关张、护送 NPC、温酒斩华雄式的友军事件单位）。需要轻量自动 AI（玩家通常不直接操控 ally，或可选半自动）。

### 9.1 行为分级

```js
// 友军单位 aiConfig（faction 'ally'/'npc' 时由 controller 在 enemy 相位**之后**单独跑一轮）
allyAi: {
  mode: 'aggressive' | 'defensive' | 'hold' | 'followLeader' | 'fleeToExit',
  followId: 'caocao',          // followLeader：跟着主将走，不脱队
  exitCell: { c, r },          // fleeToExit：被护送 NPC 朝出口移动（玩家护送关）
  timid: true,                 // 自保：残血不前压（同 §4 逃跑但撤向我方）
}
```

- `aggressive`：复用 `reckless` 但目标是 **foe**（镜像——把 AI 的「敌人」从 wei 换成 foe）。客将关羽/张飞默认。
- `defensive`：复用 `cautious`（仅可击杀才出手），优先不送。
- `hold`：守原地（复用 `guard`），用于「友军把守某点」。
- `followLeader`：跟着 `followId` 移动，进入 foe 射程才打；用于「友军同行但不主导」。
- `fleeToExit`：护送 NPC（友方粮车/平民）朝 `exitCell` 移动，到达=玩家护送类目标达成（配 `victory` 扩展，见 §10）；遇敌不主动打。

### 9.2 复用与隔离

- **复用现有四性格**：把 `livingWeiUnits(state)` 抽象成 `enemiesOf(unit, state)`（foe 看 wei；ally/npc 看 foe），`planTurn` 内部用它取「目标阵营」。这样 ally 的 aggressive/defensive/hold 直接复用 reckless/cautious/guard 的算法，**零重复**。
- 友军相位在敌方相位之后单跑一小轮（`controller.runAllyTurn()`，可选；若设计为「友军在玩家相位由玩家操控」则改为玩家可点）。主设计倾向：**客将玩家可控、纯 NPC（粮车/事件单位）自动**——`allyControllable:true/false` 决定。
- 友军 AI 同样**只发计划、controller 执行**，走与 foe 完全相同的动作管线（move/attack/skill），保证一致与可测。

---

## 10. 对接清单（模块触点）

| 模块 | 改动 |
|---|---|
| `battle/ai.js` | `enemiesOf(unit,state)` 抽象阵营；`planTurn` 顶层接入 逃跑→objective→persona→加权目标；目标评分改 §5 加权（`scoreTarget`）；`usableSkills` 加天气过滤；击杀判定可走 forecast；ally 复用四性格。 |
| `battle/aiObjectives.js`（新） | `resolve(unit,state) -> {allowedTiles, hatredOverride, intent}`：拴绳/守点/护送/护卫的落点收窄与权重调整。 |
| `battle/aiTuning.js`（新） | `DIFFICULTY` 表 + `applyDifficulty(unit, diff)`（属性乘数）+ 行为参数取值。 |
| `battle/battleController.js` | `makeUnit` 归一 `aiConfig`、应用难度属性乘数；`_aiState` 增注 `forecastAttack/forecastSkill`、`enemiesOf`、`weather`、`difficulty`、`focusTargetId`；新增 `spawnReinforcement / _fireReinforcements / retreatUnits / _checkBossPhase / runAllyTurn`；在 `attack/useSkill/runEnemyTurn` 末尾挂 boss 阶段检查；`runEnemyTurn` 开头清 focus 缓存；逃脱单位 `emit 'unit:fled'`。 |
| `victory.js` | 维持现语义；新增（可选）`escort`/`survive 反向`（护送 NPC 到达 exit = win，或粮车被劫/到达 = lose）以支撑护送/守城关。 |
| `story/scenarioRunner.js` | 新 step：`retreat`、`spawnWave`(显式触发波次)、`setBossPhase`(剧情强制切阶段)；`emit 'boss:phase' / 'units:spawned' / 'unit:fled'` 的消费（运镜/台词）。 |
| `data/chapters/*` | `map.reinforcements`、`enemy.ai` 升级为对象、boss 单位填 `boss{}`、守军填 `guardCell`、客将/NPC 填 `allyAi`。 |
| `render3d/*` | 监听 `units:spawned`（建 mesh/登场表演）、`boss:phase`（狂暴特效/换色）、`unit:fled`（退场动画）。 |
| `ui/hud.js` | boss 血条/阶段标记；援军预警提示（「敌军援兵将至」）；难度选择。 |
| `tests/` | 新增：boss 阶段切换、援军注入与胜负交互、逃跑/脱离、守点/拴绳落点收窄、目标加权排序确定性、难度乘数、ally 镜像目标阵营。 |

---

## 11. 可配置 AI 行为参数表（汇总，供数据层填写）

| 参数 | 位置 | 类型 | 缺省 | 含义 |
|---|---|---|---|---|
| `persona` | `enemy.ai` | enum | `reckless` | reckless/cautious/guard/strategist |
| `leashCell`/`leashRadius` | aiConfig | cell/int | 无锚/∞ | 拴绳锚点与半径（反钓引） |
| `guardCell`/`guardRadius` | aiConfig | cell/int | 无/— | 守据点中心与半径（0=钉死） |
| `escortId` | aiConfig | unitId | 无 | 护卫/护送目标 |
| `fleeBelowHpPct` | aiConfig | 0..1 | 0 | 残血逃跑阈值（0=不逃） |
| `fleeToCell` | aiConfig | cell | 无 | 撤往的安全/出口格 |
| `noFlee` | aiConfig | bool | false | 死士，永不逃 |
| `skillEager` | aiConfig | float | 1.0 | 计略积极度（<1 更爱放） |
| `hatred.W_*` | aiConfig | float | §5.2 表 | 目标优先级权重覆盖 |
| `hatred.assassinId` | aiConfig | unitId | 无 | 绝对优先点名某 id |
| `boss.phases[]` | aiConfig | array | 无 | 多阶段（atHpPct/persona/onEnter） |
| `boss.enrageBelowHpPct` | aiConfig | 0..1 | 无 | 狂暴血线 |
| `boss.enrage{}` | aiConfig | obj | — | atkMul/scMul/extraMove/ignoreLeash/fleeImmune |
| `boss.guards[]` | aiConfig | unitId[] | 无 | 护卫名单 |
| `boss.enrageOnGuardsDead` | aiConfig | bool | false | 护卫全灭即狂暴 |
| `map.reinforcements[]` | map | array | 无 | 援军波次（on/turn/units/spawnGuard/once/say） |
| `reinforcement.actThisTurn` | wave | bool | false | 刷出当回合是否行动 |
| `allyAi.mode` | ally/npc | enum | followLeader | aggressive/defensive/hold/followLeader/fleeToExit |
| `allyAi.exitCell` | ally/npc | cell | 无 | 护送出口 |
| `difficulty` | settings | enum | normal | easy/normal/hard（§7 套乘数） |

---

## 12. 第一章应用示例（与战役清单对齐）

- **陈留起兵（教学）**：小股巡兵 `reckless` + 短 leash；黄巾渠帅 `guard`+`guardCell`(守自身据点)，残血 `fleeBelowHpPct` 略给（教学不必死战）。
- **会盟酸枣**：先锋遭遇战，敌弓兵 `cautious`（补刀脆皮），首次出现 `strategist`(李儒系道士) 放控场——教学「计略与谋士」。
- **汜水关**：守关用 `guardCell`+`guardRadius` 围据点死守；华雄 = boss（2 阶段：常态 reckless → 残血 enrage 提攻），护卫数名西凉骑 `escortId=华雄`。`victory='capture'`（攻入关）或 `defeatLeader=华雄`。
- **虎牢关**：吕布 = 招牌 boss（3 阶段 + enrage + `noFlee`/死战；护卫西凉精骑），`hatred.assassinId='caocao'` 倾向冲主将；三英战吕布走**剧情强制单挑**（scenarioRunner `duel` step，已实装），单挑后回主战场吕布残血进入下一阶段。turn≥N 触发吕布 `lubu_laststand` 援军波次。
- **荥阳追击（章末）**：徐荣埋伏 = 触发型援军（`on:'flag', flag:'ambush_sprung'` 或 `turnStart`）从两翼刷出 `reckless`+`focusFire`(若 hard)，制造「虽败犹荣」的高压；可配董卓军主力**剧情撤退**(`retreat` step) 收尾。

---

## 待确认

1. **难度档位**：easy/normal/hard 三档是否够？是否需要「儿童友好」更低档（与全局 CLAUDE 里「一年级孩子」家庭线无关，本作受众为成年怀旧向，倾向只做三档）。
2. **援军与胜负**：未刷出的波次**不阻止**判胜（§3.3 取舍）是否符合预期？还是要求「挡完所有波次」用 survive/flag 显式表达即可。
3. **逃脱敌将的胜负计**：残血逃出场默认「视同退场」（对 rout 成立）；需「不可放跑必须斩杀」的将一律用 `defeatLeader` 表达——确认这套约定。
4. **友军操控权**：客将（刘关张）**玩家可控** vs **自动 aggressive**？建议客将可控、纯事件 NPC（粮车/平民）自动；是否需要「半自动+可接管」开关 `allyControllable`。
5. **集火（focusFire）**：仅 hard 默认开是否合适？normal 是否也想要轻度集火（更有「战术压迫」感但更难）。
6. **forecast 依赖**：AI 击杀/计略判定切到 `battle/forecast.js`（damage-preview 稿）——需该模块先落地；在此之前 AI 用现有 `estimateDamage` 降级运行（已保证 fallback）。确认实现顺序：forecast 先于本稿的「精确判定」。
7. **护送类胜负条件**：是否在 `victory.js` 增 `escort`/反向 survive（NPC 到达 = win / 粮车被劫 = lose），还是第一章先不做护送关（清单里暂无强护送关，可后置）。
8. **boss 阶段表演阻塞**：`boss:phase` 切阶段的运镜/台词由 story 层异步播放，纯逻辑不阻塞——确认「先发事件、表演与逻辑解耦」（与现有 `camera:cinematic` 同模式）即可，不要求 AI 等动画。
