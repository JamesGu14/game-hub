// tests/statusSystem.test.mjs — 灼烧 DoT / 治疗封顶 / 净值抵消 / DoT 致死掉金+emit
// 运行：node games/tower-defender/tests/statusSystem.test.mjs
import assert from 'node:assert';
import { createEnemy } from '../src/entities/enemy.js';
import { applyBurn } from '../src/systems/combat/statusEffects.js';
import { statusSystem } from '../src/systems/statusSystem.js';
import { bus } from '../src/core/eventBus.js';

const P = [{ x: 0, y: 0 }];

// 灼烧 dps8 dt1 → -8
{
  const e = createEnemy('footman', 'a', P, 1); applyBurn(e, 8, 5, 0);
  const s = { phase: 'combat', time: 0, enemies: [e], gold: 0 };
  statusSystem(s, 1);
  assert.equal(e.hp, 52, '灼烧扣 8');
}

// 灼烧致死 → 掉金 + emit enemyKilled
{
  const e = createEnemy('footman', 'a', P, 1); e.hp = 5; applyBurn(e, 8, 5, 0);
  let killed = 0; bus.on('enemyKilled', () => killed++);
  const s = { phase: 'combat', time: 0, enemies: [e], gold: 0 };
  statusSystem(s, 1); bus.flush();
  assert.equal(e.alive, false, 'DoT 致死');
  assert.equal(s.gold, 5, '掉金 5');
  assert.equal(killed, 1, 'emit enemyKilled');
}

// 治疗每目标封顶 24/s（4 方士 ×8=32 → 24）
{
  const target = createEnemy('footman', 'a', P, 1); target.hp = 10; target.px = 100; target.py = 100;
  const healers = [];
  for (let i = 0; i < 4; i++) { const h = createEnemy('shaman', 'a', P, 1); h.px = 100; h.py = 100; healers.push(h); }
  const s = { phase: 'combat', time: 0, enemies: [target, ...healers], gold: 0 };
  statusSystem(s, 1);
  assert.equal(target.hp, 34, '治疗封顶 24（10→34，未超 maxHp60）');
}

// 净值：治疗 8 - 灼烧 20 = -12
{
  const target = createEnemy('footman', 'a', P, 1); target.px = 100; target.py = 100; applyBurn(target, 20, 5, 0);
  const h = createEnemy('shaman', 'a', P, 1); h.px = 100; h.py = 100;
  const s = { phase: 'combat', time: 0, enemies: [target, h], gold: 0 };
  statusSystem(s, 1);
  assert.equal(target.hp, 48, '净值 heal8-burn20=-12');
}

console.log('ok statusSystem');
