# 塔防·敌兵关内 wave 难度递增 — 设计稿

> 日期：2026-06-08 · 项目：game-hub / tower-defender · 分支：develop
> 状态：设计已确认，待 writing-plans 出实施计划

## 问题 / 动机

实玩反馈：武将升到 L5 后单体伤害碾压，后期 wave 再多也只是「多而不强」，一个满级塔照样秒杀步卒。

根因：当前关内难度**只来自数量**（每路兵数 5→26、开火路数 1→3、解锁更多兵种、出兵更快），**单个敌兵的血量/防御在一关之内恒定**，不随 wave 递增。要把「多而不强」改成「又多又硬」。

## 现状（两条缩放轴）

- **跨关（campaign）**：`level.scale = 1 + difficulty×0.5`，difficulty L1=0.0 → L50=4.0 → 敌兵 HP L1 ×1.0 → L50 ×3.0（金币同步）。`difficultyParams` in `src/data/levels.js`。
- **关内（wave）**：`genWaves`（`src/data/waveGen.js`）只缩放数量/路数/兵种/出兵速度；单兵 HP/resist 不变。
- 敌兵实例工厂 `createEnemy`（`src/entities/enemy.js`）：`hp = def.hp × scale × hpMult`，`scale` = `level.scale`（每关常量），`hpMult` 仅 boss 用。
- 直伤 `calcDamage`（`src/systems/combat/damageCalc.js`）：`dmg = base × resist[dmgType]`；黄忠 L3 百步穿杨 25% 暴击 ×2.5 **无视护甲**（resist 前 early-return）。

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

| 文件 | 改动 |
|---|---|
| `src/data/balance.js` | 新增 `WAVE_HP_RAMP_MAX: 2.0`、`WAVE_DEF_RAMP_MIN: 0.85`（魔数归位 BAL）|
| `src/data/waveRamp.js` **(新)** | 纯函数 `waveRamp(waveIndex, waveCount) → { hpMult, dmgTakenMult }`，可独立单测 |
| `src/systems/waveSystem.js` | 出兵时（line ~21）算 `waveRamp(state.waveIndex, level.waves.length)`，把 `rampHp`、`dmgTakenMult` 透传进 `createEnemy` opts（`rampHp` 与 boss `hpMult` 区分键，见下注）|
| `src/systems/bossSystem.js` | 司马懿召唤的魏卒（line ~29）也用当前 wave 的 ramp（一致性）|
| `src/entities/enemy.js` | `createEnemy` opts 接收 ramp 的 `hpMult`（与现有 boss `hpMult` 相乘并入 `hp`/`maxHp`）；新增实例字段 `dmgTakenMult`（默认 1）|
| `src/systems/combat/damageCalc.js` | 直伤返回再乘 `enemy.dmgTakenMult`（暴击早返回天然跳过）|

注：`createEnemy` 现有 `opts.hpMult` 是 boss 血量倍率。ramp 的 HP 倍率需与之**相乘**（boss 末波 = boss_hpMult × ramp_hpMult）。实现时用独立 opts 键（如 `opts.rampHp`）避免覆盖，工厂内 `hp = def.hp × scale × (opts.hpMult||1) × (opts.rampHp||1)`。

## 边界 / 明确不做（YAGNI）

- 诸葛灼烧 DoT（走 `statusSystem`，不过 `damageCalc`）**不吃**防御 ramp，只吃 HP ramp（敌兵变肉自然延长灼烧总伤）——注释标明，v1 不为它单独接减伤。
- boss `hpMult × ramp2.0` 末波偏肉（如 L50 司马懿 7680 HP）→ **风险位**：实玩后可单独回调 boss ramp（如给 boss 单设上限或豁免）。本次按「全叠」做，先上再调。

## 测试 / 门禁

- **新** `tests/waveRamp.test.mjs`：边界——首波 `hpMult=1.0`/`dmgTakenMult=1.0`；末波 `hpMult=2.0`/`dmgTakenMult=0.85`；t² 后置性（中点防御 ramp 明显弱于线性）；`waveCount=1` 不除零（返回首波值）。
- **回归** `tests/levels-winnable.test.mjs`：ramp 后 50 关仍可通关——**主要风险位**。若 L50 被打崩 → 下调 `WAVE_HP_RAMP_MAX` 或在 winnable 模拟里提升塔配置后复跑。
- enemy 工厂 / `damageCalc` 单测补新字段覆盖（`dmgTakenMult` 生效、与 resist/暴击的叠加顺序）。
- 全门禁绿 + headless 冒烟（沿用检查点纪律）。

## 验收

- 同一关内，末波敌兵 HP ≈ 首波 ×2，末段波明显更耐打。
- 满级塔不再秒杀末段波小兵，后期 wave 体感「又多又硬」。
- 50 关全部仍可通关；门禁全绿。
