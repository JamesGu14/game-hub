import { test } from 'node:test';
import assert from 'node:assert/strict';
import { progress, rank, updateLap, RaceClock } from '../src/race.js';

const LEN = 10000;

test('progress combines laps and position', () => {
  assert.equal(progress({ lap: 0, z: 2500 }, LEN), 2500);
  assert.equal(progress({ lap: 2, z: 100 }, LEN), 20100);
});

test('rank orders racers by total progress (leader first)', () => {
  const rs = [
    { id: 'p', lap: 1, z: 500 },
    { id: 'a', lap: 1, z: 9000 },
    { id: 'b', lap: 2, z: 10 },
  ];
  assert.deepEqual(rank(rs, LEN), ['b', 'a', 'p']);
});

test('updateLap derives lap from monotonic distance (crossing the line)', () => {
  let r = { lap: 0, z: 10200, _prevZ: 9800 };
  r = updateLap(r, LEN);
  assert.equal(r.lap, 1);
});

test('updateLap does NOT advance mid-lap', () => {
  let r = { lap: 0, z: 5200, _prevZ: 5000 };
  r = updateLap(r, LEN);
  assert.equal(r.lap, 0);
});

test('updateLap never decreases the lap (monotonic, no reverse exploit)', () => {
  let r = { lap: 2, z: 1000, _prevZ: 20500 };
  r = updateLap(r, LEN);
  assert.equal(r.lap, 2);
});

test('updateLap counts multiple laps from a large distance', () => {
  let r = { lap: 0, z: 25000, _prevZ: 24000 };
  r = updateLap(r, LEN);
  assert.equal(r.lap, 2);
});

test('RaceClock counts down then runs, reports elapsed', () => {
  const c = new RaceClock(3);
  assert.equal(c.phase, 'countdown');
  c.tick(1); c.tick(1); c.tick(1);
  assert.equal(c.phase, 'racing');
  c.tick(0.5);
  assert.ok(Math.abs(c.elapsedMs - 500) < 20);
});
