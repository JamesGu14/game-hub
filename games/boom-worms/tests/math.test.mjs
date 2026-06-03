import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, dist, angleOf, toRad, toDeg, vecFromAngle } from '../src/util/math.js';

test('clamp & lerp', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('dist', () => {
  assert.equal(dist(0, 0, 3, 4), 5);
});

test('angleOf / vecFromAngle round-trip', () => {
  assert.ok(Math.abs(angleOf(1, 0) - 0) < 1e-9);
  assert.ok(Math.abs(angleOf(0, 1) - Math.PI / 2) < 1e-9);
  const v = vecFromAngle(0, 10);
  assert.ok(Math.abs(v.x - 10) < 1e-9 && Math.abs(v.y) < 1e-9);
  const up = vecFromAngle(-Math.PI / 2, 5);
  assert.ok(Math.abs(up.x) < 1e-9 && Math.abs(up.y + 5) < 1e-9);
});

test('toRad / toDeg', () => {
  assert.ok(Math.abs(toRad(180) - Math.PI) < 1e-9);
  assert.ok(Math.abs(toDeg(Math.PI) - 180) < 1e-9);
});
