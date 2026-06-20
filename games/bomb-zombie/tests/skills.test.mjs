import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, makeSkillState, tickCooldowns, activateSkill } from '../src/skills.js';

test('nuke 对全屏僵尸造成伤害并进入冷却', () => {
  const st = makeSkillState(['nuke']);
  const enemies = [{ id: 1, hp: 100, x: 0, y: 0, dots: [] }, { id: 2, hp: 100, x: 0, y: 0, dots: [] }];
  const ok = activateSkill(st, 'nuke', { enemies, nukeDmg: 80 });
  assert.equal(ok, true);
  assert.ok(enemies.every((e) => e.hp < 100));
  assert.equal(st.nuke.ready, false);
});

test('冷却中不能再放，cd 走完恢复', () => {
  const st = makeSkillState(['nuke']);
  activateSkill(st, 'nuke', { enemies: [], nukeDmg: 50 });
  assert.equal(activateSkill(st, 'nuke', { enemies: [], nukeDmg: 50 }), false);
  tickCooldowns(st, SKILLS.nuke.cd + 0.1);
  assert.equal(st.nuke.ready, true);
});

test('freeze 冻结全屏', () => {
  const st = makeSkillState(['freeze']);
  const enemies = [{ id: 1, hp: 10, frozen: 0 }];
  activateSkill(st, 'freeze', { enemies });
  assert.ok(enemies[0].frozen > 0);
});
