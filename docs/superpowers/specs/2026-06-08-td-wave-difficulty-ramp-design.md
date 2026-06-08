# 塔防·敌兵关内 wave 难度递增 — 设计稿

> 日期：2026-06-08 · 项目：game-hub / tower-defender · 分支：develop
> 状态：设计已确认（已过 OpenCode Review），待 writing-plans 出实施计划
>
> **路径基准**：本 spec 所有 `src/…`、`tests/…`、`tools/…` 路径均**相对 `games/tower-defender/`**（仓库根下的子目录）。下方表格已写全前缀，正文简写处同此基准。

## 问题 / 动机

实玩反馈：武将升到 L5 后单体伤害碾压，后期 wave 再多也只是「多而不强」，一个满级塔照样秒杀步卒。

根因：当前关内难度**只来自数量**（每路兵数 5→26、开火路数 1→3、解锁更多兵种、出兵更快），**单个敌兵的血量/防御在一关之内恒定**，不随 wave 递增。要把「多而不强」改成「又多又硬」。

## 现状（两条缩放轴）

- **敌兵基础数据源**：单兵原型 HP/speed/resist 定义在 `games/tower-defender/src/data/enemies.js` 的 `ENEMIES` 表（如步卒 `hp:60`、藤甲 `hp:180`、boss `hp:800`）。下文示例 HP 均源于此。
- **跨关（campaign）**：`level.scale = 1 + difficulty×0.5`，difficulty L1=0.0 → L50=4.0 → 敌兵 HP L1 ×1.0 → L50 ×3.0（金币同步）。`difficultyParams` in `games/tower-defender/src/data/levels.js`。
- **关内（wave）**：`genWaves`（`games/tower-defender/src/data/waveGen.js`）只缩放数量/路数/兵种/出兵速度；单兵 HP/resist 不变。
- 敌兵实例工厂 `createEnemy`（`games/tower-defender/src/entities/enemy.js`）：`hp = def.hp × scale × hpMult`，`scale` = `level.scale`（每关常量），`hpMult` 仅 boss 用。
- 直伤 `calcDamage`（`games/tower-defender/src/systems/combat/damageCalc.js`）：`dmg = base × resist[dmgType]`；黄忠 L3 百步穿杨 25% 暴击 ×2.5 **无视护甲**（resist 前 early-return）。

## 设计决策（来自本次 brainstorming）

1. **机制**：血量为主轴 + 末段波叠轻微全局减伤。
2. **锚点**：纯关内 ramp，每关独立。本关首波 ×1.0 → 本关末波 ×2.0（HP），下一关重置回首波。**与章号/关号无关**（玩家每关都重新建塔）。叠在现有 `level.scale` 之上，不改 scale。
3. **作用范围**：**所有敌人**都叠（含主将 boss / 副将 lieutenant）。
4. **防御部分**：新增全局减伤系数，从首波 0% 后置渐增到末波 ~15%（受伤 ×0.85），叠在 HP ramp 之上；黄忠暴击仍无视。

## 核心公式（每关独立，关间重置）

令 `t = waveIndex / (waveCount − 1)`（首波 t=0，末波 t=1；`waveCount=1` 时 t=0，防除零）。

| 轴 | 公式 | 曲线 | 作用对象 |
|---|---|---|---|
| **血量**（主轴）| `HP × lerp(1.0, WAVE_HP_RAMP_MAX, t)`，`WAVE_HP_RAMP_MAX=2.0` | 线性 | 所有敌人（含主将/副将）|
| **防御**（压轴）| `受到直伤 × lerp(1.0, WAVE_DEF_RAMP_MIN, t²)`，`WAVE_DEF_RAMP_MIN=0.85` | 后置 t²（前中期几乎无感、末段波才明显，贴合「末段波轻微减伤」）| 所有敌人 |

叠在现有 `level.scale` 之上。示例：

- **L1**（scale 1.0）：首波步卒 60 HP → 末波 120 HP，末波减伤 15%
- **L50**（scale 3.0）：首波步卒 180 HP → 末波 360 HP；司马懿 800×3.0×hpMult1.6=3840 → 末波 ×2 = **7680 HP**
- 黄忠暴击（无视护甲）天然跳过防御 ramp（暴击在 resist 前 early-return，故也在 `dmgTakenMult` 前）

## 架构 / 落点（方案 B：运行时即时算）

> 方案 A = 把 ramp 烘焙进 `waveGen` 的 spawn 数据；**方案 B = 出兵时纯函数即时算**。选 B——不动确定性 wave 数据形状，不碰现有 `waveGen` 测试与存档兼容，ramp 纯运行时。`waveSystem` 里 `state.waveIndex` 与 `level.waves.length` 均在手边。
>
> **计算位置（采纳 review #2）**：ramp 在同一波内是常量，**不在每个 `createEnemy` 处重算**。改为 `startWave()`（`waveSystem.js` L46）里算一次 `const ramp = waveRamp(state.waveIndex, state.level.waves.length)`，把 `ramp.hpMult`/`ramp.dmgTakenMult` 跟 `name`/`hpMult` 一样存到每个 `activeSpawn` 上；出兵时（L21）从 `sp` 读取透传。语义更清晰、便于 debug。

