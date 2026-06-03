# 《群雄逐鹿·孟德篇》v1 实现计划 — 地基 + 第一战竖切

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现。步骤用 `- [ ]` 复选框跟踪。
> 关联设计：`docs/superpowers/specs/2026-06-03-caocao-zhuan-srpg-design.md`
> 原创致敬作：美术全程序化、剧本全原创，仅用公有领域三国史/演义素材。

**Goal:** 从 hub 进入游戏，开场剧情 → 第一战「陈留起兵」等距 3D 战棋全流程可玩（点选/移动范围/攻击/相克/地形/反击/命中/AI/升级/胜负/战后剧情/存档/返回 hub），并锁死全部共享接口与数据 schema 供后续并行开发。

**Architecture:** 引擎/内容分离、数据驱动。`battle/` 与 `story/` 为纯逻辑（不依赖 Three.js，可单测）；`render3d/` 仅按状态作画与播动画；`ui/` 为 DOM 覆盖层；三者经 `core/eventBus.js` 与 `core/gameState.js` 通信。

**Tech Stack:** 原生 ES Modules（无构建）、本地 vendored Three.js（importmap）、localStorage、WebAudio；纯逻辑层用轻量自写断言跑在浏览器/Node。

---

## 0. 测试与运行约定

- **逻辑单测**：纯函数模块（`pathfind`/`combat`/`leveling`/`victory`/`classTriangle`）写 `tests/*.test.mjs`，用 Node 直接跑：`node tests/combat.test.mjs`（自写 `assert`，无需框架）。每个 test 文件 `import` 被测模块（这些模块**不得 import Three.js 或 DOM**）。
- **手动验收**：渲染/UI/剧情用浏览器实玩走查，列出可观察的验收点。
- **本地运行**：根目录已有 `start.sh` 起静态服务；游戏页 `games/caocao-zhuan/index.html`。
- **提交粒度**：每个 Task 末尾提交一次，message 用 `feat(caocao-zhuan): ...` / `test(...)` / `chore(...)`。

---

## 1. 共享接口与数据 Schema（契约 — 阶段 A 冻结，后续不得擅改）

> 所有数值为示意，平衡在实现期调。字段名即契约，跨模块/跨 subagent 必须一致。

### 1.1 兵种 `data/classes.js`
```js
// export const CLASSES = { [id]: ClassDef }
// ClassDef
{ id:'infantry', name:'步兵', moveType:'foot',  // 'foot' | 'horse'
  atkRange:[1,1], counterRange:[1,1],           // [min,max] 曼哈顿距离
  growth:{ hp:6, atk:3, def:2, int:1, spd:2 },  // 每级增量基线（可被武将 growth 覆盖）
  skills:['guard'], promoteTo:['guard_elite'] }
// 兵种 id：infantry 步 / spear 枪 / cavalry 骑 / archer 弓 / strategist 谋士 / leader 主将
```

### 1.2 相克 `battle/classTriangle.js`（纯函数）
```js
// 返回攻方对守方的兵种克制系数
export function triangleMul(attackerClassId, defenderClassId): number
// 基线表（示意）：spear>cavalry=1.5；cavalry>archer=1.4, cavalry>infantry=1.3, cavalry<spear=0.7；
// archer>infantry=1.3, archer<cavalry=0.8；其余=1.0；strategist 作守方被物理 1.2（脆）。
```

### 1.3 地形 `data/terrain.js`
```js
{ id:'grass', name:'草地', moveCost:{foot:1,horse:1}, defBonus:0, avoidBonus:0, passable:true }
// 其余：road 路(foot1/horse1,移动顺滑) / forest 林(foot1/horse2,def+2,avoid+15) /
// hill 丘(foot2/horse3,def+2) / mountain 山(foot3/horse99,def+3) /
// water 水(passable:false) / gate 关门(def+3, capture:true)
```

### 1.4 计略 `data/skills.js`
```js
{ id:'heal', name:'治疗', kind:'support', target:'ally', range:1, area:0,
  uses:3, power:12, formula:'fixedPlusInt' }
{ id:'fire', name:'火计', kind:'magic', element:'fire', target:'enemy', range:2, area:1,
  uses:3, power:14, hit:'intDiff' }
{ id:'guard', name:'防御', kind:'self', ... } // 本回合提升防御
// v1 仅需实现 heal / fire / guard 三个，证明计略系统；引擎按 kind 分派。
```

