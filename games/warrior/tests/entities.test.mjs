import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, MODES, WEAPONS } from '../src/config.js';
import { Player, Runner, Jumper, Bullet, Gunner, Turret, Flyer } from '../src/entities.js';

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
    killScore(base) { this.scored += base; return base; },
    spawnBullets(specs) { for (const s of specs) this.bullets.push(new Bullet(s)); },
    playSound(id) { sounds.push(id); },
    shake() {}, addFloatText() {}, spawnParticles() {}, spawnEnemyBullet() {},
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
  const e = new Runner(10 * TILE, 4 * TILE); w.enemies.push(e); // spawn ABOVE the floor row
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
  const e = new Runner(11 * TILE, 4 * TILE); w.enemies.push(e); // spawn ABOVE the floor row
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

test('rapid stacks shorten the fire cooldown (cap at maxStacks)', () => {
  const w = flatWorld();
  const p = new Player(2 * TILE, 5 * TILE - 30); w.player = p;
  p.giveRapid(); p.giveRapid(); p.giveRapid(); p.giveRapid(); // 4 -> capped at 3
  assert.equal(p.rapid, 3);
  p.faceRight = true; w.input.intent.fireHeld = true;
  p.update(1 / 60, w);
  assert.ok(p.fireTimer < WEAPONS.rifle.cooldown, 'rapid shortened the cooldown');
});

test('a hostile bullet ignores enemies (player-damage handled by game)', () => {
  const w = flatWorld();
  const e = new Runner(5 * TILE, 4 * TILE); w.enemies.push(e);
  const b = new Bullet({ x: e.x - 4, y: e.y + 4, vx: 400, vy: 0, dmg: 1, life: 1, hostile: true });
  for (let i = 0; i < 6; i++) b.update(1 / 60, w);
  assert.equal(e.dead, false, 'hostile bullet does not hit enemies');
});

test('a fireball bullet arcs downward under gravity', () => {
  const w = flatWorld();
  const b = new Bullet({ x: 2 * TILE, y: 1 * TILE, vx: 300, vy: 0, dmg: 2, life: 1, gravity: 900 });
  for (let i = 0; i < 20; i++) b.update(1 / 60, w);
  assert.ok(b.vy > 0, 'gravity pulled the fireball down');
});

test('a Gunner fires an aimed enemy bullet toward the player on its cooldown', () => {
  const shots = [];
  const w = flatWorld({ spawnEnemyBullet: (s) => shots.push(s) });
  w.player = new Player(12 * TILE, 4 * TILE);
  const g = new Gunner(3 * TILE, 4 * TILE); w.enemies.push(g);
  for (let i = 0; i < 3 * 60; i++) g.update(1 / 60, w);
  assert.ok(shots.length >= 1, 'gunner fired');
  assert.ok(shots[0].vx > 0, 'aimed toward the player on the right');
});

test('a Turret fires a burst', () => {
  const shots = [];
  const w = flatWorld({ spawnEnemyBullet: (s) => shots.push(s) });
  w.player = new Player(12 * TILE, 4 * TILE);
  const t = new Turret(3 * TILE, 4 * TILE); w.enemies.push(t);
  for (let i = 0; i < 3 * 60; i++) t.update(1 / 60, w);
  assert.ok(shots.length >= 3, 'turret fired a burst');
});

test('a Flyer oscillates vertically and can be killed', () => {
  const w = flatWorld();
  const f = new Flyer(5 * TILE, 2 * TILE); const y0 = f.y;
  let moved = false;
  for (let i = 0; i < 90; i++) { f.update(1 / 60, w); if (Math.abs(f.y - y0) > 5) moved = true; }
  assert.ok(moved, 'flyer moves on a sine wave');
  f.hit(99, w); assert.equal(f.dead, true);
});
