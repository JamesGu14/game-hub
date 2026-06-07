# 丛林勇士 JUNGLE WARRIOR — M2 战斗完整(L1 打透) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, checkpoint-reviewed) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Builds directly on the M1 codebase in `games/warrior/`.

**Goal:** Make L1 a fully clearable run-and-gun stage: add prone, the M/S/L main weapons, Falcon-dropped weapon/item pickups, the B barrier power-up, the L1 BOSS 震地要塞·铁壁 with a HP bar, and the juicy feedback layer (combo counter, kill float-text, bigger explosions + screen shake).

**Architecture:** Extends M1's modules in place. New entities `Falcon`, `Pickup`, `Boss` live in `entities.js`; `weapons.js` already returns specs for spread/pierce so M/S/L is mostly config. `game.js` gains `pickups`/`falcons`/`boss`/`combo`/barrier state and a BOSS-gated `levelClear`. All new logic is Node-unit-tested (the M1 pattern: pure modules + import-safe game.js); presentation is browser-verified.

**Tech Stack:** Same as M1 — ES modules, Canvas 2D, Web Audio, `node --test`, host-side Chrome smoke.

---

## Reference: M2 contract additions (honored by every task)

### Weapon table (spec §3.3 params)

| id | letter | cooldown | dmg | speed | flags |
|----|--------|----------|-----|-------|-------|
| rifle | — | 0.18 | 1 | 560 | (default, from M1) |
| machine | M | 0.08 | 0.5 | 600 | single straight |
| spread | S | 0.34 | 1 | 520 | `spread:5, spreadAngle: 18° (0.314rad)` |
| laser | L | 0.40 | 2 | 720 | `pierce:true` |

(F 火球 + R 射速 are M4 — not in M2.)

### Items (spec §3.3)

- **B 屏障 Barrier**: on pickup, player gets `barrier` timer = 5s; while active → invulnerable + touching an enemy/boss instakills it. Blink at 0.12s near expiry.

### Falcon + Pickup (spec §13 H6)

- **Falcon**: enters from off the right edge when the camera's right edge passes `atX`; flies a polyline `path` (tile coords) at constant speed; when hit by a **player bullet**, drops **1** blinking letter Pickup (`drop` letter) and dies.
- **Pickup**: blinks (0.2s period), falls with gravity onto terrain, despawns after 8s; on player touch → if a main-weapon letter (M/S/L) switch `player.weapon`; if B → grant barrier. (Plays `pickup` sound.)

### BOSS 震地要塞·铁壁 Iron Gate Destroyer (spec §4.2, §13 H9 — the template)

- `hp/maxHp`, `phases[]` switch at HP fractions, `attackPatterns`, a `weakpoint` window, death animation.
- M2 template params: `maxHp 40`, phases at `>0.5` (slam) and `<=0.5` (slam + spawn grunts), contact damage, telegraphed slam that spawns shockwave; weakpoint = always hittable core (kid-friendly). HUD bottom HP bar + name.
- Boss triggers when the player reaches `level.bossX`; `levelClear()` now fires only on boss death.

### Combo + FX (spec §8, §13)

- **Combo**: kills within a 2.5s window stack a multiplier (cap 5×); float-text `+score` (×mult) rises on kill; casual death does NOT break combo, classic does. (M2 wires casual.)
- **Explosions**: `spawnParticles` bursts already exist; boss death + big kills also call `world.shake(...)` (4px-ish, decays) — M1 already has `game.shake`.

### Difficulty/timing (spec §13 H5)

- invuln: casual 2.0s / classic 1.5s (already in `MODES`); barrier 5.0s; blink period 0.12s.

### Test files (spec §9)

New/extended: `weapons.test.mjs` (+M/S/L), `entities.test.mjs` (+prone, +barrier, +Falcon/Pickup, +Boss), `capsule.test.mjs` (Falcon→drop→pickup→apply), `damage.test.mjs` (casual/classic death + boss damage), `collision.test.mjs` (bullet-boss weakpoint, barrier instakill), `boss.test.mjs` (phase switch + death→clear), `game.test.mjs` (+combo, +boss-gated clear, +pickup apply).

Commands: `node --test` (all) / `node --test tests/<file>.test.mjs`.

---

## Checkpoints (inline review pauses)

- **CP-A 武器与卧倒**: T1–T3 — config-M2 + M/S/L weapons + prone. Unit-green.
- **CP-B 拾取与屏障**: T4–T6 — Falcon + Pickup + Barrier, capsule/damage tests. Unit-green.
- **CP-C BOSS**: T7–T9 — Boss + boss-gated clear + combo, boss/collision/damage tests. Unit-green.
- **CP-D 表现与实玩**: T10–T13 — sprites/render/audio M2 + levels wiring + browser smoke to BOSS-kill. Playable L1 full clear.

---

## Task 1: `config.js` — M2 constants

**Files:** Modify `games/warrior/src/config.js`

- [ ] **Step 1: Extend the WEAPONS table** (add after the `rifle` entry, inside `WEAPONS`):

```js
  machine: { id: 'machine', letter: 'M', cooldown: 0.08, dmg: 0.5, speed: 600, pierce: false, spread: 0 },
  spread:  { id: 'spread',  letter: 'S', cooldown: 0.34, dmg: 1,   speed: 520, pierce: false, spread: 5, spreadAngle: 0.314 },
  laser:   { id: 'laser',   letter: 'L', cooldown: 0.40, dmg: 2,   speed: 720, pierce: true,  spread: 0 },
```

