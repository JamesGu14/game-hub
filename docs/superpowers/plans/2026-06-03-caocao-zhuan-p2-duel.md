# 《群雄逐鹿·孟德篇》P2-A 实现计划 — 单挑系统（武将对决）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 步骤用 `- [ ]` 跟踪。
> 关联：设计 spec §3.7；v1 引擎已就绪（battle/ 纯逻辑 + render3d + story + ui + main.js 事件总线集成）。
> 原创致敬作：美术程序化、对白原创，仅用公有领域三国素材。

**Goal:** 加入回合制手动单挑：触发（剧情指定 + 玩家主动发起相邻敌将）→ 切电影运镜的对决界面（双方 HP/行动按钮/回合演出）→ 胜负结算回写主战场（败者掉血/可阵亡/退走，胜者得经验）。

**Architecture:** `battle/duel.js`+`battle/duelAi.js` 纯逻辑（可单测，不依赖 three/DOM），是一个**回合驱动状态机**——UI 每回合调 `duel.step(playerAction)` 推进。`ui/duelView.js` 负责电影化呈现（复用 `render3d/camera.cinematic` + `fx`）。`scenarioRunner` 新增 `duel` 步类型；`main.js` 行动菜单新增「单挑」选项并把结算回写 `BattleController`。

**Tech Stack:** 同 v1（原生 ES 模块、本地 three、node 单测）。

---

## 1. 契约（冻结）

```js
// battle/duel.js  (PURE — imports only data/classes.js, data/skills.js, core/rng.js)
export function canDuel(unit)        // true 若近战类(leader/infantry/spear/cavalry)；archer/strategist 不能主动发起
export function duelChallengeable(attacker, defender) // attacker.canDuel && defender是敌将(非己方) && 双方存活

export class Duel {
  // a = 发起方/玩家侧 unit, b = 对手 unit。HP 取自各自 curHp（单挑伤害直接带回战场）。
  constructor(a, b, { rng })
  // 当前可选行动（玩家侧）：
  actions()  // -> [{id,label,desc}]  固定集合：
  //   attack 普攻(稳)、power 强攻(高伤低命中、露破绽)、defend 防御(减伤+小反击)、
  //   risk 拼命(高伤但自身也多受伤)、retreat 撤退(按速度判定，成功则 fled 结束)
  state      // { a,b, aHp,bHp, maxA,maxB, round, maxRounds:6, over,winner,loser,fled, log:[] }
  step(playerActionId)  // 推进一回合：内部用 duelAi 取 b 的行动，结算双方伤害，更新 hp/round，判定 over
  //   -> RoundResult { playerAction, enemyAction, dmgToEnemy, dmgToPlayer, aHp, bHp,
  //                    defended:bool, over:bool, winner:unitId|null, loser:unitId|null, fled:bool, line:string }
}
export function duelOutcome(duel)  // -> { winnerId, loserId, loserHpAfter, fled, expGain }
//   loserHpAfter = 败者剩余 HP（=其 duel HP，直接写回 curHp；为0则阵亡）；fled 时双方均不死、败者退走。

// battle/duelAi.js (PURE)
export function pickDuelAction(self, foe, state)  // 按 self.ai 性格 + hp% + 武力差：
//   reckless→多 power/risk；cautious→低血 defend/retreat、优势才 attack；guard/默认→均衡 attack/defend
//   -> actionId
```

**单挑数值（示意，TDD 固定具体值）**：jitter=0.9+rng()*0.2；
- attack: dmg=max(1,round((atk - def*0.5)*jitter))，命中~90%
- power: dmg≈1.6×attack，命中~70%；miss 则本回合受击+25%
- defend: 本回合受到伤害×0.5，若被攻击则反击 0.4×attack
- risk: dmg≈1.9×attack，且自身本回合受击×1.3
- retreat: 成功率 = clamp(50 + (self.spd - foe.spd)*3, 20, 90)；成功→fled 结束；失败→白挨一次 attack
- 回合上限 6：到顶仍双方存活 → 比 HP% 高者胜（败者不死、留残血）。

---

## 2. 文件结构
```
games/caocao-zhuan/
  src/battle/duel.js          (新建)
  src/battle/duelAi.js        (新建)
  src/ui/duelView.js          (新建)
  src/story/scenarioRunner.js (修改：支持 {type:'duel',a,b,forced} 步)
  src/render3d/camera.js      (按需小改：暴露 duelFraming(unitA,unitB) 便捷运镜，可选)
  src/main.js                 (修改：行动菜单「单挑」选项 + 调 duelView + 回写 controller)
  src/battle/battleController.js (修改：canDuelTargets(unit)/applyDuelOutcome(outcome) 钩子；emit 'duel:start'/'duel:end')
  tests/duel.test.mjs, tests/duelAi.test.mjs (新建)
```

---

## 阶段 1 · 逻辑（TDD）

