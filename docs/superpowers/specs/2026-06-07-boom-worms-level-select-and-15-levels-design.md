# 炮炮虫 BOOM WORMS — 选关系统 + 15 关扩展 · 设计 Spec

- **日期**：2026-06-07
- **状态**：设计待评审
- **作者**：James + Claude（brainstorming）
- **游戏**：`games/boom-worms/`

---

## 1. 背景与目标

炮炮虫现状（已通过代码确认）：

- `levels.js` 有 **6 关**，每关靠 `terrainParams`（ruggedness/peaks/platforms/caves/floors）+ palette/theme 程序化生成地图。
- **没有选关界面**：单人模式永远从第 1 关开始（除非手动改 URL `?level=N`）；主菜单只显示"最远进度"。
- `game.js` 的 `nextLevel()` 里 `next >= 6` 是**硬编码**。
- 存档：`localStorage` 存 `{ level: N }`（N = 已通关的最高关，1-based）。

**本设计要做两件事：**

1. **选关系统**——单人进入前看到「闯关路线图」，可重玩已通关的关卡、或挑战下一个未通关关卡，后续关卡锁定。
2. **15 关扩展**——从 6 扩到 15 关，通过①致命/特殊地形 ②关卡目标多样化，提升地图多样性与可玩性。

---

## 2. 范围

**In scope**

- 闯关路线图选关界面（方案 B）+ 解锁逻辑
- 关卡从 6 扩到 15（9 个新主题，仅需各加一组配色）
- 5 种致命/特殊地形：🌋熔岩、☠️酸水、🦔尖刺、🧊冰面、⬆️弹床
- 4 种关卡目标：💀歼灭（默认）、⏱️限回合、🚩攻占高地、🎯斩首/摧毁
- 配套渲染、物理、胜负判定、测试

**Out of scope（YAGNI / 暂不做）**

- Boss 关、三星评分、新武器、移动平台/升降梯、天气环境效果
- 双人对战（duo）维持现状，**不进选关**
- 关卡内进度存档（只存「最远进度」一个数）

---

## 3. 功能需求

### 3.1 选关系统（B · 闯关路线图）

- 单人入口（现 `btn-solo`）→ 进入选关界面（新 overlay `overlay-levelselect`，**DOM 实现**，与现有 overlay 体系一致）。
- 15 个节点沿一条蜿蜒小路排列，置于**横向滚动**容器内。
- 节点三态：
  - **已通关**：实色（主题色），可重玩。
  - **下一关**：高亮（橙框 + ▶），可玩。
  - **锁定**：灰 + 🔒，不可点击。
- 节点显示：关号、主题色，可选目标图标。
- 点击可玩节点 → `game.startGame(index, 'solo')`。
- 顶部显示「最远进度」，有「返回主菜单」。
- 打开时自动滚动定位到「下一关」节点。

### 3.2 解锁与存档

- 存档结构沿用 `{ level: N }`（N = 已通关最高关，1-based），但 **`STORAGE_KEY` 改为 `'boom-worms-progress-v2'`** —— 换 key 让老存档自然失效，等效**进度重置**（P0 决议：重置，不写迁移代码，见 §11.1）。
- 可玩范围 = 第 `1` 关 .. 第 `min(best.level + 1, 15)` 关。
- 通关第 i 关：`best.level = max(best.level, i)`（沿用现有逻辑）。
- 通关第 15 关 → 进入 `win` 结算。
- 调试入口：保留 `?level=N`。

### 3.3 致命 / 特殊地形（5 种）

| 类型 | emoji | 行为 |
|------|-------|------|
| 熔岩 lava | 🌋 | 落入即死 |
| 酸水 acid | ☠️ | 落入持续快速掉血（约 40/秒），比熔岩的即死多一点逃生空间 |
| 尖刺 spikes | 🦔 | 接触扣血（约 30），带冷却防一帧连扣 |
| 冰面 ice | 🧊 | 低摩擦，站上去打滑、难定位 |
| 弹床 bounce | ⬆️ | 接触向上反弹 |

- 数据：每关 `hazards` 参数 → `buildLevel` / `terrain` **半程序化**生成具体「危险区域」列表。
- 表示：危险区域用几何描述（矩形/带：`{ type, x, y, w, h }`），**独立于** solid mask。
- 查询：`physics` 每帧检测 worm 与危险区域的关系并施加效果。

### 3.4 关卡目标（4 种）

