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
    spawnEnemy() {}, spawnEnemyBullet() {}, ...extra,
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
  let slammed = false;
  const w = world({ shake: () => { slammed = true; } });
  for (let i = 0; i < 5 * 60; i++) b.update(1 / 60, w);
  assert.equal(slammed, true, 'boss slammed at least once');
});

test('each boss has a distinct fire pattern (bullet count)', () => {
  const fire = (typeId) => {
    const shots = [];
    const w = world({ spawnEnemyBullet: (s) => shots.push(s) });
    const b = new Boss(typeId, 20 * TILE, 6 * TILE);
    b._fire(w);
    return shots.length;
  };
  assert.equal(fire('cyclops'), 1);   // slow aimed eye beam
  assert.equal(fire('valkyrie'), 3);  // strafing spread
  assert.equal(fire('frost'), 3);     // downward ice shards
  assert.ok(fire('gomera') >= 8);     // radial burst
});
