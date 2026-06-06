// tests/save.test.mjs — 注入式存档往返 / 损坏回退 / 通关合入
// 运行：node games/tower-defender/tests/save.test.mjs
import assert from 'node:assert';
import { defaultSave, loadSave, writeSave, applyClear } from '../src/core/save.js';

function fakeStore() {
  return { m: {}, getItem(k) { return Object.prototype.hasOwnProperty.call(this.m, k) ? this.m[k] : null; }, setItem(k, v) { this.m[k] = v; } };
}

// 空 storage → 默认
{
  const s = fakeStore();
  assert.deepEqual(loadSave(s), defaultSave(), '空 storage → 默认');
}

// 往返一致
{
  const s = fakeStore();
  const save = defaultSave(); save.unlockedLevel = 3; save.stars = { 1: 3, 2: 2 };
  writeSave(s, save);
  assert.deepEqual(loadSave(s), {
    version: 1, unlockedLevel: 3, stars: { 1: 3, 2: 2 }, settings: { muted: false, speed: 1 },
  }, '写入→读取一致');
}

// 损坏 JSON → 默认
{
  const bad = { getItem() { return '{not json'; }, setItem() {} };
  assert.deepEqual(loadSave(bad), defaultSave(), '坏 JSON → 默认');
}

// 非法 speed → 1
{
  const s = fakeStore();
  s.m['save_td_v1'] = JSON.stringify({ settings: { speed: 9 } });
  assert.equal(loadSave(s).settings.speed, 1, '非法 speed → 1');
}

// applyClear：取更高星 + 解锁推进
{
  let g = defaultSave();
  g = applyClear(g, 1, 2);
  assert.equal(g.stars[1], 2, '记录 2 星');
  assert.equal(g.unlockedLevel, 2, '解锁第 2 关');
  g = applyClear(g, 1, 1);
  assert.equal(g.stars[1], 2, '不覆盖更高星');
}

console.log('ok save');
