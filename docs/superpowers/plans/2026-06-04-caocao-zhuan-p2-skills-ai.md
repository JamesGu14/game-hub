# 《群雄逐鹿·孟德篇》P2-B 实现计划 — 计略全套 + 状态效果 + 智将 AI

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 步骤用 `- [ ]` 跟踪。
> 关联：spec §3.3/§3.10；引擎 + 单挑 + 第一章均已就绪并验收。
> 原创致敬作：计略名称/描述/特效全原创，不照搬任何商业游戏文本或数值表。

**Goal:** 把计略从 3 个扩成完整一套（攻击/治疗/增益/妨碍/控场，含 AOE 与状态效果），加状态效果系统（中毒/混乱/定身/增减益及每回合结算），并让敌方「智将」AI 会放计略（集火 AOE、治疗友军、增益、对最强威胁下控场）。配技能选取 UI（范围/AOE 预览/状态图标）与特效。

**Architecture:** 资源沿用「每技能 `uses` 次数/场」。新增纯逻辑 `battle/statuses.js`（状态定义+结算）与 `battle/skillEngine.js`（计略结算：伤害/治疗/增减益/AOE/命中），`battleController` 加 `useSkill`+回合状态结算，`ai.js` 加 `strategist` 智将且全 AI 计略感知。UI/特效在 `main.js`/`hud.js`/`fx.js`。计略归属与新敌谋士在 `data/generals.js`，计略库在 `data/skills.js`。

**Tech:** 同前（原生 ES 模块、本地 three、node 单测；纯逻辑层不依赖 three/DOM）。

---

## 1. 契约（冻结）

### 1.1 计略库 `data/skills.js`（扩成全套；保留 heal/fire/guard 兼容现状）
SkillDef:
```js
{ id, name, kind:'damage'|'heal'|'buff'|'debuff'|'control', target:'enemy'|'ally'|'self'|'tile',
  range:[min,max],        // 施法距离（曼哈顿）
  area:0,                 // AOE 半径（0=单体，1/2=以目标格为心的曼哈顿半径）
  uses:3,                 // 每场次数
  power:0,                // 伤害/治疗基数（按 int 放缩）
  hit:'always'|'intDiff', // intDiff: 命中=clamp(85+(caster.int-target.int),...)
  element:null|'fire'|'thunder'|'water'|'dark',
  status:null|{type, turns, magnitude},  // 命中后施加的状态（见 1.2）
  learnableBy:[classId...] }
```
**全套 id（冻结）**：
- 攻击：`fire`火计(area1,fire) `thunder`落雷(单,高,thunder) `flood`水攻(area2,water) `darkmagic`妖术(area1,dark,+atk_down) `poison`毒雾(area1,+poison)
- 治疗/增益：`heal`治疗(单,ally) `healwave`群疗(area1,ally) `inspire`鼓舞(area1,ally,+atk_up) `ironwall`铁壁(ally/self,+def_up) `haste`疾风(ally,+spd_up & mov)
- 妨碍/控场：`confuse`乱心(area1,+confuse) `root`定身(单,+immobilize) `weaken`弱体(area1,+def_down)
- 保留 `guard`防御(self,本回合+def)。

### 1.2 状态系统 `battle/statuses.js`（纯）
```js
// StatusInstance: {type, turns, magnitude}
// 类型：poison(每回合-magnitude HP) confuse(本方回合可能无法行动/行动紊乱)
//       immobilize(不能移动,可原地攻/计) atk_up/atk_down/def_up/def_down/spd_up(数值改,持续turns)
export function applyStatus(unit, status)             // 叠加/刷新到 unit.statuses[]
export function tickStatuses(unit)                    // 回合开始：poison 扣血、turns--、清理过期 -> {dmg, expired:[type], log}
export function statMods(unit)                        // -> {atk:×, def:×, spd:×}（由增减益汇总）
export function canAct(unit)                           // confuse 概率/必然影响
export function canMove(unit)                          // immobilize -> false
```
- `combat.js`/`skillEngine.js` 计算有效 atk/def/spd 时叠加 `statMods`。`unit.statuses=[]` 加入 Unit 运行态。

### 1.3 计略结算 `battle/skillEngine.js`（纯；import skills/statuses/classes/terrain）
```js
export function skillTargets(caster, skill, map, units)  // 合法目标格集合（按 target/range，敌我过滤）
export function aoeCells(targetCell, area, map)          // AOE 覆盖格
export function resolveSkill(caster, skill, targetCell, units, map, rng)
//  -> { hits:[{unitId, dmg?, heal?, status?, missed?}], log:[], element }
//  伤害：power 基数 × (1 + caster.int/常数) × element/相性 × rng抖动 − 目标 def 抗(int 相关)，AOE 内逐目标；
//  命中 intDiff 时按 caster.int-target.int；heal 同理回血；buff/debuff/control 命中后 applyStatus。
//  不直接 mutate（除非约定）——返回 effects，由 controller 应用。
```

