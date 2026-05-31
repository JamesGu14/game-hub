# 丛林尖兵 JUNGLE BLITZ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an original Contra-style 2D run-and-gun side-scroller (`games/jungle-blitz/`) for a 7-year-old — 5 stages, mini-bosses + a multi-phase final boss, kid-friendly health/lives/checkpoints, 8-direction aim with hold-to-autofire — integrated into the game-hub.

**Architecture:** Pure-static ES modules (no build step), mirroring the `breakout` game layout. All logic runs in a fixed `FIELD` (960×540) coordinate space that `render.js` letterboxes to the canvas. The world is wider than the viewport; a forward-only camera scrolls horizontally. A `game.js` state machine drives `menu/playing/paused/stageclear/gameover/win`; per-frame `update(dt)` order is input → player → bullets → enemies/boss → collisions → camera → spawning → win/lose/checkpoint → effects. Levels are pure data in `levels.js`; bosses are behavior modules in `bosses.js`. Pure math/aim/collision helpers live in `src/util/math.js` and are unit-tested with Node's built-in test runner.

**Tech Stack:** Vanilla JS ES modules, Canvas 2D, Web Audio (synth SFX, no asset files), `localStorage`, Gamepad API. Tests: `node --test` (Node ≥18 built-in `node:test`, zero dependencies). Local serve via existing `./start.sh`.

**Reference template:** `games/breakout/` — copy its idioms for letterbox scaling (`render.js`), unified keyboard+gamepad input (`input.js`), Web Audio SFX + mute (`audio.js`), HTML overlay panels + button wiring (`index.html` + `main.js`), and `style.css` visual language (dark neon panels, big buttons, `← HUB` link, mute button). When this plan says "follow breakout's pattern," read the corresponding breakout file and match its style.

**Spec:** `docs/superpowers/specs/2026-05-31-jungle-blitz-design.md` (source of truth for all numbers/behaviors).

**Verification tooling:** Manual browser checks run against `./start.sh` (http://localhost:8000/games/jungle-blitz/index.html). Optional automated checks may use the `agent-browser` skill / Playwright MCP to screenshot and read console errors.

---

## File Structure

```
games/jungle-blitz/
  index.html        canvas + HTML overlays (menu/pause/stageclear/gameover/win/stage-banner) + ← HUB + mute
  style.css         visual language matching hub/breakout
  src/
    config.js       FIELD, physics, player/weapon/enemy/boss numbers, scoring, STORAGE_KEY  (pure)
    util/math.js    aabb, clamp, lerp, cameraTarget, resolveAim, spreadDirections, angleOf   (pure, tested)
    levels.js       5 stage data objects + helpers getStage/stageCount                       (pure, tested)
    input.js        keyboard+gamepad → continuous {moveX,aimUp,aimDown,fireHeld} + edge events
    audio.js        Web Audio SFX + toggleMuted()
    world.js        loads a stage; terrain/platform/pit/water collision; camera; parallax bg draw-data
    player.js       Player class: run/jump/crouch/8-dir aim/health/iframes/knockback/respawn
    bullets.js      Bullets pool (player + enemy), weapon firing (normal/spread/laser), grenades
    powerups.js     supply pods + weapon/shield/heal pickups
    enemies.js      enemy types + spawn factory + AI; enemy projectile emission
    bosses.js       5 boss behaviors (gate/gunship/mech/twinCannon/core multi-phase) + boss HP
    game.js         state machine, system orchestration, spawning, checkpoints, lives, scoring, win/lose
    render.js       letterbox scaling; draws bg/terrain/entities/effects/HUD/boss-bar
    main.js         boot, overlay button wiring, RAF loop
  tests/
    math.test.mjs   node:test for util/math.js
    levels.test.mjs node:test validating all 5 stage data objects
  README.md         short how-to-play + controls (Chinese)
js/games.js         MODIFY: append the jungle-blitz registry entry
start.sh            (no change needed; it already serves static games. Verify note still accurate.)
```

**Module dependency direction (no cycles):** `config` ← everyone; `util/math` ← world/player/bullets/enemies/bosses/game; `levels` ← world/game; `input`,`audio` ← game/main; `world`←game; `player/bullets/powerups/enemies/bosses` ← game; `render`←game(reads state); `main`→game/render/input/audio.

---

## Conventions for every task

- ES modules only; relative imports with `.js` extension.
- All gameplay numbers come from `config.js` — never hard-code a tunable in logic.
- Coordinates are **world-space** for entities; `render.js` subtracts `camera.x` and applies the letterbox transform.
- Chinese UI strings (match breakout tone).
- Commit after each task with `git add games/jungle-blitz <other touched files> && git commit -m "..."`.
- Browser verification = `./start.sh` then open the game URL; confirm the stated observation AND that the devtools console has **no errors**.

---

## Task 1: Scaffold directory, hub registration, and a black-canvas page that loads

**Files:**
- Create: `games/jungle-blitz/index.html`
- Create: `games/jungle-blitz/style.css`
- Create: `games/jungle-blitz/src/main.js` (temporary stub)
- Modify: `js/games.js` (append registry entry)

- [ ] **Step 1: Append the hub registry entry** to the `GAMES` array in `js/games.js` (after the `breakout` object):

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
  },
```

- [ ] **Step 2: Create `index.html`** — canvas, `← HUB` link, mute button, and empty overlay containers. Follow breakout's `index.html` head/meta exactly (viewport, theme-color `#1a2a12`, stylesheet link). Body skeleton:

```html
<canvas id="game"></canvas>
<a id="back-to-hub" href="../../index.html" title="返回游戏中心 / Back to Hub">← HUB</a>
<button id="btn-mute" type="button" title="静音 / 声音 (M)">🔊</button>

<!-- stage banner (transient) -->
<div id="stage-banner" class="stage-banner"><span id="sb-text"></span></div>

<!-- overlays: menu / pause / stageclear / gameover / win  (filled in Task 12) -->
<div id="overlay-menu" class="overlay show"><div class="panel"><h1 class="game-title">🪖 丛林尖兵</h1><p class="game-sub">横版跑射 · 闯关打 BOSS</p><button id="btn-start" class="big-btn" type="button">▶ 开始游戏</button><p id="menu-best" class="best-line">🏆 最高分 0 · 最远第 1 关</p><div class="hints"></div></div></div>
<div id="overlay-pause" class="overlay"><div class="panel"></div></div>
<div id="overlay-stageclear" class="overlay"><div class="panel"></div></div>
<div id="overlay-gameover" class="overlay"><div class="panel"></div></div>
<div id="overlay-win" class="overlay"><div class="panel"></div></div>

<script type="module" src="src/main.js"></script>
```

- [ ] **Step 3: Create `style.css`** — copy breakout's `style.css` as the base (canvas full-bleed, `.overlay`/`.panel`/`.big-btn`/`#back-to-hub`/`#btn-mute`/`.hints` styles, `.show` toggle), then change the background gradient to jungle tones (deep greens `#1a2a12`→`#0c1408`) and accent to `#8bc34a`. Add a `.stage-banner` style (centered, large text, fades; hidden unless `.show`).

- [ ] **Step 4: Create temporary `src/main.js` stub:**

```js
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();
ctx.fillStyle = '#0c1408'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#8bc34a'; ctx.font = '28px system-ui'; ctx.fillText('丛林尖兵 — scaffold OK', 40, 80);
```

- [ ] **Step 5: Browser verify.** Run `./start.sh`, open the hub — confirm the 🪖 「丛林尖兵 JUNGLE BLITZ」 card appears and is selectable. Click it → the game page loads, shows the dark green canvas with "scaffold OK", the `← HUB` link returns to the hub, and the console has no errors.

- [ ] **Step 6: Commit.**

```bash
git add games/jungle-blitz js/games.js
git commit -m "feat(jungle-blitz): scaffold game dir + hub registration"
```

---

