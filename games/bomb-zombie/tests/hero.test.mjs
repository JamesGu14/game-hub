import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acquireTarget, fireTick } from '../src/hero.js';
import { HERO, WALL, FIELD } from '../src/config.js';
import { effectiveStats } from '../src/combat.js';

const hx = FIELD.W / 2, hy = WALL.heroY;

test('acquireTarget 锁最近活体', () => {
  const enemies = [
    { id: 1, x: hx, y: 100, hp: 10 },
    { id: 2, x: hx, y: 400, hp: 10 },  // 更近
  ];
  assert.equal(acquireTarget(enemies, hx, hy).id, 2);
});

test('死亡(hp<=0)不被锁定', () => {
  const enemies = [{ id: 1, x: hx, y: 400, hp: 0 }, { id: 2, x: hx, y: 100, hp: 5 }];
  assert.equal(acquireTarget(enemies, hx, hy).id, 2);
});

test('fireTick 满间隔产 multishot 颗子弹', () => {
  const stats = effectiveStats(HERO, { multishotAdd: 2 }, {});  // multishot=3
  const hero = { x: hx, y: hy, fireTimer: 0 };
  const enemies = [{ id: 1, x: hx, y: 300, hp: 10 }];
  let made = [];
  for (let i = 0; i < 10; i++) made = made.concat(fireTick(hero, stats, enemies, stats.fireInterval / 5));
  assert.ok(made.length >= 3 && made.length % 3 === 0);
});

test('无目标不开火', () => {
  const stats = effectiveStats(HERO, {}, {});
  const hero = { x: hx, y: hy, fireTimer: 0 };
  assert.equal(fireTick(hero, stats, [], 1.0).length, 0);
});