### 1.4 控制器 `battle/battleController.js`（改）
```js
useSkill(caster, skillId, targetCell)  // 校验 uses>0 & 目标合法 → resolveSkill → 应用 hp/status → uses-- →
                                       // caster.hasActed=true → emit 'unit:skill'{caster,skillId,targetCell,result} →
                                       // 对死亡 emit 'unit:died' → _checkEnd()
skillTargetCells(caster, skillId)      // 给 UI 高亮：可施法格 + 可被 AOE 命中预览
// 回合开始对每个存活单位 tickStatuses：poison 扣血(可致死→unit:died)、状态过期；emit 'status:tick'
// 玩家/AI 行动前用 canAct/canMove 限制（confuse/immobilize）
```

### 1.5 智将 AI `battle/ai.js`（改；import skillEngine/statuses）
- 新增 `'strategist'`：每回合按优先级——① 评估每个伤害计略在各目标格的 AOE 价值（命中我方数×权重 + 残血可击杀加成），价值高且射程内（必要时先移动进位）则施放；② 否则群疗/治疗受伤友军（缺血>阈值）；③ 否则对我方最强威胁下 confuse/weaken/root；④ 否则走位到安全射程/拉扯。
- 现有 reckless/cautious 若持有明显划算的伤害计略也可施放（轻量）。
- `planTurn` 返回动作序列扩展：`{kind:'skill', skillId, targetCell}`，由 controller 执行。

### 1.6 计略归属与新敌谋士 `data/generals.js`（改）
- 我方：荀彧=heal+fire+weaken+inspire；戏志才=thunder+confuse+poison；曹操=inspire+heal；（其余近战可不带或带 guard）。
- 敌方智将（智将 AI 展示）：新增 `lijru` 李儒（董卓谋士，strategist，fire+darkmagic+weaken+confuse），部署进 b2/b3/b5；并加通用 `lx_strat` 西凉谋士（thunder/weaken）。徐荣可带 ironwall。
- `skills` 字段引用 §1.1 的 id；`learnableBy` 与兵种自洽。

---

## 2. 文件
```
新建：src/battle/statuses.js, src/battle/skillEngine.js,
      tests/statuses.test.mjs, tests/skillEngine.test.mjs, tests/ai_strategist.test.mjs
改：  src/data/skills.js, src/data/generals.js, src/battle/battleController.js,
      src/battle/ai.js, src/main.js, src/ui/hud.js, src/render3d/fx.js
（同时把 lijru/lx_strat 部署进 b2/b3/b5 的 *.map.js —— 由对应 agent 顺带改这三张图的 enemies）
```

## 3. 阶段（Workflow）
- **阶段A 数据/状态（并行）**：S0a 扩 `skills.js`（全套）；S0b 改 `generals.js`（计略归属 + lijru/lx_strat）+ 把二者部署进 b2/b3/b5 的 map.enemies；S1 `statuses.js`+tests。（三者文件不冲突；id 按 §1 对齐。）
- **阶段B 引擎**：S2 `skillEngine.js`+tests（依赖 skills/statuses）。
- **阶段C 控制器+AI（并行）**：C1 `battleController` useSkill+状态结算+canAct/canMove；C2 `ai.js` strategist + 计略感知 + `ai_strategist.test.mjs`（均依赖 skillEngine）。
- **阶段D UI/特效**：UI agent 改 `main.js`（计略子菜单→选技→范围/AOE 预览→选格→useSkill；confuse/immobilize 限制玩家选项）、`hud.js`（技能列表含 uses、状态图标）、`fx.js`（火/雷/水/疗/增益/毒/乱 特效 + 飘字）。
- **阶段E 验收（me）**：跑全 tests 无回归；浏览器实玩——我方放一个 AOE 伤害计略 + 一个治疗/增益 + 一个控场；确认敌方智将（李儒）会放计略/集火/治疗；状态（中毒掉血/混乱/定身/增减益）逐回合结算正确。

## 4. 自检要点
- 新 Unit 字段 `statuses:[]` 不破坏现有 9 单测；战斗结算叠加 statMods 后旧用例仍绿（或按需更新断言）。
- 所有 skill id 引用自洽；generals.skills ⊂ SKILLS；lijru/lx_strat ∈ GENERALS 且部署格合法（沿用 P3 校验器扩跑）。
- 计略命中/伤害有确定性测试（固定 rng）。

## 5. 边界
- 资源 = 每技能 uses 次数（不引入气力/MP 池，留 P4）。
- 不做技能升级/连携（P4）。AOE 形状仅曼哈顿半径（不做直线/扇形）。
