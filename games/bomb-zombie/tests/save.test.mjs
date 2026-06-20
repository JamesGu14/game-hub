import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, loadSave, writeSave, applyClear, isUnlocked, nextPlayableIndex } from '../src/save.js';

function fakeStore() { let m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; }

test('默认档第1关解锁', () => {
  const s = defaultSave();
  assert.equal(s.unlockedLevel, 1);
  assert.equal(isUnlocked(s, 1), true);
  assert.equal(isUnlocked(s, 2), false);
});

test('applyClear 解锁下一关 + 取更高星', () => {
  let s = defaultSave();
  s = applyClear(s, 1, 2);
  assert.equal(s.unlockedLevel, 2);
  assert.equal(s.stars[1], 2);
  s = applyClear(s, 1, 1);            // 低星不覆盖
  assert.equal(s.stars[1], 2);
});

test('写入后读回一致', () => {
  const store = fakeStore();
  let s = defaultSave(); s = applyClear(s, 1, 3);
  writeSave(store, s);
  assert.deepEqual(loadSave(store), s);
});

test('坏数据回落默认档', () => {
  const store = fakeStore(); store.setItem('save_bz_v1', '{bad json');
  assert.deepEqual(loadSave(store), defaultSave());
});

test('nextPlayableIndex 指向首个未通关', () => {
  let s = defaultSave(); s = applyClear(s, 1, 1);
  assert.equal(nextPlayableIndex(s, 10), 1);   // 关2(0-based=1)
});
