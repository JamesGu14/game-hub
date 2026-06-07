import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Save from '../src/save.js';

test('fresh load returns sane defaults', () => {
  Save.reset();
  const s = Save.load();
  assert.equal(s.version, 1);
  assert.equal(s.unlockedMax, 1);
  assert.equal(s.settings.mode, 'casual');
  assert.equal(s.konami, false);
});

test('isUnlocked respects unlockedMax', () => {
  Save.reset();
  assert.equal(Save.isUnlocked(1), true);
  assert.equal(Save.isUnlocked(2), false);
});

test('markCleared records bests and unlocks the next level', () => {
  Save.reset();
  Save.markCleared(1, { time: 50, score: 1200, stars: 3 });
  assert.equal(Save.isUnlocked(2), true);
  const info = Save.levelInfo(1);
  assert.equal(info.cleared, true);
  assert.equal(info.bestScore, 1200);
  assert.equal(info.bestStars, 3);
  assert.equal(info.bestTime, 50);
});

test('markCleared keeps the BEST (higher score/stars, lower time)', () => {
  Save.reset();
  Save.markCleared(1, { time: 60, score: 1000, stars: 2 });
  Save.markCleared(1, { time: 90, score: 800, stars: 1 }); // worse run
  const info = Save.levelInfo(1);
  assert.equal(info.bestScore, 1000);
  assert.equal(info.bestStars, 2);
  assert.equal(info.bestTime, 60); // lower time is better
});

test('mode + konami persist through save/load', () => {
  Save.reset();
  Save.setMode('classic');
  Save.setKonami(true);
  const s = Save.load();
  assert.equal(s.settings.mode, 'classic');
  assert.equal(s.konami, true);
});

test('corrupt / wrong-version data falls back to defaults without throwing', () => {
  Save._backend().setItem('jungle-warrior-save', '{not json');
  const s = Save.load();
  assert.equal(s.version, 1);
  assert.equal(s.unlockedMax, 1);
});
