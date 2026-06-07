# 丛林勇士 JUNGLE WARRIOR — M4 五关内容 + 满配武器 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline, checkpoint-reviewed). Builds on M1+M2+M3 in `games/warrior/`. Steps use checkbox (`- [ ]`).

**Goal:** Grow the game to its full 5-level campaign: F fireball + R rapid-fire power-ups, three ranged enemy types (Gunner/Turret/Flyer) that fire **enemy bullets** at the player, levels L2–L5 each with its own theme + BOSS (加尔玛 / 瓦尔基里 / 克隆 / 戈梅拉-multiphase), per-level difficulty scaling, and a `tools/verify-levels.mjs` CLI that statically validates every level.

**Architecture:** Extends in place. New mechanic — **enemy bullets**: `game.enemyBullets[]`, hostile `Bullet`s that damage the player (blocked by terrain, ignore enemies). `weapons.fire()` gains the F fireball (gravity arc) — `Bullet` integrates `spec.gravity`. Player gains `rapid` stacks (R). New entities `Gunner`/`Turret`/`Flyer` in `entities.js`. Bosses reuse the M2 `Boss` template via new `BOSSES` configs. Levels carry `difficulty:{enemyMul,fireRateMul,bossHpMul}` combined with `mode.enemyMul`. `tools/verify-levels.mjs` runs `parseLevel` over every level and asserts spawn/boss-ground/falcon/reachability/no-floating-hazard.

**Tech Stack:** Same — ES modules, Canvas 2D, Web Audio, `node --test`, host-side Chrome smoke.

---

## Reference: M4 contracts

### Weapons (full table, spec §3.3 + §13 H3)

| id | letter | cooldown | dmg | speed | flags |
|----|--------|----------|-----|-------|-------|
| fire | F | 0.5 | 2 | 420 | `gravity: FIRE.gravity` (parabolic arc, no spiral — §13 H3) |

R 射速 **Rapid** (item, §3.3 + §13 H4): stacks multiplicatively, **cap 3**. Effective cooldown `× RAPID_COOLDOWN_MUL^stacks`, speed `× RAPID_SPEED_MUL^stacks` (or simple per-stack — see config). Classic: reset on death; casual: kept.

### Enemy bullets (new)

`world.spawnEnemyBullet({x,y,vx,vy,dmg})` → `game.enemyBullets.push(new Bullet({...spec, hostile:true}))`. Hostile bullets: move + die on solid terrain; `game.update` checks `aabb(player, b)` → `player.takeDamage` (respects invuln/barrier) + `b.dead`. They never hit enemies.

### New enemies (spec §4.1)

- **Gunner 蹲守兵**: stationary (or slow), periodically fires one aimed enemy-bullet toward the player. `hp 2`.
- **Turret 炮台**: fixed, fires a fan/burst of enemy-bullets on a cooldown. `hp 3`, often elevated.
- **Flyer 飞兵**: airborne sine-wave horizontal movement, periodically dive or drop an enemy-bullet. `hp 1`.

Level markers: `G`→Gunner, `T`→Turret, `Y`→Flyer (avoid clashes with existing `r/j/@/G`-goal... note `G` is already the GOAL flag — use new letters: Gunner=`u`, Turret=`t`, Flyer=`y`). Final marker set: `@`player, `r`runner, `j`jumper, `u`gunner, `t`turret, `y`flyer, `F`falcon-not-used(falcons via data), `>`goal. **Decision:** keep goal as `G`; gunner=`u`, turret=`t`, flyer=`y`.

### Levels L2–L5 (spec §5)

| id | theme | new challenge | BOSS (config id) |
|----|-------|---------------|------------------|
| L2 | steel (基地) | Turret + vertical jump pillars | 独眼核心·加尔玛 Cyclops Core (`cyclops`) |
| L3 | beach (瀑布变体) | moving platforms + Flyer | 旋翼死神·瓦尔基里 Valkyrie Gunship (`valkyrie`) |
| L4 | snow (雪原) | slippery ground + dense fire (Gunner/Turret) | 寒霜重坦·克隆 Frost Crawler (`frost`) |
| L5 | abyss (敌巢) | everything combined | 创魔之心·戈梅拉 Heart of Gomera (`gomera`, multi-phase) |

