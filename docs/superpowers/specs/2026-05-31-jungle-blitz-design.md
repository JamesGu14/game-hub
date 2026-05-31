# 丛林尖兵 JUNGLE BLITZ — 设计规格 (Design Spec)

- **日期 (Date):** 2026-05-31
- **类型:** 2D 横版跑射游戏 (run-and-gun side-scroller)
- **受众:** 7 岁儿童（小学一年级，有键鼠与 PS 手柄操作能力）
- **集成:** game-hub `games/jungle-blitz/`，导航页 `js/games.js` 注册
- **状态:** 已确认，待生成实现计划

> **原创声明 / IP Note:** 本游戏是对 run-and-gun 跑射游戏类型（魂斗罗为该类型代表作）的**原创致敬作**。
> 所有美术均以 canvas 几何图形 + emoji 在运行时绘制，**不使用任何第三方角色、像素图、音乐或受版权保护的素材**；
> 角色、关卡、敌人、BOSS、命名全部原创。游戏机制（跑/跳/八方向射击/武器道具/横向卷轴打 BOSS）属类型通用玩法。

---

## 1. 目标与成功标准 (Goals & Success Criteria)

**目标:** 一个 7 岁小朋友能用键盘或 PS 手柄独立游玩、并最终（在无限续关下）击败最终 BOSS 通关的横版跑射游戏。

**成功标准:**
1. 键盘 (WASD/方向键 + J + K) 与 PS 手柄均可完整操作：移动、八方向瞄准、跳跃、按住自动连发、暂停。
2. 5 个主题关卡，从左到右卷轴推进；每关结尾有小 BOSS；第 5 关结尾是多阶段最终大 BOSS。
3. 友好难度系统：血量条 + 多命 + 复活检查点 + 无限续关，永不从头开始。
4. 至少 4 种武器（步枪/散弹/机枪/激光）+ 2 种道具（护盾/补血），散弹手感突出。
5. 纯静态、免编译，能通过 `./start.sh` 在本地 http 下直接游玩。
6. 画风、结构、交互与现有 `breakout` 游戏一致（letterbox 缩放、HTML 覆盖层、Web Audio、返回 HUB、静音键、中文 UI）。

**非目标 (Out of Scope):**
- 触屏/移动端虚拟按键（受众用键盘+手柄，不做）。
- 在线/多人。
- 关卡中途存档（仅检查点复活）。
- 编辑器/自定义关卡。
- 复杂背景音乐编曲（仅做简短可选的 Web Audio 氛围循环 + 完整音效）。

---

## 2. 身份与导航 (Identity & Hub Registration)

- **目录:** `games/jungle-blitz/`
- **中文名:** 丛林尖兵　**英文名:** JUNGLE BLITZ
- **HUB 卡片** (`js/games.js` 新增一项):
  ```js
  {
    id: 'jungle-blitz',
    title: '丛林尖兵 JUNGLE BLITZ',
    subtitle: '横版跑射 · 闯关打 BOSS',
    desc: '跑跳射击 · 八方向瞄准 · 武器升级 · 5 关 5 BOSS · 键盘/手柄',
    icon: '🪖',
    accent: '#8bc34a',
    accent2: '#33501a',
    tags: ['闯关', '动作', '键盘/手柄'],
    path: 'games/jungle-blitz/index.html',
  }
  ```

---

## 3. 坐标系与渲染 (Coordinate System & Rendering)

- **逻辑视口 `FIELD = { W: 960, H: 540 }`** (16:9)。所有游戏逻辑在此固定空间内进行。
- **Renderer 等比缩放 + letterbox** 把 FIELD 映射到实际画布（复用 breakout 的缩放/居中思路，含 `mapClientXToField` 等映射，本游戏鼠标非必需但保留）。
- **世界 (World)** 比视口宽：每关 `worldWidth`（约 4500–6500 px）。
- **相机 (Camera)**：水平跟随玩家，目标 `cam.x = player.x - FIELD.W * 0.38`，**只前进不后退**（`cam.x` 用历史最大值 ratchet），并 clamp 到 `[0, worldWidth - FIELD.W]`。BOSS 战时相机锁定在 BOSS 房区间。
- **渲染层 (back→front):** 视差远景(天空/远山/丛林剪影) → 中景装饰 → 地形/平台 → 补给/道具 → 敌人 → 玩家 → 子弹/特效 → HUD(屏幕空间，不随相机)。

---

## 4. 操作 (Controls)

