# 丛林勇士 JUNGLE WARRIOR — 设计稿（Design Spec）

> 日期：2026-06-07 · 状态：已确认（待转 writing-plans）
> 类型：web 版经典横版即时动作射击（魂斗罗式 run-and-gun）+ 多关卡 + 选关存档
> 归属：game-hub · 游戏文件夹 `games/warrior/` · 仅个人使用、非商用

---

## 1. 概述与定位

复刻经典 FC《魂斗罗》的**横版即时动作射击**手感（参考图：丛林关、扛枪突击兵、扑跳敌兵、8 方向射击、武器升级、关底 BOSS），做成一款**纯浏览器、零构建**的小游戏，放进 game-hub。

澄清要点（브레인스토밍 过程中纠正过两次理解，务必锁定）：

- **不是回合制游戏**。玩家说的"回合"指**关卡/关数**——一关一关打，难度由易到难。
- **单关之内是经典即时动作**：玩家持续跑/跳/射击，敌人**同时持续移动**。不是战棋、不是菜单、不是分路。
- **表现层 = 经典横版像素魂斗罗**（参考图那种观感），但**美术全部原创**（代码绘制，规避版权）。

### 目标（In Scope, v1）
- 单人；5 关（易→难），每关一个主题 + 一个关底 BOSS。
- 8 方向瞄准 + 跳 + 卧倒 + 连射；5 把武器（胶囊切换）。
- **极致休闲**难度：被击中/掉坑→原地满血复活，不丢武器、不退关、不扣进度；计时仅记录"最好成绩"，不致死。
- **选关存档**：通关的关卡记录在 localStorage；进游戏可选任意已通关关重玩，或接着打下一未通关关。
- 键盘 + 触屏（iPad/手机）+ 手柄 三端操作。
- 美术风格、引擎架构、音频全部对齐 `games/pixel-quest`。

### 非目标（Out of Scope, v1，YAGNI）
- 不做 2P 本地合作（引擎预留单/双角色边界，但 v1 只实现单人）。
- 不做经典俯视/纵深"基地关"（只做横版卷轴关）。
- 不做关内中途存档（单关短 + 原地复活，等于关内软存档）。
- 不做在线排行榜、账号、商用化。
- 不做关卡编辑器（仅内部 `tools/verify-levels.mjs` 校验）。

---

## 2. 技术栈与架构

**完全对齐 pixel-quest**：纯原生 JS ES modules，零构建；Canvas 2D；固定"世界像素空间" + FIELD 视口缩放/letterbox，逻辑分辨率无关；美术为**代码绘制像素**（离屏 canvas 缓存 + nearest-neighbor 放大 blit）。

### 文件结构与模块职责（单一职责、清晰边界）

```
games/warrior/
  index.html        画布 + HTML 浮层(标题/选关/暂停/设置/触屏按钮/← HUB)
  style.css         浮层与触屏控件样式
  package.json      name + "test": node --test
  src/
    config.js       常量与调参：TILE/FIELD/重力/PLAYER/ENEMY/WEAPONS/THEMES/SCORE/STORAGE_KEY/每关难度参数
    sprites.js      代码绘制像素：突击兵(8向姿态)·各敌兵·子弹·胶囊·BOSS·地块·背景元素；缓存 + blit/ blitBottom
    physics.js      collideTiles / aabb / groundAhead（瓦片平台碰撞，复用 pixel-quest）
    entities.js     Player / 敌人(Runner,Jumper,Gunner,Turret,Flyer) / Bullet / Capsule / Boss / (可选)MovingPlatform
    weapons.js      武器定义表 + fire(world, owner, aimVec) 产生子弹；R/S/L/M/F
    input.js        键盘+手柄+触屏 → 统一 Intent；含 resolveAim()
    levels.js       5 关数据：char-grid + 实体摆放 + BOSS 定义 + theme + 难度参数
    save.js         localStorage 读写 + 版本迁移 + 选关进度 API
    render.js       场景/视差/实体/HUD/BOSS 血条/横幅；崩溃自愈
    audio.js        WebAudio 8-bit 音效 + 循环 BGM（复用 pixel-quest 模式）
    game.js         状态机/关卡加载/相机/复活/过关/与 save 交互（world 对象的拥有者）
    main.js         bootstrap：建 canvas/renderer/loop，绑定菜单·选关·暂停·设置 UI，← HUB 返回
  tests/
    physics.test.mjs  weapons.test.mjs  aim.test.mjs  save.test.mjs
    levels.test.mjs   damage.test.mjs   boss.test.mjs
  tools/
    verify-levels.mjs 关卡静态校验(出生点/BOSS/可达/无悬空死区)
```
+ 在 `js/games.js` 注册一张卡片（id `warrior`、标题、副标题、icon、accent、tags、path）。

