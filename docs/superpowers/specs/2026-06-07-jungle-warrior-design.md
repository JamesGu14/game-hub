# 丛林勇士 JUNGLE WARRIOR — 设计稿（Design Spec）

> 日期：2026-06-07 · 状态：已确认 v2（已纳入 `docs/opencode/oc_review.md` 评审修订，待转 writing-plans）
> 类型：web 版经典横版即时动作射击（魂斗罗式 run-and-gun）+ 多关卡 + 选关存档
> 归属：game-hub · 游戏文件夹 `games/warrior/` · 仅个人使用、非商用
> **主要玩家：用户 7 岁的儿子**（也兼顾用户本人）→ **儿童友好是第一优先级**

---

## 1. 概述与定位

复刻经典 FC《魂斗罗》的**横版即时动作射击**手感（参考图：丛林关、扛枪突击兵、扑跳敌兵、8 方向射击、武器升级、关底 BOSS），做成一款**纯浏览器、零构建**的小游戏，放进 game-hub。

澄清要点（务必锁定）：

- **不是回合制游戏**。"回合"指**关卡/关数**——一关一关打，难度由易到难。
- **单关之内是经典即时动作**：玩家持续跑/跳/射击，敌人**同时持续移动**。不是战棋/菜单/分路。
- **表现层 = 经典横版像素魂斗罗**，但**美术全部原创**（代码绘制，规避版权）。
- **目标玩家是 7 岁儿子**：友好键位、无惩罚的默认难度、夸张的即时反馈、酷炫彩蛋优先；同时保留一个"经典模式"让孩子长大、或用户本人想挑战时切换。

### 目标（In Scope, v1）
- 单人；5 关（易→难），每关一主题 + 一关底 BOSS。
- 经典 8 方向瞄准 + 跳 + 卧倒 + 连射；**单一移动速度**（去掉跑/走区分，减按键、更还原、更适合小手）。
- **武器体系**：默认步枪（无字母）+ 4 把主武器（M/S/L/F）+ 2 个增益道具（R 射速 / B 屏障），经典"红鹰"载具掉落拾取。
- **难度双模式（可在标题/选关切换，存档记忆）**：
  - **休闲模式（默认，儿童向）**：被击中/掉坑→原地即时复活、不丢武器、无命数、无时间压力。
  - **经典模式（进阶/还原）**：3 命、死亡丢武器+原地复活、命尽 Game Over→本关从头、保留选关存档。
- **选关存档**：通关关卡记录在 localStorage；可选任意已通关关重玩或接着打下一未通关关；记录最好成绩 + ⭐评级。
- **儿童友好正反馈**：连击计数、击杀飘字、夸张爆炸粒子、通关 ⭐⭐⭐ 评级。
- **Konami Code 彩蛋**（标题页 ↑↑↓↓←→←→BA）。
- 键盘 + 触屏（iPad/手机）+ 手柄 三端操作；NES 式默认键、可改键。
- 美术风格、引擎架构、音频全部对齐 `games/pixel-quest`。

### 非目标（Out of Scope, v1，YAGNI）
- 不做 2P 本地合作（引擎预留单/双角色边界，v1 只实现单人）。
- 不做"现代双摇杆/分离式瞄准"模式（触屏用经典 8 向虚拟方向键即可）。
- 不做关内中途存档（单关短 + 复活机制，等于关内软存档）。
- 不做在线排行榜、账号、商用化、关卡编辑器（仅内部 `tools/verify-levels.mjs`）。
- **俯视/纵深"基地关"与瀑布纵向卷轴**：v1 全部横版卷轴；这两个经典关型列为 **v2 候选**（见 §11），需新增摄像机/逻辑，本期不做。

---

## 2. 技术栈与架构

**完全对齐 pixel-quest**：纯原生 JS ES modules，零构建；Canvas 2D；固定"世界像素空间" + FIELD 视口缩放/letterbox；美术为**代码绘制像素**（离屏 canvas 缓存 + nearest-neighbor 放大 blit）。

### 文件结构与模块职责（单一职责、清晰边界）

