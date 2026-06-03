import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, wrap, project } from '../src/util/math.js';
import { RENDER, VIEW } from '../src/config.js';

test('clamp & lerp', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('wrap keeps value in [0, n)', () => {
  assert.equal(wrap(5, 4), 1);
  assert.equal(wrap(-1, 4), 3);
  assert.equal(wrap(0, 4), 0);
});

test('project: nearer segment is bigger and lower on screen', () => {
  const cam = { x: 0, y: RENDER.camH, z: 0 };
  const near = project(cam, { x: 0, y: 0, z: 1000 });
  const far  = project(cam, { x: 0, y: 0, z: 8000 });
  assert.ok(near.scale > far.scale, 'near scale larger');
  assert.ok(near.w > far.w, 'near width larger');
  assert.ok(near.y > far.y, 'near is lower (greater y) on screen');
  assert.equal(near.x, VIEW.W / 2, 'centered x when worldX==camX');
});

test('project: positive worldX shifts right on screen', () => {
  const cam = { x: 0, y: RENDER.camH, z: 0 };
  const p = project(cam, { x: 500, y: 0, z: 2000 });
  assert.ok(p.x > VIEW.W / 2);
});