| 动作 | 键盘 | PS 手柄 |
|---|---|---|
| 左右移动 | `A`/`D` 或 `←`/`→` | 左摇杆 X / 方向键 ←→ |
| 向上瞄准 | `W` 或 `↑` (按住) | ↑ / 摇杆上 |
| 蹲下；空中向下瞄准 | `S` 或 `↓` (按住) | ↓ / 摇杆下 |
| 跳跃 | `K`（备用 `Space`/`Z`） | ✕ (button 0) |
| 射击（**按住自动连发**） | `J`（备用 `X`） | □ (button 2) 或 R1 (button 5) |
| 暂停/继续 | `Esc` / `P` | Start (button 9) |
| 确认菜单 | `Enter` / `K` / `J` | ✕ |
| 静音 | `M` | — |

**八方向瞄准规则 (aim resolution):**
- 地面站立、无上下输入 → 朝 facing 平射 (→ 或 ←)。
- 按住「上」→ 垂直上射；「上」+「左/右」→ 斜上 45° 射。
- 在空中按住「下」→ 垂直下射；「下」+「左/右」→ 斜下 45° 射。
- 地面按住「下」→ 进入**蹲伏 (prone)**：碰撞盒变矮、贴地平射（用于躲高处子弹）。
- 移动中射击方向跟随 facing；无方向输入时保持上次 facing。
- 自动连发：按住射击键时，每 `weapon.fireInterval` 毫秒发射一次。

**输入模块输出 (`input.js`):**
- 连续态：`moveX (-1..1)`、`aimUp (bool)`、`aimDown (bool)`、`fireHeld (bool)`。
- 边沿事件 (emit)：`jump`、`pause`、`confirm`、`back`、`mute`。
- 每帧 `poll()` 读取手柄（摇杆死区 0.25；方向键覆盖摇杆）。

---

## 5. 玩家 · 血量 · 复活 (Player / Health / Respawn)

- **造型:** canvas 几何小战士（身体矩形 + 头 + 腿 + 枪管指向 aim 方向），跑动时腿部摆动，受击时闪烁。约 `28×44`（蹲伏高约 `28×26`）。
- **物理:** 重力 `GRAVITY ≈ 2200 px/s²`；移动速度 `MOVE ≈ 250 px/s`；跳跃初速 `JUMP_V ≈ -760 px/s`；最大下落 `≈ 950 px/s`。默认**单跳**（不做二段跳，降低操作难度）。
- **血量条 (HP):** 每条命 `HP_MAX = 5` 格。受伤 −1 格 + 击退(轻) + 无敌闪烁 `IFRAME ≈ 1.2s`。
- **命数 (Lives):** 每次「续关」`LIVES = 4`，左上角图标显示。HP 归零 → 掉 1 命，回最近检查点满血复活（复活 1.5s 无敌）。
- **检查点 (Checkpoints):** 每关 2–3 个（关卡起点为第一个）。玩家越过 `checkpoint.x` 即更新 `respawnX/respawnY`。
- **掉坑/落水:** −1 格血并回到最近检查点（经典为秒死，本作改友好）。
- **无限续关 (Continue):** 命数用尽 → `gameover` 覆盖层「再试一次」从最近检查点继续（命数重置为 4、满血）；亦可「返回 HUB / 选关」。**永不从第 1 关重来。**
- **死亡掉装备:** 否。复活后**保留当前武器**（减少挫败）。

伤害来源（均 −1 格血）：敌人子弹、敌人/BOSS 接触、敌方手雷/炸弹、掉坑落水。

---

## 6. 武器与道具 (Weapons & Power-ups)

补给以 **飘浮补给舱 (supply pod)** 形式出现（缓慢飘动的带字母胶囊），**打中或碰到**即装备/拾取；部分由小 BOSS 掉落。

| 武器 | 字母 | 行为 | 关键数值(初拟) |
|---|---|---|---|
| 步枪 Rifle（默认） | — | 单发平/斜射 | dmg 1, speed 720, interval 180ms |
| ⭐散弹 Spread | S | 一次扇形 5 连发(±26°) | dmg 1/发, interval 260ms |
| 机枪 Machine | M | 高射速单发 | dmg 1, speed 820, interval 90ms |
| 激光 Laser | L | 贯穿光束(穿透多敌) | dmg 2, speed 1100, interval 300ms, pierce |

| 道具 | 图标 | 效果 |
|---|---|---|
| 护盾 Shield | 🛡 | `SHIELD ≈ 6s` 无敌（视觉环） |
| 补血 Heal | ❤️ | 回 2 格血（上限 HP_MAX） |

- 子弹方向取自玩家当前 aim（八方向）。子弹离开世界/屏幕边界一定距离即回收。
- 拾取新武器即替换当前武器（不叠加）。

---

## 7. 敌人 (Enemies)

几何造型，丛林军事主题；难度随关卡递增（数量、血量、攻击频率）。