```
games/warrior/
  index.html        画布 + HTML 浮层(标题/选关/模式切换/暂停/设置/触屏按钮/← HUB)
  style.css         浮层与触屏控件样式
  package.json      name + "test": node --test
  src/
    config.js       常量与调参：TILE/FIELD/重力/PLAYER/ENEMY/WEAPONS/MODES/THEMES/SCORE/STORAGE_KEY/每关难度
    sprites.js      代码绘制像素：突击兵(8向姿态)·各敌兵·子弹·红鹰·屏障·BOSS·地块·背景；缓存 + blit
    physics.js      collideTiles / aabb / groundAhead（瓦片平台碰撞，复用 pixel-quest）
    entities.js     Player / 敌人(Runner,Jumper,Gunner,Turret,Flyer) / Bullet / Falcon(载具) / Pickup / Boss
    weapons.js      武器与道具定义表 + fire(world, owner, aimVec)；默认枪/M/S/L/F + R/B 增益逻辑
    input.js        键盘+手柄+触屏 → 统一 Intent；含 resolveAim() 与 Konami 序列检测
    levels.js       5 关数据：char-grid + 实体摆放 + 红鹰投放 + BOSS 定义 + theme + 难度参数
    save.js         localStorage 读写 + 版本迁移 + 选关进度/最好成绩/⭐/模式/彩蛋 API
    render.js       场景/视差/实体/HUD/BOSS 血条/连击/飘字/横幅；崩溃自愈
    audio.js        WebAudio 8-bit 音效 + 循环 BGM（复用 pixel-quest 模式）
    game.js         状态机/关卡加载/相机/复活/命数·模式/过关·评级/与 save 交互（world 拥有者）
    main.js         bootstrap：建 canvas/renderer/loop，绑定标题·选关·模式·暂停·设置 UI，← HUB 返回
  tests/
    physics.test.mjs   aim.test.mjs      weapons.test.mjs
    collision.test.mjs damage.test.mjs   capsule.test.mjs
    input.test.mjs     save.test.mjs     levels.test.mjs    boss.test.mjs
  tools/
    verify-levels.mjs 关卡静态校验(出生点/红鹰/BOSS/可达/无悬空死区)
```
+ 在 `js/games.js` 注册一张卡片（id `warrior`）。

### 依赖方向（避免环）
`config` ← 所有模块；`physics`/`sprites` 为叶子工具；`weapons` 依赖 `config`；`entities` 依赖 `physics`+`config`+`weapons`；`render` 依赖 `sprites`+`config`+`entities`；`game` 组合 `entities`+`physics`+`levels`+`save`+`audio`；`main` 组合 `game`+`render`+`input`。实体只读 `game` 暴露的 `world`（grid/敌人/spawn/addScore/sound/player/**mode**/input），对齐 pixel-quest 的 `entity.update(dt, world)`。

---

## 3. 核心玩法系统（单关 = 即时动作）

### 3.1 移动
- 跑（**单一速度**，无走/跑切换）、跳（变高跳 jumpCutoff + coyote + jump-buffer，沿用 pixel-quest 手感）。
- **卧倒/下蹲 prone**：地面按↓→趴下，水平射击 + 受击框缩小；松开恢复。
- v1 不做攀爬/游泳；地形以平台+坑+垂直跳台+掩体为主。

### 3.2 瞄准模型（**经典"按方向即瞄准"**，非双摇杆）
**握紧的方向键 = 射击方向**，朝向跟随移动——这是魂斗罗/NES 逻辑，**不是**合金弹头/双摇杆那种"可以边左移边右射"的分离瞄准，也**没有**独立瞄准键。对 7 岁孩子最直觉：人往哪跑就往哪打。

`resolveAim(intent, onGround, faceRight) → 单位向量 (dx,dy)`：
- 仅左右：水平（朝 faceRight）。
- 上+左/右：斜上 ↗/↖；仅上：正上 ↑。
- 地面 下：触发 prone（仍水平射击），不产生 ↓。
- 空中 下+左/右：斜下 ↘/↙；空中仅下：正下 ↓。
- `aim.test.mjs` 全 8 向 + 边界覆盖。

