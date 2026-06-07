import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';
import { Input } from '../src/input.js';
import { TILE } from '../src/config.js';
import * as Save from '../src/save.js';

function freshGame() {
  Save.reset();
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

test('reaching the goal clears the level (no-boss path)', () => {
  const g = freshGame();
  g.level.bossX = null; // exercise the plain goal path
  g.player.x = g.level.goalX + 5;
  g.update(1 / 60);
  assert.equal(g.state, 'clear');
});

test('reaching bossX spawns the boss instead of clearing', () => {
  const g = freshGame();
  g.level.bossX = g.player.x + 40;
  g.level.goalX = 1e9; // ensure goal does not pre-empt
  g.player.x = g.level.bossX + 5;
  g.update(1 / 60);
  assert.ok(g.boss, 'boss spawned');
  assert.equal(g.state, 'playing');
});

test('clearing requires the boss to die', () => {
  const g = freshGame();
  g.level.bossX = g.player.x; g.level.goalX = 1e9;
  g.update(1 / 60);              // spawns boss
  assert.equal(g.state, 'playing');
  g.boss.hit(1e9, g._world);     // kill it
  for (let i = 0; i < 180 && g.state !== 'clear'; i++) g.update(1 / 60);
  assert.equal(g.state, 'clear');
});

test('a kill starts a combo and a second quick kill raises the multiplier', () => {
  const g = freshGame();
  g.registerKill(100);
  assert.equal(g.combo.count, 1);
  g.registerKill(100);
  assert.equal(g.combo.count, 2);
  assert.ok(g.combo.mult >= 2);
});

test('clearing a level records progress + stars (clear screen) and unlocks next', () => {
  const g = freshGame();
  g._elapsed = 40; // a fast run
  g._levelClear();
  assert.equal(g.state, 'clear');
  assert.equal(Save.isUnlocked(2), true);
  assert.ok(Save.levelInfo(1).bestStars >= 1);
  // confirm from the clear screen returns to select
  g.confirm();
  assert.equal(g.state, 'select');
});

test('selecting a locked level is refused; an unlocked one starts', () => {
  Save.reset();
  const g = new Game();
  g.goSelect();
  assert.equal(g.selectLevel(0), true);   // L1 (id 1) unlocked
  const g2 = new Game(); g2.goSelect();
  assert.equal(g2.selectLevel(1), false);  // L2 (id 2) locked
});

test('classic Game Over after lives run out; continue replays keeping unlocks', () => {
  Save.reset();
  const g = new Game(); g.setMode('classic'); g.startLevel(0); g._startPlaying();
  g.lives = 1;
  g.player.startDeath(g._world); g.player.y = g.level.height + 200;
  for (let i = 0; i < 30; i++) g.update(1 / 60);
  assert.equal(g.state, 'gameover');
  g.continueRun();
  assert.equal(g.state, 'ready');
});

test('konami unlock grants 30 lives in classic and sets the saved flag', () => {
  Save.reset();
  const g = new Game(); g.setMode('classic');
  g.onKonami();
  assert.equal(g.lives, 30);
  assert.equal(Save.getKonami(), true);
});

test('a hostile enemy bullet costs the player 1 HP (no crash, still playing)', () => {
  const g = freshGame();
  const p = g.player; p.invuln = 0; p.barrier = 0;
  const hp0 = p.hp;
  g._world.spawnEnemyBullet({ x: p.x + 2, y: p.y + 4, vx: 0, vy: 0, dmg: 1, life: 2 });
  g.update(1 / 60); // overlaps the player -> registers the hit
  assert.ok(p.hp < hp0 || p.dying > 0, 'hostile bullet cost HP');
  for (let i = 0; i < 60; i++) g.update(1 / 60);
  assert.equal(g.state, 'playing');
});
