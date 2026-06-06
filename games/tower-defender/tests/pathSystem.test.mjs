// tests/pathSystem.test.mjs — 行进 + 到城同步扣城（不掉金）+ 城防归零→lost + 相位守卫
// 运行：node games/tower-defender/tests/pathSystem.test.mjs
import assert from 'node:assert';
import { createEnemy } from '../src/entities/enemy.js';
import { pathSystem } from '../src/systems/pathSystem.js';

function mk(castleHp) {
  const path = [{ x: 0, y: 0 }, { x: 2, y: 0 }];
  const level = { paths: { p: path }, scale: 1 };
  const state = { phase: 'combat', level, castleHp, castleMaxHp: castleHp, gold: 0, enemies: [], projectiles: [], fx: [] };
  state.enemies.push(createEnemy('footman', 'p', path, 1));
  return state;
}

// 到城：扣 1 城防、消失、不掉金
{
  const s = mk(3);
  for (let i = 0; i < 6 && s.enemies[0].alive; i++) pathSystem(s, 1);
  assert.equal(s.enemies[0].alive, false, '到城后消失');
  assert.equal(s.castleHp, 2, '扣 1 城防');
  assert.equal(s.gold, 0, '到城不掉金（N5）');
}

// 城防归零 → lost
{
  const s = mk(1);
  for (let i = 0; i < 6 && s.phase === 'combat'; i++) pathSystem(s, 1);
  assert.equal(s.castleHp, 0);
  assert.equal(s.phase, 'lost', '城防 0 → lost（N1 同步）');
}

// 相位守卫：非 combat 不推进
{
  const s = mk(3); s.phase = 'prep';
  const e = s.enemies[0];
  pathSystem(s, 1);
  assert.equal(e.seg, 0); assert.equal(e.t, 0, 'prep 不推进');
}

console.log('ok pathSystem');
