// tests/killAttribution.test.mjs — killEnemy 第三参 killerId 进入 enemyKilled 事件
import assert from 'node:assert';
import { bus } from '../src/core/eventBus.js';
import { killEnemy } from '../src/systems/combat/kill.js';

function mkState() { return { gold: 0 }; }
function mkEnemy() { return { alive: true, gold: 5, px: 0, py: 0 }; }

// 带 killerId → 事件携带
{
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  killEnemy(mkState(), mkEnemy(), 'guan');
  bus.flush();                          // 本项目 emit 只入队，flush 才派发
  assert.equal(got.length, 1, '触发一次');
  assert.equal(got[0].killerId, 'guan', 'killerId 透传');
  if (off) off();
}

// 不传 → killerId=null（环境击杀），且仍掉金/置死
{
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  const s = mkState(); const e = mkEnemy();
  const r = killEnemy(s, e);
  bus.flush();
  assert.equal(r, true, '首杀返回 true');
  assert.equal(e.alive, false, '置死');
  assert.equal(s.gold, 5, '掉金');
  assert.equal(got[0].killerId, null, '缺省 killerId=null');
  if (off) off();
}

// 幂等：已死不重复
{
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  const e = mkEnemy(); e.alive = false;
  assert.equal(killEnemy(mkState(), e, 'zhao'), false, '已死 → false');
  bus.flush();
  assert.equal(got.length, 0, '不重复 emit');
  if (off) off();
}

console.log('killAttribution.test.mjs OK');
