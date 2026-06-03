// tests/classTriangle.test.mjs — 兵种相克系数（纯函数，Node 直跑）
// 运行：node games/caocao-zhuan/tests/classTriangle.test.mjs
import assert from 'node:assert';
import { triangleMul } from '../src/battle/classTriangle.js';

// 枪克骑 1.5；骑反被枪克 0.7
assert.strictEqual(triangleMul('spear', 'cavalry'), 1.5, 'spear>cavalry=1.5');
assert.strictEqual(triangleMul('cavalry', 'spear'), 0.7, 'cavalry<spear=0.7');

// 骑克弓 1.4、骑克步 1.3
assert.strictEqual(triangleMul('cavalry', 'archer'), 1.4, 'cavalry>archer=1.4');
assert.strictEqual(triangleMul('cavalry', 'infantry'), 1.3, 'cavalry>infantry=1.3');

// 弓克步 1.3、弓反被骑克 0.8
assert.strictEqual(triangleMul('archer', 'infantry'), 1.3, 'archer>infantry=1.3');
assert.strictEqual(triangleMul('archer', 'cavalry'), 0.8, 'archer<cavalry=0.8');

// 谋士作守方被任意物理 1.2（脆）
assert.strictEqual(triangleMul('infantry', 'strategist'), 1.2, 'vs strategist=1.2');
assert.strictEqual(triangleMul('cavalry', 'strategist'), 1.2, 'cavalry vs strategist=1.2');

// strategist 优先级：作攻方对其他无特殊关系时 1.0
assert.strictEqual(triangleMul('strategist', 'infantry'), 1.0, 'strategist>infantry=1.0');

// 其余 = 1.0
assert.strictEqual(triangleMul('infantry', 'infantry'), 1.0, 'infantry vs infantry=1.0');
assert.strictEqual(triangleMul('spear', 'archer'), 1.0, 'spear vs archer=1.0');
assert.strictEqual(triangleMul('leader', 'cavalry'), 1.0, 'leader vs cavalry=1.0');

// 未知 classId 安全回退 1.0
assert.strictEqual(triangleMul('unknown', 'infantry'), 1.0, 'unknown attacker=1.0');

console.log('classTriangle ok');
