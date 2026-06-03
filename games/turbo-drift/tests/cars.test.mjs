import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARS, carById, isUnlocked, unlockFor, TRACK_UNLOCKS } from '../src/cars.js';

test('4 cars, only lightning starts unlocked', () => {
  assert.equal(CARS.length, 4);
  const lightning = carById('lightning');
  assert.equal(lightning.unlock, null);
  assert.equal(CARS.filter(c => c.unlock === null).length, 1);
});

test('every car has top/accel/grip multipliers and a color', () => {
  for (const c of CARS) {
    assert.ok(c.top > 0 && c.accel > 0 && c.grip > 0, `${c.id} has stats`);
    assert.ok(typeof c.color === 'string');
  }
});

test('isUnlocked: locked car requires being in save.unlocked', () => {
  assert.equal(isUnlocked(carById('lightning'), { unlocked: [] }), true);
  assert.equal(isUnlocked(carById('blaze'), { unlocked: [] }), false);
  assert.equal(isUnlocked(carById('blaze'), { unlocked: ['blaze'] }), true);
});

test('unlockFor: top-3 finish unlocks that track car; 4th unlocks nothing', () => {
  assert.equal(unlockFor('track1', 1), 'blaze');
  assert.equal(unlockFor('track1', 3), 'blaze');
  assert.equal(unlockFor('track1', 4), null);
  assert.equal(unlockFor('track2', 2), 'gust');
  assert.equal(unlockFor('track3', 1), 'star');
  assert.equal(unlockFor('track4', 1), null); // 终极赛道不再发车
});

test('TRACK_UNLOCKS maps tracks 1-3 only', () => {
  assert.deepEqual(Object.keys(TRACK_UNLOCKS).sort(), ['track1', 'track2', 'track3']);
});
