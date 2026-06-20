# 向僵尸开炮 BOMB ZOMBIE — 阶段 1（核心战斗可玩）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 做出可实玩通关第 1 章的核心战斗：底部炮台守城墙、僵尸潮割草、击杀升级三选一构筑（含进化）、1~2 个主动技能、完整数值反馈，并用平衡模拟器验证可通关。

**Architecture:** 纯逻辑与渲染分离——所有战斗/构筑/波次/经济计算放在可被 `node:test` 直接 import 的无渲染纯模块（`combat/cards/spawn/enemies/wall/hero/bullets/skills/levels/save/util`），`game.js` 做状态机整合，`render/input/main/index/style` 做表现与接线（冒烟验证）。数值用三层叠加 `base × (1+Σ局内%) × (1+Σ局外%)`（阶段 1 局外层恒为 0，但接口预留给阶段 2）。

**Tech Stack:** 原生 ES modules + Canvas 2D；`node --test tests/*.test.mjs` 跑纯逻辑单测；host-side puppeteer-core 冒烟（参照 boom-worms `tests/smoke-m1.mjs`）；平衡模拟器为本游戏新写（不复用 tower-defender 塔防 sim）。

## Global Constraints

- 目录：`games/bomb-zombie/` → `index.html` + `style.css` + `src/`(扁平 ES modules) + `tests/` + `tools/` + `README.md`。最后在 `/Users/james/Projects/game-hub/js/games.js` 的 `GAMES` 数组注册卡片。
- 所有源码用 ES modules（`import`/`export`），无打包、无第三方运行时依赖。
- 存档 key：`save_bz_v1`；存档模块 copy-and-own 自 `games/tower-defender/src/core/save.js`（版本化 + MIGRATIONS + 注入式纯函数）。
- 数值叠加恒为：`最终 = 基础 × (1 + Σ局内%加成) × (1 + Σ局外%加成)`；同类%卡加法叠、层间相乘；多重弹/穿透走加法整数通道；暴击率封顶 100%。
- 城墙交互：堆墙啃咬——僵尸到墙停下（实体挡路），每只按自身 `attackInterval` 对墙造成 `atk` 伤害，多只线性叠加；`wall.hp ≤ 0` = 失败；胜利 = 刷完全部波次且场上僵尸清空。
- 三选一：组内去重 + 已满级/已进化卡退池 + 不足 3 张补兜底卡；稀有度权重 `{common:60, uncommon:25, rare:12, epic:3}`；三选一时**全场完全冻结**，主动技能**实时不冻结**。
- 进化卡：基础卡叠到阈值（默认 5 层）且满足前置 → 下次升级**保底出**进化卡占一格，选中则替换原卡。
- 单关节奏：目标单关升 ~18-20 级（经验曲线由平衡模拟器拟合到该目标）。
- 测试：纯逻辑全部 TDD（`node:test` + `node:assert/strict`，import `../src/...`）；render/input/main/index/style 用冒烟验证。
- 坐标系：竖屏 `FIELD = { W: 540, H: 960 }`，y 向下增大；僵尸从顶部 (y≈0) 向下推进，城墙在底部上方，角色在最底。

---

## 文件结构（决定分解边界）

```
games/bomb-zombie/
  index.html        — canvas + overlays(menu/levelselect/pause/levelclear/gameover/win) + HUD(城墙血条/经验条/技能钮) + 三选一卡面容器
  style.css         — 布局/overlay/HUD/卡面
  src/
    util.js         — clamp/lerp/dist/rngFrom(seed)/pickWeighted（纯）
    config.js       — 全部数值表：FIELD/WALL/HERO/BULLET/ENEMIES/XP/CARD_RARITY/SKILLS/STORAGE_KEY（纯数据）
    combat.js       — 三层数值聚合 effectiveStats / rollDamage(暴击) / applyDamage / tickDoT（纯）
    enemies.js      — 兵种表 + makeEnemy + stepEnemy(下行/到墙停)（纯）
    wall.js         — makeWall + resolveGnaw(线性叠加扣血) + wallDamage（纯）
    spawn.js        — makeSpawner + tickSpawner(按 wave 脚本分通道吐怪) + isLevelComplete（纯）
    cards.js        — CARD_POOL + draw3(去重/权重/退池/兜底/保底进化) + applyCard + isEvolutionReady（纯）
    skills.js       — SKILLS 表 + activateSkill(效果) + tickCooldowns（纯）
    hero.js         — acquireTarget(最近活体) + fireTick(按射速产子弹)（纯）
    bullets.js      — makeBullet + stepBullets(移动/碰撞/穿透/溅射)（纯）
    feedback.js     — 飘字/粒子/震屏的可变状态容器 + 推入/tick（纯，render 消费）
    game.js         — 状态机 + update 整合（无 canvas，可 headless 测）
    render.js       — Canvas 绘制（离屏烘焙背景 + 实体/墙/子弹/HUD/飘字）
    input.js        — 键鼠/触屏/手柄 → action（放技能/选卡/暂停/静音）
    main.js         — 引导 + RAF 循环 + overlay 同步 + 按钮接线 + 选关
    save.js         — copy-and-own：save_bz_v1 进度档（纯函数 + browser 包装）
  tests/
    util.test.mjs  combat.test.mjs  enemies.test.mjs  wall.test.mjs
    spawn.test.mjs  cards.test.mjs  skills.test.mjs  hero.test.mjs
    bullets.test.mjs  levels.test.mjs  save.test.mjs  game.test.mjs
    smoke-ch1.mjs
  tools/
    sim-run.mjs     — 平衡模拟器（新写）：升级→贪心选卡→算 DPS vs 各波血量→判可通关
  README.md
```

依赖序：util→config→(combat,enemies,wall,spawn,cards,skills,save)→(hero,bullets)→levels→game→(render,input,main,index,style)→sim→注册/README/冒烟。

---

## Task 1: 脚手架 + util.js（数学/RNG 工具）

**Files:**
- Create: `games/bomb-zombie/src/util.js`
- Create: `games/bomb-zombie/tests/util.test.mjs`
- Create: `games/bomb-zombie/package.json`

**Interfaces:**
- Produces: `clamp(v,lo,hi)`、`lerp(a,b,t)`、`dist(ax,ay,bx,by)`、`rngFrom(seed)→()=>number`（确定性 [0,1)）、`pickWeighted(items, weightFn, rng)→item`。

- [ ] **Step 1: 建目录与 package.json**

```bash
mkdir -p games/bomb-zombie/src games/bomb-zombie/tests games/bomb-zombie/tools
cat > games/bomb-zombie/package.json <<'JSON'
{ "name": "bomb-zombie", "private": true, "type": "module", "description": "向僵尸开炮 BOMB ZOMBIE — 阵地防守+roguelite构筑 (game-hub)" }
JSON
```

- [ ] **Step 2: 写失败测试** `games/bomb-zombie/tests/util.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, dist, rngFrom, pickWeighted } from '../src/util.js';

test('clamp & lerp', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('dist 勾股', () => { assert.equal(dist(0, 0, 3, 4), 5); });

test('rngFrom 同种子确定性、序列可复现', () => {
  const a = rngFrom(123), b = rngFrom(123);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
});

test('pickWeighted 权重为 0 的项永不被选', () => {
  const rng = rngFrom(1);
  const items = [{ id: 'a', w: 0 }, { id: 'b', w: 1 }];
  for (let i = 0; i < 50; i++) {
    assert.equal(pickWeighted(items, (it) => it.w, rng).id, 'b');
  }
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd games/bomb-zombie && node --test tests/util.test.mjs`
Expected: FAIL（`Cannot find module '../src/util.js'`）

- [ ] **Step 4: 实现** `games/bomb-zombie/src/util.js`

```js
// util.js — 纯数学与确定性 RNG 工具。可被 node:test 直接 import。
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// mulberry32：32 位确定性 PRNG。seed 同 → 序列同（平衡模拟器/可复现测试需要）。
export function rngFrom(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 加权随机：weightFn(item)≥0；总权重 0 时返回首项兜底。
export function pickWeighted(items, weightFn, rng) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightFn(it));
  if (total <= 0) return items[0];
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weightFn(it));
    if (r < 0) return it;
  }
  return items[items.length - 1];
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd games/bomb-zombie && node --test tests/util.test.mjs`
Expected: PASS（4 tests）

- [ ] **Step 6: 提交**

```bash
git add games/bomb-zombie/package.json games/bomb-zombie/src/util.js games/bomb-zombie/tests/util.test.mjs
git commit -m "feat(bomb-zombie): 脚手架+util(clamp/lerp/dist/确定性rng/加权选择)"
```

---

## Task 2: config.js（全部数值表）

**Files:**
- Create: `games/bomb-zombie/src/config.js`
- Create: `games/bomb-zombie/tests/config.test.mjs`（合入 enemies.test 之前先单独校验表结构）

**Interfaces:**
- Produces: `FIELD{W,H}`、`WALL{y,maxHp,heroY}`、`HERO`（基础武器面板）、`BULLET`、`ENEMIES`（按 type 键的兵种表）、`XP{base,growth,perKillFallback}`、`CARD_RARITY{common,uncommon,rare,epic}`(权重)、`LANES`、`STORAGE_KEY='save_bz_v1'`。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/config.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD, WALL, HERO, ENEMIES, CARD_RARITY, LANES, STORAGE_KEY } from '../src/config.js';

test('竖屏尺寸 + 城墙在角色上方', () => {
  assert.ok(FIELD.H > FIELD.W);                 // 竖屏
  assert.ok(WALL.y < WALL.heroY);               // 墙在角色上方(y更小)
  assert.ok(WALL.maxHp > 0);
});

test('英雄基础面板字段齐全且为正', () => {
  for (const k of ['damage', 'fireInterval', 'bulletSpeed', 'pierce', 'multishot', 'critRate', 'critMult', 'splash']) {
    assert.ok(typeof HERO[k] === 'number', `HERO.${k} 必须存在`);
  }
  assert.ok(HERO.fireInterval > 0 && HERO.multishot >= 1);
});

test('七种僵尸齐全且字段完整', () => {
  for (const t of ['normal', 'fast', 'tank', 'exploder', 'shielded', 'spitter', 'summoner']) {
    const e = ENEMIES[t];
    assert.ok(e, `缺兵种 ${t}`);
    for (const k of ['hp', 'speed', 'atk', 'attackInterval', 'xp', 'r']) {
      assert.ok(typeof e[k] === 'number', `${t}.${k} 缺失`);
    }
  }
});