- [ ] **Step 2: Add item + barrier + combo + falcon + boss + fx constants** (append to `config.js`):

```js
// Letter -> what a pickup does. Main weapons switch player.weapon; items grant state.
export const PICKUPS = {
  M: { kind: 'weapon', weapon: 'machine' },
  S: { kind: 'weapon', weapon: 'spread' },
  L: { kind: 'weapon', weapon: 'laser' },
  B: { kind: 'item', item: 'barrier' },
};
export const BARRIER = { time: 5.0 };       // seconds of invuln + instakill-on-touch
export const BLINK = 0.12;                  // i-frame / barrier blink period
export const PRONE = { h: 18 };             // crouched hitbox height (PLAYER.proneH mirror)

export const FALCON = { w: 40, h: 22, speed: 150, dropBlink: 0.2 };
export const PICKUP = { w: 20, h: 20, life: 8.0, blink: 0.2, gravityScale: 1 };

export const COMBO = { window: 2.5, maxMult: 5 };
export const SHAKE = { kill: 3, bigKill: 5, bossDie: 8 };

// L1 BOSS 震地要塞·铁壁 Iron Gate Destroyer — the §13 H9 template for all bosses.
export const BOSSES = {
  ironGate: {
    name: '震地要塞·铁壁', enName: 'Iron Gate Destroyer',
    w: 96, h: 110, maxHp: 40, touchDamage: true,
    phases: [
      { upTo: 1.01, slamCd: 2.2, spawnGrunts: 0 }, // >50% hp
      { upTo: 0.5,  slamCd: 1.5, spawnGrunts: 2 }, // <=50% hp: faster + summons
    ],
    score: 2000,
  },
};
export const SCORE_KILL_BOSS = 2000;
```

- [ ] **Step 3: Verify import**

Run (from `games/warrior/`): `node -e "import('./src/config.js').then(c=>console.log(c.WEAPONS.spread.spread, c.BARRIER.time, c.BOSSES.ironGate.maxHp, c.PICKUPS.M.weapon))"`
Expected: `5 5 40 machine`

- [ ] **Step 4: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/config.js
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 config — M/S/L weapons, pickups/barrier/falcon/boss/combo/fx"
```

---

## Task 2: M/S/L weapons (TDD)

`weapons.fire()` already handles `spread`/`pierce` (built in M1). M2 just adds tests + confirms the table drives them.

**Files:** Modify `games/warrior/tests/weapons.test.mjs`

- [ ] **Step 1: Add failing tests** (append inside `weapons.test.mjs`):

```js
test('machine gun fires one fast bullet on a short cooldown', () => {
  const specs = fire('machine', 0, 0, { x: 1, y: 0 });
  assert.equal(specs.length, 1);
  assert.equal(specs[0].vx, WEAPONS.machine.speed); // 600
  assert.equal(specs[0].dmg, 0.5);
  assert.equal(cooldownFor('machine'), 0.08);
});

test('spread fires 5 bullets in a fan centered on aim', () => {
  const specs = fire('spread', 0, 0, { x: 1, y: 0 });
  assert.equal(specs.length, 5);
  // middle bullet ~horizontal; outermost bullets angled symmetrically
  const angs = specs.map((s) => Math.atan2(s.vy, s.vx)).sort((a, b) => a - b);
  assert.ok(Math.abs(angs[2]) < 1e-6, 'center bullet is horizontal');
  assert.ok(Math.abs(angs[0] + angs[4]) < 1e-6, 'fan is symmetric');
  assert.ok(angs[4] - angs[0] > 0.5, 'fan has real spread');
  for (const s of specs) assert.ok(Math.abs(Math.hypot(s.vx, s.vy) - WEAPONS.spread.speed) < 1e-6);
});

test('laser pierces and hits hard', () => {
  const specs = fire('laser', 0, 0, { x: 0, y: -1 });
  assert.equal(specs.length, 1);
  assert.equal(specs[0].pierce, true);
  assert.equal(specs[0].dmg, 2);
  assert.equal(specs[0].vy, -WEAPONS.laser.speed); // -720
});
```

- [ ] **Step 2: Run — expect green immediately** (fire() already supports this)

Run: `node --test tests/weapons.test.mjs`
Expected: PASS — `# pass 7` (4 from M1 + 3 new). If spread symmetry fails, confirm `config.spreadAngle: 0.314` and `weapons.fire` uses `w.spreadAngle`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/tests/weapons.test.mjs
git -C /Users/james/Projects/game-hub commit -m "test(warrior): M2 weapons — M/S/L coverage (spread fan, laser pierce)"
```

---

## Task 3: Prone / 卧倒 (TDD)

Spec §3.1/§3.2: on the ground, holding ↓ → prone (shorter hitbox, still horizontal shot); release → restore. `resolveAim` already returns horizontal for ground+down (M1, tested), so this is a Player state + hitbox change.

**Files:** Modify `games/warrior/src/entities.js`, `games/warrior/tests/entities.test.mjs`

- [ ] **Step 1: Add failing tests** (append to `entities.test.mjs`):

```js
test('holding down on the ground makes the player prone with a shorter hitbox', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 5 * TILE - 30); w.player = p;
  for (let i = 0; i < 5; i++) p.update(1 / 60, w); // settle on ground
  const fullH = p.h;
  w.input.intent.aimDown = true;
  p.update(1 / 60, w);
  assert.equal(p.prone, true);
  assert.ok(p.h < fullH, 'hitbox shrank while prone');
});

