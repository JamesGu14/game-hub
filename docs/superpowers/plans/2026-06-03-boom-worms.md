# 炮炮虫 BOOM WORMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a kid-friendly (7yo) turn-based artillery game in the style of Worms (百战天虫) — destructible terrain, device-adaptive aiming, single-player campaign vs AI plus 2-player hotseat, 6 themed levels — as a self-contained game in `games/boom-worms/`.

**Architecture:** Vanilla JS + ES Modules + Canvas 2D, **no build step** (mirrors `games/jungle-blitz`). Pure logic (trajectory, terrain mask, explosion damage, AI aim solver, turn rotation) lives in DOM-free modules tested with `node:test`. A `Game` class holds a turn state machine; `Renderer`, `Input`, `Sound` are thin DOM/Canvas/WebAudio adapters driven from `main.js` via a RAF loop. Terrain is a destructible bitmap: a `Uint8Array` collision mask kept in lock-step with an offscreen canvas that explosions carve with `destination-out`.

**Tech Stack:** HTML5 Canvas 2D, ES Modules, Web Audio API, Gamepad API, Pointer events, `node:test` + `node:assert/strict`. No dependencies, no bundler.

**Reference patterns (read before starting):** `games/jungle-blitz/src/main.js` (RAF loop + overlay sync + button wiring), `games/jungle-blitz/src/audio.js` (`Sound` singleton + `tone()`), `games/jungle-blitz/tests/math.test.mjs` (test style), `games/jungle-blitz/src/util/math.js` (pure util style), `js/games.js` (hub registry entry).

**Spec:** `docs/superpowers/specs/2026-06-03-boom-worms-design.md`

---

## File Structure & Responsibilities

| File | Responsibility | Unit-tested? |
|---|---|---|
| `games/boom-worms/index.html` | Canvas, back-to-hub, mute btn, overlays (menu/pause/levelclear/gameover/win) | manual |
| `games/boom-worms/style.css` | Layout, overlays, HUD, weapon bar, power bar | manual |
| `games/boom-worms/README.md` | How to run, controls, structure | — |
| `src/config.js` | Pure data: FIELD, PHYSICS, WORM, WATER, WEAPONS, AIM, CRATE, SCORE, STORAGE_KEY | imported by tests |
| `src/util/math.js` | `clamp,lerp,dist,angleOf,toRad,toDeg,vecFromAngle` | ✅ |
| `src/util/trajectory.js` | `stepBallistic`, `simulate` (ballistic integration + hit test) | ✅ |
| `src/combat.js` | `explosionDamage`, `applyExplosion`, `drowned` | ✅ |
| `src/terrain.js` | `Terrain` (Uint8Array mask + offscreen canvas): `solidAt/carve/groundY/generate/draw` | mask logic ✅ |
| `src/worm.js` | `makeWorm`, `makeTeam` factories | ✅ (factories) |
| `src/physics.js` | `stepWorm` (gravity, mask collision, walls, water-out) | ✅ |
| `src/turns.js` | `nextActive`, `aliveTeams`, `checkOutcome` (pure turn rotation) | ✅ |
| `src/ai.js` | `solveAim`, `jitterAim` (pure) + `AIController.takeTurn` (drives game) | solver ✅ |
| `src/levels.js` | `LEVELS` data + `buildLevel(index)` | ✅ |
| `src/weapons.js` | fire dispatch: turn aim+power+weapon into projectile(s)/hitscan/melee | manual |
| `src/projectile.js` | live projectile objects: integrate, bounce, fuse, collide, explode→carve+damage | manual |
| `src/aim.js` | aim angle + charge state; device-adaptive (mouse dir vs angle keys) | manual |
| `src/input.js` | keyboard / mouse(pointer) / gamepad → action events + aim signals | manual |
| `src/game.js` | `Game` state machine: teams, turn flow, crates, win/lose, level load, localStorage | turn glue manual |
| `src/render.js` | `Renderer`: draw bg/terrain/worms/projectiles/effects/HUD/aim/power/wind | manual |
| `src/audio.js` | `Sound` singleton (charge/fire/explode/splash/pickup/jump/win/lose/ui) | manual |
| `src/main.js` | bootstrap, RAF loop, overlay sync, button + mode wiring | manual |
| `tests/*.test.mjs` | node:test for the ✅ rows | — |

**Implementation order:** pure logic first (Tasks 1–8, fully TDD), then canvas/render/glue (Tasks 9–15), then integration + hub (Task 16). Each task ends with a commit.

---

## Shared Data Shapes (use these names everywhere — type consistency)

```js
// Worm
{ id: number, team: 0|1, x: number, y: number, vx: number, vy: number,
  hp: number, facing: 1|-1, alive: boolean, onGround: boolean }

// Team
{ id: 0|1, name: string, color: string, isAI: boolean,
  worms: Worm[], ammo: { [weaponKey:string]: number } }   // Infinity allowed

// Projectile (live)
{ kind: string, x, y, vx, vy, fuse: number, r: number, ownerTeam: 0|1, dead: boolean }

// Level (from buildLevel)
{ index, name, theme, terrainParams, spawns: { 0:number[], 1:number[] },
  enemyCount: number, aiError: number, wind: number, waterY: number }

// Aim solution
{ angle: number /*radians, 0=right, -PI/2=up*/, speed: number /*px/s*/ }
```

---

## Task 1: Scaffold + config + math utils

**Files:**
- Create: `games/boom-worms/index.html`, `games/boom-worms/style.css`, `games/boom-worms/README.md`
- Create: `games/boom-worms/src/config.js`, `games/boom-worms/src/util/math.js`
- Test: `games/boom-worms/tests/math.test.mjs`

- [ ] **Step 1: Create `src/config.js`** (pure data, no DOM):