| 类型 | emoji | 胜利条件 |
|------|-------|----------|
| eliminate | 💀 | 消灭全部敌人（默认，即现状） |
| timed | ⏱️ | `turnLimit` 回合内消灭全部，超时判负 |
| capture | 🚩 | 玩家虫进入指定高地区并存活 `holdTurns` 回合 |
| decapitate | 🎯 | 消灭指定敌方目标虫（`isTarget`）即胜 |

- 每关 `objective = { type, ...params }`。
- `game.js` 跟踪 `turnCount` 与 objective 运行时进度；胜负判定按 objective 走。
- **「回合」定义**：`turnCount` 按**玩家方出手次数**计（每次轮到玩家某虫出手 +1），**AI 出手不计**；`timed.turnLimit`、`capture.holdTurns` 均以此为单位。
- HUD 显示目标进度（剩余回合 / 占领倒计时 / 目标虫标记）。

> 📌 各目标（含攻占高地、斩首）的精确判定规则、hazard 数值、签名、AI 行为等，统一见 **§11 评审决议 & 实现参数**（与前文如有出入以 §11 为准）。

---

## 4. 数据模型（`levels.js`）

每个 LEVEL 在现有字段上扩展：

```js
{
  name, theme, palette, terrainParams,        // 现有
  playerCount, enemyCount, aiError, wind,      // 现有
  objective: {                                 // 新增；缺省视为 eliminate
    type: 'eliminate' | 'timed' | 'capture' | 'decapitate',
    turnLimit?, holdTurns?, captureZone?, targetEnemyIdx?,
  },
  hazards: {                                   // 新增；半程序化布置参数，缺省为无
    lava?: n, acid?: n, spikes?: n, ice?: n, bounce?: n,
  },
}
```

`buildLevel(i)` 的输出在现有基础上再附：解析后的危险区域列表、objective 运行时初值、目标虫索引 / 高地区坐标。

9 个新主题各加：一组 `palette` + `terrain.js` 的 `_toppingColor` 一项。

---

## 5. 架构与实现影响（按文件）

| 文件 | 改动 |
|------|------|
| `levels.js` | 6→15 关数据 + `objective` / `hazards` 字段；`buildLevel` 解析危险区域、目标区、目标虫 |
| `config.js` | 新增 `HAZARD` 常量（伤害、冷却、弹床力等）、objective 默认值 |
| `terrain.js` | 扩 `_toppingColor` 新主题；**`generate()` 计算 hazard 落点并暴露 `terrain.hazards`，对熔岩/酸水区域挖空 mask/canvas**（预留池，见 §11.6） |
| `ai.js` | `_aiFootingSafe` 纳入致命 hazard，AI 不主动走入熔岩/酸水/尖刺（见 §11.8） |
| `physics.js` | `stepWorm` 接入 hazards：冰面摩擦、弹床反弹、熔岩/酸水致死、尖刺扣血（纯函数，可单测） |
| `turns.js` | `checkOutcome` 扩展为按 objective 判定（或新增 `evaluateObjective`），保留歼灭逻辑 |
| `game.js` | `turnCount` 计数；objective 运行时状态；`startGame` 初始化目标；`nextLevel` 把 `6` 改为 `LEVELS.length`；胜负分支接 objective |
| `worm.js` | worm 增 `isTarget` 标记（斩首）、hazard 接触冷却字段 |
| `render.js` | 绘制危险地形（熔岩发光/尖刺/酸水/冰面反光/弹床）、目标标记 / 高地区、目标 HUD |
| `input.js` | 选关界面交互（至少鼠标点击；键鼠/手柄导航可选） |
| `index.html` | 新增 `overlay-levelselect` 结构 + 目标 HUD 元素 |
| `style.css` | 选关路线图样式（节点/路径/横向滚动/锁定态）、目标 HUD 样式 |
| `main.js` | overlay 映射加 `levelselect`；单人按钮 → 选关；节点事件 → `startGame`；HUD 同步 |

---

## 6. 错误处理 / 边界

- `localStorage` 不可用 → `best = { level: 0 }`，仅第 1 关可玩，不崩（已有 try/catch）。
- 损坏存档 → try/catch 回退（已有）。
- 点击锁定节点：无响应 + 轻提示。
- `best.level` 越界（老存档 / > 15）→ clamp 到 [0, 15]。
- **spawns 必须避开**危险区（熔岩/酸水/尖刺）与目标区：`buildLevel` 保证，测试校验。
- 危险区不得封死出生列 / 通路：沿用现有 `_buildFloors` 的出生安全规则。
- objective 参数缺失 → 回退 `eliminate`。

