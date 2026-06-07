# 丛林勇士 JUNGLE WARRIOR — M3 模式·存档·选关·彩蛋 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, checkpoint-reviewed). Builds on the M1+M2 codebase in `games/warrior/`. Steps use checkbox (`- [ ]`).

**Goal:** Wrap the game in its meta-layer: a title screen, a level-select screen with per-level ⭐/best-score and lock state, a casual/classic mode toggle, localStorage save (unlock progress, best times/scores/stars, mode, Konami flag), classic-mode lives + Game Over, the Konami Code easter egg, and the ← HUB return — all persisting across reloads.

**Architecture:** New pure module `save.js` (localStorage with an in-memory fallback so it unit-tests in Node). New pure helpers: `rateStars()` (config-driven ⭐) and a Konami sequence detector in `input.js`. `game.js` gains the `select`/`gameover` states, loads/applies the save, computes stars + `markCleared` on clear, and wires classic lives/Game Over + the Konami effect. `main.js` + `index.html` + `style.css` render the title/select/gameover overlays and the mode toggle. Level-select is **data-driven by `LEVELS`** (1 level now; auto-grows to 5 in M4).

**Tech Stack:** Same — ES modules, Canvas 2D, Web Audio, `node --test`, host-side Chrome smoke.

---

## Reference: M3 contracts

### Save data model (spec §6.1 + §13 M6 — `clearedLevels` removed; cleared derives from `perLevel[id].cleared`)

```js
STORAGE_KEY = 'jungle-warrior-save'
{
  version: 1,
  unlockedMax: 1,                                   // highest unlocked level id (1-based)
  perLevel: { 1: { cleared:false, bestTime:null, bestScore:0, bestStars:0 }, ... },
  settings: { mode: 'casual', volume: 1 },
  konami: false,
}
```

### `save.js` API

```
load() -> state            // migrated + defaulted; never throws
save(state) -> void
markCleared(id, {time, score, stars}) -> state   // sets cleared, updates bests (max), unlockedMax = max(unlockedMax, id+1)
isUnlocked(id) -> bool     // id <= unlockedMax
levelInfo(id) -> {cleared, bestTime, bestScore, bestStars}
getMode()/setMode(m) -> ...
getKonami()/setKonami(v) -> ...
reset() -> state
```

### ⭐ rating (spec §13 H8) — `config.STARS`

```
STARS = { timeThreshold: 75 }   // seconds for a 3⭐ time
rateStars({ time, deaths, mode }) -> 1 | 2 | 3
// casual: time-only (deaths ignored). classic: min(timeTier, deathTier).
//   timeTier: time <= threshold -> 3 ; <= threshold*1.6 -> 2 ; else 1
//   deathTier (classic): deaths===0 -> 3 ; <=2 -> 2 ; else 1
```

### Konami (spec §6.2) — pure detector in `input.js`

```
KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']
makeKonami(onUnlock) -> { push(key): bool }   // push returns true on the completing key
```
Effect: classic → 30 lives; casual → cool fx flag. Writes `save.setKonami(true)`.

### State machine (spec §6.2)

`title → select → ready → playing → (boss) → clear → select`  · plus `paused`, `respawning` (in-place), `gameover` (classic only).

### Test files (spec §9): `save.test.mjs`, `input.test.mjs` (Konami), extend `game.test.mjs`. Commands: `node --test`.

---

## Checkpoints

- **CP-A 存档与评级**: T1 config STARS · T2 save.js (TDD) · T3 rateStars (TDD). Unit-green.
- **CP-B 输入彩蛋**: T4 Konami detector (TDD input.test).
- **CP-C 状态机·模式·解锁**: T5 game.js select/mode/markCleared/stars/gameover/Konami (TDD game.test).
- **CP-D UI 与实玩**: T6 index/css · T7 main.js (title/select/gameover/mode/Konami wiring) · T8 browser smoke (clear→unlock→⭐→reload persists) + milestone wrap.

---

## Task 1: `config.js` — STARS threshold

