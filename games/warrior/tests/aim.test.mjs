import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAim } from '../src/input.js';

const I = (o) => ({ moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false, ...o });
const near = (a, b) => Math.abs(a - b) < 1e-9;
const D = Math.SQRT1_2; // diagonal component

test('horizontal aim follows facing when only left/right (or idle)', () => {
  assert.deepEqual(resolveAim(I({ moveX: 1 }), true, true), { x: 1, y: 0 });
  assert.deepEqual(resolveAim(I({ moveX: -1 }), true, false), { x: -1, y: 0 });
  // idle: no moveX -> use faceRight
  assert.deepEqual(resolveAim(I({}), true, true), { x: 1, y: 0 });
  assert.deepEqual(resolveAim(I({}), true, false), { x: -1, y: 0 });
});

test('up only = straight up; up + side = diagonal up', () => {
  assert.deepEqual(resolveAim(I({ aimUp: true }), true, true), { x: 0, y: -1 });
  const ur = resolveAim(I({ aimUp: true, moveX: 1 }), true, true);
  assert.ok(near(ur.x, D) && near(ur.y, -D));
  const ul = resolveAim(I({ aimUp: true, moveX: -1 }), true, false);
  assert.ok(near(ul.x, -D) && near(ul.y, -D));
});

test('on the ground, down aims horizontal (prone shot), never straight down', () => {
  assert.deepEqual(resolveAim(I({ aimDown: true }), true, true), { x: 1, y: 0 });
  assert.deepEqual(resolveAim(I({ aimDown: true, moveX: -1 }), true, false), { x: -1, y: 0 });
});

test('in the air, down only = straight down; down + side = diagonal down', () => {
  assert.deepEqual(resolveAim(I({ aimDown: true }), false, true), { x: 0, y: 1 });
  const dr = resolveAim(I({ aimDown: true, moveX: 1 }), false, true);
  assert.ok(near(dr.x, D) && near(dr.y, D));
  const dl = resolveAim(I({ aimDown: true, moveX: -1 }), false, false);
  assert.ok(near(dl.x, -D) && near(dl.y, D));
});

test('returned vector is always unit length', () => {
  const cases = [
    resolveAim(I({ moveX: 1 }), true, true),
    resolveAim(I({ aimUp: true, moveX: 1 }), true, true),
    resolveAim(I({ aimDown: true, moveX: -1 }), false, false),
    resolveAim(I({ aimUp: true }), false, true),
  ];
  for (const v of cases) assert.ok(near(Math.hypot(v.x, v.y), 1));
});