## Task 2: `config.js` — all tunable constants and data tables

**Files:**
- Create: `games/jungle-blitz/src/config.js`

- [ ] **Step 1: Write `config.js`** verbatim (this is the single source of truth referenced by every later task):

```js
// Tunable constants for 丛林尖兵 JUNGLE BLITZ. Pure data — no DOM, importable by node:test.
export const FIELD = { W: 960, H: 540 };

export const PHYSICS = {
  gravity: 2200,     // px/s^2
  moveSpeed: 250,    // px/s horizontal
  jumpVel: -760,     // px/s initial jump velocity
  maxFall: 950,      // px/s terminal velocity
};

export const PLAYER = {
  w: 28, h: 44, proneH: 26,
  hpMax: 5,
  lives: 4,
  iframeMs: 1200,        // i-frames after a normal hit
  respawnIframeMs: 1500, // i-frames after respawning
  knockback: 140, knockbackMs: 140,
};

export const WEAPONS = {
  rifle:   { name: '步枪', dmg: 1, speed: 720,  interval: 180, kind: 'normal', color: '#ffe27a' },
  spread:  { name: '散弹', dmg: 1, speed: 680,  interval: 260, kind: 'spread', pellets: 5, spreadDeg: 26, color: '#ff9f43' },
  machine: { name: '机枪', dmg: 1, speed: 820,  interval: 90,  kind: 'normal', color: '#7af0ff' },
  laser:   { name: '激光', dmg: 2, speed: 1100, interval: 300, kind: 'laser', pierce: true, color: '#b983ff' },
};
export const DEFAULT_WEAPON = 'rifle';
export const POD_KIND_TO_WEAPON = { weaponS: 'spread', weaponM: 'machine', weaponL: 'laser' };

export const ITEMS = { shieldMs: 6000, healAmount: 2 };
export const POWERUP = { w: 30, h: 30, driftSpeed: 30, bobAmp: 8, bobHz: 1.2 };

export const BULLET = { r: 5, enemyR: 6, lifeS: 2.5, laserLen: 26, laserW: 6 };
export const ENEMY_BULLET = { speed: 300, color: '#ff5d5d' };
export const GRENADE = { gravity: 1400, vx: 160, vy: -420, color: '#ffd23f', fuseS: 1.4, blastR: 36 };

export const ENEMIES = {
  grunt:     { w: 26, h: 40, hp: 2, speed: 70,  fireMs: 1400, score: 100, color: '#d23b3b' },
  turret:    { w: 38, h: 30, hp: 4, fireMs: 1500, score: 150, color: '#9aa0a6' },
  drone:     { w: 34, h: 22, hp: 2, speed: 90, amp: 50, dropMs: 1600, score: 150, color: '#c060c0' },
  jumper:    { w: 28, h: 36, hp: 3, jumpMs: 1600, jumpVel: -700, speed: 120, score: 150, color: '#e08a2b' },
  grenadier: { w: 26, h: 40, hp: 3, throwMs: 1900, score: 200, color: '#8a6d3b' },
  nest:      { w: 46, h: 46, hp: 5, fireMs: 1200, score: 250, color: '#6b4f2a' },
};

export const BOSSES = {
  gate:       { hp: 30, score: 1500, dropWeapon: 'spread' },
  gunship:    { hp: 40, score: 2500, dropWeapon: 'machine' },
  mech:       { hp: 50, score: 3500, dropWeapon: 'laser' },
  twinCannon: { hp: 55, score: 4500, dropWeapon: 'spread' },
  core:       { phaseHp: [40, 40, 40], score: 8000 },
};

export const SCORE = { stageClear: 1000, pickup: 50, win: 5000 };
export const CAMERA = { followRatio: 0.38 };
export const STORAGE_KEY = 'jungle-blitz-best';
```

- [ ] **Step 2: Commit.**

```bash
git add games/jungle-blitz/src/config.js
git commit -m "feat(jungle-blitz): add config constants"
```

---

## Task 3: `util/math.js` — pure helpers, test-first

**Files:**
- Create: `games/jungle-blitz/tests/math.test.mjs`
- Create: `games/jungle-blitz/src/util/math.js`

- [ ] **Step 1: Write the failing tests** in `tests/math.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aabb, clamp, lerp, cameraTarget, resolveAim, spreadDirections } from '../src/util/math.js';

test('aabb overlap', () => {
  assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 5, h: 5 }), false);
});

test('clamp & lerp', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('cameraTarget is forward-only and clamped', () => {
  // worldW 2000, FIELD.W 960 → max cam.x = 1040
  assert.equal(cameraTarget(0, 2000, 0), 0);                 // never below 0
  assert.equal(Math.round(cameraTarget(500, 2000, 0)), Math.round(500 - 960 * 0.38));
  assert.equal(cameraTarget(99999, 2000, 0), 1040);          // clamped to right edge
  assert.equal(cameraTarget(100, 2000, 800), 800);           // forward-only: won't scroll back
});

test('resolveAim 8 directions', () => {
  assert.deepEqual(resolveAim({ facing: 1, moveX: 0, aimUp: false, aimDown: false, onGround: true }), { x: 1, y: 0 });
  assert.deepEqual(resolveAim({ facing: -1, moveX: 0, aimUp: false, aimDown: false, onGround: true }), { x: -1, y: 0 });
  assert.deepEqual(resolveAim({ facing: 1, moveX: 0, aimUp: true, aimDown: false, onGround: true }), { x: 0, y: -1 });
  const d = resolveAim({ facing: 1, moveX: 1, aimUp: true, aimDown: false, onGround: true }); // diagonal up-right
  assert.ok(d.x > 0.7 && d.x < 0.71 && d.y < -0.7);
  assert.deepEqual(resolveAim({ facing: 1, moveX: 0, aimUp: false, aimDown: true, onGround: false }), { x: 0, y: 1 }); // air, down
});

test('spreadDirections fan is symmetric and centered', () => {
  const dirs = spreadDirections(0, 5, 26); // base angle 0 (right)
  assert.equal(dirs.length, 5);
  assert.ok(Math.abs(dirs[2].y) < 1e-9);          // middle pellet straight
  assert.ok(dirs[0].y < 0 && dirs[4].y > 0);      // outer pellets fan up/down
});
```

- [ ] **Step 2: Run to verify failure.** Run: `node --test games/jungle-blitz/tests/math.test.mjs`
  Expected: FAIL — `Cannot find module '../src/util/math.js'`.

- [ ] **Step 3: Implement `src/util/math.js`:**

```js
import { FIELD, CAMERA } from '../config.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Forward-only camera: returns max(prevCamX, clampedTarget).
export function cameraTarget(playerX, worldW, prevCamX) {
  const want = playerX - FIELD.W * CAMERA.followRatio;
  const clamped = clamp(want, 0, Math.max(0, worldW - FIELD.W));
  return Math.max(prevCamX, clamped);
}

// 8-direction aim unit vector from input flags + state.
export function resolveAim({ facing, moveX, aimUp, aimDown, onGround }) {
  const s = Math.SQRT1_2;
  if (aimUp) return moveX === 0 ? { x: 0, y: -1 } : { x: Math.sign(moveX) * s, y: -s };
  if (aimDown && !onGround) return moveX === 0 ? { x: 0, y: 1 } : { x: Math.sign(moveX) * s, y: s };
  return { x: facing, y: 0 }; // prone (aimDown && onGround) also shoots horizontal
}

// Fan of unit vectors around baseAngle (radians); span = spreadDeg degrees total.
export function spreadDirections(baseAngle, pellets, spreadDeg) {
  const span = (spreadDeg * Math.PI) / 180;
  const out = [];
  for (let i = 0; i < pellets; i++) {
    const t = pellets === 1 ? 0.5 : i / (pellets - 1);
    const a = baseAngle - span / 2 + t * span;
    out.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return out;
}

export const angleOf = (x, y) => Math.atan2(y, x);
```

