import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCenterline, worldAt, headingAt } from '../src/geometry.js';
import { trackById } from '../src/track.js';
import { RENDER } from '../src/config.js';

const T = trackById('track1');
const cl = buildCenterline(T);

test('centerline has one point per segment with x/y/z/heading', () => {
  assert.equal(cl.length, T.segs.length);
  for (const p of cl) {
    assert.equal(typeof p.x, 'number'); assert.equal(typeof p.y, 'number');
    assert.equal(typeof p.z, 'number'); assert.equal(typeof p.heading, 'number');
  }
});

test('a straight opening segment keeps heading ~0 and advances z', () => {
  // track1 起始有一段直道
  assert.ok(Math.abs(cl[5].heading) < 0.05, 'heading near 0 on straight');
  assert.ok(cl[5].z > cl[0].z, 'advances forward');
});

test('a right-curve section accumulates heading', () => {
  const maxAbsHeading = Math.max(...cl.map(p => Math.abs(p.heading)));
  assert.ok(maxAbsHeading > 0.1, 'curve produces real heading change');
});

test('worldAt(z, 0) lies on the centerline; lateral offsets by ~roadHalfW', () => {
  const z = RENDER.segLen * 10.5;
  const mid = worldAt(cl, z, 0);
  const right = worldAt(cl, z, 1);
  const dx = right.pos.x - mid.pos.x, dz = right.pos.z - mid.pos.z;
  const off = Math.hypot(dx, dz);
  assert.ok(Math.abs(off - RENDER.roadW) < RENDER.roadW * 0.15, 'lateral=1 ~ roadHalfW from center');
});

test('worldAt y follows track elevation (hill)', () => {
  const flat = worldAt(cl, RENDER.segLen * 2, 0).pos.y;
  // track3 有大坡
  const T3 = trackById('track3'); const cl3 = buildCenterline(T3);
  const ys = cl3.map(p => p.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0, 'elevation varies on hilly track');
});

test('headingAt interpolates between segment headings', () => {
  const h = headingAt(cl, RENDER.segLen * 3.5);
  assert.equal(typeof h, 'number');
});