### 3.3 射击 · 武器 · 道具
- **按住开火=连射**，受当前武器 `cooldown` 限制；子弹方向 = `resolveAim()` × 武器弹速。
- **主武器**（拾取字母替换当前主武器；死亡处理见 §3.4）：

| 字母 | 武器 | 行为 | 初定参数 |
|------|------|------|----------|
| —(默认) | 步枪 Rifle | 单发直线（起始武器，无字母） | cooldown 0.18s, dmg 1, 弹速 560 |
| M | 机枪 Machine | 高射速单发直线 | cooldown 0.08s, dmg 0.5, 弹速 600 |
| S | 散弹 Spread | 一次 5 发 ±18° 扇形 | cooldown 0.34s, 每发 dmg 1, 弹速 520 |
| L | 激光 Laser | 穿透长直线（贯穿多敌） | cooldown 0.40s, dmg 2, pierce, 弹速 720 |
| F | 火球 Fire | 抛物/螺旋、可越障、小范围 | cooldown 0.5s, dmg 2, 弹速 420 |

- **增益道具**（不替换主武器，叠加在玩家状态上）：

| 字母 | 道具 | 行为 |
|------|------|------|
| R | 射速 Rapid | 提升当前主武器射速/弹速（可叠加；经典模式死亡重置，休闲模式保留） |
| B | 屏障 Barrier | 拾取后数秒无敌 + 撞敌秒杀（计时型；**对孩子最友好的爽点**） |

- **红鹰投递（Falcon）**：经典红鹰载具从屏外飞入沿固定路径移动，**被玩家子弹击中**→掉落**闪烁的武器/道具字母图标**（Pickup），玩家**触碰拾取**。每关脚本化投放若干（`levels.js` 指定字母与路径）。
- 默认枪正名无字母，避免与经典 R=射速冲突。

### 3.4 受击 / 复活 / 命数（**按模式分流**，`config.MODES`）
- **玩家无血条**：沿用魂斗罗"一击即倒"——任意敌人/敌弹接触、或落入坑/即死区即"倒下"。
- **休闲模式（默认）**：倒下→死亡演出后**原地（或最近安全落脚点）即时复活** + 无敌闪烁；**不丢武器、不退关、不扣分、无命数**（HUD 显示"复活 ∞"）。无时间致死（计时仅记成绩）。
- **经典模式**：3 命；倒下→**丢失主武器（回默认枪）** + 原地复活 + 短无敌，命 −1；命尽→**Game Over → 本关从头**（**选关存档与 unlockedMax 不变**，已解锁的关仍在）。Konami 彩蛋下命数=30。
- 模式由标题/选关切换，存 `save.settings.mode`，缺省 `casual`。

### 3.5 过关与评级
- 推进到关尾触发 BOSS；BOSS HP 归零 → `levelClear()`：
  - 结算用时/得分，计算 **⭐ 评级**（如 3⭐=本关 0 死且用时达标 / 2⭐=少量死 / 1⭐=通关）。
  - `save.markCleared(id, {time, score, stars})` 更新最好成绩与解锁。
  - 回选关（或"下一关"按钮）。

---

## 4. 敌人与 BOSS

### 4.1 杂兵（逐关增种类+密度）
- **Runner 跑兵**：地面冲向玩家，接触伤害。
- **Jumper 扑/跳兵**（参考图蓝衣扑兵）：靠近时跃起扑击。
- **Gunner 蹲守兵**：定点，周期朝玩家方向射击。
- **Turret 炮台/机枪巢**：固定，扇形/定向连射弹幕。
- **Flyer 飞兵**：空中正弦移动，俯冲或投弹。
- 接口：`update(dt, world)`、`dead`、`hit(dmg, world)`（HP≤0 → 死亡+夸张爆炸粒子+加分+可触发连击）。

