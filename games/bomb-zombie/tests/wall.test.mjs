import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeWall, resolveGnaw, wallDamage, isDefeated } from '../src/wall.js';

test('单只僵尸满间隔啃一次', () => {
  const wall = makeWall();
  const e = { atWall: true, atk: 8, attackInterval: 1.0, atkTimer: 0 };
  let dealt = resolveGnaw(wall, [e], 0.5);   // 未满间隔
  assert.equal(dealt, 0);
  dealt = resolveGnaw(wall, [e], 0.5);       // 累计满 1.0
  assert.equal(dealt, 8);
  assert.equal(wall.hp, wall.maxHp - 8);
});

test('多只同时啃线性叠加', () => {
  const wall = makeWall();
  const mk = () => ({ atWall: true, atk: 10, attackInterval: 1.0, atkTimer: 0 });
  const dealt = resolveGnaw(wall, [mk(), mk(), mk()], 1.0);
  assert.equal(dealt, 30);
});

test('未到墙的僵尸不啃', () => {
  const wall = makeWall();
  const e = { atWall: false, atk: 8, attackInterval: 1.0, atkTimer: 0 };
  assert.equal(resolveGnaw(wall, [e], 2.0), 0);
});

test('wallDamage 一次性扣血、不为负；isDefeated', () => {
  const wall = makeWall(); wall.hp = 50;
  wallDamage(wall, 70);
  assert.equal(wall.hp, 0);
  assert.equal(isDefeated(wall), true);
});