- [ ] **Step 4: Run tests to verify pass.** Run: `node --test games/jungle-blitz/tests/math.test.mjs`
  Expected: PASS (5 tests).

- [ ] **Step 5: Commit.**

```bash
git add games/jungle-blitz/src/util/math.js games/jungle-blitz/tests/math.test.mjs
git commit -m "feat(jungle-blitz): pure math/aim/camera helpers + tests"
```

---

## Task 4: `levels.js` — Stage 1 data + accessors, with validation test

**Files:**
- Create: `games/jungle-blitz/src/levels.js`
- Create: `games/jungle-blitz/tests/levels.test.mjs`

Stage data shape (from spec §8). For Task 4 author **Stage 1 fully**; Stages 2–5 are added in Task 16, but include `STAGES` as an array and the accessors now.

- [ ] **Step 1: Write `levels.js` with Stage 1 + accessors:**

```js
import { FIELD } from './config.js';

// Each floor/platform: world-space rect. Gaps between floors are pits.
// boss ∈ {'gate','gunship','mech','twinCannon','core'}. pods.kind ∈ {weaponS,weaponM,weaponL,shield,heal}.
export const STAGES = [
  {
    id: 1,
    name: '丛林入口',
    palette: { sky: '#274b1a', far: '#1d3a14', mid: '#16300f', ground: '#3a5a22', accent: '#8bc34a' },
    worldWidth: 4600,
    groundY: 470,
    floors: [
      { x: 0, w: 1300, y: 470 },
      { x: 1480, w: 1500, y: 470 }, // gap 1300..1480 = pit (tutorial-safe: shallow)
      { x: 3120, w: 1480, y: 470 },
    ],
    platforms: [
      { x: 700, y: 360, w: 160, h: 18, oneWay: true },
      { x: 2000, y: 360, w: 180, h: 18, oneWay: true },
      { x: 2600, y: 300, w: 160, h: 18, oneWay: true },
    ],
    hazards: [],
    decor: [{ type: 'tree', x: 300, y: 470 }, { type: 'tent', x: 2200, y: 470 }],
    spawns: [
      { x: 600, type: 'grunt' },
      { x: 1000, type: 'grunt' },
      { x: 1700, type: 'grunt' },
      { x: 2300, type: 'turret' },
      { x: 3000, type: 'grunt' },
      { x: 3400, type: 'jumper' },
    ],
    pods: [{ x: 900, y: 300, kind: 'weaponS' }, { x: 2700, y: 250, kind: 'heal' }],
    checkpoints: [1600, 3120],
    bossX: 4150,
    boss: 'gate',
  },
];

export const stageCount = () => STAGES.length;
export const getStage = (i) => STAGES[i];
```

- [ ] **Step 2: Write validation test** `tests/levels.test.mjs` (guards every stage as they get added in Task 16):

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STAGES } from '../src/levels.js';
import { FIELD } from '../src/config.js';

const BOSSES = new Set(['gate', 'gunship', 'mech', 'twinCannon', 'core']);
const POD_KINDS = new Set(['weaponS', 'weaponM', 'weaponL', 'shield', 'heal']);

for (const s of STAGES) {
  test(`stage ${s.id} (${s.name}) is internally valid`, () => {
    assert.ok(s.worldWidth > FIELD.W, 'world wider than viewport');
    assert.ok(s.bossX > 0 && s.bossX < s.worldWidth, 'bossX inside world');
    assert.ok(BOSSES.has(s.boss), 'known boss');
    assert.ok(s.floors.length >= 1, 'has ground');
    for (const c of s.checkpoints) assert.ok(c > 0 && c < s.worldWidth, 'checkpoint inside world');
    const sorted = [...s.checkpoints].sort((a, b) => a - b);
    assert.deepEqual(s.checkpoints, sorted, 'checkpoints ascending');
    for (const sp of s.spawns) assert.ok(sp.x > 0 && sp.x < s.worldWidth, 'spawn inside world');
    for (const p of s.pods) assert.ok(POD_KINDS.has(p.kind), 'known pod kind');
  });
}

test('stage 5 (final) uses the core boss', () => {
  const last = STAGES[STAGES.length - 1];
  if (last.id === 5) assert.equal(last.boss, 'core');
});
```

- [ ] **Step 3: Run tests.** Run: `node --test games/jungle-blitz/tests/levels.test.mjs`
  Expected: PASS (stage 1 valid; the stage-5 test is a no-op until Task 16).

- [ ] **Step 4: Commit.**

```bash
git add games/jungle-blitz/src/levels.js games/jungle-blitz/tests/levels.test.mjs
git commit -m "feat(jungle-blitz): stage data model + stage 1 + validation tests"
```

---

## Task 5: `world.js` + `render.js` + `input.js` (move/jump only) + `main.js` loop — a box that runs, jumps, and scrolls

This is the first **playable milestone**: a placeholder player box obeys gravity, runs, jumps, lands on floors/platforms, and the camera scrolls. No shooting/enemies yet.

**Files:**
- Create: `games/jungle-blitz/src/world.js`
- Create: `games/jungle-blitz/src/render.js`
- Create: `games/jungle-blitz/src/input.js`
- Replace: `games/jungle-blitz/src/main.js`

- [ ] **Step 1: Implement `world.js`** — loads a stage and answers terrain queries:
  - `class World { constructor(stage) }` stores `stage`, `worldWidth`, `floors`, `platforms`, `camX = 0`.
  - `solids()` → returns `floors` (as full-height blockers from `y` down) + non-oneWay platforms.
  - `floorTopAt(x)` → the highest floor `y` covering world-x `x`, or `Infinity` if over a pit.
  - `oneWayPlatforms()` → platforms with `oneWay`.
  - `updateCamera(playerX)` → `this.camX = cameraTarget(playerX, this.worldWidth, this.camX)` (import from util/math). During boss fight `game` will freeze camera by not calling this.
  - `pitBottomY = FIELD.H + 80` constant (fall threshold).
  - Provide getters the renderer reads (palette, floors, platforms, decor) — keep `world.js` logic-only; actual drawing lives in `render.js`.

- [ ] **Step 2: Implement `input.js`** (move/jump subset now; aim/fire added in Task 7). Follow breakout's structure: keyboard listeners + `poll()` for gamepad. Expose:
  - state: `moveX` (−1..1), `aimUp`, `aimDown`, `fireHeld` (all default 0/false now; only `moveX` wired this task), and edge emitter `on(fn)` for `'jump' | 'pause' | 'confirm' | 'back' | 'mute'`.
  - Keyboard: `A/←`→moveX−1 held, `D/→`→moveX+1 held (track a held Set, recompute), `K`/`Space`/`Z` keydown(no-repeat)→emit `jump`, `Enter`→`confirm`, `Esc`/`P`→`pause`, `Backspace`→`back`, `M`→`mute`.
  - `poll()`: gamepad left-stick X (deadzone 0.25) + dpad 14/15 → moveX; button 0 edge → `jump`; button 9 edge → `pause`; button 1 edge → `back`. Use a `_padPrev` map for edges (copy breakout's `edge(i)` helper).

- [ ] **Step 3: Implement `render.js`** — letterbox + draw:
  - Constructor stores canvas/ctx; `resize()` on window resize; compute `scale = min(cw/FIELD.W, ch/FIELD.H)` and centered offset (copy breakout's letterbox math). Provide `mapClientXToField(clientX)` for parity (unused now).
  - `render(game)`: clear; set transform to letterbox; draw via camera offset `tx = -world.camX`:
    1. parallax background using `stage.palette` (sky fill + 2 scrolling silhouette bands at 0.3×/0.6× camX).
    2. floors (filled rects from `y` to `FIELD.H`), one-way platforms (thin bars), decor (simple trees/tents as triangles/rects).
    3. player placeholder: `ctx.fillStyle='#cfe8a0'; rect(player.x - camX, player.y, player.w, player.h)`.
  - HUD/entities added in later tasks.

- [ ] **Step 4: Replace `main.js`** with the real loop (model on breakout's `main.js`), but the Game is a temporary inline object this task (real `game.js` arrives in Task 12). Minimal driver:

```js
import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { getStage } from './levels.js';
import { PHYSICS, PLAYER } from './config.js';
import { clamp } from './util/math.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const world = new World(getStage(0));
Input.init(canvas, (cx) => renderer.mapClientXToField(cx));

