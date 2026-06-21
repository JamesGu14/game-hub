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

test('经验曲线严格递增(无平台)且升级越来越贵', () => {
  // 逐级严格递增——抓「平台」(如旧 base=3 时 exp(2)=exp(3)=4 的双升级)
  for (let n = 1; n < 30; n++) {
    assert.ok(expForLevel(n + 1) > expForLevel(n),
      `expForLevel(${n + 1})=${expForLevel(n + 1)} 必须 > expForLevel(${n})=${expForLevel(n)}（不能有平台）`);
  }
  // 凸增长：后段单级增量 ≥ 前段，体感「越升越慢」
  assert.ok(expForLevel(10) - expForLevel(9) >= expForLevel(3) - expForLevel(2));
  // 首级不能太廉价（至少一只普通僵尸击杀量级，normal.xp=6），否则「一杀即升」
  assert.ok(expForLevel(1) >= 6, `首级经验 ${expForLevel(1)} 太低，一杀即升`);
});

test('难度随关号单调递增（怪量或血量）', () => {
  assert.ok(levelParams(5).hpScale >= levelParams(1).hpScale);
  assert.ok(totalEnemies(LEVELS[8]) >= totalEnemies(LEVELS[0]));
});