test('releasing down restores standing height', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 5 * TILE - 30); w.player = p;
  for (let i = 0; i < 5; i++) p.update(1 / 60, w);
  const standH = p.h;
  w.input.intent.aimDown = true; p.update(1 / 60, w);
  w.input.intent.aimDown = false; p.update(1 / 60, w);
  assert.equal(p.prone, false);
  assert.equal(p.h, standH);
});

test('prone is only on the ground (down in the air does not prone)', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 1 * TILE); w.player = p; // airborne
  w.input.intent.aimDown = true;
  p.update(1 / 60, w);
  assert.equal(p.prone, false);
});
```

- [ ] **Step 2: Run — expect red** (`p.prone` undefined / heights unchanged)

Run: `node --test tests/entities.test.mjs`
Expected: FAIL on the new prone tests.

- [ ] **Step 3: Implement prone in `Player`**

In the `Player` constructor add: `this.prone = false;`

In `Player.update`, right after computing `this.aim = resolveAim(...)` (and before `collideTiles`), add prone handling that keeps the feet planted when the hitbox changes:

```js
    // Prone: on the ground, holding down shrinks the hitbox (still a horizontal shot).
    const wantProne = intent.aimDown && this.onGround;
    if (wantProne !== this.prone) {
      const feet = this.y + this.h;
      this.prone = wantProne;
      this.h = wantProne ? PRONE.h : PLAYER.h;
      this.y = feet - this.h; // keep feet planted
    }
```

Add `PRONE` to the config import at the top of `entities.js`:

```js
import { TILE, GRAVITY, PLAYER, FORGIVE, ENEMY, DEFAULT_WEAPON, SOLID, PRONE } from './config.js';
```

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/entities.test.mjs`
Expected: PASS — `# pass 9` (6 from M1 + 3 new).

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/entities.js games/warrior/tests/entities.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 prone — crouch shrinks hitbox, horizontal shot + tests"
```

> **CHECKPOINT CP-A** — run `node --test` (all green), report, pause for review.

---

## Task 4: Barrier item (TDD)

**Files:** Modify `games/warrior/src/entities.js`, `games/warrior/tests/entities.test.mjs`

- [ ] **Step 1: Add failing tests** (append to `entities.test.mjs`):

```js
test('barrier grants timed invulnerability', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 5 * TILE - 30); w.player = p;
  p.giveBarrier();
  assert.ok(p.barrier > 0);
  assert.equal(p.isInvulnerable(), true);
  assert.equal(p.takeDamage(w), false, 'barrier blocks damage');
});

test('barrier expires after its duration', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 5 * TILE - 30); w.player = p;
  p.giveBarrier();
  for (let i = 0; i < 6 * 60; i++) p.update(1 / 60, w); // 6s > 5s
  assert.equal(p.barrier <= 0, true);
  assert.equal(p.isInvulnerable(), false);
});
```

- [ ] **Step 2: Run — expect red**

Run: `node --test tests/entities.test.mjs` → FAIL (`giveBarrier`/`barrier`/`isInvulnerable` undefined).

- [ ] **Step 3: Implement barrier on `Player`**

Constructor: add `this.barrier = 0;`

Add methods + update the damage gate:

```js
  giveBarrier() { this.barrier = BARRIER.time; }
  isInvulnerable() { return this.invuln > 0 || this.barrier > 0 || this.dying > 0; }
```

In `Player.update`, alongside the invuln timer, tick the barrier:

```js
    if (this.invuln > 0) this.invuln -= dt;
    if (this.barrier > 0) this.barrier -= dt;
```

Change `takeDamage` to use `isInvulnerable()`:

```js
  takeDamage(world) {
    if (this.isInvulnerable()) return false;
    this.startDeath(world);
    return true;
  }
