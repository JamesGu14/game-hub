// tests/ysort.test.mjs — [P6] y-sort 纯函数：py 升序、稳定、不改原数组、缺值不抛。
// 运行：node games/tower-defender/tests/ysort.test.mjs
import assert from 'node:assert';
import { sortByY } from '../src/render/ysort.js';

// 1) 升序
{
  const out = sortByY([{ py: 50 }, { py: 10 }, { py: 30 }]);
  assert.deepEqual(out.map((e) => e.py), [10, 30, 50], 'py 升序');
}

// 2) 不改原数组
{
  const input = [{ py: 3 }, { py: 1 }, { py: 2 }];
  const snapshot = input.map((e) => e.py);
  const out = sortByY(input);
  assert.deepEqual(input.map((e) => e.py), snapshot, '原数组不被修改');
  assert.notStrictEqual(out, input, '返回新数组');
}

// 3) 相等 py 保持稳定序（远近一致的实体不抖动）
{
  const out = sortByY([{ py: 5, k: 'a' }, { py: 5, k: 'b' }, { py: 1, k: 'c' }]);
  assert.deepEqual(out.map((e) => e.k), ['c', 'a', 'b'], 'py 相等保持稳定序');
}

// 4) 空数组 / 缺 py / null 元素不抛（缺值视作 0）
{
  assert.deepEqual(sortByY([]), [], '空数组');
  assert.doesNotThrow(() => sortByY([{}, { py: 1 }, null]), '缺 py / null 不抛');
}

console.log('ok ysort');