**Files:** Modify `games/warrior/src/config.js`

- [ ] **Step 1: Append**

```js
export const STARS = { timeThreshold: 75, timeMul2: 1.6 }; // 3⭐ <=75s, 2⭐ <=120s, else 1⭐
```

- [ ] **Step 2: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/config.js
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M3 config — STARS time thresholds"
```

---

## Task 2: `save.js` — localStorage save with in-memory fallback (TDD)

**Files:** Create `games/warrior/tests/save.test.mjs`, `games/warrior/src/save.js`

- [ ] **Step 1: Write `tests/save.test.mjs` (failing)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Save from '../src/save.js';

test('fresh load returns sane defaults', () => {
  Save.reset();
  const s = Save.load();
  assert.equal(s.version, 1);
  assert.equal(s.unlockedMax, 1);
  assert.equal(s.settings.mode, 'casual');
  assert.equal(s.konami, false);
});

test('isUnlocked respects unlockedMax', () => {
  Save.reset();
  assert.equal(Save.isUnlocked(1), true);
  assert.equal(Save.isUnlocked(2), false);
});

test('markCleared records bests and unlocks the next level', () => {
  Save.reset();
  Save.markCleared(1, { time: 50, score: 1200, stars: 3 });
  assert.equal(Save.isUnlocked(2), true);
  const info = Save.levelInfo(1);
  assert.equal(info.cleared, true);
  assert.equal(info.bestScore, 1200);
  assert.equal(info.bestStars, 3);
  assert.equal(info.bestTime, 50);
});

test('markCleared keeps the BEST (higher score/stars, lower time)', () => {
  Save.reset();
  Save.markCleared(1, { time: 60, score: 1000, stars: 2 });
  Save.markCleared(1, { time: 90, score: 800,  stars: 1 }); // worse run
  const info = Save.levelInfo(1);
  assert.equal(info.bestScore, 1000);
  assert.equal(info.bestStars, 2);
  assert.equal(info.bestTime, 60); // lower time is better
});

test('mode + konami persist through save/load', () => {
  Save.reset();
  Save.setMode('classic');
  Save.setKonami(true);
  const s = Save.load();
  assert.equal(s.settings.mode, 'classic');
  assert.equal(s.konami, true);
});

test('corrupt / wrong-version data falls back to defaults without throwing', () => {
  Save._backend().setItem('jungle-warrior-save', '{not json');
  const s = Save.load();
  assert.equal(s.version, 1);
  assert.equal(s.unlockedMax, 1);
});
```

- [ ] **Step 2: Run — expect red**

- [ ] **Step 3: Write `src/save.js`**