// Temporary player box (replaced by player.js in Task 6).
const player = { x: 80, y: 300, w: PLAYER.w, h: PLAYER.h, vx: 0, vy: 0, onGround: false, facing: 1 };
let wantJump = false;
Input.on((a) => { if (a === 'jump') wantJump = true; });

function step(dt) {
  player.vx = Input.moveX * PHYSICS.moveSpeed;
  if (Input.moveX) player.facing = Math.sign(Input.moveX);
  if (wantJump && player.onGround) { player.vy = PHYSICS.jumpVel; player.onGround = false; }
  wantJump = false;
  player.vy = clamp(player.vy + PHYSICS.gravity * dt, PHYSICS.jumpVel, PHYSICS.maxFall);
  player.x = clamp(player.x + player.vx * dt, 0, world.worldWidth - player.w);
  player.y += player.vy * dt;
  // land on highest floor under the player's feet
  const top = world.floorTopAt(player.x + player.w / 2);
  if (player.y + player.h >= top) { player.y = top - player.h; player.vy = 0; player.onGround = true; }
  else player.onGround = false;
  world.updateCamera(player.x);
}

const game = { world, player }; // shape renderer reads
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045); last = now;
  Input.poll(); step(dt); renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 5: Browser verify.** `./start.sh` → open game. Confirm: a light box sits on the ground; `A/D` (and `←/→`, gamepad stick/dpad) move it and scroll the camera; `K`/`Space`/gamepad ✕ jumps and it lands on floors and the one-way platforms; walking off the floor gap lets it fall; no console errors.

- [ ] **Step 6: Commit.**

```bash
git add games/jungle-blitz/src
git commit -m "feat(jungle-blitz): world+camera, letterbox render, input, run/jump milestone"
```

---

## Task 6: `player.js` — real Player class (run/jump/crouch/facing, terrain + one-way landing)

**Files:**
- Create: `games/jungle-blitz/src/player.js`
- Modify: `games/jungle-blitz/src/main.js` (use `Player` instead of the inline box)

- [ ] **Step 1: Implement `player.js`:**
  - `class Player { constructor(spawnX, spawnY) }` fields: `x,y,w,h,vx,vy,onGround,facing(1/-1),prone(false)`, plus health fields stubbed for now (`hp=PLAYER.hpMax`, `lives=PLAYER.lives`, `invMs=0`, `shieldMs=0`) — health logic wired in Task 11. `weapon = DEFAULT_WEAPON`.
  - `update(dt, input, world)`:
    - `vx = input.moveX * PHYSICS.moveSpeed`; if `input.moveX` set `facing`.
    - prone = `input.aimDown && onGround` (height shrinks to `PLAYER.proneH`, feet stay on ground: adjust `y` so bottom unchanged).
    - gravity integrate with `clamp(vy + gravity*dt, jumpVel, maxFall)`.
    - Move X with horizontal clamp to `[0, world.worldWidth - w]`; resolve against solid platforms (block horizontally if overlapping a non-oneWay solid).
    - Move Y; land on highest of: floor under feet (`world.floorTopAt`) OR any one-way platform top the feet crossed this frame (only when `vy >= 0` and previous bottom ≤ platform top). Set `onGround` accordingly.
    - expose `aabbBox()` → `{x,y,w,h}` (uses current prone height).
  - `jump()` method: `if (this.onGround) { this.vy = PHYSICS.jumpVel; this.onGround = false; }` (called on the `jump` edge).

- [ ] **Step 2: Update `main.js`** to instantiate `new Player(80, 300)`, call `Input.on(a => { if (a === 'jump') player.jump(); })`, and `player.update(dt, Input, world)` in `step`. Keep `game = { world, player }`.

- [ ] **Step 3: Browser verify.** Run game: movement/jump unchanged from Task 5; additionally holding `S`/`↓` while grounded makes the box shorter (prone). Landing works on both floors and one-way platforms (you can jump up through a one-way platform from below and land on its top). No console errors.

- [ ] **Step 4: Commit.**

```bash
git add games/jungle-blitz/src/player.js games/jungle-blitz/src/main.js
git commit -m "feat(jungle-blitz): Player class with run/jump/crouch + terrain collision"
```

---

## Task 7: Complete `input.js` (8-direction aim + fire) and player aim vector

**Files:**
- Modify: `games/jungle-blitz/src/input.js`
- Modify: `games/jungle-blitz/src/player.js` (compute `aim` each frame)

- [ ] **Step 1: Extend `input.js`:**
  - Keyboard held tracking for `W/↑`→`aimUp`, `S/↓`→`aimDown`. `J`/`X` keydown→`fireHeld=true`, keyup→`fireHeld=false`.
  - `poll()` gamepad: stick Y / dpad 12 (up) → `aimUp`, dpad 13 / stick down → `aimDown`; button 2 OR button 5 pressed → `fireHeld`. (Keep edges for jump/pause/back as before.)
  - OR-combine keyboard + gamepad for the booleans each `poll()`.

- [ ] **Step 2: In `player.update`** compute and store `this.aim = resolveAim({ facing: this.facing, moveX: input.moveX, aimUp: input.aimUp, aimDown: input.aimDown, onGround: this.onGround })` (import `resolveAim`). Also add `muzzle()` → world-space `{x,y}` at the gun tip: from player center, offset by `aim` × ~20px, gun height ≈ center−6 standing (near top when aiming up).

- [ ] **Step 3: Browser verify (temporary debug draw).** Temporarily, in `render.js`, draw a short line from player center along `player.aim` (remove after confirming). Confirm holding `↑`, `↑+→`, jump+`↓`, etc. rotates the aim line through the 8 directions; gamepad does the same. Remove the debug line. No console errors.

- [ ] **Step 4: Commit.**

```bash
git add games/jungle-blitz/src/input.js games/jungle-blitz/src/player.js
git commit -m "feat(jungle-blitz): 8-direction aim input + player aim vector"
```

---

## Task 8: `bullets.js` — player bullets + default rifle, hold-to-autofire

**Files:**
- Create: `games/jungle-blitz/src/bullets.js`
- Modify: `games/jungle-blitz/src/main.js` (fire on `fireHeld`, update+draw bullets)
- Modify: `games/jungle-blitz/src/render.js` (draw bullets)

- [ ] **Step 1: Implement `bullets.js`:**
  - `class Bullets { list = [] }`.
  - `spawn({x,y,dx,dy,speed,dmg,faction,kind,color,pierce})` pushes `{x,y,vx:dx*speed,vy:dy*speed,dmg,faction,kind,color,pierce,life:BULLET.lifeS,dead:false,hits:new Set()}`.
  - `fireWeapon(weaponKey, muzzle, aim, faction)`: read `WEAPONS[weaponKey]`. `kind:'normal'` → spawn 1 bullet along `aim`. `kind:'spread'` → use `spreadDirections(angleOf(aim.x,aim.y), pellets, spreadDeg)`, spawn one per dir. `kind:'laser'` → spawn a piercing bullet (renderer draws a short beam).
  - `update(dt, world)`: integrate; decrement `life`; mark `dead` when `life<=0` or far off-world (`|x - world.camX| > FIELD.W + 200` or `y` out of `[-200, FIELD.H+200]`). (Bullets do NOT collide with terrain in this kid-friendly design — keeps shots readable. Intentional, not a gap.)
  - `forEachActive(cb)`, `compact()` (drop dead), and `clear()`.

