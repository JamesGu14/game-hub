// tests/rng.test.mjs — 确定性（同 seed 可复现）
// 运行：node games/tower-defender/tests/rng.test.mjs
import assert from 'node:assert';
import { makeRng } from '../src/core/rng.js';

const a = makeRng(42), b = makeRng(42);
const sa = [a(), a(), a()], sb = [b(), b(), b()];
assert.deepEqual(sa, sb, '同 seed 序列一致');
for (const v of sa) assert.ok(v >= 0 && v < 1, '范围 [0,1)');
assert.notEqual(makeRng(1)(), makeRng(2)(), '不同 seed 首值不同');

console.log('ok rng');