```js
// Persistent save for 丛林勇士 (localStorage with an in-memory fallback so it runs in
// Node tests). Single JSON key. cleared state lives only in perLevel[id].cleared
// (spec §13 M6 — no separate clearedLevels list). Never throws on bad data.

import { STORAGE_KEY } from './config.js';

const VERSION = 1;

// In-memory shim used when localStorage is absent (Node) or unavailable (private mode).
const mem = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
})();

export function _backend() {
  try { if (typeof localStorage !== 'undefined' && localStorage) return localStorage; } catch { /* ignore */ }
  return mem;
}

function defaults() {
  return {
    version: VERSION,
    unlockedMax: 1,
    perLevel: {},
    settings: { mode: 'casual', volume: 1 },
    konami: false,
  };
}

function levelDefault() { return { cleared: false, bestTime: null, bestScore: 0, bestStars: 0 }; }

export function load() {
  let raw = null;
  try { raw = _backend().getItem(STORAGE_KEY); } catch { /* ignore */ }
  if (!raw) return defaults();
  let data;
  try { data = JSON.parse(raw); } catch { return defaults(); }
  if (!data || typeof data !== 'object' || data.version !== VERSION) {
    // Migration policy (spec §13): unknown/old version → safe reset (fill defaults).
    return defaults();
  }
  // Backfill any missing fields so later code can assume the full shape.
  const d = defaults();
  return {
    version: VERSION,
    unlockedMax: Number.isFinite(data.unlockedMax) ? data.unlockedMax : d.unlockedMax,
    perLevel: data.perLevel && typeof data.perLevel === 'object' ? data.perLevel : {},
    settings: { ...d.settings, ...(data.settings || {}) },
    konami: !!data.konami,
  };
}

export function save(state) {
  try { _backend().setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function levelInfo(id) {
  const s = load();
  return { ...levelDefault(), ...(s.perLevel[id] || {}) };
}

export function markCleared(id, { time, score, stars }) {
  const s = load();
  const cur = { ...levelDefault(), ...(s.perLevel[id] || {}) };
  cur.cleared = true;
  if (score > cur.bestScore) cur.bestScore = score;
  if (stars > cur.bestStars) cur.bestStars = stars;
  if (cur.bestTime == null || (time != null && time < cur.bestTime)) cur.bestTime = time;
  s.perLevel[id] = cur;
  s.unlockedMax = Math.max(s.unlockedMax, id + 1);
  save(s);
  return s;
}

export function isUnlocked(id) { return id <= load().unlockedMax; }

export function getMode() { return load().settings.mode; }
export function setMode(m) { const s = load(); s.settings.mode = m; save(s); }

export function getKonami() { return load().konami; }
export function setKonami(v) { const s = load(); s.konami = !!v; save(s); }

export function reset() { const d = defaults(); save(d); return d; }
```

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/save.test.mjs` → `# pass 6`.

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/save.js games/warrior/tests/save.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M3 save.js — localStorage progress/best/stars/mode/konami + tests"
```

---

## Task 3: ⭐ rating (TDD)

**Files:** Modify `games/warrior/src/save.js` (add `rateStars`), Create `games/warrior/tests/stars.test.mjs`

- [ ] **Step 1: Write `tests/stars.test.mjs` (failing)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateStars } from '../src/save.js';

test('casual rates by time only (deaths ignored)', () => {
  assert.equal(rateStars({ time: 50, deaths: 9, mode: 'casual' }), 3);
  assert.equal(rateStars({ time: 100, deaths: 0, mode: 'casual' }), 2);
  assert.equal(rateStars({ time: 999, deaths: 0, mode: 'casual' }), 1);
});

test('classic takes the lower of time tier and death tier', () => {
  assert.equal(rateStars({ time: 50, deaths: 0, mode: 'classic' }), 3); // both 3
  assert.equal(rateStars({ time: 50, deaths: 5, mode: 'classic' }), 1); // deaths drag to 1
  assert.equal(rateStars({ time: 50, deaths: 1, mode: 'classic' }), 2); // deaths cap at 2
});
```

- [ ] **Step 2: Run — expect red**

- [ ] **Step 3: Add `rateStars` to `save.js`** (import STARS at top: `import { STORAGE_KEY, STARS } from './config.js';`):

```js
// ⭐ rating (spec §13 H8). casual = time only; classic = min(time tier, death tier).
export function rateStars({ time, deaths, mode }) {
  const timeTier = time <= STARS.timeThreshold ? 3 : (time <= STARS.timeThreshold * STARS.timeMul2 ? 2 : 1);
  if (mode === 'classic') {
    const deathTier = deaths === 0 ? 3 : (deaths <= 2 ? 2 : 1);
    return Math.min(timeTier, deathTier);
  }
  return timeTier;
}
```

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/stars.test.mjs` → `# pass 2`. Then `node --test` (all green).

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/save.js games/warrior/tests/stars.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M3 ⭐ rating — casual time-only / classic time×deaths + tests"
```

> **CHECKPOINT CP-A** — `node --test` all green.

---

## Task 4: Konami detector in `input.js` (TDD → input.test.mjs)

**Files:** Modify `games/warrior/src/input.js`, Create `games/warrior/tests/input.test.mjs`

- [ ] **Step 1: Write `tests/input.test.mjs` (failing)**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeKonami, KONAMI } from '../src/input.js';

test('the full Konami sequence triggers exactly once', () => {
  let fired = 0;
  const k = makeKonami(() => { fired += 1; });
  let completing = false;
  for (const key of KONAMI) completing = k.push(key);
  assert.equal(fired, 1);
  assert.equal(completing, true, 'last key reports completion');
});

test('a wrong key resets progress', () => {
  let fired = 0;
  const k = makeKonami(() => { fired += 1; });
  k.push('ArrowUp'); k.push('ArrowUp'); k.push('x'); // break it
  for (const key of KONAMI) k.push(key);              // full run after the break
  assert.equal(fired, 1);
});

test('a correct prefix that diverges does not fire', () => {
  let fired = 0;
  const k = makeKonami(() => { fired += 1; });
  k.push('ArrowUp'); k.push('ArrowUp'); k.push('ArrowDown'); k.push('ArrowDown');
  k.push('ArrowLeft'); k.push('ArrowRight'); k.push('ArrowLeft'); k.push('ArrowRight');
  k.push('a'); // wrong (should be 'b')
  assert.equal(fired, 0);
});
```