| 敌人 | 行为 | HP | 接触伤害 | 分值 |
|---|---|---|---|---|
| 步兵 Grunt | 向玩家小步移动，间歇平射 | 2 | 1 | 100 |
| 炮台 Turret | 固定，朝玩家方向瞄准射击 | 4 | 1 | 150 |
| 无人机 Drone | 正弦轨迹飞行，定时投弹 | 2 | 1 | 150 |
| 跳跃兵 Jumper | 周期性向玩家方向起跳 | 3 | 1 | 150 |
| 投掷兵 Grenadier | 抛物线手雷 | 3 | 1 | 200 |
| 火力点 Nest（可破坏物） | 静止，周期吐弹 | 5 | — | 250 |

- 敌人由关卡数据按 `spawn.x` 在进入相机右侧前方时激活（屏外不更新，省性能）。
- 敌人子弹与玩家子弹用同一 `bullets.js`，以 `faction: 'player'|'enemy'` 区分碰撞。

---

## 8. 关卡与 BOSS (Stages & Bosses)

5 关，数据驱动定义于 `levels.js`。每关结尾进入 BOSS 房（相机锁定），击败 BOSS → `stageclear` → 下一关。第 5 关 BOSS 为最终多阶段大 BOSS，击败即 `win`。

| 关 | 主题 | 场景要素 | 关底 BOSS | BOSS HP(初拟) |
|---|---|---|---|---|
| 1 | 丛林入口 | 平缓地面、少量步兵、教学补给(散弹) | 装甲炮门 Armored Gate（两侧炮口轮流射，中心弱点） | 30 |
| 2 | 河流大桥 | 水面+浮桥(掉水扣血)、无人机 | 武装直升机 Gunship（横移+俯冲投弹+机炮） | 40 |
| 3 | 敌军基地 | 室内多层平台、炮台密集、跳跃兵 | 重装机甲 Heavy Mech（踏步前压、肩炮散射、跳砸） | 50 |
| 4 | 瀑布悬崖 | 垂直攀爬平台、落石、投掷兵 | 双管巨炮 Twin Cannon（双管交替弹幕、需打两侧弱点） | 55 |
| 5 | 核心基地 | 最终冲刺关（综合所有敌人） | **最终大 BOSS 核心 Core**（多阶段） | 阶段1≈40 / 阶段2≈40 / 阶段3≈40 |

**最终 BOSS 多阶段 (示例):**
- 阶段 1：外壳防护，需打掉两侧护盾发生器；护盾炮规律弹幕。
- 阶段 2：核心暴露，环形弹幕 + 召唤少量步兵/无人机。
- 阶段 3：狂暴，弹幕更密、加入追踪弹；血量见底时全屏特效后爆炸 → 通关。

每个 BOSS：顶部独立 BOSS 血条；有受击闪烁与阶段切换提示；击败有爆炸序列 + 计分。

**关卡数据格式 (`levels.js`，每关一个对象):**
```js
{
  id: 1,
  name: '丛林入口',
  palette: { sky:'#…', far:'#…', mid:'#…', ground:'#…', accent:'#…' },
  worldWidth: 5000,
  groundY: 470,                        // 默认地面顶 y（视口内）
  floors: [ {x, w, y} ],               // 实心地面段；段之间的空隙 = 坑(pit)
  platforms: [ {x, y, w, h, oneWay} ], // 平台(默认上方可站、单向)
  hazards: [ {type:'water'|'spike', x, w, y} ],
  decor: [],                           // 纯装饰(树/营帐/桶)
  spawns: [ {x, type, opts} ],         // 敌人生成点
  pods:   [ {x, y, kind:'weaponS'|'weaponM'|'weaponL'|'shield'|'heal'} ],
  checkpoints: [ 1600, 3200 ],         // 起点隐含为第一个检查点
  bossX: 4600,                         // BOSS 房触发 x
  boss: 'gate',                        // 'gate'|'gunship'|'mech'|'twinCannon'|'core'
}
```

**地形碰撞:** AABB。`floors` 与实心 `platforms` 阻挡；`oneWay` 平台仅从上方落到顶面（按「下」下穿为加分项，非必做）。坑(floors 间空隙)下方为致伤区。

---

## 9. 状态机与流程 (Game State Machine)

`menu → playing ⇄ paused → stageclear → (next stage) playing → … → win`，任意 playing 中 HP/命数耗尽 → `gameover`。

- **menu:** 标题 + 开始按钮 + 操作说明 + 最高分。`确认` 开始第 1 关。
- **stage intro:** 进入每关时短暂横幅「第 X 关 · 关名」(~1.5s 自动消失，可按键跳过)。
- **playing:** 正常游玩。
- **paused:** 覆盖层（继续/重玩本关/返回 HUB）。
- **stageclear:** 击败关底 BOSS（非最终）→ 「第 X 关 通关！」→ 继续进入下一关。
- **gameover:** 命数耗尽 → 「再试一次(从检查点)」/「返回 HUB」。无限续关。
- **win:** 击败最终 BOSS → 通关庆祝 + 总分 + 最高分 + 「再玩一次」/「返回 HUB」。

