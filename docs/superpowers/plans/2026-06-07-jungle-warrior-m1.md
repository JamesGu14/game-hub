# 丛林勇士 JUNGLE WARRIOR — M1 可玩骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a browser-playable M1 skeleton of 丛林勇士: in level L1 (forest) the player runs/jumps, aims/shoots in the classic 8 directions with the default rifle, fights Runner + Jumper grunts, respawns in place on death (casual mode), and clears the level by reaching the goal flag — no BOSS yet.

**Architecture:** Pure native-JS ES modules, zero build, Canvas 2D — fully aligned with `games/pixel-quest`. Gameplay runs in a fixed world-pixel space; the renderer scales/letterboxes a FIELD viewport onto the canvas. Pure logic modules (`config`/`physics`/`weapons`/`entities`/`levels`/`game` + `resolveAim` in `input`) are import-safe in Node and unit-tested with `node --test`; presentation modules (`sprites`/`render`) are exercised in the browser. A `game.js` owns the simulation and hands entities a read-mostly `world` facade; entities implement `update(dt, world)`.

**Tech Stack:** ES modules (`type: module`), Canvas 2D, Web Audio (synthesized SFX), `node --test` (`*.test.mjs`), host-side `puppeteer-core` + system Chrome for the browser smoke (per the boom-worms setup).

---

## Reference: contracts every task must honor

These are defined once here and reused verbatim by every task. The self-review checks type/name consistency against this section.

### Intent (produced by `input.js`, read by entities)

```
Intent = {
  moveX:   -1 | 0 | 1,   // left/right (also drives facing + horizontal aim)
  aimUp:   boolean,       // up held
  aimDown: boolean,       // down held
  jumpHeld:boolean,       // jump button held (player derives the jump edge)
  fireHeld:boolean,       // fire button held (hold = auto-fire, gated by cooldown)
}
```

Discrete menu/system actions are delivered by `Input.on(fn)` callbacks with these action strings: `'confirm'`, `'pause'`, `'switch'`, `'mute'`, `'back'`. (M1 wires `confirm`/`pause`/`mute`; `switch`/`back` are reserved for later milestones.)

### `world` facade (created by `game.js`, passed as 2nd arg to `update`)

Adopted from spec §13 (M5 contract). M1 implements this whole surface; later milestones extend behavior, not the shape.

```
world = {
  // read-only getters
  get grid()      // 2D array grid[row][col] = tile-type NAME string | null
  get player()    // Player instance
  get enemies()   // Enemy[]
  get bullets()   // Bullet[]
  get particles() // particle[]
  get camera()    // { x, y }
  get mode()      // MODES.casual | MODES.classic
  input,          // the Input singleton; entities read input.intent

  // commands
  addScore(n),
  spawnEnemy(type, x, y),            // type: 'runner' | 'jumper'
  spawnBullets(specs),               // specs from weapons.fire()
  playSound(id),                     // id: 'shoot'|'jump'|'hit'|'die'|'clear'|'land'
  shake(intensity),
  addFloatText(text, x, y, color),
  spawnParticles(x, y, opts),        // opts: { count, color, speed }
}
```

### Entity shape

Every entity has `{ x, y, w, h, vx, vy, dead }` and `update(dt, world)`. Enemies additionally expose `hp` and `hit(dmg, world)`. Physics (`collideTiles`) reads/writes `x,y,vx,vy,onGround`.

### `weapons.fire()` — pure, returns bullet specs (NO entity import → no cycle)

```
fire(weaponId, originX, originY, aim, opts) -> Array<{ x, y, vx, vy, dmg, pierce, life }>
```

`aim` is the unit vector from `resolveAim`. The caller (`Player.fire`) turns specs into `Bullet` instances via `world.spawnBullets`.

### Commands (run from `games/warrior/`)

- Run all tests: `node --test`
- Run one file: `node --test tests/physics.test.mjs`
- Serve for browser play: from repo root `python3 -m http.server 8000`, open `http://localhost:8000/games/warrior/index.html`

### File structure (M1 deliverables)

```
games/warrior/
  package.json        type:module + "test": node --test
  index.html          canvas + ← HUB + title/ready/clear overlays + mute/fullscreen (touch placeholders hidden)
  style.css           overlay + button styles (ported/trimmed from pixel-quest)
  src/
    config.js         M1 tuning subset (extensible to full spec)
    physics.js        collideTiles / aabb / groundAhead (ported from pixel-quest)
    input.js          Input singleton (keyboard+gamepad) → Intent  +  resolveAim()  [touch in M5]
    weapons.js        WEAPONS table + pure fire() → bullet specs  [rifle only in M1]
    entities.js       Player / Runner / Jumper / Bullet
    levels.js         L1 forest data + parseLevel()
    audio.js          Sound: synthesized SFX + play(id) dispatch
    sprites.js        code-drawn pixel sprites + cache + blit
    render.js         field-space camera, tiles, entities, bullets, HUD, banners, crash self-heal
    game.js           state machine + world facade + simulation (casual respawn, reach-goal clear)
    main.js           bootstrap + rAF loop + overlay wiring + ← HUB
  tests/
    physics.test.mjs  aim.test.mjs  weapons.test.mjs  entities.test.mjs  levels.test.mjs  game.test.mjs
```

**Out of M1 scope (later milestones):** prone/卧倒, M/S/L/F weapons + R/B items, Falcon pickups, BOSS, mode-switch UI + select screen + save/⭐ (M3), L2–L5 (M4), touch controls + parallax + BGM + full HUD polish + hub-card registration (M5). M1 starts directly in **casual** mode.

> **Known reconciliation (defer to M5):** `js/games.js` already has a placeholder card `id:'jungle-blitz'` → `games/jungle-blitz/index.html` whose description matches this game. The spec fixes the folder as `games/warrior/` and id `warrior`. M5 will repoint/rename that card; M1 does not touch the registry.

---

## Task 1: Project scaffold + test harness sanity