- [ ] **Step 2: Run — expect red**

- [ ] **Step 3: Add to `input.js`** (near `resolveAim`, before the `Input` object):

```js
export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

// Pure sequence matcher. push(key) returns true on the key that completes the sequence.
export function makeKonami(onUnlock) {
  let i = 0;
  return {
    push(key) {
      const k = typeof key === 'string' ? key.toLowerCase() : key;
      const want = KONAMI[i].toLowerCase();
      if (k === want) {
        i += 1;
        if (i === KONAMI.length) { i = 0; if (onUnlock) onUnlock(); return true; }
        return false;
      }
      // restart; allow this key to also start a fresh match (handles "↑↑↑…")
      i = (k === KONAMI[0].toLowerCase()) ? 1 : 0;
      return false;
    },
  };
}
```

Then wire it into the live keyboard: in `Input.init`, after the `set` handler is defined and listeners added, feed keydowns to a detector that emits a `'konami'` action:

```js
    this._konami = makeKonami(() => this._emit('konami'));
    window.addEventListener('keydown', (e) => { if (this._konami && !e.repeat) this._konami.push(e.key); });
```

(Place this right after the existing `window.addEventListener('keydown', ...)` in `init`.)

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/input.test.mjs` → `# pass 3`. Then `node --test` (all green).

- [ ] **Step 5: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/input.js games/warrior/tests/input.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M3 Konami detector — pure matcher + live 'konami' action + tests"
```

> **CHECKPOINT CP-B**

---

## Task 5: `game.js` — select / mode / markCleared / ⭐ / gameover / Konami (TDD)

**Files:** Modify `games/warrior/src/game.js`, `games/warrior/tests/game.test.mjs`

- [ ] **Step 1: Add failing tests** (append to `game.test.mjs`):

```js
import * as Save from '../src/save.js';

test('clearing a level records progress and stars, then goes to select', () => {
  Save.reset();
  const g = freshGame();
  g.startTime = 0; g._elapsed = 40; // pretend 40s run
  g._levelClear();
  assert.equal(g.state, 'select');
  assert.equal(Save.isUnlocked(2), true);
  assert.ok(Save.levelInfo(1).bestStars >= 1);
});

test('selecting a locked level is refused; an unlocked one starts', () => {
  Save.reset();
  const g = new Game();
  g.goSelect();
  assert.equal(g.selectLevel(1), true);   // L1 unlocked
  const g2 = new Game(); g2.goSelect();
  assert.equal(g2.selectLevel(99), false); // locked / missing
});

test('classic Game Over after lives run out; continue replays the level keeping unlocks', () => {
  Save.reset();
  const g = new Game(); g.setMode('classic'); g.startLevel(0); g._startPlaying();
  g.lives = 1;
  g.player.startDeath(g._world); g.player.y = g.level.height + 200;
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  assert.equal(g.state, 'gameover');
  g.continueRun();
  assert.equal(g.state, 'ready');
});