- [ ] **Step 2: Player firing in `main.js`:** maintain `player.fireCooldown` (init 0). Each frame: `if (Input.fireHeld && player.fireCooldown <= 0) { bullets.fireWeapon(player.weapon, player.muzzle(), player.aim, 'player'); player.fireCooldown = WEAPONS[player.weapon].interval / 1000; } player.fireCooldown -= dt;`. Then `bullets.update(dt, world)`.

- [ ] **Step 3: Draw bullets** in `render.js`: normal → filled circle `BULLET.r` in bullet color; laser → rounded rect `laserLen×laserW` rotated to velocity angle. Apply camera offset.

- [ ] **Step 4: Browser verify.** Hold `J` (and gamepad □) → a steady stream of rifle bullets fires along the current aim (try all 8 directions). Releasing stops fire. Bullets disappear off-screen; no console errors; framerate steady.

- [ ] **Step 5: Commit.**

```bash
git add games/jungle-blitz/src/bullets.js games/jungle-blitz/src/main.js games/jungle-blitz/src/render.js
git commit -m "feat(jungle-blitz): bullets + rifle autofire along 8-dir aim"
```

---

## Task 9: `powerups.js` — supply pods + weapon switch / shield / heal

**Files:**
- Create: `games/jungle-blitz/src/powerups.js`
- Modify: `games/jungle-blitz/src/main.js` (spawn stage pods, update, collide)
- Modify: `games/jungle-blitz/src/render.js` (draw pods)

- [ ] **Step 1: Implement `powerups.js`:**
  - `class PowerUps { list = [] }`; `spawnFromStage(stage)` creates a pod per `stage.pods` entry `{x,y,y0:y,kind,w:POWERUP.w,h:POWERUP.h,t:0,dead:false}`.
  - `spawnPod(x,y,kind)` for boss drops (Task 13).
  - `update(dt)`: bob vertically (`y = y0 + sin(t*bobHz*2π)*bobAmp`); keep simple.
  - `tryCollect(box)` → first pod whose AABB overlaps `box`, mark dead, return its `kind` (or null).
  - `popByBullet(bullets)` → if a player bullet overlaps a pod, mark dead and return its `kind` (collection by shooting OR touching).
  - `effectFor(kind)` → `{type:'weapon',weapon:POD_KIND_TO_WEAPON[kind]}` | `{type:'shield'}` | `{type:'heal'}`.

- [ ] **Step 2: Wire in `main.js`:** instantiate `PowerUps`, `spawnFromStage(getStage(0))`. Each frame `update(dt)`; collect via `tryCollect(player.aabbBox())` and `popByBullet(bullets)`; apply `effectFor(kind)`: weapon → `player.weapon = weapon`; heal → `player.hp = Math.min(PLAYER.hpMax, player.hp + ITEMS.healAmount)`; shield → `player.shieldMs = ITEMS.shieldMs`.

- [ ] **Step 3: Draw pods** in `render.js`: rounded square in a kind color with the letter (S/M/L) or emoji (🛡/❤️) centered; gentle glow.

- [ ] **Step 4: Browser verify.** Walk/shoot into the Stage-1 pods: the `S` pod switches firing to the spread fan (visibly 5 pellets); the heal pod is consumed. Console clean.

- [ ] **Step 5: Commit.**

```bash
git add games/jungle-blitz/src/powerups.js games/jungle-blitz/src/main.js games/jungle-blitz/src/render.js
git commit -m "feat(jungle-blitz): supply pods + weapon switch/shield/heal pickups"
```

---

## Task 10: `enemies.js` — enemy types, AI, enemy bullets, combat & death

**Files:**
- Create: `games/jungle-blitz/src/enemies.js`
- Modify: `games/jungle-blitz/src/main.js` (spawn from stage on camera approach, update, collisions)
- Modify: `games/jungle-blitz/src/render.js` (draw enemies + enemy bullets + grenades)

- [ ] **Step 1: Implement `enemies.js`:**
  - `class Enemies { list=[]; pending=[] }`. `loadStage(stage)` copies `stage.spawns` into `pending` (sorted by x).
  - `update(dt, world, player, bullets)`:
    - Activation: move a pending spawn into `list` when `spawn.x < world.camX + FIELD.W + 80`. Build the enemy via a factory keyed by `type` reading `ENEMIES[type]`, on the floor (`y = world.floorTopAt(spawn.x) - h`). Timers initialized to their `*Ms` value.
    - Per-enemy AI (timers in ms, decrement by `dt*1000`; fire via `bullets.spawn({faction:'enemy', kind:'normal', speed:ENEMY_BULLET.speed, color:ENEMY_BULLET.color, dmg:1, ...})`):
      - `grunt`: walk toward player at `speed` (face player); every `fireMs` fire one bullet horizontally toward player.
      - `turret`: stationary; every `fireMs` fire an aimed bullet at player (unit vector player−self).
      - `drone`: hover at fixed altitude, oscillate `y` by `amp*sin(t)`, advance slowly toward player x; every `dropMs` drop a downward bullet.
      - `jumper`: every `jumpMs` set `vy=jumpVel`, `vx` toward player; gravity + floor landing via `world.floorTopAt`.
      - `grenadier`: stationary; every `throwMs` launch a grenade (own list `grenades` with arc vx/vy + `GRENADE.gravity`; explode on `fuseS` or on landing → brief blast that damages player within `GRENADE.blastR`).
      - `nest`: stationary destructible; every `fireMs` fire an upward fan of small bullets.
    - Cull enemies with `x < world.camX - 200` → dead.
  - `hitTest(bulletBox)` → first live enemy overlapping (for collision in main).
  - `damage(enemy, dmg)` → subtract hp, set `hitFlashMs`; if `hp<=0` set `dead`, return its `score` else 0.
  - Expose `forEachActive(cb)`, `grenades` list, and `enemyContact(playerBox)` → first enemy overlapping player.

- [ ] **Step 2: Collisions in `main.js`:**
  - Player bullets ↔ enemies: for each active player bullet, `e = enemies.hitTest(bulletBox)`; if hit, `score += enemies.damage(e, bullet.dmg)`; if not `pierce` mark bullet dead; for pierce use `bullet.hits` set to avoid re-hitting the same enemy.
  - Compute `player._enemyBulletHit` = an enemy bullet overlapping `player.aabbBox()` (and its x), and `player._enemyContact` = `enemies.enemyContact(player.aabbBox())` — store for Task 11 to consume (do **not** subtract HP yet; enemy bullets pass through harmlessly this task).
  - Maintain a temporary `score` counter (HUD arrives in Task 11).

- [ ] **Step 3: Draw** enemies (distinct geometric silhouettes per type in their `color`, hit-flash white while `hitFlashMs>0`), enemy bullets (red circles), grenades (yellow circle on its arc) in `render.js`.

- [ ] **Step 4: Browser verify.** Advancing through Stage 1: grunts approach and shoot, the turret aims at you, the jumper leaps. Your bullets kill them (flash then vanish). Spread/rifle both work. Enemy bullets pass through you for now (no damage yet). 60fps; console clean.

- [ ] **Step 5: Commit.**

```bash
git add games/jungle-blitz/src/enemies.js games/jungle-blitz/src/main.js games/jungle-blitz/src/render.js
git commit -m "feat(jungle-blitz): enemies, AI, enemy fire, player-bullet combat"
```

---

## Task 11: Player health/lives/checkpoints/respawn + HUD

**Files:**
- Modify: `games/jungle-blitz/src/player.js` (damage, iframes, knockback, shield, respawn)
- Modify: `games/jungle-blitz/src/render.js` (HUD: HP bar, lives, weapon, score)
- Modify: `games/jungle-blitz/src/main.js` (apply hits, pit/water damage, checkpoint tracking, score state)