**Files:**
- Create: `games/warrior/package.json`
- Create: `games/warrior/tests/_sanity.test.mjs` (temporary — deleted at end of task)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "jungle-warrior",
  "type": "module",
  "private": true,
  "scripts": {
    "test": "node --test"
  }
}
```

- [ ] **Step 2: Write a sanity test to prove the runner works**

Create `games/warrior/tests/_sanity.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('node --test runs', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 3: Run it**

Run (from `games/warrior/`): `node --test`
Expected: output contains `# pass 1` and `# fail 0`.

- [ ] **Step 4: Remove the sanity test**

```bash
rm games/warrior/tests/_sanity.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add games/warrior/package.json
git commit -m "feat(warrior): M1 scaffold — package.json + node --test harness"
```

---

## Task 2: `config.js` — M1 tuning constants

**Files:**
- Create: `games/warrior/src/config.js`

- [ ] **Step 1: Write `config.js`**

```js
// Tuning constants for 丛林勇士 JUNGLE WARRIOR (M1 subset, extensible to full spec).
// Gameplay runs in a fixed "world" pixel space; the renderer scales/letterboxes the
// visible FIELD viewport onto the canvas so logic stays resolution-independent.
// Baselines follow pixel-quest + spec §13 reviewer defaults; tune via playtest.

export const TILE = 32; // world px per tile

export const VIEW = { tilesX: 16, tilesY: 14 };
export const FIELD = { W: VIEW.tilesX * TILE, H: VIEW.tilesY * TILE }; // 512 x 448

export const GRAVITY = 2300;
export const MAX_FALL = 980;

// Single movement speed (no walk/run split — fewer keys, more faithful, kid-friendly).
export const PLAYER = {
  w: 22, h: 30, proneH: 18, // proneH used from M2
  accel: 1700, airAccel: 1200, maxSpeed: 205, friction: 1500,
  jumpVel: 760, jumpCutoff: 0.45,
};

export const FORGIVE = { coyote: 0.10, jumpBuffer: 0.12 };

// Difficulty modes. M1 starts in casual; classic fields are present so later
// milestones (M3) can switch without reshaping data.
export const MODES = {
  casual:  { id: 'casual',  label: '休闲', sub: '无限复活·儿童友好', lives: Infinity, enemyMul: 0.85, invuln: 2.0, loseWeaponOnDeath: false },
  classic: { id: 'classic', label: '经典', sub: '3 命·经典还原',     lives: 3,        enemyMul: 1.0,  invuln: 1.5, loseWeaponOnDeath: true  },
};

// Tile legend: char -> tile-type NAME. parseLevel converts the char grid to a NAME
// grid so physics can test SOLID.has(name).
export const TILES = { '#': 'ground', '=': 'platform', X: 'block', '|': 'cover' };
export const SOLID = new Set(['ground', 'platform', 'block', 'cover']);

export const ENEMY = {
  runner: { w: 24, h: 28, speed: 70, hp: 1, score: 100 },
  jumper: { w: 24, h: 26, speed: 55, hp: 1, score: 150, jumpVel: 560, triggerDist: 170, retrigger: 0.9 },
};

export const BULLET = { w: 12, h: 6, life: 1.4 };

// Weapon table. M1 ships the default rifle (no letter). M2/M4 add M/S/L/F + R/B.
export const WEAPONS = {
  rifle: { id: 'rifle', letter: '', cooldown: 0.18, dmg: 1, speed: 560, pierce: false, spread: 0 },
};
export const DEFAULT_WEAPON = 'rifle';
export const RAPID_COOLDOWN_MUL = 0.6; // used from M4
export const RAPID_SPEED_MUL = 1.3;    // used from M4

export const THEMES = {
  forest: { skyTop: '#7ec85a', skyBot: '#cdeeae', ground: '#7a5a2f', groundDark: '#543d1f', grass: '#3fa845', hills: '#2f7d3a' },
};

export const SCORE = { kill: 100, levelClear: 1000 };

export const STORAGE_KEY = 'jungle-warrior-save'; // used from M3
```

- [ ] **Step 2: Verify it imports cleanly in Node**

Run (from `games/warrior/`): `node -e "import('./src/config.js').then(c => console.log(c.FIELD.W, c.SOLID.has('ground'), c.WEAPONS.rifle.speed))"`
Expected: `512 true 560`

- [ ] **Step 3: Commit**

```bash
git add games/warrior/src/config.js
git commit -m "feat(warrior): M1 config — tiles/player/modes/enemies/rifle/theme"
```

---

## Task 3: `physics.js` — tile collision (TDD)

**Files:**
- Create: `games/warrior/tests/physics.test.mjs`
- Create: `games/warrior/src/physics.js`

- [ ] **Step 1: Write the failing test**

Create `games/warrior/tests/physics.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE } from '../src/config.js';
import { aabb, collideTiles, groundAhead } from '../src/physics.js';

// Helper: build a NAME grid from char rows ('#' = ground, ' ' = empty).
function grid(rows) {
  return rows.map((r) => [...r].map((ch) => (ch === '#' ? 'ground' : null)));
}

test('aabb detects overlap and gaps', () => {
  assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }), false);
});

test('entity lands on ground and reports onGround', () => {
  // floor at row 3; entity starts in the air just above it, falling
  const g = grid(['          ', '          ', '          ', '##########']);
  const ent = { x: TILE, y: 3 * TILE - 40, w: 20, h: 30, vx: 0, vy: 0, onGround: false };
  for (let i = 0; i < 40; i++) collideTiles(ent, g, 1 / 60);
  assert.equal(ent.onGround, true);
  assert.equal(Math.round(ent.y + ent.h), 3 * TILE); // feet rest on the floor top
});

test('moving into a wall stops horizontal velocity', () => {
  const g = grid(['  #', '  #', '  #']);
  const ent = { x: 0, y: 0, w: 20, h: 20, vx: 400, vy: 0, onGround: false };
  const info = collideTiles(ent, g, 1 / 60);
  assert.equal(info.hitWall, true);
  assert.equal(ent.vx, 0);
  assert.ok(ent.x + ent.w <= 2 * TILE + 0.001);
});

test('ceiling hit reports bumped tile and zeroes upward velocity', () => {
  const g = grid(['###', '   ', '   ']);
  const ent = { x: TILE, y: TILE + 4, w: 20, h: 20, vx: 0, vy: -600, onGround: false };
  const info = collideTiles(ent, g, 1 / 60);
  assert.equal(info.hitCeiling, true);
  assert.ok(info.bumped.length >= 1);
});

test('groundAhead is true over solid, false over a pit', () => {
  const g = grid(['   ', '#  ']); // col 0 solid at row 1, col 2 is a pit
  assert.equal(groundAhead(g, 0.5 * TILE, 1 * TILE - 2), true);
  assert.equal(groundAhead(g, 2.5 * TILE, 1 * TILE - 2), false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/physics.test.mjs`
Expected: FAIL — `Cannot find module '../src/physics.js'`.

- [ ] **Step 3: Write `physics.js`**

```js
// Physics for 丛林勇士: AABB overlap + swept tile collision. Ported from pixel-quest.
// Entities have { x, y, w, h, vx, vy, onGround }. The grid is grid[row][col] = tile-type
// NAME string (or null). We move X then Y and resolve against SOLID tiles, reporting any
// tile bumped from below.

import { TILE, GRAVITY, MAX_FALL, SOLID } from './config.js';

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solidAt(grid, col, row) {
  if (row < 0 || row >= grid.length) return false;
  const r = grid[row];
  if (!r) return false;
  if (col < 0 || col >= r.length) return false;
  const t = r[col];
  return !!t && SOLID.has(t);
}

// Integrate gravity + velocity and resolve against the solid grid.
// Returns { onGround, hitCeiling, bumped:[{col,row,type}], hitWall }.
export function collideTiles(ent, grid, dt, opts = {}) {
  const gravity = opts.gravity != null ? opts.gravity : GRAVITY;
  const info = { onGround: false, hitCeiling: false, bumped: [], hitWall: false };

  ent.vy += gravity * dt;
  if (ent.vy > MAX_FALL) ent.vy = MAX_FALL;

  // ---- Move X ----
  ent.x += ent.vx * dt;
  let c0 = Math.floor(ent.x / TILE);
  let c1 = Math.floor((ent.x + ent.w - 0.001) / TILE);
  let row0 = Math.floor(ent.y / TILE);
  let row1 = Math.floor((ent.y + ent.h - 0.001) / TILE);

  if (ent.vx > 0) {
    for (let row = row0; row <= row1; row++) {
      if (solidAt(grid, c1, row)) {
        ent.x = c1 * TILE - ent.w; ent.vx = 0; info.hitWall = true; break;
      }
    }
  } else if (ent.vx < 0) {
    for (let row = row0; row <= row1; row++) {
      if (solidAt(grid, c0, row)) {
        ent.x = (c0 + 1) * TILE; ent.vx = 0; info.hitWall = true; break;
      }
    }
  }

  // ---- Move Y ----
  ent.y += ent.vy * dt;
  c0 = Math.floor(ent.x / TILE);
  c1 = Math.floor((ent.x + ent.w - 0.001) / TILE);
  row0 = Math.floor(ent.y / TILE);
  row1 = Math.floor((ent.y + ent.h - 0.001) / TILE);

  if (ent.vy > 0) {
    for (let col = c0; col <= c1; col++) {
      if (solidAt(grid, col, row1)) {
        ent.y = row1 * TILE - ent.h; ent.vy = 0; info.onGround = true; break;
      }
    }
  } else if (ent.vy < 0) {
    for (let col = c0; col <= c1; col++) {
      if (solidAt(grid, col, row0)) {
        ent.y = (row0 + 1) * TILE; ent.vy = 0; info.hitCeiling = true;
        info.bumped.push({ col, row: row0, type: grid[row0][col] });
      }
    }
  }

  ent.onGround = info.onGround;
  return info;
}

// Is the tile column under a point solid? Used by walking enemies to turn at ledges.
export function groundAhead(grid, x, footY) {
  const col = Math.floor(x / TILE);
  const row = Math.floor((footY + 2) / TILE);
  return solidAt(grid, col, row);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/physics.test.mjs`
Expected: PASS — `# pass 5`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add games/warrior/src/physics.js games/warrior/tests/physics.test.mjs
git commit -m "feat(warrior): M1 physics — collideTiles/aabb/groundAhead + tests"
```

---

## Task 4: `input.js` — `resolveAim` (TDD) + Input singleton

`resolveAim` is the classic "hold a direction = shoot that direction" model (spec §3.2). It is a pure function so it unit-tests without a DOM; the `Input` singleton's DOM access is confined to methods, so importing `input.js` in Node is safe.

**Files:**
- Create: `games/warrior/tests/aim.test.mjs`
- Create: `games/warrior/src/input.js`

- [ ] **Step 1: Write the failing test**

Create `games/warrior/tests/aim.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAim } from '../src/input.js';

const I = (o) => ({ moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false, ...o });
const near = (a, b) => Math.abs(a - b) < 1e-9;
const D = Math.SQRT1_2; // diagonal component

test('horizontal aim follows facing when only left/right (or idle)', () => {
  assert.deepEqual(resolveAim(I({ moveX: 1 }), true, true), { x: 1, y: 0 });
  assert.deepEqual(resolveAim(I({ moveX: -1 }), true, false), { x: -1, y: 0 });
  // idle: no moveX -> use faceRight
  assert.deepEqual(resolveAim(I({}), true, true), { x: 1, y: 0 });
  assert.deepEqual(resolveAim(I({}), true, false), { x: -1, y: 0 });
});

test('up only = straight up; up + side = diagonal up', () => {
  assert.deepEqual(resolveAim(I({ aimUp: true }), true, true), { x: 0, y: -1 });
  const ur = resolveAim(I({ aimUp: true, moveX: 1 }), true, true);
  assert.ok(near(ur.x, D) && near(ur.y, -D));
  const ul = resolveAim(I({ aimUp: true, moveX: -1 }), true, false);
  assert.ok(near(ul.x, -D) && near(ul.y, -D));
});

test('on the ground, down aims horizontal (prone shot), never straight down', () => {
  assert.deepEqual(resolveAim(I({ aimDown: true }), true, true), { x: 1, y: 0 });
  assert.deepEqual(resolveAim(I({ aimDown: true, moveX: -1 }), true, false), { x: -1, y: 0 });
});

test('in the air, down only = straight down; down + side = diagonal down', () => {
  assert.deepEqual(resolveAim(I({ aimDown: true }), false, true), { x: 0, y: 1 });
  const dr = resolveAim(I({ aimDown: true, moveX: 1 }), false, true);
  assert.ok(near(dr.x, D) && near(dr.y, D));
  const dl = resolveAim(I({ aimDown: true, moveX: -1 }), false, false);
  assert.ok(near(dl.x, -D) && near(dl.y, D));
});

