# 塔防·敌兵关内 wave 难度递增 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让敌兵在一关之内随 wave 递增——本关首波 ×1.0 → 末波 HP ×2.0 + 末段波至多 15% 全局减伤，关间重置，叠在现有 `level.scale` 之上。

**Architecture:** 新增纯函数 `waveRamp(waveIndex, waveCount)` 算每波的 `{hpMult, dmgTakenMult}`；`startWave()` 每波算一次存进 `activeSpawn`，出兵时透传进 `createEnemy`；HP 倍率并入实例 `hp`，减伤系数存成实例字段 `dmgTakenMult` 供 `damageCalc` 直伤消费。作用于所有敌人（含主将/副将）；boss 召唤的魏卒从 boss 实例继承 ramp。

**Tech Stack:** 原生 ES modules（`.mjs`），`node:assert` bare-assert 测试，`node --test` 跑全套 + `node tools/verify-levels.mjs` 完整性校验。

**路径基准:** 所有 `src/…`、`tests/…`、`tools/…` 均相对 `games/tower-defender/`。命令均在该目录下执行。

**Spec:** `docs/superpowers/specs/2026-06-08-td-wave-difficulty-ramp-design.md`

---

## File Structure

| 文件 | 责任 | 动作 |
|---|---|---|
| `src/data/balance.js` | 全局平衡魔数单一入口 | 加 `WAVE_HP_RAMP_MAX`、`WAVE_DEF_RAMP_MIN` |
| `src/data/waveRamp.js` | 关内 wave 难度纯函数 | **新建** |
| `src/entities/enemy.js` | 敌实例工厂 | `rampHp` opt 并入 hp；加 `rampHp`/`dmgTakenMult` 实例字段 |
| `src/systems/combat/damageCalc.js` | 单次直伤数值 | 直伤再乘 `enemy.dmgTakenMult` |
| `src/systems/waveSystem.js` | 按波出兵 | `startWave` 算 ramp 存 spawn；出兵透传 |
| `src/systems/bossSystem.js` | 司马懿主动技 | 召唤魏卒继承 boss 的 ramp |
| `tests/waveRamp.test.mjs` | ramp 纯函数边界 | **新建** |
| `tests/enemyRamp.test.mjs` | 工厂 ramp 字段 | **新建** |
| `tests/waveSystemRamp.test.mjs` | 出兵端到端 ramp | **新建** |
| `tests/damageCalc.test.mjs` | 直伤抗性矩阵 | 补 `dmgTakenMult` 断言 |
| `tests/bossSystem.test.mjs` | 司马懿双技 | 补召唤继承断言 |

---

## Task 1: waveRamp 纯函数 + balance 常量

**Files:**
- Create: `src/data/waveRamp.js`
- Modify: `src/data/balance.js`
- Test: `tests/waveRamp.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `tests/waveRamp.test.mjs`:

```js
// tests/waveRamp.test.mjs — 关内 wave 难度递增纯函数边界（首波/末波/t²后置/防除零）
// 运行：node games/tower-defender/tests/waveRamp.test.mjs
import assert from 'node:assert';
import { waveRamp } from '../src/data/waveRamp.js';

// 首波 t=0 → 无加成
const first = waveRamp(0, 20);
assert.equal(first.hpMult, 1, '首波 HP ×1');
assert.equal(first.dmgTakenMult, 1, '首波 无减伤');

// 末波 t=1 → HP×2、受伤×0.85
const last = waveRamp(19, 20);
assert.ok(Math.abs(last.hpMult - 2) < 1e-9, '末波 HP ×2');
assert.ok(Math.abs(last.dmgTakenMult - 0.85) < 1e-9, '末波 受伤 ×0.85');

// 中点 t=0.5：HP 线性=1.5；防御 t² 后置=1-0.15×0.25=0.9625（弱于线性 0.925）
const mid = waveRamp(10, 21);   // 10/(21-1)=0.5
assert.ok(Math.abs(mid.hpMult - 1.5) < 1e-9, '中点 HP 线性 1.5');
assert.ok(Math.abs(mid.dmgTakenMult - 0.9625) < 1e-9, '中点 防御 t² 后置 0.9625');
assert.ok(mid.dmgTakenMult > 0.925, 't² 后置：中点减伤弱于线性');

