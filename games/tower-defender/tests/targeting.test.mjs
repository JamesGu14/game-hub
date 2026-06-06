// tests/targeting.test.mjs — 最前目标 + 射程过滤
// 运行：node games/tower-defender/tests/targeting.test.mjs
import assert from 'node:assert';
import { createTower } from '../src/entities/tower.js';
import { createEnemy } from '../src/systems/../entities/enemy.js';
import { targetingSystem } from '../src/systems/targetingSystem.js';

const t = createTower('huang', { x: 5, y: 5 });   // px,py = 220,220
function at(px, py, seg, tt) { const e = createEnemy('footman', 'p', [{ x: 0, y: 0 }], 1); e.px = px; e.py = py; e.seg = seg; e.t = tt; return e; }

// 射程内两敌 → 选进度最大（最接近成都）
{
  const near = at(220, 200, 2, 0.5);  // progress 2.5
  const far = at(220, 240, 1, 0.0);   // progress 1.0
  const state = { phase: 'combat', towers: [t], enemies: [near, far] };
  targetingSystem(state);
  assert.equal(t.target, near, '选 seg+t 最大者');
}

// 超射程 → null
{
  const out = at(3000, 3000, 9, 0);
  const state = { phase: 'combat', towers: [t], enemies: [out] };
  targetingSystem(state);
  assert.equal(t.target, null, '超射程不选');
}

console.log('ok targeting');