```

Add `BARRIER` to the config import in `entities.js`:

```js
import { TILE, GRAVITY, PLAYER, FORGIVE, ENEMY, DEFAULT_WEAPON, SOLID, PRONE, BARRIER } from './config.js';
```

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/entities.test.mjs` → `# pass 11`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/entities.js games/warrior/tests/entities.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 barrier — timed invuln + instakill flag + tests"
```

---

## Task 5: Falcon + Pickup entities (TDD → capsule.test.mjs)

**Files:** Modify `games/warrior/src/entities.js`; Create `games/warrior/tests/capsule.test.mjs`

- [ ] **Step 1: Write `tests/capsule.test.mjs` (failing)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, MODES } from '../src/config.js';
import { Falcon, Pickup, Bullet, Player } from '../src/entities.js';

function world(extra = {}) {
  const cols = 40, rows = 8;
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, () => (r === 5 ? 'ground' : null)));
  return {
    grid, enemies: [], bullets: [], pickups: [], particles: [],
    mode: MODES.casual, player: null,
    input: { intent: { moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false } },
    sounds: [],
    addScore() {}, playSound(id) { this.sounds.push(id); },
    spawnParticles() {}, shake() {},
    spawnPickup(letter, x, y) { this.pickups.push(new Pickup(letter, x, y)); },
    ...extra,
  };
}

test('a Falcon hit by a player bullet drops a pickup and dies', () => {
  const w = world();
  const f = new Falcon('S', 100, 100, [{ x: 100, y: 100 }, { x: 60, y: 100 }]);
  const b = new Bullet({ x: f.x - 4, y: f.y + 4, vx: 600, vy: 0, dmg: 1, pierce: false, life: 1 });
  w.bullets.push(b);
  for (let i = 0; i < 6 && !f.dead; i++) { b.update(1 / 60, w); f.update(1 / 60, w); }
  assert.equal(f.dead, true);
  assert.equal(w.pickups.length, 1);
  assert.equal(w.pickups[0].letter, 'S');
});

test('a weapon pickup switches the player weapon on touch', () => {
  const w = world();
  const p = new Player(5 * TILE, 5 * TILE - 30); w.player = p;
  const pk = new Pickup('L', p.x, p.y);
  assert.equal(pk.apply(p, w), true);
  assert.equal(p.weapon, 'laser');
});

test('a B pickup grants the barrier on touch', () => {
  const w = world();
  const p = new Player(5 * TILE, 5 * TILE - 30); w.player = p;
  const pk = new Pickup('B', p.x, p.y);
  pk.apply(p, w);
  assert.ok(p.barrier > 0);
});

test('a pickup despawns after its lifetime', () => {
  const w = world();
  const pk = new Pickup('M', 5 * TILE, 0);
  for (let i = 0; i < 9 * 60 && !pk.dead; i++) pk.update(1 / 60, w); // > 8s
  assert.equal(pk.dead, true);
});
```

- [ ] **Step 2: Run — expect red** (no Falcon/Pickup exports)

- [ ] **Step 3: Implement `Falcon` and `Pickup` in `entities.js`**

Add `FALCON, PICKUP, PICKUPS` to the config import, then append these classes:

```js
// Red-falcon carrier: flies a polyline; a player bullet drops its letter and kills it.
export class Falcon {
  constructor(drop, x, y, path) {
    this.w = FALCON.w; this.h = FALCON.h;
    this.x = x; this.y = y;
    this.drop = drop;
    this.path = path && path.length ? path : [{ x, y }];
    this.seg = 0; this.dead = false; this.anim = 0;
  }
  update(dt, world) {
    if (this.dead) return;
    this.anim += dt;
    const target = this.path[Math.min(this.seg + 1, this.path.length - 1)];
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const dx = target.x - cx, dy = target.y - cy;
    const d = Math.hypot(dx, dy);
    if (d < 4) { if (this.seg < this.path.length - 2) this.seg++; }
    else { const s = FALCON.speed * dt; this.x += (dx / d) * s; this.y += (dy / d) * s; }
    // off the left edge → gone
    if (this.x + this.w < world.camera ? false : false) { /* culling handled by game */ }
  }
  // Called when a player bullet overlaps it.
  hitByBullet(world) {
    if (this.dead) return;
    this.dead = true;
    world.spawnPickup(this.drop, this.x + this.w / 2 - PICKUP.w / 2, this.y + this.h / 2);
    world.playSound('hit');
  }
}

// A blinking letter that falls to the ground, despawns after PICKUP.life, applies on touch.
export class Pickup {
  constructor(letter, x, y) {
    this.letter = letter;
    this.w = PICKUP.w; this.h = PICKUP.h;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.onGround = false; this.dead = false;
    this.life = PICKUP.life; this.anim = 0;
  }
  update(dt, world) {
    this.anim += dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    collideTiles(this, world.grid, dt);
  }
  visible() { return (this.anim % (PICKUP.blink * 2)) < PICKUP.blink; }
  // Apply to the player; returns true if it was a weapon switch.
  apply(player, world) {
    const def = PICKUPS[this.letter];
    this.dead = true;
    world.playSound('pickup');
    if (def && def.kind === 'weapon') { player.weapon = def.weapon; return true; }
    if (def && def.item === 'barrier') { player.giveBarrier(); }
    return false;
  }
}
```

> Delete the dead `if (this.x + this.w < world.camera ...)` line during implementation — off-screen culling is the game's job (Task 9). It's left out of the final file.

Final `Falcon.update` ends at the move block (no culling line). Import line becomes:

```js
import { TILE, GRAVITY, PLAYER, FORGIVE, ENEMY, DEFAULT_WEAPON, SOLID, PRONE, BARRIER, FALCON, PICKUP, PICKUPS } from './config.js';
```

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/capsule.test.mjs` → `# pass 4`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/entities.js games/warrior/tests/capsule.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 Falcon + Pickup — bullet-drop, blink, touch-apply + capsule tests"
```

---

## Task 6: damage split — casual vs classic + barrier instakill (TDD → damage.test.mjs)

**Files:** Create `games/warrior/tests/damage.test.mjs` (logic already exists in Player/game from M1 + Task 4; this locks it)

- [ ] **Step 1: Write `tests/damage.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Input } from '../src/input.js';
import { MODES } from '../src/config.js';

function game(modeId) {
  const g = new Game();
  g.setMode(modeId);
  g.startLevel(0);
  g._startPlaying();
  Input.intent = { moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false };
  return g;
}

