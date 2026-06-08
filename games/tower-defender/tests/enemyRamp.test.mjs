// tests/enemyRamp.test.mjs — 工厂 ramp：rampHp 并入 hp/maxHp、与 boss hpMult 相乘、dmgTakenMult 存字段
// 运行：node games/tower-defender/tests/enemyRamp.test.mjs
import assert from 'node:assert';
import { createEnemy } from '../src/entities/enemy.js';

const path = [{ x: 0, y: 0 }, { x: 5, y: 0 }];

// 默认无 ramp：rampHp=1、dmgTakenMult=1
const base = createEnemy('footman', 'a', path, 1);
assert.equal(base.hp, 60, '步卒基础 60');
assert.equal(base.rampHp, 1, '默认 rampHp=1');
assert.equal(base.dmgTakenMult, 1, '默认 dmgTakenMult=1');

// rampHp 并入 hp/maxHp
const ramped = createEnemy('footman', 'a', path, 1, { rampHp: 2 });
assert.equal(ramped.hp, 120, 'rampHp2 → 60×2=120');
assert.equal(ramped.maxHp, 120, 'maxHp 同步');
assert.equal(ramped.rampHp, 2, '存 rampHp 字段');

// rampHp 与 boss hpMult 相乘（不覆盖）
const boss = createEnemy('boss', 'a', path, 1, { hpMult: 1.6, rampHp: 2 });
assert.ok(Math.abs(boss.hp - 800 * 1.6 * 2) < 1e-9, 'boss 800×1.6×2=2560');

// dmgTakenMult 透传存字段
const def = createEnemy('footman', 'a', path, 1, { dmgTakenMult: 0.85 });
assert.equal(def.dmgTakenMult, 0.85, '存 dmgTakenMult 字段');

console.log('ok enemyRamp');