| 文件（相对 `games/tower-defender/`）| 改动 |
|---|---|
| `src/data/balance.js` | 新增 `WAVE_HP_RAMP_MAX: 2.0`、`WAVE_DEF_RAMP_MIN: 0.85`（魔数归位 BAL）|
| `src/data/waveRamp.js` **(新)** | 纯函数 `waveRamp(waveIndex, waveCount) → { hpMult, dmgTakenMult }`，可独立单测 |
| `src/systems/waveSystem.js` | `startWave()`（L46）算一次 ramp 存进 `activeSpawn`；出兵（L21）从 `sp.rampHp`/`sp.dmgTakenMult` 读出透传进 `createEnemy` opts（`rampHp` 与 boss `hpMult` 区分键，见下注）|
| `src/systems/bossSystem.js` | 司马懿召唤的魏卒（L29）**直接继承 boss 身上已算好的 `dmgTakenMult` 与 rampHp**（boss 实例已带，不重算 `state.waveIndex`），保持与召唤者同波硬度 |
| `src/entities/enemy.js` | `createEnemy` opts 接收 ramp 的 `rampHp`（与现有 boss `hpMult` 相乘并入 `hp`/`maxHp`）；新增实例字段 `dmgTakenMult`（默认 1）|
| `src/systems/combat/damageCalc.js` | 直伤返回再乘 `enemy.dmgTakenMult`（暴击早返回天然跳过，见下「已知 tradeoff」）|

注：`createEnemy` 现有 `opts.hpMult` 是 boss 血量倍率。ramp 的 HP 倍率需与之**相乘**（boss 末波 = boss_hpMult × ramp_hpMult）。实现时用独立 opts 键 `opts.rampHp` 避免覆盖，工厂内 `hp = def.hp × scale × (opts.hpMult||1) × (opts.rampHp||1)`。

## 边界 / 明确不做（YAGNI）

- 诸葛灼烧 DoT（走 `statusSystem`，不过 `damageCalc`）**不吃**防御 ramp，只吃 HP ramp（敌兵变肉自然延长灼烧总伤）——注释标明，v1 不为它单独接减伤。
- boss `hpMult × ramp2.0` 末波偏肉（如 L50 司马懿 7680 HP）→ **风险位**：实玩后可单独回调 boss ramp（如给 boss 单设上限或豁免）。本次按「全叠」做，先上再调。

### 已知 tradeoff：暴击 100% 跳过防御 ramp（采纳 review #1）

`calcDamage` 中黄忠暴击在 resist **之前** early-return，故也跳过末波 `dmgTakenMult`。实测影响：黄忠 25% 暴击 ×2.5 时，末波防御 ramp 对其总输出仅削 ~6%（其余 75% 非暴击部分吃满 15%），其他武将吃满 ~15%。

**裁决**：v1 维持现状（代码自然属性，且黄忠招牌技「无视护甲」的设定本就该强）。若实玩发现黄忠末波过度碾压 → 回调方式已记录：把 `dmgTakenMult` 乘进暴击 return 之前（让暴击仍跳 resist、但不跳 wave 减伤）。**不在本次实现**，仅留档。

## 测试 / 门禁

命令（在 `games/tower-defender/` 下执行）：

- 全单测：`node --test tests/*.mjs`
- 关卡完整性/无漏怪 CLI：`node tools/verify-levels.mjs`（exit 1 即失败）

具体项：

- **新** `tests/waveRamp.test.mjs`：边界——首波 `hpMult=1.0`/`dmgTakenMult=1.0`；末波 `hpMult=2.0`/`dmgTakenMult=0.85`；t² 后置性（中点防御 ramp 明显弱于线性，如 `t=0.5` 时 `dmgTakenMult≈0.9625` 而非线性的 `0.925`）；`waveCount=1` 不除零（返回首波值 `{1.0, 1.0}`）。
- **回归** `tests/levels-winnable.test.mjs`：ramp 后 50 关仍可通关——**主要风险位**。若 L50 被打崩 → 下调 `WAVE_HP_RAMP_MAX` 或在 winnable 模拟里提升塔配置后复跑。
- **回归/补充** `tests/damageCalc.test.mjs`（已存在）：补 `dmgTakenMult` 生效、与 resist/暴击的叠加顺序（暴击跳过、非暴击吃满）；`tests/enemy*` 或工厂相关：`rampHp` 与 boss `hpMult` 相乘、`dmgTakenMult` 默认 1。
- 门禁全绿后，浏览器实玩冒烟（手动开 hub 选 L1/L50 各打一把，确认末波体感变硬、HP 条变长、仍可通关）——沿用 [[tower-defender-game]] 检查点验收纪律。

## 验收

- 同一关内，末波敌兵 HP ≈ 首波 ×2，末段波明显更耐打。
- 满级塔不再秒杀末段波小兵，后期 wave 体感「又多又硬」。
- 50 关全部仍可通关；门禁全绿。