---

## 7. 测试策略

**纯逻辑（node:test，无 DOM）**

- `levels.test` 扩展：15 关数据完整性——palette/objective/hazards 合法；`aiError` 单调不增；`enemyCount` 合理；spawns 不落危险区。
- `physics`：冰面摩擦系数、弹床反弹、熔岩/酸水致死、尖刺扣血 + 冷却。
- `objective`：eliminate / timed / capture / decapitate 各判定（含边界：超时、占领被打断、目标虫存活）。
- `unlock`：可玩范围计算（best = 0 / 中段 / 已通关 15 / 越界）。

**浏览器 smoke（puppeteer-core + 系统 Chrome，见 memory `boom-worms-smoke-test-setup`）**

- 选关进入、打通一关、危险地形致死、目标达成。

**门禁**：每个里程碑 node:test 全绿 + 浏览器实玩可通。

---

## 8. 分阶段实现（checkpoint-driven）

> 遵循 James 偏好：分段检查点 + 客观门禁 + 每段产出**可实玩中间态**。每阶段独立 commit。

- **M1 · 选关 + 15 关骨架**
  `overlay-levelselect` 路线图 + 解锁逻辑 + `nextLevel` 解硬编码 + 15 关数据（主题/palette/难度参数；目标暂全 `eliminate`，`hazards` 暂空）。
  **门禁**：15 关可选可逐关打通；测试绿；浏览器实玩。

- **M2 · 致命/特殊地形**
  5 种地形的生成 + 物理 + 渲染，接入对应关卡（第 5/6/8/10/11+ 关）。
  **门禁**：相关关卡危险地形生效且公平（出生安全、通路不封死）；测试绿；实玩。

- **M3 · 关卡目标多样化**
  timed / capture / decapitate + HUD + `checkOutcome` 扩展。
  **门禁**：特殊目标关卡按规则判胜负；测试绿；实玩通关第 15 关。

---

## 9. 15 关规划表（已评审通过）

| # | 主题 | 目标 | 地形特色 | 敌 | 难度 |
|---|------|------|----------|----|----|
| 1 | 绿草训练场 | 💀 歼灭 | 🌱 平缓（教学） | 2 | 入门 |
| 2 | 糖果乐园 | 💀 歼灭 | 🧱 平台 | 3 | 入门 |
| 3 | 阳光海滩 | 💀 歼灭 | 🌊 缓坡 + 水 | 3 | 简单 |
| 4 | 神秘丛林 | ⏱️ 限回合 | 🕳️ 洞穴 · 🏢 楼层 | 3 | 简单 |
| 5 | 溶洞深渊 | 💀 歼灭 | 🦔 尖刺（首秀） | 3 | 进阶 |
| 6 | 火山熔岩 | 🎯 斩首 | 🌋 熔岩池 | 3 | 进阶 |
| 7 | 云端天空 | 🚩 攻占高地 | 🧱 多浮空平台 | 3 | 进阶 |
| 8 | 冰雪世界 | 💀 歼灭 | 🧊 冰面打滑 | 4 | 困难 |
| 9 | 沙漠绿洲 | 💀 歼灭 | ⛰️ 沙丘起伏 | 4 | 困难 |
| 10 | 毒沼泽 | 💀 歼灭 | ☠️ 酸水 · 🏢 楼层 | 4 | 困难 |
| 11 | 机关工厂 | 🚩 攻占高地 | ⬆️ 弹床 · 🧱 迷宫 | 4 | 精英 |
| 12 | 黄昏废墟 | 🎯 斩首 | 🦔 尖刺 · 🌋 熔岩 | 4 | 精英 |
| 13 | 暗夜墓园 | ⏱️ 限回合 | 🧊 冰面 · 🕳️ 洞穴 | 5 | 精英 |
| 14 | 彩虹山 | 💀 歼灭 | ⛰️ 崎岖 · 🏢 楼层 | 5 | 地狱 |
| 15 | 终焉决战 | 🎯 斩首 | 🌋 熔岩 · ⬆️ 弹床 | 5 | 地狱 |

目标分布：歼灭 8（1/2/3/5/8/9/10/14）、限回合 2（4/13）、攻占高地 2（7/11）、斩首 3（6/12/15）。
`aiError` 自第 1 关 0.9 平滑递减至第 15 关约 0.08。

