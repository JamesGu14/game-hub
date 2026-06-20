import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSpawner, tickSpawner, spawnerDrained, isLevelComplete } from '../src/spawn.js';
import { rngFrom } from '../src/util.js';

const waves = [{ enemies: [{ type: 'normal', count: 3, interval: 0.5 }], startDelay: 0 }];

test('按 interval 逐只吐怪、总数正确', () => {
  const sp = makeSpawner(waves, rngFrom(1));
  let all = [];
  for (let i = 0; i < 20; i++) all = all.concat(tickSpawner(sp, 0.25));  // 5s
  assert.equal(all.length, 3);
  assert.ok(all.every((e) => e.type === 'normal'));
});

test('drained 在吐完后为真', () => {
  const sp = makeSpawner(waves, rngFrom(1));
  for (let i = 0; i < 40; i++) tickSpawner(sp, 0.25);
  assert.equal(spawnerDrained(sp), true);
});

test('胜利判定 = 吐完且场上清空', () => {
  const sp = makeSpawner(waves, rngFrom(1));
  for (let i = 0; i < 40; i++) tickSpawner(sp, 0.25);
  assert.equal(isLevelComplete(sp, [{ id: 1 }]), false);  // 场上还有
  assert.equal(isLevelComplete(sp, []), true);
});

test('startDelay 延迟首波', () => {
  const sp = makeSpawner([{ enemies: [{ type: 'normal', count: 1, interval: 1 }], startDelay: 2 }], rngFrom(1));
  let n = 0;
  for (let i = 0; i < 4; i++) n += tickSpawner(sp, 0.25).length;  // 1s < 2s delay
  assert.equal(n, 0);
  for (let i = 0; i < 8; i++) n += tickSpawner(sp, 0.25).length;  // 过 delay
  assert.equal(n, 1);
});
