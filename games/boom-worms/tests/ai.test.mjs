import { test } from 'node:test';
import assert from 'node:assert/strict';
import { solveAim, jitterAim } from '../src/ai.js';
import { simulate } from '../src/util/trajectory.js';
import { dist } from '../src/util/math.js';

const G = 480;

test('solveAim produces a shot landing within 24px of target (no wind)', () => {
  const sx = 100, sy = 300, tx = 600, ty = 320;
  const sol = solveAim(sx, sy, tx, ty, G, 180, 720);
  assert.ok(sol, 'expected a solution');
  const v = { x: Math.cos(sol.angle) * sol.speed, y: Math.sin(sol.angle) * sol.speed };
  const r = simulate({ x: sx, y: sy }, v,
    { gravity: G, wind: 0, dt: 1 / 120, maxSteps: 4000 },
    (x, y) => x >= tx); // stop when reached target column
  assert.ok(dist(r.last.x, r.last.y, tx, ty) < 24);
});

test('jitterAim with errLevel 0 returns the same solution; nonzero error shifts angle', () => {
  const base = { angle: -0.6, speed: 500 };
  const none = jitterAim(base, 0, () => 0.5);
  assert.equal(none.angle, base.angle);
  assert.equal(none.speed, base.speed);
  const noisy = jitterAim(base, 0.3, () => 0.0); // rng=0 => max negative offset
  assert.ok(Math.abs(noisy.angle - base.angle) > 0);
});
