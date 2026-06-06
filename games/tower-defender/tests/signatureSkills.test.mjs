// tests/signatureSkills.test.mjs — L3 冷却招牌技（关羽水淹七军 / 张飞当阳怒吼）+ combatSystem 计时
// 运行：node games/tower-defender/tests/signatureSkills.test.mjs
import assert from 'node:assert';
import { GENERALS } from '../src/data/generals.js';
import { createTower } from '../src/entities/tower.js';
import { createEnemy } from '../src/entities/enemy.js';
import { fireSignature } from '../src/systems/combat/signatureSkills.js';
import { combatSystem } from '../src/systems/combatSystem.js';

const path = [{ x: 0, y: 0 }, { x: 12, y: 0 }];
function enemy(type, px, py) { const e = createEnemy(type, 'a', path, 1); e.px = px; e.py = py; return e; }

// 关羽 水淹七军：范围内重减速 60%/3s + 谋略伤；范围外不影响
{
  const t = createTower('guan', { x: 0, y: 0 }); t.px = 100; t.py = 100; t.level = 3;
  const inR = enemy('footman', 100, 100), out = enemy('footman', 400, 400);
  t.target = inR;
  const state = { enemies: [inR, out], projectiles: [], fx: [], gold: 0 };
  assert.ok(fireSignature(state, t, GENERALS.guan, 0), '放出水淹七军');
  assert.ok(Math.abs(inR.statuses.slow.pct - 0.6) < 1e-9, '重减速 60%');
  assert.ok(inR.hp < 60, '谋略伤');
  assert.ok(!out.statuses.slow, '范围外不影响');
}

// 张飞 当阳怒吼：范围内地面定身；飞兵不定
{
  const t = createTower('zhang', { x: 0, y: 0 }); t.px = 100; t.py = 100; t.level = 3;
  const g = enemy('footman', 100, 100), fly = enemy('flyer', 100, 100);
  t.target = g;
  const state = { enemies: [g, fly], projectiles: [], fx: [], gold: 0 };
  assert.ok(fireSignature(state, t, GENERALS.zhang, 0), '放出当阳怒吼');
  assert.ok(g.statuses.stun && g.statuses.stun.until > 0, '地面定身');
  assert.ok(!fly.statuses.stun, '飞兵不定身');
}

// 无目标 → 不放（不消耗 CD）
{
  const t = createTower('guan', { x: 0, y: 0 }); t.level = 3; t.target = null;
  assert.equal(fireSignature({ enemies: [], projectiles: [], fx: [], gold: 0 }, t, GENERALS.guan, 0), false, '无目标不放');
}

// combatSystem 驱动：L3 关羽放后进 12s CD
{
  const t = createTower('guan', { x: 0, y: 0 }); t.px = 100; t.py = 100; t.level = 3;
  const e = enemy('footman', 100, 100); t.target = e;
  const state = { phase: 'combat', time: 0, rng: () => 0.99, enemies: [e], towers: [t], projectiles: [], fx: [], gold: 0 };
  combatSystem(state, 1 / 60);
  assert.ok(t.signatureCd > 11.9 && t.signatureCd <= 12, '放后进 12s CD');
}

console.log('ok signatureSkills');