---

## 10. 未列入（YAGNI 复述）

Boss 关、三星评分、新武器、移动平台、天气环境、双人选关、关卡内存档。需要时再各自走 spec → plan → 实现。

---

## 11. 评审决议 & 实现参数（OpenCode review 回应）

> 本节为**权威实现参数源**；与前文如有出入以本节为准。

### 11.1 存档迁移（P0）→ 重置
- 不写迁移代码。`STORAGE_KEY` 由 `'boom-worms-progress'` 改为 `'boom-worms-progress-v2'`。
- 换 key 后老存档自然失效，等效"全员从第 1 关重新解锁"，最干净。无"已扩展"提示弹窗。

### 11.2 回合计数（P1-1）
- `turnCount` 仅在**玩家方某虫完成出手**时 +1；**AI 出手不计**。
- `timed.turnLimit` = 玩家出手次数上限；`capture.holdTurns` 同单位。

### 11.3 攻占高地（P1-2）
- `captureZone` 格式：`{ x, y, w, h }`（field 坐标矩形）。
- **半程序化**：`buildLevel` 取该关**最高的 walkable 平台/楼层顶**为高地区（保证可达、不在危险区）。
- 计数在**每个玩家回合结束**时评估：区内**至少一只存活玩家虫** → `captureTimer++`；否则 `captureTimer = 0`（**连续**，被打断重置）。
- 多虫同时在区**不叠加**；不绑定特定虫（任意玩家虫均可）。
- `captureTimer >= holdTurns` → 玩家胜。

### 11.4 斩首胜负优先级（P1-3）→ 目标死即胜
- 判定顺序：**先**查目标虫（敌方 `isTarget` 虫）是否死亡 → 死则**玩家立即胜**（即使己方同回合全灭）。
- 否则再走常规：己方全灭 → 负。即斩首胜利**优先于**己方存活检查，允许同归于尽式胜利。

### 11.5 致命/特殊地形数值（P1-5）→ 入 `config.HAZARD`
| 地形 | 行为 | 数值 |
|------|------|------|
| 熔岩 lava | 落入即死 | 进入区域 → `hp = 0` |
| 酸水 acid | 持续掉血（按时间，非帧） | `hp -= 40 * dt`（≈40/秒） |
| 尖刺 spikes | 接触扣血 + 冷却 | 30/次；**每虫独立冷却 1.0s** |
| 冰面 ice | 惯性滑行 | `moveSpeed` 不变；松手/离地后 vx 衰减率大降（停不住、打滑） |
| 弹床 bounce | 恒定反弹 | 接触 → `vy = -520`（高于普通跳 -360） |

### 11.6 Hazard 架构（水共存 + 落入型须挖空）→ 修正第二轮 P0-2
- `waterY` 保留；hazard 与水**共存**。
- **致命"落入"型（熔岩/酸水）必须把地形挖成池/坑**：否则 worm 站在 solid 实地上，feet 永远进不了熔岩区（只剩下落经过的 1 帧，体验极差）。
  - `terrain.generate()` 算完 heights/platforms/floors **之后**，对熔岩/酸水区域用 `destination-out` 挖空 canvas 并同步清除 mask cells（这是"预留空洞"，**不是**把 hazard 写进可破坏 mask）。尖刺/冰面/弹床**不**挖空（贴表面）。
- **hazard 具体区域由 `terrain.generate()` 计算**（依赖 heights/platforms/floors，`buildLevel` 阶段还不知道这些坐标）：`buildLevel` 只传 hazard **参数**（如 `{ lava: 1, spikes: 2, bounce: 3 }`）；`terrain` 计算落点（熔岩→低谷、尖刺→地表段、弹床→平台/楼层顶…）并暴露 `terrain.hazards = [{ type, x, y, w, h }]`。→ 同时解掉第二轮 P1-5（弹床依赖 platform 坐标）。
- 渲染：`render.js` **每帧动画绘制**（熔岩流动发光、酸水冒泡），与现有水波一致。
- 查询：`physics.js` 每帧按 §11.10 规则检测 worm vs `terrain.hazards`，施加 §11.5 效果。

