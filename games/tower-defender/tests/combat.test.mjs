// tests/combat.test.mjs — hitscan 开火/伤害/击杀掉金（N5）
// 运行：node games/tower-defender/tests/combat.test.mjs
import assert from 'node:assert';
import { createTower } from '../src/entities/tower.js';
import { createEnemy } from '../src/entities/enemy.js';
import { combatSystem } from '../src/systems/combatSystem.js';

// 黄忠 dmg 9 × 7 = 63 ≥ 60 → 第 7 发致死；死即 +5 金
const t = createTower('huang', { x: 2, y: 2 });    // px,py = 100,100
const e = createEnemy('footman', 'p', [{ x: 0, y: 0 }, { x: 1, y: 0 }], 1);
e.px = 100; e.py = 100;                              // 同点 → 必在射程
t.target = e;
// [P2] combatSystem 现读 state.time/state.rng；黄忠 L1 无暴击（level<3），rng 不会被调用，基线维持。
const state = { phase: 'combat', time: 0, rng: () => 0.99, gold: 0, towers: [t], enemies: [e], projectiles: [], fx: [] };

let shots = 0;
while (e.alive && shots < 20) { combatSystem(state, 1.0); shots++; } // dt>interval → 每次一发
assert.equal(shots, 7, '7 发致死');
assert.equal(e.alive, false, '步卒死亡');
assert.equal(state.gold, 5, '死于 combat 掉 5 金（N5）');
assert.ok(state.projectiles.length >= 1, '产生纯表现弹道');

// 目标死后不再开火 / 不再加金
const goldAfter = state.gold;
combatSystem(state, 1.0);
assert.equal(state.gold, goldAfter, '死目标不再掉金');

console.log('ok combat');
