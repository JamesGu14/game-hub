import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorm, makeTeam } from '../src/worm.js';
import { stepWorm } from '../src/physics.js';
import { createMask, fillRect } from '../src/terrain.js';

test('makeWorm / makeTeam defaults', () => {
  const w = makeWorm(7, 0, 100, 50);
  assert.equal(w.hp, 100);
  assert.equal(w.alive, true);
  const t = makeTeam(0, '红队', '#f00', false, [w]);
  assert.equal(t.worms.length, 1);
  assert.equal(t.isAI, false);
});

test('stepWorm: falls under gravity and rests on solid ground', () => {
  const m = createMask(200, 200);
  fillRect(m, 0, 150, 200, 50);        // ground at y=150
  const w = makeWorm(1, 0, 100, 50);
  for (let i = 0; i < 240; i++) stepWorm(w, 1 / 60, m, { waterY: 512, moveX: 0, wantJump: false });
  assert.ok(w.onGround);
  assert.ok(Math.abs((w.y + 15) - 150) < 3); // feet (~y+halfH) rest near ground top
});

test('stepWorm: below waterY marks not-alive (drowned)', () => {
  const m = createMask(200, 600);
  const w = makeWorm(1, 0, 100, 400);
  for (let i = 0; i < 600; i++) stepWorm(w, 1 / 60, m, { waterY: 512, moveX: 0, wantJump: false });
  assert.equal(w.alive, false);
});

test('stepWorm accepts a reserved hazards option without changing behavior (§11.13)', () => {
  // 空 mask（全 0）→ 无实体，worm 自由下落；对比有无 hazards:[] 两次步进结果一致。
  const mask = { w: 400, h: 400, cells: new Uint8Array(400 * 400) };
  const mk = () => ({ alive: true, hp: 100, x: 100, y: 100, vx: 0, vy: 0, facing: 1, onGround: false });
  const a = mk();
  const b = mk();
  stepWorm(a, 0.016, mask, { waterY: 9999, moveX: 1 });
  stepWorm(b, 0.016, mask, { waterY: 9999, moveX: 1, hazards: [] });
  assert.equal(a.x, b.x);
  assert.equal(a.y, b.y);
  assert.equal(a.vx, b.vx);
  assert.equal(a.vy, b.vy);
});