```js
// Tunable constants for 炮炮虫 BOOM WORMS. Pure data — importable by node:test.
export const FIELD = { W: 960, H: 540 };

export const PHYSICS = {
  wormGravity: 1300,   // px/s^2 on worms
  moveSpeed: 85,       // px/s walk
  jumpVel: -360,       // px/s
  maxFall: 820,
  projGravity: 480,    // px/s^2 on projectiles
};

export const WORM = { w: 24, h: 30, r: 14, hpMax: 100 };

export const WATER = { defaultY: 512 };  // worm center below this => drowned

// power (hold) maps linearly to projectile launch speed
export const AIM = {
  minSpeed: 180, maxSpeed: 720, // px/s
  chargeSeconds: 1.2,           // hold time from min->max
  angleStepRad: 1.4,            // radians/sec when adjusting angle by key/pad
};

export const WEAPONS = {
  bazooka:   { name: '火箭筒', icon: '🚀', kind: 'projectile', dmg: 45, radius: 46, windAffected: true,  ammo: Infinity, color: '#ffd23f' },
  grenade:   { name: '手雷',   icon: '💣', kind: 'grenade',    dmg: 40, radius: 42, fuse: 3, bounce: 0.5, windAffected: false, ammo: Infinity, color: '#6bbf59' },
  dynamite:  { name: '炸药',   icon: '🧨', kind: 'dynamite',   dmg: 60, radius: 60, fuse: 3.5, ammo: 3, color: '#e8453c' },
  shotgun:   { name: '霰弹枪', icon: '🔫', kind: 'hitscan',    dmg: 25, radius: 16, shots: 2, range: 260, ammo: 3, color: '#cfd8dc' },
  firepunch: { name: '飞拳',   icon: '👊', kind: 'melee',      dmg: 30, range: 40, knockUp: -360, knockX: 220, safe: true, ammo: 3, color: '#ff8a3c' },
  airstrike: { name: '空袭',   icon: '✈️', kind: 'airstrike',  dmg: 25, radius: 30, bombs: 5, ammo: 0, color: '#9aa0a6' },
  holy:      { name: '圣手雷', icon: '🐑', kind: 'grenade',    dmg: 90, radius: 82, fuse: 3, bounce: 0.4, windAffected: false, ammo: 0, color: '#ffffff' },
};
// Weapons selectable from the bar (others arrive only via crates).
export const STARTING_WEAPONS = ['bazooka', 'grenade', 'dynamite', 'shotgun', 'firepunch'];
export const CRATE_WEAPONS = ['airstrike', 'holy', 'dynamite', 'shotgun'];

export const CRATE = { dropChance: 0.45, healAmount: 30, w: 26, h: 26 };
export const SCORE = { levelClear: 1000, win: 5000 };
export const STORAGE_KEY = 'boom-worms-progress';
```

- [ ] **Step 2: Write `tests/math.test.mjs` (failing)**:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, dist, angleOf, toRad, toDeg, vecFromAngle } from '../src/util/math.js';

test('clamp & lerp', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('dist', () => {
  assert.equal(dist(0, 0, 3, 4), 5);
});

test('angleOf / vecFromAngle round-trip', () => {
  assert.ok(Math.abs(angleOf(1, 0) - 0) < 1e-9);
  assert.ok(Math.abs(angleOf(0, 1) - Math.PI / 2) < 1e-9);
  const v = vecFromAngle(0, 10);
  assert.ok(Math.abs(v.x - 10) < 1e-9 && Math.abs(v.y) < 1e-9);
  const up = vecFromAngle(-Math.PI / 2, 5);
  assert.ok(Math.abs(up.x) < 1e-9 && Math.abs(up.y + 5) < 1e-9);
});

test('toRad / toDeg', () => {
  assert.ok(Math.abs(toRad(180) - Math.PI) < 1e-9);
  assert.ok(Math.abs(toDeg(Math.PI) - 180) < 1e-9);
});
```

- [ ] **Step 3: Run — verify fail.** `cd games/boom-worms && node --test tests/math.test.mjs` → FAIL (module/exports missing).

- [ ] **Step 4: Write `src/util/math.js`**:

```js
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angleOf = (dx, dy) => Math.atan2(dy, dx);
export const toRad = (deg) => (deg * Math.PI) / 180;
export const toDeg = (rad) => (rad * 180) / Math.PI;
export const vecFromAngle = (angle, mag = 1) => ({ x: Math.cos(angle) * mag, y: Math.sin(angle) * mag });
```

- [ ] **Step 5: Run — verify pass.** `node --test tests/math.test.mjs` → PASS.

- [ ] **Step 6: Create `index.html`** — copy the structure of `games/jungle-blitz/index.html` but with BOOM WORMS overlays. Minimum required IDs (panels filled in Task 14): `#game` (canvas), `#back-to-hub` (`href="../../index.html"`), `#btn-mute`, `#hud` container, `#weapon-bar`, `#overlay-menu`, `#overlay-pause`, `#overlay-levelclear`, `#overlay-gameover`, `#overlay-win`, and a `#turn-banner`. Title `<title>炮炮虫 BOOM WORMS · 回合制炮战</title>`. Script: `<script type="module" src="src/main.js"></script>`. Stub overlays with just a title `<h1>` for now.

- [ ] **Step 7: Create `style.css`** — minimal: full-bleed dark bg, centered canvas scaled to fit, `.overlay{display:none}` / `.overlay.show{display:flex}`, basic `#back-to-hub` / `#btn-mute` top corners. Polished in Task 14.

- [ ] **Step 8: Create `README.md`** — stub (title, one-line desc, "see spec"). Filled in Task 16.

- [ ] **Step 9: Commit.**
```bash
git add games/boom-worms
git commit -m "feat(boom-worms): scaffold + config + math utils (TDD)"
```

---

## Task 2: Ballistic trajectory (pure)

**Files:** Create `src/util/trajectory.js`; Test `tests/trajectory.test.mjs`

- [ ] **Step 1: Write `tests/trajectory.test.mjs` (failing):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepBallistic, simulate } from '../src/util/trajectory.js';

test('stepBallistic with no gravity/wind is straight line', () => {
  const s = stepBallistic({ x: 0, y: 0, vx: 100, vy: 0 }, 0.5, 0, 0);
  assert.ok(Math.abs(s.x - 50) < 1e-9);
  assert.ok(Math.abs(s.y) < 1e-9);
  assert.equal(s.vx, 100);
});