- [ ] **Step 1: Player damage model** in `player.js`:
  - `hurt(amount, fromX)`: ignore if `invMs>0` or `shieldMs>0`; else `hp -= amount`, `invMs = PLAYER.iframeMs`, knockback (`vx = Math.sign(this.x - fromX || 1) * PLAYER.knockback`, set `knockMs = PLAYER.knockbackMs`), set `hitFlash`. Return `'died'` if `hp<=0`, else `'hurt'`.
  - `respawn(x,y)`: `hp = PLAYER.hpMax`, position `(x,y)`, `invMs = PLAYER.respawnIframeMs`, `vx=vy=0`, `onGround=false`.
  - In `update`, decrement `invMs/shieldMs/knockMs` by `dt*1000` (floor at 0); while `knockMs>0` keep knockback `vx` (override input vx).
  - Render uses `invMs` (blink) and `shieldMs` (ring).

- [ ] **Step 2: Apply damage in `main.js`:**
  - If `player._enemyBulletHit` → `player.hurt(1, hit.x)` and kill that enemy bullet. If `player._enemyContact` → `player.hurt(1, enemy.x)`.
  - Pit/water: if `player.y > world.pitBottomY` OR over a `water` hazard surface → `player.hurt(1, player.x)` then `player.respawn(respawnX, respawnY)`.
  - Checkpoints: init `respawnX = stageStartX`, `respawnY = floorTopAt(start) - h`. When `player.x` passes a `stage.checkpoints[i]` not yet taken, set `respawnX = that x`, `respawnY = world.floorTopAt(x) - player.h`.
  - On `hurt` returning `'died'`: `player.lives -= 1`; if `player.lives >= 0` → `player.respawn(respawnX, respawnY)`; else set `gameOver` flag and freeze (overlay in Task 12).

- [ ] **Step 3: HUD in `render.js`** (screen-space, after camera-space draws):
  - Top-left: HP bar = `PLAYER.hpMax` segments (filled green / empty dark) + lives as `🪖 × lives`.
  - Top-center: `第 N 关 · 关名` (boss bar replaces it in Task 13).
  - Top-right: `WEAPONS[player.weapon].name` + `score`.
  - Translucent bar background for readability.

- [ ] **Step 4: Browser verify.** Take enemy fire → an HP segment drops, player blinks ~1.2s, knockback nudges you. Drain HP → lose a life and respawn at the last checkpoint with full HP. Heal pod restores HP; shield pod grants ~6s immunity (ring). Walking into the pit costs HP and returns you to the checkpoint. HUD reflects HP/lives/weapon/score. Console clean.

- [ ] **Step 5: Commit.**

```bash
git add games/jungle-blitz/src/player.js games/jungle-blitz/src/render.js games/jungle-blitz/src/main.js
git commit -m "feat(jungle-blitz): health/lives/checkpoints/respawn + HUD"
```

---

## Task 12: `game.js` — state machine, overlays, stage flow, best-score persistence

Moves the loose logic from `main.js` into a `Game` class and adds the full state machine + HTML overlays.

**Files:**
- Create: `games/jungle-blitz/src/game.js`
- Modify: `games/jungle-blitz/src/main.js` (thin driver)
- Modify: `games/jungle-blitz/index.html` (fill pause/stageclear/gameover/win panels)
- Modify: `games/jungle-blitz/src/render.js` (only draw world/HUD when not on menu)

- [ ] **Step 1: Implement `game.js`** — `class Game`:
  - Fields: `state` (`'menu'|'playing'|'paused'|'stageclear'|'gameover'|'win'`), `stageIndex`, `world`, `player`, `bullets`, `enemies`, `powerups`, `boss` (null until Task 13), `score`, `best` (`{score,stage}` from localStorage or `{score:0,stage:1}`), `respawnX/Y`, `takenCheckpoints` (Set), `bannerMs`.
  - `startGame()`: `score=0`, `stageIndex=0`, `loadStage(0)`, `state='playing'`.
  - `loadStage(i)`: build `World(getStage(i))`, `Player` at stage start (on its first floor), fresh `bullets/enemies/powerups`, `enemies.loadStage(stage)`, `powerups.spawnFromStage(stage)`, set respawn to start, `boss=null`, `takenCheckpoints.clear()`, `bannerMs=1600`.
  - `update(dt)`: switch on state. In `playing`: run the per-frame pipeline previously in main (input→player→firing→bullets→enemies→collisions→powerups→camera→hazard/checkpoint→boss-trigger→win/lose). Decrement `bannerMs`. When `player.x >= stage.bossX` and `!boss` → spawn boss (Task 13). On out-of-lives → `state='gameover'`, `persistBest()`.
  - Methods: `togglePause()`, `restartStage()` (reload current stage, keep score? — reset to score-at-stage-start; simplest: reload stage, score unchanged), `continueFromCheckpoint()` (`player.lives=PLAYER.lives`, full hp, `player.respawn(respawnX,respawnY)`, `state='playing'`), `nextStage()` (`loadStage(++stageIndex)`, `state='playing'`), `confirm()` (context per state: menu→startGame; stageclear→nextStage; gameover→continueFromCheckpoint; win→startGame), `toMenu()`.
  - `persistBest()`: `best.score=max(best.score,score)`, `best.stage=max(best.stage, stageIndex+1)`, write `localStorage[STORAGE_KEY]=JSON.stringify(best)`.

- [ ] **Step 2: Fill `index.html` overlay panels** with buttons mirroring breakout's markup, these IDs:
  - pause: `#btn-resume` 继续, `#btn-restart` ↻ 重玩本关, `<a … href="../../index.html">← 返回 HUB</a>`.
  - stageclear: `#sc-title` 「第 N 关 通关！」, `#sc-score`, `#btn-next` 下一关 →.
  - gameover: `#go-score`, `#go-best`, `#btn-continue` ↻ 从复活点再来, `#btn-go-menu` 选择, `← HUB`.
  - win: `#win-score`, `#win-best`, `#btn-win-retry` ↻ 再玩一次, `← HUB`.
  - menu already has `#btn-start` (Task 1).

- [ ] **Step 3: Rewrite `main.js`** as the thin driver (mirror breakout/main.js): build `Game`, `Renderer`, `Input.init`; `overlays` map + `showOverlay(name)`; wire all buttons to game methods; `Input.on(action)` dispatch (`confirm`/`jump`→`game.confirm()` when not playing; `pause`→`togglePause`; `mute`→toggle); RAF loop `Input.poll(); game.update(dt); renderer.render(game); syncOverlays();`. `syncOverlays()` toggles overlays by `game.state` and fills score/best text (model on breakout). Show `#stage-banner` (`sb-text` = `第 N 关 · 关名`) while `game.bannerMs>0`.

- [ ] **Step 4: Browser verify.** Menu → 开始游戏 starts Stage 1 with a banner. `Esc` pauses (继续/重玩本关/返回HUB work). Losing all lives → game-over overlay; 「从复活点再来」 resumes with full lives at checkpoint. Best score shows on menu and persists across reloads. Reaching `bossX` does nothing harmful yet. Console clean.

- [ ] **Step 5: Commit.**

```bash
git add games/jungle-blitz/src/game.js games/jungle-blitz/src/main.js games/jungle-blitz/index.html games/jungle-blitz/src/render.js
git commit -m "feat(jungle-blitz): Game state machine, overlays, stage flow, best persistence"
```

---

## Task 13: `bosses.js` framework + Stage-1 boss (Armored Gate) + boss HP bar + stageclear flow

**Files:**
- Create: `games/jungle-blitz/src/bosses.js`
- Modify: `games/jungle-blitz/src/game.js` (spawn boss at bossX, lock camera, defeat → stageclear/win, drop weapon)
- Modify: `games/jungle-blitz/src/render.js` (draw boss + boss HP bar)