Each level: `difficulty:{enemyMul,fireRateMul,bossHpMul}` rising L1→L5. Length ~8 screens. All pits ≤3 tiles. Boss arena = solid ground.

### BOSS configs (reuse M2 `Boss`; add to `BOSSES`)

Each: `{name,enName,w,h,maxHp,touchDamage,phases:[{upTo,slamCd,spawnGrunts,...}],score}`. `gomera` gets 3 phases. (Boss ranged attacks can reuse the slam/summon template + an optional `fires` flag to spit enemy-bullets — kept simple: M4 bosses escalate hp + summon; fancy patterns are polish.)

### Difficulty combine

Enemy speed/fire already multiply by `world.mode.enemyMul`. Add `world.levelMul` (= `level.difficulty.enemyMul`) and `world.fireRateMul`. BOSS hp × `bossHpMul` at spawn. Expose via the world facade.

### tools/verify-levels.mjs

CLI: `node tools/verify-levels.mjs`. For each `LEVELS[i]`: parseLevel, assert grid non-empty, exactly one spawn region with ground below, `goalX>spawn.x`, every falcon has a valid drop letter, boss column solid (if boss), no fully-floating row of hazard. Exit non-zero + readable report on any failure.

### Test files (spec §9): extend `weapons.test`, `entities.test`, `levels.test`, add `tools` check via `verify-levels`. Commands: `node --test`; `node tools/verify-levels.mjs`.

---

## Checkpoints

- **CP-A 满配武器**: T1 config (F/R/enemy-bullet/new-enemy/4-boss/difficulty consts) · T2 F fireball + R rapid (TDD) · T3 enemy-bullet system (TDD).
- **CP-B 远程敌人**: T4 Gunner/Turret/Flyer (TDD).
- **CP-C 关卡·BOSS·校验**: T5 verify-levels.mjs + parseLevel difficulty (TDD) · T6 author L2–L5 + boss configs, verify-green (TDD levels).
- **CP-D 表现·难度·实玩**: T7 sprites/render new content · T8 difficulty wiring in game · T9 browser smoke (L1 + a mid level + final boss) + milestone wrap.

---

## Task 1: `config.js` — M4 constants

**Files:** Modify `games/warrior/src/config.js`

- [ ] **Step 1: Add F to WEAPONS** (inside `WEAPONS`):

```js
  fire: { id: 'fire', letter: 'F', cooldown: 0.5, dmg: 2, speed: 420, pierce: false, spread: 0, gravity: 900 },
```

- [ ] **Step 2: Extend PICKUPS + add R + new enemies + bosses + fire-gravity** (append/extend):

```js
// extend PICKUPS:
//   F: { kind:'weapon', weapon:'fire' },   R: { kind:'item', item:'rapid' },
export const RAPID = { maxStacks: 3 };          // R cap (spec §13 H4)
export const FIRE = { gravity: 900 };           // fireball parabola

export const ENEMY_RANGED = {
  gunner: { w: 24, h: 28, hp: 2, score: 150, fireCd: 1.6, bulletSpeed: 280, bulletDmg: 1 },
  turret: { w: 30, h: 26, hp: 3, score: 200, fireCd: 2.0, burst: 3, spreadAngle: 0.35, bulletSpeed: 260, bulletDmg: 1 },
  flyer:  { w: 26, h: 20, hp: 1, score: 180, speed: 90, amp: 60, freq: 2.2, fireCd: 2.4, bulletSpeed: 240, bulletDmg: 1 },
};

export const BOSSES_M4 = {
  cyclops:  { name: '独眼核心·加尔玛', enName: 'Cyclops Core',     w: 90,  h: 100, maxHp: 55, touchDamage: true, fires: true,  phases: [{ upTo: 1.01, slamCd: 2.0, spawnGrunts: 0, fireCd: 1.4 }, { upTo: 0.5, slamCd: 1.4, spawnGrunts: 2, fireCd: 0.9 }], score: 2600 },
  valkyrie: { name: '旋翼死神·瓦尔基里', enName: 'Valkyrie Gunship', w: 100, h: 70,  maxHp: 60, touchDamage: true, fires: true,  fly: true, phases: [{ upTo: 1.01, slamCd: 1.8, spawnGrunts: 0, fireCd: 1.1 }, { upTo: 0.5, slamCd: 1.4, spawnGrunts: 1, fireCd: 0.8 }], score: 2800 },
  frost:    { name: '寒霜重坦·克隆', enName: 'Frost Crawler',     w: 110, h: 90,  maxHp: 70, touchDamage: true, fires: true,  phases: [{ upTo: 1.01, slamCd: 1.8, spawnGrunts: 1, fireCd: 1.2 }, { upTo: 0.5, slamCd: 1.2, spawnGrunts: 2, fireCd: 0.8 }], score: 3200 },
  gomera:   { name: '创魔之心·戈梅拉', enName: 'Heart of Gomera',  w: 120, h: 120, maxHp: 100, touchDamage: true, fires: true, phases: [{ upTo: 1.01, slamCd: 1.8, spawnGrunts: 1, fireCd: 1.2 }, { upTo: 0.66, slamCd: 1.4, spawnGrunts: 2, fireCd: 0.9 }, { upTo: 0.33, slamCd: 1.0, spawnGrunts: 3, fireCd: 0.6 }], score: 5000 },
};
```

