import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, expForLevel, levelParams, totalEnemies } from '../src/levels.js';

test('第1章共10关，末关为Boss关', () => {
  assert.equal(LEVELS.length, 10);
  assert.ok(LEVELS[9].boss, '第10关须为Boss关');
  for (const lv of LEVELS) { assert.ok(Array.isArray(lv.waves) && lv.waves.length >= 1); assert.ok(lv.name); }
});

test('每关 wave 结构合法（type/count/interval）', () => {
  for (const lv of LEVELS) {
    for (const w of lv.waves) {
      assert.ok(Array.isArray(w.enemies));
      for (const g of w.enemies) {
        assert.ok(typeof g.type === 'string' && g.count > 0 && g.interval > 0);
      }
    }
  }
});

test('经验曲线随等级递增', () => {
  assert.ok(expForLevel(2) > expForLevel(1));
  assert.ok(expForLevel(10) > expForLevel(5));
});

test('难度随关号单调递增（怪量或血量）', () => {
  assert.ok(levelParams(5).hpScale >= levelParams(1).hpScale);
  assert.ok(totalEnemies(LEVELS[8]) >= totalEnemies(LEVELS[0]));
});