// waveCount=1 不除零 → 返回首波值
const single = waveRamp(0, 1);
assert.equal(single.hpMult, 1, 'waveCount=1 HP×1');
assert.equal(single.dmgTakenMult, 1, 'waveCount=1 无减伤');

console.log('ok waveRamp');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/waveRamp.test.mjs`
Expected: FAIL — `Cannot find module '../src/data/waveRamp.js'`

- [ ] **Step 3: 加 balance 常量**

Modify `src/data/balance.js` — 在 `WAVE_CLEAR_BONUS: 15,` 行之后插入：

```js
  // —— wave 关内难度递增（每关独立·叠在 level.scale 上；§spec 2026-06-08）——
  WAVE_HP_RAMP_MAX: 2.0,   // 末波单兵 HP = 首波 ×2.0（线性）
  WAVE_DEF_RAMP_MIN: 0.85, // 末波受伤 ×0.85（=15% 减伤；t² 后置）
```

- [ ] **Step 4: 实现 waveRamp.js**

Create `src/data/waveRamp.js`:

```js
// data/waveRamp.js — 关内 wave 难度递增（纯函数·确定性）。
// 首波(waveIndex=0)→末波(waveIndex=waveCount-1)：线性抬 HP、t² 后置抬全局减伤。
// 叠在 level.scale 之上；每关独立（关间不累积）。常量见 BAL.WAVE_HP_RAMP_MAX / WAVE_DEF_RAMP_MIN。
import { BAL } from './balance.js';

export function waveRamp(waveIndex, waveCount) {
  const t = waveCount > 1 ? waveIndex / (waveCount - 1) : 0;     // 首波0→末波1；waveCount=1 防除零
  const hpMult = 1 + (BAL.WAVE_HP_RAMP_MAX - 1) * t;            // 线性 1→2
  const dmgTakenMult = 1 - (1 - BAL.WAVE_DEF_RAMP_MIN) * t * t; // 后置 t²：1→0.85
  return { hpMult, dmgTakenMult };
}
```

- [ ] **Step 5: 跑测试确认通过**

Run: `node tests/waveRamp.test.mjs`
Expected: PASS — 输出 `ok waveRamp`

- [ ] **Step 6: 提交**

```bash
git add src/data/waveRamp.js src/data/balance.js tests/waveRamp.test.mjs
git commit -m "feat(tower-defender): waveRamp 纯函数+BAL常量(首波→末波 HP×2/末段减伤t²)"
```

---

## Task 2: enemy 工厂——rampHp opt + 实例字段

**Files:**
- Modify: `src/entities/enemy.js`
- Test: `tests/enemyRamp.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `tests/enemyRamp.test.mjs`:

```js
// tests/enemyRamp.test.mjs — 工厂 ramp：rampHp 并入 hp/maxHp、与 boss hpMult 相乘、dmgTakenMult 存字段
// 运行：node games/tower-defender/tests/enemyRamp.test.mjs
import assert from 'node:assert';
import { createEnemy } from '../src/entities/enemy.js';

const path = [{ x: 0, y: 0 }, { x: 5, y: 0 }];

// 默认无 ramp：rampHp=1、dmgTakenMult=1
const base = createEnemy('footman', 'a', path, 1);
assert.equal(base.hp, 60, '步卒基础 60');
assert.equal(base.rampHp, 1, '默认 rampHp=1');
assert.equal(base.dmgTakenMult, 1, '默认 dmgTakenMult=1');

// rampHp 并入 hp/maxHp
const ramped = createEnemy('footman', 'a', path, 1, { rampHp: 2 });
assert.equal(ramped.hp, 120, 'rampHp2 → 60×2=120');
assert.equal(ramped.maxHp, 120, 'maxHp 同步');
assert.equal(ramped.rampHp, 2, '存 rampHp 字段');

// rampHp 与 boss hpMult 相乘（不覆盖）
const boss = createEnemy('boss', 'a', path, 1, { hpMult: 1.6, rampHp: 2 });
assert.ok(Math.abs(boss.hp - 800 * 1.6 * 2) < 1e-9, 'boss 800×1.6×2=2560');

// dmgTakenMult 透传存字段
const def = createEnemy('footman', 'a', path, 1, { dmgTakenMult: 0.85 });
assert.equal(def.dmgTakenMult, 0.85, '存 dmgTakenMult 字段');

console.log('ok enemyRamp');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/enemyRamp.test.mjs`
Expected: FAIL — `base.rampHp` 为 `undefined`，断言 `'默认 rampHp=1'` 抛错

