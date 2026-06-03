import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, buildLevel } from '../src/levels.js';
import { FIELD } from '../src/config.js';

test('there are 6 levels with non-increasing AI error (later = more accurate)', () => {
  assert.equal(LEVELS.length, 6);
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].aiError <= LEVELS[i - 1].aiError);
  }
});

test('buildLevel returns spawns within field and matching enemy count', () => {
  for (let i = 0; i < 6; i++) {
    const lv = buildLevel(i);
    assert.equal(lv.index, i);
    assert.ok(lv.spawns[0].length >= 2 && lv.spawns[1].length >= 2);
    assert.equal(lv.spawns[1].length, lv.enemyCount);
    for (const arr of [lv.spawns[0], lv.spawns[1]])
      for (const x of arr) assert.ok(x > 0 && x < FIELD.W);
    assert.ok(lv.waterY > 0 && lv.waterY <= FIELD.H);
  }
});
