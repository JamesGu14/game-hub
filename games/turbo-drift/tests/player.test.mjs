import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepPlayer } from '../src/player.js';
import { carById } from '../src/cars.js';
import { PHYSICS } from '../src/config.js';

const ctxFlat = { car: carById('lightning'), curve: 0, onRoad: true, assist: false };

test('throttle accelerates up toward car top speed', () => {
  let s = { z: 0, x: 0, speed: 0, spinTimer: 0 };
  for (let i = 0; i < 600; i++) s = stepPlayer(s, { throttle: true, steer: 0, drifting: false, nitro: 0 }, ctxFlat, 1 / 60);
  assert.ok(s.speed > PHYSICS.maxSpeed * 0.9, 'reaches near top speed');
  assert.ok(s.speed <= PHYSICS.maxSpeed * carById('lightning').top + 1, 'capped at car top');
});

test('auto-cruise: never stalls to zero even with no throttle', () => {
  let s = { z: 0, x: 0, speed: 5000, spinTimer: 0 };
  for (let i = 0; i < 600; i++) s = stepPlayer(s, { throttle: false, steer: 0, drifting: false, nitro: 0 }, ctxFlat, 1 / 60);
  assert.ok(s.speed >= PHYSICS.cruise - 1, 'settles at cruise floor, not zero');
});

test('steering moves x laterally', () => {
  let s = { z: 0, x: 0, speed: 8000, spinTimer: 0 };
  s = stepPlayer(s, { throttle: true, steer: 1, drifting: false, nitro: 0 }, ctxFlat, 0.2);
  assert.ok(s.x > 0, 'steer right increases x');
});

test('z advances by the post-step speed * dt', () => {
  let s = { z: 0, x: 0, speed: 6000, spinTimer: 0 };
  s = stepPlayer(s, { throttle: true, steer: 0, drifting: false, nitro: 0 }, ctxFlat, 0.5);
  // 半隐式欧拉：先更新速度，再 z += speed*dt；从 z=0 出发，s.z 恰等于 s.speed*dt
  assert.ok(s.z > 0, 'moved forward');
  assert.ok(Math.abs(s.z - s.speed * 0.5) < 1, 'z equals post-step speed * dt');
});

test('spin: while spinning, speed bleeds and timer counts down', () => {
  let s = { z: 0, x: 0.5, speed: 9000, spinTimer: 1.0 };
  const before = s.speed;
  s = stepPlayer(s, { throttle: true, steer: 1, drifting: false, nitro: 0 }, ctxFlat, 1 / 60);
  assert.ok(s.spinTimer < 1.0, 'spin timer counts down');
  assert.ok(s.speed < before, 'loses speed while spinning');
});

test('nitro raises effective top speed above base cap', () => {
  let s = { z: 0, x: 0, speed: PHYSICS.maxSpeed, spinTimer: 0 };
  s = stepPlayer(s, { throttle: true, steer: 0, drifting: false, nitro: 1 }, ctxFlat, 0.3);
  assert.ok(s.speed > PHYSICS.maxSpeed, 'nitro pushes past base top');
});

test('assist steer limits outward drift on a curve', () => {
  let s = { z: 0, x: 0, speed: 9000, spinTimer: 0 };
  const ctx = { car: carById('lightning'), curve: 2, onRoad: true, assist: true };
  s = stepPlayer(s, { throttle: true, steer: 0, drifting: false, nitro: 0 }, ctx, 0.3);
  assert.ok(s.x > -0.6, 'assist keeps car from being flung too far outward');
});
