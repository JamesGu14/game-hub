// tests/heavy.test.mjs — 吴/魏重甲 抗物理0.6/火常规;与南蛮藤甲(怕火)区分
// 运行：node games/tower-defender/tests/heavy.test.mjs
import assert from 'node:assert';
import { calcDamage } from '../src/systems/combat/damageCalc.js';
import { ENEMIES } from '../src/data/enemies.js';
import { GENERALS } from '../src/data/generals.js';

const heavy = { resist: ENEMIES.heavy.resist };     // {physical:0.6}
const teng = { resist: ENEMIES.tengjia.resist };    // {physical:0.5, fire:1.5}
const noCrit = () => 0.99;

// 重甲:物理×0.6、火×1.0(不怕火)、谋略×1.0
assert.equal(calcDamage({ level: 1 }, GENERALS.huang, heavy, noCrit).dmg, 9 * 0.6, '物理×0.6');
assert.equal(calcDamage({ level: 1 }, GENERALS.zhuge, heavy, noCrit).dmg, 8 * 1.0, '重甲不怕火×1.0');
assert.equal(calcDamage({ level: 1 }, GENERALS.guan, heavy, noCrit).dmg, 28 * 1.0, '谋略×1.0');

// 与藤甲区分:藤甲火×1.5
assert.equal(calcDamage({ level: 1 }, GENERALS.zhuge, teng, noCrit).dmg, 8 * 1.5, '藤甲怕火×1.5');
assert.equal(calcDamage({ level: 1 }, GENERALS.huang, teng, noCrit).dmg, 9 * 0.5, '藤甲抗物理×0.5');

console.log('ok heavy');
