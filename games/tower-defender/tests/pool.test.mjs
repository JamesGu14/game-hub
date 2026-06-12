// tests/pool.test.mjs — [H10] 对象池:acquire/release 往返 + reset 套用 + **double-release 防护**(同一引用入池两次
//   会致两次 acquire 返回相同对象 → 状态污染)+ release(null) 容错。
// 运行：node games/tower-defender/tests/pool.test.mjs
import assert from 'node:assert';
import { makePool } from '../src/core/pool.js';

// 基本往返：空池 acquire 走 factory;release 入池;再 acquire 复用同一引用
{
  let made = 0;
  const p = makePool(() => ({ id: ++made }), (o, v) => { o.v = v; return o; });
  assert.equal(p.size, 0, '初始空');
  const a = p.acquire(7);
  assert.equal(a.v, 7, 'reset 套用入参');
  assert.equal(p.size, 0, 'acquire 不增 free');
  p.release(a);
  assert.equal(p.size, 1, 'release 入池');
  const b = p.acquire(9);
  assert.equal(b, a, '复用同一引用');
  assert.equal(b.v, 9, '复用时 reset 重置');
  assert.equal(p.size, 0, 'acquire 取走');
}

// 无 reset 池:acquire 原样返回
{
  const p = makePool(() => ({}));
  const o = p.acquire();
  assert.ok(o && typeof o === 'object', '无 reset 返回原对象');
}

// [H10] double-release:同一对象 release 两次 → 只占一格,不会被两次 acquire 出去
{
  const p = makePool(() => ({}), (o) => o);
  const a = p.acquire();
  p.release(a);
  p.release(a);                       // 重复释放(bug 触发点)
  assert.equal(p.size, 1, 'double-release 只占 1 格(非 2)');
  const x = p.acquire();
  const y = p.acquire();              // 第二次 acquire 必须是新对象,绝不能又拿到 a
  assert.equal(x, a, '第一次 acquire 拿回 a');
  assert.notStrictEqual(y, a, 'double-release 后第二次 acquire 不得返回同一引用(防状态污染)');
}

// release(null)/release(undefined) 容错,不抛、不入池
{
  const p = makePool(() => ({}));
  assert.doesNotThrow(() => { p.release(null); p.release(undefined); });
  assert.equal(p.size, 0, 'null/undefined 不入池');
}

console.log('ok pool');