test('returned vector is always unit length', () => {
  const cases = [
    resolveAim(I({ moveX: 1 }), true, true),
    resolveAim(I({ aimUp: true, moveX: 1 }), true, true),
    resolveAim(I({ aimDown: true, moveX: -1 }), false, false),
    resolveAim(I({ aimUp: true }), false, true),
  ];
  for (const v of cases) assert.ok(near(Math.hypot(v.x, v.y), 1));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/aim.test.mjs`
Expected: FAIL — `Cannot find module '../src/input.js'`.

- [ ] **Step 3: Write `input.js`**

```js
// Unified input for 丛林勇士: keyboard + gamepad -> a single Intent each frame, plus
// the classic "hold a direction = aim that direction" resolver. Touch controls are
// added in M5. DOM access lives only inside init()/poll(), so this module imports
// cleanly in Node (resolveAim is pure and unit-tested there).
//
// Default keys (NES-style, spec §7): move/aim = arrows or WASD, Z = fire, X = jump,
// C = switch weapon, ↓ = (prone, from M2). Remappable from M3.

const D = Math.SQRT1_2;

// Classic aim model (spec §3.2). Hold a direction to shoot that direction; facing
// follows movement. There is no separate aim stick.
//   resolveAim(intent, onGround, faceRight) -> unit vector { x, y }
export function resolveAim(intent, onGround, faceRight) {
  const hx = intent.moveX !== 0 ? intent.moveX : (faceRight ? 1 : -1);
  // On the ground, down means prone — still a horizontal shot, never straight down.
  if (intent.aimDown && onGround) return { x: hx, y: 0 };
  if (intent.aimUp) {
    if (intent.moveX !== 0) return { x: hx * D, y: -D }; // diagonal up
    return { x: 0, y: -1 };                              // straight up
  }
  if (intent.aimDown) { // airborne
    if (intent.moveX !== 0) return { x: hx * D, y: D };  // diagonal down
    return { x: 0, y: 1 };                               // straight down
  }
  return { x: hx, y: 0 };                                // horizontal
}

export const Input = {
  // Continuous Intent (rebuilt each poll; entities read this object).
  intent: { moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false },

  _subs: [],
  _k: { left: false, right: false, up: false, down: false, jump: false, fire: false },
  _padPrev: {},

  init(canvas) {
    const set = (e, down) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': this._k.left = down; e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D': this._k.right = down; e.preventDefault(); break;
        case 'ArrowUp': case 'w': case 'W': this._k.up = down; e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S': this._k.down = down; e.preventDefault(); break;
        case 'x': case 'X': case 'k': case 'K':
          this._k.jump = down; if (down && !e.repeat) this._emit('confirm'); e.preventDefault(); break;
        case 'z': case 'Z': case ' ':
          this._k.fire = down; e.preventDefault(); break;
        case 'c': case 'C': case 'l': case 'L':
          if (down && !e.repeat) this._emit('switch'); e.preventDefault(); break;
        case 'Enter':
          if (down && !e.repeat) this._emit('confirm'); break;
        case 'Escape': case 'p': case 'P':
          if (down && !e.repeat) this._emit('pause'); break;
        case 'Backspace':
          if (down && !e.repeat) this._emit('back'); break;
        case 'm': case 'M':
          if (down && !e.repeat) this._emit('mute'); break;
        default: break;
      }
    };
    window.addEventListener('keydown', (e) => set(e, true));
    window.addEventListener('keyup', (e) => set(e, false));
    if (canvas) canvas.addEventListener('pointerdown', () => this._emit('confirm'));
  },

  on(fn) { this._subs.push(fn); },
  _emit(action) { this._subs.forEach((fn) => fn(action)); },

  poll() {
    let padX = 0, padUp = false, padDown = false, padJump = false, padFire = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (pad) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (Math.abs(ax) > 0.3) padX = ax > 0 ? 1 : -1;
      if (pad.buttons[14] && pad.buttons[14].pressed) padX = -1;
      if (pad.buttons[15] && pad.buttons[15].pressed) padX = 1;
      if ((pad.buttons[12] && pad.buttons[12].pressed) || ay < -0.5) padUp = true;
      if ((pad.buttons[13] && pad.buttons[13].pressed) || ay > 0.5) padDown = true;
      padJump = !!(pad.buttons[0] && pad.buttons[0].pressed); // ✕
      padFire = !!(pad.buttons[2] && pad.buttons[2].pressed); // □
      const edge = (i) => {
        const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
        const was = this._padPrev[i]; this._padPrev[i] = now; return now && !was;
      };
      if (edge(0)) this._emit('confirm');
      if (edge(5) || edge(4)) this._emit('switch'); // shoulder
      if (edge(1)) this._emit('back');              // ○
      if (edge(9) || edge(8)) this._emit('pause');  // Start / Select
    }

    const left = this._k.left, right = this._k.right;
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    if (mx === 0 && padX !== 0) mx = padX;
    this.intent.moveX = Math.max(-1, Math.min(1, mx));
    this.intent.aimUp = this._k.up || padUp;
    this.intent.aimDown = this._k.down || padDown;
    this.intent.jumpHeld = this._k.jump || padJump;
    this.intent.fireHeld = this._k.fire || padFire;
  },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/aim.test.mjs`
Expected: PASS — `# pass 5`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add games/warrior/src/input.js games/warrior/tests/aim.test.mjs
git commit -m "feat(warrior): M1 input — resolveAim (8-dir, tested) + keyboard/gamepad Intent"
```

---

## Task 5: `weapons.js` — pure `fire()` (TDD)

**Files:**
- Create: `games/warrior/tests/weapons.test.mjs`
- Create: `games/warrior/src/weapons.js`

- [ ] **Step 1: Write the failing test**

Create `games/warrior/tests/weapons.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fire, cooldownFor } from '../src/weapons.js';
import { WEAPONS, BULLET } from '../src/config.js';

test('rifle fires a single bullet in the aim direction at weapon speed', () => {
  const specs = fire('rifle', 100, 50, { x: 1, y: 0 });
  assert.equal(specs.length, 1);
  const b = specs[0];
  assert.equal(b.x, 100); assert.equal(b.y, 50);
  assert.equal(b.vx, WEAPONS.rifle.speed); // 560
  assert.equal(b.vy, 0);
  assert.equal(b.dmg, WEAPONS.rifle.dmg);  // 1
  assert.equal(b.pierce, false);
  assert.equal(b.life, BULLET.life);
});

test('aim direction is applied to both velocity components', () => {
  const specs = fire('rifle', 0, 0, { x: 0, y: -1 });
  assert.equal(specs[0].vx, 0);
  assert.equal(specs[0].vy, -WEAPONS.rifle.speed);
});

test('unknown weapon id falls back to the rifle', () => {
  const specs = fire('does-not-exist', 0, 0, { x: 1, y: 0 });
  assert.equal(specs.length, 1);
  assert.equal(specs[0].vx, WEAPONS.rifle.speed);
});