### 依赖方向（避免环）
`config` ← 所有模块；`physics`/`sprites`/`weapons` 为叶子工具；`entities` 依赖 `physics`+`config`+`weapons`；`render` 依赖 `sprites`+`config`+`entities`；`game` 组合 `entities`+`physics`+`levels`+`save`+`audio`；`main` 组合 `game`+`render`+`input`。`game` 通过一个 `world` 对象把能力（grid/敌人列表/spawn/addScore/sound/player/mode/input）暴露给实体，实体只读 `world`（对齐 pixel-quest 的 `entity.update(dt, world)` 约定）。

---

## 3. 核心玩法系统（单关 = 即时动作）

### 3.1 移动
- 跑（accel/maxWalk/maxRun/friction）、跳（变高跳 jumpCutoff + coyote + jump-buffer，沿用 pixel-quest 手感）。
- **卧倒/下蹲 prone**：地面按↓→趴下，水平射击 + 受击框缩小；松开恢复。
- （v1 不做攀爬/游泳；地形以平台+坑+垂直跳台为主。）

### 3.2 8 方向瞄准（Contra 经典）
`resolveAim(intent, onGround, faceRight) → 单位向量 (dx,dy)`，规则：
- 站立/移动且无修饰：水平（朝 faceRight）。
- +aimUp、有 moveX：斜上 ↗/↖；+aimUp、无 moveX：正上 ↑。
- 地面 +aimDown：触发 prone（仍水平射击），不产生 ↓。
- 空中 +aimDown、有 moveX：斜下 ↘/↙；空中 +aimDown、无 moveX：正下 ↓。
- 纯单测覆盖全部 8 向 + 边界（`aim.test.mjs`）。

### 3.3 射击与武器
- **按住开火=连射**，受武器 `cooldown` 限制；子弹方向 = `resolveAim()` 结果 × 武器弹速。
- 武器表（`weapons.js`，数值在 `config.WEAPONS`，便于调）：

| 键 | 武器 | 行为 | 初定参数 |
|----|------|------|----------|
| R | 步枪 Rifle | 单发直线 | cooldown 0.18s, dmg 1, 弹速 560 |
| S | 散弹 Spread | 一次 5 发 ±18° 扇形 | cooldown 0.34s, 每发 dmg 1, 弹速 520 |
| L | 激光 Laser | 穿透长直线（贯穿多敌） | cooldown 0.40s, dmg 2, pierce, 弹速 720 |
| M | 机枪 Machine | 高射速单发 | cooldown 0.08s, dmg 0.5, 弹速 600 |
| F | 火球 Fire | 抛物/螺旋、可越障、小范围 | cooldown 0.5s, dmg 2, 弹速 420 |

- **胶囊投递**：空投箱(Capsule)沿固定路径飞入，被任意子弹击中→爆出武器图标(掉落物)，玩家碰到拾取并切换。每关脚本化摆放若干。
- 极致休闲：胶囊给的武器**死亡不丢**（当前武器持久，直到下次拾取覆盖）。

### 3.4 受击 / 复活（极致休闲）
- **玩家无血条**：沿用魂斗罗"一击即倒"——任意敌人/敌弹接触、或落入坑/即死区即"倒下"。"满血复活"指**即时、零代价**地恢复，不是要加血条。
- 倒下 → 触发 `respawn()`：短暂死亡演出后**原地（或最近安全落脚点）即时复活** + 无敌闪烁（i-frame）；**不丢武器、不退关、不扣分、不消耗“命”**（HUD 显示“复活 ∞”）。
- 不设时间致死；`timeLeft` 改为 `elapsed` 计时器，仅用于"最好成绩"。
- 可选打磨（非必须）：单关累计死亡数仅作彩蛋统计，不惩罚。

### 3.5 过关
- 推进到关尾触发 BOSS 战；BOSS HP 归零 → `levelClear()`：结算（用时/得分）→ `save.markCleared(id)` 解锁下一关 → 回选关界面或直接进下一关。

---

## 4. 敌人与 BOSS

### 4.1 杂兵（逐关增种类+密度）
- **Runner 跑兵**：地面冲向玩家，接触伤害。
- **Jumper 扑/跳兵**（参考图蓝衣扑兵）：靠近时跃起扑击。
- **Gunner 蹲守兵**：定点，周期朝玩家方向射击。
- **Turret 炮台/机枪巢**：固定，扇形/定向连射弹幕。
- **Flyer 飞兵**：空中正弦移动，俯冲或投弹。
- 所有敌人接口：`update(dt, world)`、`dead`、受击 `hit(dmg, world)`（HP≤0 → 死亡+爆炸粒子+加分）。

