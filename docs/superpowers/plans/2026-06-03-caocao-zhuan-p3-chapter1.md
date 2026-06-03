# 《群雄逐鹿·孟德篇》P3 实现计划 — 第一章圆满（第 2–5 战 + 完整剧情 + 关间整军）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 步骤用 `- [ ]` 跟踪。
> 关联：spec §3/§4；v1 引擎 + P2 单挑均已就绪、已验收。
> 原创致敬作：剧本与对白全部**原创**，取材公有领域《三国演义》/正史；**不得照抄任何现代译本或商业游戏文本**，用自己的话写。

**Goal:** 把第一章「起兵讨董」从 1 战扩成完整 5 战剧情线：第 2–5 战的地图 + 原创剧本，新武将登场，关间「整军」界面（查看/装备/学计略/存档），章节流程串联（战 → 战后 → 整军 → 下一战 → 章末），并用单挑系统演出**虎牢关·三英战吕布**。

**Architecture:** 纯内容/数据为主（不改引擎逻辑）。新增 `data/chapters/ch01/` 下 b2–b5 的 `*.map.js`+`*.story.js`，扩充 `generals.js` 新武将，新增章节清单 `data/chapters/ch01/index.js`；新增 `ui/intermission.js`；`main.js`/`gameState` 加章节流程与战间存档。三英战吕布用已就绪的 `scenarioRunner` `{type:'duel'}` 步 + 多回合单挑实现。

---

## 1. 新武将名册（契约 — 冻结 id；扩充 `data/generals.js`）

> appearance 沿用现有参数风格（armor/accent/skin/helmet/weapon/mount/scale/banner{char,color}/portraitSeed=id）。属性按角色定位拉开档次（吕布武力顶格、谋士低防高智等）。

**我方/盟友（剧情登场加入玩家可用）**
- `xunyu` 荀彧/文若 — strategist，智力极高、防低；第 2 战登场并加入。banner 曹。
- `xizhicai` 戏志才/志才 — strategist，谋士；第 2 战登场（早期谋主）。banner 曹。
- `dianwei` 典韦/—  — infantry（猛士、双戟、高 hp/atk）；第 2 战后作曹操护卫加入。banner 曹。

**客将（仅第 4 战虎牢关登场，玩家控制其单挑吕布；战后离队）**
- `liubei` 刘备/玄德 — leader，均衡。banner 刘。
- `guanyu` 关羽/云长 — infantry（青龙偃月、高武力、scale 略大）。banner 关。
- `zhangfei` 张飞/翼德 — spear（丈八蛇矛、最高武力之一、莽）。banner 张。

**敌方**
- `huaxiong` 华雄 — leader（西凉猛将，第 3 战汜水关 boss，高武力）。banner 华，西凉土黄。
- `lubu` 吕布/奉先 — cavalry（飞将，骑马持戟，武力 100，scale 1.12，紫金甲；第 4 战 boss）。banner 吕。
- `xurong` 徐荣 — cavalry/leader（第 5 战荥阳设伏 boss，谨慎善战）。banner 徐，西凉。
- `dongzhuo` 董卓/仲颖 — leader（过场/章末出现，肥硕、华服）。banner 董。仅剧情/立绘用。
- 通用敌兵：`lx_inf`/`lx_spear`/`lx_archer`/`lx_cav`（西凉步/枪/弓/骑，土黄褐配色，ai reckless/cautious）。
- 第 2 战「会盟」可用 `dz_van`（董卓军先锋，generic leader/infantry）。

> 通用兵可复用同一 def 多处部署（map.enemies 里多次引用同 id + 不同坐标）。

---

## 2. 四战设定（每战 = `bN_*.map.js` + `bN_*.story.js`）

> 地图沿用 b1 schema（cols/rows/tiles/deploy/enemies/victory/defeat/introScenario/outroScenario + triggers）。地形用 grass/road/forest/hill/mountain/water/gate。胜负 type 用已实现的 rout/defeatLeader/survive/capture/leaderDead。原创对白：每战 intro 1 段（动员/局势）、战中 1–2 个触发事件、outro 1 段（战果/转折/引子）。

### 第 2 战 `b2_huimeng` 会盟酸枣
- **基调**：十八路诸侯会盟讨董，联军貌合神离；曹操献策、谋士登场；先锋遭遇董卓军。
- **登场**：荀彧、戏志才（剧情加入）；战后典韦投奔。敌：`dz_van` + 西凉通用兵。
- **目标**：rout 或 defeatLeader(dz_van)。教学：计略/谋士、地形（林/丘）。
- **触发**：某回合诸侯按兵不动的讽刺事件；荀彧献策台词。

### 第 3 战 `b3_sishuiguan` 汜水关
- **基调**：联军攻汜水关，华雄连斩联军大将耀武扬威——**作为友军侧的过场事件**（不在曹军主视角直接演关羽斩华雄的细节，以战报/远景带过，保持原创与曹魏视角）；曹军侧翼推进破关。
- **登场**：敌 boss `huaxiong` + 西凉兵。**关门 gate 地形**做攻坚目标。
- **目标**：capture(关门) 或 defeatLeader(huaxiong)。教学：攻坚/关隘地形、远程压制。
- **触发**：华雄挑衅台词；联军大将受挫的战报事件；破关时的曹军台词。