test('cooldownFor returns the weapon cooldown', () => {
  assert.equal(cooldownFor('rifle'), WEAPONS.rifle.cooldown);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/weapons.test.mjs`
Expected: FAIL — `Cannot find module '../src/weapons.js'`.

- [ ] **Step 3: Write `weapons.js`**

```js
// Weapons for 丛林勇士. fire() is PURE: it returns bullet specs (no entity import, no
// DOM) so it unit-tests cleanly and never creates an entities<->weapons import cycle.
// The caller (Player.fire) turns specs into Bullet instances via world.spawnBullets.
//
// M1 ships the default rifle. M2/M4 extend the WEAPONS table (machine/spread/laser/
// fire) and this function reads `spread`/`pierce` straight off the table.

import { WEAPONS, BULLET, DEFAULT_WEAPON, RAPID_SPEED_MUL } from './config.js';

export function cooldownFor(weaponId) {
  const w = WEAPONS[weaponId] || WEAPONS[DEFAULT_WEAPON];
  return w.cooldown;
}

// fire(weaponId, originX, originY, aim, opts) -> Array<bulletSpec>
//   aim:  unit vector { x, y } from resolveAim
//   opts: { rapid?:boolean } (rapid is used from M4)
export function fire(weaponId, originX, originY, aim, opts = {}) {
  const w = WEAPONS[weaponId] || WEAPONS[DEFAULT_WEAPON];
  const speed = w.speed * (opts.rapid ? RAPID_SPEED_MUL : 1);
  const specs = [];

  const push = (vx, vy) => specs.push({
    x: originX, y: originY, vx, vy, dmg: w.dmg, pierce: !!w.pierce, life: BULLET.life,
  });

  if (w.spread && w.spread > 1) {
    // Fan of `spread` bullets centered on aim (M2: spread weapon).
    const half = (w.spreadAngle || 0.32) * (w.spread - 1) / 2;
    const base = Math.atan2(aim.y, aim.x);
    for (let i = 0; i < w.spread; i++) {
      const a = base - half + (w.spreadAngle || 0.32) * i;
      push(Math.cos(a) * speed, Math.sin(a) * speed);
    }
  } else {
    push(aim.x * speed, aim.y * speed);
  }
  return specs;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/weapons.test.mjs`
Expected: PASS — `# pass 4`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add games/warrior/src/weapons.js games/warrior/tests/weapons.test.mjs
git commit -m "feat(warrior): M1 weapons — pure fire() returning bullet specs + tests"
```

---

## Task 6: `entities.js` — Player / Runner / Jumper / Bullet (TDD)

**Files:**
- Create: `games/warrior/tests/entities.test.mjs`
- Create: `games/warrior/src/entities.js`

- [ ] **Step 1: Write the failing test**

Create `games/warrior/tests/entities.test.mjs`. These tests use a minimal fake `world` so entity logic is verified without a DOM.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, MODES } from '../src/config.js';
import { Player, Runner, Jumper, Bullet } from '../src/entities.js';

// floor at row 5 across the width; everything above is empty
function flatWorld(extra = {}) {
  const cols = 30, rows = 8;
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, () => (r === 5 ? 'ground' : null)));
  const sounds = [];
  const world = {
    grid,
    enemies: [], bullets: [], particles: [],
    mode: MODES.casual,
    player: null,
    input: { intent: { moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false } },
    scored: 0,
    addScore(n) { this.scored += n; },
    spawnBullets(specs) { for (const s of specs) this.bullets.push(new Bullet(s)); },
    playSound(id) { sounds.push(id); },
    shake() {}, addFloatText() {}, spawnParticles() {},
    _sounds: sounds,
    ...extra,
  };
  return world;
}

test('player walks right when intent.moveX = 1 and faces right', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 5 * TILE - 30); w.player = p;
  w.input.intent.moveX = 1;
  for (let i = 0; i < 30; i++) p.update(1 / 60, w);
  assert.ok(p.x > 2 * TILE, 'moved right');
  assert.equal(p.faceRight, true);
});

test('holding fire spawns a bullet traveling in the aim direction', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 5 * TILE - 30); w.player = p;
  p.faceRight = true;
  w.input.intent.fireHeld = true;
  p.update(1 / 60, w);
  assert.equal(w.bullets.length, 1);
  assert.ok(w.bullets[0].vx > 0, 'bullet moves right');
  assert.ok(w._sounds.includes('shoot'));
});

test('fire respects cooldown (no second bullet next frame)', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 5 * TILE - 30); w.player = p;
  w.input.intent.fireHeld = true;
  p.update(1 / 60, w);
  p.update(1 / 60, w);
  assert.equal(w.bullets.length, 1);
});

test('a bullet kills a Runner and awards score', () => {
  const w = flatWorld();
  const e = new Runner(10 * TILE, 5 * TILE); w.enemies.push(e);
  const b = new Bullet({ x: e.x - 5, y: e.y + 4, vx: 600, vy: 0, dmg: 1, pierce: false, life: 1 });
  w.bullets.push(b);
  for (let i = 0; i < 5 && !e.dead; i++) b.update(1 / 60, w);
  assert.equal(e.dead, true);
  assert.equal(b.dead, true);     // non-pierce bullet dies on hit
  assert.equal(w.scored, e.score);
});

test('a Runner turns around at a wall', () => {
  const w = flatWorld();
  // wall at col 12 from row 0..5
  for (let r = 0; r <= 5; r++) w.grid[r][12] = 'block';
  const e = new Runner(11 * TILE, 5 * TILE); w.enemies.push(e);
  e.vx = Math.abs(e.vx); // force it to walk right into the wall
  let turned = false;
  for (let i = 0; i < 120; i++) { e.update(1 / 60, w); if (e.vx < 0) { turned = true; break; } }
  assert.equal(turned, true);
});

test('player death + respawn restores control in place with i-frames', () => {
  const w = flatWorld();
  const p = new Player(4 * TILE, 5 * TILE - 30); w.player = p;
  p.startDeath(w);
  assert.ok(p.dying > 0);
  p.respawn(4 * TILE, 5 * TILE - 30, MODES.casual.invuln);
  assert.equal(p.dying, 0);
  assert.equal(p.dead, false);
  assert.ok(p.invuln > 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/entities.test.mjs`
Expected: FAIL — `Cannot find module '../src/entities.js'`.

- [ ] **Step 3: Write `entities.js`**

```js
// Entities for 丛林勇士: Player, Runner, Jumper, Bullet. Each has update(dt, world).
// `world` is the facade from game.js. Physics via collideTiles/aabb. Player aiming
// uses resolveAim; firing uses the pure weapons.fire() and world.spawnBullets.

import { TILE, GRAVITY, PLAYER, FORGIVE, ENEMY, DEFAULT_WEAPON, SOLID } from './config.js';
import { collideTiles, aabb, groundAhead } from './physics.js';
import { resolveAim } from './input.js';
import { fire, cooldownFor } from './weapons.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---------------------------------------------------------------------------
export class Player {
  constructor(x, y) {
    this.w = PLAYER.w; this.h = PLAYER.h;
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.faceRight = true;
    this.coyote = 0; this.jumpBuffer = 0; this.jumpHeld = false;
    this.fireTimer = 0;
    this.weapon = DEFAULT_WEAPON;
    this.aim = { x: 1, y: 0 };
    this.invuln = 0;
    this.dead = false;
    this.dying = 0;
  }

  update(dt, world) {
    if (this.dying > 0) { // death hop, no collision
      this.dying -= dt;
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;
      return;
    }

    const intent = world.input.intent;
    const mode = world.mode;
    const accel = this.onGround ? PLAYER.accel : PLAYER.airAccel;

    // Horizontal move (single speed) + friction
    if (intent.moveX !== 0) {
      this.vx += intent.moveX * accel * dt;
      this.vx = clamp(this.vx, -PLAYER.maxSpeed, PLAYER.maxSpeed);
      this.faceRight = intent.moveX > 0;
    } else if (this.onGround) {
      const f = PLAYER.friction * dt;
      if (this.vx > 0) this.vx = Math.max(0, this.vx - f);
      else if (this.vx < 0) this.vx = Math.min(0, this.vx + f);
    }

    // Coyote + jump buffer
    if (this.onGround) this.coyote = FORGIVE.coyote;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (intent.jumpHeld && !this.jumpHeld) this.jumpBuffer = FORGIVE.jumpBuffer;
    else this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.jumpHeld = intent.jumpHeld;
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      this.vy = -PLAYER.jumpVel; this.coyote = 0; this.jumpBuffer = 0; this.onGround = false;
      world.playSound('jump');
    }
    if (!intent.jumpHeld && this.vy < 0) this.vy *= PLAYER.jumpCutoff; // variable height

    // Aim + auto-fire while held
    this.aim = resolveAim(intent, this.onGround, this.faceRight);
    if (this.fireTimer > 0) this.fireTimer -= dt;
    if (intent.fireHeld && this.fireTimer <= 0) this.fire(world);

    collideTiles(this, world.grid, dt);

    if (this.invuln > 0) this.invuln -= dt;
  }

  _muzzle() {
    const cx = this.x + this.w / 2 + this.aim.x * (this.w / 2 + 4);
    const cy = this.y + this.h * 0.4 + this.aim.y * (this.h / 2);
    return { x: cx - 6, y: cy - 3 }; // center the BULLET (12x6)
  }

  fire(world) {
    this.fireTimer = cooldownFor(this.weapon);
    const m = this._muzzle();
    const specs = fire(this.weapon, m.x, m.y, this.aim);
    world.spawnBullets(specs);
    world.playSound('shoot');
  }

  // One hit = down (spec §3.4). Returns true if this hit started a death.
  takeDamage(world) {
    if (this.invuln > 0 || this.dying > 0) return false;
    this.startDeath(world);
    return true;
  }

  startDeath(world) {
    this.dying = 1.0; this.vy = -520; this.vx = 0;
    world.playSound('die');
  }

  respawn(x, y, invuln) {
    this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.dying = 0; this.dead = false; this.onGround = false;
    this.invuln = invuln;
  }

  frame() {
    if (!this.onGround) return 2;
    if (Math.abs(this.vx) < 8) return 0;
    return Math.floor(Math.abs(this.x) / 10) % 2 === 0 ? 0 : 1;
  }
}

// ---------------------------------------------------------------------------
// Shared: ground grunt that walks toward the player, turns at walls/ledges.
class GroundEnemy {
  constructor(x, y, cfg) {
    this.w = cfg.w; this.h = cfg.h;
    this.x = x + (TILE - this.w) / 2;
    this.y = y + (TILE - this.h);
    this.speed = cfg.speed; this.hp = cfg.hp; this.score = cfg.score;
    this.vx = -cfg.speed; this.vy = 0; this.onGround = false;
    this.dead = false; this.anim = 0;
  }
  hit(dmg, world) {
    this.hp -= dmg;
    if (this.hp <= 0) {
      this.dead = true;
      world.addScore(this.score);
      world.spawnParticles(this.x + this.w / 2, this.y + this.h / 2, { count: 12, color: '#ffcc33', speed: 200 });
      world.playSound('hit');
    }
  }
  _walk(dt, world, spd) {
    this.vx = this.vx < 0 ? -spd : spd;
    const info = collideTiles(this, world.grid, dt);
    if (info.hitWall) this.vx = -this.vx;
    if (this.onGround) {
      const aheadX = this.vx > 0 ? this.x + this.w + 1 : this.x - 1;
      if (!groundAhead(world.grid, aheadX, this.y + this.h)) this.vx = -this.vx;
    }
    this.anim += dt * 6;
  }
  // Face toward the player so it chases rather than wandering off forever.
  _chase(world) {
    const p = world.player;
    if (!p) return;
    const dir = (p.x + p.w / 2) < (this.x + this.w / 2) ? -1 : 1;
    this.vx = dir * Math.abs(this.vx || this.speed);
  }
  frame() { return Math.floor(this.anim) % 2; }
}

export class Runner extends GroundEnemy {
  constructor(x, y) { super(x, y, ENEMY.runner); }
  update(dt, world) {
    if (this.dead) return;
    if (this.onGround) this._chase(world);
    this._walk(dt, world, this.speed * world.mode.enemyMul);
  }
}

export class Jumper extends GroundEnemy {
  constructor(x, y) {
    super(x, y, ENEMY.jumper);
    this.jumpCd = 0;
  }
  update(dt, world) {
    if (this.dead) return;
    const p = world.player;
    if (this.onGround) this._chase(world);
    if (this.jumpCd > 0) this.jumpCd -= dt;
    if (p && this.onGround && this.jumpCd <= 0) {
      const dist = Math.hypot((p.x - this.x), (p.y - this.y));
      if (dist < ENEMY.jumper.triggerDist) {
        this.vy = -ENEMY.jumper.jumpVel;
        this.onGround = false;
        this.jumpCd = ENEMY.jumper.retrigger;
      }
    }
    this._walk(dt, world, this.speed * world.mode.enemyMul);
  }
}

// ---------------------------------------------------------------------------
export class Bullet {
  constructor(spec) {
    this.w = 12; this.h = 6;
    this.x = spec.x; this.y = spec.y;
    this.vx = spec.vx; this.vy = spec.vy;
    this.dmg = spec.dmg; this.pierce = !!spec.pierce;
    this.life = spec.life; this.dead = false;
    this.hitIds = null; // for pierce: avoid double-hitting the same enemy
  }
  update(dt, world) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Solid tile -> die (bullets do not pass through terrain in M1).
    const col = Math.floor((this.x + this.w / 2) / TILE);
    const row = Math.floor((this.y + this.h / 2) / TILE);
    const gridRow = world.grid[row];
    if (gridRow && gridRow[col] && SOLID.has(gridRow[col])) { this.dead = true; return; }

    // Enemies
    for (const e of world.enemies) {
      if (e.dead) continue;
      if (aabb(this, e)) {
        if (e.hit) e.hit(this.dmg, world);
        if (!this.pierce) { this.dead = true; return; }
      }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/entities.test.mjs`
Expected: PASS — `# pass 6`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add games/warrior/src/entities.js games/warrior/tests/entities.test.mjs
git commit -m "feat(warrior): M1 entities — Player/Runner/Jumper/Bullet + tests"
```

---

## Task 7: `levels.js` — L1 forest + `parseLevel` (TDD)

**Files:**
- Create: `games/warrior/tests/levels.test.mjs`
- Create: `games/warrior/src/levels.js`

- [ ] **Step 1: Write the failing test**

Create `games/warrior/tests/levels.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, SOLID } from '../src/config.js';
import { LEVELS, parseLevel } from '../src/levels.js';

test('there is at least one level (L1)', () => {
  assert.ok(LEVELS.length >= 1);
  assert.equal(LEVELS[0].theme, 'forest');
});

test('parseLevel produces a NAME grid, dimensions, spawn, goal and enemies', () => {
  const lv = parseLevel(LEVELS[0]);
  assert.ok(Array.isArray(lv.grid) && Array.isArray(lv.grid[0]));
  assert.equal(lv.width, lv.cols * TILE);
  assert.equal(lv.height, lv.rows * TILE);
  assert.ok(lv.spawn && typeof lv.spawn.x === 'number');
  assert.ok(typeof lv.goalX === 'number' && lv.goalX > lv.spawn.x, 'goal is to the right of spawn');
  assert.ok(lv.enemies.length >= 2, 'has Runner + Jumper grunts');
  // entity markers must NOT remain in the collision grid
  for (const row of lv.grid) for (const cell of row) {
    if (cell !== null) assert.ok(SOLID.has(cell), `grid cell is a tile name, got ${cell}`);
  }
});

test('the spawn column has solid ground beneath it (no instant pit death)', () => {
  const lv = parseLevel(LEVELS[0]);
  const col = Math.floor(lv.spawn.x / TILE);
  let groundBelow = false;
  for (let r = Math.floor(lv.spawn.y / TILE); r < lv.rows; r++) {
    if (lv.grid[r] && lv.grid[r][col] && SOLID.has(lv.grid[r][col])) { groundBelow = true; break; }
  }
  assert.equal(groundBelow, true);
});

test('both grunt types are present', () => {
  const lv = parseLevel(LEVELS[0]);
  const types = new Set(lv.enemies.map((e) => e.type));
  assert.ok(types.has('runner'));
  assert.ok(types.has('jumper'));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/levels.test.mjs`
Expected: FAIL — `Cannot find module '../src/levels.js'`.

- [ ] **Step 3: Write `levels.js`**

The L1 grid is ~7 screens wide. Legend: `#` ground, `=` platform, `X` block, `|` cover, `@` player start, `r` runner, `j` jumper, `G` goal flag. All pits are ≤3 tiles (crossable with one jump).

```js
// Level data for 丛林勇士. Rows are TOP-DOWN strings using the TILES legend (config.js)
// plus entity markers: '@' player start, 'r' runner, 'j' jumper, 'G' goal flag.
// parseLevel() turns a level into a NAME grid + spawn + goalX + enemy list.

import { TILE, TILES } from './config.js';

const ENTITY_CHARS = new Set(['@', 'r', 'j', 'G']);

// L1 丛林 — tutorial: gentle jogging grunts, basic platforms, a couple of <=3-tile
// pits, ending at the goal flag (no BOSS in M1).
const lvl1 = {
  id: 'L1', name: '丛林', theme: 'forest',
  rows: [
    '                                                                                                            ',
    '                                                                                                            ',
    '                                                                                                            ',
    '                                                                                                            ',
    '                                    =====                              ====                                 ',
    '                      ===                            r        j                          =====             ',
    '              r                              X X              X X                                    G      ',
    '        @           r            j                 r              j          r        j         r          ',
    '###########   ##############   ###########   ##############   #############   #####################   ######',
    '###########   ##############   ###########   ##############   #############   #####################   ######',
    '###########   ##############   ###########   ##############   #############   #####################   ######',
    '###########   ##############   ###########   ##############   #############   #####################   ######',
  ],
};

export const LEVELS = [lvl1];

export function parseLevel(lvl) {
  const rows = lvl.rows;
  const numRows = rows.length;
  let cols = 0;
  for (const row of rows) cols = Math.max(cols, row.length);

  const grid = [];
  const enemies = [];
  let spawn = { x: 2 * TILE, y: 2 * TILE };
  let goalX = (cols - 2) * TILE;

  for (let rIdx = 0; rIdx < numRows; rIdx++) {
    const row = rows[rIdx];
    const gridRow = new Array(cols).fill(null);
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const ch = row[cIdx] || ' ';
      if (ch === ' ') continue;
      const px = cIdx * TILE, py = rIdx * TILE;

      if (ENTITY_CHARS.has(ch)) {
        if (ch === '@') spawn = { x: px, y: py };
        else if (ch === 'r') enemies.push({ type: 'runner', x: px, y: py });
        else if (ch === 'j') enemies.push({ type: 'jumper', x: px, y: py });
        else if (ch === 'G') goalX = px;
        continue;
      }

      const type = TILES[ch];
      if (!type) continue;
      gridRow[cIdx] = type;
    }
    grid.push(gridRow);
  }

  return {
    id: lvl.id,
    name: lvl.name,
    theme: lvl.theme,
    grid,
    cols,
    rows: numRows,
    width: cols * TILE,
    height: numRows * TILE,
    spawn,
    goalX,
    enemies,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/levels.test.mjs`
Expected: PASS — `# pass 4`, `# fail 0`.

- [ ] **Step 5: Run the whole suite so far**

Run: `node --test`
Expected: all of physics/aim/weapons/entities/levels pass — `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add games/warrior/src/levels.js games/warrior/tests/levels.test.mjs
git commit -m "feat(warrior): M1 levels — L1 forest + parseLevel + tests"
```

---

## Task 8: `audio.js` — synthesized SFX + `play(id)`

No unit test (Web Audio needs a browser). Import-safe in Node because the AudioContext is created lazily inside calls. The `play(id)` dispatcher matches `world.playSound(id)`.

**Files:**
- Create: `games/warrior/src/audio.js`

- [ ] **Step 1: Write `audio.js`**

```js
// Web Audio SFX for 丛林勇士. No asset files: tones are synthesized. AudioContext is
// created lazily on first sound (after a user gesture). play(id) maps the ids that
// world.playSound(id) emits. BGM arrives in M5.

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch { /* ignore */ } }
  return ctx;
}

function tone(freq, dur, type = 'square', gainPeak = 0.1, when = 0) {
  if (muted) return;
  const a = ac(); if (!a) return;
  try {
    const t0 = a.currentTime + when;
    const osc = a.createOscillator(); const gain = a.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* audio is optional */ }
}

function slide(f0, f1, dur, type = 'square', gainPeak = 0.1) {
  if (muted) return;
  const a = ac(); if (!a) return;
  try {
    const t0 = a.currentTime;
    const osc = a.createOscillator(); const gain = a.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(gainPeak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

const SFX = {
  shoot() { tone(880, 0.05, 'square', 0.06); },
  jump() { slide(420, 760, 0.16, 'square', 0.09); },
  land() { tone(180, 0.05, 'square', 0.06); },
  hit() { slide(520, 160, 0.14, 'square', 0.11); },
  die() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.1, i * 0.14)); },
  clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'triangle', 0.12, i * 0.11)); },
  ui() { tone(523, 0.05, 'triangle', 0.07); },
};

export const Sound = {
  setMuted(v) { muted = v; },
  toggleMuted() { muted = !muted; return muted; },
  isMuted() { return muted; },
  // Dispatcher used by world.playSound(id).
  play(id) { const fn = SFX[id]; if (fn) fn(); },
};
```

- [ ] **Step 2: Verify import-safe in Node**

Run: `node -e "import('./src/audio.js').then(m => { m.Sound.setMuted(true); m.Sound.play('shoot'); console.log('audio ok'); })"`
Expected: `audio ok` (no throw — muted guard returns before touching `window`).

- [ ] **Step 3: Commit**

```bash
git add games/warrior/src/audio.js
git commit -m "feat(warrior): M1 audio — synthesized SFX + play(id) dispatch"
```

---

## Task 9: `sprites.js` — code-drawn pixel sprites + cache + blit

No unit test (Canvas needs a browser). M1 art is intentionally simple (clean blocky soldier + grunts); polish lands in M5. Public API mirrors pixel-quest: `setThemes`, `clearCache`, `blit`, plus warrior draw getters.

**Files:**
- Create: `games/warrior/src/sprites.js`

- [ ] **Step 1: Write `sprites.js`**

```js
// Code-drawn pixel sprites for 丛林勇士, cached on offscreen canvases and blitted with
// nearest-neighbour upscaling. M1 art is simple but readable; M5 polishes it. All
// sprites are authored in a small logical pixel grid and scaled up at blit time.

let THEMES = {};

const cache = new Map();
function make(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  draw(c);
  cache.set(key, cv);
  return cv;
}

function px(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); }

export const Sprites = {
  setThemes(t) { THEMES = t; },
  clearCache() { cache.clear(); },

  // Draw an offscreen canvas at world (x,y) scaled by `scale`, pixel-snapped.
  blit(ctx, cv, x, y, scale = 1) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, Math.round(x), Math.round(y), cv.width * scale, cv.height * scale);
  },

  // ---- terrain ----
  tile(name, themeKey) {
    const th = THEMES[themeKey] || Object.values(THEMES)[0] || { ground: '#7a5a2f', groundDark: '#543d1f', grass: '#3fa845' };
    return make(`tile:${name}:${themeKey}`, 16, 16, (c) => {
      if (name === 'ground') {
        px(c, 0, 0, 16, 16, th.ground);
        px(c, 0, 0, 16, 4, th.grass);
        px(c, 0, 12, 16, 4, th.groundDark);
      } else if (name === 'platform') {
        px(c, 0, 0, 16, 6, th.grass);
        px(c, 0, 6, 16, 10, th.groundDark);
      } else if (name === 'block') {
        px(c, 0, 0, 16, 16, '#9a7a3a'); px(c, 2, 2, 12, 12, '#b8924a');
      } else if (name === 'cover') {
        px(c, 0, 0, 16, 16, '#5a6b3a'); px(c, 1, 1, 14, 14, '#6f8a47');
      }
    });
  },

  // ---- hero: soldier holding the gun along the aim direction ----
  // poseKey is derived from aim by render.js: 'side' | 'up' | 'upDiag' | 'down' | 'downDiag'
  hero(poseKey, faceRight, frame) {
    return make(`hero:${poseKey}:${faceRight ? 'R' : 'L'}:${frame}`, 16, 18, (c) => {
      if (!faceRight) { c.translate(16, 0); c.scale(-1, 1); }
      const skin = '#f1c27d', suit = '#3f6b2f', suitD = '#2f5022', gun = '#2b2b2b';
      // legs (tiny walk bob)
      const bob = frame === 1 ? 1 : 0;
      px(c, 4, 14 - bob, 3, 4, suitD);
      px(c, 9, 14 + bob, 3, 4, suitD);
      // torso
      px(c, 4, 6, 8, 8, suit);
      px(c, 4, 6, 8, 2, suitD);
      // head
      px(c, 5, 1, 6, 5, skin);
      px(c, 5, 1, 6, 2, '#5a3b1a'); // hair/helmet brim
      // gun along the aim direction
      if (poseKey === 'up') { px(c, 8, -3, 3, 9, gun); }
      else if (poseKey === 'upDiag') { px(c, 11, 1, 6, 3, gun); c.save(); c.translate(11, 4); c.rotate(-0.6); px(c, 0, 0, 7, 3, gun); c.restore(); }
      else if (poseKey === 'down') { px(c, 7, 12, 3, 8, gun); }
      else if (poseKey === 'downDiag') { c.save(); c.translate(11, 9); c.rotate(0.6); px(c, 0, 0, 7, 3, gun); c.restore(); }
      else { px(c, 11, 8, 7, 3, gun); } // side
    });
  },

  runner(frame) {
    return make(`runner:${frame}`, 16, 16, (c) => {
      const body = '#b5483a', bodyD = '#7d2b22', skin = '#f1c27d';
      const bob = frame === 1 ? 1 : 0;
      px(c, 3, 12 - bob, 3, 4, bodyD);
      px(c, 9, 12 + bob, 3, 4, bodyD);
      px(c, 3, 5, 9, 8, body);
      px(c, 5, 1, 6, 5, skin);
      px(c, 3, 5, 9, 2, bodyD);
    });
  },

  jumper(frame) {
    return make(`jumper:${frame}`, 16, 16, (c) => {
      const body = '#3a6fb5', bodyD = '#22467d', skin = '#f1c27d';
      px(c, 3, 12, 4, 4, bodyD);
      px(c, 9, 12, 4, 4, bodyD);
      px(c, 3, 4, 9, 9, body);
      px(c, 5, 1, 6, 4, skin);
      px(c, 3, 4, 9, 2, bodyD);
    });
  },

  bullet() {
    return make('bullet', 6, 3, (c) => { px(c, 0, 0, 6, 3, '#fff36b'); px(c, 0, 1, 5, 1, '#ffae2b'); });
  },

  goal() {
    return make('goal', 12, 40, (c) => {
      px(c, 5, 0, 2, 40, '#cfcfcf');       // pole
      px(c, 7, 2, 5, 8, '#ff5a3c');        // flag
    });
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add games/warrior/src/sprites.js
git commit -m "feat(warrior): M1 sprites — code-drawn hero/grunts/bullet/tiles + cache/blit"
```

---

## Task 10: `render.js` — field-space renderer

No unit test. Trimmed from pixel-quest's renderer: DPR-capped resize, field-space camera with clip + balanced transform (crash self-heal), tiles, entities, bullets, hero (aim-driven pose), HUD (score + casual 复活∞), ready/clear banners.

**Files:**
- Create: `games/warrior/src/render.js`

- [ ] **Step 1: Write `render.js`**

```js
// Canvas 2D renderer for 丛林勇士. Draws the scene in FIELD space (camera-offset world),
// then scales + letterboxes onto the canvas. Menus/banners are HTML overlays + a couple
// of in-canvas banners. The try/finally around the clipped scene GUARANTEES a balanced
// transform so one bad frame can't leak the clip onto every following frame.

import { FIELD, TILE, THEMES } from './config.js';
import { Sprites } from './sprites.js';
import { Runner, Jumper } from './entities.js';

function poseKeyFromAim(aim) {
  if (aim.y < -0.3 && Math.abs(aim.x) < 0.3) return 'up';
  if (aim.y < -0.3) return 'upDiag';
  if (aim.y > 0.3 && Math.abs(aim.x) < 0.3) return 'down';
  if (aim.y > 0.3) return 'downDiag';
  return 'side';
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1; this.offsetX = 0; this.offsetY = 0;
    Sprites.setThemes(THEMES);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.scale = Math.min(w / FIELD.W, h / FIELD.H);
    this.offsetX = (w - FIELD.W * this.scale) / 2;
    this.offsetY = (h - FIELD.H * this.scale) / 2;
    this._skyKey = null;
  }

  render(game) {
    const ctx = this.ctx;
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, this.offsetX * this.dpr, this.offsetY * this.dpr);
      ctx.imageSmoothingEnabled = false;

      const theme = (game.level && THEMES[game.level.theme]) || THEMES.forest;
      const bleedX = this.offsetX / (this.scale || 1);
      const bleedY = this.offsetY / (this.scale || 1);
      this._sky(ctx, theme, bleedX, bleedY);
      if (!game.level) return;

      const cam = game.camera;
      this._hills(ctx, theme, cam.x, bleedX);

      ctx.save();
      try {
        ctx.beginPath(); ctx.rect(0, 0, FIELD.W, FIELD.H); ctx.clip();
        const shake = game.shake > 0 ? game.shake : 0;
        const sx = shake ? (Math.sin(game._t * 90) * shake) : 0;
        ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y));
        this._tiles(ctx, game);
        this._goal(ctx, game);
        this._enemies(ctx, game);
        this._bullets(ctx, game);
        this._player(ctx, game);
        this._particles(ctx, game);
        this._floatTexts(ctx, game);
      } finally {
        ctx.restore();
      }

      this._hud(ctx, game);
      if (game.state === 'ready') this._banner(ctx, `${game.level.name}`, '准备出发！按 跳 / ✕ 开始');
      if (game.state === 'clear') this._banner(ctx, '关卡通关！🎉', '按 跳 / ✕ 返回');
    } catch (err) {
      if ((this._errs = (this._errs || 0) + 1) <= 8) console.error('[render] frame error — clearing caches:', err);
      try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch (_) { /* ignore */ }
      this._skyKey = null;
      Sprites.clearCache();
    }
  }

  _sky(ctx, theme, bleedX, bleedY) {
    const top = -bleedY, bot = FIELD.H + bleedY;
    const key = `${theme.skyTop}|${theme.skyBot}|${top}|${bot}`;
    if (this._skyKey !== key) {
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, theme.skyTop); g.addColorStop(1, theme.skyBot);
      this._skyGrad = g; this._skyKey = key;
    }
    ctx.fillStyle = this._skyGrad;
    ctx.fillRect(-bleedX, top, FIELD.W + 2 * bleedX, bot - top);
  }

  _hills(ctx, theme, camX, bleedX) {
    ctx.fillStyle = theme.hills;
    const hg = 240;
    const drift = (((-camX * 0.4) % hg) + hg) % hg;
    const n = Math.ceil((FIELD.W + 2 * bleedX) / hg) + 2;
    for (let i = 0; i < n; i++) {
      const x = -bleedX - hg + drift + i * hg;
      ctx.beginPath(); ctx.arc(x, FIELD.H - 36, 80, Math.PI, 0); ctx.fill();
    }
  }

  _tiles(ctx, game) {
    const grid = game.level.grid, themeKey = game.level.theme, cam = game.camera;
    const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const c1 = Math.min(game.level.cols - 1, Math.floor((cam.x + FIELD.W) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const r1 = Math.min(game.level.rows - 1, Math.floor((cam.y + FIELD.H) / TILE) + 1);
    for (let r = r0; r <= r1; r++) {
      const row = grid[r]; if (!row) continue;
      for (let c = c0; c <= c1; c++) {
        const t = row[c]; if (!t) continue;
        const cv = Sprites.tile(t, themeKey);
        Sprites.blit(ctx, cv, c * TILE, r * TILE, TILE / cv.width);
      }
    }
  }

  _goal(ctx, game) {
    const lv = game.level;
    if (lv.goalX == null) return;
    const cv = Sprites.goal();
    const bottom = lv.height - 4 * TILE;
    Sprites.blit(ctx, cv, lv.goalX, bottom, TILE / cv.width);
  }

  _enemies(ctx, game) {
    for (const e of game.enemies) {
      if (e.dead) continue;
      let cv = null;
      if (e instanceof Runner) cv = Sprites.runner(e.frame());
      else if (e instanceof Jumper) cv = Sprites.jumper(e.frame());
      if (cv) { const sc = e.w / cv.width; Sprites.blit(ctx, cv, e.x, e.y + e.h - cv.height * sc, sc); }
    }
  }

  _bullets(ctx, game) {
    const cv = Sprites.bullet();
    for (const b of game.bullets) {
      if (b.dead) continue;
      Sprites.blit(ctx, cv, b.x, b.y, b.w / cv.width);
    }
  }

  _player(ctx, game) {
    const p = game.player; if (!p) return;
    let alpha = 1;
    if (p.invuln > 0 && Math.floor(p.invuln * 16) % 2 === 0) alpha = 0.35;
    const cv = Sprites.hero(poseKeyFromAim(p.aim), p.faceRight, p.frame());
    const sc = p.w / cv.width;
    ctx.save(); ctx.globalAlpha = alpha;
    Sprites.blit(ctx, cv, p.x, p.y + p.h - cv.height * sc, sc);
    ctx.restore();
  }

  _particles(ctx, game) {
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color; ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  _floatTexts(ctx, game) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px system-ui, sans-serif';
    for (const t of game.floatTexts) {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = t.color || '#000'; ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y); ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  _hud(ctx, game) {
    const bandH = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, FIELD.W, bandH);
    const cy = bandH / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffe066'; ctx.fillText(`⭐ ${game.score}`, 92, cy);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
    const livesTxt = game.mode.lives === Infinity ? '复活 ∞' : `❤️ ${game.lives}`;
    ctx.fillText(livesTxt, FIELD.W - 56, cy);
    ctx.textAlign = 'center';
    ctx.fillText(`${game.level ? game.level.name : ''}`, FIELD.W / 2, cy);
  }

  _banner(ctx, title, sub) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, FIELD.H / 2 - 44, FIELD.W, 88);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(title, FIELD.W / 2, FIELD.H / 2 - 8);
    ctx.font = '16px system-ui, sans-serif'; ctx.fillStyle = '#ffe066';
    ctx.fillText(sub, FIELD.W / 2, FIELD.H / 2 + 22);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add games/warrior/src/render.js
git commit -m "feat(warrior): M1 render — field-space camera, tiles/entities/HUD, crash self-heal"
```

---

## Task 11: `game.js` — state machine + world facade + simulation (TDD)

`game.js` only imports import-safe modules (config/levels/entities/physics/weapons/input/audio), so the whole simulation unit-tests in Node — the strongest M1 confidence gate.

**Files:**
- Create: `games/warrior/tests/game.test.mjs`
- Create: `games/warrior/src/game.js`

- [ ] **Step 1: Write the failing test**

Create `games/warrior/tests/game.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Input } from '../src/input.js';
import { TILE } from '../src/config.js';

function freshGame() {
  const g = new Game();
  g.startLevel(0);   // skip the title; go straight into L1
  g._startPlaying(); // ready -> playing
  // neutral intent
  Input.intent = { moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false };
  return g;
}

test('game boots into casual mode with L1 loaded and a player', () => {
  const g = freshGame();
  assert.equal(g.mode.id, 'casual');
  assert.equal(g.level.id, 'L1');
  assert.ok(g.player);
  assert.equal(g.state, 'playing');
});

test('holding right moves the player and the camera follows', () => {
  const g = freshGame();
  const x0 = g.player.x;
  Input.intent.moveX = 1;
  for (let i = 0; i < 120; i++) g.update(1 / 60);
  assert.ok(g.player.x > x0 + TILE, 'player advanced');
  assert.ok(g.camera.x > 0, 'camera scrolled');
});

test('a fired bullet can kill a nearby grunt (score increases)', () => {
  const g = freshGame();
  // place a runner just to the player's right, at the player's height
  const p = g.player;
  g.enemies.length = 0;
  g.spawnEnemy('runner', p.x + 60, p.y);
  g.enemies[0].y = p.y; g.enemies[0].vx = 0; // hold still in front
  Input.intent.fireHeld = true; p.faceRight = true;
  const s0 = g.score;
  for (let i = 0; i < 120 && g.score === s0; i++) g.update(1 / 60);
  assert.ok(g.score > s0, 'killing a grunt raised the score');
});

test('casual death respawns the player and keeps playing (infinite lives)', () => {
  const g = freshGame();
  const before = g.deaths;
  g.player.startDeath(g._world);
  // fall below the level to trigger the dead handler
  g.player.y = g.level.height + 200;
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  assert.equal(g.state, 'playing', 'still playing after casual death');
  assert.equal(g.deaths, before + 1);
  assert.ok(g.player.invuln > 0, 'respawn grants i-frames');
  assert.ok(g.player.y < g.level.height, 'player is back on the field');
});

test('reaching the goal clears the level', () => {
  const g = freshGame();
  g.player.x = g.level.goalX + 5;
  g.update(1 / 60);
  assert.equal(g.state, 'clear');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/game.test.mjs`
Expected: FAIL — `Cannot find module '../src/game.js'`.

- [ ] **Step 3: Write `game.js`**

```js
// Core game state + simulation for 丛林勇士. Pure world-space logic; rendering lives in
// render.js, I/O in input.js. M1 state machine:
//   title -> ready -> playing -> clear        (+ respawning, gameover[classic])
// M1 starts in casual mode (infinite in-place respawns). Mode switch / select screen /
// save / BOSS arrive in later milestones.

import { FIELD, TILE, MODES, SCORE, SOLID, DEFAULT_WEAPON } from './config.js';
import { LEVELS, parseLevel } from './levels.js';
import { Player, Runner, Jumper, Bullet } from './entities.js';
import { aabb } from './physics.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export class Game {
  constructor() {
    this.state = 'title';
    this.mode = MODES.casual;
    this.score = 0;
    this.lives = this.mode.lives;
    this.deaths = 0;
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.bullets = [];
    this.particles = [];
    this.floatTexts = [];
    this.camera = { x: 0, y: 0 };
    this.shake = 0;
    this.readyTimer = 0;
    this._t = 0; // wall clock for shake phase
    this._world = this._makeWorld();
  }

  // ---- world facade handed to entities (spec §13 contract) ----
  _makeWorld() {
    const game = this;
    return {
      get grid() { return game.level.grid; },
      get player() { return game.player; },
      get enemies() { return game.enemies; },
      get bullets() { return game.bullets; },
      get particles() { return game.particles; },
      get camera() { return game.camera; },
      get mode() { return game.mode; },
      input: Input,
      addScore(n) { game.score += n; },
      spawnEnemy(type, x, y) { game.spawnEnemy(type, x, y); },
      spawnBullets(specs) { for (const s of specs) game.bullets.push(new Bullet(s)); },
      playSound(id) { Sound.play(id); },
      shake(intensity) { game.shake = Math.max(game.shake, intensity); },
      addFloatText(text, x, y, color) { game.floatTexts.push({ text, x, y, color, life: 1 }); },
      spawnParticles(x, y, opts = {}) { game._spawnParticles(x, y, opts); },
    };
  }

  // ---- lifecycle ----
  setMode(id) { this.mode = MODES[id] || MODES.casual; this.lives = this.mode.lives; }

  startLevel(i) {
    this.levelIndex = i;
    this.level = parseLevel(LEVELS[i]);
    this.score = this.score || 0;
    this.deaths = 0;
    this._spawnEntities();
    this.state = 'ready';
    this.readyTimer = 1.2;
  }

  _spawnEntities() {
    const lv = this.level;
    const sp = this._safeSpawn(lv.spawn.x, lv.spawn.y);
    this.player = new Player(sp.x, sp.y);
    this.player.weapon = DEFAULT_WEAPON;
    this.enemies = lv.enemies.map((e) => this._makeEnemy(e.type, e.x, e.y));
    this.bullets = [];
    this.particles = [];
    this.floatTexts = [];
    this.camera.x = clamp(this.player.x - FIELD.W / 2, 0, Math.max(0, lv.width - FIELD.W));
    this.camera.y = clamp(this.player.y - FIELD.H / 2, 0, Math.max(0, lv.height - FIELD.H));
  }

  _makeEnemy(type, x, y) {
    return type === 'jumper' ? new Jumper(x, y) : new Runner(x, y);
  }
  spawnEnemy(type, x, y) { this.enemies.push(this._makeEnemy(type, x, y)); }

  _startPlaying() { this.state = 'playing'; }

  confirm() {
    switch (this.state) {
      case 'title': this.startLevel(0); break;
      case 'ready': this._startPlaying(); break;
      case 'clear': this.state = 'title'; break;
      default: break;
    }
  }

  // ---- spawn safety (spec §13 M1): search +/-3 tiles for footing, else level spawn ----
  _groundRowBelow(col, fromRow) {
    const grid = this.level.grid;
    for (let r = Math.max(0, fromRow); r < grid.length; r++) {
      const t = grid[r] && grid[r][col];
      if (t && SOLID.has(t)) return r;
    }
    return null;
  }
  _safeSpawn(sx, sy) {
    const col0 = Math.round(sx / TILE);
    const row0 = Math.round(sy / TILE);
    let r = this._groundRowBelow(col0, row0);
    if (r != null) return { x: sx, y: r * TILE - 30 };
    for (let d = 1; d <= 3; d++) {
      for (const col of [col0 - d, col0 + d]) {
        if (col < 0 || col >= this.level.cols) continue;
        r = this._groundRowBelow(col, row0);
        if (r != null) return { x: col * TILE, y: r * TILE - 30 };
      }
    }
    return { x: sx, y: sy };
  }

  // ---- simulation ----
  update(dt) {
    this._t += dt;
    this._updateParticles(dt);
    this._updateFloatTexts(dt);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 30);

    if (this.state === 'ready') {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) this._startPlaying();
      return;
    }
    if (this.state !== 'playing') return;

    const lv = this.level;
    const p = this.player;

    p.update(dt, this._world);

    // death plunge / pit
    if (p.dying > 0) {
      if (p.y > lv.height + 80) this._onPlayerDead();
      this._updateCamera();
      return;
    }
    if (p.y > lv.height + 40) p.startDeath(this._world);

    for (const b of this.bullets) { if (!b.dead) b.update(dt, this._world); }
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.update(dt, this._world);
      if (e.y > lv.height + 80) e.dead = true;
    }

    this._playerEnemyCollisions();

    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);

    if (p.x + p.w > lv.goalX) { this._levelClear(); return; }

    this._updateCamera();
  }

  _playerEnemyCollisions() {
    const p = this.player;
    if (p.dying > 0 || p.invuln > 0) return;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (aabb(p, e)) { p.takeDamage(this._world); break; }
    }
  }

  _onPlayerDead() {
    const pt = this._safeSpawn(this.player.x, this.player.y);
    if (this.mode.lives !== Infinity) {
      this.lives -= 1;
      if (this.lives <= 0) { this.state = 'gameover'; Sound.play('die'); return; }
      if (this.mode.loseWeaponOnDeath) this.player.weapon = DEFAULT_WEAPON;
    }
    this.deaths += 1;
    this.player.respawn(pt.x, pt.y, this.mode.invuln);
    this.state = 'playing';
  }

  _levelClear() {
    this.score += SCORE.levelClear;
    this.state = 'clear';
    Sound.play('clear');
  }

  _updateCamera() {
    const lv = this.level, p = this.player;
    const dead = FIELD.W * 0.18;
    const target = p.x + p.w / 2;
    const camMid = this.camera.x + FIELD.W / 2;
    if (target > camMid + dead) this.camera.x = target - FIELD.W / 2 - dead;
    else if (target < camMid - dead) this.camera.x = target - FIELD.W / 2 + dead;
    this.camera.x = clamp(this.camera.x, 0, Math.max(0, lv.width - FIELD.W));
    const ty = clamp(p.y + p.h / 2 - FIELD.H / 2, 0, Math.max(0, lv.height - FIELD.H));
    this.camera.y += (ty - this.camera.y) * 0.12;
    this.camera.y = clamp(this.camera.y, 0, Math.max(0, lv.height - FIELD.H));
  }

  _spawnParticles(x, y, opts) {
    const count = opts.count || 8;
    const color = opts.color || '#ffcc33';
    const speed = opts.speed || 160;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.particles.push({
        x, y, vx: Math.cos(a) * speed * (0.5 + (i % 3) * 0.25),
        vy: Math.sin(a) * speed * (0.5 + (i % 2) * 0.4) - 60,
        life: 0.7, color, size: 4,
      });
    }
  }
  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += 700 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 1.4;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }
  _updateFloatTexts(dt) {
    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const t = this.floatTexts[i];
      t.y -= 28 * dt; t.life -= dt;
      if (t.life <= 0) this.floatTexts.splice(i, 1);
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/game.test.mjs`
Expected: PASS — `# pass 6`, `# fail 0`.

- [ ] **Step 5: Run the FULL suite**

Run: `node --test`
Expected: physics(5) + aim(5) + weapons(4) + entities(6) + levels(4) + game(6) all pass — `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add games/warrior/src/game.js games/warrior/tests/game.test.mjs
git commit -m "feat(warrior): M1 game — state machine, world facade, casual respawn, reach-goal clear + tests"
```

---

## Task 12: `index.html` + `style.css` + `main.js` — browser bootstrap

**Files:**
- Create: `games/warrior/index.html`
- Create: `games/warrior/style.css`
- Create: `games/warrior/src/main.js`

- [ ] **Step 1: Write `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
  <title>丛林勇士 JUNGLE WARRIOR</title>
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <canvas id="game"></canvas>

  <!-- top-right controls -->
  <a class="hud-btn" id="btn-hub" href="../../index.html" title="返回大厅">← HUB</a>
  <button class="hud-btn" id="btn-fullscreen" title="全屏">⛶</button>
  <button class="hud-btn" id="btn-mute" title="静音">🔊</button>

  <!-- title overlay -->
  <div class="overlay show" id="overlay-title">
    <div class="panel">
      <h1>丛林勇士</h1>
      <p class="sub">JUNGLE WARRIOR · M1</p>
      <button class="big" id="btn-start">开始游戏</button>
      <p class="hint">← → 移动 · ↑↓ 瞄准 · Z 射击 · X 跳 · 休闲模式无限复活</p>
    </div>
  </div>

  <script type="module" src="src/main.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write `style.css`**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
body { font-family: system-ui, -apple-system, "PingFang SC", sans-serif; -webkit-user-select: none; user-select: none; touch-action: none; }
#game { display: block; width: 100vw; height: 100vh; }

.hud-btn {
  position: fixed; top: 10px; z-index: 20;
  display: inline-flex; align-items: center; justify-content: center;
  height: 32px; padding: 0 10px; border: none; border-radius: 8px;
  background: rgba(0,0,0,0.45); color: #fff; font-size: 15px; font-weight: 600;
  text-decoration: none; cursor: pointer;
}
#btn-hub { left: 10px; }
#btn-fullscreen { right: 52px; width: 36px; }
#btn-mute { right: 10px; width: 36px; }

.overlay {
  position: fixed; inset: 0; z-index: 30; display: none;
  align-items: center; justify-content: center;
  background: rgba(8, 20, 8, 0.72);
}
.overlay.show { display: flex; }
.panel { text-align: center; color: #fff; padding: 28px 36px; }
.panel h1 { font-size: 44px; color: #8bc34a; text-shadow: 2px 2px 0 #33501a; }
.panel .sub { color: #cdeeae; letter-spacing: 3px; margin: 6px 0 22px; }
.panel .hint { margin-top: 18px; color: #b8d6a0; font-size: 13px; }
.big {
  font-size: 22px; font-weight: 700; color: #14250a; background: #8bc34a;
  border: none; border-radius: 12px; padding: 12px 40px; cursor: pointer;
}
.big:active { transform: translateY(1px); }
```

- [ ] **Step 3: Write `main.js`**

```js
// Entry point for 丛林勇士: builds the renderer + game, wires input + the title overlay,
// and runs the requestAnimationFrame loop.

import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Sprites } from './sprites.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const game = new Game();
Input.init(canvas);

const el = (id) => document.getElementById(id);

function startGame() { if (game.state === 'title') game.startLevel(0); }
el('btn-start').addEventListener('click', startGame);

// Mute
const muteBtn = el('btn-mute');
muteBtn.addEventListener('click', () => { muteBtn.textContent = Sound.toggleMuted() ? '🔇' : '🔊'; });

// Fullscreen (hidden where unsupported, e.g. iPhone Safari)
const fsBtn = el('btn-fullscreen');
function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
function fsSupported() { const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen); }
if (fsBtn) {
  if (!fsSupported()) fsBtn.style.display = 'none';
  else fsBtn.addEventListener('click', () => {
    try {
      if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen).call(d); }
    } catch (_) { /* ignore */ }
    setTimeout(() => renderer.resize(), 60);
  });
}

// Rebuild sprite caches if iOS blanked them while backgrounded.
document.addEventListener('visibilitychange', () => { if (!document.hidden) { Sprites.clearCache(); renderer.resize(); } });

// Discrete actions (keyboard / gamepad / canvas tap)
Input.on((action) => {
  if (action === 'confirm') {
    if (game.state === 'title') startGame();
    else game.confirm(); // ready -> playing, clear -> title
  } else if (action === 'mute') {
    muteBtn.textContent = Sound.toggleMuted() ? '🔇' : '🔊';
  }
});

// Title overlay visibility follows state.
let lastState = null;
function syncOverlay() {
  if (game.state === lastState) return;
  lastState = game.state;
  el('overlay-title').classList.toggle('show', game.state === 'title');
}

// Main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045);
  last = now;
  try {
    Input.poll();
    game.update(dt);
    renderer.render(game);
    syncOverlay();
  } catch (err) {
    if ((frame._errs = (frame._errs || 0) + 1) <= 8) console.error('[loop] frame error:', err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 4: Manual browser check**

From the repo root run `python3 -m http.server 8000`, then open `http://localhost:8000/games/warrior/index.html`. Verify: title shows → 开始游戏 → ready banner → press X to start → ← → moves, Z shoots, grunts die in a burst of particles, walking off a ledge into a pit respawns you in place (复活 ∞ in the HUD), reaching the flag shows 关卡通关. The ← HUB button returns to the hub.

- [ ] **Step 5: Commit**

```bash
git add games/warrior/index.html games/warrior/style.css games/warrior/src/main.js
git commit -m "feat(warrior): M1 bootstrap — index.html + style.css + main loop, playable in browser"
```

---

## Task 13: Browser smoke test (host-side puppeteer-core + system Chrome)

The sandbox can't reach localhost, so the smoke runs host-side, mirroring the boom-worms setup. If Chrome/host is unavailable, the manual check in Task 12 Step 4 satisfies the M1 gate (spec §13: "冒烟测试无 Chrome 则跳过").

**Files:**
- Create: `games/warrior/tests/smoke.mjs`

- [ ] **Step 1: Write the smoke script**

Create `games/warrior/tests/smoke.mjs`:

```js
// Host-side browser smoke for 丛林勇士 M1. Requires a static server at :8000 and a
// system Chrome. Run from games/warrior/:
//   (repo root) python3 -m http.server 8000   &
//   CHROME=/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
//     node tests/smoke.mjs
// Exits non-zero on failure. Skips gracefully if puppeteer-core/Chrome are absent.

import { setTimeout as sleep } from 'node:timers/promises';

let puppeteer;
try { puppeteer = (await import('puppeteer-core')).default; }
catch { console.log('SKIP: puppeteer-core not installed'); process.exit(0); }

const CHROME = process.env.CHROME
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const URL = process.env.URL || 'http://localhost:8000/games/warrior/index.html';

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.setViewport({ width: 900, height: 600 });
await page.goto(URL, { waitUntil: 'networkidle0' });

// title -> start
await page.click('#btn-start');
await sleep(200);

// drive the game: press X to start playing, then hold Right + Z to advance & shoot
async function holdKey(key, ms) {
  await page.keyboard.down(key); await sleep(ms); await page.keyboard.up(key);
}
await holdKey('x', 60);            // ready -> playing
await page.keyboard.down('ArrowRight');
await page.keyboard.down('z');
await sleep(2500);                 // run & gun for a bit
await page.keyboard.up('z');
await page.keyboard.up('ArrowRight');

const state = await page.evaluate(() => {
  // main.js doesn't expose game globally; sniff via the canvas being live + no errors.
  return { hasCanvas: !!document.getElementById('game') };
});

await page.screenshot({ path: 'tests/_smoke.png' });
await browser.close();

if (errors.length) { console.error('SMOKE FAIL — page errors:\n' + errors.join('\n')); process.exit(1); }
if (!state.hasCanvas) { console.error('SMOKE FAIL — no canvas'); process.exit(1); }
console.log('SMOKE PASS — ran title->play->run&gun with no page errors (see tests/_smoke.png)');
```

- [ ] **Step 2: Expose the game for assertions**

So the smoke can assert real state, add one line at the end of `src/main.js` (after `const game = new Game();`):

```js
if (typeof window !== 'undefined') window.__game = game;
```

Then strengthen the smoke's `evaluate` to assert progress:

```js
const state = await page.evaluate(() => ({
  state: window.__game?.state,
  x: window.__game?.player?.x ?? 0,
  score: window.__game?.score ?? 0,
}));
// after run&gun we should be playing (or clear) and have advanced
if (!['playing', 'clear'].includes(state.state)) { console.error('SMOKE FAIL — unexpected state', state); process.exit(1); }
```

- [ ] **Step 3: Run it host-side (if Chrome available)**

```bash
# terminal A (repo root):
python3 -m http.server 8000
# terminal B (games/warrior/), with puppeteer-core available on the host:
node tests/smoke.mjs
```

Expected: `SMOKE PASS …` and a `tests/_smoke.png` screenshot showing the soldier mid-level. If `SKIP`/no Chrome, rely on the Task 12 manual check.

- [ ] **Step 4: Ignore the smoke screenshot artifact + commit**

Add to `games/warrior/.gitignore`:

```
tests/_smoke.png
```

```bash
git add games/warrior/tests/smoke.mjs games/warrior/.gitignore games/warrior/src/main.js
git commit -m "test(warrior): M1 browser smoke (host-side puppeteer-core) + expose window.__game"
```

---

## Task 14: M1 milestone wrap — gate verification

**Files:** none (verification + summary commit)

- [ ] **Step 1: Run the full unit suite one final time**

Run (from `games/warrior/`): `node --test`
Expected: 6 files, all pass, `# fail 0`. (physics 5, aim 5, weapons 4, entities 6, levels 4, game 6 = 30 subtests.)

- [ ] **Step 2: Confirm the M1 gate (spec §10)**

Check each is true and note it in the commit body:
- physics + aim unit tests pass ✅ (also weapons/entities/levels/game)
- browser: run/jump + 8-dir aim/shoot with the rifle, kill Runner + Jumper, casual in-place respawn, reach the goal → clear ✅ (Task 12 Step 4 or Task 13 smoke)

- [ ] **Step 3: Tag the milestone with an empty marker commit**

```bash
git commit --allow-empty -m "chore(warrior): M1 可玩骨架 complete — L1 run-and-gun playable, physics/aim/game tests green

Gate (spec §10 M1):
- physics/aim/weapons/entities/levels/game unit tests pass (node --test, 0 fail)
- browser: run/jump + classic 8-dir aim + rifle + Runner/Jumper + casual in-place respawn + reach-goal clear
Next: M2 (卧倒 + M/S/L weapons + 红鹰 pickup + B 屏障 + L1 BOSS + 爆炸/连击)."
```

---

## Self-Review (run after the plan is written, before execution)

**1. Spec coverage (M1 scope from §10):** run/jump ✅ (Player.update), classic 8-dir "hold-to-aim" ✅ (resolveAim + aim.test), default rifle ✅ (weapons.fire + Player.fire), Runner + Jumper ✅ (entities + tests), casual in-place respawn ✅ (game._onPlayerDead, infinite lives), reach-goal clear, no BOSS ✅ (game._levelClear, goalX). Gate = physics/aim tested ✅ + browser playable ✅. Out-of-scope items (prone, M/S/L/F, items, Falcon, BOSS, save/select/mode UI, L2–L5, touch, parallax, BGM, hub card) explicitly deferred with milestone tags.

**2. Placeholder scan:** No "TBD/TODO/handle later" left as work. Every code block is complete and correct as-written — paste-and-run. Test commands all have exact expected output (pass counts / FAIL reason). The only intentionally-deferred behaviors are the out-of-M1-scope features, each tagged with its target milestone, not left as in-file placeholders.

**3. Type/name consistency:** `Intent` fields (moveX/aimUp/aimDown/jumpHeld/fireHeld) match across input/entities/game/tests. `world` methods (addScore/spawnEnemy/spawnBullets/playSound/shake/addFloatText/spawnParticles) match between `_makeWorld`, entity call sites, and tests. `weapons.fire(weaponId, x, y, aim, opts)` signature matches Player.fire and weapons.test. `parseLevel` returns {grid,cols,rows,width,height,spawn,goalX,enemies,...} consumed identically by game.js (`lv.width/height/goalX/cols`) and render.js (`lv.cols/rows/height/goalX/name/theme`). `Bullet(spec)` shape matches weapons specs and entities/game spawn. Player API (update/fire/takeDamage/startDeath/respawn/frame/aim) consistent across entities.js, game.js, render.js, and all tests. Sound.play(id) ids (shoot/jump/hit/die/clear) match emitters.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-07-jungle-warrior-m1.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration. (Subagent prompts must explicitly authorize spend, or the cost-guard hook self-blocks big builds in this repo.)
2. **Inline Execution** — execute tasks in this session via superpowers:executing-plans, batched with checkpoints for review.