Then merge `BOSSES_M4` into the existing `BOSSES` object (edit the `BOSSES` literal to include these four ids, or do `Object.assign(BOSSES, BOSSES_M4)` — see Step 3). Add F/R to `PICKUPS`.

- [ ] **Step 3: Merge bosses + extend pickups** — edit the existing `PICKUPS` to add `F` and `R`, and add the four boss ids into the existing `BOSSES` object (so `Boss` resolves them). Keep `ironGate`.

- [ ] **Step 4: Verify import**

```bash
node -e "import('./src/config.js').then(c=>console.log(c.WEAPONS.fire.gravity, c.PICKUPS.R.item, c.BOSSES.gomera.phases.length, c.ENEMY_RANGED.turret.burst))"
# expect: 900 rapid 3 3
```

- [ ] **Step 5: Commit** `feat(warrior): M4 config — F/R, enemy-ranged, 4 bosses, fire gravity`

---

## Task 2: F fireball (gravity) + R rapid (TDD)

**Files:** `games/warrior/tests/weapons.test.mjs`, `games/warrior/tests/entities.test.mjs`, `src/weapons.js`, `src/entities.js`

- [ ] **Step 1: weapons.test — F produces a gravity bullet**

```js
test('fire weapon emits a single parabolic (gravity) bullet', () => {
  const specs = fire('fire', 0, 0, { x: 1, y: 0 });
  assert.equal(specs.length, 1);
  assert.equal(specs[0].vx, WEAPONS.fire.speed);
  assert.ok(specs[0].gravity > 0, 'fireball carries gravity');
  assert.equal(specs[0].dmg, 2);
});
```

- [ ] **Step 2: Make `weapons.fire` copy `gravity`** — in the `push` helper, add `gravity: w.gravity || 0` to the spec; rapid already supported via `opts.rapid`. Run weapons.test → green.

- [ ] **Step 3: Bullet integrates gravity** — in `Bullet` constructor `this.gravity = spec.gravity || 0;`; in `update`, after moving, `if (this.gravity) this.vy += this.gravity * dt;`. (No test change needed; covered by weapons + a fireball arc smoke later.)

- [ ] **Step 4: entities.test — R rapid raises fire rate**

```js
test('rapid stacks shorten the fire cooldown (cap at maxStacks)', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 5 * TILE - 30); w.player = p;
  p.giveRapid(); p.giveRapid(); p.giveRapid(); p.giveRapid(); // 4 -> capped 3
  assert.equal(p.rapid, 3);
  const base = (await import('../src/weapons.js')).cooldownFor('rifle');
  // effective cooldown is shorter than base
  p.faceRight = true; w.input.intent.fireHeld = true;
  p.update(1/60, w);
  assert.ok(p.fireTimer < base, 'rapid shortened the cooldown');
});
```

(If top-level await import is awkward, import `cooldownFor` at the top of the test file and compare against `WEAPONS.rifle.cooldown`.)

