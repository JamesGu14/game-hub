import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepBallistic, simulate } from '../src/util/trajectory.js';

test('stepBallistic with no gravity/wind is straight line', () => {
  const s = stepBallistic({ x: 0, y: 0, vx: 100, vy: 0 }, 0.5, 0, 0);
  assert.ok(Math.abs(s.x - 50) < 1e-9);
  assert.ok(Math.abs(s.y) < 1e-9);
  assert.equal(s.vx, 100);
});

test('gravity pulls down (y grows), wind pushes x-velocity', () => {
  const s = stepBallistic({ x: 0, y: 0, vx: 0, vy: 0 }, 1, 500, 40);
  assert.ok(s.vy > 0 && s.y > 0);   // fell down
  assert.ok(s.vx > 0 && s.x > 0);   // wind pushed right
});

test('simulate returns arc and stops at hitTest', () => {
  // flat ground at y=100; fire up-right, should come back down and hit
  const hit = (x, y) => y >= 100;
  const r = simulate({ x: 0, y: 90 }, { x: 60, y: -120 }, { gravity: 500, wind: 0, dt: 1 / 60, maxSteps: 2000 }, hit);
  assert.equal(r.hit, true);
  assert.ok(r.last.y >= 100);
  assert.ok(r.points.length > 2);
});
