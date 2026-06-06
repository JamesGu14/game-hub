// tests/targeting.test.mjs — 四目标模式（最前/最后/最强/最弱）+ 射程过滤
// 运行：node games/tower-defender/tests/targeting.test.mjs
import assert from 'node:assert';
import { createTower } from '../src/entities/tower.js';
import { createEnemy } from '../src/entities/enemy.js';
import { targetingSystem } from '../src/systems/targetingSystem.js';

const t = createTower('huang', { x: 5, y: 5 });   // px,py = 198,198；range L1 3.5格=126px
function at(px, py, progress, hp) {
  const e = createEnemy('footman', 'p', [{ x: 0, y: 0 }], 1);
  e.px = px; e.py = py; e.progress = progress; if (hp != null) e.hp = hp;
  return e;
}

// first：射程内进度最大（最接近成都）
{
  t.mode = 'first';
  const near = at(198, 180, 2.5), far = at(198, 220, 1.0);
  const state = { phase: 'combat', towers: [t], enemies: [near, far] };
  targetingSystem(state);
  assert.equal(t.target, near, 'first 选进度最大');
}

// last：进度最小
{
  t.mode = 'last';
  const near = at(198, 180, 2.5), far = at(198, 220, 1.0);
  const state = { phase: 'combat', towers: [t], enemies: [near, far] };
  targetingSystem(state);
  assert.equal(t.target, far, 'last 选进度最小');
}

// strongest / weakest：按血量
{
  const hi = at(198, 180, 2, 90), lo = at(198, 210, 3, 10);
  const state = { phase: 'combat', towers: [t], enemies: [hi, lo] };
  t.mode = 'strongest'; targetingSystem(state); assert.equal(t.target, hi, 'strongest 选血最多');
  t.mode = 'weakest'; targetingSystem(state); assert.equal(t.target, lo, 'weakest 选血最少');
}

// 超射程 → null
{
  t.mode = 'first';
  const out = at(3000, 3000, 9);
  const state = { phase: 'combat', towers: [t], enemies: [out] };
  targetingSystem(state);
  assert.equal(t.target, null, '超射程不选');
}

console.log('ok targeting');