### 1.5 武将 `data/generals.js`
```js
// GeneralDef（静态档案）
{ id:'caocao', name:'曹操', title:'孟德', faction:'wei', classId:'leader',
  base:{ hp:60, atk:22, def:14, int:24, spd:16, mov:5 },
  growth:{ hp:7, atk:3, def:2, int:3, spd:2 },
  skills:['heal'], items:[],
  ai:null,                       // 玩家方为 null；敌方为 'reckless'|'cautious'|'strategist'|'guard'
  appearance:{ armor:0x2a3550, accent:0xb8902c, skin:0xe7b98a, helmet:'crest',
               weapon:'sword', mount:false, scale:1.05, banner:{char:'曹',color:0x1d2b4d},
               portraitSeed:'caocao' } }
// Unit（运行态，battleController 生成）= GeneralDef 的副本 + 战场态：
// { ...def, level, exp, curHp, maxHp, pos:{c,r}, hasMoved:false, hasActed:false, alive:true }
```

### 1.6 战役地图 `data/chapters/ch01/b1_chenliu.map.js`
```js
{ id:'ch01_b1', name:'陈留起兵', cols:10, rows:8,
  tiles:[ /* rows×cols 的 terrainId 二维数组 */ ],
  deploy:[ {generalId:'caocao', c:1, r:6}, {generalId:'xiahoudun', c:2, r:5}, ... ],
  enemies:[ {generalId:'yellowturban_capt', c:8, r:2, ai:'reckless'}, ... ],
  victory:{ type:'rout' },        // 'rout'全歼 | 'defeatLeader' | 'capture' | 'survive'
  defeat:{ type:'leaderDead', generalId:'caocao' },
  introScenario:'ch01_b1_intro', outroScenario:'ch01_b1_outro' }
```

### 1.7 剧本 `data/chapters/ch01/b1_chenliu.story.js`
```js
{ id:'ch01_b1_intro', steps:[
   { type:'narrate', text:'中平六年，董卓乱政……' },
   { type:'say', who:'caocao', text:'孟德虽不才，愿首倡大义！' },   // who → 取 appearance 生成立绘
   { type:'choice', prompt:'……', options:[{text:'起兵！', setFlag:{started:true}}] },
   { type:'camera', preset:'iso' } ] }
// 战场触发器（map 或 story 内）：
{ triggers:[ { on:'turnStart', turn:3, scenarioId:'...' },
             { on:'unitDead', generalId:'...', scenarioId:'...' },
             { on:'reachTile', c, r, by:'wei', scenarioId:'...' } ] }
```

### 1.8 核心模块 API（契约）
```js
// core/eventBus.js
export const bus = { on(evt,fn), off(evt,fn), emit(evt,payload) }
// 事件名：'unit:selected''unit:moved''unit:attacked''unit:died''turn:changed'
//        'battle:win''battle:lose''scenario:done''camera:cinematic'

// core/gameState.js
export const game = {
  state,                          // {chapter,battleIndex,roster[],inventory[],storyFlags,settings}
  newGame(), save(slot), load(slot), listSaves(),
  roster,                         // 玩家武将（带升级持久化）
}

// core/rng.js  -> export function makeRng(seed){ return ()=>float[0,1) }  // 可复现

// battle/grid.js     -> tileAt(map,c,r), inBounds(map,c,r), neighbors(map,c,r)
// battle/pathfind.js -> reachable(unit, map, occupied) -> Map<"c,r",cost> (cost<=mov)
//                       path(map, from, to, moveType, occupied) -> [{c,r}...]
// battle/combat.js   -> resolveAttack(attacker, defender, map, rng)
//                       -> { hit:bool, dmg, killed:bool, counter:{hit,dmg,killed}|null, log:[] }
// battle/leveling.js -> gainExp(unit, amt) -> { leveledUp:bool, gains:{} }   // 满100升级
// battle/victory.js  -> evaluate(battleState) -> 'win' | 'lose' | null
// battle/ai.js       -> planTurn(enemyUnit, battleState) -> [{kind:'move',to}|{kind:'attack',target}]
// battle/battleController.js -> new BattleController(map, roster, {rng,bus})
//   .phase ('player'|'enemy'|'event'|'resolved'); .selectableTiles(unit);
//   .moveUnit(unit,to); .attack(attacker,defender); .endPlayerTurn(); .runEnemyTurn()

// render3d/sceneManager.js -> init(canvas); buildBattle(map, units); frame(); dispose()
// render3d/camera.js       -> setIso(); cinematic({focus,zoom}); reset(); update(dt)
// render3d/unitFactory.js  -> makeGeneral(appearance) -> THREE.Group  // 来自 PoC
// render3d/terrainFactory.js -> buildGrid(map) -> {group, tileMeshes}
// render3d/fx.js           -> moveAlong(group,path), hitFlash(group), floatText(pos,text)

// story/dialogue.js     -> play(scenario) -> Promise<void>  // 渲染对话框+立绘，等点击推进
// story/scenarioRunner.js -> run(scenario, ctx) -> Promise<void>  // 解释 steps，调 dialogue/camera
// story/portrait.js     -> portraitDataURL(appearance) -> string  // 程序化立绘(canvas)

// ui/hud.js -> showUnit(unit), hideUnit(), actionMenu(actions)->Promise<choice>, turnBanner(text)
```