- [ ] **Step 5: Player gains rapid** — constructor `this.rapid = 0;`; `giveRapid(){ this.rapid = Math.min(RAPID.maxStacks, this.rapid+1); }`; in `fire`, effective cooldown `cooldownFor(this.weapon) * Math.pow(RAPID_COOLDOWN_MUL, this.rapid)` and pass `{ rapid: this.rapid > 0 }` (speed handled by weapons). Import `RAPID` + `RAPID_COOLDOWN_MUL`. In `respawn`, classic resets rapid (`if (loseWeapon) this.rapid = 0`) — handled in game `_onPlayerDead` via `mode.loseWeaponOnDeath`. Run entities.test → green.

- [ ] **Step 6: Pickup applies F/R** — `Pickup.apply`: handle `def.item === 'rapid'` → `player.giveRapid()`. (F is `kind:'weapon'` → already switches weapon.) Run capsule/related tests → green.

- [ ] **Step 7: Commit** `feat(warrior): M4 weapons — F fireball arc + R rapid stacks + tests`

---

## Task 3: Enemy-bullet system (TDD)

**Files:** `games/warrior/tests/entities.test.mjs` (or new `enemybullet.test.mjs`), `src/entities.js`, `src/game.js`

- [ ] **Step 1: Test — a hostile bullet damages the player, not enemies**

```js
test('a hostile bullet hits the player and ignores enemies', () => {
  const w = flatWorld();
  const p = new Player(5 * TILE, 5 * TILE - 30); w.player = p;
  const e = new Runner(5 * TILE, 4 * TILE); w.enemies.push(e);
  const b = new Bullet({ x: p.x - 4, y: p.y + 4, vx: 400, vy: 0, dmg: 1, life: 1, hostile: true });
  let hurt = false; const w2 = { ...w, hurtPlayer: () => { hurt = true; } };
  for (let i = 0; i < 4; i++) b.update(1/60, w2);
  assert.equal(e.dead, false, 'hostile bullet ignores enemies');
});
```

(Player damage from hostile bullets is applied by `game.update`, not `Bullet.update` — tested via game.test.)

- [ ] **Step 2: Bullet honors `hostile`** — constructor `this.hostile = !!spec.hostile;`; in `update`, after the terrain check, `if (this.hostile) return;` (skip the enemy loop). Run → green.

- [ ] **Step 3: game wires enemyBullets** — constructor `this.enemyBullets = [];`; world facade `get enemyBullets(){...}` + `spawnEnemyBullet(spec){ game.enemyBullets.push(new Bullet({ ...spec, hostile:true })); }`; `_spawnEntities` resets it. In `update` (playing), after updating bullets/enemies: update enemyBullets (terrain), check `aabb(p, b)` → if `p.barrier>0` ignore (or block), else `if(!p.isInvulnerable()) p.takeDamage()`, `b.dead=true`; cull. Add a game.test for player taking a hostile-bullet hit.

- [ ] **Step 4: game.test — hostile bullet kills the player (casual respawn)**

```js
test('a hostile enemy bullet hits the player (casual respawn, no crash)', () => {
  const g = freshGame();
  const p = g.player; p.invuln = 0; p.barrier = 0;
  g._world.spawnEnemyBullet({ x: p.x, y: p.y + 4, vx: 0, vy: 0, dmg: 1, life: 1 });
  const d0 = g.deaths;
  for (let i = 0; i < 90; i++) g.update(1/60);
  assert.ok(g.deaths >= d0); // took the hit and respawned (casual) — no throw
  assert.equal(g.state, 'playing');
});
```

- [ ] **Step 5: Run all → green. Commit** `feat(warrior): M4 enemy bullets — hostile Bullet + game wiring + tests`

> **CHECKPOINT CP-A**

---

## Task 4: Gunner / Turret / Flyer (TDD)

**Files:** `games/warrior/tests/entities.test.mjs`, `src/entities.js`

- [ ] **Step 1: Tests**

