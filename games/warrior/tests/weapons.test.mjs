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
