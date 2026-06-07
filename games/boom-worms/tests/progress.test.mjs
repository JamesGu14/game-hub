import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maxPlayableLevel, isPlayable, levelNodeState } from '../src/progress.js';

const TOTAL = 15;

test('maxPlayableLevel: 未通关 → 只有第 1 关可玩', () => {
  assert.equal(maxPlayableLevel(0, TOTAL), 1);
});

test('maxPlayableLevel: 中段进度 → 已通关 + 下一关', () => {
  assert.equal(maxPlayableLevel(7, TOTAL), 8);
});

test('maxPlayableLevel: 全通关 → 封顶在 total（没有第 16 关）', () => {
  assert.equal(maxPlayableLevel(15, TOTAL), 15);
});

test('maxPlayableLevel: 越界/损坏存档被 clamp', () => {
  assert.equal(maxPlayableLevel(99, TOTAL), 15);
  assert.equal(maxPlayableLevel(-3, TOTAL), 1);
});

test('isPlayable: 边界 —— 下一关可玩，再往后不可玩', () => {
  assert.equal(isPlayable(8, 7, TOTAL), true);   // next
  assert.equal(isPlayable(9, 7, TOTAL), false);  // locked
  assert.equal(isPlayable(1, 0, TOTAL), true);
  assert.equal(isPlayable(0, 0, TOTAL), false);  // 没有第 0 关
});

test('levelNodeState: cleared / next / locked', () => {
  assert.equal(levelNodeState(3, 5, TOTAL), 'cleared');
  assert.equal(levelNodeState(5, 5, TOTAL), 'cleared');
  assert.equal(levelNodeState(6, 5, TOTAL), 'next');
  assert.equal(levelNodeState(7, 5, TOTAL), 'locked');
});

test('levelNodeState: 全通关 → 每个节点都 cleared、没有 next', () => {
  for (let n = 1; n <= TOTAL; n++) assert.equal(levelNodeState(n, 15, TOTAL), 'cleared');
});

test('levelNodeState: 新存档 → 第 1 关 next、其余 locked', () => {
  assert.equal(levelNodeState(1, 0, TOTAL), 'next');
  for (let n = 2; n <= TOTAL; n++) assert.equal(levelNodeState(n, 0, TOTAL), 'locked');
});