### 4.2 关底 BOSS（每关 1 个，难度递增）
- 通用 BOSS 模型：`hp/maxHp`、`phases[]`（按血量切换）、`attackPatterns`（弹幕/冲撞/召兵）、`weakpoint` 窗口、死亡演出。
- HUD 底部显示 BOSS 血条 + 名称。
- 各关 BOSS：丛林=装甲门炮(Armored Gate Cannon) → 基地=机械核心(Mech Core) → 瀑布=武装直升机(Gunship) → 雪原=履带战车(Snow Tank) → 敌巢=多阶段最终 BOSS(Alien Heart)。

---

## 5. 关卡与难度曲线（5 关，易→难）

| 关 | 主题(theme) | 新增挑战 | BOSS |
|----|------|----------|------|
| L1 丛林 forest | 教学：慢跑兵、基础跳台 | 装甲门炮（弱、教学） |
| L2 基地 steel | 炮台 + 垂直跳台 | 机械核心 |
| L3 瀑布 beach/forest变体 | 移动平台 + 空中飞兵 | 武装直升机 |
| L4 雪原 snow | 滑行地面 + 密集火力 | 履带战车 |
| L5 敌巢 abyss/crystal | 综合考验 | 多阶段最终 BOSS |

- 关卡数据格式（`levels.js`，对齐 pixel-quest char-grid + 扩展实体层）：
  ```js
  { id, name, theme,
    grid: [ "....#####...", ... ],        // 字符地图(TILES 映射，含坑/平台/掩体)
    spawns: [ {type:'Runner', x, y}, ... ],// 敌人/炮台摆放
    capsules: [ {weapon:'S', path, x, y}, ... ],
    boss: { type:'GateCannon', x, y },
    difficulty: { enemyMul, fireRateMul, bossHpMul } // 每关可调
  }
  ```
- 难度通过 `difficulty` 参数化集中调，便于"由易到难"打磨。

---

## 6. 存档 / 选关（硬需求）

### 6.1 数据模型（localStorage 单 key JSON）
```js
STORAGE_KEY = 'jungle-warrior-save'
{
  version: 1,
  unlockedMax: 1,                 // 已解锁到第几关(默认1)
  clearedLevels: [],              // 已通关关卡 id 列表
  perLevel: { 1:{cleared:false, bestTime:null, bestScore:0}, ... },
  settings: { keymap?, volume?, ... }
}
```
- `save.js` API：`load()` / `save(state)` / `markCleared(id, {time,score})`（更新 cleared+unlockedMax+最好成绩）/ `isUnlocked(id)` / `reset()`；含**版本迁移**（version 不符时安全升级或重置，不崩）。

### 6.2 选关界面与状态机
- 标题页（开始/继续/设置）→ **选关界面**：5 张关卡卡片
  - 已通关 = 亮 + ⭐ + 最好成绩，可重玩；
  - 下一未通关 = 高亮 **NEXT**；
  - 未解锁 = 🔒 灰锁不可选。
- 选关 → 进入关卡（ready 横幅 → playing）。通关 → 结算 → `markCleared` → 解锁下一关 → 回选关（或"下一关"按钮）。
- 游戏状态机：`title → select → ready → playing → (boss) → clear → select` ；另有 `paused`、`respawning`。

---

## 7. 输入系统（三端统一）

抽象 **Intent**（每帧由 input.js 聚合，实体只读）：
```
{ moveX:-1|0|1, aimUp:bool, aimDown:bool,
  jumpPressed, jumpHeld, fireHeld, switchPressed, run, prone }
```
映射：

| 操作 | 键盘 | 手柄 | 触屏 |
|------|------|------|------|
| 移动/瞄准 | ←→/AD + ↑↓/WS 修饰 | 左摇杆/十字 | 左下虚拟摇杆(8向) |
| 跳 | K | A(✕) | 右下「跳」 |
| 开火(连射) | J(按住) | X(□) | 右下「火」(按住) |
| 切武器 | L | 肩键 RB | 右下「枪」 |
| 跑 | Shift | 肩键 LB | (摇杆推满) |
| 卧倒 | ↓/S | 十字下 | 摇杆下 |

- 触屏控件为 index.html 内的 HTML 浮层（不画进 canvas），仅触屏设备显示（渐进增强，沿用 hub 全屏按钮的 feature-detect 思路）。

---

## 8. 表现与音频
- **像素美术**：`sprites.js` 代码绘制（突击兵 8 向姿态/跑跳/卧倒、各敌兵、子弹、爆炸、胶囊、BOSS、地块、背景），缓存离屏 canvas + nearest-neighbor blit。配色对标参考图的丛林像素，但原创（走 `THEMES`）。
- **渲染**：field-space 相机 + 视差背景（天空/树/山）+ 瓦片裁剪 + 崩溃自愈（沿用 render.js 模式，含 iPad 黑屏防护：DPR 上限、try/finally 平衡变换、缓存自愈）。
- **HUD**：左=武器图标+分数；中=关卡名；右=复活∞/进度；BOSS 战底部 BOSS 血条。
- **音频**：WebAudio 程序生成 8-bit 射击/爆炸/跳/换武器/受击/BOSS/过关音效 + 简单循环 BGM；带静音按钮（复用 pixel-quest audio 模式）。

