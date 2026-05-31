import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aabb, clamp, lerp, cameraTarget, resolveAim, spreadDirections } from '../src/util/math.js';

test('aabb overlap', () => {
  assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 5, h: 5 }), false);
});

test('clamp & lerp', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('cameraTarget is forward-only and clamped', () => {
  assert.equal(cameraTarget(0, 2000, 0), 0);
  assert.equal(Math.round(cameraTarget(500, 2000, 0)), Math.round(500 - 960 * 0.38));
  assert.equal(cameraTarget(99999, 2000, 0), 1040);
  assert.equal(cameraTarget(100, 2000, 800), 800);
});

test('resolveAim 8 directions', () => {
  assert.deepEqual(resolveAim({ facing: 1, moveX: 0, aimUp: false, aimDown: false, onGround: true }), { x: 1, y: 0 });
  assert.deepEqual(resolveAim({ facing: -1, moveX: 0, aimUp: false, aimDown: false, onGround: true }), { x: -1, y: 0 });
  assert.deepEqual(resolveAim({ facing: 1, moveX: 0, aimUp: true, aimDown: false, onGround: true }), { x: 0, y: -1 });
  const d = resolveAim({ facing: 1, moveX: 1, aimUp: true, aimDown: false, onGround: true });
  assert.ok(d.x > 0.7 && d.x < 0.71 && d.y < -0.7);
  assert.deepEqual(resolveAim({ facing: 1, moveX: 0, aimUp: false, aimDown: true, onGround: false }), { x: 0, y: 1 });
});

test('spreadDirections fan is symmetric and centered', () => {
  const dirs = spreadDirections(0, 5, 26);
  assert.equal(dirs.length, 5);
  assert.ok(Math.abs(dirs[2].y) < 1e-9);
  assert.ok(dirs[0].y < 0 && dirs[4].y > 0);
});