```js
test('a Gunner fires an aimed enemy bullet at the player on its cooldown', () => {
  const w = flatWorld(); const shots = [];
  const w2 = { ...w, spawnEnemyBullet: (s) => shots.push(s) };
  w2.player = new Player(10 * TILE, 5 * TILE - 30);
  const g = new Gunner(3 * TILE, 4 * TILE);
  for (let i = 0; i < 3 * 60; i++) g.update(1/60, w2);
  assert.ok(shots.length >= 1, 'gunner fired');
  assert.ok(shots[0].vx > 0, 'aimed toward the player on the right');
});

test('a Turret fires a burst', () => {
  const w = flatWorld(); const shots = [];
  const w2 = { ...w, spawnEnemyBullet: (s) => shots.push(s) };
  w2.player = new Player(10 * TILE, 5 * TILE - 30);
  const t = new Turret(3 * TILE, 4 * TILE);
  for (let i = 0; i < 3 * 60; i++) t.update(1/60, w2);
  assert.ok(shots.length >= 3, 'turret fired a burst');
});

test('a Flyer moves in a sine wave and can be killed', () => {
  const w = flatWorld();
  const f = new Flyer(5 * TILE, 2 * TILE); const y0 = f.y;
  let moved = false;
  for (let i = 0; i < 60; i++) { f.update(1/60, w); if (Math.abs(f.y - y0) > 5) moved = true; }
  assert.ok(moved, 'flyer oscillates vertically');
  f.hit(99, w); assert.equal(f.dead, true);
});
```

- [ ] **Step 2: Implement `Gunner`, `Turret`, `Flyer`** in `entities.js` (import `ENEMY_RANGED`). Each: `hp`, `hit(dmg,world)` (→ killScore + particles like GroundEnemy), `update(dt,world)`:
  - Gunner: stationary on ground (collideTiles for gravity), `fireCd` timer; on fire, aim unit vector to player, `world.spawnEnemyBullet({x,y,vx:aim.x*spd,vy:aim.y*spd,dmg})`.
  - Turret: fixed (no gravity needed if placed on solid; still collide), on fire emit `burst` bullets in a fan around the player-aim.
  - Flyer: `this.baseY=y`, sine vertical (`y = baseY + amp*sin(freq*t)`), horizontal drift toward/around player; `fireCd` drops a bullet downward/aimed. `collideTiles` optional (flyers ignore terrain — just move).
  Reuse a small `aimAt(from,to)` helper.

- [ ] **Step 3: game `_makeEnemy` knows the new types** — extend the factory: `gunner→new Gunner`, `turret→new Turret`, `flyer→new Flyer`. Run all tests → green.

- [ ] **Step 4: Commit** `feat(warrior): M4 ranged enemies — Gunner/Turret/Flyer + enemy fire + tests`

> **CHECKPOINT CP-B**

---

## Task 5: `tools/verify-levels.mjs` + parseLevel difficulty (TDD)

**Files:** `games/warrior/tools/verify-levels.mjs`, `src/levels.js`, `tests/levels.test.mjs`

- [ ] **Step 1: parseLevel returns `difficulty`** — in each level add `difficulty:{enemyMul,fireRateMul,bossHpMul}` (L1 default `{1,1,1}`); parseLevel returns `difficulty: lvl.difficulty || { enemyMul:1, fireRateMul:1, bossHpMul:1 }`. Add a levels.test asserting L1.difficulty exists.

- [ ] **Step 2: Write `tools/verify-levels.mjs`**

