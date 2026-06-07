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