- [ ] **Step 1: Boss framework in `bosses.js`:**
  - `createBoss(type, roomX, world)` → object with common interface: `{ type, name, x, y, w, h, hp, hpMax, phase:1, dead:false, hitFlashMs:0, update(dt, player, bullets, ctx), box(), hurt(dmg) }` where `box()` returns the currently-damageable rect(s) (array for multi-weakpoint bosses), and `ctx` is a small context `{ addEnemy(spawn) }` for bosses that summon (used by core in Task 15).
  - **gate** (Stage 1): a wide armored gate anchored at the right of the boss room; two cannon ports alternately fire an aimed bullet at the player every ~1.1s; central glowing **core** is the only weak point (`box()` = core rect). `hp = BOSSES.gate.hp`. `hurt(dmg)` → hp−=dmg, hitFlash; `dead` when hp≤0.

- [ ] **Step 2: Game integration in `game.js`:**
  - When `player.x >= stage.bossX` and `!boss`: `this.boss = createBoss(stage.boss, bossRoomLeftX, world)`; **lock camera** (stop calling `world.updateCamera`; pin `world.camX` to the boss-room left edge `clamp(stage.bossX - 120, 0, worldWidth-FIELD.W)`); clamp player to the boss room (`player.x >= world.camX`).
  - Player bullets vs each rect in `boss.box()`: apply dmg (respect pierce hit-set), `Sound.bossHit` (Task 17).
  - Boss bullets/contact damage the player via the existing hurt path.
  - On `boss.dead`: `score += BOSSES[type].score`; drop `BOSSES[type].dropWeapon` via `powerups.spawnPod(player.x, player.y-60, weaponKindFor(dropWeapon))`; if `stageIndex === stageCount()-1` → `state='win'`, `persistBest()` else `state='stageclear'`, `persistBest()`. (`weaponKindFor`: invert `POD_KIND_TO_WEAPON`, e.g. `'spread'→'weaponS'`.)

- [ ] **Step 3: Render** boss as a large geometric structure in stage-accent colors with a glowing **weak-point core**; hit-flash on damage. Draw a **boss HP bar** across the top-center (replacing the stage label), labeled `boss.name`.

- [ ] **Step 4: Browser verify.** Reach the end of Stage 1 → camera locks, the Armored Gate appears and fires from two ports; shooting its core drains the boss HP bar; on defeat it explodes, drops a spread pod, and the 「第 1 关 通关！」 overlay shows with 下一关 →. Console clean.

- [ ] **Step 5: Commit.**

```bash
git add games/jungle-blitz/src/bosses.js games/jungle-blitz/src/game.js games/jungle-blitz/src/render.js
git commit -m "feat(jungle-blitz): boss framework + stage-1 Armored Gate + boss HP bar"
```

---

## Task 14: Mini-bosses — Gunship (S2), Heavy Mech (S3), Twin Cannon (S4)

**Files:**
- Modify: `games/jungle-blitz/src/bosses.js` (add three boss state machines)
- Modify: `games/jungle-blitz/src/render.js` (draw the three bosses)

- [ ] **Step 1: Add `gunship`** to the factory: flies horizontally across the top of the boss room, periodically dives toward the player and strafes a short downward burst, then climbs back. `hp = BOSSES.gunship.hp`. Whole body is the hit box (`box()` returns one rect). Telegraph dives with a brief tilt.

- [ ] **Step 2: Add `mech`**: a walker that steps toward the player (slow), fires a shoulder-cannon spread every ~1.5s, and every ~4s does a jump-slam sending a ground shockwave (two bullets along the ground). Weak point: cockpit (`box()` = cockpit rect). `hp = BOSSES.mech.hp`.

- [ ] **Step 3: Add `twinCannon`**: two cannon turrets (left/right of a central hub) alternately firing aimed bursts; only turrets are damageable. Track `hpLeft/hpRight` (each `BOSSES.twinCannon.hp/2`, sum reported as `hp` for the bar); `box()` returns rects for whichever turrets are alive; `dead` when both are 0; `hurt` routes damage to the turret whose rect was hit (game passes which rect index hit, or `hurt(dmg, which)`).

- [ ] **Step 4: Render** each with a distinct geometric silhouette + glowing weak point(s) + hit-flash, consistent with the gate's style.

