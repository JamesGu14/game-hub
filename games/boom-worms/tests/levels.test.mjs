import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildLevel } from '../src/levels.js';
import { FIELD } from '../src/config.js';

const VALID_OBJECTIVES = ['eliminate', 'timed', 'capture', 'decapitate'];

test('there are 15 levels', () => {
  assert.equal(LEVELS.length, 15);
});

test('aiError is monotonic non-increasing (later levels = sharper AI)', () => {
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].aiError <= LEVELS[i - 1].aiError,
      `level ${i + 1} aiError ${LEVELS[i].aiError} > level ${i} ${LEVELS[i - 1].aiError}`);
  }
});

test('aiError spans the full difficulty ramp (≈0.9 → ≈0.08)', () => {
  assert.ok(LEVELS[0].aiError >= 0.85, 'first level should be very forgiving');
  assert.ok(LEVELS[LEVELS.length - 1].aiError <= 0.12, 'last level should be sharp');
});

test('every level has a complete 6-hex palette', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const p = LEVELS[i].palette;
    for (const k of ['sky', 'land', 'land2', 'water']) {
      assert.ok(typeof p[k] === 'string' && /^#[0-9a-fA-F]{6}$/.test(p[k]),
        `level ${i + 1} palette.${k} invalid: ${p[k]}`);
    }
  }
});

test('every level has a unique theme', () => {
  const themes = LEVELS.map((l) => l.theme);
  assert.equal(new Set(themes).size, themes.length, 'theme names must be unique');
});

test('every level has valid terrainParams (ruggedness 0..1, peaks ≥ 1, counts ≥ 0)', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const tp = LEVELS[i].terrainParams;
    assert.ok(tp.ruggedness >= 0 && tp.ruggedness <= 1, `level ${i + 1} ruggedness`);
    assert.ok(Number.isInteger(tp.peaks) && tp.peaks >= 1, `level ${i + 1} peaks`);
    for (const k of ['platforms', 'caves', 'floors']) {
      assert.ok(Number.isInteger(tp[k]) && tp[k] >= 0, `level ${i + 1} ${k}`);
    }
  }
});

test('every level has a structurally valid objective and a hazards bag', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const o = LEVELS[i].objective;
    assert.ok(o && VALID_OBJECTIVES.includes(o.type), `level ${i + 1} objective.type invalid`);
    assert.ok(LEVELS[i].hazards && typeof LEVELS[i].hazards === 'object' && !Array.isArray(LEVELS[i].hazards),
      `level ${i + 1} hazards must be a plain object`);
  }
});

test('enemyCount is sane and the campaign gets more crowded', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].enemyCount >= 2 && LEVELS[i].enemyCount <= 6, `level ${i + 1} enemyCount`);
    assert.ok(LEVELS[i].playerCount >= 2, `level ${i + 1} playerCount`);
  }
  assert.ok(LEVELS[LEVELS.length - 1].enemyCount >= LEVELS[0].enemyCount);
});

test('buildLevel resolves spawns in-field, matching counts, and forwards data', () => {
  for (let i = 0; i < LEVELS.length; i++) {
    const lv = buildLevel(i);
    assert.equal(lv.index, i);
    assert.equal(lv.spawns[0].length, lv.playerCount, `level ${i + 1} player spawns`);
    assert.equal(lv.spawns[1].length, lv.enemyCount, `level ${i + 1} enemy spawns`);
    for (const arr of [lv.spawns[0], lv.spawns[1]])
      for (const x of arr) assert.ok(x > 0 && x < FIELD.W, `level ${i + 1} spawn x ${x} out of field`);
    assert.ok(lv.waterY > 0 && lv.waterY <= FIELD.H);
    // objective + hazards forwarded for M2/M3
    assert.deepEqual(lv.objective, LEVELS[i].objective);
    assert.deepEqual(lv.hazards, LEVELS[i].hazards);
    // terrainParams passed through by reference (terrain.generate reads them)
    assert.equal(lv.terrainParams, LEVELS[i].terrainParams);
  }
});

test('final level is at least as rugged as the first (rising challenge)', () => {
  assert.ok(LEVELS[LEVELS.length - 1].terrainParams.ruggedness >= LEVELS[0].terrainParams.ruggedness);
});