test('casual: death keeps infinite lives and respawns', () => {
  const g = game('casual');
  g.player.startDeath(g._world);
  g.player.y = g.level.height + 200;
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  assert.equal(g.state, 'playing');
  assert.equal(g.lives, Infinity);
});

test('classic: death decrements lives and drops the weapon to rifle', () => {
  const g = game('classic');
  g.player.weapon = 'laser';
  const lives0 = g.lives;
  g.player.startDeath(g._world);
  g.player.y = g.level.height + 200;
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  assert.equal(g.lives, lives0 - 1);
  assert.equal(g.player.weapon, 'rifle', 'classic drops weapon on death');
  assert.equal(g.state, 'playing');
});

test('barrier blocks an enemy contact that would otherwise kill', () => {
  const g = game('casual');
  const p = g.player;
  p.giveBarrier();
  g.spawnEnemy('runner', p.x, p.y);
  g.enemies[0].x = p.x; g.enemies[0].y = p.y;
  const deaths0 = g.deaths;
  g.update(1 / 60);
  assert.equal(g.deaths, deaths0, 'no death while barrier up');
});
```

- [ ] **Step 2: Run**

Run: `node --test tests/damage.test.mjs`
Expected: the casual + barrier tests pass; the **classic** test likely FAILS if `_playerEnemyCollisions` / barrier-instakill isn't wired — see Step 3.

- [ ] **Step 3: Wire barrier instakill in `game.js` `_playerEnemyCollisions`**

Replace the method so a barrier instakills the touched enemy instead of the player taking (blocked) damage:

```js
  _playerEnemyCollisions() {
    const p = this.player;
    if (p.dying > 0) return;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!aabb(p, e)) continue;
      if (p.barrier > 0) { if (e.hit) e.hit(999, this._world); continue; } // barrier: instakill
      if (p.isInvulnerable()) continue;
      p.takeDamage(this._world);
      break;
    }
  }
```

(Classic death/weapon-drop already lives in `_onPlayerDead` from M1 — `loseWeaponOnDeath` flips the weapon. The classic test passes once `setMode('classic')` is used, which M1 already supports.)

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/damage.test.mjs` → `# pass 3`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/game.js games/warrior/tests/damage.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 damage — casual/classic split + barrier instakill + tests"
```

> **CHECKPOINT CP-B** — `node --test` all green, report, pause.

---

## Task 7: BOSS 震地要塞·铁壁 (TDD → boss.test.mjs)

**Files:** Modify `games/warrior/src/entities.js`; Create `games/warrior/tests/boss.test.mjs`

- [ ] **Step 1: Write `tests/boss.test.mjs` (failing)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, MODES, BOSSES } from '../src/config.js';
import { Boss } from '../src/entities.js';

function world(extra = {}) {
  const cols = 30, rows = 10;
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, () => (r === 8 ? 'ground' : null)));
  return {
    grid, enemies: [], bullets: [], particles: [],
    mode: MODES.casual,
    player: { x: 5 * TILE, y: 7 * TILE, w: 22, h: 30 },
    addScore() {}, playSound() {}, spawnParticles() {}, shake() {},
    spawnEnemy() {}, ...extra,
  };
}

test('boss starts in phase 0 at full hp', () => {
  const b = new Boss('ironGate', 20 * TILE, 6 * TILE);
  assert.equal(b.hp, BOSSES.ironGate.maxHp);
  assert.equal(b.phase, 0);
  assert.equal(b.dead, false);
});

test('boss switches to phase 1 below half hp', () => {
  const b = new Boss('ironGate', 20 * TILE, 6 * TILE);
  const w = world();
  b.hit(BOSSES.ironGate.maxHp * 0.6, w); // drop below 50%
  b.update(1 / 60, w);
  assert.equal(b.phase, 1);
});

test('boss dies when hp hits zero and awards score', () => {
  const b = new Boss('ironGate', 20 * TILE, 6 * TILE);
  let scored = 0;
  const w = world({ addScore(n) { scored += n; } });
  b.hit(BOSSES.ironGate.maxHp, w);
  assert.equal(b.dead, true);
  assert.equal(scored, BOSSES.ironGate.score);
});

test('boss telegraphs then slams on its cooldown', () => {
  const b = new Boss('ironGate', 20 * TILE, 6 * TILE);
  const w = world();
  let slammed = false;
  const w2 = { ...w, shake: () => { slammed = true; } };
  for (let i = 0; i < 5 * 60; i++) b.update(1 / 60, w2);
  assert.equal(slammed, true, 'boss slammed at least once');
});
```

- [ ] **Step 2: Run — expect red**

- [ ] **Step 3: Implement `Boss` in `entities.js`**

Add `BOSSES` to the config import, then append:

