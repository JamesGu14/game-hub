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
  // simulate the game's bullet-vs-falcon check
  for (let i = 0; i < 6 && !f.dead; i++) {
    b.update(1 / 60, w); f.update(1 / 60, w);
    if (!f.dead && b.x < f.x + f.w && b.x + b.w > f.x && b.y < f.y + f.h && b.y + b.h > f.y) f.hitByBullet(w);
  }
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