### 4.2 关底 BOSS（每关 1 个，难度递增；中英双语"中二"命名增加酷感）
通用模型：`hp/maxHp`、`phases[]`（按血量切换）、`attackPatterns`（弹幕/冲撞/召兵）、`weakpoint` 窗口、死亡演出；HUD 底部 BOSS 血条 + 名称。

| 关 | BOSS（中二命名） |
|----|------|
| L1 丛林 | **震地要塞·铁壁** Iron Gate Destroyer |
| L2 基地 | **独眼核心·加尔玛** Cyclops Core |
| L3 瀑布 | **旋翼死神·瓦尔基里** Valkyrie Gunship |
| L4 雪原 | **寒霜重坦·克隆** Frost Crawler |
| L5 敌巢 | **创魔之心·戈梅拉**（多阶段终 BOSS） Heart of Gomera |

---

## 5. 关卡与难度曲线（5 关，易→难，全横版）

| 关 | 主题(theme) | 新增挑战 | BOSS |
|----|------|----------|------|
| L1 丛林 forest | 教学：慢跑兵、基础跳台、第一只红鹰 | 震地要塞·铁壁（弱、教学） |
| L2 基地 steel | 炮台 + 垂直跳台 | 独眼核心·加尔玛 |
| L3 瀑布 beach/forest变体 | 移动平台 + 空中飞兵（横版） | 旋翼死神·瓦尔基里 |
| L4 雪原 snow | 滑行地面 + 密集火力 | 寒霜重坦·克隆 |
| L5 敌巢 abyss/crystal | 综合考验 | 创魔之心·戈梅拉（多阶段） |

- 关卡数据格式（`levels.js`）：
  ```js
  { id, name, theme,
    grid: [ "....#####...", ... ],            // 字符地图(含坑/平台/掩体)
    spawns: [ {type:'Runner', x, y}, ... ],
    falcons: [ {drop:'S', path:[...], atX} ], // 红鹰投放(字母+路径+触发位置)
    boss: { type:'IronGate', x, y },
    difficulty: { enemyMul, fireRateMul, bossHpMul } // 每关可调
  }
  ```
- 难度叠加：`关.difficulty` × `mode.enemyMul`（休闲更松、经典=1.0）集中调平衡。

---

## 6. 存档 / 选关 / 模式（硬需求）

### 6.1 数据模型（localStorage 单 key JSON）
```js
STORAGE_KEY = 'jungle-warrior-save'
{
  version: 1,
  unlockedMax: 1,
  clearedLevels: [],
  perLevel: { 1:{cleared:false, bestTime:null, bestScore:0, bestStars:0}, ... },
  settings: { mode:'casual', keymap:null, volume:1 },
  konami: false                  // 彩蛋是否已解锁
}
```
- `save.js` API：`load()` / `save(state)` / `markCleared(id,{time,score,stars})` / `isUnlocked(id)` / `setMode(m)` / `setKonami(true)` / `reset()`；含**版本迁移**（version 不符安全升级或重置，不崩）。

### 6.2 选关界面与状态机
- 标题页（开始/继续 · **难度模式切换** · 设置）→ **选关界面**：5 张关卡卡片
  - 已通关 = 亮 + ⭐评级 + 最好成绩，可重玩；
  - 下一未通关 = 高亮 **NEXT**；
  - 未解锁 = 🔒 灰锁不可选。
- 标题页隐藏检测 **Konami Code**（↑↑↓↓←→←→BA）→ 解锁特典（经典=30 命；休闲=酷特效/隐藏皮肤）+ 写 `konami`。
- 状态机：`title → select → ready → playing → (boss) → clear → select`；另有 `paused`、`respawning`、`gameover`（仅经典）。

---

## 7. 输入系统（三端统一，NES 式默认键、可改键）

抽象 **Intent**（每帧聚合，实体只读）：
```
{ moveX:-1|0|1, aimUp:bool, aimDown:bool,
  jumpPressed, jumpHeld, fireHeld, switchPressed, prone }
```
（无 run——单一速度）。映射：