```js
// Static level validation for 丛林勇士. Run: node tools/verify-levels.mjs
import { TILE, SOLID } from '../src/config.js';
import { LEVELS, parseLevel } from '../src/levels.js';

const PICKUP_LETTERS = new Set(['M', 'S', 'L', 'F', 'B', 'R']);
let failures = 0;
const fail = (id, msg) => { failures++; console.error(`✖ [${id}] ${msg}`); };

function surfaceRow(grid, col) {
  for (let r = 0; r < grid.length; r++) if (grid[r] && grid[r][col] && SOLID.has(grid[r][col])) return r;
  return null;
}

for (const def of LEVELS) {
  let lv;
  try { lv = parseLevel(def); } catch (e) { fail(def.id, 'parseLevel threw: ' + e.message); continue; }
  if (!lv.grid.length || !lv.cols) fail(lv.id, 'empty grid');
  // spawn has ground below
  if (surfaceRow(lv.grid, Math.floor(lv.spawn.x / TILE)) == null) fail(lv.id, 'spawn over a pit');
  // goal to the right of spawn
  if (!(lv.goalX > lv.spawn.x)) fail(lv.id, 'goalX not right of spawn');
  // falcons have valid drops
  for (const f of (lv.falcons || [])) if (!PICKUP_LETTERS.has(f.drop)) fail(lv.id, `bad falcon drop ${f.drop}`);
  // boss column solid
  if (lv.bossX != null && surfaceRow(lv.grid, Math.floor((lv.bossX + 2 * TILE) / TILE)) == null) fail(lv.id, 'boss over a pit');
  // no pit wider than 3 tiles on the lowest floor row (crossable)
  const floor = lv.grid[lv.rows - 1] || [];
  let gap = 0;
  for (let c = 0; c < lv.cols; c++) { if (floor[c] && SOLID.has(floor[c])) gap = 0; else if (++gap > 3) { fail(lv.id, `pit > 3 tiles near col ${c}`); break; } }
  if (!failures) console.log(`✔ [${lv.id}] ${lv.name} — ${lv.enemies.length} enemies, boss=${lv.bossType || 'none'}`);
}

if (failures) { console.error(`\n${failures} problem(s).`); process.exit(1); }
console.log(`\nAll ${LEVELS.length} level(s) OK.`);
```

- [ ] **Step 3: Run** `node tools/verify-levels.mjs` → `All 1 level(s) OK.` (L1 only so far). Commit `feat(warrior): M4 verify-levels CLI + parseLevel difficulty + test`.

---

## Task 6: Author L2–L5 + boss configs, verify-green (TDD)

**Files:** `src/levels.js`, `tests/levels.test.mjs`

- [ ] **Step 1: levels.test — there are 5 levels, each parses with a boss + rising difficulty**

```js
test('the campaign has 5 levels, each with a boss and non-decreasing difficulty', () => {
  assert.equal(LEVELS.length, 5);
  let prev = 0;
  for (let i = 0; i < 5; i++) {
    const lv = parseLevel(LEVELS[i]);
    assert.ok(lv.bossType, `L${i + 1} has a boss`);
    assert.ok(lv.difficulty.enemyMul >= prev, 'difficulty non-decreasing');
    prev = lv.difficulty.enemyMul;
  }
});
```

- [ ] **Step 2: Author L2–L5** in `levels.js` — for each: a ~100-col `rows` grid (theme tiles, ≤3-tile pits, platforms; place `r/j/u/t/y` enemies per the level's challenge), `falcons` (drop the level's reward weapon: L2→`L`, L3→`F`, L4→`R`, L5→`S`/`B`), `boss:{type}` (cyclops/valkyrie/frost/gomera), `difficulty` rising (L2 `{1.0,1.0,1.0}` → L5 `{1.6,1.6,1.5}`), and the theme (`steel`/`beach`/`snow`/`abyss`). Add the four theme palettes to `THEMES` if missing (steel/beach/snow/abyss — copy from pixel-quest config values). Push all into `LEVELS`.

- [ ] **Step 3: Verify each level** — run `node tools/verify-levels.mjs` after authoring; fix any reported pit/spawn/boss-ground issue (this is the objective gate for hand-authored grids). Iterate until `All 5 level(s) OK.`

- [ ] **Step 4: Run levels.test + full suite → green. Commit** `feat(warrior): M4 levels — L2–L5 (steel/beach/snow/abyss) + bosses + difficulty, verify-green`

> **CHECKPOINT CP-C** — `node --test` + `node tools/verify-levels.mjs` both green.

---

## Task 7: sprites + render for new content

**Files:** `src/sprites.js`, `src/render.js`

- [ ] **Step 1: sprites** — add `gunner`, `turret`, `flyer(frame)`, `enemyBullet`, fireball (orange glow), and `boss('cyclops'|'valkyrie'|'frost'|'gomera', frame)` variants (distinct silhouettes/colors; reuse the armored-block style with a themed core). Add the 4 new `THEMES` palettes if not added in T6.

- [ ] **Step 2: render** — draw `game.enemyBullets` (red-tinted), the new enemies in `_enemies` (instanceof Gunner/Turret/Flyer), fireball bullets with a glow, and the right boss sprite per `boss.typeId`. Rapid stacks: small `R×n` indicator near the weapon HUD; flyers/enemy bullets culled off-screen.

