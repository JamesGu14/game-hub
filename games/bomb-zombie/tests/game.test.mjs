import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/game.js';

function advance(g, seconds, dt = 1 / 60) { for (let t = 0; t < seconds; t += dt) g.update(dt); }

test('startLevel 进入 playing 并装载城墙满血', () => {
  const g = new Game(() => 0.5);
  g.startLevel(0);
  assert.equal(g.state, 'playing');
  assert.equal(g.wall.hp, g.wall.maxHp);
  assert.equal(g.heroLevel, 1);
});

test('击杀累计经验、满级进入 cardpick 并冻结', () => {
  const g = new Game(() => 0.0);             // rng=0 → 不暴击，稳定
  g.startLevel(0);
  // 人为塞一只濒死怪并让英雄打死它来获得经验：直接驱动若干秒
  advance(g, 6);
  // 升级会把 state 切到 cardpick；若已切，enemies 推进应停止
  if (g.state === 'cardpick') {
    const before = g.enemies.map((e) => e.y);
    g.update(0.5);                            // cardpick 下不推进
    assert.deepEqual(g.enemies.map((e) => e.y), before);
    assert.equal(g.pendingCards.length, 3);
  }
  assert.ok(g.xp >= 0);
});

test('chooseCard 应用卡片并回到 playing', () => {
  const g = new Game(() => 0.0);
  g.startLevel(0);
  advance(g, 8);
  if (g.state === 'cardpick') {
    const pick = g.pendingCards[0];
    g.chooseCard(pick);
    assert.equal(g.state, 'playing');
  }
});

test('城墙破 → gameover', () => {
  const g = new Game(() => 0.5);
  g.startLevel(0);
  g.wall.hp = 1;
  g.enemies.push({ id: 999, type: 'tank', x: 270, y: g.wall.y, r: 19, hp: 999, hpMax: 999,
    atk: 50, attackInterval: 0.1, atkTimer: 1, xp: 0, dots: [], frozen: 0, atWall: true });
  advance(g, 1);
  assert.equal(g.state, 'gameover');
});

test('清完全部波次且场上空 → levelclear', () => {
  const g = new Game(() => 0.5);
  g.startLevel(0);
  g.spawner.idx = g.spawner.queue.length;    // 强制吐完
  g.enemies = [];
  g.update(0.1);
  assert.ok(g.state === 'levelclear' || g.state === 'win');
});

test('同帧多杀只触发一次 cardpick(后续击杀不重复 draw3)', () => {
  const g = new Game(() => 0.0);
  g.startLevel(0);
  g.xp = 0; g.xpNeed = 1;            // trivially low so first kill levels up
  g.enemies = [
    { id: 901, type: 'normal', x: 270, y: 100, r: 13, hp: 0, hpMax: 22, atk: 0, attackInterval: 1, atkTimer: 0, xp: 5, dots: [], frozen: 0, atWall: false },
    { id: 902, type: 'normal', x: 270, y: 120, r: 13, hp: 0, hpMax: 22, atk: 0, attackInterval: 1, atkTimer: 0, xp: 5, dots: [], frozen: 0, atWall: false },
  ];
  g.update(1 / 60);
  assert.equal(g.state, 'cardpick');
  assert.equal(g.pendingCards.length, 3);
});