- [ ] **Step 3: 改工厂**

Modify `src/entities/enemy.js`:

(a) 把 `const hp = def.hp * scale * hpMult;`（L14）改为：

```js
  const rampHp = opts.rampHp || 1;                                 // wave 关内 HP ramp（与 boss hpMult 相乘）
  const hp = def.hp * scale * hpMult * rampHp;
```

(b) 在返回对象里 `isBoss: !!def.isBoss,` 行之后插入两个字段：

```js
    rampHp,                                        // wave HP 倍率（召唤/分裂可继承）
    dmgTakenMult: opts.dmgTakenMult || 1,          // wave 末段波全局减伤（damageCalc 直伤消费）
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/enemyRamp.test.mjs`
Expected: PASS — `ok enemyRamp`

- [ ] **Step 5: 提交**

```bash
git add src/entities/enemy.js tests/enemyRamp.test.mjs
git commit -m "feat(tower-defender): 敌工厂接 rampHp(并入hp)+rampHp/dmgTakenMult实例字段"
```

---

## Task 3: damageCalc——直伤再乘 dmgTakenMult

**Files:**
- Modify: `src/systems/combat/damageCalc.js`
- Test: `tests/damageCalc.test.mjs`（已存在，补断言）

- [ ] **Step 1: 补失败断言**

Modify `tests/damageCalc.test.mjs` — 在 `console.log('ok damageCalc');` 之前插入：

```js
// wave 末波 dmgTakenMult：非暴击吃满减伤、暴击跳过（无视护甲同时跳减伤）
const tengHard = { resist: { physical: 0.5, fire: 1.5, strategy: 1.0 }, dmgTakenMult: 0.85 };
const ncHard = calcDamage({ level: 1 }, huang, tengHard, noCrit);
assert.ok(Math.abs(ncHard.dmg - 9 * 0.5 * 0.85) < 1e-9, '非暴击吃满减伤(4.5×0.85=3.825)');
const cHard = calcDamage({ level: 3 }, huang, tengHard, crit);
assert.ok(Math.abs(cHard.dmg - 23.04 * 2.5) < 1e-9, '暴击跳过 dmgTakenMult(仍 57.6)');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/damageCalc.test.mjs`
Expected: FAIL — `ncHard.dmg` 当前为 4.5（未乘 0.85），断言 `'非暴击吃满减伤'` 抛错

- [ ] **Step 3: 改 damageCalc**

Modify `src/systems/combat/damageCalc.js` — 把末行：

```js
  return { dmg: base * mult, isCrit: false };
```

改为：

```js
  const dmgTaken = enemy.dmgTakenMult ?? 1;        // wave 末段波全局减伤（暴击早返回已跳过）
  return { dmg: base * mult * dmgTaken, isCrit: false };
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/damageCalc.test.mjs`
Expected: PASS — `ok damageCalc`

- [ ] **Step 5: 提交**

```bash
git add src/systems/combat/damageCalc.js tests/damageCalc.test.mjs
git commit -m "feat(tower-defender): 直伤再乘 enemy.dmgTakenMult(暴击天然跳过)"
```

---

## Task 4: waveSystem——startWave 算 ramp、出兵透传

**Files:**
- Modify: `src/systems/waveSystem.js`
- Test: `tests/waveSystemRamp.test.mjs`

- [ ] **Step 1: 写失败测试**

Create `tests/waveSystemRamp.test.mjs`:

```js
// tests/waveSystemRamp.test.mjs — startWave 每波算 ramp 存 spawn；出兵透传 → 末波敌兵更肉
// 运行：node games/tower-defender/tests/waveSystemRamp.test.mjs
import assert from 'node:assert';
import { waveSystem } from '../src/systems/waveSystem.js';

const path = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
function mkLevel() {
  const spawn = { campId: 'a', pathId: 'a', enemyType: 'footman', count: 1, spawnInterval: 1, leadDelay: 0 };
  return {
    faction: 'wei', scale: 1, paths: { a: path },
    waves: [
      { waveId: 1, startDelay: 0, spawns: [{ ...spawn }] },
      { waveId: 2, startDelay: 0, spawns: [{ ...spawn }] },
    ],
  };
}
function mkState(waveIndex) {
  return {
    phase: 'prep', prepTimer: 0, earlyRequested: false, waveIndex,
    level: mkLevel(), enemies: [], activeSpawns: [], gold: 0, time: 0, campsFallen: {},
  };
}

// 首波(index0,t=0)：spawn rampHp=1，敌兵 hp=60
{
  const s = mkState(0);
  waveSystem(s, 1 / 60);                 // prep→startWave(combat)
  assert.ok(Math.abs(s.activeSpawns[0].rampHp - 1) < 1e-9, '首波 spawn rampHp=1');
  waveSystem(s, 1);                      // 推进出兵
  assert.equal(s.enemies[0].hp, 60, '首波步卒 60');
  assert.equal(s.enemies[0].dmgTakenMult, 1, '首波无减伤');
}

// 末波(index1,t=1)：spawn rampHp=2、dmgTakenMult=0.85，敌兵 hp=120
{
  const s = mkState(1);
  waveSystem(s, 1 / 60);
  assert.ok(Math.abs(s.activeSpawns[0].rampHp - 2) < 1e-9, '末波 spawn rampHp=2');
  assert.ok(Math.abs(s.activeSpawns[0].dmgTakenMult - 0.85) < 1e-9, '末波 spawn dmgTakenMult=0.85');
  waveSystem(s, 1);
  assert.equal(s.enemies[0].hp, 120, '末波步卒 120');
  assert.ok(Math.abs(s.enemies[0].dmgTakenMult - 0.85) < 1e-9, '末波敌兵带 dmgTakenMult');
}

console.log('ok waveSystemRamp');
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/waveSystemRamp.test.mjs`
Expected: FAIL — `s.activeSpawns[0].rampHp` 为 `undefined`，断言 `'首波 spawn rampHp=1'` 抛错

- [ ] **Step 3: 改 waveSystem**

Modify `src/systems/waveSystem.js`:

(a) 在文件顶部 import 区 `import { createEnemy } from '../entities/enemy.js';` 之后加：

```js
import { waveRamp } from '../data/waveRamp.js';
```

(b) 把出兵处 `createEnemy(...)` 调用（约 L21-22）的 opts 补两个键：

```js
      state.enemies.push(createEnemy(sp.enemyType, sp.pathId, level.paths[sp.pathId], level.scale,
        { faction: level.faction, name: sp.name, bossSkills: sp.bossSkills, hpMult: sp.hpMult, bossId: sp.bossId,
          rampHp: sp.rampHp, dmgTakenMult: sp.dmgTakenMult }));  // wave 关内 ramp 透传
```

(c) 在 `startWave` 里 `const wave = state.level.waves[state.waveIndex];` 之后加一行算 ramp：

```js
  const ramp = waveRamp(state.waveIndex, state.level.waves.length);  // 本波算一次（同波常量）
```

(d) 把 `state.activeSpawns = wave.spawns.map((s) => ({ ... }));` 里对象补两个键（与 `name`/`hpMult` 并列）：

```js
    name: s.name, bossSkills: s.bossSkills, hpMult: s.hpMult, bossId: s.id,   // [P3] 透传给 createEnemy（换皮/BOSS）[P6] bossId→sprite
    rampHp: ramp.hpMult, dmgTakenMult: ramp.dmgTakenMult,   // wave 关内难度 ramp（所有 spawn 同波同值，含 boss/副将）
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/waveSystemRamp.test.mjs`
Expected: PASS — `ok waveSystemRamp`

- [ ] **Step 5: 提交**

```bash
git add src/systems/waveSystem.js tests/waveSystemRamp.test.mjs
git commit -m "feat(tower-defender): startWave 每波算 ramp 存 spawn、出兵透传(含boss/副将全叠)"
```

---

## Task 5: bossSystem——召唤魏卒继承 boss 的 ramp

**Files:**
- Modify: `src/systems/bossSystem.js`
- Test: `tests/bossSystem.test.mjs`（已存在，补断言）

- [ ] **Step 1: 补失败断言**

Modify `tests/bossSystem.test.mjs` — 在 `console.log('ok bossSystem');` 之前插入：