---

## 10. HUD

- 左上：血量条(5 格) + 命数图标(🪖×N)。
- 中上：第 X 关 · 关名（BOSS 战时切换为 **BOSS 血条**）。
- 右上：当前武器名 + 当前分数。
- 顶部边角：返回 HUB 链接(`← HUB`)、静音键(🔊/🔇)（同 breakout 布局）。

---

## 11. 音频 (Audio — Web Audio，无音频文件)

事件式合成音效：`shoot`(随武器音色略变)、`jump`、`land`、`enemyHit`、`enemyExplode`、`playerHurt`、`pickup`、`bossHit`、`bossPhase`、`bossExplode`、`stageClear`、`gameOver`、`win`、`uiBlip`。可选：极简氛围循环（默认关，`M` 静音可整体关闭）。提供 `Sound.toggleMuted()`。

---

## 12. 计分与存档 (Scoring & Persistence)

- 击杀、拾取、关底 BOSS、通关均计分（数值见上表 + BOSS 大额奖励 + 通关奖励）。
- `localStorage` 键 `jungle-blitz-best` 存 `{ score, stage }`（最高分、最远关卡），菜单与结算展示。

---

## 13. 文件架构 (File Architecture，对齐 breakout，模块化)

```
games/jungle-blitz/
  index.html        画布 + HTML 覆盖层(菜单/暂停/过关/失败/通关/关卡横幅) + 返回HUB + 静音
  style.css         与 hub/breakout 一致的视觉语言（深色霓虹、面板、大按钮）
  src/
    config.js       FIELD、物理常量、玩家/武器/敌人/BOSS 数值、计分、STORAGE_KEY
    levels.js       5 关数据 + BOSS 配置（见 §8 格式）
    input.js        键盘+手柄：连续 moveX/aimUp/aimDown/fireHeld + 边沿 jump/pause/confirm/back/mute
    audio.js        Web Audio 音效与静音
    world.js        关卡加载、地形/平台/坑/水碰撞、相机(只前进)、视差背景绘制数据
    player.js       Player 类：移动/跳/蹲/八方向瞄准/血量/受击/复活
    bullets.js      玩家+敌人子弹(faction)、散弹/激光/普通子弹行为
    enemies.js      敌人类型 + 生成工厂 + AI 行为
    bosses.js       5 个 BOSS 的状态/攻击模式（小 BOSS + 最终多阶段）
    powerups.js     补给舱 + 武器/道具拾取
    game.js         状态机、系统调度(更新顺序)、生成/检查点/命数/计分、胜负判定
    render.js       背景/地形/实体/特效/HUD/BOSS 血条，letterbox 等比缩放
    main.js         启动、覆盖层按钮绑定、requestAnimationFrame 主循环
```

**更新顺序 (game.update(dt)):** 输入 → 玩家 → 子弹 → 敌人/BOSS → 碰撞(玩家子弹↔敌、敌子弹/接触↔玩家、玩家↔补给) → 相机 → 生成(进入视野的 spawn) → 检查点/死亡/过关判定 → 特效。
**dt 钳制:** 同 breakout，`dt = min((now-last)/1000, 0.045)` 防大跳。

---

## 14. 难度调校原则 (Tuning for a 7-year-old)

- 起步关教学化：第 1 关敌人少、早给散弹、平台简单。
- 子弹速度适中、敌人弹幕稀疏、留足反应时间。
- 复活点密、无限续关、保留武器、掉坑只扣血——失败成本低。
- 所有数值集中在 `config.js`，便于按试玩反馈快速调整（如太难则调高 HP_MAX/降低敌人弹频）。

---

## 15. 验收清单 (Acceptance Criteria)

- [ ] `./start.sh` 后从 HUB 卡片可进入「丛林尖兵」，可返回 HUB。
- [ ] 键盘与 PS 手柄均可：移动、八方向瞄准、跳、蹲、按住自动连发、暂停、静音。
- [ ] 血量条/命数/复活点/无限续关均按 §5 工作；掉坑落水扣血回检查点。
- [ ] 4 武器 + 2 道具可拾取并按 §6 表现；散弹扇形可见。
- [ ] 5 关可顺序通过，每关关底小 BOSS 可击败并进入下一关。
- [ ] 第 5 关最终 BOSS 多阶段，击败后进入 `win` 通关结算。
- [ ] 最高分/最远关卡正确存读 `localStorage`。
- [ ] 画风/UI/音效与 breakout 一致；中文界面；无版权素材。
- [ ] 桌面 Chrome 60fps 流畅（屏外实体不更新）。
