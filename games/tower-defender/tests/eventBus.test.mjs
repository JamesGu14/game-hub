// tests/eventBus.test.mjs — 延迟队列语义（emit 入队 / flush 派发 / 重入安全）
// 运行：node games/tower-defender/tests/eventBus.test.mjs
import assert from 'node:assert';
import { makeBus } from '../src/core/eventBus.js';

// 1) emit 不应同步触发；flush 后按注册序触发
{
  const bus = makeBus();
  const log = [];
  bus.on('x', (p) => log.push('a' + p));
  bus.on('x', (p) => log.push('b' + p));
  bus.emit('x', 1);
  assert.deepEqual(log, [], 'emit 不应同步触发（延迟队列）');
  bus.flush();
  assert.deepEqual(log, ['a1', 'b1'], 'flush 后按序触发');
}

// 2) 监听器内 emit 的事件，在同一 flush 内被处理
{
  const bus = makeBus();
  const log = [];
  bus.on('first', () => { log.push('first'); bus.emit('second'); });
  bus.on('second', () => log.push('second'));
  bus.emit('first');
  bus.flush();
  assert.deepEqual(log, ['first', 'second'], '监听器内 emit 同 flush 处理');
}

// 3) off 生效；无监听器的事件安全
{
  const bus = makeBus();
  let n = 0;
  const fn = () => { n++; };
  bus.on('y', fn);
  bus.off('y', fn);
  bus.emit('y'); bus.emit('nope');
  bus.flush();
  assert.equal(n, 0, 'off 后不再触发');
}

console.log('ok eventBus');
