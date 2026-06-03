import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMask, solidAt, carve, fillRect, groundY } from '../src/terrain.js';

test('fillRect makes cells solid; solidAt reads them', () => {
  const m = createMask(20, 20);
  fillRect(m, 5, 10, 10, 5); // x,y,w,h
  assert.equal(solidAt(m, 6, 11), 1);
  assert.equal(solidAt(m, 0, 0), 0);
  assert.equal(solidAt(m, -1, 5), 1); // out of bounds x => treated solid wall
  assert.equal(solidAt(m, 5, -1), 0); // above top => air
});

test('carve clears a circle of cells', () => {
  const m = createMask(40, 40);
  fillRect(m, 0, 0, 40, 40);
  carve(m, 20, 20, 6);
  assert.equal(solidAt(m, 20, 20), 0);   // center cleared
  assert.equal(solidAt(m, 20, 14), 0);   // edge within r
  assert.equal(solidAt(m, 0, 0), 1);     // far corner intact
});

test('groundY finds first solid scanning down from y', () => {
  const m = createMask(10, 100);
  fillRect(m, 0, 60, 10, 40); // solid from y=60 down
  assert.equal(groundY(m, 5, 0), 60);
  assert.equal(groundY(m, 5, 80), 80);   // already inside solid -> returns y
  const none = createMask(10, 10);
  assert.equal(groundY(none, 5, 0), null);
});
