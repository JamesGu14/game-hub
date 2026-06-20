import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, dist, rngFrom, pickWeighted } from '../src/util.js';

test('clamp & lerp', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-3, 0, 10), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});

test('dist 勾股', () => { assert.equal(dist(0, 0, 3, 4), 5); });

test('rngFrom 同种子确定性、序列可复现', () => {
  const a = rngFrom(123), b = rngFrom(123);
  const sa = [a(), a(), a()], sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
});

test('pickWeighted 权重为 0 的项永不被选', () => {
  const rng = rngFrom(1);
  const items = [{ id: 'a', w: 0 }, { id: 'b', w: 1 }];
  for (let i = 0; i < 50; i++) {
    assert.equal(pickWeighted(items, (it) => it.w, rng).id, 'b');
  }
});