test('konami unlock grants 30 lives in classic and sets the saved flag', () => {
  Save.reset();
  const g = new Game(); g.setMode('classic');
  g.onKonami();
  assert.equal(g.lives, 30);
  assert.equal(Save.getKonami(), true);
});
```

- [ ] **Step 2: Run — expect red**

- [ ] **Step 3: Extend `game.js`**

Imports: add `import * as Save from './save.js';` and `import { rateStars } from './save.js';` (or `Save.rateStars`). Use `Save.rateStars`. Also import `STARS` is not needed in game (rating lives in save).

Constructor: load the saved mode + lives; init timing:
```js
    this.mode = MODES[Save.getMode()] || MODES.casual;
    this.lives = this.mode.lives;
    this._elapsed = 0;       // seconds in the current level (for ⭐)
```
(Replace the old `this.mode = MODES.casual;` line.)

Add navigation + lifecycle methods:
```js
  goTitle() { this.state = 'title'; }
  goSelect() { this.state = 'select'; }

  setMode(id) {
    this.mode = MODES[id] || MODES.casual;
    this.lives = this.mode.lives;
    Save.setMode(this.mode.id);
  }

  // Start a level by 0-based index if its 1-based id is unlocked. Returns success.
  selectLevel(i) {
    const id = i + 1;
    if (!Save.isUnlocked(id)) return false;
    if (i < 0 || i >= LEVELS.length) return false;
    this.startLevel(i);
    return true;
  }

  // Konami easter egg (spec §6.2): classic → 30 lives, casual → cool fx; persist flag.
  onKonami() {
    this.konami = true;
    Save.setKonami(true);
    if (this.mode.lives !== Infinity) { this.lives = 30; }
    Sound.play('clear');
  }

  continueRun() {           // classic Game Over → replay current level, keep unlocks
    this.lives = this.mode.lives;
    this.startLevel(this.levelIndex);
  }
```

In `startLevel`, reset the per-level timer: add `this._elapsed = 0;` (near `this.deaths = 0;`).

In `update`, while playing, accumulate elapsed time: add at the top of the `playing` section `this._elapsed += dt;`.

Replace `confirm()` with the full M3 state flow:
```js
  confirm() {
    switch (this.state) {
      case 'title': this.goSelect(); break;
      case 'select': this.selectLevel(this.levelIndex); break;
      case 'ready': this._startPlaying(); break;
      case 'clear': this.goSelect(); break;
      case 'gameover': this.continueRun(); break;
      default: break;
    }
  }
```

Rewrite `_levelClear` to score the run, rate stars, persist, and go to select:
```js
  _levelClear() {
    this.score += SCORE.levelClear;
    const id = this.levelIndex + 1;
    const stars = Save.rateStars({ time: this._elapsed, deaths: this.deaths, mode: this.mode.id });
    this.lastStars = stars;
    Save.markCleared(id, { time: Math.round(this._elapsed), score: this.score, stars });
    this.state = 'clear';
    Sound.play('clear');
  }
```

In `_onPlayerDead`, the classic Game Over branch already sets `this.state = 'gameover'` (from M2). Confirm it does; if it only plays a sound, ensure it sets the state. (M2 code: `if (this.lives <= 0) { this.state = 'gameover'; Sound.play('die'); return; }` — already correct.)

- [ ] **Step 4: Run — expect green**

Run: `node --test tests/game.test.mjs` → all pass. Then `node --test` (all green).

> Note: tests now mutate the shared save. Each new test calls `Save.reset()` first; if any pre-existing M1/M2 game test is affected by saved mode, add `Save.reset()` to `freshGame()` (it should start casual). Add `Save.reset();` as the first line of `freshGame()` to keep tests deterministic.

- [ ] **Step 5: Make `freshGame()` deterministic** — edit the helper in `game.test.mjs`:

```js
function freshGame() {
  Save.reset();
  const g = new Game();
  ...
}
```

- [ ] **Step 6: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/game.js games/warrior/tests/game.test.mjs
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M3 game — select/mode/markCleared/⭐/gameover/Konami + tests"
```