test('gravity pulls down (y grows), wind pushes x-velocity', () => {
  const s = stepBallistic({ x: 0, y: 0, vx: 0, vy: 0 }, 1, 500, 40);
  assert.ok(s.vy > 0 && s.y > 0);   // fell down
  assert.ok(s.vx > 0 && s.x > 0);   // wind pushed right
});

test('simulate returns arc and stops at hitTest', () => {
  // flat ground at y=100; fire up-right, should come back down and hit
  const hit = (x, y) => y >= 100;
  const r = simulate({ x: 0, y: 90 }, { x: 60, y: -120 }, { gravity: 500, wind: 0, dt: 1 / 60, maxSteps: 2000 }, hit);
  assert.equal(r.hit, true);
  assert.ok(r.last.y >= 100);
  assert.ok(r.points.length > 2);
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Write `src/util/trajectory.js`:**

```js
// Pure ballistic integration. No DOM. gravity & wind are accelerations (px/s^2).
export function stepBallistic(s, dt, gravity, wind) {
  const vx = s.vx + wind * dt;
  const vy = s.vy + gravity * dt;
  return { x: s.x + vx * dt, y: s.y + vy * dt, vx, vy };
}

// Trace a trajectory until hitTest(x,y)->true or maxSteps. Returns {points, last, hit}.
export function simulate(start, vel, { gravity, wind, dt, maxSteps }, hitTest) {
  let s = { x: start.x, y: start.y, vx: vel.x, vy: vel.y };
  const points = [{ x: s.x, y: s.y }];
  for (let i = 0; i < maxSteps; i++) {
    s = stepBallistic(s, dt, gravity, wind);
    points.push({ x: s.x, y: s.y });
    if (hitTest(s.x, s.y)) return { points, last: s, hit: true };
  }
  return { points, last: s, hit: false };
}
```

- [ ] **Step 4: Run — verify pass.**
- [ ] **Step 5: Commit** `feat(boom-worms): ballistic trajectory module (TDD)`.

---

## Task 3: Terrain mask (pure carve/collision)

**Files:** Create `src/terrain.js` (mask portion only this task); Test `tests/terrain.test.mjs`

The collision mask is a `Uint8Array` of size `w*h` (1=solid, 0=air) at terrain resolution = FIELD size. This task builds ONLY the pure mask logic (no canvas). Canvas rendering + generation are added in Task 9.

- [ ] **Step 1: Write `tests/terrain.test.mjs` (failing):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMask, solidAt, carve, fillRect, groundY } from '../src/terrain.js';

test('fillRect makes cells solid; solidAt reads them', () => {
  const m = createMask(20, 20);
  fillRect(m, 5, 10, 10, 5); // x,y,w,h
  assert.equal(solidAt(m, 6, 11), 1);
  assert.equal(solidAt(m, 0, 0), 0);
  assert.equal(solidAt(m, -1, 5), 1); // out of bounds x => treated solid wall
  assert.equal(solidAt(m, 5, -1), 0); // above top => air
});

test('carve clears a circle of cells', () => {
  const m = createMask(40, 40);
  fillRect(m, 0, 0, 40, 40);
  carve(m, 20, 20, 6);
  assert.equal(solidAt(m, 20, 20), 0);   // center cleared
  assert.equal(solidAt(m, 20, 14), 0);   // edge within r
  assert.equal(solidAt(m, 0, 0), 1);     // far corner intact
});

test('groundY finds first solid scanning down from y', () => {
  const m = createMask(10, 100);
  fillRect(m, 0, 60, 10, 40); // solid from y=60 down
  assert.equal(groundY(m, 5, 0), 60);
  assert.equal(groundY(m, 5, 80), 80);   // already inside solid -> returns y
  const none = createMask(10, 10);
  assert.equal(groundY(none, 5, 0), null);
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Write the mask core in `src/terrain.js`:**

```js
// Destructible terrain. Pure mask helpers here; canvas generate/draw added in Task 9.
export function createMask(w, h) {
  return { w, h, cells: new Uint8Array(w * h) };
}
// Out-of-bounds: left/right/bottom are solid walls; above-top is air.
export function solidAt(m, x, y) {
  x = x | 0; y = y | 0;
  if (y < 0) return 0;
  if (x < 0 || x >= m.w || y >= m.h) return 1;
  return m.cells[y * m.w + x];
}
export function setCell(m, x, y, v) {
  if (x < 0 || x >= m.w || y < 0 || y >= m.h) return;
  m.cells[y * m.w + x] = v;
}
export function fillRect(m, x, y, w, h) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setCell(m, i, j, 1);
}
export function carve(m, cx, cy, r) {
  const r2 = r * r;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (i * i + j * j <= r2) setCell(m, (cx + i) | 0, (cy + j) | 0, 0);
  }
}
// First solid y at/under (x, fromY). null if none.
export function groundY(m, x, fromY) {
  for (let y = Math.max(0, fromY | 0); y < m.h; y++) if (solidAt(m, x, y)) return y;
  return null;
}
```

- [ ] **Step 4: Run — verify pass.**
- [ ] **Step 5: Commit** `feat(boom-worms): destructible terrain mask (TDD)`.

---

## Task 4: Explosion damage + drowning (pure)

**Files:** Create `src/combat.js`; Test `tests/combat.test.mjs`

- [ ] **Step 1: Write `tests/combat.test.mjs` (failing):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explosionDamage, applyExplosion, drowned } from '../src/combat.js';

test('explosionDamage: full at center, 0 at/after radius, linear between', () => {
  assert.equal(explosionDamage(0, 50, 40), 40);
  assert.equal(explosionDamage(50, 50, 40), 0);
  assert.equal(explosionDamage(60, 50, 40), 0);
  assert.equal(explosionDamage(25, 50, 40), 20);
});

test('applyExplosion damages worms in radius and returns hits with knockback', () => {
  const worms = [
    { id: 1, x: 100, y: 100, vx: 0, vy: 0, hp: 100, alive: true },
    { id: 2, x: 300, y: 100, vx: 0, vy: 0, hp: 100, alive: true },
  ];
  const hits = applyExplosion(worms, 110, 100, 50, 40, 1);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 1);
  assert.ok(worms[0].hp < 100);     // took damage
  assert.ok(worms[0].vx < 0);       // knocked left (away from blast at x=110)
  assert.equal(worms[1].hp, 100);   // out of range
});

test('drowned: worm center below waterY', () => {
  assert.equal(drowned({ y: 520, alive: true }, 512), true);
  assert.equal(drowned({ y: 500, alive: true }, 512), false);
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Write `src/combat.js`:**

```js
import { dist } from './util/math.js';

export function explosionDamage(d, radius, maxDmg) {
  if (d >= radius) return 0;
  return Math.round(maxDmg * (1 - d / radius));
}

// Mutates worm hp/vx/vy. Returns [{id, dmg}] for worms actually hit.
export function applyExplosion(worms, cx, cy, radius, maxDmg, knockScale = 1) {
  const hits = [];
  for (const w of worms) {
    if (!w.alive) continue;
    const d = dist(cx, cy, w.x, w.y);
    const dmg = explosionDamage(d, radius, maxDmg);
    if (dmg <= 0) continue;
    w.hp = Math.max(0, w.hp - dmg);
    const push = (1 - d / radius) * 260 * knockScale;
    const ang = Math.atan2(w.y - cy, w.x - cx);
    w.vx += Math.cos(ang) * push;
    w.vy += Math.sin(ang) * push - 120 * (1 - d / radius); // slight upward pop
    hits.push({ id: w.id, dmg });
  }
  return hits;
}

export const drowned = (w, waterY) => w.y >= waterY;
```

- [ ] **Step 4: Run — verify pass.**
- [ ] **Step 5: Commit** `feat(boom-worms): explosion damage + drowning (TDD)`.

---

## Task 5: AI aim solver (pure)

**Files:** Create `src/ai.js` (pure solver portion this task; `AIController` in Task 15); Test `tests/ai.test.mjs`

`solveAim` picks a launch angle+speed so a ballistic shot from `(sx,sy)` lands near `(tx,ty)`. Strategy: search candidate angles, for each binary-search the speed, simulate, keep the closest landing. Deterministic (no Math.random). `jitterAim` adds difficulty error via an **injected** rng `() => [0,1)` so tests are deterministic.

- [ ] **Step 1: Write `tests/ai.test.mjs` (failing):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveAim, jitterAim } from '../src/ai.js';
import { simulate } from '../src/util/trajectory.js';
import { dist } from '../src/util/math.js';

const G = 480;

test('solveAim produces a shot landing within 24px of target (no wind)', () => {
  const sx = 100, sy = 300, tx = 600, ty = 320;
  const sol = solveAim(sx, sy, tx, ty, G, 180, 720);
  assert.ok(sol, 'expected a solution');
  const v = { x: Math.cos(sol.angle) * sol.speed, y: Math.sin(sol.angle) * sol.speed };
  const r = simulate({ x: sx, y: sy }, v,
    { gravity: G, wind: 0, dt: 1 / 120, maxSteps: 4000 },
    (x, y) => x >= tx); // stop when reached target column
  assert.ok(dist(r.last.x, r.last.y, tx, ty) < 24);
});

test('jitterAim with errLevel 0 returns the same solution; nonzero error shifts angle', () => {
  const base = { angle: -0.6, speed: 500 };
  const none = jitterAim(base, 0, () => 0.5);
  assert.equal(none.angle, base.angle);
  assert.equal(none.speed, base.speed);
  const noisy = jitterAim(base, 0.3, () => 0.0); // rng=0 => max negative offset
  assert.ok(Math.abs(noisy.angle - base.angle) > 0);
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Write the pure solver in `src/ai.js`:**

```js
import { vecFromAngle } from './util/math.js';
import { simulate } from './util/trajectory.js';

// Try a fan of angles; for each, binary-search speed to land closest to target.
// Returns {angle, speed} or null. Deterministic.
export function solveAim(sx, sy, tx, ty, gravity, speedMin, speedMax, wind = 0) {
  const dir = tx >= sx ? 1 : -1;
  let best = null, bestErr = Infinity;
  // angles from ~5deg to ~80deg above horizontal, on the target's side
  for (let deg = 5; deg <= 80; deg += 2.5) {
    const angle = dir === 1 ? -deg * Math.PI / 180 : Math.PI + deg * Math.PI / 180;
    let lo = speedMin, hi = speedMax;
    for (let it = 0; it < 22; it++) {
      const speed = (lo + hi) / 2;
      const v = vecFromAngle(angle, speed);
      const r = simulate({ x: sx, y: sy }, v,
        { gravity, wind, dt: 1 / 120, maxSteps: 5000 },
        (x) => (dir === 1 ? x >= tx : x <= tx));
      const err = Math.hypot(r.last.x - tx, r.last.y - ty);
      if (err < bestErr) { bestErr = err; best = { angle, speed }; }
      // if landed above target, need more speed (reach farther before falling)
      if (r.last.y < ty) lo = speed; else hi = speed;
    }
  }
  return best;
}

// errLevel 0..1; rng()->[0,1). errLevel 0 => no change.
export function jitterAim(sol, errLevel, rng) {
  if (errLevel <= 0) return { ...sol };
  const angJit = (rng() - 0.5) * 2 * errLevel * 0.5;     // up to ±0.25 rad at err=1
  const spdJit = 1 + (rng() - 0.5) * 2 * errLevel * 0.4; // up to ±20% at err=1
  return { angle: sol.angle + angJit, speed: sol.speed * spdJit };
}
```

> Note: `jitterAim(base, x, () => 0.5)` always yields no change (rng-0.5=0); the test forces a non-zero offset with `()=>0.0`. Keep the test as written.

- [ ] **Step 4: Run — verify pass.** If `solveAim` error is too high, narrow the angle step (e.g. 2.0) — the test target is reachable; expect PASS.
- [ ] **Step 5: Commit** `feat(boom-worms): AI ballistic aim solver (TDD)`.

---

## Task 6: Worm/team factories + worm physics (pure)

**Files:** Create `src/worm.js`, `src/physics.js`; Test `tests/physics.test.mjs`

- [ ] **Step 1: Write `tests/physics.test.mjs` (failing):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorm, makeTeam } from '../src/worm.js';
import { stepWorm } from '../src/physics.js';
import { createMask, fillRect } from '../src/terrain.js';

test('makeWorm / makeTeam defaults', () => {
  const w = makeWorm(7, 0, 100, 50);
  assert.equal(w.hp, 100);
  assert.equal(w.alive, true);
  const t = makeTeam(0, '红队', '#f00', false, [w]);
  assert.equal(t.worms.length, 1);
  assert.equal(t.isAI, false);
});

test('stepWorm: falls under gravity and rests on solid ground', () => {
  const m = createMask(200, 200);
  fillRect(m, 0, 150, 200, 50);        // ground at y=150
  const w = makeWorm(1, 0, 100, 50);
  for (let i = 0; i < 240; i++) stepWorm(w, 1 / 60, m, { waterY: 512, moveX: 0, wantJump: false });
  assert.ok(w.onGround);
  assert.ok(Math.abs((w.y + 15) - 150) < 3); // feet (~y+halfH) rest near ground top
});

test('stepWorm: below waterY marks not-alive (drowned)', () => {
  const m = createMask(200, 600);
  const w = makeWorm(1, 0, 100, 400);
  for (let i = 0; i < 600; i++) stepWorm(w, 1 / 60, m, { waterY: 512, moveX: 0, wantJump: false });
  assert.equal(w.alive, false);
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Write `src/worm.js`:**

```js
import { WORM } from './config.js';
export function makeWorm(id, team, x, y) {
  return { id, team, x, y, vx: 0, vy: 0, hp: WORM.hpMax, facing: team === 0 ? 1 : -1, alive: true, onGround: false };
}
export function makeTeam(id, name, color, isAI, worms, ammo = {}) {
  return { id, name, color, isAI, worms, ammo };
}
```

- [ ] **Step 4: Write `src/physics.js`:**

```js
import { PHYSICS, WORM } from './config.js';
import { solidAt } from './terrain.js';
import { clamp } from './util/math.js';

const HALF_W = WORM.w / 2, HALF_H = WORM.h / 2;

// Advance one worm. opts: { waterY, moveX(-1..1), wantJump }
export function stepWorm(w, dt, mask, opts) {
  if (!w.alive) return;
  const { waterY, moveX = 0, wantJump = false } = opts;

  // horizontal intent
  w.vx = moveX * PHYSICS.moveSpeed;
  if (moveX !== 0) w.facing = moveX > 0 ? 1 : -1;

  if (wantJump && w.onGround) { w.vy = PHYSICS.jumpVel; w.onGround = false; }

  // gravity
  w.vy = clamp(w.vy + PHYSICS.wormGravity * dt, -2000, PHYSICS.maxFall);

  // integrate X with wall block
  const nx = w.x + w.vx * dt;
  if (!solidAt(mask, nx + Math.sign(w.vx) * HALF_W, w.y)) w.x = nx;
  else w.vx = 0;

  // integrate Y
  const ny = w.y + w.vy * dt;
  if (w.vy >= 0) {
    // falling: check feet
    if (solidAt(mask, w.x, ny + HALF_H)) {
      let gy = ny + HALF_H;
      while (gy > 0 && solidAt(mask, w.x, gy - 1)) gy--; // snap to ground top
      w.y = gy - HALF_H; w.vy = 0; w.onGround = true;
    } else { w.y = ny; w.onGround = false; }
  } else {
    // rising: check head
    if (solidAt(mask, w.x, ny - HALF_H)) w.vy = 0; else w.y = ny;
  }

  // drown
  if (w.y >= waterY) { w.alive = false; w.hp = 0; }
  if (w.hp <= 0) w.alive = false;
}
```

- [ ] **Step 5: Run — verify pass.** (Tune the snap loop if the feet-rest assertion is off by >3px.)
- [ ] **Step 6: Commit** `feat(boom-worms): worm factories + physics (TDD)`.

---

## Task 7: Turn rotation (pure)

**Files:** Create `src/turns.js`; Test `tests/turns.test.mjs`

- [ ] **Step 1: Write `tests/turns.test.mjs` (failing):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextActive, aliveTeams, checkOutcome } from '../src/turns.js';

const mk = (alive) => alive.map((a, i) => ({ id: i, alive: a }));
const teams = (t0, t1) => [{ id: 0, worms: mk(t0) }, { id: 1, worms: mk(t1) }];

test('nextActive alternates team and advances within team', () => {
  const t = teams([true, true], [true, true]);
  let n = nextActive(t, { team: 0, wormIdx: 0 });
  assert.equal(n.team, 1);
  n = nextActive(t, { team: 1, wormIdx: 0 });
  assert.equal(n.team, 0);
});

test('nextActive skips dead worms', () => {
  const t = teams([true, false, true], [false, true]);
  const n = nextActive(t, { team: 1, wormIdx: 1 });
  assert.equal(n.team, 0);
  assert.ok(t[0].worms[n.wormIdx].alive);
});

test('checkOutcome: winner team id when one side wiped, else null, -1 draw', () => {
  assert.equal(checkOutcome(teams([false, false], [true])), 1);
  assert.equal(checkOutcome(teams([true], [false])), 0);
  assert.equal(checkOutcome(teams([true], [true])), null);
  assert.equal(checkOutcome(teams([false], [false])), -1);
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Write `src/turns.js`:**

```js
export const aliveTeams = (teams) => teams.filter((t) => t.worms.some((w) => w.alive));

// Switch to the other team and pick its next alive worm (cyclic, per-team rotation
// tracked via team._idx). Returns {team, wormIdx} or null if nobody is alive.
export function nextActive(teams, cur) {
  const other = cur.team === 0 ? 1 : 0;
  for (const team of [other, cur.team]) {
    const worms = teams[team].worms;
    const start = team === cur.team ? cur.wormIdx + 1 : (teams[team]._idx ?? -1) + 1;
    for (let k = 0; k < worms.length; k++) {
      const idx = (start + k) % worms.length;
      if (worms[idx].alive) { teams[team]._idx = idx; return { team, wormIdx: idx }; }
    }
  }
  return null;
}

export function checkOutcome(teams) {
  const live = teams.filter((t) => t.worms.some((w) => w.alive));
  if (live.length === 1) return live[0].id;
  if (live.length === 0) return -1; // draw
  return null;
}
```

> Implementer note: the **tests are the contract**. The required behaviors: (1) turns alternate teams, (2) dead worms are skipped, (3) each team cycles through its own worms across its turns. Adjust impl until green.

- [ ] **Step 4: Run — verify pass.**
- [ ] **Step 5: Commit** `feat(boom-worms): turn rotation (TDD)`.

---

## Task 8: Levels data (pure)

**Files:** Create `src/levels.js`; Test `tests/levels.test.mjs`

- [ ] **Step 1: Write `tests/levels.test.mjs` (failing):**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildLevel } from '../src/levels.js';
import { FIELD } from '../src/config.js';

test('there are 6 levels with non-increasing AI error (later = more accurate)', () => {
  assert.equal(LEVELS.length, 6);
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].aiError <= LEVELS[i - 1].aiError);
  }
});

test('buildLevel returns spawns within field and matching enemy count', () => {
  for (let i = 0; i < 6; i++) {
    const lv = buildLevel(i);
    assert.equal(lv.index, i);
    assert.ok(lv.spawns[0].length >= 2 && lv.spawns[1].length >= 2);
    assert.equal(lv.spawns[1].length, lv.enemyCount);
    for (const arr of [lv.spawns[0], lv.spawns[1]])
      for (const x of arr) assert.ok(x > 0 && x < FIELD.W);
    assert.ok(lv.waterY > 0 && lv.waterY <= FIELD.H);
  }
});
```

- [ ] **Step 2: Run — verify fail.**

- [ ] **Step 3: Write `src/levels.js`** — `LEVELS` array of 6 entries, each `{ name, theme, palette:{sky,land,land2,water}, terrainParams:{hills,platforms,caves}, playerCount:3, enemyCount, aiError, wind }`, plus `buildLevel(i)`. Values:

| i | name | theme | enemyCount | aiError | wind |
|---|---|---|---|---|---|
|0|绿草训练场|grass|2|0.9|0|
|1|糖果乐园|candy|3|0.7|0|
|2|阳光海滩|beach|3|0.55|0|
|3|神秘丛林|jungle|3|0.4|0|
|4|云端天空|sky|3|0.28|0|
|5|彩虹山决战|rainbow|4|0.12|0|

`buildLevel(i)` returns `{ index:i, name, theme, palette, terrainParams, enemyCount, aiError, wind, waterY: WATER.defaultY, spawns }` where `spawns[0]` = `playerCount` xs evenly spread in `[60, FIELD.W*0.4]`, `spawns[1]` = `enemyCount` xs evenly spread in `[FIELD.W*0.6, FIELD.W-60]` (deterministic; no RNG). Import `FIELD, WATER` from config.

- [ ] **Step 4: Run — verify pass.**
- [ ] **Step 5: Commit** `feat(boom-worms): 6-level campaign data (TDD)`.

---

## Task 9: Terrain generation + canvas render layer

**Files:** Modify `src/terrain.js` (add generation + offscreen canvas + draw)

No unit test (canvas/DOM). The mask (Task 3) and the offscreen canvas must stay in lock-step: generation fills both; `carveAt` must clear both.

- [ ] **Step 1:** Add a `Terrain` class wrapping `{ mask, canvas, ctx }` at `FIELD.W × FIELD.H`:
  - `constructor()` creates the mask (`createMask`) + an offscreen `document.createElement('canvas')`.
  - `generate(level)`: draw the theme's **solid silhouette** onto the offscreen canvas in the land color: a base ground band above `waterY`, plus 2–4 rounded hills/platforms (filled arcs/rects) and optional carved caves from `level.terrainParams`. Then read `getImageData` and set `mask.cells[i] = (alpha>128) ? 1 : 0`. Paint a grass/topping stripe on solid tops (visual only — done after the mask snapshot, or with a color that still has alpha so it stays solid).
  - `carveAt(cx, cy, r)`: call pure `carve(mask, cx, cy, r)` AND clear the canvas circle: `ctx.save(); ctx.globalCompositeOperation='destination-out'; ctx.beginPath(); ctx.arc(cx,cy,r,0,2*Math.PI); ctx.fill(); ctx.restore();` then stroke a scorched rim.
  - `draw(targetCtx, camX=0)`: `targetCtx.drawImage(this.canvas, -camX, 0)`.
  - `solid(x,y)` → `solidAt(mask,x,y)`; `ground(x,fromY)` → `groundY(mask,x,fromY)`.
- [ ] **Step 2: Manual verify** (during Task 14 playtest): terrain renders; an explosion leaves a visible hole AND worms fall through where carved.
- [ ] **Step 3: Commit** `feat(boom-worms): terrain generation + destructible canvas`.

---

## Task 10: Weapons firing + live projectiles

**Files:** Create `src/weapons.js`, `src/projectile.js`

- [ ] **Step 1: `src/projectile.js`** — a `makeProjectile(opts)` factory + `updateProjectile(p, dt, ctx)` where `ctx = { terrain, allWorms, wind, gravity, onExplode(x,y,radius,dmg,weaponKey) }`:
  - integrate via `stepBallistic` (apply `wind` only if the weapon `windAffected`);
  - `grenade`/`holy`: decrement `fuse`; on terrain hit reflect velocity scaled by `bounce` (push out of solid) instead of exploding; explode when `fuse<=0`;
  - `projectile` (bazooka): explode on first terrain or enemy-worm contact;
  - `dynamite`: near-stationary, fuse countdown, then explode;
  - on explode → `ctx.onExplode(x, y, radius, dmg, weaponKey)` then `p.dead = true`.
  - collision: `terrain.solid(x,y)` for ground; circle/AABB vs worms in `allWorms`.
- [ ] **Step 2: `src/weapons.js`** — `fire(weaponKey, worm, aim, ctx)` returns `Projectile[]` or resolves instantly:
  - `projectile`/`grenade`/`dynamite` → spawn at the worm muzzle (`worm.x + facing*r`, `worm.y`) with velocity `vecFromAngle(aim.angle, aim.speed)`; dynamite spawns at feet with ~zero velocity;
  - `hitscan` (shotgun) → raymarch from muzzle along `aim.angle` up to `range`; on first worm/terrain hit, small `carveAt` dig + `applyExplosion`-style damage + knockback; repeat for `shots`;
  - `melee` (firepunch) → damage worms within `range` in front; apply up/forward knock; never damages owner (`safe`);
  - `airstrike` → spawn `bombs` downward projectiles above the aim target x;
  - decrement team ammo unless `Infinity`.
- [ ] **Step 3: Manual verify** in Task 14.
- [ ] **Step 4: Commit** `feat(boom-worms): weapons firing + projectiles`.

---

## Task 11: Aim + input (device-adaptive)

**Files:** Create `src/aim.js`, `src/input.js`

- [ ] **Step 1: `src/aim.js`** — an `Aim` object holding `{ angle, charging, power, mode }`:
  - `setFromMouse(worm, mx, my)`: `angle = angleOf(mx - worm.x, my - worm.y)`; `mode='mouse'`.
  - `nudgeAngle(dir, dt)`: `angle += dir * AIM.angleStepRad * dt` (clamp to sane range); `mode='angle'`.
  - `startCharge()/stepCharge(dt)/release()`: `power` ramps `minSpeed→maxSpeed` over `AIM.chargeSeconds`; `release()` returns `{ angle, speed: power }` and resets charging.
- [ ] **Step 2: `src/input.js`** — mirror jungle-blitz `Input` API: `Input.init(canvas, mapClientToField)`, `Input.on(cb)`, `Input.poll()`. Emit semantic actions and aim signals:
  - **Keyboard:** ←→ move (held); **Z = jump**; **↑↓ = aim** (held); **Space = charge** (down=start, up=release); Q/E weapon prev/next; Esc pause; M mute.
  - **Mouse (pointer events on canvas):** move → `{type:'mouseAim', x, y}` (field coords); left button down/up → `{type:'mouseCharge', down}`.
  - **Gamepad (poll, edge-detect buttons):** left stick/d-pad X = move; d-pad/stick Y = aim; ✕(btn 0)=jump; □(btn 2) or R2(btn 7)=charge (held); L1(4)/R1(5)=weapon; Options(9)=pause.
- [ ] **Step 3: Manual verify** in Task 14.
- [ ] **Step 4: Commit** `feat(boom-worms): device-adaptive aim + input`.

---

## Task 12: Renderer

**Files:** Create `src/render.js`

- [ ] **Step 1: `Renderer` class** (mirror jungle-blitz constructor: store canvas+ctx, DPR/resize handling, `mapClientXToField`/`mapClientToField`). `render(game)` draws in order:
  1. themed sky gradient (level palette) + parallax deco (emoji clouds/trees/candy per theme),
  2. animated water band at `waterY`,
  3. `game.terrain.draw(ctx)`,
  4. crates,
  5. worms: rounded body in team color, eyes, smile, little hat; HP bar above; highlight arrow + name on the active worm; hit-flash,
  6. projectiles + particle effects (explosions, splashes, charge sparkles),
  7. **HUD**: current player/team label, selected weapon + ammo (weapon bar), wind arrow (if enabled), turn banner,
  8. **aim indicator** (dotted predicted arc or crosshair from active worm along `aim.angle`) + **power bar** while charging.
  No game logic in here — read-only over `game`.
- [ ] **Step 2: Manual verify** in Task 14.
- [ ] **Step 3: Commit** `feat(boom-worms): renderer (terrain/worms/HUD/aim)`.

---

## Task 13: Audio

**Files:** Create `src/audio.js`

- [ ] **Step 1:** Copy the `Sound` singleton shape from `games/jungle-blitz/src/audio.js` (lazy `AudioContext`, `tone()`, `muted`, `resume/toggleMuted/isMuted`). Add SFX methods: `charge(level0to1)` (pitch rises with hold), `fire(weaponKey)`, `explode(big=false)`, `splash`, `pickup`, `jump`, `land`, `turn`, `levelClear`, `gameOver`, `win`, `ui`.
- [ ] **Step 2: Commit** `feat(boom-worms): web audio sfx`.

---

## Task 14: Game state machine + main.js + overlays + styles

**Files:** Create `src/game.js`, `src/main.js`; finalize `index.html`, `style.css`

- [ ] **Step 1: `src/game.js` — `Game` class** holding `state`, `mode('solo'|'duo')`, `windEnabled`, `levelIndex`, `level`, `terrain`, `teams[2]`, `active{team,wormIdx}`, `aim`, `projectiles[]`, `crates[]`, `effects[]`, `wind`, `best{level}` (from `localStorage`, guarded by `typeof localStorage !== 'undefined'`), `bannerMs`.
  - States: `menu, intro, aim, firing, projectile, resolve, levelclear, gameover, win`.
  - `startGame(levelIndex=0, mode='solo')`: `buildLevel`, `terrain.generate`, spawn teams (team0 human; team1 AI in solo, human in duo) at level spawns dropped onto ground, set first `active`, give each team `ammo` from `WEAPONS`, state `intro`→`aim`.
  - `handleAction(action)`: in `aim`, route move/jump/aim/charge/weapon to the active worm + `Aim`; `chargeRelease` → `weapons.fire(...)`, push projectiles, state→`projectile`.
  - `update(dt)`: per state — `aim`: `stepWorm(active, …)` + camera; `projectile`: `updateProjectile` for each, explode callback carves terrain (`terrain.carveAt`) + `applyExplosion(allWorms,…)` + spawn effects + `Sound.explode`; also keep stepping all worms so knockback/falls settle; when no live projectiles and all worms at rest → `resolve`: mark deaths (hp<=0 / drowned), maybe drop a crate (`CRATE.dropChance`), then `checkOutcome`: winner→`levelclear`(team0)/`gameover`(team1, solo)/duo announce; else `nextActive`→ next turn (state `aim`); if next worm belongs to an AI team, invoke `AIController.takeTurn(this)` (Task 15).
  - `togglePause/restartLevel/nextLevel/toMenu`; persist `best.level` on level clear.
- [ ] **Step 2: `src/main.js`** — mirror jungle-blitz: instantiate `Game/Renderer/Input/Sound`; `Input.init(canvas, cx=>renderer.mapClientToField(cx))` + `Input.on(a=>game.handleAction(a))`; overlay-sync map (`menu/paused/levelclear/gameover/win`); button wiring incl. **menu mode buttons** (单人闯关 → `startGame(0,'solo')`, 双人对战 → `startGame(0,'duo')`) and **wind toggle**; mute; RAF loop (`dt` clamped like jungle-blitz: `Math.min((now-last)/1000, 0.045)`); `?level=N` query for replay.
- [ ] **Step 3: Finalize `index.html`** overlays: menu (title, 单人/双人 buttons, wind checkbox, best-progress line, keyboard+gamepad hints), pause (resume/restart/hub), levelclear (next), gameover (retry/menu/hub), win (replay/hub); HUD container + `#weapon-bar` + `#power-bar` + `#turn-banner`.
- [ ] **Step 4: Finalize `style.css`** — kid-friendly: big rounded buttons, readable fonts, themed accents, weapon bar (icons + ammo counts, active highlight), prominent power bar, responsive canvas scaling, control-hint chips (reuse jungle-blitz visual language).
- [ ] **Step 5: Manual verify** — `./start.sh` (or `python3 -m http.server`), open hub → game loads; play a full level solo and a duo round; terrain destroys; worms drown; power charge + aim work on keyboard and mouse.
- [ ] **Step 6: Commit** `feat(boom-worms): game state machine + UI + main loop`.

---

## Task 15: AI controller integration

**Files:** Modify `src/ai.js` (add `AIController`), wire into `src/game.js`

- [ ] **Step 1:** Add `AIController.takeTurn(game)` driven by timed steps (so the player sees it move/aim before firing):
  - pick target among team0 alive worms (lowest hp / nearest heuristic);
  - choose weapon: bazooka default; grenade if a wall blocks the direct arc; firepunch if adjacent;
  - `sol = solveAim(active.x, active.y, target.x, target.y, PHYSICS.projGravity, AIM.minSpeed, AIM.maxSpeed, game.wind)`; `aim = jitterAim(sol, game.level.aiError, Math.random)`;
  - optionally walk a few steps toward a better position first;
  - after a short telegraph delay, fire through the same `weapons.fire` path the human uses, then yield to the normal `projectile→resolve→nextActive` flow.
- [ ] **Step 2:** In `game.js`, when `nextActive` lands on an AI team worm (solo, team1), call `AIController.takeTurn(this)` instead of awaiting input. Guard against double-fire (one in-flight flag).
- [ ] **Step 3: Manual verify** — AI visibly aims and fires; level 1 misses often, level 6 is accurate.
- [ ] **Step 4: Commit** `feat(boom-worms): enemy AI turns`.

---

## Task 16: Hub integration + README + full test + playtest

**Files:** Modify `js/games.js`; finalize `games/boom-worms/README.md`

- [ ] **Step 1:** Append the registry entry to `js/games.js` (spec §14): id `boom-worms`, title `炮炮虫 BOOM WORMS`, subtitle `回合制炮战 · 打飞小虫`, desc `回合制策略 · 抛物线瞄准 · 可破坏地形 · 单人闯关/双人同机 · 键鼠/手柄`, icon `🪱`, accent `#ff9f43`, accent2 `#b3590a`, tags `['策略','回合制','键鼠/手柄']`, path `games/boom-worms/index.html`.
- [ ] **Step 2:** Write `README.md`: one-paragraph description, controls table (keyboard + gamepad), how to run (`./start.sh` or any static server; open the hub), module map, run tests (`node --test`), `?level=N` replay note, link to spec.
- [ ] **Step 3: Run full test suite** — `cd games/boom-worms && node --test` → all green. Fix failures.
- [ ] **Step 4: Playtest** (browser, or `superpowers:webapp-testing` / Playwright): hub card appears + launches; clear level 1 solo; verify terrain destruction, drowning, crate pickup, weapon switching, power charge, gamepad (if available), duo mode, pause, level progression + localStorage persistence, back-to-hub.
- [ ] **Step 5: Commit** `feat(boom-worms): hub integration + README; campaign playable end-to-end`.

---

## Self-Review (completed by plan author)

- **Spec coverage:** turn state machine (T7,T14); destructible terrain (T3,T9); worm physics + water-out, fall-damage intentionally absent (T6); weapons incl. crate-only airstrike/holy (T1,T10); device-adaptive aim (T11); AI solver + per-level difficulty (T5,T15); 2-player hotseat (T14 mode); 6 themed levels (T8); wind default-off + toggle (T1,T14); crates + heal (T1,T10,T14); HUD / power bar / wind arrow (T12,T14); audio (T13); localStorage progress (T14); hub entry + README + tests (T16). All spec sections mapped.
- **Placeholder scan:** pure-logic tasks (1–8) contain full test + implementation code. Render/glue tasks (9–15) give exact files, function signatures, responsibilities, and manual acceptance checks rather than full listings — a deliberate trade to keep the plan tractable; no "TODO / handle edge cases" hand-waving.
- **Type consistency:** Worm/Team/Projectile/Level/Aim shapes fixed in "Shared Data Shapes" and reused. Function names consistent across tasks: `solidAt/carve/groundY/createMask/fillRect` (terrain), `carveAt/generate/draw/solid/ground` (Terrain class), `stepBallistic/simulate` (trajectory), `explosionDamage/applyExplosion/drowned` (combat), `solveAim/jitterAim` (ai), `nextActive/aliveTeams/checkOutcome` (turns), `stepWorm` (physics), `makeWorm/makeTeam` (worm), `buildLevel/LEVELS` (levels), `fire` (weapons), `makeProjectile/updateProjectile` (projectile), `Aim/Input/Renderer/Sound/Game` adapters.
- **Contract rule:** where a sample implementation and its test disagree, the **test wins** — adjust the implementation (flagged in T5 and T7).