```js
// summon 继承 boss 的 wave ramp（rampHp/dmgTakenMult）
{
  const boss = mkBoss();
  boss.rampHp = 2; boss.dmgTakenMult = 0.85;
  const s = { phase: 'combat', time: 0, level, enemies: [boss], towers: [] };
  for (let i = 0; i < 15.05 * 60; i++) { s.time += 1 / 60; bossSystem(s, 1 / 60); }
  const minion = s.enemies.find((e) => e.type === 'footman');
  assert.equal(minion.hp, 120, '召出魏卒继承 rampHp2 → 60×2=120');
  assert.equal(minion.dmgTakenMult, 0.85, '召出魏卒继承 dmgTakenMult');
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node tests/bossSystem.test.mjs`
Expected: FAIL — `minion.hp` 当前为 60（未继承 rampHp），断言 `'召出魏卒继承 rampHp2'` 抛错

- [ ] **Step 3: 改 bossSystem**

Modify `src/systems/bossSystem.js` — 把 `summon` 函数里的 `createEnemy(...)`（L29）改为：

```js
    const m = createEnemy('footman', boss.pathId, path, state.level.scale,
      { faction: state.level.faction, rampHp: boss.rampHp, dmgTakenMult: boss.dmgTakenMult });  // 继承召唤者同波硬度
```

- [ ] **Step 4: 跑测试确认通过**

Run: `node tests/bossSystem.test.mjs`
Expected: PASS — `ok bossSystem`

- [ ] **Step 5: 提交**

```bash
git add src/systems/bossSystem.js tests/bossSystem.test.mjs
git commit -m "feat(tower-defender): 司马懿召唤魏卒继承 boss 的 rampHp/dmgTakenMult"
```

---

## Task 6: 全门禁回归 + winnable 校验 + 按需回调

**Files:**
- Verify only（不改源；仅当 winnable 失败才回调 `src/data/balance.js`）

- [ ] **Step 1: 跑全套单测**

Run: `node --test tests/*.mjs`
Expected: 全 PASS，无 fail。重点关注 `tests/levels-winnable.test.mjs` 是否仍绿（ramp 后 50 关单兵变肉，这是主要风险位）。

- [ ] **Step 2: 跑完整性校验 CLI**

Run: `node tools/verify-levels.mjs`
Expected: 无输出异常、exit 0（无漏怪/路径完整性不受 ramp 影响，应天然通过）。

- [ ] **Step 3:（条件）winnable 失败 → 回调 ramp 强度**

仅当 Step 1 中 `levels-winnable` 报失败（某关打不过）时执行：
1. 打开 `src/data/balance.js`，把 `WAVE_HP_RAMP_MAX: 2.0` 下调到 `1.7`。
2. 重跑 `node --test tests/*.mjs` 看是否转绿。
3. 仍失败则继续降到 `1.5`，重跑。
4. 记录最终值；若降到 1.5 仍不过，停下来报告——说明 winnable 模拟的塔配置需同步增强（超出本计划范围，交回 James 决策）。

> 注：`waveRamp.test.mjs` 断言写死了 `末波 HP ×2` / `中点 1.5`。若回调 `WAVE_HP_RAMP_MAX`，需同步更新 `tests/waveRamp.test.mjs` 里的 `last.hpMult`/`mid.hpMult` 期望值与 Step 1 重跑。

- [ ] **Step 4:（条件）有回调则提交**

```bash
git add src/data/balance.js tests/waveRamp.test.mjs
git commit -m "balance(tower-defender): 实测回调 WAVE_HP_RAMP_MAX 保 50 关 winnable"
```

- [ ] **Step 5: 浏览器实玩冒烟（手动·交 James）**

开 hub 选 L1 与 L50 各打一把，确认：末波敌兵 HP 条明显变长、满级塔不再秒杀末段波小兵、仍可通关。体感 OK 即收尾；偏难/偏易则记录回 balance 微调。

---

## 验收清单

- [ ] 同一关内末波单兵 HP ≈ 首波 ×2（`waveRamp`/`waveSystemRamp` 测试覆盖）
- [ ] 末段波全局减伤 t² 后置至多 15%，暴击跳过（`waveRamp`/`damageCalc` 测试覆盖）
- [ ] boss/副将/召唤魏卒均叠 ramp（`waveSystemRamp`/`bossSystem` 测试覆盖）
- [ ] `node --test tests/*.mjs` 全绿、`node tools/verify-levels.mjs` exit 0
- [ ] 50 关仍可通关（`levels-winnable` 绿）
- [ ] 浏览器实玩末波体感变硬、仍可通关