### 第 4 战 `b4_hulaoguan` 虎牢关（**三英战吕布**）
- **基调**：吕布当关，勇冠诸侯；刘关张三英合力鏖战吕布，曹军主力趁势突破。
- **登场**：客将 liubei/guanyu/zhangfei（玩家可控）；敌 boss `lubu`（高 HP/武力，骑兵）+ 西凉兵。
- **三英战吕布（用单挑系统）**：触发器（如吕布 curHp 跌破阈值，或玩家令客将贴近吕布）启动剧情，依次 `{type:'duel', a:'zhangfei', b:'lubu'}` → `{type:'duel', a:'guanyu', b:'lubu'}` → `{type:'duel', a:'liubei', b:'lubu'}`。吕布 curHp 跨三场持续累减（单挑结算回写战场 HP），三场后若未被击毙则 narrate 其力竭败走（setFlag + 把 lubu 退场/撤走）。每场配原创战前/战后台词。
- **目标**：defeatLeader(lubu) 或 击退(剧情 flag)。
- **注意**：客将仅本战 deploy 为玩家可控（faction 'wei'），战后不进章节常驻 roster。

### 第 5 战 `b5_xingyang` 荥阳追击（章末转折）
- **基调**：董卓焚洛阳西遁，诸侯各怀私心按兵不动，唯曹操力主追击，孤军深入中徐荣埋伏——**一场艰难的「虽败犹荣」战**。
- **登场**：敌 boss `xurong`（设伏，谨慎）+ 西凉伏兵（forest/hill 伏击位）；过场 dongzhuo 西遁。
- **目标**（体现败战基调）：survive(坚持 N 回合后曹军且战且退) 或 「保曹操撤离到指定 capture 点」；defeat=leaderDead(caocao)。
- **触发**：埋伏触发（到达某区域敌伏兵出现的事件）；曹操中箭/卫兹或鲍信式护主牺牲的悲壮事件（用通用/已有角色，原创处理）；outro 奠定枭雄基调 + 第二章引子（如「宁教我负天下人」式的原创独白，不照抄原文）。

---

## 3. 关间整军 `ui/intermission.js`
- `run(ctx) -> Promise<void>`：章节地图/卷轴风格的整军界面，列出当前 roster（姓名/字/等级/兵种/HP/属性/已学计略），支持：
  - 查看武将详情（复用 portrait + statCard 风格）。
  - 装备/卸下物品与宝物（从 `gameState.inventory`；写回 roster entry.items）。
  - 学计略（若有计略书道具）。
  - 存档（`game.save(slot)`）。
  - 「出征」按钮 → resolve 进入下一战。
- 数据来自 `gameState`；不依赖具体战斗。node --check 通过即可，细节实玩走查。

---

## 4. 章节流程 + 战间存档（`data/chapters/ch01/index.js` + `gameState` + `main.js`）
- 新增 `data/chapters/ch01/index.js`：`export const CH01 = { id:'ch01', name:'第一章 · 起兵讨董', battles:[ {map,story} ×5 按序 ] }`（import 各 b1–b5 的 map/story 并按序排列）。
- `gameState`：用 `state.chapter`/`state.battleIndex` 驱动；roster 在战间持久化（升级/物品保留）；剧情登场加入的武将在对应战后 push 进 roster（客将不留）。
- `main.js` 章节循环：标题 →（新游戏/读档）→ for battle in CH01.battles：play intro → 战斗 → play outro → 若非最后一战则 `intermission.run` → battleIndex++ & autosave → 下一战；最后一战后 → 章末结算/字幕 → 返回 hub。读档从 `state.battleIndex` 续。
- 客将与剧情加入：在对应 battle 的 deploy 里直接列出（客将 faction 'wei' 仅该战）；常驻新武将（荀彧/戏志才/典韦）在其登场战后加入 roster（由 outro setFlag + 流程读取，或在 chapter index 标注 `joinsAfter`）。

---

## 5. 阶段与 subagent 拆分（Workflow）

- **阶段 G（先行，1 agent）**：扩充 `data/generals.js`，加入 §1 全部新武将（含 appearance/属性/成长/性格）。冻结 id 供后续引用。
- **阶段内容（并行，5 agents）**：
  - B2：`b2_huimeng.map.js` + `.story.js`
  - B3：`b3_sishuiguan.map.js` + `.story.js`
  - B4：`b4_hulaoguan.map.js` + `.story.js`（含三英战吕布 duel 序列）
  - B5：`b5_xingyang.map.js` + `.story.js`
  - INT：`ui/intermission.js`
  （各 agent 独立文件，互不冲突；均引用阶段 G 的 general id。）
- **阶段集成（1 agent）**：`data/chapters/ch01/index.js` 章节清单 + `gameState` 战间持久化/加入逻辑 + `main.js` 章节循环 + 战间存档；接通整军与剧情登场。
- **阶段验收（orchestrator/me）**：跑全 tests 无回归；浏览器走查——第 1 战胜→整军→第 2 战加载；抽查 b3/b4/b5 加载；**三英战吕布**单挑序列跑通；章末结算。

---

## 6. 数据/契约自检要点（集成后我会跑校验脚本）
- 所有 map.tiles 维度 = rows×cols；地形 id ∈ TERRAIN；deploy/enemies generalId ∈ GENERALS 且不在 water/impassable。
- 所有 story `who`/duel a,b ∈ GENERALS。
- CH01.battles 顺序与 map.introScenario/outroScenario id 自洽。
- 跑现有 9 个单测无回归。

## 7. 范围/原创边界
- 不照抄任何现代译本或商业游戏文本；事件用公有领域史/演义、对白全新写。
- 招募系统本阶段仅「剧情登场加入」，不做完整招募树（后续 P4）。
- 阵型/转职/宝物全树仍后置（P4）。
