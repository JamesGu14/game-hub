import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rubberMul, aiTargetX, stepAI } from '../src/ai.js';
import { AI } from '../src/config.js';
import { carById } from '../src/cars.js';

test('rubberMul = 1 inside dead zone', () => {
  assert.equal(rubberMul(10000, 10000 + AI.rubberDeadZone - 1, AI), 1);
});

test('player far behind => leading AI eases (mul < 1)', () => {
  const mul = rubberMul(30000, 10000, AI); // AI 远在玩家前
  assert.ok(mul < 1 && mul >= AI.rubberAheadEase - 1e-9);
});

test('player far ahead => trailing AI boosts (mul > 1)', () => {
  const mul = rubberMul(10000, 30000, AI);
  assert.ok(mul > 1 && mul <= AI.rubberBehindBoost + 1e-9);
});

test('aiTargetX steers into the curve (apex), bounded', () => {
  assert.ok(aiTargetX(2) > 0, 'right curve → positive target');
  assert.ok(aiTargetX(-2) < 0, 'left curve → negative target');
  assert.ok(Math.abs(aiTargetX(99)) <= 1, 'bounded within road');
});

test('stepAI advances z forward and eases x toward apex', () => {
  let s = { z: 0, x: -1, speed: 6000, spinTimer: 0 };
  const ctx = { car: carById('gust'), curve: 2, playerProgress: 0, aiProgress: 0, onRoad: true };
  const before = s.x;
  s = stepAI(s, ctx, 1 / 60);
  assert.ok(s.z > 0, 'moved forward');
  assert.ok(s.x > before, 'x eased toward positive apex');
});
