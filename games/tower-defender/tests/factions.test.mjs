// tests/factions.test.mjs — 三势力换皮（仅覆盖 name/color；未列项回退）
// 运行：node games/tower-defender/tests/factions.test.mjs
import assert from 'node:assert';
import { skinOf, tintOf, FACTIONS } from '../src/data/factions.js';
import { createEnemy } from '../src/entities/enemy.js';

// 换皮覆盖
assert.equal(skinOf('wei', 'footman').name, '魏卒');
assert.equal(skinOf('wu', 'wolf').name, '江东轻骑');
assert.equal(skinOf('nanman', 'footman').name, '蛮兵');

// 未列项 / 未知势力 → null（工厂回退 prototype 默认）
assert.equal(skinOf('nanman', 'flyer'), null, '南蛮无飞兵皮');
assert.equal(skinOf('unknown', 'footman'), null, '未知势力');

// createEnemy 套皮
const p = [{ x: 0, y: 0 }];
const wei = createEnemy('footman', 'a', p, 1, { faction: 'wei' });
assert.equal(wei.name, '魏卒'); assert.equal(wei.color, FACTIONS.wei.skin.footman.color);
const plain = createEnemy('footman', 'a', p, 1);
assert.equal(plain.name, '步卒', '无 faction → 原型默认名');

// tint 回退
assert.ok(tintOf('nanman').grassA && tintOf('unknown').grassA, 'tint 存在/回退');

console.log('ok factions');
