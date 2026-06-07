// tests/levels-coverage.test.mjs — 无漏怪硬约束:每关每段蜀道落在某将位 2.5 格内(§17.4)
// 运行：node games/tower-defender/tests/levels-coverage.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { verifyLevel } from '../tools/verify-levels.mjs';

for (const lv of LEVELS) {
  const r = verifyLevel(lv);
  assert.equal(r.leaks.length, 0, `L${lv.id} 漏怪: ${JSON.stringify(r.leaks)}`);
}

console.log('ok levels-coverage');