> **CHECKPOINT CP-C** — full `node --test` green.

---

## Task 6: `index.html` + `style.css` — title (mode toggle) + select + gameover overlays

**Files:** Modify `games/warrior/index.html`, `games/warrior/style.css`

- [ ] **Step 1: Replace the title overlay + add select/gameover overlays** in `index.html` (keep canvas + ← HUB + mute/fullscreen). Title: 开始/继续 + a 休闲/经典 segmented toggle + best summary. Select: a `#select-grid` filled by main.js with level cards. Gameover: score + 继续/返回. Use the existing `.overlay`/`.panel`/`.big` classes; add `#overlay-select`, `#overlay-gameover`, `#mode-casual`/`#mode-classic` buttons, `#btn-continue`, `#select-grid`, `#btn-select-back`.

```html
  <div class="overlay show" id="overlay-title">
    <div class="panel">
      <h1>丛林勇士</h1>
      <p class="sub">JUNGLE WARRIOR</p>
      <div class="modes">
        <button class="mode-btn selected" id="mode-casual">休闲<small>无限复活</small></button>
        <button class="mode-btn" id="mode-classic">经典<small>3命挑战</small></button>
      </div>
      <button class="big" id="btn-start">选关进入</button>
      <p class="hint" id="title-best"></p>
      <p class="hint">← → 移动 · ↑↓ 瞄准 · Z 射击 · 空格 跳</p>
    </div>
  </div>

  <div class="overlay" id="overlay-select">
    <div class="panel wide">
      <h2>选择关卡</h2>
      <div id="select-grid"></div>
      <button class="small-btn" id="btn-select-back">← 返回标题</button>
    </div>
  </div>

  <div class="overlay" id="overlay-gameover">
    <div class="panel">
      <h2>GAME OVER</h2>
      <p class="hint" id="go-score"></p>
      <button class="big" id="btn-continue">再来一次</button>
      <button class="small-btn" id="btn-go-select">选关</button>
    </div>
  </div>
```

- [ ] **Step 2: Add styles** to `style.css` for `.modes`/`.mode-btn`/`.mode-btn.selected`, `.panel.wide`, `#select-grid` (flex/grid of cards), `.level-card` (+`.locked`/`.next`/cleared with ⭐), `.small-btn`. Keep the forest palette.

- [ ] **Step 3: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/index.html games/warrior/style.css
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M3 overlays — title+mode toggle, select grid, gameover"
```

---

## Task 7: `main.js` — wire title/select/mode/gameover/Konami

**Files:** Modify `games/warrior/src/main.js`

- [ ] **Step 1: Wire it up** (extend the existing bootstrap):
  - Mode toggle: `#mode-casual`/`#mode-classic` → `game.setMode(...)` + toggle `.selected`. On load, reflect `Save.getMode()`.
  - `#btn-start` → `game.goSelect()`. Build the select grid from `LEVELS`: for each level, a `.level-card` showing name + (⭐ best / 🔒 locked / NEXT). Locked cards are non-clickable; unlocked → `game.selectLevel(i)`.
  - `#btn-select-back` → `game.goTitle()`.
  - `#btn-continue` → `game.continueRun()`; `#btn-go-select` → `game.goSelect()`.
  - `Input.on('konami')` → `game.onKonami()` + a brief on-screen toast.
  - Extend `syncOverlay()` to show the right overlay per state (`title`/`select`/`gameover`/`clear` use overlays or in-canvas banner as today); refresh the select grid + title best line when entering those states.
  - Keep `window.__game = game` and the rAF loop.

Skeleton for the select grid:

