import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rollItem, applyHit, missileTarget, ITEM_KINDS } from '../src/items.js';
import { ITEMS } from '../src/config.js';

test('rollItem returns a known kind', () => {
  const seq = [0, 0.25, 0.5, 0.75, 0.99]; let i = 0;
  const rng = () => seq[i++ % seq.length];
  for (let k = 0; k < 5; k++) assert.ok(ITEM_KINDS.includes(rollItem(rng)));
});

test('applyHit sets spin and never removes the racer', () => {
  const t = { id: 'a', spinTimer: 0, shield: 0 };
  const after = applyHit(t, ITEMS.missile.spinDur);
  assert.equal(after.spinTimer, ITEMS.missile.spinDur);
  assert.ok('id' in after, 'racer still exists (not eliminated)');
});

test('shield blocks the hit and is consumed instead of spinning', () => {
  const t = { id: 'a', spinTimer: 0, shield: 5 };
  const after = applyHit(t, ITEMS.missile.spinDur);
  assert.equal(after.spinTimer, 0, 'no spin when shielded');
  assert.equal(after.shield, 0, 'shield consumed');
});

test('missileTarget hits the racer one place ahead of self', () => {
  const racers = [
    { id: 'a', lap: 1, z: 9000 },
    { id: 'b', lap: 1, z: 6000 },
    { id: 'self', lap: 1, z: 3000 },
    { id: 'c', lap: 1, z: 1000 },
  ];
  assert.equal(missileTarget(racers, 10000, 'self'), 'b');
});

test('missileTarget returns null when self is the leader', () => {
  const racers = [{ id: 'self', lap: 2, z: 100 }, { id: 'b', lap: 1, z: 100 }];
  assert.equal(missileTarget(racers, 10000, 'self'), null);
});