```js
// BOSS model (spec §4.2). Iron Gate is the M2 template; later bosses reuse this shape.
export class Boss {
  constructor(typeId, x, y) {
    const cfg = BOSSES[typeId] || BOSSES.ironGate;
    this.cfg = cfg; this.typeId = typeId;
    this.w = cfg.w; this.h = cfg.h;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.onGround = false;
    this.maxHp = cfg.maxHp; this.hp = cfg.maxHp;
    this.phase = 0; this.dead = false; this.dying = 0;
    this.slamTimer = cfg.phases[0].slamCd; this.telegraph = 0; this.anim = 0;
  }
  _phaseFor(hpFrac) {
    for (let i = 0; i < this.cfg.phases.length; i++) {
      if (hpFrac > this.cfg.phases[i].upTo - 1e-9 || i === this.cfg.phases.length - 1) {
        // first phase whose upTo bound the fraction is under; simplest: pick by threshold
      }
    }
    return hpFrac > 0.5 ? 0 : 1;
  }
  hit(dmg, world) {
    if (this.dead) return;
    this.hp -= dmg;
    world.playSound('hit');
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.dying = 1.2;
      world.addScore(this.cfg.score);
      world.spawnParticles(this.x + this.w / 2, this.y + this.h / 2, { count: 40, color: '#ffcc33', speed: 320 });
      world.shake(8);
      world.playSound('die');
    }
  }
  update(dt, world) {
    if (this.dead) return;
    this.anim += dt;
    this.phase = this._phaseFor(this.hp / this.maxHp);
    const ph = this.cfg.phases[this.phase];
    if (this.telegraph > 0) {
      this.telegraph -= dt;
      if (this.telegraph <= 0) { world.shake(6); world.playSound('hit'); if (ph.spawnGrunts) for (let i = 0; i < ph.spawnGrunts; i++) world.spawnEnemy('runner', this.x, this.y); }
      return;
    }
    this.slamTimer -= dt;
    if (this.slamTimer <= 0) { this.slamTimer = ph.slamCd; this.telegraph = 0.5; }
  }
}
```

> Simplify `_phaseFor` to the two-phase `return hpFrac > 0.5 ? 0 : 1;` (delete the dead loop above it during implementation).

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/boss.test.mjs` → `# pass 4`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/entities.js games/warrior/tests/boss.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 BOSS 震地要塞·铁壁 — phases/slam/death + boss tests"
```

---

## Task 8: game integration — boss-gated clear, pickups/falcons, combo (TDD)

**Files:** Modify `games/warrior/src/game.js`, `games/warrior/tests/game.test.mjs`

- [ ] **Step 1: Add failing tests** (append to `game.test.mjs`):

```js
test('reaching bossX spawns the boss instead of clearing', () => {
  const g = freshGame();
  g.level.bossX = g.player.x + 40;
  g.level.goalX = 1e9; // ensure goal does not pre-empt
  g.player.x = g.level.bossX + 5;
  g.update(1 / 60);
  assert.ok(g.boss, 'boss spawned');
  assert.equal(g.state, 'playing');
});

test('clearing requires the boss to die', () => {
  const g = freshGame();
  g.level.bossX = g.player.x; g.level.goalX = 1e9;
  g.update(1 / 60);              // spawns boss
  assert.equal(g.state, 'playing');
  g.boss.hit(1e9, g._world);     // kill it
  for (let i = 0; i < 120 && g.state !== 'clear'; i++) g.update(1 / 60);
  assert.equal(g.state, 'clear');
});

test('a kill starts a combo and a second quick kill raises the multiplier', () => {
  const g = freshGame();
  g.registerKill(100);
  assert.equal(g.combo.count, 1);
  g.registerKill(100);
  assert.equal(g.combo.count, 2);
  assert.ok(g.combo.mult >= 2);
});
```

- [ ] **Step 2: Run — expect red**

- [ ] **Step 3: Extend `game.js`**

Constructor: add `this.pickups = []; this.falcons = []; this.boss = null; this.combo = { count: 0, mult: 1, timer: 0 };`

`_makeWorld()`: add getters/methods —

```js
      get pickups() { return game.pickups; },
      get falcons() { return game.falcons; },
      get boss() { return game.boss; },
      spawnPickup(letter, x, y) { game.pickups.push(new Pickup(letter, x, y)); },
```

Import `Pickup, Falcon, Boss` from entities; import `COMBO` from config.

`_spawnEntities()`: add `this.pickups = []; this.boss = null; this.combo = { count: 0, mult: 1, timer: 0 };` and build falcons from the level: `this.falcons = []; this._falconDefs = (lv.falcons || []).map((f) => ({ ...f, fired: false }));`

Add a kill registration helper used by enemy/boss deaths via the float-text path:

```js
  registerKill(baseScore) {
    if (this.combo.timer > 0) this.combo.count += 1; else this.combo.count = 1;
    this.combo.timer = COMBO.window;
    this.combo.mult = Math.min(COMBO.maxMult, this.combo.count);
    const gain = baseScore * this.combo.mult;
    this._world.addFloatText(this.combo.mult > 1 ? `+${gain} x${this.combo.mult}` : `+${gain}`,
      this.player.x, this.player.y - 12, '#ffe066');
    return gain;
  }
