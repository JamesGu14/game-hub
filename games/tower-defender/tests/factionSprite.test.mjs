import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enemySprite } from '../src/render/entityRenderer.js';
import { assets, MANIFEST } from '../src/core/assets.js';
import { createEnemy } from '../src/entities/enemy.js';

// [需求①] faction 专属图优先 → 原型图 → null
test('enemySprite:faction 专属图优先,缺则回退原型图,全缺为 null', () => {
  assets.images = { enemy_footman: 'PROTO', enemy_wu_footman: 'WU' };
  assert.equal(enemySprite({ type: 'footman', faction: 'wu' }), 'WU', 'wu 有专属取专属');
  assert.equal(enemySprite({ type: 'footman', faction: 'wei' }), 'PROTO', 'wei 无专属回退原型');
  assert.equal(enemySprite({ type: 'footman', faction: null }), 'PROTO', '无 faction 用原型');
  assert.equal(enemySprite({ type: 'cavalry', faction: 'wu' }), null, '全缺 → null(色块回退)');
});

// [需求①] createEnemy 把 faction 写到实体(供渲染选图)
test('createEnemy 携带 faction 字段', () => {
  const p = [{ x: 0, y: 0 }];
  assert.equal(createEnemy('footman', 'a', p, 1, { faction: 'wei' }).faction, 'wei');
  assert.equal(createEnemy('footman', 'a', p, 1).faction, null, '无 opts → null');
});

// [需求①②] 专属图 + 骑兵图入 MANIFEST
test('faction 专属敌兵图入 MANIFEST', () => {
  for (const k of ['enemy_wu_footman', 'enemy_wei_footman', 'enemy_wu_cavalry', 'enemy_wei_cavalry']) {
    assert.ok(MANIFEST[k], `${k} 应在 MANIFEST`);
  }
});
