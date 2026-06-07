import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE } from '../src/config.js';
import { aabb, collideTiles, groundAhead } from '../src/physics.js';

// Helper: build a NAME grid from char rows ('#' = ground, ' ' = empty).
function grid(rows) {
  return rows.map((r) => [...r].map((ch) => (ch === '#' ? 'ground' : null)));
}

test('aabb detects overlap and gaps', () => {
  assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
  assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 0, w: 10, h: 10 }), false);
});

test('entity lands on ground and reports onGround', () => {
  // floor at row 3; entity starts in the air just above it, falling
  const g = grid(['          ', '          ', '          ', '##########']);
  const ent = { x: TILE, y: 3 * TILE - 40, w: 20, h: 30, vx: 0, vy: 0, onGround: false };
  for (let i = 0; i < 40; i++) collideTiles(ent, g, 1 / 60);
  assert.equal(ent.onGround, true);
  assert.equal(Math.round(ent.y + ent.h), 3 * TILE); // feet rest on the floor top
});

test('moving into a wall stops horizontal velocity', () => {
  // wall at col 2 (x 64..96); start one step short so a single call reaches it
  const g = grid(['  #', '  #', '  #']);
  const ent = { x: 40, y: 0, w: 20, h: 20, vx: 400, vy: 0, onGround: false };
  const info = collideTiles(ent, g, 1 / 60);
  assert.equal(info.hitWall, true);
  assert.equal(ent.vx, 0);
  assert.ok(ent.x + ent.w <= 2 * TILE + 0.001);
});

test('ceiling hit reports bumped tile and zeroes upward velocity', () => {
  const g = grid(['###', '   ', '   ']);
  const ent = { x: TILE, y: TILE + 4, w: 20, h: 20, vx: 0, vy: -600, onGround: false };
  const info = collideTiles(ent, g, 1 / 60);
  assert.equal(info.hitCeiling, true);
  assert.ok(info.bumped.length >= 1);
});

test('groundAhead is true over solid, false over a pit', () => {
  const g = grid(['   ', '#  ']); // col 0 solid at row 1, col 2 is a pit
  assert.equal(groundAhead(g, 0.5 * TILE, 1 * TILE - 2), true);
  assert.equal(groundAhead(g, 2.5 * TILE, 1 * TILE - 2), false);
});