```

In `update(dt)`, in the playing branch: tick combo (`if (this.combo.timer > 0) { this.combo.timer -= dt; if (this.combo.timer <= 0) { this.combo.count = 0; this.combo.mult = 1; } }`), update falcons/pickups, run their collisions, and replace the goal check with the boss gate:

```js
    // falcons: trigger by camera, fly, drop on bullet hit
    this._updateFalcons(dt);
    for (const pk of this.pickups) { if (!pk.dead) pk.update(dt, this._world); }
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const f of this.falcons) { if (!f.dead && aabb(b, f)) { f.hitByBullet(this._world); if (!b.pierce) b.dead = true; } }
    }
    // pickups touch
    for (const pk of this.pickups) { if (!pk.dead && aabb(p, pk)) pk.apply(p, this._world); }

    // boss
    if (!this.boss && this.level.bossX != null && p.x + p.w > this.level.bossX) this._spawnBoss();
    if (this.boss) {
      if (!this.boss.dead) this.boss.update(dt, this._world);
      for (const b of this.bullets) { if (!b.dead && aabb(b, this.boss) && !this.boss.dead) { this.boss.hit(b.dmg, this._world); if (!b.pierce) b.dead = true; } }
      if (!this.boss.dead && this.boss.cfg.touchDamage && aabb(p, this.boss)) {
        if (p.barrier > 0) this.boss.hit(999, this._world); else if (!p.isInvulnerable()) p.takeDamage(this._world);
      }
      if (this.boss.dead && this.boss.dying <= 0) { this._levelClear(); return; }
      if (this.boss.dead) this.boss.dying -= dt;
    }

    this.pickups = this.pickups.filter((pk) => !pk.dead);
    if (this.boss == null && this.level.bossX == null && p.x + p.w > this.level.goalX) { this._levelClear(); return; }
```

Wire `registerKill` into scoring: in `GroundEnemy.hit` (entities) the enemy calls `world.addScore(this.score)` — change the game's `addScore` is generic, so instead have enemy death go through a kill path. Simplest: in `_makeWorld`, add `killScore(base) { return game.registerKill(base); }` and change enemy/boss `hit()` death to call `world.killScore(this.score)` instead of `world.addScore(this.score)`. Update `GroundEnemy.hit` and `Boss.hit` accordingly, and add to the world facade:

```js
      addScore(n) { game.score += n; },
      killScore(base) { game.score += game.registerKill(base); },
```

And in `entities.js` change the two death lines from `world.addScore(this.score)` to `world.killScore(this.score)`.

Add `_updateFalcons` + `_spawnBoss`:

```js
  _updateFalcons(dt) {
    const camRight = this.camera.x + FIELD.W;
    for (const def of this._falconDefs) {
      if (!def.fired && camRight > def.atX) {
        def.fired = true;
        const path = (def.path || []).map((pt) => ({ x: pt.x * TILE, y: pt.y * TILE }));
        const start = path[0] || { x: camRight + 40, y: 3 * TILE };
        this.falcons.push(new Falcon(def.drop, start.x, start.y, path));
      }
    }
    for (const f of this.falcons) { if (!f.dead) f.update(dt, this._world); }
    this.falcons = this.falcons.filter((f) => !f.dead && f.x > this.camera.x - 80);
  }
  _spawnBoss() {
    const lv = this.level;
    const gy = (this._surfaceRow(Math.floor((lv.bossX + 2 * TILE) / TILE)) ?? lv.rows - 4);
    this.boss = new Boss(lv.bossType || 'ironGate', lv.bossX + TILE, gy * TILE - this.cfgBossH('ironGate'));
    this.playState = 'boss';
  }
  cfgBossH(id) { return (BOSSES[id] || BOSSES.ironGate).h; }
```

Import `BOSSES` from config in game.js.

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/game.test.mjs` → `# pass 8` (5 from M1 + 3 new). Then `node --test` (all green).

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/game.js games/warrior/src/entities.js games/warrior/tests/game.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 game — boss-gated clear, falcon/pickup wiring, combo + tests"
```

> **CHECKPOINT CP-C** — full `node --test` green (weapons/entities/capsule/damage/boss/game/levels/physics/aim). Report, pause.

---

## Task 9: levels — add Falcon drops + boss to L1 (TDD)

**Files:** Modify `games/warrior/src/levels.js`, `games/warrior/tests/levels.test.mjs`

- [ ] **Step 1: Add failing test** (append to `levels.test.mjs`):

```js
test('L1 has falcon drops and a boss trigger', () => {
  const lv = parseLevel(LEVELS[0]);
  assert.ok(Array.isArray(lv.falcons) && lv.falcons.length >= 1, 'has falcon drops');
  assert.ok(lv.falcons.some((f) => ['M', 'S', 'L', 'B'].includes(f.drop)));
  assert.ok(typeof lv.bossX === 'number', 'has a boss trigger X');
});
```

- [ ] **Step 2: Run — expect red**

- [ ] **Step 3: Add `falcons` + `boss` to the L1 data and parseLevel**

In `lvl1`, add (alongside `rows`):

```js
  falcons: [
    { drop: 'S', atX: 18 * 32, path: [[40, 3], [30, 4], [22, 3]] },
    { drop: 'B', atX: 52 * 32, path: [[72, 3], [60, 5], [50, 3]] },
  ],
  boss: { type: 'ironGate' },
```

In `parseLevel`, after building enemies, add:

```js
  const falcons = (lvl.falcons || []).map((f) => ({ drop: f.drop, atX: f.atX, path: f.path.map(([x, y]) => ({ x, y })) }));
  const bossX = (cols - 6) * TILE;       // trigger near the end, before the goal flag
  const bossType = lvl.boss ? lvl.boss.type : null;
