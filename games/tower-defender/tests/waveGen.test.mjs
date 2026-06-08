// tests/waveGen.test.mjs — 确定性/波数/单调/末波 boss/前松后紧/seed 强制（§8/§9.1）
// 运行：node games/tower-defender/tests/waveGen.test.mjs
import assert from 'node:assert';
import { genWaves } from '../src/data/waveGen.js';
import { TEMPLATES } from '../src/data/boardTemplates.js';
import { ENEMIES } from '../src/data/enemies.js';

const tmpl = TEMPLATES.fourCamp;
const params = { waveCount: 24, difficulty: 1.6, enemyTiers: ['footman', 'wolf', 'heavy', 'flyer'], boss: { id: 'caocao', name: '曹操', hpMult: 1.3 } };
const totalCount = (waves) => waves.reduce((n, w) => n + w.spawns.reduce((m, s) => m + (s.enemyType === 'boss' ? 0 : s.count), 0), 0);

// seed 强制：非有限数即 throw
assert.throws(() => genWaves(tmpl, params, undefined), /seed/, 'seed 缺失 throw');
assert.throws(() => genWaves(tmpl, params, null), /seed/, 'seed null throw');
assert.throws(() => genWaves(tmpl, params, NaN), /seed/, 'seed NaN throw');

// 确定性：同 seed → 深度相等；异 seed → 不等
const a = genWaves(tmpl, params, 14), b = genWaves(tmpl, params, 14), c = genWaves(tmpl, params, 15);
assert.deepEqual(a, b, '同 seed 同输出');
assert.notDeepEqual(a, c, '异 seed 异输出');

// 波数正确
assert.equal(a.length, 24, '波数 = waveCount');

// 末波含 boss + 透传字段（id/name/hpMult）
const lastSpawns = a[a.length - 1].spawns;
const bossSp = lastSpawns.find((s) => s.enemyType === 'boss');
assert.ok(bossSp, '末波含 boss');
assert.equal(bossSp.id, 'caocao'); assert.equal(bossSp.name, '曹操'); assert.equal(bossSp.hpMult, 1.3);
// 末波无飞兵（沿用「无飞兵同波」）
assert.ok(lastSpawns.every((s) => s.enemyType !== 'flyer'), '末波无飞兵');

// 前松后紧：首波总量 < 倒数第二波（非 boss 波）总量
const w0 = a[0].spawns.reduce((m, s) => m + s.count, 0);
const wLate = a[a.length - 2].spawns.reduce((m, s) => m + s.count, 0);
assert.ok(w0 < wLate, `前松后紧：首波 ${w0} < 后波 ${wLate}`);
// 首波单路教学
assert.equal(a[0].spawns.length, 1, '首波单路（教学）');

// 章内单调：高 difficulty 总兵力 > 低 difficulty
const lo = genWaves(tmpl, { ...params, difficulty: 0 }, 14);
const hi = genWaves(tmpl, { ...params, difficulty: 3 }, 14);
assert.ok(totalCount(hi) > totalCount(lo), 'difficulty 升 → 总兵力升');

// 合法性：每 spawn campId/pathId ∈ 模板，enemyType ∈ ENEMIES
const lanes = new Set(tmpl.camps.map((c) => c.id));
for (const w of a) for (const s of w.spawns) {
  assert.ok(lanes.has(s.campId), `campId ${s.campId} 合法`);
  assert.ok(lanes.has(s.pathId), `pathId ${s.pathId} 合法`);
  assert.ok(ENEMIES[s.enemyType], `enemyType ${s.enemyType} 合法`);
  assert.ok(s.count >= 1 && s.spawnInterval > 0, '数量/间隔正');
}
// 每关 ≥20 波（本例 24，断言 waveCount 透传）
assert.ok(a.length >= 20, '≥20 波');

// 副将（检查点A）：主将压末波 + N 副将落末波前 N 波（越靠后将领越多）
const withLts = genWaves(tmpl, { ...params, lieutenants: [{ id: 'lidian', name: '李典', hpMult: 0.8 }, { id: 'yujin', name: '于禁', hpMult: 0.85 }] }, 14);
const bossOf = (w) => w.spawns.filter((s) => s.enemyType === 'boss');
const n = withLts.length;
assert.equal(bossOf(withLts[n - 1]).length, 1, '末波仅主将');
assert.equal(bossOf(withLts[n - 1])[0].id, 'caocao', '末波=主将 caocao');
assert.equal(bossOf(withLts[n - 2]).length, 1, '倒2波 1 副将');
assert.equal(bossOf(withLts[n - 3]).length, 1, '倒3波 1 副将');
const ltNames = [withLts[n - 3], withLts[n - 2]].flatMap(bossOf).map((s) => s.name);
assert.ok(ltNames.includes('李典') && ltNames.includes('于禁'), '副将 李典/于禁 末段出场');

console.log('ok waveGen');
