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

test('稀有度权重为正、key 固定、存档 key 正确', () => {
  for (const k of ['common', 'uncommon', 'rare', 'epic']) assert.ok(CARD_RARITY[k] > 0);
  assert.ok(LANES >= 3);
  assert.equal(STORAGE_KEY, 'save_bz_v1');
});