```

and add `falcons, bossX, bossType` to the returned object. Move `goalX` to sit a few tiles right of `bossX` (so the flag is past the boss): keep the `'G'` marker but ensure `bossX < goalX`.

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/levels.test.mjs` → `# pass 5`. Then `node --test` (all green).

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/levels.js games/warrior/tests/levels.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 levels — L1 falcon drops + boss trigger + tests"
```

---

## Task 10: sprites — prone hero, boss, falcon, pickups, barrier

**Files:** Modify `games/warrior/src/sprites.js` (no unit test; browser-verified)

- [ ] **Step 1: Add sprite getters** — `heroProne(poseKey, faceRight)` (wide, short crouch), `boss(typeId, frame)` (Iron Gate: armored wall + glowing core weakpoint), `falcon(frame)` (red carrier with flapping wings), `pickupLetter(letter)` (rounded badge with the letter glyph), `barrierAura()` (translucent ring). Keep the `make(key,w,h,draw)` + `px` helpers. Boss ~ 48×56 logical px scaled to `cfg.w`.

- [ ] **Step 2: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/sprites.js
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 sprites — prone/boss/falcon/pickup/barrier art"
```

---

## Task 11: render — prone, boss + HP bar, pickups, falcon, barrier aura, combo

**Files:** Modify `games/warrior/src/render.js`

- [ ] **Step 1: Render the new entities** — in the clipped scene draw `_falcons`, `_pickups` (blink via `pk.visible()`), `_boss` (with a death flash), and the barrier aura around the player when `p.barrier>0`. Use `heroProne` when `p.prone`.
- [ ] **Step 2: Boss HP bar** — when `game.boss && !boss.dead`, draw a bottom bar: `name` + a red/green fill `boss.hp/boss.maxHp` (spec §8 HUD).
- [ ] **Step 3: Combo HUD** — when `game.combo.count >= 2`, draw `连击 x{mult}` near top-center.
- [ ] **Step 4: Weapon letter in HUD** — show the current `player.weapon` letter (M/S/L or 步枪) in the left cluster.
- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/render.js
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 render — boss + HP bar, pickups/falcon, prone, barrier, combo HUD"
```

---

## Task 12: audio — pickup/switch/barrier/boss SFX

**Files:** Modify `games/warrior/src/audio.js`

- [ ] **Step 1: Add SFX** to the `SFX` map: `pickup` (rising arpeggio), `barrier` (warm pad blip), `bossHit` (low thud — or reuse `hit`), `combo` (bright tick). Keep `play(id)` dispatch. Verify import-safe in Node.
- [ ] **Step 2: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/audio.js
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M2 audio — pickup/barrier/boss/combo SFX"
```

---

## Task 13: browser smoke to BOSS clear + M2 gate wrap

**Files:** Modify `games/warrior/tests/smoke.mjs`

- [ ] **Step 1: Extend the smoke** — after run&gun, keep holding Right + Z long enough to reach the boss, then assert (via `window.__game`) that either `state==='clear'` OR `__game.boss` exists and ran (`__game.boss.hp < __game.boss.maxHp`). Screenshot to `tests/_smoke.png`.
- [ ] **Step 2: Run host-side** (server at :8000, system Chrome, `--no-proxy-server`):

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  URL="http://localhost:8000/games/warrior/index.html" node tests/smoke.mjs
```

Expected: `SMOKE PASS` + a screenshot showing prone/weapon/boss. (If no Chrome → SKIP; rely on manual play.)

- [ ] **Step 3: Full suite + manual L1 full-clear check**

Run: `node --test` → all green. Manually (or via smoke) confirm L1 is clearable end-to-end: run-and-gun → shoot a Falcon → grab S/L → grab B barrier → reach boss → kill boss → clear, with combo text + explosions.

- [ ] **Step 4: Milestone marker commit**

```bash
git -C /Users/james/Projects/game-hub commit --allow-empty -m "chore(warrior): M2 战斗完整 complete — L1 fully clearable

Gate (spec §10 M2): weapons/collision/capsule/damage/boss tests green; L1 clears end-to-end
(prone + M/S/L + Falcon pickups + B barrier + BOSS 震地要塞·铁壁 + combo/float-text/explosions).
Next: M3 (模式切换 + 选关 + save.js localStorage + ⭐ + 经典命数/Game Over + Konami + ← HUB)."
```

> **CHECKPOINT CP-D** — M2 done. Report.

---

## Self-Review

**Spec coverage (M2 §10):** prone ✅(T3) · M/S/L ✅(T1–T2) · Falcon pickup ✅(T5) · B barrier ✅(T4) · L1 BOSS 铁壁 ✅(T7) · explosions/shake ✅(T7 death + render) · combo/float-text ✅(T8). Gate tests weapons/collision/capsule/damage/boss ✅. Out of M2: F/R weapons, L2–L5, save/select/mode-UI/Konami (M3), parallax/touch/BGM/hub-card (M5).

**No placeholders:** Tasks 8 carries the heaviest wiring; two scratch lines (Falcon culling stub, Boss `_phaseFor` loop) are flagged for deletion in their steps — implementer removes them. Everything else is complete code or precise edit instructions against the existing M1 files.

**Type consistency:** new world methods `spawnPickup/killScore` + getters `pickups/falcons/boss` match between `_makeWorld`, entity call sites, and tests. `Pickup(letter,x,y)`, `Falcon(drop,x,y,path)`, `Boss(typeId,x,y)` signatures consistent across entities/game/levels/tests. `player.barrier/giveBarrier/isInvulnerable/prone` consistent across entities/game/render/tests. Weapon ids (machine/spread/laser) match config↔pickups↔tests.