| 操作 | 键盘（默认） | 手柄 | 触屏 |
|------|------|------|------|
| 移动/瞄准 | ←→↑↓ / WASD | 左摇杆/十字 | 左下 8 向虚拟方向键 |
| 射击(按住连射) | **Z** / 空格 | X(□) | 右下「火」(按住) |
| 跳 | **X** / K | A(✕) | 右下「跳」 |
| 切武器 | **C** / L | 肩键 RB | 右下「枪」 |
| 卧倒 | ↓ / S | 十字下 | 方向键下 |

- 键位**可在设置页自定义**，存 `save.settings.keymap`。
- 触屏控件为 index.html 内 HTML 浮层（不画进 canvas），仅触屏设备显示（feature-detect，沿用 hub 全屏按钮思路）。
- `input.js` 额外检测 Konami 序列（标题页激活）。

---

## 8. 表现与音频（儿童友好正反馈优先）
- **像素美术**：`sprites.js` 代码绘制（突击兵 8 向/跑跳/卧倒、各敌兵、子弹、爆炸、红鹰、屏障光罩、BOSS、地块、背景），缓存 + nearest-neighbor blit；配色对标参考图丛林像素但原创（走 `THEMES`）。
- **渲染**：field-space 相机 + 视差背景 + 瓦片裁剪 + 崩溃自愈（沿用 render.js：DPR 上限、try/finally 平衡变换、缓存自愈，含 iPad 黑屏防护）。
- **儿童正反馈**：
  - **连击计数**：短时间内连续击杀 → ×2 ×3… 飘字 + 加分倍率。
  - **击杀飘字**：`+100` 上浮（沿用 floatTexts）。
  - **夸张爆炸粒子**：敌人/ BOSS 死亡大颗粒、屏震（轻）。
  - **通关 ⭐ 评级**结算页。
- **HUD**：左=武器图标(+R 叠层/B 计时)+分数；中=关卡名/连击；右=休闲"复活∞"或经典命数 ❤×3；BOSS 战底部血条。
- **音频**：WebAudio 程序生成 8-bit 射击/爆炸/跳/换武器/拾取/受击/BOSS/过关/连击 音效 + 循环 BGM；静音按钮（复用 pixel-quest audio）。

---

## 9. 测试与工具（客观门禁）
- 单测（`node --test`, `.test.mjs`）：
  - `physics`：碰撞/落地/撞墙/坠落。
  - `aim`：8 向映射全覆盖 + 边界。
  - `weapons`：各主武器子弹数/方向/射速/伤害/穿透；R 射速叠加；B 屏障无敌+秒杀。
  - `collision`：子弹-敌人、玩家-敌人、子弹-地形、拾取-玩家。
  - `damage`：玩家倒下→**两模式**复活/命数/丢武器分流；敌人/ BOSS 扣血死亡。
  - `capsule`：红鹰飞行路径、被玩家子弹击中掉落、字母拾取切换/增益。
  - `input`：三端映射 → Intent 生成；Konami 序列检测。
  - `save`：读写/解锁/最好成绩/⭐/模式/彩蛋/版本迁移/坏数据兜底。
  - `levels`：每关 grid 合法、有出生点/红鹰/BOSS、关尾可达、无悬空即死。
  - `boss`：阶段切换/血量门槛/死亡触发过关。
- `tools/verify-levels.mjs`：CLI 静态校验全部关卡。
- **浏览器冒烟测试**：host-side puppeteer-core + 系统 Chrome（按 boom-worms 既有套路），跑通"标题→（切模式/彩蛋）→选关→进 L1→跑跳射击→吃红鹰换武器→击杀 BOSS→⭐结算→解锁 L2→存档持久"。

---

## 10. 里程碑（分段检查点，每段产出可实玩中间态 + 客观门禁）

> 每个 M 结束须：可在浏览器实玩该里程碑范围 + 对应单测通过。

- **M1 可玩骨架**：L1 丛林，跑/跳 + 经典 8 向"按方向即瞄准" + 默认步枪 + Runner/Jumper 两种杂兵 + **休闲原地复活** + 到达关尾终点判过关（先无 BOSS）。
  - 门禁：physics/aim 测过；浏览器能跑跳射击到终点。
