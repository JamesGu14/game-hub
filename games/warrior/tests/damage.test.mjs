import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Input } from '../src/input.js';

function game(modeId) {
  const g = new Game();
  g.setMode(modeId);
  g.startLevel(0);
  g._startPlaying();
  Input.intent = { moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false };
  return g;
}

test('casual: death keeps infinite lives and respawns', () => {
  const g = game('casual');
  g.player.startDeath(g._world);
  g.player.y = g.level.height + 200;
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  assert.equal(g.state, 'playing');
  assert.equal(g.lives, Infinity);
});

test('classic: death decrements lives and drops the weapon to rifle', () => {
  const g = game('classic');
  g.player.weapon = 'laser';
  const lives0 = g.lives;
  g.player.startDeath(g._world);
  g.player.y = g.level.height + 200;
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  assert.equal(g.lives, lives0 - 1);
  assert.equal(g.player.weapon, 'rifle', 'classic drops weapon on death');
  assert.equal(g.state, 'playing');
});

test('barrier blocks contact AND instakills the touched enemy', () => {
  const g = game('casual');
  const p = g.player;
  p.giveBarrier();
  g.enemies.length = 0;                 // isolate: clear the level's grunts
  g.spawnEnemy('runner', p.x, p.y);
  g.enemies[0].x = p.x; g.enemies[0].y = p.y;
  const deaths0 = g.deaths;
  g.update(1 / 60);
  assert.equal(g.deaths, deaths0, 'no player death while barrier up');
  assert.equal(g.enemies.length, 0, 'barrier instakilled the enemy');
});