---

## 2. 文件结构（本计划新建）

```
games/caocao-zhuan/
  index.html, style.css, README.md
  lib/three.module.js                      # vendored
  src/main.js
  src/core/{eventBus,gameState,rng}.js
  src/data/{classes,terrain,skills,generals}.js
  src/data/chapters/ch01/{b1_chenliu.map,b1_chenliu.story}.js
  src/battle/{grid,pathfind,classTriangle,combat,leveling,victory,ai,battleController}.js
  src/render3d/{sceneManager,camera,unitFactory,terrainFactory,fx}.js
  src/story/{dialogue,scenarioRunner,portrait}.js
  src/ui/{hud,menus}.js
  src/audio/audio.js
  tests/{pathfind,combat,classTriangle,leveling,victory}.test.mjs
js/games.js                                # 追加一条注册（修改）
```

---

## 阶段 A · 地基（先行，冻结契约）

### Task A1: 项目骨架 + Hub 注册 + vendored Three
**Files:** Create `games/caocao-zhuan/index.html`, `style.css`, `lib/three.module.js`（从 PoC 用的 three@0.160 module 拷入）; Modify `js/games.js`
- [ ] 建 `index.html`：`<canvas>` + 覆盖层容器(对话/HUD/菜单) + importmap 指 `./lib/three.module.js` + `<script type="module" src="src/main.js">` + 「← HUB」返回链接 + 静音按钮（照 jungle-blitz 约定）。
- [ ] `style.css`：国风金/朱主题，覆盖层基础样式。
- [ ] `js/games.js` 追加：`{ id:'caocao-zhuan', title:'群雄逐鹿·孟德篇', subtitle:'三国战棋 · 回合制 SRPG', desc:'等距3D战棋 · 兵种相克 · 计略单挑 · 剧情演出 · 键鼠', icon:'⚔️', accent:'#d4af37', accent2:'#7a1f1f', tags:['策略','战棋','三国','键鼠'], path:'games/caocao-zhuan/index.html' }`。
- [ ] `src/main.js` 暂时只初始化场景并打印 'boot ok'。
- [ ] 验收：hub 出现新卡片可点进；页面无报错；返回 hub 可用。
- [ ] Commit。

### Task A2: core — eventBus / rng / gameState（含存档）
**Files:** Create `src/core/eventBus.js`,`rng.js`,`gameState.js`; Test `tests/` 暂无（gameState 存档手测）
- [ ] `eventBus.js`：实现 `on/off/emit`（按 §1.8）。
- [ ] `rng.js`：`makeRng(seed)` 确定性 LCG/mulberry32。
- [ ] `gameState.js`：`state` 结构、`newGame/save/load/listSaves`（localStorage key `save_caocao_v1_slot{n}`，序列化 roster 等级/经验/物品/已学计略 + 进度 + flags + settings）。
- [ ] 验收：浏览器 console `game.newGame(); game.save(1); game.load(1)` 往返一致。
- [ ] Commit。

### Task A3: 数据 schema 落地（classes/terrain/skills/generals 第一章子集）
**Files:** Create `src/data/{classes,terrain,skills,generals}.js`
- [ ] 按 §1.1/1.3/1.4/1.5 写出：6 兵种；7 地形；3 计略(heal/fire/guard)；第一章登场武将（曹操/夏侯惇/夏侯渊/曹仁/曹洪 + 敌将黄巾首领若干），appearance 参数复用 PoC 风格。
- [ ] 验收：`import` 后字段齐全、id 唯一、appearance 字段完整。
- [ ] Commit。