- **M2 战斗完整（L1 打透）**：卧倒 + 主武器 M/S/L + **红鹰投递拾取** + **B 屏障** + L1 BOSS 震地要塞 + 夸张爆炸/受击 + 连击/飘字雏形。
  - 门禁：weapons/collision/capsule/damage/boss 测过；L1 可完整通关。
- **M3 模式·存档·选关·彩蛋**：标题页 + **休闲/经典模式切换** + 选关界面 + `save.js`(localStorage, 含 ⭐/模式/彩蛋) + 通关解锁 + 经典命数/Game Over + **Konami Code** + ← HUB。
  - 门禁：save/input 测过；重开进度在；两模式分流正确；选关重玩/NEXT/⭐ 正确。
- **M4 五关内容 + 满配武器**：补 L2~L5 + 各 BOSS + **F 火球 + R 射速** + 飞兵/炮台/战车 + 难度曲线参数化。
  - 门禁：levels/verify-levels 全过；5 关均可通关、难度递增、两模式均可玩。
- **M5 打磨**：触屏 8 向控件 + 音频(SFX+BGM) + 视差 + HUD 完整(连击/命数/BOSS 条) + ⭐结算页 + 冒烟测试 + `js/games.js` 注册卡片。
  - 门禁：冒烟测试绿；iPad/Mac/手柄三端可玩；hub 卡片可进入。

---

## 11. 风险与开放问题
- **触屏 8 向瞄准对 7 岁的手感**：单 8 向虚拟方向键管"移动+瞄准"仍偏难；M5 实测后可能加"自动微瞄/瞄准吸附"辅助（休闲向，允许）。
- **经典模式丢武器的挫败**：经典是给大孩子/用户本人的还原，丢武器忠于原版；若实测对孩子太挫败，可在经典模式下改为"仅扣命不丢武器"（保留为可调项）。
- **代码绘制 BOSS 工作量**：BOSS 体积大、姿态多，像素绘制成本高；M2/M4 视情况简化为"组合大块 + 少量动画帧"。
- **v2 候选（本期不做，已记录）**：俯视/纵深"基地关"、瀑布纵向卷轴关——需新增摄像机与一套关卡逻辑；想做时单独立项。

---

## 12. 已决策记录（Decisions Log）
1. 体裁：经典横版即时动作射击（**非**回合制；"回合"=关卡）。✅
2. 表现：经典横版像素魂斗罗观感，美术**原创代码绘制**（对齐 pixel-quest）。✅
3. 还原范围：横版核心还原（8 向射击/跳/武器/关底 BOSS/复活），不做俯视基地关（列 v2）。✅
4. 关卡：5 关，易→难，丛林/基地/瀑布/雪原/敌巢，每关 1 BOSS，全横版。✅
5. **主要玩家 = 7 岁儿子（兼顾用户本人）→ 儿童友好第一优先**。✅（review 对齐）
6. **难度双模式**：休闲（默认，无惩罚无限复活）+ 经典（3 命/丢武器/Game Over 从头，存档保留）。✅
7. **武器体系**：默认步枪(无字母) + M/S/L/F 主武器 + R 射速 + B 屏障；**红鹰**载具掉落拾取。✅
8. **瞄准 = 经典"按方向即瞄准"**（朝向随移动，无独立瞄准键，非双摇杆）。✅
9. **默认键 NES 式**：Z 射击 / X 跳 / C 换武器、方向或 WASD 移动+瞄准；**去掉跑/走**单一速度；可改键。✅
10. **Konami Code 彩蛋**（经典=30 命 / 休闲=酷特效）。✅
11. **儿童正反馈**：连击、击杀飘字、夸张爆炸、通关 ⭐ 评级。✅
12. BOSS 中英双语"中二"命名。✅
13. 操作：键盘 + 触屏 + 手柄 三端；人数：单人（v1）。✅
14. 补单测：input / collision / capsule（连同 physics/aim/weapons/damage/save/levels/boss）。✅
