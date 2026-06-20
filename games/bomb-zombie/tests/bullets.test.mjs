import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBullet, stepBullets } from '../src/bullets.js';
import { effectiveStats } from '../src/combat.js';
import { HERO } from '../src/config.js';

test('子弹命中扣血、无穿透则消失', () => {
  const stats = effectiveStats(HERO, {}, {});   // pierce 0
  const b = makeBullet(100, 300, 0, -600, stats);
  const enemy = { id: 1, x: 100, y: 290, r: 14, hp: 50, dots: [] };
  const alive = stepBullets([b], [enemy], stats, { inMods: {} }, 0.05, () => 0.9, () => {});
  assert.ok(enemy.hp < 50);
  assert.equal(alive.length, 0);                // 无穿透命中即消
});

test('穿透 N 可连续命中 N+1 个', () => {
  const stats = effectiveStats(HERO, { pierceAdd: 2 }, {});  // pierce 2
  const b = makeBullet(100, 300, 0, -600, stats);
  const enemies = [
    { id: 1, x: 100, y: 295, r: 14, hp: 5, dots: [] },
    { id: 2, x: 100, y: 290, r: 14, hp: 5, dots: [] },
    { id: 3, x: 100, y: 285, r: 14, hp: 5, dots: [] },
  ];
  const alive = stepBullets([b], enemies, stats, { inMods: {} }, 0.05, () => 0.9, () => {});
  const hitCount = enemies.filter((e) => e.hp < 5).length;
  assert.ok(hitCount >= 2);                      // 穿透命中多个
});

test('燃烧弹命中挂 DoT', () => {
  const stats = effectiveStats(HERO, {}, {});
  const b = makeBullet(100, 300, 0, -600, stats);
  const enemy = { id: 1, x: 100, y: 290, r: 14, hp: 50, dots: [] };
  stepBullets([b], [enemy], stats, { inMods: { burnDps: 6 } }, 0.05, () => 0.9, () => {});
  assert.ok(enemy.dots.length >= 1 && enemy.dots[0].dps === 6);
});