### Task D1: duel.js + duelAi.js + 测试
**Files:** Create `src/battle/duel.js`,`src/battle/duelAi.js`,`tests/duel.test.mjs`,`tests/duelAi.test.mjs`
- [ ] 写失败测试（duel.test.mjs）：固定 rng 下 `attack` 产生确定伤害；`defend` 把受伤减半且有小反击；HP 归零 → over 且 winner/loser 正确、loser 不复活；`retreat` 高速方大概率 fled 结束；6 回合上限后按 HP% 判胜（败者存活）。`duelOutcome` 返回 loserHpAfter 正确（=败者剩余、可为0）。
- [ ] 写失败测试（duelAi.test.mjs）：reckless 低风险局倾向 power/risk；cautious 残血倾向 defend/retreat；优势局倾向 attack。
- [ ] 跑红 → 实现 duel.js（状态机 + 数值见 §1）+ duelAi.js → 跑绿。
- [ ] 纯净：grep 确认不 import three/document/window。运行：`node games/caocao-zhuan/tests/duel.test.mjs`、`node games/caocao-zhuan/tests/duelAi.test.mjs`。
- [ ] (no git) 返回摘要含命令+结果。

### Task D2: battleController 钩子
**Files:** Modify `src/battle/battleController.js`
- [ ] 加 `canDuelTargets(unit)`：返回与 unit 相邻(曼哈顿1)、存活、敌方、且 `duelChallengeable` 通过的 units。
- [ ] 加 `applyDuelOutcome({winnerId,loserId,loserHpAfter,fled})`：写回 loser.curHp=loserHpAfter；若<=0 置 alive=false 并 emit 'unit:died'；fled 则把 loser 推到相邻空格（退走）；给 winner gainExp（如 40）；attacker.hasActed=true；emit 'duel:end'；调 _checkEnd()。
- [ ] 不破坏现有测试：跑 `node games/caocao-zhuan/tests/battleController.test.mjs` 仍绿。返回摘要。

---

## 阶段 2 · 呈现 + 集成

### Task D3: duelView.js（电影化对决界面）
**Files:** Create `src/ui/duelView.js`; (可选)修改 `src/render3d/camera.js`
- [ ] `duelView.run(duel, ctx)` -> Promise<outcome>：ctx={sceneManager,camera,fx,audio}。
  - 开场：camera.cinematic 框住两名 3D 单位（用 sceneManager.unitGroup(id) 取世界坐标），上下黑边 + 「⚔ 单挑」字幕（复用 PoC 演出）。
  - 对决 HUD：双方 程序化立绘(portrait.js) + 姓名/字 + HP 条（aHp/maxA、bHp/maxB）+ 行动按钮（duel.actions()）+ 回合战报行(state.log)。
  - 玩家点行动 → `duel.step(id)` → 据 RoundResult：fx 让两 3D 单位互相 lunge、fx.hitFlash + fx.floatText(伤害) 双侧、audio.hit、更新 HP 条与战报；若 over → 「胜负已分」横幅 + 胜者亮一下。
  - 结束：camera.reset()/setIso 回沙盘，resolve(duelOutcome(duel))。
- [ ] node --check 通过。返回摘要（含 controls）。

### Task D4: 集成 — scenarioRunner duel 步 + main.js 行动菜单
**Files:** Modify `src/story/scenarioRunner.js`, `src/main.js`
- [ ] scenarioRunner 支持 `{type:'duel', a, b, forced:true}`：构造 Duel(units by id) → duelView.run → controller.applyDuelOutcome → 继续剧本。（为第 4 战三英战吕布预留；本阶段把机制接通即可。）
- [ ] main.js 行动菜单：当所选近战我方单位有 `controller.canDuelTargets(unit)` 时，菜单增「单挑」；选后若多个目标则点敌将选定 → new Duel → duelView.run → controller.applyDuelOutcome → 刷新场面（若敌将亡则移除/胜利判定）。emit/监听 'duel:start'。
- [ ] 在第一战放一个**可选**演示：玩家用近战武将贴近黄巾渠帅即可发起单挑（验证用）。
- [ ] node --check src/main.js、src/story/scenarioRunner.js；并跑全 tests 复核无回归。返回摘要 + controls。

---

## 阶段 3 · 验收
- [ ] 全 `tests/*.test.mjs` 绿（含新增 duel/duelAi 与未回归的 battleController）。
- [ ] 浏览器实玩：近战武将贴敌将 → 行动菜单「单挑」→ 电影运镜对决 → 选普攻/强攻/防御/拼命/撤退逐回合 → HP 演出 → 胜负回写（败者掉血/阵亡/退走）→ 回沙盘继续。截图存档。

## 自审
- 覆盖 spec §3.7：触发(D4 剧情+主动)、电影运镜(D3 复用 PoC)、回合对决(D1)、结果回写主战场(D2)。✓
- 契约一致：`Duel.step→RoundResult`、`duelOutcome→{winnerId,loserId,loserHpAfter,fled,expGain}`、controller `canDuelTargets/applyDuelOutcome`、事件 'duel:start'/'duel:end' 全文统一。
- 无占位符。
