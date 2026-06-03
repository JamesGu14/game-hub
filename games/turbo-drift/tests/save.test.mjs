import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultSave, loadSave, writeSave, applyResult } from '../src/save.js';

function memStorage(init) {
  const m = new Map(init ? [['turbo-drift.save', JSON.stringify(init)]] : []);
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), _m: m };
}

test('defaultSave has only lightning unlocked', () => {
  const s = defaultSave();
  assert.deepEqual(s.unlocked, ['lightning']);
  assert.deepEqual(s.bestLap, {});
  assert.equal(s.lastCar, 'lightning');
});

test('loadSave returns default when storage empty', () => {
  assert.deepEqual(loadSave(memStorage()).unlocked, ['lightning']);
});

test('loadSave recovers from corrupt JSON', () => {
  const st = { getItem: () => '{bad json', setItem: () => {} };
  assert.deepEqual(loadSave(st).unlocked, ['lightning']);
});

test('applyResult: top-3 adds car, records best lap, no dupes', () => {
  let s = defaultSave();
  s = applyResult(s, 'track1', 1, 41200);
  assert.ok(s.unlocked.includes('blaze'));
  assert.equal(s.bestLap.track1, 41200);
  s = applyResult(s, 'track1', 4, 50000); // 慢且第4 → bestLap 不退步、不重复加车
  assert.equal(s.bestLap.track1, 41200);
  assert.equal(s.unlocked.filter(x => x === 'blaze').length, 1);
  s = applyResult(s, 'track1', 2, 39000); // 更快 → 更新 bestLap
  assert.equal(s.bestLap.track1, 39000);
});

test('writeSave persists JSON to storage', () => {
  const st = memStorage();
  writeSave(st, defaultSave());
  assert.ok(st.getItem('turbo-drift.save').includes('lightning'));
});
