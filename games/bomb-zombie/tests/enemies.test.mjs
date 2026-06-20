import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnemy, laneX, stepEnemy } from '../src/enemies.js';
import { WALL, ENEMIES } from '../src/config.js';

test('makeEnemy 拷贝兵种基础属性 + 满血', () => {
  const e = makeEnemy('tank', 2, 7);
  assert.equal(e.type, 'tank');
  assert.equal(e.hp, ENEMIES.tank.hp);
  assert.equal(e.hpMax, ENEMIES.tank.hp);
  assert.equal(e.lane, 2);
  assert.equal(e.id, 7);
  assert.ok(e.y < WALL.y);          // 从顶部出生
});

test('stepEnemy 向下推进', () => {
  const e = makeEnemy('normal', 0, 1);
  const y0 = e.y;
  stepEnemy(e, 1.0);
  assert.ok(e.y > y0);
  assert.ok(Math.abs((e.y - y0) - ENEMIES.normal.speed) < 1e-6);
});

test('到达城墙即停、标记 atWall', () => {
  const e = makeEnemy('normal', 0, 1);
  e.y = WALL.y - 1;
  stepEnemy(e, 5.0);                 // 远超
  assert.equal(e.y, WALL.y);
  assert.equal(e.atWall, true);
});

test('冰冻减速（frozen>0 时移动更慢）', () => {
  const e = makeEnemy('normal', 0, 1); e.frozen = 1.0;
  const y0 = e.y; stepEnemy(e, 1.0);
  assert.ok((e.y - y0) < ENEMIES.normal.speed);   // 比正常慢
});