### Task A4: 战役地图 + 剧本（第一战数据）
**Files:** Create `src/data/chapters/ch01/b1_chenliu.map.js`,`b1_chenliu.story.js`
- [ ] 按 §1.6 写 10×8 地图（含路/草/林/丘/水/关门，含我方部署与敌方布阵）；victory `rout`，defeat `leaderDead caocao`。
- [ ] 按 §1.7 写 intro/outro 剧本（**原创对白**：陈留起兵的动员与胜后片段）+ 至少一个战场触发器（如第 3 回合敌援军台词）。
- [ ] 验收：`import` 结构合法；tiles 维度 = rows×cols。
- [ ] Commit。

---

## 阶段 B · 纯逻辑（TDD）

### Task B1: grid + pathfind（移动范围 / 路径）
**Files:** Create `src/battle/grid.js`,`pathfind.js`; Test `tests/pathfind.test.mjs`
- [ ] **写失败测试**（节选）：
```js
import {reachable} from '../src/battle/pathfind.js';
import assert from 'node:assert';
const map={cols:3,rows:1,tiles:[['road','road','road']]};
const unit={pos:{c:0,r:0},base:{mov:2},classId:'infantry'};
const r=reachable(unit,map,new Set());
assert.equal(r.get('1,0'),1); assert.equal(r.get('2,0'),2); assert.ok(!r.has('3,0'));
console.log('pathfind ok');
```
- [ ] **跑测试看失败**：`node tests/pathfind.test.mjs` → 报未实现。
- [ ] **实现**：`grid.js`（`tileAt/inBounds/neighbors`）；`pathfind.js`（Dijkstra/BFS 按 `terrain.moveCost[moveType]` 累计 ≤ mov，绕过 `occupied` 与不可通行；`path()` 回溯最短路）。
- [ ] **跑测试通过**：含林地 horse 消耗、water 阻挡、被占格阻挡用例。
- [ ] Commit。

### Task B2: classTriangle + combat（伤害/相克/地形/反击/命中）
**Files:** Create `src/battle/classTriangle.js`,`combat.js`; Test `tests/classTriangle.test.mjs`,`combat.test.mjs`
- [ ] **写失败测试**：枪克骑 `triangleMul('spear','cavalry')===1.5`；`resolveAttack` 中地形 defBonus 降伤、命中走 rng、击杀置 `killed`、目标在反击距离内回反击。给定固定 rng 校验确定伤害值。
- [ ] **跑失败 → 实现 → 跑通过**：伤害 = max(1, round((atk×triangle×terrainAtk − defEff)×rngJitter))；defEff=def+terrain.defBonus；命中=clamp(base − 目标avoid(含地形))，rng 判定；反击仅当守方存活且攻方在守方 counterRange。
- [ ] Commit。

### Task B3: leveling + victory
**Files:** Create `src/battle/leveling.js`,`victory.js`; Test `tests/leveling.test.mjs`,`victory.test.mjs`
- [ ] **测试**：`gainExp` 跨 100 触发升级并按 growth 加属性、curHp 同步 maxHp 增量；`evaluate` 对 `rout`(敌全灭→win)、`leaderDead`(曹操亡→lose)、`survive`(回合达标→win) 正确返回。
- [ ] 失败→实现→通过→Commit。

### Task B4: ai（敌方决策）
**Files:** Create `src/battle/ai.js`; Test `tests/`（可对 planTurn 做轻量断言）
- [ ] 实现 `planTurn`：`reckless` 朝最近敌移动并攻击；`cautious` 优先集火可击杀的残血、否则待机；`guard` 守据点不远离。返回 move/attack 动作序列（不直接改状态，由 controller 执行）。
- [ ] 验收：构造小场景断言 reckless 会逼近并攻击。Commit。

### Task B5: battleController（回合状态机）
**Files:** Create `src/battle/battleController.js`; Test `tests/`（无渲染地跑一回合）
- [ ] 实现状态机：构造时由 map.deploy/enemies + roster 生成 Unit；`phase` 流转 player→enemy→event→resolved；`selectableTiles`(调 pathfind)、`moveUnit`、`attack`(调 combat+leveling，emit 事件)、`endPlayerTurn`、`runEnemyTurn`(调 ai)。每次动作后调 `victory.evaluate`，命中则 emit `battle:win/lose`。触发器在相应时机 emit。
- [ ] 验收（headless）：脚本化「移动→攻击击杀全部敌人→emit battle:win」跑通。Commit。

---

## 阶段 C · 渲染 / UI / 剧情 / 集成