- [ ] **Step 5: Browser verify.** Temporarily start at a later stage via a `?stage=N` query param read in `game.startGame` (e.g. `new URLSearchParams(location.search).get('stage')`). Reach each mini-boss (S2/S3/S4); confirm each attack pattern reads clearly, drains on hits, and clears the stage on defeat. Keep the `?stage=` override (it's a harmless dev aid; ignored without the param) OR remove it — note which. Console clean.

- [ ] **Step 6: Commit.**

```bash
git add games/jungle-blitz/src/bosses.js games/jungle-blitz/src/render.js games/jungle-blitz/src/game.js
git commit -m "feat(jungle-blitz): mini-bosses gunship, mech, twin-cannon"
```

---

## Task 15: Final boss — Core (multi-phase) + win flow

**Files:**
- Modify: `games/jungle-blitz/src/bosses.js` (add `core` with 3 phases)
- Modify: `games/jungle-blitz/src/game.js` (final-boss death → `win`; provide `addEnemy` ctx)
- Modify: `games/jungle-blitz/src/render.js` (draw core + phase transitions)

- [ ] **Step 1: Add `core`** to the factory using `BOSSES.core.phaseHp = [40,40,40]`:
  - `phase 1`: outer shell; two side **shield generators** are the only weak points (`box()` = the two generator rects); fires regular paced volleys. When both generators destroyed → `phase 2` (set `hp = phaseHp[1]`, `transitioning` flag + brief invuln + `Sound.bossPhase`).
  - `phase 2`: core exposed (`box()` = core rect); radial ring-burst every ~2s + occasional `ctx.addEnemy({x,type})` summon (1–2 grunts/drones).
  - `phase 3`: enrage — denser rings + a few homing bullets (velocity steers toward player with a capped turn rate). On `hp<=0` → `dead` with an `exploding` flag for an extended explosion.
  - Expose `phase`, `transitioning`, `exploding`.

- [ ] **Step 2: Game integration:** pass `ctx = { addEnemy: (spawn) => this.enemies.spawnNow(spawn) }` into `boss.update` (add `enemies.spawnNow(spawn)` that builds+activates an enemy immediately). On `core` death (after explosion flag clears, ~1.2s) → `state='win'`, `persistBest()`, `Sound.win`.

- [ ] **Step 3: Render** the core's three phases distinctly (shell+generators → exposed core → enraged glow); show phase number on the boss bar; transition flash.

- [ ] **Step 4: Browser verify.** Using `?stage=4`, fight the final boss through all 3 phases; defeating phase 3 triggers the win overlay (total score, best). Console clean.

- [ ] **Step 5: Commit.**

```bash
git add games/jungle-blitz/src/bosses.js games/jungle-blitz/src/game.js games/jungle-blitz/src/enemies.js games/jungle-blitz/src/render.js
git commit -m "feat(jungle-blitz): multi-phase final boss Core + win flow"
```

---

## Task 16: Author Stages 2–5 data in `levels.js`

**Files:**
- Modify: `games/jungle-blitz/src/levels.js` (add 4 stage objects)

Difficulty ramps: more/denser spawns, more pits/platforms, harder enemy mixes. Keep the spec's themes. Same data shape as Stage 1.

- [ ] **Step 1: Add Stage 2 「河流大桥」** (`id:2`, `boss:'gunship'`): `water` hazards between floating-bridge one-way platforms, drones over the water, a couple grunts/turrets on bridge segments; pods incl. `weaponM`; 2 checkpoints; `worldWidth≈5200`; `palette` blues/greens.

- [ ] **Step 2: Add Stage 3 「敌军基地」** (`id:3`, `boss:'mech'`): indoor multi-level one-way platforms, dense turrets + jumpers + a nest; pods incl. `weaponL` + `heal`; `worldWidth≈5600`; `palette` steel/dark.

- [ ] **Step 3: Add Stage 4 「瀑布悬崖」** (`id:4`, `boss:'twinCannon'`): vertical climbing via stacked one-way platforms, pits (falling = checkpoint), grenadiers on ledges, a drone or two; pods incl. `shield`; `worldWidth≈5800`; `palette` teal/rock.

- [ ] **Step 4: Add Stage 5 「核心基地」** (`id:5`, `boss:'core'`): a gauntlet mixing all enemy types at fair-but-intense density, a `heal` + a `shield` pod before the boss room; `worldWidth≈6400`; `bossX` near the end; `palette` red-alert/dark.

- [ ] **Step 5: Run validation tests.** Run: `node --test games/jungle-blitz/tests/levels.test.mjs`
  Expected: PASS for all 5 stages, including the `stage 5 uses core` assertion.

- [ ] **Step 6: Browser verify.** Play from Stage 1 straight through: each stage loads with its theme/palette, terrain, enemies, pods, and ends in the correct boss. The full 5-stage → final-boss → win path is completable (use shield/heal liberally). Console clean.

- [ ] **Step 7: Commit.**

```bash
git add games/jungle-blitz/src/levels.js
git commit -m "feat(jungle-blitz): author stages 2-5 (river/base/cliff/core)"
```

---

## Task 17: `audio.js` — Web Audio SFX wired throughout

**Files:**
- Create: `games/jungle-blitz/src/audio.js`
- Modify: callers (`game.js`/`main.js`/firing in the loop) to emit SFX at events
- Modify: `games/jungle-blitz/src/main.js` (connect mute button + `M` to `Sound.toggleMuted`)

- [ ] **Step 1: Implement `audio.js`** modeled on breakout's `audio.js`: lazy `AudioContext`, `muted` flag, `toggleMuted()`, and a small synth `tone({freq,dur,type,gain,slideTo})`. Export `Sound` with: `shoot(weaponKey)` (vary freq/type per weapon), `jump`, `land`, `enemyHit`, `enemyExplode`, `playerHurt`, `pickup`, `bossHit`, `bossPhase`, `bossExplode`, `stageClear`, `gameOver`, `win`, `ui`. Each ≤0.15s except `win`/`stageClear` (short arpeggio).

- [ ] **Step 2: Call SFX at events:** firing (`shoot`), jump (`jump`), landing from a fall (`land`), enemy damaged/killed (`enemyHit`/`enemyExplode`), player hurt (`playerHurt`), pickup (`pickup`), boss damaged/phase/defeat (`bossHit`/`bossPhase`/`bossExplode`), stageclear/gameover/win, menu/button (`ui`). `shoot` is naturally throttled by the fire cadence. Resume the AudioContext on the first user gesture (start button click).

- [ ] **Step 3: Mute wiring:** mute button + `M` toggle `Sound.toggleMuted()`; update the 🔊/🔇 glyph (mirror breakout).

- [ ] **Step 4: Browser verify.** All listed events make distinct sounds; firing doesn't crackle/overload; `M` and the mute button silence everything and restore. Console clean.

- [ ] **Step 5: Commit.**

```bash
git add games/jungle-blitz/src/audio.js games/jungle-blitz/src
git commit -m "feat(jungle-blitz): Web Audio SFX wired across gameplay + mute"
```

---

## Task 18: Balance pass, full playthrough verification, README

**Files:**
- Modify: `games/jungle-blitz/src/config.js` (tuning only, if needed)
- Modify: `games/jungle-blitz/src/levels.js` (spawn density tuning, if needed)
- Create: `games/jungle-blitz/README.md`

- [ ] **Step 1: Full playthrough on keyboard** via `./start.sh`. Play all 5 stages to the win screen. Note any spot too hard for a 7-year-old (bullet too fast, spawn cluster, a too-precise jump) or too trivial.

- [ ] **Step 2: Gamepad pass.** Repeat key sections with a gamepad (or verify `Input.poll` maps stick/dpad/buttons as specified). Confirm move/aim/jump/fire/pause all work on the pad.

- [ ] **Step 3: Apply tuning** by editing **only** `config.js` numbers and `levels.js` spawn placement (no logic changes). Re-run `node --test games/jungle-blitz/tests/` to confirm logic tests + level validation still pass.

- [ ] **Step 4: Automated smoke check (optional, recommended).** Use the `agent-browser` skill (or Playwright MCP) to load the game URL, press start, screenshot stage 1, and read the console — assert no errors and the canvas renders.

- [ ] **Step 5: Write `README.md`** (Chinese): one-paragraph intro, controls table (keyboard + PS gamepad), how to run (`./start.sh` → 打开 HUB → 丛林尖兵; 免编译), and a note that art is original / no third-party assets. Short, like other games' READMEs.

- [ ] **Step 6: Confirm `start.sh` accuracy.** It already serves static games and only special-cases snake's build; jungle-blitz is build-free, so no change is required — just verify it launches the game with no extra steps.

- [ ] **Step 7: Final verify + commit.**

```bash
node --test games/jungle-blitz/tests/      # expect all pass
git add games/jungle-blitz
git commit -m "feat(jungle-blitz): balance tuning + README + full-playthrough verification"
```

---

## Self-Review (performed against the spec)

**Spec coverage:**
- §1 goals/success criteria → controls (T5–T7), 5 stages+bosses (T13–T16), friendly health/lives/checkpoints (T11), 4 weapons+2 items (T8–T9), build-free static (T1, T18), breakout-consistent UI/audio (T1, T12, T17).
- §2 hub registration → T1. §3 coordinate/camera/render layers → T5. §4 controls/aim → T5–T7. §5 health/lives/checkpoints/continue → T11 + T12. §6 weapons/pods → T8–T9. §7 enemies → T10. §8 stages+bosses+data format → T4 (format+S1), T13–T16. §9 state machine → T12. §10 HUD/boss bar → T11, T13. §11 audio → T17. §12 scoring/persistence → T11 (score), T12 (best). §13 file architecture → File Structure + all tasks. §14 tuning → T18. §15 acceptance → verified across T5,T9,T11,T12,T16,T17,T18.

**Placeholder scan:** No "TBD/handle edge cases" left as work. The one explicit design choice (bullets don't collide with terrain) is stated as intentional. Stages 2–5 are specified by concrete parameters (boss, hazards, world width, pod kinds) sufficient to author following the Stage-1 example.

**Type/name consistency:** `Input.{moveX,aimUp,aimDown,fireHeld}` + `on/poll` consistent (T5,T7,T8). `bullets.{fireWeapon,spawn,update,forEachActive}` consistent (T8,T10,T13). `player.{hurt,respawn,jump,aim,muzzle,weapon,aabbBox,hp,lives,invMs,shieldMs}` consistent (T6,T7,T8,T11). `world.{floorTopAt,updateCamera,worldWidth,camX,pitBottomY,oneWayPlatforms}` consistent (T5,T6,T11,T13). `enemies.{loadStage,update,hitTest,damage,enemyContact,spawnNow,forEachActive,grenades}` consistent (T10,T15). `powerups.{spawnFromStage,spawnPod,update,tryCollect,popByBullet,effectFor}` consistent (T9,T13). `createBoss(type,roomX,world)` + boss `{hp,hpMax,box(),update,dead,phase,hurt,name}` consistent (T13–T15). `getStage/STAGES/stageCount` consistent (T4,T12,T16). config keys (`PHYSICS,WEAPONS,ENEMIES,BOSSES,ITEMS,POWERUP,BULLET,ENEMY_BULLET,GRENADE,POD_KIND_TO_WEAPON,DEFAULT_WEAPON,SCORE,CAMERA,STORAGE_KEY`) match across tasks.

**Result:** No gaps requiring new tasks; plan is internally consistent.
