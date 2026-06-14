// tests/burnAttribution.test.mjs — 灼烧栈记 src;DoT 致死归"栈末点火将";环境灼烧不记功
import assert from 'node:assert';
import { bus } from '../src/core/eventBus.js';
import { applyBurn } from '../src/systems/combat/statusEffects.js';
import { statusSystem } from '../src/systems/statusSystem.js';

function mkEnemy(hp) {
  return { alive: true, hp, maxHp: hp, gold: 5, px: 0, py: 0, statuses: {}, envBurn: null, resist: null };
}
function mkState(enemies) { return { phase: 'combat', time: 100, gold: 0, enemies }; }

// applyBurn 记 src
{
  const e = mkEnemy(100);
  applyBurn(e, 10, 3, 100, 'zhuge');
  const last = e.statuses.burn[e.statuses.burn.length - 1];
  assert.equal(last.src, 'zhuge', '栈元素带 src');
}

// DoT 致死 → killerId = 栈末 src
{
  const e = mkEnemy(1);                 // 1 滴血，一 tick 必死
  applyBurn(e, 100, 3, 100, 'yueying');
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  statusSystem(mkState([e]), 1);        // dt=1，burn 100 → 致死
  bus.flush();                          // 本项目 emit 只入队，flush 才派发
  assert.equal(e.alive, false, '烧死');
  assert.equal(got[0].killerId, 'yueying', 'DoT 致死归点火将');
  if (off) off();
}

// 环境灼烧致死（envBurn，无 src）→ killerId=null
{
  const e = mkEnemy(1); e.envBurn = { dps: 100, until: 999 };
  const got = [];
  const off = bus.on('enemyKilled', (p) => got.push(p));
  statusSystem(mkState([e]), 1);
  bus.flush();
  assert.equal(e.alive, false, '环境烧死');
  assert.equal(got[0].killerId, null, '环境击杀不记功');
  if (off) off();
}

console.log('burnAttribution.test.mjs OK');