```js
import { LEVELS } from './levels.js';
import * as Save from './save.js';

function buildSelect() {
  const grid = el('select-grid');
  grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const id = i + 1;
    const info = Save.levelInfo(id);
    const unlocked = Save.isUnlocked(id);
    const card = document.createElement('button');
    card.className = 'level-card' + (unlocked ? '' : ' locked') + (unlocked && !info.cleared ? ' next' : '');
    const stars = info.bestStars ? '⭐'.repeat(info.bestStars) : '';
    card.innerHTML = `<b>${unlocked ? lv.name : '🔒'}</b><span>${unlocked ? (info.cleared ? stars + ' · ' + info.bestScore : 'NEXT') : ''}</span>`;
    if (unlocked) card.addEventListener('click', () => game.selectLevel(i));
    grid.appendChild(card);
  });
}
```

- [ ] **Step 2: Manual sanity** — `node --check src/main.js`.

- [ ] **Step 3: Commit**

```bash
git -C /Users/james/Projects/game-hub add games/warrior/src/main.js
git -C /Users/james/Projects/game-hub commit -m "feat(warrior): M3 main — title/select/mode/gameover/Konami wiring"
```

---

## Task 8: Browser smoke (persistence) + M3 gate wrap

**Files:** Modify `games/warrior/tests/smoke.mjs`

- [ ] **Step 1: Extend the smoke** — title → pick 休闲 → 选关进入 → click L1 card → X → fast-forward + laser the boss → assert `state==='clear'` and (via `window.__game`/localStorage) that L1 is now cleared & L2 unlocked. Then `page.reload()` and assert the save persisted (`window.__game` re-reads it: `Save.isUnlocked(2)` true via a re-evaluate, or the select grid shows L1 with ⭐). Screenshot the select screen.

- [ ] **Step 2: Run host-side** (server at :8000, system Chrome, `--no-proxy-server`):

```bash
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  URL="http://localhost:8000/games/warrior/index.html" node tests/smoke.mjs
```

Expected: `SMOKE PASS` + a screenshot showing the select grid with L1 ⭐ and L2 still locked (only 1 level in M3).

- [ ] **Step 3: Full suite + manual check**

Run `node --test` → all green. Manually: title → toggle 经典/休闲 → 选关 → play L1 → clear → ⭐ on the card → reload keeps progress → Konami on title grants the effect.

- [ ] **Step 4: Milestone marker commit**

```bash
git -C /Users/james/Projects/game-hub commit --allow-empty -m "chore(warrior): M3 模式·存档·选关·彩蛋 complete

Gate (spec §10 M3): save/input tests green; reload keeps progress; casual/classic split;
select replay/NEXT/⭐ correct; classic lives→Game Over→continue; Konami easter egg; ← HUB.
Next: M4 (L2–L5 + each BOSS + F 火球 + R 射速 + 飞兵/炮台/战车 + 难度曲线参数化)."
```

> **CHECKPOINT CP-D** — M3 done.

---

## Self-Review

**Spec coverage (M3 §10):** title ✅ · 休闲/经典切换 ✅(T5/T7) · 选关界面 ✅(T6/T7) · save.js localStorage+⭐+模式+彩蛋 ✅(T2/T3) · 通关解锁 ✅(markCleared) · 经典命数/Game Over ✅(T5) · Konami ✅(T4/T5) · ← HUB ✅(existing). §13 M6 (no clearedLevels) ✅. Out of M3: L2–L5 + F/R + new enemies (M4); touch/parallax/BGM/hub-card (M5).

**No placeholders:** save.js/rateStars/Konami are complete + TDD'd. game.js edits are precise. UI tasks (T6/T7) are described against the existing overlay system with a concrete select-grid skeleton; they're browser-verified (T8) rather than unit-tested, matching the M1/M2 presentation pattern.

**Type consistency:** save API (load/save/markCleared/isUnlocked/levelInfo/getMode/setMode/getKonami/setKonami/reset/rateStars/_backend) consistent across save.js, game.js, main.js, tests. `rateStars({time,deaths,mode})` matches game._levelClear + stars.test. State names (title/select/ready/playing/clear/gameover) consistent across game.confirm/_levelClear/_onPlayerDead, main.syncOverlay, smoke. `selectLevel(i)` 0-based index ↔ `id=i+1` consistent.
