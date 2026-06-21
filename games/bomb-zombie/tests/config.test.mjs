import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD, WALL, HERO, ENEMIES, CARD_RARITY, LANES, STORAGE_KEY } from '../src/config.js';

test('竖屏尺寸 + 城墙在角色上方', () => {
  assert.ok(FIELD.H > FIELD.W);                 // 竖屏
  assert.ok(WALL.y < WALL.heroY);               // 墙在角色上方(y更小)
  assert.ok(WALL.maxHp > 0);
});

test('英雄基础面板字段齐全且为正', () => {
  for (const k of ['damage', 'fireInterval', 'bulletSpeed', 'pierce', 'multishot', 'critRate', 'critMult', 'splash']) {
    assert.ok(typeof HERO[k] === 'number', `HERO.${k} 必须存在`);
  }
  assert.ok(HERO.fireInterval > 0 && HERO.multishot >= 1);
});

test('七种僵尸齐全且字段完整', () => {
  for (const t of ['normal', 'fast', 'tank', 'exploder', 'shielded', 'spitter', 'summoner']) {
    const e = ENEMIES[t];
    assert.ok(e, `缺兵种 ${t}`);
    for (const k of ['hp', 'speed', 'atk', 'attackInterval', 'xp', 'r']) {
      assert.ok(typeof e[k] === 'number', `${t}.${k} 缺失`);
    }
  }
});

test('开局基础枪打普通僵尸需 3-5 枪(不一枪秒,留挑战)', () => {
  const shots = Math.ceil(ENEMIES.normal.hp / HERO.damage);   // 局外0、无卡时的开局体感
  assert.ok(shots >= 3 && shots <= 5, `开局打死普通僵尸需 ${shots} 枪，目标 3-5 枪`);
});

test('稀有度权重为正、key 固定、存档 key 正确', () => {
  for (const k of ['common', 'uncommon', 'rare', 'epic']) assert.ok(CARD_RARITY[k] > 0);
  assert.ok(LANES >= 3);
  assert.equal(STORAGE_KEY, 'save_bz_v1');
});
