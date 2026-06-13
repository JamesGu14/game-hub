import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';

test('cavalry 原型数值正确', () => {
  const c = ENEMIES.cavalry;
  assert.ok(c, 'cavalry 原型应存在');
  assert.equal(c.id, 'cavalry');
  assert.equal(c.name, '骑兵');
  assert.equal(c.hp, 120);
  assert.equal(c.speed, 0.9);
  assert.equal(c.gold, 10);
  assert.equal(c.castleDmg, 2);
  assert.equal(c.flying, false);
  assert.equal(c.resist, undefined, 'cavalry 无抗性(靠血厚+冲速)');
});