---

## 9. 测试与工具（客观门禁）
- 单测（`node --test`, `.test.mjs`）：
  - `physics`：碰撞/落地/撞墙/坠落。
  - `aim`：8 向映射全覆盖 + 边界。
  - `weapons`：各武器子弹生成数量/方向/射速/伤害/穿透。
  - `damage`：玩家受击→复活、敌人/ BOSS 扣血与死亡。
  - `save`：读写/解锁/最好成绩/版本迁移/坏数据兜底。
  - `levels`：每关 grid 合法、有出生点与 BOSS、关尾可达、无悬空即死。
  - `boss`：阶段切换/血量门槛/死亡触发过关。
- `tools/verify-levels.mjs`：CLI 静态校验全部关卡。
- **浏览器冒烟测试**：host-side puppeteer-core + 系统 Chrome（sandbox 挡 localhost，按 boom-worms 既有套路），跑通"标题→选关→进 L1→能跑能跳能打→击杀 BOSS→解锁 L2→存档持久"。

---

## 10. 里程碑（分段检查点，每段产出可实玩中间态 + 退出门禁）

> 对齐"大型开发分段检查点 + 客观门禁 + 可实玩中间态"的偏好。每个 M 结束须：可在浏览器实玩该里程碑范围 + 对应单测通过。

- **M1 可玩骨架**：L1 丛林，跑/跳 + 水平射击 + 默认步枪 + Runner/Jumper 两种杂兵 + 原地复活 + 到达关尾终点判过关（先无 BOSS）。
  - 门禁：physics/aim 基础测过；浏览器能实际跑跳射击到终点。
- **M2 战斗完整（L1 打透）**：8 向瞄准 + 卧倒 + 4 把武器(R/S/L/M) + 胶囊投递 + L1 BOSS 装甲门炮 + 爆炸/受击表现。
  - 门禁：weapons/damage/boss 测过；L1 可完整通关。
- **M3 选关存档**：标题页 + 选关界面 + `save.js`(localStorage) + 通关解锁 + 最好成绩 + ← HUB。
  - 门禁：save 测过；关掉浏览器重开进度仍在；选关重玩/NEXT 正确。
- **M4 五关内容**：补 L2~L5 + 各 BOSS + 火球 F + 飞兵/炮台/战车等 + 难度曲线参数化。
  - 门禁：levels/verify-levels 全过；5 关均可通关、难度递增。
- **M5 打磨**：触屏控件 + 音频(SFX+BGM) + 视差背景 + HUD 完整 + 冒烟测试 + `js/games.js` 注册卡片。
  - 门禁：冒烟测试绿；iPad/Mac/手柄三端可玩；hub 卡片可进入。

---

## 11. 风险与开放问题
- **8 向瞄准的触屏手感**：单摇杆同时管"移动+瞄准"在魂斗罗式玩法里偏难；M5 实测后可能需要加"瞄准锁定"或自动微瞄辅助（休闲向，允许）。
- **代码绘制 BOSS 的工作量**：BOSS 体积大、姿态多，像素绘制成本高；M2/M4 视情况简化为"组合大块 + 少量动画帧"。
- **难度"极致休闲"与打击爽感的平衡**：无惩罚下要靠关卡节奏与 BOSS 设计维持新鲜感，靠 `difficulty` 参数与playtest 调。

---

## 12. 已决策记录（Decisions Log）
1. 体裁：经典横版即时动作射击（**非**回合制；"回合"=关卡）。✅
2. 表现：经典横版像素魂斗罗观感，美术**原创代码绘制**（对齐 pixel-quest）。✅
3. 还原范围：横版核心还原（8 向射击/跳/武器胶囊/关底 BOSS/复活），不做俯视基地关。✅
4. 关卡：5 关，易→难，丛林/基地/瀑布/雪原/敌巢，每关 1 BOSS。✅
5. 难度/存档：**极致休闲**（原地满血无限复活、不丢武器、计时仅记成绩）+ **选关存档**(localStorage)。✅
6. 操作：键盘 + 触屏 + 手柄 三端。✅
7. 人数：单人（v1），不做 2P。✅
8. 武器：R 步枪 / S 散弹 / L 激光 / M 机枪 / F 火球（5 把，胶囊切换）。✅
9. 名称：**丛林勇士 JUNGLE WARRIOR**（文件夹 `warrior`）。✅
