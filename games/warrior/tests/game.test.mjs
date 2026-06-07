import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Input } from '../src/input.js';
import { TILE } from '../src/config.js';

function freshGame() {
  const g = new Game();
  g.startLevel(0);   // skip the title; go straight into L1
  g._startPlaying(); // ready -> playing
  // neutral intent
  Input.intent = { moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false };
  return g;
}

test('game boots into casual mode with L1 loaded and a player', () => {
  const g = freshGame();
  assert.equal(g.mode.id, 'casual');
  assert.equal(g.level.id, 'L1');
  assert.ok(g.player);
  assert.equal(g.state, 'playing');
});

test('holding right moves the player and the camera follows', () => {
  const g = freshGame();
  const x0 = g.player.x;
  Input.intent.moveX = 1;
  for (let i = 0; i < 120; i++) g.update(1 / 60);
  assert.ok(g.player.x > x0 + TILE, 'player advanced');
  assert.ok(g.camera.x > 0, 'camera scrolled');
});

test('a fired bullet can kill a nearby grunt (score increases)', () => {
  const g = freshGame();
  // place a runner just to the player's right, at the player's height
  const p = g.player;
  g.enemies.length = 0;
  g.spawnEnemy('runner', p.x + 60, p.y);
  g.enemies[0].y = p.y; g.enemies[0].vx = 0; // hold still in front
  Input.intent.fireHeld = true; p.faceRight = true;
  const s0 = g.score;
  for (let i = 0; i < 120 && g.score === s0; i++) g.update(1 / 60);
  assert.ok(g.score > s0, 'killing a grunt raised the score');
});

test('casual death respawns the player and keeps playing (infinite lives)', () => {
  const g = freshGame();
  const before = g.deaths;
  g.player.startDeath(g._world);
  // fall below the level to trigger the dead handler
  g.player.y = g.level.height + 200;
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  assert.equal(g.state, 'playing', 'still playing after casual death');
  assert.equal(g.deaths, before + 1);
  assert.ok(g.player.invuln > 0, 'respawn grants i-frames');
  assert.ok(g.player.y < g.level.height, 'player is back on the field');
});

test('reaching the goal clears the level', () => {
  const g = freshGame();
  g.player.x = g.level.goalX + 5;
  g.update(1 / 60);
  assert.equal(g.state, 'clear');
});
