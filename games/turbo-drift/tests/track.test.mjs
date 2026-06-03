import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, buildSegments } from '../src/track.js';
import { RENDER } from '../src/config.js';

test('there are exactly 4 tracks with required fields', () => {
  assert.equal(TRACKS.length, 4);
  for (const t of TRACKS) {
    assert.ok(t.id && t.name && t.theme, `track ${t.id} has id/name/theme`);
    assert.ok(Array.isArray(t.segs) && t.segs.length > 50, 'has segments');
    assert.ok(t.length === t.segs.length * RENDER.segLen, 'length matches segs');
    assert.ok(t.theme.sky && t.theme.road && t.theme.grass, 'theme colors present');
    assert.ok(Array.isArray(t.itemBoxes) && t.itemBoxes.length >= 3, 'has item boxes');
  }
});

test('item box segment indices are within the track', () => {
  for (const t of TRACKS) {
    for (const seg of t.itemBoxes) {
      assert.ok(seg >= 0 && seg < t.segs.length, `box ${seg} inside ${t.id}`);
    }
  }
});

test('worldY accumulates so the track has hills (not all flat)', () => {
  const t = TRACKS.find(x => x.id === 'track3'); // 沙漠：有大坡
  const ys = t.segs.map(s => s.worldY);
  const span = Math.max(...ys) - Math.min(...ys);
  assert.ok(span > 0, 'track3 has elevation change');
});

test('buildSegments produces worldY accumulation', () => {
  const segs = buildSegments([{ n: 3, curve: 0, hill: 100 }]);
  assert.equal(segs.length, 3);
  assert.ok(segs[2].worldY >= segs[0].worldY);
});

test('track1 (tutorial) is gentler than track4 (hardest) by max abs curve', () => {
  const maxAbs = t => Math.max(...t.segs.map(s => Math.abs(s.curve)));
  const t1 = TRACKS.find(x => x.id === 'track1');
  const t4 = TRACKS.find(x => x.id === 'track4');
  assert.ok(maxAbs(t1) < maxAbs(t4), 'track1 curves milder than track4');
});