### Task C1: render3d — 迁移 PoC 为模块
**Files:** Create `src/render3d/{sceneManager,camera,unitFactory,terrainFactory,fx}.js`
- [ ] 从 `.superpowers/.../iso-3d-poc.html` 抽出并模块化：`unitFactory.makeGeneral(appearance)`、`terrainFactory.buildGrid(map)`、`sceneManager`（光照/渲染循环/raycast 选取）、`camera`（等距锁定 + `cinematic()` 运镜 tween）、`fx`（`moveAlong` 沿 path 行走、`hitFlash`、`floatText` 飘字）。
- [ ] 验收：用第一战 map + units 能渲染出等距战场、武将各异、点选 raycast 命中、相机可运镜。Commit。

### Task C2: story — portrait / dialogue / scenarioRunner
**Files:** Create `src/story/{portrait,dialogue,scenarioRunner}.js`
- [ ] `portrait.portraitDataURL(appearance)`：canvas 程序化生成水墨/低多边形头像（按 portraitSeed + 颜色），供对话框使用。
- [ ] `dialogue.play(scenario)`：渲染底部对话框（立绘+姓名字+文本+点击推进+choice 选项），返回 Promise。
- [ ] `scenarioRunner.run`：解释 steps（say/narrate/choice/camera/setFlag），choice 写 `game.state.storyFlags`，camera 调 `render3d/camera`。
- [ ] 验收：能播第一战 intro 剧本，立绘显示、选项可选、相机切换。Commit。

### Task C3: ui — hud / menus
**Files:** Create `src/ui/{hud,menus}.js`
- [ ] `hud`：单位信息卡（点选显示属性/HP 条/兵种/计略）、行动菜单（移动/攻击/计略/待机，返回所选）、回合横幅、相位提示。
- [ ] `menus`：标题、暂停、胜/负结算（含升级演出位）、存读档槽。
- [ ] 验收：点单位出信息卡；行动菜单可选并回传。Commit。

### Task C4: 集成 — main.js 场景流 + 音频 + 第一战可玩
**Files:** Modify `src/main.js`; Create `src/audio/audio.js`
- [ ] `audio.js`：WebAudio 原创音效（选择/移动/攻击/命中/胜负），静音开关接 hub 约定。
- [ ] `main.js` 串流：标题 → `scenarioRunner` 播 intro → `BattleController` + `sceneManager` 建战 → 玩家相（点单位→`selectableTiles`→`fx.moveAlong`→行动菜单→`attack`→敌相 `runEnemyTurn`）→ `victory` → 播 outro → `game.save` → 返回 hub。事件经 `bus` 把逻辑层结果驱动到渲染/UI/音频。
- [ ] **验收（实玩走查，浏览器）**：
  1. hub 进入 → 开场剧情（立绘+原创对白）→ 进战。
  2. 等距 3D 战场、武将各异；点我方单位看移动范围；移动有行走动画。
  3. 攻击体现兵种相克 + 地形 + 命中 + 反击；飘字与受击反馈；击杀升级。
  4. 敌方 AI 自动行动；回合推进。
  5. 全歼达成胜利 → 战后剧情 → 存档 → 返回 hub；静音可用；无致命报错。
- [ ] Commit。

### Task C5: 逻辑回归 + README + 收尾
**Files:** Create `games/caocao-zhuan/README.md`; run all `tests/*.test.mjs`
- [ ] 跑全部单测通过：`for f in tests/*.test.mjs; do node "$f"; done`。
- [ ] README：操作说明、第一章简介、原创/版权声明、后续章节路线。
- [ ] Commit。

---

## 3. 自审（spec 覆盖 / 占位符 / 类型一致）

- **spec 覆盖**：战斗界面(C1/C4)、兵种相克(B2)、地形(B2/A3)、升级(B3)、计略系统(A3 数据+ C4 调用，单挑/法术深度后置)、单挑(本切片仅留接口，battle4 计划实现)、剧情对话(C2)、关键运镜(C1/C2)、胜负(B3/B5)、存档(A2)、hub 集成(A1)、第一战内容(A4)——均有任务。**单挑/AI 深度/2–5 战/整军全功能**明确后置到后续计划。
- **占位符**：本计划无 TBD；接口签名集中在 §1.8，任务引用一致。
- **类型一致**：`reachable→Map<"c,r",cost>`、`resolveAttack→{hit,dmg,killed,counter,log}`、`Unit` 字段、事件名 全文统一。

## 4. 后续计划（北极星，逐份独立）
- P2：计略全套 + 单挑系统（虎牢关三英战吕布）+ AI 智将。
- P3：第 2–5 战地图 + 完整剧情 + 关间整军/招募。
- P4：阵型/转职全树 + 宝物 + 音乐 BGM。
- P5+：第二章及以后（每章独立 spec→plan→实现）。
