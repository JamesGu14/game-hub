// tests/waveRamp.test.mjs — 关内 wave 难度递增纯函数边界（首波/末波/t²后置/防除零）
// 运行：node games/tower-defender/tests/waveRamp.test.mjs
import assert from 'node:assert';
import { waveRamp } from '../src/data/waveRamp.js';

// 首波 t=0 → 无加成
const first = waveRamp(0, 20);
assert.equal(first.hpMult, 1, '首波 HP ×1');
assert.equal(first.dmgTakenMult, 1, '首波 无减伤');

// 末波 t=1 → 默认 HP×1.5、受伤×0.85
const last = waveRamp(19, 20);
assert.ok(Math.abs(last.hpMult - 1.5) < 1e-9, '末波 HP ×1.5（默认上限）');
assert.ok(Math.abs(last.dmgTakenMult - 0.85) < 1e-9, '末波 受伤 ×0.85');

// 中点 t=0.5：HP 线性=1.25；防御 t² 后置=1-0.15×0.25=0.9625（弱于线性 0.925）
const mid = waveRamp(10, 21);   // 10/(21-1)=0.5
assert.ok(Math.abs(mid.hpMult - 1.25) < 1e-9, '中点 HP 线性 1.25');
assert.ok(Math.abs(mid.dmgTakenMult - 0.9625) < 1e-9, '中点 防御 t² 后置 0.9625');
assert.ok(mid.dmgTakenMult > 0.925, 't² 后置：中点减伤弱于线性');

// hpMax 覆盖：第三参覆盖默认上限（L50 司马懿终关用 1.0 豁免 HP ramp）
const exempt = waveRamp(19, 20, 1.0);
assert.equal(exempt.hpMult, 1, 'hpMax=1.0 → 末波 HP 不抬（豁免）');
assert.ok(Math.abs(exempt.dmgTakenMult - 0.85) < 1e-9, 'hpMax=1.0 仍保留 def ramp');
const cap2 = waveRamp(19, 20, 2.0);
assert.ok(Math.abs(cap2.hpMult - 2) < 1e-9, 'hpMax=2.0 → 末波 HP ×2');

// waveCount=1 不除零 → 返回首波值
const single = waveRamp(0, 1);
assert.equal(single.hpMult, 1, 'waveCount=1 HP×1');
assert.equal(single.dmgTakenMult, 1, 'waveCount=1 无减伤');

console.log('ok waveRamp');