### 11.7 胜负判定签名（P1-6）
- `checkOutcome(teams, objective, state)` → 返回 `0 | 1 | -1 | null`（玩家胜 / 敌胜 / 平 / 继续）。
- `state` 挂 game 实例：`{ turnCount, captureTimer, targetEnemyIdx, ... }`。
- `eliminate` 为 default 分支（= 现有逻辑）。
- **向后兼容**：`checkOutcome(teams, objective = { type: 'eliminate' }, state = {})` —— 现有 `tests/turns.test.mjs` 的单参调用与 eliminate 分支不受影响（M1 即用此签名）。

### 11.8 AI 与 hazard（P1-7）→ 避开致命地形
- 扩展 `_aiFootingSafe`：把熔岩/酸水/尖刺区视为不安全落脚点，AI 不主动走入。
- 冰面/弹床**不**算致命，AI 照常受其物理影响（公平）。

### 11.9 测试范围（P1-8）→ 三层
- **node:test（主力）**：hazard 物理、objective 判定、unlock 范围、15 关数据完整性。
- **加载级 puppeteer smoke**（复用 memory `boom-worms-smoke-test-setup`）：选关打开、点击进关、console 无 error、HUD/hazard 渲染存在。**不**自动化"完整通关"。
- **手动验证清单**：M1 / M2 / M3 各列 3-5 个实玩检查点。

### 11.10 Hazard 碰撞检测规则（第二轮 P0-3）
统一标准（写入 `config.js` / `physics.js` 注释）：

```js
const feetY = w.y + HALF_H;
const inRegion = (h) => feetY >= h.y && feetY <= h.y + h.h && w.x >= h.x && w.x <= h.x + h.w;
// 熔岩 lava / 酸水 acid / 冰面 ice / 弹床 bounce：inRegion(h)（feet 点在区域内触发）
// 尖刺 spikes：AABB(worm, h) 重叠即触发（身体任何部位碰到都受伤，含贴墙侧面）
```

### 11.11 胜负判定顺序 & 计数时机（第二轮 P1-4 / P1-7）
**计数时机**（`game.js`）：`turnCount++` 放在 `_beginResolve()` 内且仅当 `active.team === 0`（玩家方某虫出手结算时 +1；AI 回合、投掷飞行期都不计）。

**判定顺序**（`_updateResolve` 标记死亡后，按 objective 走）：
1. 标记 hp<=0 / 落水 / 落入致命 hazard 的虫死亡
2. **decapitate**：目标虫（敌方 `isTarget`）死 → 玩家胜（最高优先，允许同归于尽，§11.4）
3. **timed**：敌全灭 → 玩家胜（**极限反杀优先**）；否则 `turnCount > turnLimit` → 玩家负
4. **capture**：玩家回合结束评估，区内有存活玩家虫则 `captureTimer++` 否则归 0；`captureTimer >= holdTurns` → 玩家胜
5. **eliminate**（default）：现有 `checkOutcome` 逻辑（玩家全灭→负 / 敌全灭→胜 / 双灭→平）

> 兜底：任何目标类型，玩家方全灭且未达成目标 → 负。

### 11.12 aiError 完整值表（第二轮 P1-10）
单调不增，前段陡降助上手、后段细腻：

| 关 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 |
|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|----|
| aiError | 0.90 | 0.80 | 0.70 | 0.62 | 0.55 | 0.48 | 0.42 | 0.37 | 0.32 | 0.28 | 0.24 | 0.20 | 0.16 | 0.12 | 0.08 |

`levels.test` 校验：序列严格单调不增。（手感数值，实玩偏差再微调。）

### 11.13 M1 必做的接口预留 & UI 流程（第二轮 P0-1 / P1-6 / P1-8 / P1-9）
即使 M1 无 hazard / 无特殊目标，以下在 M1 就位以免 M2/M3 返工：
- **stepWorm**：`opts` 解构 `hazards = []` 并预留冰面/弹床分支位置（`opts` 是对象，加可选字段**向后兼容**——非破坏性签名变更；M1 传 `[]`）。
- **checkOutcome**：M1 即用 §11.7 三参默认签名（eliminate 分支 = 现状）。
- **选关流程**（`main.js`）：`btn-solo` → 显示 `overlay-levelselect`；`?level=N` → 直接 `startGame(N-1, 'solo')` 跳过选关；选关内"返回主菜单" → `toMenu()`。
- **win 文案**：`win-msg` 改由 `syncOverlays` 动态更新（现 `index.html` 写死"恭喜打败彩虹山 BOSS"，与第 15 关"终焉决战"不符），比照 `lc-msg` / `go-msg` 处理。
