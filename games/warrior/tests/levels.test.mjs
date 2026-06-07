import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE, SOLID } from '../src/config.js';
import { LEVELS, parseLevel } from '../src/levels.js';

test('there is at least one level (L1)', () => {
  assert.ok(LEVELS.length >= 1);
  assert.equal(LEVELS[0].theme, 'forest');
});

test('parseLevel produces a NAME grid, dimensions, spawn, goal and enemies', () => {
  const lv = parseLevel(LEVELS[0]);
  assert.ok(Array.isArray(lv.grid) && Array.isArray(lv.grid[0]));
  assert.equal(lv.width, lv.cols * TILE);
  assert.equal(lv.height, lv.rows * TILE);
  assert.ok(lv.spawn && typeof lv.spawn.x === 'number');
  assert.ok(typeof lv.goalX === 'number' && lv.goalX > lv.spawn.x, 'goal is to the right of spawn');
  assert.ok(lv.enemies.length >= 2, 'has Runner + Jumper grunts');
  // entity markers must NOT remain in the collision grid
  for (const row of lv.grid) for (const cell of row) {
    if (cell !== null) assert.ok(SOLID.has(cell), `grid cell is a tile name, got ${cell}`);
  }
});

test('the spawn column has solid ground beneath it (no instant pit death)', () => {
  const lv = parseLevel(LEVELS[0]);
  const col = Math.floor(lv.spawn.x / TILE);
  let groundBelow = false;
  for (let r = Math.floor(lv.spawn.y / TILE); r < lv.rows; r++) {
    if (lv.grid[r] && lv.grid[r][col] && SOLID.has(lv.grid[r][col])) { groundBelow = true; break; }
  }
  assert.equal(groundBelow, true);
});

test('both grunt types are present', () => {
  const lv = parseLevel(LEVELS[0]);
  const types = new Set(lv.enemies.map((e) => e.type));
  assert.ok(types.has('runner'));
  assert.ok(types.has('jumper'));
});

test('L1 has falcon drops and a boss trigger before the goal', () => {
  const lv = parseLevel(LEVELS[0]);
  assert.ok(Array.isArray(lv.falcons) && lv.falcons.length >= 1, 'has falcon drops');
  assert.ok(lv.falcons.some((f) => ['M', 'S', 'L', 'B'].includes(f.drop)));
  assert.equal(typeof lv.bossX, 'number');
  assert.ok(lv.bossX < lv.goalX, 'boss is before the goal flag');
  assert.equal(lv.bossType, 'ironGate');
});

test('the boss arena column is solid ground (boss can stand)', () => {
  const lv = parseLevel(LEVELS[0]);
  const col = Math.floor((lv.bossX + 2 * TILE) / TILE);
  let solid = false;
  for (let r = 0; r < lv.rows; r++) if (lv.grid[r] && lv.grid[r][col] && SOLID.has(lv.grid[r][col])) { solid = true; break; }
  assert.equal(solid, true, 'boss column has ground');
});

test('parseLevel exposes a difficulty triple', () => {
  const lv = parseLevel(LEVELS[0]);
  assert.equal(typeof lv.difficulty.enemyMul, 'number');
  assert.equal(typeof lv.difficulty.fireRateMul, 'number');
  assert.equal(typeof lv.difficulty.bossHpMul, 'number');
});
