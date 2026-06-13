// tests/projectile.test.mjs — [改进⑤] 弹道带 kind(攻击类型)→ drawProjectile 分类型渲染(箭矢/火弹/水弹/刀光)。
// 伤害仍开火瞬间结算(不变),kind 只驱动视觉。运行: node games/tower-defender/tests/projectile.test.mjs
import assert from 'node:assert';
import { newProjectile, resetProjectile } from '../src/entities/projectile.js';
import { spawnTracer } from '../src/systems/combat/projectileManager.js';

// 默认 kind=single
assert.equal(newProjectile().kind, 'single', '默认 kind=single');
// reset 设置 kind,不影响其余字段
const p = resetProjectile(newProjectile(), 0, 0, 10, 10, '#fff', 0.12, 'burn');
assert.equal(p.kind, 'burn', 'reset 应设置 kind');
assert.equal(p.toX, 10, 'reset 其余字段照常');

// spawnTracer 透传 kind 到 state.projectiles
const state = { projectiles: [] };
spawnTracer(state, { px: 0, py: 0 }, { px: 30, py: 40 }, '#abc', 'slow');
assert.equal(state.projectiles.length, 1, 'spawnTracer push 一枚');
assert.equal(state.projectiles[0].kind, 'slow', 'spawnTracer 透传 kind');
// 不传 kind → 默认 single
spawnTracer(state, { px: 0, py: 0 }, { px: 1, py: 1 }, '#abc');
assert.equal(state.projectiles[1].kind, 'single', '不传 kind 默认 single');

console.log('ok projectile');
