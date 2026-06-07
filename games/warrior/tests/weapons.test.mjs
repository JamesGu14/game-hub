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

test('fire weapon emits a single parabolic (gravity) bullet', () => {
  const specs = fire('fire', 0, 0, { x: 1, y: 0 });
  assert.equal(specs.length, 1);
  assert.equal(specs[0].vx, WEAPONS.fire.speed); // 420
  assert.ok(specs[0].gravity > 0, 'fireball carries gravity');
  assert.equal(specs[0].dmg, 2);
});
