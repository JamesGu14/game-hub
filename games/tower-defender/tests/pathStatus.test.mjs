// tests/pathStatus.test.mjs — 移动 × 状态：减速半速 / 定身不动 / 飞兵直线到城 / 击退后退
// 运行：node games/tower-defender/tests/pathStatus.test.mjs
import assert from 'node:assert';
import { createEnemy } from '../src/entities/enemy.js';
import { pathSystem } from '../src/systems/pathSystem.js';
import { applySlow, applyStun } from '../src/systems/combat/statusEffects.js';

const level = { paths: { a: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }, castle: { c: 8, r: 0, w: 2, h: 2 } };
function mkstate(enemies) { return { phase: 'combat', time: 0, level, enemies, castleHp: 20 }; }

// 减速 50% → 行进为正常一半
{
  const e1 = createEnemy('footman', 'a', level.paths.a, 1);
  pathSystem(mkstate([e1]), 1);
  const full = e1.progress;
  const e2 = createEnemy('footman', 'a', level.paths.a, 1); applySlow(e2, 0.5, 5, 0);
  pathSystem(mkstate([e2]), 1);
  assert.ok(full > 0 && Math.abs(e2.progress - full * 0.5) < 1e-6, '减速50%走一半');
}

// 定身 → 不动
{
  const e = createEnemy('footman', 'a', level.paths.a, 1); applyStun(e, 5, 0);
  pathSystem(mkstate([e]), 1);
  assert.equal(e.progress, 0, '定身不前进');
}

// 飞兵 → 直线扑成都中心，到城扣血消失
{
  const fly = createEnemy('flyer', 'a', level.paths.a, 1);
  fly.px = 320; fly.py = 34;                       // 贴近成都中心(324,36)
  const s = mkstate([fly]);
  pathSystem(s, 1);
  assert.ok(s.castleHp < 20, '飞兵到城扣血');
  assert.equal(fly.alive, false, '飞兵到城消失');
}

// 击退 → 沿路后退
{
  const e = createEnemy('footman', 'a', level.paths.a, 1);
  e.seg = 0; e.t = 0.5; e.knockback = 0.5;
  const before = e.seg + e.t;
  pathSystem(mkstate([e]), 0);                     // dt=0：仅消费击退，无前进
  assert.ok(e.seg + e.t < before, '击退后退');
  assert.equal(e.knockback, 0, '击退已消费');
}

console.log('ok pathStatus');
