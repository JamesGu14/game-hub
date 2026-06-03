import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explosionDamage, applyExplosion, drowned } from '../src/combat.js';

test('explosionDamage: full at center, 0 at/after radius, linear between', () => {
  assert.equal(explosionDamage(0, 50, 40), 40);
  assert.equal(explosionDamage(50, 50, 40), 0);
  assert.equal(explosionDamage(60, 50, 40), 0);
  assert.equal(explosionDamage(25, 50, 40), 20);
});

test('applyExplosion damages worms in radius and returns hits with knockback', () => {
  const worms = [
    { id: 1, x: 100, y: 100, vx: 0, vy: 0, hp: 100, alive: true },
    { id: 2, x: 300, y: 100, vx: 0, vy: 0, hp: 100, alive: true },
  ];
  const hits = applyExplosion(worms, 110, 100, 50, 40, 1);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].id, 1);
  assert.ok(worms[0].hp < 100);     // took damage
  assert.ok(worms[0].vx < 0);       // knocked left (away from blast at x=110)
  assert.equal(worms[1].hp, 100);   // out of range
});

test('drowned: worm center below waterY', () => {
  assert.equal(drowned({ y: 520, alive: true }, 512), true);
  assert.equal(drowned({ y: 500, alive: true }, 512), false);
});
