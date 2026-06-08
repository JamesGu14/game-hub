// tests/resume.test.mjs — 中断续玩快照 写/读/清（注入假 storage，§5.4）
// 运行：node games/tower-defender/tests/resume.test.mjs
import assert from 'node:assert';
import { resumeSnapshot, writeResume, loadResume, clearResume } from '../src/core/save.js';

function fakeStore() {
  return {
    m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this.m, k) ? this.m[k] : null; },
    setItem(k, v) { this.m[k] = v; },
    removeItem(k) { delete this.m[k]; },
  };
}

// resumeSnapshot：从 state 抽快照（纯函数）
{
  const state = {
    level: { id: 7 }, waveIndex: 3, gold: 250, castleHp: 14, phase: 'combat', prepTimer: 0,
    towers: [{ generalId: 'huang', slot: { x: 6, y: 10 }, level: 4, mode: 'last', cooldown: 9 }],
  };
  const snap = resumeSnapshot(state);
  assert.equal(snap.levelId, 7); assert.equal(snap.waveIndex, 3);
  assert.equal(snap.gold, 250); assert.equal(snap.castleHp, 14);
  assert.equal(snap.seed, 7, 'seed = levelId');
  assert.equal(snap.towers.length, 1);
  assert.deepEqual(snap.towers[0], { generalId: 'huang', slot: { x: 6, y: 10 }, level: 4, mode: 'last' }, '塔只存 generalId/slot/level/mode');
}

// 写 → 读往返一致
{
  const s = fakeStore();
  const snap = { levelId: 7, waveIndex: 3, gold: 250, castleHp: 14, phase: 'combat', prepTimer: 0, towers: [], seed: 7 };
  writeResume(s, snap);
  assert.deepEqual(loadResume(s), snap, '续玩往返一致');
}

// 无记录 → null
{
  assert.equal(loadResume(fakeStore()), null, '无续玩记录 → null');
}

// 坏 JSON → null（不抛）
{
  const bad = { getItem() { return '{not json'; }, setItem() {}, removeItem() {} };
  assert.equal(loadResume(bad), null, '坏 JSON → null');
}

// 清除
{
  const s = fakeStore();
  writeResume(s, { levelId: 1, waveIndex: 0, gold: 0, castleHp: 20, phase: 'prep', prepTimer: 30, towers: [], seed: 1 });
  clearResume(s);
  assert.equal(loadResume(s), null, '清除后 → null');
}

console.log('ok resume');
