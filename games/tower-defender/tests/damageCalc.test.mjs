// tests/damageCalc.test.mjs — 伤害类型×抗性矩阵 + 暴击无视护甲 + 等级缩放（§17.1/17.3）
// 运行：node games/tower-defender/tests/damageCalc.test.mjs
import assert from 'node:assert';
import { calcDamage } from '../src/systems/combat/damageCalc.js';
import { GENERALS } from '../src/data/generals.js';

const huang = GENERALS.huang;   // 物理 dmg9，招牌 baibu（暴击）
const guan = GENERALS.guan;     // 谋略 dmg10
const zhuge = GENERALS.zhuge;   // 火 dmg8
const teng = { resist: { physical: 0.5, fire: 1.5, strategy: 1.0 } };  // 南蛮藤甲
const plain = {};
const noCrit = () => 0.99, crit = () => 0;

// 抗性矩阵（L1，level<3 不触发暴击）
assert.equal(calcDamage({ level: 1 }, huang, teng, noCrit).dmg, 4.5, '物理×0.5 藤甲');
assert.equal(calcDamage({ level: 1 }, huang, plain, noCrit).dmg, 9, '无抗 ×1');
assert.equal(calcDamage({ level: 1 }, zhuge, teng, noCrit).dmg, 12, '火×1.5 藤甲(8→12)');
assert.equal(calcDamage({ level: 1 }, guan, teng, noCrit).dmg, 10, '谋略×1.0 藤甲');

// 暴击（黄忠 L3 百步穿杨）：×2.5 且无视护甲（基于 L3 基础 23.04）
const c = calcDamage({ level: 3 }, huang, teng, crit);
assert.ok(c.isCrit, '触发暴击');
assert.ok(Math.abs(c.dmg - 23.04 * 2.5) < 1e-9, '暴击=L3基础×2.5 无视护甲(57.6)');

// L3 不暴击 → 走抗性
const nc = calcDamage({ level: 3 }, huang, teng, noCrit);
assert.ok(!nc.isCrit && Math.abs(nc.dmg - 23.04 * 0.5) < 1e-9, 'L3 普通 ×0.5');

// wave 末波 dmgTakenMult：非暴击吃满减伤、暴击跳过（无视护甲同时跳减伤）
const tengHard = { resist: { physical: 0.5, fire: 1.5, strategy: 1.0 }, dmgTakenMult: 0.85 };
const ncHard = calcDamage({ level: 1 }, huang, tengHard, noCrit);
assert.ok(Math.abs(ncHard.dmg - 9 * 0.5 * 0.85) < 1e-9, '非暴击吃满减伤(4.5×0.85=3.825)');
const cHard = calcDamage({ level: 3 }, huang, tengHard, crit);
assert.ok(Math.abs(cHard.dmg - 23.04 * 2.5) < 1e-9, '暴击跳过 dmgTakenMult(仍 57.6)');

console.log('ok damageCalc');