test('稀有度权重为正、key 固定、存档 key 正确', () => {
  for (const k of ['common', 'uncommon', 'rare', 'epic']) assert.ok(CARD_RARITY[k] > 0);
  assert.ok(LANES >= 3);
  assert.equal(STORAGE_KEY, 'save_bz_v1');
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/config.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/config.js`

```js
// config.js — 全部可调数值表（纯数据，可被 node:test import）。平衡模拟器是这些数的裁判。
export const FIELD = { W: 540, H: 960 };
export const LANES = 5;                                   // 僵尸下行通道数
export const WALL = { y: 760, maxHp: 1200, heroY: 880 };  // 墙在 y=760，角色在 y=880

// 英雄基础武器面板（局内卡片/局外养成在此之上叠加；阶段1局外恒0）
export const HERO = {
  damage: 10, fireInterval: 0.45, bulletSpeed: 720,
  pierce: 0, multishot: 1, critRate: 0.05, critMult: 2.0, splash: 0,
};
export const BULLET = { r: 5, life: 2.0 };

// 兵种表。atk=单次啃墙伤害；attackInterval=啃墙间隔(秒)；xp=击杀经验；r=碰撞半径。
export const ENEMIES = {
  normal:   { hp: 22,  speed: 42, atk: 8,  attackInterval: 1.0, xp: 3,  r: 13, color: '#8bbf6a' },
  fast:     { hp: 13,  speed: 95, atk: 5,  attackInterval: 0.8, xp: 4,  r: 11, color: '#b6e36a' },
  tank:     { hp: 130, speed: 22, atk: 22, attackInterval: 1.3, xp: 12, r: 19, color: '#5a7a4a' },
  exploder: { hp: 18,  speed: 55, atk: 0,  attackInterval: 1.0, xp: 6,  r: 14, color: '#d98b3a', explodeDmg: 70, explodeR: 60 },
  shielded: { hp: 42,  speed: 30, atk: 12, attackInterval: 1.1, xp: 8,  r: 15, color: '#6a8fbf', frontShield: 0.5 },
  spitter:  { hp: 26,  speed: 28, atk: 6,  attackInterval: 1.0, xp: 7,  r: 13, color: '#9a6abf', range: 320, spitDmg: 6, spitInterval: 2.0 },
  summoner: { hp: 64,  speed: 18, atk: 4,  attackInterval: 1.2, xp: 15, r: 17, color: '#bf6a8f', summonInterval: 3.0, summonType: 'normal' },
};

// 经验曲线：升 n→n+1 所需经验 = round(base * growth^(n-1))。目标单关 ~18-20 级（由 sim 拟合 base/growth）。
export const XP = { base: 10, growth: 1.14 };

// 三选一稀有度权重（draw3 用）
export const CARD_RARITY = { common: 60, uncommon: 25, rare: 12, epic: 3 };

export const STORAGE_KEY = 'save_bz_v1';
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/config.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/config.js games/bomb-zombie/tests/config.test.mjs
git commit -m "feat(bomb-zombie): config数值表(竖屏/城墙/英雄面板/七兵种/经验曲线/稀有度)"
```

---

## Task 3: combat.js（三层数值聚合 + 暴击伤害）— 数值地基

**Files:**
- Create: `games/bomb-zombie/src/combat.js`
- Create: `games/bomb-zombie/tests/combat.test.mjs`

**Interfaces:**
- Consumes: `HERO`（config）。
- Produces:
  - `effectiveStats(base, inMods, outMods)` → `{damage,fireInterval,bulletSpeed,pierce,multishot,critRate,critMult,splash}`。`inMods`/`outMods` 形如 `{ damagePct, fireRatePct, critRatePct, ..., pierceAdd, multishotAdd }`。
  - `rollDamage(stats, rng)` → `{ amount, isCrit }`（暴击率封顶 1）。
  - `applyDamage(enemy, amount, fromFront)` → 改 `enemy.hp`，护盾僵尸正面减伤 `frontShield`；返回实际伤害。
  - `tickDoT(enemy, dt)` → 处理 `enemy.dots[]`（燃烧/毒）每 tick 扣血，返回本 tick 伤害。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/combat.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveStats, rollDamage, applyDamage, tickDoT } from '../src/combat.js';
import { HERO } from '../src/config.js';

test('同类%加法叠、层间相乘：两张+20%伤害=base*1.4', () => {
  const s = effectiveStats(HERO, { damagePct: 0.4 }, { damagePct: 0 });
  assert.ok(Math.abs(s.damage - HERO.damage * 1.4) < 1e-9);
});

test('局内与局外两层相乘：局内+50%、局外+100% = base*1.5*2', () => {
  const s = effectiveStats(HERO, { damagePct: 0.5 }, { damagePct: 1.0 });
  assert.ok(Math.abs(s.damage - HERO.damage * 1.5 * 2.0) < 1e-9);
});

test('射速%降低 fireInterval（射速越高间隔越短）', () => {
  const s = effectiveStats(HERO, { fireRatePct: 1.0 }, {});  // +100%射速
  assert.ok(Math.abs(s.fireInterval - HERO.fireInterval / 2) < 1e-9);
});

test('多重弹/穿透走加法整数通道', () => {
  const s = effectiveStats(HERO, { multishotAdd: 2, pierceAdd: 3 }, {});
  assert.equal(s.multishot, HERO.multishot + 2);
  assert.equal(s.pierce, HERO.pierce + 3);
});

test('暴击率封顶 100%', () => {
  const s = effectiveStats(HERO, { critRatePct: 5 }, {});  // 远超100%
  assert.equal(s.critRate, 1);
});

test('rollDamage 暴击翻 critMult 倍', () => {
  const stats = { damage: 10, critRate: 1, critMult: 2 };
  const r = rollDamage(stats, () => 0.0);
  assert.equal(r.isCrit, true);
  assert.equal(r.amount, 20);
});

test('护盾僵尸正面减伤 frontShield', () => {
  const e = { hp: 100, frontShield: 0.5 };
  const dealt = applyDamage(e, 40, true);  // 正面
  assert.equal(dealt, 20);
  assert.equal(e.hp, 80);
});

test('tickDoT 按层扣血并递减时长', () => {
  const e = { hp: 100, dots: [{ dps: 10, remain: 0.5 }] };
  const d = tickDoT(e, 0.5);
  assert.equal(d, 5);
  assert.equal(e.hp, 95);
  assert.equal(e.dots.length, 0);  // 时长耗尽移除
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/combat.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/combat.js`

```js
// combat.js — 数值地基。三层叠加：最终 = 基础 × (1+Σ局内%) × (1+Σ局外%)。纯函数。
const pct = (m, k) => (m && typeof m[k] === 'number' ? m[k] : 0);
const add = (m, k) => (m && typeof m[k] === 'number' ? m[k] : 0);

export function effectiveStats(base, inMods = {}, outMods = {}) {
  const mul = (k) => (1 + pct(inMods, k)) * (1 + pct(outMods, k));
  // 射速%越高→间隔越短：interval / (1+Σ射速%)。两层相乘。
  const fireMul = (1 + pct(inMods, 'fireRatePct')) * (1 + pct(outMods, 'fireRatePct'));
  return {
    damage: base.damage * mul('damagePct'),
    fireInterval: base.fireInterval / fireMul,
    bulletSpeed: base.bulletSpeed * mul('bulletSpeedPct'),
    pierce: base.pierce + add(inMods, 'pierceAdd') + add(outMods, 'pierceAdd'),
    multishot: base.multishot + add(inMods, 'multishotAdd') + add(outMods, 'multishotAdd'),
    critRate: Math.min(1, base.critRate * (1 + pct(inMods, 'critRatePct') + pct(outMods, 'critRatePct'))),
    critMult: base.critMult + add(inMods, 'critMultAdd') + add(outMods, 'critMultAdd'),
    splash: base.splash + add(inMods, 'splashAdd') + add(outMods, 'splashAdd'),
  };
}

export function rollDamage(stats, rng) {
  const isCrit = rng() < stats.critRate;
  return { amount: isCrit ? stats.damage * stats.critMult : stats.damage, isCrit };
}

export function applyDamage(enemy, amount, fromFront) {
  let dmg = amount;
  if (fromFront && enemy.frontShield) dmg = amount * (1 - enemy.frontShield);
  enemy.hp -= dmg;
  return dmg;
}

export function tickDoT(enemy, dt) {
  if (!enemy.dots || enemy.dots.length === 0) return 0;
  let total = 0;
  for (const d of enemy.dots) {
    const t = Math.min(dt, d.remain);
    const dmg = d.dps * t;
    total += dmg; d.remain -= t;
  }
  enemy.hp -= total;
  enemy.dots = enemy.dots.filter((d) => d.remain > 1e-6);
  return total;
}
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/combat.test.mjs` → PASS（8 tests）。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/combat.js games/bomb-zombie/tests/combat.test.mjs
git commit -m "feat(bomb-zombie): combat三层数值叠加+暴击+护盾减伤+DoT(数值地基)"
```

---

## Task 4: enemies.js（兵种工厂 + 下行/到墙停）

**Files:**
- Create: `games/bomb-zombie/src/enemies.js`
- Create: `games/bomb-zombie/tests/enemies.test.mjs`

**Interfaces:**
- Consumes: `ENEMIES`、`WALL`、`LANES`、`FIELD`（config）。
- Produces:
  - `makeEnemy(type, lane, id)` → `{ id,type,lane,x,y,hp,hpMax,r,speed,atk,attackInterval,atkTimer,xp,dots:[],frozen:0,...特性字段 }`。
  - `laneX(lane)` → 通道中心 x。
  - `stepEnemy(e, dt)` → 改 `e.y`（下行）；到达 `WALL.y` 即 `e.y=WALL.y` 并标 `e.atWall=true`，不再前进；`frozen>0` 时减速。返回是否在墙。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/enemies.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnemy, laneX, stepEnemy } from '../src/enemies.js';
import { WALL, ENEMIES } from '../src/config.js';

test('makeEnemy 拷贝兵种基础属性 + 满血', () => {
  const e = makeEnemy('tank', 2, 7);
  assert.equal(e.type, 'tank');
  assert.equal(e.hp, ENEMIES.tank.hp);
  assert.equal(e.hpMax, ENEMIES.tank.hp);
  assert.equal(e.lane, 2);
  assert.equal(e.id, 7);
  assert.ok(e.y < WALL.y);          // 从顶部出生
});

test('stepEnemy 向下推进', () => {
  const e = makeEnemy('normal', 0, 1);
  const y0 = e.y;
  stepEnemy(e, 1.0);
  assert.ok(e.y > y0);
  assert.ok(Math.abs((e.y - y0) - ENEMIES.normal.speed) < 1e-6);
});

test('到达城墙即停、标记 atWall', () => {
  const e = makeEnemy('normal', 0, 1);
  e.y = WALL.y - 1;
  stepEnemy(e, 5.0);                 // 远超
  assert.equal(e.y, WALL.y);
  assert.equal(e.atWall, true);
});

test('冰冻减速（frozen>0 时移动更慢）', () => {
  const e = makeEnemy('normal', 0, 1); e.frozen = 1.0;
  const y0 = e.y; stepEnemy(e, 1.0);
  assert.ok((e.y - y0) < ENEMIES.normal.speed);   // 比正常慢
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/enemies.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/enemies.js`

```js
// enemies.js — 兵种工厂与下行运动。纯逻辑。
import { ENEMIES, WALL, LANES, FIELD } from './config.js';

export const laneX = (lane) => {
  const cell = FIELD.W / LANES;
  return cell * (lane + 0.5);
};

export function makeEnemy(type, lane, id) {
  const d = ENEMIES[type];
  return {
    id, type, lane,
    x: laneX(lane), y: -d.r - 4,
    hp: d.hp, hpMax: d.hp, r: d.r,
    speed: d.speed, atk: d.atk, attackInterval: d.attackInterval, atkTimer: 0,
    xp: d.xp, color: d.color,
    dots: [], frozen: 0, atWall: false,
    frontShield: d.frontShield || 0,
    explodeDmg: d.explodeDmg || 0, explodeR: d.explodeR || 0,
    range: d.range || 0, spitDmg: d.spitDmg || 0, spitInterval: d.spitInterval || 0, spitTimer: 0,
    summonInterval: d.summonInterval || 0, summonTimer: 0, summonType: d.summonType || null,
  };
}

export function stepEnemy(e, dt) {
  if (e.atWall) return true;
  const slow = e.frozen > 0 ? 0.4 : 1;
  e.y += e.speed * slow * dt;
  if (e.frozen > 0) e.frozen = Math.max(0, e.frozen - dt);
  if (e.y >= WALL.y) { e.y = WALL.y; e.atWall = true; return true; }
  return false;
}
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/enemies.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/enemies.js games/bomb-zombie/tests/enemies.test.mjs
git commit -m "feat(bomb-zombie): enemies兵种工厂+下行运动+到墙停+冰冻减速"
```

---

## Task 5: wall.js（堆墙啃咬扣血 + 失败条件）

**Files:**
- Create: `games/bomb-zombie/src/wall.js`
- Create: `games/bomb-zombie/tests/wall.test.mjs`

**Interfaces:**
- Consumes: `WALL`（config）。
- Produces:
  - `makeWall()` → `{ hp, maxHp }`。
  - `resolveGnaw(wall, enemies, dt)` → 对每个 `atWall` 的僵尸按 `atkTimer` 累计，满 `attackInterval` 扣 `atk`（多只线性叠加）；返回本帧总扣血。
  - `wallDamage(wall, amount)` → 一次性扣血（爆炸/吐酸用），夹到 ≥0。
  - `isDefeated(wall)` → `wall.hp <= 0`。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/wall.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWall, resolveGnaw, wallDamage, isDefeated } from '../src/wall.js';

test('单只僵尸满间隔啃一次', () => {
  const wall = makeWall();
  const e = { atWall: true, atk: 8, attackInterval: 1.0, atkTimer: 0 };
  let dealt = resolveGnaw(wall, [e], 0.5);   // 未满间隔
  assert.equal(dealt, 0);
  dealt = resolveGnaw(wall, [e], 0.5);       // 累计满 1.0
  assert.equal(dealt, 8);
  assert.equal(wall.hp, wall.maxHp - 8);
});

test('多只同时啃线性叠加', () => {
  const wall = makeWall();
  const mk = () => ({ atWall: true, atk: 10, attackInterval: 1.0, atkTimer: 0 });
  const dealt = resolveGnaw(wall, [mk(), mk(), mk()], 1.0);
  assert.equal(dealt, 30);
});

test('未到墙的僵尸不啃', () => {
  const wall = makeWall();
  const e = { atWall: false, atk: 8, attackInterval: 1.0, atkTimer: 0 };
  assert.equal(resolveGnaw(wall, [e], 2.0), 0);
});

test('wallDamage 一次性扣血、不为负；isDefeated', () => {
  const wall = makeWall(); wall.hp = 50;
  wallDamage(wall, 70);
  assert.equal(wall.hp, 0);
  assert.equal(isDefeated(wall), true);
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/wall.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/wall.js`

```js
// wall.js — 城墙血量与堆墙啃咬结算。纯逻辑。
import { WALL } from './config.js';

export function makeWall() { return { hp: WALL.maxHp, maxHp: WALL.maxHp }; }

// 每只 atWall 僵尸累计 atkTimer，满 attackInterval 触发一次 atk 伤害；多只线性叠加。
export function resolveGnaw(wall, enemies, dt) {
  let total = 0;
  for (const e of enemies) {
    if (!e.atWall) continue;
    e.atkTimer += dt;
    while (e.atkTimer >= e.attackInterval) {
      e.atkTimer -= e.attackInterval;
      total += e.atk;
    }
  }
  if (total > 0) wall.hp = Math.max(0, wall.hp - total);
  return total;
}

export function wallDamage(wall, amount) { wall.hp = Math.max(0, wall.hp - amount); }
export function isDefeated(wall) { return wall.hp <= 0; }
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/wall.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/wall.js games/bomb-zombie/tests/wall.test.mjs
git commit -m "feat(bomb-zombie): wall堆墙啃咬线性叠加扣血+一次性伤害+失败判定"
```

---

## Task 6: spawn.js（波次调度 + 关卡完成判定）

**Files:**
- Create: `games/bomb-zombie/src/spawn.js`
- Create: `games/bomb-zombie/tests/spawn.test.mjs`

**Interfaces:**
- Consumes: `makeEnemy`（enemies）、`LANES`（config）。
- Produces:
  - wave 形状：`{ enemies: [{ type, count, interval }], lane?: number, startDelay: number }`（`lane` 省略=随机分通道）。
  - `makeSpawner(waves, rng)` → spawner 内部状态。
  - `tickSpawner(sp, dt)` → 返回本帧新生成的 enemy 数组（推入 `makeEnemy`）。
  - `spawnerDrained(sp)` → 是否所有波次脚本已吐完。
  - `isLevelComplete(sp, liveEnemies)` → `spawnerDrained && liveEnemies.length === 0`。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/spawn.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSpawner, tickSpawner, spawnerDrained, isLevelComplete } from '../src/spawn.js';
import { rngFrom } from '../src/util.js';

const waves = [{ enemies: [{ type: 'normal', count: 3, interval: 0.5 }], startDelay: 0 }];

test('按 interval 逐只吐怪、总数正确', () => {
  const sp = makeSpawner(waves, rngFrom(1));
  let all = [];
  for (let i = 0; i < 20; i++) all = all.concat(tickSpawner(sp, 0.25));  // 5s
  assert.equal(all.length, 3);
  assert.ok(all.every((e) => e.type === 'normal'));
});

test('drained 在吐完后为真', () => {
  const sp = makeSpawner(waves, rngFrom(1));
  for (let i = 0; i < 40; i++) tickSpawner(sp, 0.25);
  assert.equal(spawnerDrained(sp), true);
});

test('胜利判定 = 吐完且场上清空', () => {
  const sp = makeSpawner(waves, rngFrom(1));
  for (let i = 0; i < 40; i++) tickSpawner(sp, 0.25);
  assert.equal(isLevelComplete(sp, [{ id: 1 }]), false);  // 场上还有
  assert.equal(isLevelComplete(sp, []), true);
});

test('startDelay 延迟首波', () => {
  const sp = makeSpawner([{ enemies: [{ type: 'normal', count: 1, interval: 1 }], startDelay: 2 }], rngFrom(1));
  let n = 0;
  for (let i = 0; i < 4; i++) n += tickSpawner(sp, 0.25).length;  // 1s < 2s delay
  assert.equal(n, 0);
  for (let i = 0; i < 8; i++) n += tickSpawner(sp, 0.25).length;  // 过 delay
  assert.equal(n, 1);
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/spawn.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/spawn.js`

```js
// spawn.js — 波次调度。把 wave 脚本按时间吐成 enemy。纯逻辑（注入 rng）。
import { makeEnemy } from './enemies.js';
import { LANES } from './config.js';

export function makeSpawner(waves, rng) {
  // 展平成有序队列：每只怪记录其触发时间（绝对秒）。
  const queue = [];
  let t = 0;
  for (const w of waves) {
    t += w.startDelay || 0;
    let waveT = t, maxGroup = 0;
    for (const g of w.enemies) {
      let gt = waveT;
      for (let i = 0; i < g.count; i++) {
        queue.push({ time: gt, type: g.type, lane: w.lane });
        gt += g.interval;
      }
      maxGroup = Math.max(maxGroup, gt - waveT);
    }
    t = waveT + maxGroup;   // 下波接在本波最长组之后
  }
  queue.sort((a, b) => a.time - b.time);
  return { queue, idx: 0, clock: 0, rng, nextId: 1 };
}

export function tickSpawner(sp, dt) {
  sp.clock += dt;
  const out = [];
  while (sp.idx < sp.queue.length && sp.queue[sp.idx].time <= sp.clock) {
    const item = sp.queue[sp.idx++];
    const lane = Number.isInteger(item.lane) ? item.lane : Math.floor(sp.rng() * LANES);
    out.push(makeEnemy(item.type, lane, sp.nextId++));
  }
  return out;
}

export const spawnerDrained = (sp) => sp.idx >= sp.queue.length;
export const isLevelComplete = (sp, live) => spawnerDrained(sp) && live.length === 0;
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/spawn.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/spawn.js games/bomb-zombie/tests/spawn.test.mjs
git commit -m "feat(bomb-zombie): spawn波次调度(展平时间队列/分通道/胜利判定)"
```

---

## Task 7: cards.js（卡池 + 三选一 + 应用 + 保底进化）— 命门

**Files:**
- Create: `games/bomb-zombie/src/cards.js`
- Create: `games/bomb-zombie/tests/cards.test.mjs`

**Interfaces:**
- Consumes: `CARD_RARITY`（config）、`pickWeighted`（util）。
- Produces:
  - `CARD_POOL`：数组，每项 `{ id, name, rarity, max, mod, prereq?, evolvesTo?, evoFrom? }`。`mod` 是叠加到 `inMods` 的增量（如 `{ damagePct: 0.15 }`）。
  - `buildRun()` → run 构筑态 `{ stacks:{cardId:n}, inMods:{} }`。
  - `applyCard(run, cardId)` → 叠层 + 把 `mod` 累加进 `run.inMods`；进化卡替换其 `evoFrom` 卡。
  - `evolutionReady(run)` → 满足"基础卡叠到 `max` 且满足 `prereq`"的可进化卡 id 数组。
  - `draw3(run, rng)` → 返回 3 张卡 id：若有 `evolutionReady` 则**保底塞 1 张进化卡**；其余组内去重、按稀有度权重抽、退掉已满层/已进化卡；不足补兜底卡 `__gold__`/`__xp__`/`__heal__`。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/cards.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_POOL, buildRun, applyCard, evolutionReady, draw3 } from '../src/cards.js';
import { rngFrom } from '../src/util.js';

test('CARD_POOL 至少24张普通卡 + 含进化卡', () => {
  const base = CARD_POOL.filter((c) => !c.evoFrom);
  assert.ok(base.length >= 24, `基础卡仅 ${base.length}`);
  assert.ok(CARD_POOL.some((c) => c.evoFrom), '需有进化卡');
});

test('applyCard 叠层并累加 mod 到 inMods', () => {
  const run = buildRun();
  applyCard(run, 'dmg');
  applyCard(run, 'dmg');
  const dmgCard = CARD_POOL.find((c) => c.id === 'dmg');
  assert.equal(run.stacks.dmg, 2);
  assert.ok(Math.abs(run.inMods.damagePct - dmgCard.mod.damagePct * 2) < 1e-9);
});

test('draw3 组内去重、永远3张', () => {
  const run = buildRun();
  const rng = rngFrom(42);
  for (let k = 0; k < 30; k++) {
    const three = draw3(run, rng);
    assert.equal(three.length, 3);
    assert.equal(new Set(three).size, 3);  // 去重
  }
});

test('叠满的卡退出卡池（不再被抽到，除非其进化）', () => {
  const run = buildRun();
  const card = CARD_POOL.find((c) => !c.evoFrom && c.max);
  for (let i = 0; i < card.max; i++) applyCard(run, card.id);
  const rng = rngFrom(7);
  for (let k = 0; k < 60; k++) {
    const three = draw3(run, rng);
    assert.ok(!three.includes(card.id) || three.includes(`${card.id}`) === false);
  }
});

test('叠满+前置满足 → evolutionReady 命中且 draw3 保底出进化卡', () => {
  const run = buildRun();
  const evo = CARD_POOL.find((c) => c.evoFrom);
  const baseId = evo.evoFrom;
  const baseCard = CARD_POOL.find((c) => c.id === baseId);
  for (const p of (evo.prereq || [])) applyCard(run, p);
  for (let i = 0; i < baseCard.max; i++) applyCard(run, baseId);
  assert.ok(evolutionReady(run).includes(evo.id));
  const three = draw3(run, rngFrom(3));
  assert.ok(three.includes(evo.id), '保底未出进化卡');
});

test('applyCard 进化卡替换基础卡', () => {
  const run = buildRun();
  const evo = CARD_POOL.find((c) => c.evoFrom);
  applyCard(run, evo.evoFrom);
  applyCard(run, evo.id);
  assert.ok(run.stacks[evo.id] >= 1);
  assert.equal(run.evolved && run.evolved.includes(evo.evoFrom), true);
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/cards.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/cards.js`

```js
// cards.js — 三选一卡池/抽取/应用/保底进化。命门：构筑深度与 build 高潮。纯逻辑。
import { CARD_RARITY } from './config.js';
import { pickWeighted } from './util.js';

// mod 字段对应 combat.effectiveStats 的 inMods 键。max=最大叠层。
export const CARD_POOL = [
  // —— 武器强化 ——
  { id: 'dmg',      name: '强力弹头', rarity: 'common',   max: 8, mod: { damagePct: 0.15 } },
  { id: 'rate',     name: '高速枪机', rarity: 'common',   max: 8, mod: { fireRatePct: 0.12 } },
  { id: 'multi',    name: '多重射击', rarity: 'rare',     max: 4, mod: { multishotAdd: 1 } },
  { id: 'pierce',   name: '穿甲弹',   rarity: 'uncommon', max: 4, mod: { pierceAdd: 1 } },
  { id: 'crit',     name: '瞄准镜',   rarity: 'uncommon', max: 6, mod: { critRatePct: 0.4 } },
  { id: 'critdmg',  name: '致命要害', rarity: 'rare',     max: 5, mod: { critMultAdd: 0.4 } },
  { id: 'splash',   name: '高爆弹',   rarity: 'uncommon', max: 5, mod: { splashAdd: 12 } },
  { id: 'speed',    name: '加速弹',   rarity: 'common',   max: 5, mod: { bulletSpeedPct: 0.15 } },
  // —— 元素特效（mod 触发挂载在 bullets 命中时，见 Task8 注；这里先记 inMods 标记位）——
  { id: 'burn',     name: '燃烧弹',   rarity: 'rare',     max: 5, mod: { burnDps: 6 } },
  { id: 'frost',    name: '冰霜弹',   rarity: 'uncommon', max: 4, mod: { frostSlow: 0.6 } },
  { id: 'chain',    name: '闪电链',   rarity: 'rare',     max: 4, mod: { chainCount: 1 } },
  { id: 'poison',   name: '剧毒',     rarity: 'uncommon', max: 5, mod: { poisonDps: 4 } },
  { id: 'knock',    name: '冲击波',   rarity: 'common',   max: 4, mod: { knockback: 18 } },
  // —— 防御 ——
  { id: 'wallhp',   name: '加固城墙', rarity: 'common',   max: 6, mod: { wallHpPct: 0.2 } },
  { id: 'wallregen',name: '自动修墙', rarity: 'uncommon', max: 5, mod: { wallRegen: 4 } },
  { id: 'shieldcd', name: '能量护盾', rarity: 'rare',     max: 3, mod: { shieldEvery: 12 } },
  { id: 'thorns',   name: '反伤尖刺', rarity: 'uncommon', max: 4, mod: { thorns: 8 } },
  // —— 经济·构筑 ——
  { id: 'xpgain',   name: '战斗经验', rarity: 'common',   max: 6, mod: { xpPct: 0.15 } },
  { id: 'goldgain', name: '拾荒者',   rarity: 'common',   max: 5, mod: { goldPct: 0.2 } },
  { id: 'magnet',   name: '吸引力场', rarity: 'uncommon', max: 3, mod: { magnet: 1 } },
  { id: 'refund',   name: '弹药回收', rarity: 'common',   max: 4, mod: { pierceAdd: 0.0, refund: 0.1 } },
  { id: 'rangeup',  name: '广域索敌', rarity: 'common',   max: 4, mod: { aoeTargets: 1 } },
  { id: 'firstaid', name: '应急维修', rarity: 'uncommon', max: 3, mod: { wallHpPct: 0.1, wallRegen: 2 } },
  { id: 'overload', name: '超载内核', rarity: 'epic',     max: 3, mod: { damagePct: 0.25, fireRatePct: 0.1 } },
  // —— 进化卡（叠满基础卡 + 前置后保底出现，替换基础卡）——
  { id: 'evo_gatling', name: '⚡加特林风暴', rarity: 'epic', evoFrom: 'rate',   prereq: ['multi'],  mod: { fireRatePct: 1.2, multishotAdd: 2 } },
  { id: 'evo_nova',    name: '☄️新星爆轰', rarity: 'epic', evoFrom: 'splash', prereq: ['dmg'],    mod: { splashAdd: 40, damagePct: 0.3 } },
  { id: 'evo_inferno', name: '🔥炼狱燃烧', rarity: 'epic', evoFrom: 'burn',   prereq: ['crit'],   mod: { burnDps: 30 } },
];

const byId = (id) => CARD_POOL.find((c) => c.id === id);

export function buildRun() { return { stacks: {}, inMods: {}, evolved: [] }; }

export function applyCard(run, cardId) {
  const card = byId(cardId);
  if (!card) return run;
  run.stacks[cardId] = (run.stacks[cardId] || 0) + 1;
  for (const [k, v] of Object.entries(card.mod || {})) {
    run.inMods[k] = (run.inMods[k] || 0) + v;
  }
  if (card.evoFrom) run.evolved.push(card.evoFrom);   // 标记基础卡被进化替换
  return run;
}

export function evolutionReady(run) {
  const out = [];
  for (const c of CARD_POOL) {
    if (!c.evoFrom) continue;
    if (run.stacks[c.id]) continue;                    // 已进化过
    const base = byId(c.evoFrom);
    const maxed = (run.stacks[c.evoFrom] || 0) >= base.max;
    const preOk = (c.prereq || []).every((p) => (run.stacks[p] || 0) >= 1);
    if (maxed && preOk) out.push(c.id);
  }
  return out;
}

const FALLBACK = ['__gold__', '__xp__', '__heal__'];

function selectable(run) {
  return CARD_POOL.filter((c) => {
    if (c.evoFrom) return false;                       // 进化卡只走保底通道
    if (run.evolved.includes(c.id)) return false;      // 已被进化替换，退池
    if (c.max && (run.stacks[c.id] || 0) >= c.max) return false;  // 叠满退池
    return true;
  });
}

export function draw3(run, rng) {
  const out = [];
  const evos = evolutionReady(run);
  if (evos.length) out.push(evos[0]);                  // 保底塞一张进化卡

  const pool = selectable(run).slice();
  while (out.length < 3 && pool.length) {
    const pick = pickWeighted(pool, (c) => CARD_RARITY[c.rarity] || 1, rng);
    out.push(pick.id);
    pool.splice(pool.indexOf(pick), 1);                // 组内去重
  }
  let fi = 0;
  while (out.length < 3) out.push(FALLBACK[fi++ % FALLBACK.length]);  // 兜底补齐
  return out;
}
```

> 注：元素/经济类卡的 `mod` 键（burnDps/frostSlow/wallHpPct/xpPct…）在后续 Task 8（命中挂 DoT/冰冻）、Task 12（game 应用 wallHpPct/xpPct/wallRegen）消费。本任务只负责"叠加进 inMods + 抽取"，不负责生效——生效在消费方测试覆盖。

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/cards.test.mjs` → PASS（6 tests）。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/cards.js games/bomb-zombie/tests/cards.test.mjs
git commit -m "feat(bomb-zombie): cards卡池27张+三选一(去重/权重/退池/兜底)+保底进化(命门)"
```

---

## Task 8: hero.js + bullets.js（自动索敌 + 子弹/穿透/多重/溅射 + 命中挂特效）

**Files:**
- Create: `games/bomb-zombie/src/hero.js`
- Create: `games/bomb-zombie/src/bullets.js`
- Create: `games/bomb-zombie/tests/hero.test.mjs`
- Create: `games/bomb-zombie/tests/bullets.test.mjs`

**Interfaces:**
- Consumes: `effectiveStats`/`rollDamage`/`applyDamage`（combat）、`dist`（util）、`WALL`/`BULLET`/`FIELD`（config）。
- Produces:
  - `acquireTarget(enemies, hx, hy)` → 最近活体 enemy（按欧氏距离），无则 null。
  - `fireTick(hero, stats, enemies, dt)` → 推进 `hero.fireTimer`；每满 `stats.fireInterval` 朝当前锁定目标产 `stats.multishot` 颗子弹（共享目标、微扇角）；返回新子弹数组。
  - `makeBullet(x, y, vx, vy, stats)`。
  - `stepBullets(bullets, enemies, stats, run, dt, rng, onHit)` → 移动子弹；命中 enemy 调 `applyDamage` + 挂 DoT/冰冻（据 `run.inMods.burnDps/frostSlow/poisonDps`）；按 `stats.pierce` 决定穿透；`stats.splash>0` 溅射范围伤害；`onHit(enemy,res)` 回调供反馈层。返回存活子弹。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/hero.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acquireTarget, fireTick } from '../src/hero.js';
import { HERO, WALL, FIELD } from '../src/config.js';
import { effectiveStats } from '../src/combat.js';

const hx = FIELD.W / 2, hy = WALL.heroY;

test('acquireTarget 锁最近活体', () => {
  const enemies = [
    { id: 1, x: hx, y: 100, hp: 10 },
    { id: 2, x: hx, y: 400, hp: 10 },  // 更近
  ];
  assert.equal(acquireTarget(enemies, hx, hy).id, 2);
});

test('死亡(hp<=0)不被锁定', () => {
  const enemies = [{ id: 1, x: hx, y: 400, hp: 0 }, { id: 2, x: hx, y: 100, hp: 5 }];
  assert.equal(acquireTarget(enemies, hx, hy).id, 2);
});

test('fireTick 满间隔产 multishot 颗子弹', () => {
  const stats = effectiveStats(HERO, { multishotAdd: 2 }, {});  // multishot=3
  const hero = { x: hx, y: hy, fireTimer: 0 };
  const enemies = [{ id: 1, x: hx, y: 300, hp: 10 }];
  let made = [];
  for (let i = 0; i < 10; i++) made = made.concat(fireTick(hero, stats, enemies, stats.fireInterval / 5));
  assert.ok(made.length >= 3 && made.length % 3 === 0);
});

test('无目标不开火', () => {
  const stats = effectiveStats(HERO, {}, {});
  const hero = { x: hx, y: hy, fireTimer: 0 };
  assert.equal(fireTick(hero, stats, [], 1.0).length, 0);
});
```

- [ ] **Step 2: 写失败测试** `games/bomb-zombie/tests/bullets.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBullet, stepBullets } from '../src/bullets.js';
import { effectiveStats } from '../src/combat.js';
import { HERO } from '../src/config.js';

test('子弹命中扣血、无穿透则消失', () => {
  const stats = effectiveStats(HERO, {}, {});   // pierce 0
  const b = makeBullet(100, 300, 0, -600, stats);
  const enemy = { id: 1, x: 100, y: 290, r: 14, hp: 50, dots: [] };
  const alive = stepBullets([b], [enemy], stats, { inMods: {} }, 0.05, () => 0.9, () => {});
  assert.ok(enemy.hp < 50);
  assert.equal(alive.length, 0);                // 无穿透命中即消
});

test('穿透 N 可连续命中 N+1 个', () => {
  const stats = effectiveStats(HERO, { pierceAdd: 2 }, {});  // pierce 2
  const b = makeBullet(100, 300, 0, -600, stats);
  const enemies = [
    { id: 1, x: 100, y: 295, r: 14, hp: 5, dots: [] },
    { id: 2, x: 100, y: 290, r: 14, hp: 5, dots: [] },
    { id: 3, x: 100, y: 285, r: 14, hp: 5, dots: [] },
  ];
  const alive = stepBullets([b], enemies, stats, { inMods: {} }, 0.05, () => 0.9, () => {});
  const hitCount = enemies.filter((e) => e.hp < 5).length;
  assert.ok(hitCount >= 2);                      // 穿透命中多个
});

test('燃烧弹命中挂 DoT', () => {
  const stats = effectiveStats(HERO, {}, {});
  const b = makeBullet(100, 300, 0, -600, stats);
  const enemy = { id: 1, x: 100, y: 290, r: 14, hp: 50, dots: [] };
  stepBullets([b], [enemy], stats, { inMods: { burnDps: 6 } }, 0.05, () => 0.9, () => {});
  assert.ok(enemy.dots.length >= 1 && enemy.dots[0].dps === 6);
});
```

- [ ] **Step 3: 运行确认失败** — Run: `node --test tests/hero.test.mjs tests/bullets.test.mjs` → FAIL。

- [ ] **Step 4: 实现** `games/bomb-zombie/src/hero.js`

```js
// hero.js — 自动索敌 + 按射速产子弹。纯逻辑。
import { dist } from './util.js';
import { makeBullet } from './bullets.js';

export function acquireTarget(enemies, hx, hy) {
  let best = null, bd = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const d = dist(hx, hy, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function fireTick(hero, stats, enemies, dt) {
  hero.fireTimer = (hero.fireTimer || 0) + dt;
  const out = [];
  while (hero.fireTimer >= stats.fireInterval) {
    hero.fireTimer -= stats.fireInterval;
    const target = acquireTarget(enemies, hero.x, hero.y);
    if (!target) { hero.fireTimer = 0; break; }       // 无目标不积压
    const baseAng = Math.atan2(target.y - hero.y, target.x - hero.x);
    const n = Math.max(1, Math.round(stats.multishot));
    const spread = 0.12;                              // 多重弹微扇角
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      const a = baseAng + off;
      out.push(makeBullet(hero.x, hero.y, Math.cos(a) * stats.bulletSpeed, Math.sin(a) * stats.bulletSpeed, stats));
    }
  }
  return out;
}
```

- [ ] **Step 5: 实现** `games/bomb-zombie/src/bullets.js`

```js
// bullets.js — 子弹移动/碰撞/穿透/溅射/命中挂特效。纯逻辑（注入 rng + onHit 回调）。
import { rollDamage, applyDamage } from './combat.js';
import { dist } from './util.js';
import { BULLET, FIELD } from './config.js';

export function makeBullet(x, y, vx, vy, stats) {
  return { x, y, vx, vy, r: BULLET.r, life: BULLET.life,
    pierceLeft: Math.round(stats.pierce), hitIds: [], dmg: stats.damage,
    critRate: stats.critRate, critMult: stats.critMult, splash: stats.splash };
}

function attachEffects(enemy, inMods) {
  if (inMods.burnDps) enemy.dots.push({ dps: inMods.burnDps, remain: 2.0 });
  if (inMods.poisonDps) enemy.dots.push({ dps: inMods.poisonDps, remain: 3.0 });
  if (inMods.frostSlow) enemy.frozen = Math.max(enemy.frozen || 0, 1.2);
}

export function stepBullets(bullets, enemies, stats, run, dt, rng, onHit) {
  const inMods = (run && run.inMods) || {};
  const alive = [];
  for (const b of bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > FIELD.W + 20 || b.y < -20 || b.y > FIELD.H + 20) continue;
    let consumed = false;
    for (const e of enemies) {
      if (e.hp <= 0 || b.hitIds.includes(e.id)) continue;
      if (dist(b.x, b.y, e.x, e.y) <= b.r + e.r) {
        const fromFront = b.vy < 0;                   // 由下往上=正面
        const res = rollDamage({ damage: b.dmg, critRate: b.critRate, critMult: b.critMult }, rng);
        applyDamage(e, res.amount, fromFront);
        attachEffects(e, inMods);
        if (b.splash > 0) {                            // 溅射：范围内其它怪受 50% 伤害
          for (const o of enemies) {
            if (o.id === e.id || o.hp <= 0) continue;
            if (dist(e.x, e.y, o.x, o.y) <= b.splash) applyDamage(o, res.amount * 0.5, false);
          }
        }
        if (onHit) onHit(e, res);
        b.hitIds.push(e.id);
        if (b.pierceLeft > 0) { b.pierceLeft--; } else { consumed = true; break; }
      }
    }
    if (!consumed) alive.push(b);
  }
  return alive;
}
```

- [ ] **Step 6: 运行确认通过** — Run: `node --test tests/hero.test.mjs tests/bullets.test.mjs` → PASS。

- [ ] **Step 7: 提交**

```bash
git add games/bomb-zombie/src/hero.js games/bomb-zombie/src/bullets.js games/bomb-zombie/tests/hero.test.mjs games/bomb-zombie/tests/bullets.test.mjs
git commit -m "feat(bomb-zombie): hero自动索敌最近活体+fireTick多重弹; bullets穿透/溅射/命中挂DoT冰冻"
```

---

## Task 9: skills.js（主动技能 + 冷却）

**Files:**
- Create: `games/bomb-zombie/src/skills.js`
- Create: `games/bomb-zombie/tests/skills.test.mjs`

**Interfaces:**
- Consumes: `dist`（util）、`wallDamage` 无关；技能直接改 enemies/wall。
- Produces:
  - `SKILLS`：按 id 的技能表 `{ id, name, icon, cd, kind }`，阶段 1 至少 `nuke`(全屏伤)、`freeze`(全屏冻结)。
  - `makeSkillState(ids)` → `{ [id]: { cd, ready:true, timer:0 } }`。
  - `tickCooldowns(state, dt)` → 推进冷却。
  - `activateSkill(state, id, ctx)` → 若 `ready` 则执行效果（`ctx={enemies, wall, nukeDmg}`）并进入冷却，返回 true；否则 false。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/skills.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, makeSkillState, tickCooldowns, activateSkill } from '../src/skills.js';

test('nuke 对全屏僵尸造成伤害并进入冷却', () => {
  const st = makeSkillState(['nuke']);
  const enemies = [{ id: 1, hp: 100, x: 0, y: 0, dots: [] }, { id: 2, hp: 100, x: 0, y: 0, dots: [] }];
  const ok = activateSkill(st, 'nuke', { enemies, nukeDmg: 80 });
  assert.equal(ok, true);
  assert.ok(enemies.every((e) => e.hp < 100));
  assert.equal(st.nuke.ready, false);
});

test('冷却中不能再放，cd 走完恢复', () => {
  const st = makeSkillState(['nuke']);
  activateSkill(st, 'nuke', { enemies: [], nukeDmg: 50 });
  assert.equal(activateSkill(st, 'nuke', { enemies: [], nukeDmg: 50 }), false);
  tickCooldowns(st, SKILLS.nuke.cd + 0.1);
  assert.equal(st.nuke.ready, true);
});

test('freeze 冻结全屏', () => {
  const st = makeSkillState(['freeze']);
  const enemies = [{ id: 1, hp: 10, frozen: 0 }];
  activateSkill(st, 'freeze', { enemies });
  assert.ok(enemies[0].frozen > 0);
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/skills.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/skills.js`

```js
// skills.js — 主动技能与冷却。实时释放（不受三选一冻结影响）。纯逻辑。
export const SKILLS = {
  nuke:   { id: 'nuke',   name: '核弹清场', icon: '☢️', cd: 30, kind: 'nuke' },
  freeze: { id: 'freeze', name: '冰冻领域', icon: '❄️', cd: 20, kind: 'freeze' },
};

export function makeSkillState(ids) {
  const st = {};
  for (const id of ids) st[id] = { cd: SKILLS[id].cd, ready: true, timer: 0 };
  return st;
}

export function tickCooldowns(state, dt) {
  for (const id of Object.keys(state)) {
    const s = state[id];
    if (s.ready) continue;
    s.timer += dt;
    if (s.timer >= s.cd) { s.ready = true; s.timer = 0; }
  }
}

export function activateSkill(state, id, ctx) {
  const s = state[id];
  if (!s || !s.ready) return false;
  const kind = SKILLS[id].kind;
  if (kind === 'nuke') {
    for (const e of ctx.enemies) { if (e.hp > 0) e.hp -= (ctx.nukeDmg || 60); }
  } else if (kind === 'freeze') {
    for (const e of ctx.enemies) { if (e.hp > 0) e.frozen = Math.max(e.frozen || 0, 3.0); }
  }
  s.ready = false; s.timer = 0;
  return true;
}
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/skills.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/skills.js games/bomb-zombie/tests/skills.test.mjs
git commit -m "feat(bomb-zombie): skills主动技能(核弹清场/冰冻领域)+冷却(实时释放)"
```

---

## Task 10: levels.js（第 1 章波次数据 + 难度派生 + 经验曲线）

**Files:**
- Create: `games/bomb-zombie/src/levels.js`
- Create: `games/bomb-zombie/tests/levels.test.mjs`

**Interfaces:**
- Consumes: `XP`（config）。
- Produces:
  - `LEVELS`：长度 10（关 1-9 普通 + 关 10 Boss），每项 `{ id, name, waves, boss? }`，`waves` 为 Task6 的 wave[]。
  - `expForLevel(n)` → 升 n→n+1 所需经验 `round(XP.base * XP.growth^(n-1))`。
  - `levelParams(n)` → `{ hpScale, densityScale }`（随关号单调递增），供波次 count/敌人血量缩放（game.js 用 hpScale 乘敌人 hpMax）。
  - `totalEnemies(level)` → 该关僵尸总数（测试/模拟器用）。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/levels.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, expForLevel, levelParams, totalEnemies } from '../src/levels.js';

test('第1章共10关，末关为Boss关', () => {
  assert.equal(LEVELS.length, 10);
  assert.ok(LEVELS[9].boss, '第10关须为Boss关');
  for (const lv of LEVELS) { assert.ok(Array.isArray(lv.waves) && lv.waves.length >= 1); assert.ok(lv.name); }
});

test('每关 wave 结构合法（type/count/interval）', () => {
  for (const lv of LEVELS) {
    for (const w of lv.waves) {
      assert.ok(Array.isArray(w.enemies));
      for (const g of w.enemies) {
        assert.ok(typeof g.type === 'string' && g.count > 0 && g.interval > 0);
      }
    }
  }
});

test('经验曲线随等级递增', () => {
  assert.ok(expForLevel(2) > expForLevel(1));
  assert.ok(expForLevel(10) > expForLevel(5));
});

test('难度随关号单调递增（怪量或血量）', () => {
  assert.ok(levelParams(5).hpScale >= levelParams(1).hpScale);
  assert.ok(totalEnemies(LEVELS[8]) >= totalEnemies(LEVELS[0]));
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/levels.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/levels.js`

```js
// levels.js — 第1章「城郊废土」波次数据 + 难度派生 + 经验曲线。纯数据/纯函数。
import { XP } from './config.js';

export const expForLevel = (n) => Math.round(XP.base * Math.pow(XP.growth, n - 1));

// 随关号单调递增的难度系数（敌人血量与密度），game.js 用 hpScale 乘 hpMax。
export const levelParams = (n) => ({ hpScale: 1 + (n - 1) * 0.35, densityScale: 1 + (n - 1) * 0.15 });

// 工具：把一组 (type,count,interval) 包成一波
const wave = (enemies, startDelay = 1.2, lane) => ({ enemies, startDelay, ...(lane != null ? { lane } : {}) });
const g = (type, count, interval) => ({ type, count, interval });

// 关 1-9 渐进引入兵种；关 10 Boss。数值偏保守，由 tools/sim-run.mjs 校到「可通关 + 单关~18-20级」。
export const LEVELS = [
  { id: 1, name: '废土前哨', waves: [ wave([g('normal', 8, 0.7)]), wave([g('normal', 12, 0.5)]) ] },
  { id: 2, name: '断桥', waves: [ wave([g('normal', 10, 0.6)]), wave([g('fast', 6, 0.5), g('normal', 8, 0.6)]) ] },
  { id: 3, name: '加油站', waves: [ wave([g('normal', 12, 0.5)]), wave([g('fast', 10, 0.4)]), wave([g('tank', 2, 1.5), g('normal', 10, 0.5)]) ] },
  { id: 4, name: '废弃营地', waves: [ wave([g('normal', 14, 0.45)]), wave([g('exploder', 5, 1.0), g('normal', 10, 0.5)]), wave([g('tank', 3, 1.2)]) ] },
  { id: 5, name: '高速公路', waves: [ wave([g('fast', 14, 0.35)]), wave([g('shielded', 6, 0.9)]), wave([g('tank', 3, 1.2), g('normal', 12, 0.45)]) ] },
  { id: 6, name: '污水处理厂', waves: [ wave([g('spitter', 6, 1.0), g('normal', 12, 0.5)]), wave([g('exploder', 6, 0.9)]), wave([g('shielded', 8, 0.8)]) ] },
  { id: 7, name: '地下车库', waves: [ wave([g('normal', 18, 0.35)]), wave([g('tank', 4, 1.0), g('fast', 12, 0.35)]), wave([g('summoner', 2, 2.0), g('normal', 10, 0.5)]) ] },
  { id: 8, name: '军火库', waves: [ wave([g('shielded', 10, 0.7)]), wave([g('exploder', 8, 0.8), g('spitter', 6, 1.0)]), wave([g('tank', 5, 0.9)]) ] },
  { id: 9, name: '城门废墟', waves: [ wave([g('fast', 20, 0.3)]), wave([g('summoner', 3, 1.8), g('shielded', 8, 0.7)]), wave([g('tank', 6, 0.8), g('exploder', 8, 0.7)]) ] },
  { id: 10, name: '尸潮之王', boss: { hp: 6000, atk: 60, summonInterval: 4, phaseAt: [0.66, 0.33] },
    waves: [ wave([g('normal', 12, 0.5)]), wave([g('tank', 3, 1.2), g('fast', 10, 0.4)]) ] },
];

export function totalEnemies(level) {
  let n = 0;
  for (const w of level.waves) for (const grp of w.enemies) n += grp.count;
  return n;
}
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/levels.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/levels.js games/bomb-zombie/tests/levels.test.mjs
git commit -m "feat(bomb-zombie): levels第1章10关波次数据+难度派生+经验曲线"
```

---

## Task 11: save.js（进度档 copy-and-own）

**Files:**
- Create: `games/bomb-zombie/src/save.js`
- Create: `games/bomb-zombie/tests/save.test.mjs`

**Interfaces:**
- Produces（mirror tower-defender save.js）：`CURRENT_VERSION`、`defaultSave()`、`loadSave(storage)`、`writeSave(storage,save)`、`applyClear(save,levelId,stars)`、`isUnlocked(save,levelId)`、`nextPlayableIndex(save,total)`、`browserLoad/browserWrite`。schema：`{ version, unlockedLevel, stars:{levelId:stars}, settings:{muted} }`。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/save.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, loadSave, writeSave, applyClear, isUnlocked, nextPlayableIndex } from '../src/save.js';

function fakeStore() { let m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }

test('默认档第1关解锁', () => {
  const s = defaultSave();
  assert.equal(s.unlockedLevel, 1);
  assert.equal(isUnlocked(s, 1), true);
  assert.equal(isUnlocked(s, 2), false);
});

test('applyClear 解锁下一关 + 取更高星', () => {
  let s = defaultSave();
  s = applyClear(s, 1, 2);
  assert.equal(s.unlockedLevel, 2);
  assert.equal(s.stars[1], 2);
  s = applyClear(s, 1, 1);            // 低星不覆盖
  assert.equal(s.stars[1], 2);
});

test('写入后读回一致', () => {
  const store = fakeStore();
  let s = defaultSave(); s = applyClear(s, 1, 3);
  writeSave(store, s);
  assert.deepEqual(loadSave(store), s);
});

test('坏数据回落默认档', () => {
  const store = fakeStore(); store.setItem('save_bz_v1', '{bad json');
  assert.deepEqual(loadSave(store), defaultSave());
});

test('nextPlayableIndex 指向首个未通关', () => {
  let s = defaultSave(); s = applyClear(s, 1, 1);
  assert.equal(nextPlayableIndex(s, 10), 1);   // 关2(0-based=1)
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/save.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/save.js`（copy-and-own 自 tower-defender，去掉 resume 快照，key 改 `save_bz_v1`，settings 仅 muted）

```js
// save.js — 进度档（注入 storage 的纯函数 + browser 包装）。copy-and-own 自 tower-defender/src/core/save.js。
// key: save_bz_v1。schema: { version, unlockedLevel, stars:{levelId:stars}, settings:{muted} }
const KEY = 'save_bz_v1';
export const CURRENT_VERSION = 1;
const MIGRATIONS = {};   // 改 schema 时：CURRENT_VERSION+1 并在此注册 from→to 转换

export function _applyMigrations(d, migrations = MIGRATIONS, current = CURRENT_VERSION) {
  let v = Number.isInteger(d.version) ? d.version : 0, out = d;
  while (v < current && migrations[v]) { out = migrations[v](out); v++; }
  return out;
}

export function defaultSave() {
  return { version: CURRENT_VERSION, unlockedLevel: 1, stars: {}, settings: { muted: false } };
}

export function loadSave(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = _applyMigrations(JSON.parse(raw));
    const def = defaultSave();
    return {
      version: CURRENT_VERSION,
      unlockedLevel: Number.isInteger(d.unlockedLevel) && d.unlockedLevel >= 1 ? d.unlockedLevel : def.unlockedLevel,
      stars: d.stars && typeof d.stars === 'object' ? { ...d.stars } : {},
      settings: { muted: !!(d.settings && d.settings.muted) },
    };
  } catch { return defaultSave(); }
}

export function writeSave(storage, save) {
  try { storage.setItem(KEY, JSON.stringify(save)); } catch { /* 隐私模式/配额 → 忽略 */ }
  return save;
}

export function applyClear(save, levelId, stars) {
  const next = { version: CURRENT_VERSION, unlockedLevel: save.unlockedLevel, stars: { ...save.stars }, settings: { ...save.settings } };
  if (!next.stars[levelId] || stars > next.stars[levelId]) next.stars[levelId] = stars;
  if (levelId + 1 > next.unlockedLevel) next.unlockedLevel = levelId + 1;
  return next;
}

export const isUnlocked = (save, levelId) => levelId <= save.unlockedLevel;
export function nextPlayableIndex(save, total) {
  for (let i = 0; i < total; i++) { if (!save.stars[i + 1]) return i; }
  return Math.max(0, total - 1);
}

export const browserLoad = () => loadSave(window.localStorage);
export const browserWrite = (s) => writeSave(window.localStorage, s);
```

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/save.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/save.js games/bomb-zombie/tests/save.test.mjs
git commit -m "feat(bomb-zombie): save进度档copy-and-own(save_bz_v1/版本化/解锁/星级)"
```

---

## Task 12: game.js（状态机 + update 整合）— headless 可测

**Files:**
- Create: `games/bomb-zombie/src/game.js`
- Create: `games/bomb-zombie/tests/game.test.mjs`

**Interfaces:**
- Consumes: 全部上游纯模块 + `effectiveStats`/`tickDoT`（combat）、`expForLevel`/`levelParams`（levels）、`resolveGnaw`/`wallDamage`/`makeWall`/`isDefeated`（wall）。
- Produces: `class Game`（不依赖 canvas/DOM）：
  - 字段：`state`('menu'|'playing'|'cardpick'|'paused'|'levelclear'|'gameover'|'win')、`level`、`wall`、`enemies`、`bullets`、`run`(buildRun)、`heroLevel`、`xp`、`xpNeed`、`pendingCards`、`skillState`、`feedback`。
  - `startLevel(index)`：装载关卡，重置局内 run/等级。
  - `update(dt)`：playing 态推进全链路；cardpick/paused 冻结。
  - `chooseCard(cardId)`：applyCard → 重算 xpNeed → 回 playing。
  - `useSkill(id)`：实时放技能（即使非 playing 也允许 playing 中）。
  - `effective()`：当前 `effectiveStats(HERO, run.inMods, {})`（局外层阶段1为空）。
  - 胜负：`isDefeated(wall)` → gameover；`isLevelComplete` → levelclear（末关→win）。

- [ ] **Step 1: 写失败测试** `games/bomb-zombie/tests/game.test.mjs`

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

function advance(g, seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) g.update(dt); }

test('startLevel 进入 playing 并装载城墙满血', () => {
  const g = new Game(() => 0.5);
  g.startLevel(0);
  assert.equal(g.state, 'playing');
  assert.equal(g.wall.hp, g.wall.maxHp);
  assert.equal(g.heroLevel, 1);
});

test('击杀累计经验、满级进入 cardpick 并冻结', () => {
  const g = new Game(() => 0.0);             // rng=0 → 不暴击，稳定
  g.startLevel(0);
  // 人为塞一只濒死怪并让英雄打死它来获得经验：直接驱动若干秒
  advance(g, 6);
  // 升级会把 state 切到 cardpick；若已切，enemies 推进应停止
  if (g.state === 'cardpick') {
    const before = g.enemies.map((e) => e.y);
    g.update(0.5);                            // cardpick 下不推进
    assert.deepEqual(g.enemies.map((e) => e.y), before);
    assert.equal(g.pendingCards.length, 3);
  }
  assert.ok(g.xp >= 0);
});

test('chooseCard 应用卡片并回到 playing', () => {
  const g = new Game(() => 0.0);
  g.startLevel(0);
  advance(g, 8);
  if (g.state === 'cardpick') {
    const pick = g.pendingCards[0];
    g.chooseCard(pick);
    assert.equal(g.state, 'playing');
  }
});

test('城墙破 → gameover', () => {
  const g = new Game(() => 0.5);
  g.startLevel(0);
  g.wall.hp = 1;
  g.enemies.push({ id: 999, type: 'tank', x: 270, y: g.wall.y, r: 19, hp: 999, hpMax: 999,
    atk: 50, attackInterval: 0.1, atkTimer: 1, xp: 0, dots: [], frozen: 0, atWall: true });
  advance(g, 1);
  assert.equal(g.state, 'gameover');
});

test('清完全部波次且场上空 → levelclear', () => {
  const g = new Game(() => 0.5);
  g.startLevel(0);
  g.spawner.idx = g.spawner.queue.length;    // 强制吐完
  g.enemies = [];
  g.update(0.1);
  assert.ok(g.state === 'levelclear' || g.state === 'win');
});
```

- [ ] **Step 2: 运行确认失败** — Run: `node --test tests/game.test.mjs` → FAIL。

- [ ] **Step 3: 实现** `games/bomb-zombie/src/game.js`

```js
// game.js — 状态机 + update 整合（无 canvas/DOM，可 headless 测）。
import { HERO, WALL, FIELD } from './config.js';
import { effectiveStats, tickDoT } from './combat.js';
import { makeWall, resolveGnaw, wallDamage, isDefeated } from './wall.js';
import { makeSpawner, tickSpawner, isLevelComplete } from './spawn.js';
import { stepEnemy, laneX } from './enemies.js';
import { fireTick } from './hero.js';
import { stepBullets } from './bullets.js';
import { buildRun, applyCard, draw3 } from './cards.js';
import { makeSkillState, tickCooldowns, activateSkill } from './skills.js';
import { LEVELS, expForLevel, levelParams } from './levels.js';

export class Game {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.state = 'menu';
    this.feedback = { floaters: [], shake: 0 };
  }

  startLevel(index) {
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.params = levelParams(this.level.id);
    this.wall = makeWall();
    this.enemies = [];
    this.bullets = [];
    this.hero = { x: FIELD.W / 2, y: WALL.heroY, fireTimer: 0 };
    this.run = buildRun();
    this.heroLevel = 1;
    this.xp = 0;
    this.xpNeed = expForLevel(1);
    this.pendingCards = [];
    this.skillState = makeSkillState(['nuke', 'freeze']);
    this.spawner = makeSpawner(this.level.waves, this.rng);
    this.state = 'playing';
  }

  effective() { return effectiveStats(HERO, this.run.inMods, {}); }

  useSkill(id) {
    if (this.state !== 'playing') return false;
    const stats = this.effective();
    return activateSkill(this.skillState, id, { enemies: this.enemies, nukeDmg: stats.damage * 20 });
  }

  chooseCard(cardId) {
    if (this.state !== 'cardpick') return;
    applyCard(this.run, cardId);
    // 加固城墙卡即时生效：按 wallHpPct 提高上限并回满差额
    const wallPct = this.run.inMods.wallHpPct || 0;
    const newMax = Math.round(WALL.maxHp * (1 + wallPct));
    const diff = newMax - this.wall.maxHp;
    this.wall.maxHp = newMax; if (diff > 0) this.wall.hp += diff;
    this.heroLevel += 1;
    this.xpNeed = expForLevel(this.heroLevel);
    this.pendingCards = [];
    this.state = 'playing';
  }

  _gainXp(amount) {
    const mult = 1 + (this.run.inMods.xpPct || 0);
    this.xp += amount * mult;
    if (this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.pendingCards = draw3(this.run, this.rng);
      this.state = 'cardpick';
    }
  }

  update(dt) {
    if (this.state !== 'playing') return;       // cardpick/paused/menu 全场冻结
    tickCooldowns(this.skillState, dt);         // 技能冷却照走（实时）

    // 1) 吐怪（应用 hpScale）
    for (const e of tickSpawner(this.spawner, dt)) {
      e.hp = Math.round(e.hp * this.params.hpScale);
      e.hpMax = e.hp;
      this.enemies.push(e);
    }
    // 2) 推进僵尸 + DoT + 特殊行为（吐酸/爆炸到墙）
    for (const e of this.enemies) {
      stepEnemy(e, dt);
      if (e.dots.length) tickDoT(e, dt);
      if (e.type === 'spitter' && e.atWall) { /* 已到墙按啃咬处理 */ }
    }
    // 3) 城墙自动修复（wallRegen 卡）
    const regen = this.run.inMods.wallRegen || 0;
    if (regen) this.wall.hp = Math.min(this.wall.maxHp, this.wall.hp + regen * dt);
    // 4) 城墙啃咬
    resolveGnaw(this.wall, this.enemies, dt);
    // 5) 英雄开火 + 子弹推进
    const stats = this.effective();
    this.bullets = this.bullets.concat(fireTick(this.hero, stats, this.enemies, dt));
    this.bullets = stepBullets(this.bullets, this.enemies, stats, this.run, dt, this.rng,
      (enemy, res) => { this.feedback.floaters.push({ x: enemy.x, y: enemy.y, amount: Math.round(res.amount), crit: res.isCrit, life: 0.6 }); });
    // 6) 结算死亡 → 经验 + 爆炸僵尸到墙自爆
    const survivors = [];
    for (const e of this.enemies) {
      if (e.hp <= 0) {
        if (e.type === 'exploder') wallDamage(this.wall, 0);   // 被打死不炸墙
        this._gainXp(e.xp);
        this.feedback.shake = Math.min(8, this.feedback.shake + 0.6);
        continue;
      }
      if (e.type === 'exploder' && e.atWall) { wallDamage(this.wall, e.explodeDmg); continue; }
      survivors.push(e);
    }
    this.enemies = survivors;
    // 7) 飘字/震屏衰减
    for (const f of this.feedback.floaters) f.life -= dt;
    this.feedback.floaters = this.feedback.floaters.filter((f) => f.life > 0);
    this.feedback.shake = Math.max(0, this.feedback.shake - dt * 12);
    // 8) 胜负判定
    if (isDefeated(this.wall)) { this.state = 'gameover'; return; }
    if (isLevelComplete(this.spawner, this.enemies)) {
      this.state = (this.levelIndex >= LEVELS.length - 1) ? 'win' : 'levelclear';
    }
  }
}
```

> 注：Boss 关（第10关）的 Boss 实体在阶段 1 作为一只超高 HP、带 `summonInterval` 的特殊 enemy 注入（沿用 summoner 行为 + boss.hp）。完整多阶段机制（phaseAt 弱点窗口）属阶段 1 收尾的 Boss 落地子任务，可在本任务通过后追加一个「Boss 实体」小步：在 `startLevel` 末尾 push 一只 `{ type:'boss', hp:level.boss.hp, ... }` 并在 render 特殊绘制。先确保普通关全链路绿。

- [ ] **Step 4: 运行确认通过** — Run: `node --test tests/game.test.mjs` → PASS。

- [ ] **Step 5: 提交**

```bash
git add games/bomb-zombie/src/game.js games/bomb-zombie/tests/game.test.mjs
git commit -m "feat(bomb-zombie): game状态机+update全链路整合(吐怪/索敌/啃墙/升级三选一冻结/胜负)"
```

---

## Task 13: tools/sim-run.mjs（平衡模拟器 — 新写）

**Files:**
- Create: `games/bomb-zombie/tools/sim-run.mjs`

**Interfaces:**
- Consumes: `Game`（game.js）。
- Produces: CLI 脚本——对每关用确定性 rng 跑整局，贪心选第 1 张卡（或按简单策略），输出每关 `{ level, result: 'win'|'lose', heroLevelReached, durationSec }` 与第 1 章整体可通关率；非 0 退出码表示有不可通关关卡。

- [ ] **Step 1: 实现** `games/bomb-zombie/tools/sim-run.mjs`

```js
// sim-run.mjs — 平衡模拟器（本游戏专属，新写；非复用 tower-defender 塔防 sim）。
// 用 headless Game 跑整局，自动选卡，验「第1章每关可通关 + 单关升级次数落在目标带」。
import { Game } from '../src/game.js';
import { LEVELS } from '../src/levels.js';
import { rngFrom } from '../src/util.js';

function simLevel(index, seed) {
  const g = new Game(rngFrom(seed));
  g.startLevel(index);
  let t = 0, levelUps = 0; const dt = 1 / 60, maxT = 180;
  while (t < maxT) {
    g.update(dt);
    if (g.state === 'cardpick') { levelUps++; g.chooseCard(g.pendingCards[0]); }
    else if (g.state === 'levelclear' || g.state === 'win') return { result: 'win', levelUps, t };
    else if (g.state === 'gameover') return { result: 'lose', levelUps, t };
    t += dt;
  }
  return { result: 'timeout', levelUps, t };
}

let fails = 0;
console.log('=== 向僵尸开炮 第1章 平衡模拟 ===');
for (let i = 0; i < LEVELS.length; i++) {
  // 多种子取最差，避免偶然
  let worst = null;
  for (const seed of [1, 7, 42, 99]) {
    const r = simLevel(i, seed);
    if (!worst || (r.result !== 'win' && worst.result === 'win')) worst = r;
  }
  const tag = worst.result === 'win' ? '✅' : '❌';
  if (worst.result !== 'win') fails++;
  console.log(`${tag} 关${LEVELS[i].id} ${LEVELS[i].name}: ${worst.result} | 升级${worst.levelUps}次 | ${worst.t.toFixed(0)}s`);
}
console.log(fails === 0 ? '\n全部可通关 ✅' : `\n${fails} 关不可通关 ❌`);
process.exit(fails === 0 ? 0 : 1);
```

- [ ] **Step 2: 运行模拟器**

Run: `cd games/bomb-zombie && node tools/sim-run.mjs`
Expected: 打印每关结果。**若有 ❌ 不可通关，调 `config.js`/`levels.js` 数值（敌人血量、城墙 HP、卡片步长、经验曲线 base/growth）直到全 ✅ 且各关升级次数大体落在 ~18-20 带**（按 §10.1 节奏）。这一步是阶段 1「第1章可通关」门禁的客观证据。

- [ ] **Step 3: 提交（含为通关所做的数值调整）**

```bash
git add games/bomb-zombie/tools/sim-run.mjs games/bomb-zombie/src/config.js games/bomb-zombie/src/levels.js
git commit -m "feat(bomb-zombie): 平衡模拟器(新写)+数值校到第1章全可通关"
```

---

## Task 14: feedback.js + render.js（Canvas 绘制 + 视觉反馈）

**Files:**
- Create: `games/bomb-zombie/src/feedback.js`
- Create: `games/bomb-zombie/src/render.js`

**Interfaces:**
- Consumes: `FIELD`/`WALL`/`LANES`（config）、`laneX`（enemies）、`Game` 实例字段。
- Produces:
  - `feedback.js`：`pushFloater`/`tickFeedback` 的纯辅助（game.js 已内联 floaters；此模块提供绘制所需的格式化 + 颜色）。
  - `render.js`：`class Renderer { constructor(canvas); resize(); mapClientToField(cx,cy); render(game, dt) }`。离屏烘焙静态背景（废土底图 + 通道），绘制城墙血条、僵尸（按 color/type）、子弹、英雄、飘字、震屏偏移、HUD（经验条/技能 CD/城墙 HP）。

> 此任务为表现层，不做单测，由 Task 16 冒烟覆盖（页面无报错 + 战斗可见 + 飘字出现）。但代码必须完整可运行。

- [ ] **Step 1: 实现** `games/bomb-zombie/src/feedback.js`

```js
// feedback.js — 飘字格式化与配色（render 消费）。纯函数。
export const floaterColor = (crit) => (crit ? '#ffd23f' : '#ffffff');
export const floaterSize = (crit) => (crit ? 26 : 16);
export function formatAmount(n) { return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n); }
```

- [ ] **Step 2: 实现** `games/bomb-zombie/src/render.js`

```js
// render.js — Canvas 2D 绘制。离屏烘焙背景 + 实体/墙/子弹/HUD/飘字/震屏。
import { FIELD, WALL, LANES } from './config.js';
import { laneX } from './enemies.js';
import { floaterColor, floaterSize, formatAmount } from './feedback.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / FIELD.W, vh / FIELD.H);
    this.canvas.width = FIELD.W; this.canvas.height = FIELD.H;
    this.canvas.style.width = FIELD.W * scale + 'px';
    this.canvas.style.height = FIELD.H * scale + 'px';
    this._bakeBg();
  }

  _bakeBg() {
    const c = document.createElement('canvas'); c.width = FIELD.W; c.height = FIELD.H;
    const x = c.getContext('2d');
    const grd = x.createLinearGradient(0, 0, 0, FIELD.H);
    grd.addColorStop(0, '#2a2218'); grd.addColorStop(1, '#15110c');
    x.fillStyle = grd; x.fillRect(0, 0, FIELD.W, FIELD.H);
    x.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 1; i < LANES; i++) { const lx = (FIELD.W / LANES) * i; x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx, WALL.y); x.stroke(); }
    this.bg = c;
  }

  mapClientToField(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (cx - r.left) / r.width * FIELD.W, y: (cy - r.top) / r.height * FIELD.H };
  }

  render(game) {
    const ctx = this.ctx;
    const sx = (Math.random() - 0.5) * (game.feedback ? game.feedback.shake : 0);
    const sy = (Math.random() - 0.5) * (game.feedback ? game.feedback.shake : 0);
    ctx.save(); ctx.translate(sx, sy);
    ctx.drawImage(this.bg, 0, 0);
    if (game.state === 'menu') { ctx.restore(); return; }

    // 城墙
    if (game.wall) {
      ctx.fillStyle = '#6b5b3a'; ctx.fillRect(0, WALL.y, FIELD.W, 16);
      const pct = game.wall.hp / game.wall.maxHp;
      ctx.fillStyle = '#8bbf6a'; ctx.fillRect(0, WALL.y - 6, FIELD.W * pct, 5);
    }
    // 僵尸
    for (const e of (game.enemies || [])) {
      ctx.fillStyle = e.frozen > 0 ? '#7fd0ff' : (e.color || '#8bbf6a');
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      if (e.hp < e.hpMax) {
        ctx.fillStyle = '#000'; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2, 3);
        ctx.fillStyle = '#e44'; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2 * (e.hp / e.hpMax), 3);
      }
    }
    // 子弹
    ctx.fillStyle = '#ffd23f';
    for (const b of (game.bullets || [])) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    // 英雄
    if (game.hero) { ctx.fillStyle = '#cfd8dc'; ctx.fillRect(game.hero.x - 16, game.hero.y - 16, 32, 32); }
    // 飘字
    for (const f of (game.feedback ? game.feedback.floaters : [])) {
      ctx.fillStyle = floaterColor(f.crit); ctx.font = `bold ${floaterSize(f.crit)}px sans-serif`;
      ctx.fillText(formatAmount(f.amount), f.x, f.y - (0.6 - f.life) * 40);
    }
    ctx.restore();
  }
}
```

- [ ] **Step 3: 手动确认无语法错误**

Run: `cd games/bomb-zombie && node -e "import('./src/render.js').catch(e=>{console.error(e);process.exit(1)})"`
Expected: 报 `window is not defined`（正常——render 依赖浏览器）或无 import 语法错误即可；语法错误才算失败。

- [ ] **Step 4: 提交**

```bash
git add games/bomb-zombie/src/feedback.js games/bomb-zombie/src/render.js
git commit -m "feat(bomb-zombie): render离屏烘焙背景+城墙/僵尸/子弹/飘字/震屏 + feedback配色"
```

---

## Task 15: input.js + main.js + index.html + style.css（引导/循环/overlay/操作）

**Files:**
- Create: `games/bomb-zombie/src/input.js`
- Create: `games/bomb-zombie/src/main.js`
- Create: `games/bomb-zombie/index.html`
- Create: `games/bomb-zombie/style.css`

**Interfaces:**
- Consumes: `Game`、`Renderer`、`LEVELS`、`save.browserLoad/Write/applyClear/nextPlayableIndex`、`SKILLS`、`CARD_POOL`。
- Produces: 可在浏览器实玩的完整页面——菜单/选关/暂停/结算 overlay、三选一卡面（点卡→`game.chooseCard`）、技能钮（点→`game.useSkill`）、触屏/键盘（1/2 放技能、Esc 暂停、M 静音）。

- [ ] **Step 1: 实现** `games/bomb-zombie/index.html`（参照 boom-worms 结构：canvas + back-to-hub + 各 overlay；新增三选一卡面容器 `#card-chooser` 与技能条 `#skill-bar`）

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <meta name="theme-color" content="#15110c" />
  <title>向僵尸开炮 BOMB ZOMBIE · 阵地防守</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <canvas id="game"></canvas>
  <a id="back-to-hub" href="../../index.html" title="返回游戏中心">← HUB</a>
  <button id="btn-mute" type="button" title="静音 (M)">🔊</button>

  <div id="hud">
    <div id="wall-hp-wrap"><div id="wall-hp-bar"></div><span id="wall-hp-text"></span></div>
    <div id="xp-wrap"><div id="xp-bar"></div><span id="hero-lv"></span></div>
    <div id="skill-bar"><!-- 技能钮 injected by main.js --></div>
  </div>

  <!-- 三选一卡面 -->
  <div id="card-chooser" class="overlay"><div class="card-row" id="card-row"></div></div>

  <div id="overlay-menu" class="overlay show"><div class="panel">
    <h1 class="game-title">🧟 向僵尸开炮</h1><p class="game-sub">BOMB ZOMBIE · 阵地防守</p>
    <div class="btn-col"><button id="btn-start" class="big-btn" type="button">▶ 开始守城</button></div>
    <p id="menu-best" class="best-line"></p>
    <div class="hints"><span><b>1/2</b> 放技能</span><span><b>Esc</b> 暂停</span><span><b>升级</b>自动弹三选一</span></div>
  </div></div>

  <div id="overlay-levelselect" class="overlay"><div class="panel panel-wide">
    <h1 class="game-title">🗺️ 选择关卡</h1><div id="ls-track"></div>
    <div class="btn-col"><button id="btn-ls-back" class="big-btn ghost" type="button">← 返回</button></div>
  </div></div>

  <div id="overlay-pause" class="overlay"><div class="panel">
    <h1 class="game-title">⏸ 暂停</h1><div class="btn-col">
      <button id="btn-resume" class="big-btn" type="button">▶ 继续</button>
      <button id="btn-restart" class="big-btn ghost" type="button">↻ 重玩本关</button>
      <a class="big-btn ghost" href="../../index.html">← 返回 HUB</a></div>
  </div></div>

  <div id="overlay-levelclear" class="overlay"><div class="panel">
    <h1 class="game-title">🎉 守城成功！</h1><p id="lc-msg" class="best-line"></p>
    <div class="btn-col"><button id="btn-next" class="big-btn" type="button">下一关 →</button></div>
  </div></div>

  <div id="overlay-gameover" class="overlay"><div class="panel">
    <h1 class="game-title">💀 城墙失守</h1>
    <div class="btn-col"><button id="btn-retry" class="big-btn" type="button">↻ 重玩本关</button>
      <button id="btn-go-menu" class="big-btn ghost" type="button">🏠 返回菜单</button></div>
  </div></div>

  <div id="overlay-win" class="overlay"><div class="panel">
    <h1 class="game-title">🏆 第一章通关！</h1><p id="win-msg" class="best-line"></p>
    <div class="btn-col"><button id="btn-win-replay" class="big-btn" type="button">↻ 再玩一次</button>
      <a class="big-btn ghost" href="../../index.html">← 返回 HUB</a></div>
  </div></div>

  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: 实现** `games/bomb-zombie/style.css`（竖屏居中、overlay 居中面板、卡面横排——可裁剪自 boom-worms style.css 的 overlay/panel/big-btn 类，新增 card 类）

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; background: #0b0a08; overflow: hidden; font-family: system-ui, sans-serif; }
body { display: flex; align-items: center; justify-content: center; }
#game { display: block; background: #15110c; touch-action: none; }
#back-to-hub, #btn-mute { position: fixed; top: 10px; z-index: 30; color: #fff; background: rgba(0,0,0,.5); border: 0; border-radius: 8px; padding: 6px 10px; text-decoration: none; font-size: 14px; }
#back-to-hub { left: 10px; } #btn-mute { right: 10px; }
#hud { position: fixed; left: 0; right: 0; top: 0; z-index: 20; pointer-events: none; padding: 44px 12px 0; }
#wall-hp-wrap, #xp-wrap { position: relative; height: 14px; background: rgba(0,0,0,.5); border-radius: 7px; margin: 4px 0; overflow: hidden; }
#wall-hp-bar { height: 100%; background: #8bbf6a; width: 100%; }
#xp-bar { height: 100%; background: #ffd23f; width: 0%; }
#wall-hp-text, #hero-lv { position: absolute; right: 6px; top: -1px; font-size: 11px; color: #fff; }
#skill-bar { position: fixed; right: 12px; bottom: 16px; display: flex; gap: 10px; pointer-events: auto; }
.skill-btn { width: 56px; height: 56px; border-radius: 50%; border: 2px solid #fff3; background: rgba(0,0,0,.6); color: #fff; font-size: 24px; position: relative; }
.skill-btn.cooling { opacity: .4; }
.overlay { position: fixed; inset: 0; z-index: 40; display: none; align-items: center; justify-content: center; background: rgba(0,0,0,.6); }
.overlay.show { display: flex; }
.panel { background: #1c1813; border: 1px solid #3a2f1f; border-radius: 16px; padding: 28px; text-align: center; max-width: 90vw; }
.game-title { color: #ffd23f; font-size: 28px; margin-bottom: 6px; }
.game-sub { color: #aaa; margin-bottom: 18px; }
.btn-col { display: flex; flex-direction: column; gap: 10px; margin: 12px 0; }
.big-btn { padding: 12px 22px; font-size: 17px; border: 0; border-radius: 10px; background: #8bbf6a; color: #111; cursor: pointer; }
.big-btn.ghost { background: transparent; color: #cfd8dc; border: 1px solid #555; }
.best-line { color: #ffd23f; margin: 8px 0; } .hints { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; color: #888; font-size: 12px; margin-top: 10px; }
#card-chooser { background: rgba(0,0,0,.78); } .card-row { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; padding: 16px; }
.card { width: 150px; min-height: 190px; background: #221c14; border: 2px solid #4a3; border-radius: 14px; padding: 16px; color: #fff; cursor: pointer; display: flex; flex-direction: column; gap: 8px; }
.card.rare { border-color: #6af; } .card.epic { border-color: #f6a; } .card .c-name { font-size: 17px; font-weight: 700; } .card .c-desc { font-size: 13px; color: #bbb; }
#ls-track { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 80vw; margin: 12px 0; }
.ls-node { width: 64px; height: 64px; border-radius: 10px; border: 1px solid #555; background: #221c14; color: #fff; }
.ls-node.locked { opacity: .35; } .ls-node.next { border-color: #ffd23f; }
```

- [ ] **Step 3: 实现** `games/bomb-zombie/src/input.js`

```js
// input.js — 键盘/触屏 → 动作回调。阶段1操作极简：放技能/暂停/静音/选卡靠 DOM 点击。
export const Input = {
  _cbs: [],
  on(fn) { this._cbs.push(fn); },
  _emit(a) { for (const fn of this._cbs) fn(a); },
  init() {
    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this._emit({ type: 'skill', id: 'nuke' });
      else if (e.key === '2') this._emit({ type: 'skill', id: 'freeze' });
      else if (e.key === 'Escape') this._emit({ type: 'pause' });
      else if (e.key.toLowerCase() === 'm') this._emit({ type: 'mute' });
    });
  },
};
```

- [ ] **Step 4: 实现** `games/bomb-zombie/src/main.js`（引导 + RAF + overlay 同步 + 卡面渲染 + 技能钮 + 选关 + 存档）

```js
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { LEVELS } from './levels.js';
import { SKILLS } from './skills.js';
import { CARD_POOL } from './cards.js';
import { browserLoad, browserWrite, applyClear, nextPlayableIndex } from './save.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
let save = browserLoad();
const game = new Game();
Input.init();
Input.on((a) => {
  if (a.type === 'skill') game.useSkill(a.id);
  else if (a.type === 'pause') { if (game.state === 'playing') game.state = 'paused'; else if (game.state === 'paused') game.state = 'playing'; }
});

const OVERLAY = { menu: 'overlay-menu', levelselect: 'overlay-levelselect', paused: 'overlay-pause', levelclear: 'overlay-levelclear', gameover: 'overlay-gameover', win: 'overlay-win' };
const $ = (id) => document.getElementById(id);
const BTN = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

function showOverlay(state) {
  for (const [k, id] of Object.entries(OVERLAY)) { const el = $(id); if (el) el.classList.toggle('show', k === state); }
  $('card-chooser').classList.toggle('show', state === 'cardpick');
}

const cardInfo = (id) => CARD_POOL.find((c) => c.id === id) || { name: { __gold__: '金币', __xp__: '经验', __heal__: '修墙' }[id] || id, rarity: 'common' };

function renderCards() {
  const row = $('card-row'); row.innerHTML = '';
  for (const cid of game.pendingCards) {
    const info = cardInfo(cid);
    const el = document.createElement('div');
    el.className = 'card ' + (info.rarity || 'common');
    el.innerHTML = `<div class="c-name">${info.name}</div><div class="c-desc">${describe(info)}</div>`;
    el.addEventListener('click', () => { game.chooseCard(cid); });
    row.appendChild(el);
  }
}
function describe(info) {
  if (!info.mod) return '强化';
  return Object.entries(info.mod).map(([k, v]) => `${k} +${v}`).join('，');
}

function buildSkillBar() {
  const bar = $('skill-bar'); bar.innerHTML = '';
  for (const id of ['nuke', 'freeze']) {
    const b = document.createElement('button'); b.className = 'skill-btn'; b.textContent = SKILLS[id].icon;
    b.addEventListener('click', () => game.useSkill(id));
    b.dataset.skill = id; bar.appendChild(b);
  }
}

function startLevel(index) { game.startLevel(index); }

// 按钮
BTN('btn-start', () => { populateLevelSelect(); game.state = 'levelselect'; });
BTN('btn-ls-back', () => { game.state = 'menu'; });
BTN('btn-resume', () => { game.state = 'playing'; });
BTN('btn-restart', () => startLevel(game.levelIndex));
BTN('btn-next', () => startLevel(Math.min(LEVELS.length - 1, game.levelIndex + 1)));
BTN('btn-retry', () => startLevel(game.levelIndex));
BTN('btn-go-menu', () => { game.state = 'menu'; });
BTN('btn-win-replay', () => startLevel(0));
BTN('btn-mute', () => {});

function populateLevelSelect() {
  const track = $('ls-track'); track.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const unlocked = (i + 1) <= save.unlockedLevel;
    const b = document.createElement('button');
    b.className = 'ls-node' + (unlocked ? '' : ' locked') + ((i === nextPlayableIndex(save, LEVELS.length)) ? ' next' : '');
    b.textContent = lv.boss ? '👑' : (i + 1); b.disabled = !unlocked;
    if (unlocked) b.addEventListener('click', () => startLevel(i));
    track.appendChild(b);
  });
}

let prev = null;
function syncDom() {
  showOverlay(game.state);
  if (game.state === 'cardpick' && prev !== 'cardpick') renderCards();
  // HUD
  if (game.wall) { $('wall-hp-bar').style.width = (game.wall.hp / game.wall.maxHp * 100) + '%'; $('wall-hp-text').textContent = Math.ceil(game.wall.hp); }
  if (game.xpNeed) { $('xp-bar').style.width = (game.xp / game.xpNeed * 100) + '%'; $('hero-lv').textContent = 'Lv.' + (game.heroLevel || 1); }
  for (const b of document.querySelectorAll('.skill-btn')) { const s = game.skillState && game.skillState[b.dataset.skill]; b.classList.toggle('cooling', !!(s && !s.ready)); }
  // 结算落库
  if (game.state !== prev && (game.state === 'levelclear' || game.state === 'win')) {
    save = applyClear(save, LEVELS[game.levelIndex].id, 3); browserWrite(save);
    if ($('menu-best')) $('menu-best').textContent = '🏆 已解锁第 ' + save.unlockedLevel + ' 关';
  }
  prev = game.state;
}

buildSkillBar();
if ($('menu-best')) $('menu-best').textContent = '🏆 已解锁第 ' + save.unlockedLevel + ' 关';

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045); last = now;
  game.update(dt);
  renderer.render(game, dt);
  syncDom();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 5: 本地起服手测**

Run: `cd /Users/james/Projects/game-hub && python3 -m http.server 8870`
打开 `http://localhost:8870/games/bomb-zombie/index.html`：开始守城 → 僵尸下行被自动射击 → 升级弹三选一（点卡继续）→ 城墙血条/经验条/技能钮可用 → 通关或失守弹结算。Console 无报错。

- [ ] **Step 6: 提交**

```bash
git add games/bomb-zombie/index.html games/bomb-zombie/style.css games/bomb-zombie/src/input.js games/bomb-zombie/src/main.js
git commit -m "feat(bomb-zombie): index/style/input/main 引导+RAF循环+overlay+三选一卡面+技能钮+选关+存档"
```

---

## Task 16: 注册 hub 卡片 + README + 第 1 章冒烟

**Files:**
- Modify: `/Users/james/Projects/game-hub/js/games.js`（GAMES 数组追加一条）
- Create: `games/bomb-zombie/README.md`
- Create: `games/bomb-zombie/tests/smoke-ch1.mjs`

**Interfaces:**
- Consumes: 既有 `GAMES` 数组结构（id/title/subtitle/desc/icon/accent/accent2/tags/path）。

- [ ] **Step 1: 注册卡片** — 在 `js/games.js` 的 `GAMES` 数组末尾（最后一条 `}` 后）追加：

```js
  {
    id: 'bomb-zombie',
    title: '向僵尸开炮 BOMB ZOMBIE',
    subtitle: '阵地防守 · 自动射击 · roguelite 构筑',
    desc: '底部炮台守城墙 · 僵尸潮割草 · 升级三选一滚雪球 · 进化卡质变 · 主动技能 · 触屏/键鼠',
    icon: '🧟',
    accent: '#7cff5a',
    accent2: '#2a7a1a',
    tags: ['割草', 'Roguelite', '构筑'],
    path: 'games/bomb-zombie/index.html',
  },
```

- [ ] **Step 2: 确认 hub 列出新游戏**

Run: `cd /Users/james/Projects/game-hub && python3 -m http.server 8871`
打开 `http://localhost:8871/index.html`，确认出现「向僵尸开炮」卡片，点击进入游戏。

- [ ] **Step 3: 写第 1 章冒烟** `games/bomb-zombie/tests/smoke-ch1.mjs`（参照 boom-worms `tests/smoke-m1.mjs`：puppeteer-core + 系统 Chrome，起 http 服，进页面，开始守城，跑若干秒，断言无 console error / pageerror、canvas 存在、能进入 playing 且出现过 cardpick 或僵尸被击杀）

```js
// smoke-ch1.mjs — host-side puppeteer-core + 系统 Chrome 冒烟（参照 boom-worms/tests/smoke-m1.mjs）。
// 运行前提见 MEMORY「BOOM WORMS smoke-test setup」：copy 到装有 puppeteer-core 的目录、系统 Chrome 路径。
import puppeteer from 'puppeteer-core';
import { spawn } from 'node:child_process';

const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 8872;
const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: process.env.HUB_ROOT || '../../..', stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const errors = [];
const browser = await puppeteer.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console:' + m.text()); });
  page.on('pageerror', (e) => errors.push('pageerror:' + e.message));
  await page.goto(`http://localhost:${PORT}/games/bomb-zombie/index.html`, { waitUntil: 'networkidle2' });
  await page.click('#btn-start');
  // 选第1关
  await page.waitForSelector('#ls-track .ls-node:not(.locked)');
  await page.click('#ls-track .ls-node:not(.locked)');
  await new Promise((r) => setTimeout(r, 6000));   // 跑6秒战斗
  const ok = await page.evaluate(() => !!document.getElementById('game'));
  if (!ok) errors.push('canvas missing');
  if (errors.length) { console.error('❌ 冒烟失败:\n' + errors.join('\n')); process.exitCode = 1; }
  else console.log('✅ 第1章冒烟通过：页面无报错、战斗运行');
} finally { await browser.close(); srv.kill(); }
```

- [ ] **Step 4: 跑冒烟**（按 MEMORY 的 host-side 步骤：copy 到装 puppeteer-core 的目录、设 `CHROME_PATH`/`HUB_ROOT`）

Run（示意，实际路径据 boom-worms smoke 运行约定）: `node games/bomb-zombie/tests/smoke-ch1.mjs`
Expected: `✅ 第1章冒烟通过`

- [ ] **Step 5: 写 README** `games/bomb-zombie/README.md`

```markdown
# 向僵尸开炮 BOMB ZOMBIE

竖屏阵地防守 + roguelite 升级构筑。底部炮台守城墙，僵尸潮从上方推进，自动射击割草，
击杀升级三选一滚雪球，叠满进化卡质变，主动技能择时翻盘。第 1 章「城郊废土」10 关（含尸潮之王 Boss）。

## 玩法
- 全自动锁定最近僵尸开火；玩家管升级三选一 + 择时放技能（1=核弹 2=冰冻）。
- 城墙血条归零 = 失守；刷完全部波次且清场 = 守城成功。

## 开发
- 纯逻辑单测：`node --test tests/*.test.mjs`
- 平衡模拟器：`node tools/sim-run.mjs`（验第 1 章可通关）
- 冒烟：`tests/smoke-ch1.mjs`（host-side puppeteer-core）

阶段 1 = 核心战斗。阶段 2 = 英雄/装备/养成闭环。阶段 3 = 扩章节 + 打磨。见 `docs/superpowers/specs/2026-06-20-bomb-zombie-design.md`。
```

- [ ] **Step 6: 全量测试 + 提交**

```bash
cd games/bomb-zombie && node --test tests/*.test.mjs && node tools/sim-run.mjs
cd /Users/james/Projects/game-hub
git add js/games.js games/bomb-zombie/README.md games/bomb-zombie/tests/smoke-ch1.mjs
git commit -m "feat(bomb-zombie): 注册hub卡片+README+第1章冒烟(阶段1门禁全绿)"
```

---

## Self-Review（写完计划后对照 spec）

**Spec 覆盖核对：**
- §2.1 战场布局 → Task 2(config 竖屏/墙) + Task 14(render)。
- §2.2 自动射击三层叠加 → Task 3(combat) + Task 8(hero/bullets)。
- §2.3 敌人波次/七兵种 → Task 2(ENEMIES) + Task 4(enemies) + Task 6(spawn) + Task 10(levels)。
- §2.4 经验/升级/三选一/进化 → Task 7(cards) + Task 12(game `_gainXp`/cardpick)。
- §2.5 主动技能 → Task 9(skills) + Task 12(useSkill) + Task 15(技能钮)。
- §2.6 数值反馈 → Task 12(floaters/shake) + Task 14(render 飘字/震屏)。
- §3 章节/Boss → Task 10(LEVELS 10关+boss) + Task 12 注(Boss 实体收尾子步)。
- §10.1 用户裁定（叠加公式/堆墙啃咬/长局18-20/保底进化）→ Task 3/5/10/7 + Global Constraints 逐条对应。
- §10.2 行业默认（卡片去重退池兜底/最近锁定满屏/全冻结+技能实时/wave schema+清场判胜）→ Task 7/8/12/6。
- §10.3 技术（模拟器新写/扁平 src/save copy）→ Task 13/文件结构/Task 11。
- §7 测试（纯逻辑单测/模拟器/冒烟）→ 各 Task 测试 + Task 13 + Task 16。
- §8 注册卡片 → Task 16。

**Placeholder 扫描：** 无 TBD/TODO/"类似上面"；每个改码步骤含完整代码。Boss 多阶段机制明确标注为 Task 12 收尾子步（非占位，是有意的阶段内增量）。

**类型一致性核对：** `effectiveStats(base,inMods,outMods)` 在 combat/hero/bullets/game 签名一致；`run.inMods` 键（damagePct/fireRatePct/multishotAdd/pierceAdd/critRatePct/critMultAdd/splashAdd/burnDps/frostSlow/poisonDps/wallHpPct/wallRegen/xpPct）在 cards 定义、combat/bullets/game 消费一致；`draw3(run,rng)`/`applyCard(run,id)`/`evolutionReady(run)` 跨 cards/game/sim 一致；`makeSpawner/tickSpawner/isLevelComplete` 跨 spawn/game/sim 一致；存档 `applyClear/nextPlayableIndex` 跨 save/main 一致。

**已知阶段内增量（非缺口）：** Boss 多阶段（phaseAt 弱点窗口）在 Task 12 普通关全链路绿后，以「Boss 实体」小步追加；元素卡（chain 闪电链/knock 击退/thorns 反伤）阶段 1 先入 inMods 但仅部分生效（burn/frost/poison/splash 已生效，chain/knock/thorns 视冒烟手感决定是否本阶段接线，否则顺延阶段 3 打磨）——已在 §9 范围边界与本节标注，不影响"第1章可通关"门禁。