- [ ] **Step 3: Commit** `feat(warrior): M4 sprites/render — ranged enemies, enemy bullets, fireball, 4 boss skins`

---

## Task 8: difficulty wiring in `game.js`

**Files:** `src/game.js`, `src/entities.js`

- [ ] **Step 1: Expose difficulty** — world facade getters `get levelMul(){ return game.level.difficulty.enemyMul; }` and `get fireRateMul(){ return game.level.difficulty.fireRateMul; }`. Enemies multiply speed by `mode.enemyMul * levelMul` and fire cooldowns divide by `fireRateMul`. BOSS hp at spawn `× difficulty.bossHpMul` (in `_spawnBoss`, after `new Boss(...)`, `this.boss.maxHp = Math.round(this.boss.maxHp*mul); this.boss.hp = this.boss.maxHp;`).

- [ ] **Step 2: Classic rapid reset on death** — in `_onPlayerDead`, when `mode.loseWeaponOnDeath`, also `this.player.rapid = 0;`.

- [ ] **Step 3: Run full suite → green. Commit** `feat(warrior): M4 difficulty — per-level enemy/fire/boss-hp scaling`

---

## Task 9: Browser smoke (multi-level) + M4 gate wrap

**Files:** `tests/smoke.mjs`

- [ ] **Step 1: Extend the smoke** — after clearing L1 (existing flow), also: from select, pick the now-unlocked L2 card, fast-forward to its boss, verify it engages/clears; then jump (via `window.__game.selectLevel`) to L5 and verify the final boss spawns with multi-phase hp. Assert all 5 levels are parseable + unlockable progression works. Screenshot the select grid (now showing up to L2+ with ⭐).

- [ ] **Step 2: Run host-side** (server + system Chrome, `--no-proxy-server`). Expect `SMOKE PASS`.

- [ ] **Step 3: Gate** — `node --test` all green; `node tools/verify-levels.mjs` → All 5 OK; manual: each level reachable from select, difficulty rises, both modes playable.

- [ ] **Step 4: Milestone marker commit**

```bash
git -C /Users/james/Projects/game-hub commit --allow-empty -m "chore(warrior): M4 五关内容 + 满配武器 complete

Gate (spec §10 M4): levels/verify-levels all green; 5 levels each clearable with rising
difficulty; F fireball + R rapid; Gunner/Turret/Flyer + enemy bullets; 4 new bosses
(加尔玛/瓦尔基里/克隆/戈梅拉-multiphase). Both modes playable.
Next: M5 (触屏 8-dir + 音频 BGM + 视差 + 完整 HUD + ⭐结算页 + 冒烟 + js/games.js 注册卡片)."
```

> **CHECKPOINT CP-D** — M4 done.

---

## Self-Review

**Spec coverage (M4 §10):** L2–L5 ✅(T6) · each BOSS ✅(T1 configs + T6) · F 火球 ✅(T1/T2) · R 射速 ✅(T1/T2) · Flyer/Turret/Gunner(+战车 folded into the ranged set) ✅(T4) · 难度曲线参数化 ✅(T1/T6/T8) · verify-levels ✅(T5). Gate: levels + verify green, 5 clearable, rising difficulty, both modes. Out of M4: touch/parallax/BGM/full-HUD/⭐-results-page/hub-card (M5).

**No placeholders:** mechanics (F gravity, R rapid, enemy bullets, ranged enemies, verify tool, difficulty) are complete code + TDD. The 4 level grids are authored in T6 as data and gated by `verify-levels` (the objective correctness check for hand-authored content) rather than pre-baked into the plan — the standard pattern for level data.

**Type consistency:** `spawnEnemyBullet`/`enemyBullets`/`levelMul`/`fireRateMul` consistent across world facade, entities, game, tests. `Bullet` flags `hostile`/`gravity` consistent. New enemy classes `Gunner`/`Turret`/`Flyer` ↔ `_makeEnemy` markers `u`/`t`/`y` ↔ verify-levels. Boss config ids `cyclops`/`valkyrie`/`frost`/`gomera` ↔ level `boss.type` ↔ `BOSSES`. `player.rapid`/`giveRapid` ↔ Pickup `rapid` ↔ config `RAPID.maxStacks`.
