import { test } from 'node:test';
import assert from 'node:assert/strict';
import { genWaves } from '../src/data/waveGen.js';

const TEMPLATE = { camps: [{ id: 'a' }, { id: 'b' }, { id: 'c' }], paths: { a: [], b: [], c: [] } };
const PARAMS = {
  waveCount: 15, difficulty: 3,
  enemyTiers: ['footman', 'wolf', 'heavy', 'cavalry'],
  boss: { id: 'caocao', name: '曹操', hpMult: 1 }, lieutenants: [],
};

// [需求③] waveId>10 非末波:每路单一兵种被确定性切成多兵种 → 整波出现 ≥2 种
test('第10波后非末波混编出现多兵种', () => {
  const waves = genWaves(TEMPLATE, PARAMS, 1234);
  const w = waves.find((x) => x.waveId === 12);
  const types = new Set(w.spawns.filter((s) => s.enemyType !== 'boss').map((s) => s.enemyType));
  assert.ok(types.size >= 2, `waveId 12 应混编多兵种,实际 ${[...types]}`);
});

// 第10波前不混编:每路仍单一 spawn
test('第10波前每路仍单一兵种', () => {
  const waves = genWaves(TEMPLATE, PARAMS, 1234);
  const w = waves.find((x) => x.waveId === 5);
  const perLane = {};
  for (const s of w.spawns) perLane[s.campId] = (perLane[s.campId] || 0) + 1;
  for (const [lane, n] of Object.entries(perLane)) assert.ok(n <= 1, `第10波前路 ${lane} 应单 spawn,实际 ${n}`);
});

// 确定性铁律:同 seed 两次完全一致(混编零新增 rng)
test('确定性:同 seed 两次生成完全一致', () => {
  assert.deepEqual(genWaves(TEMPLATE, PARAMS, 1234), genWaves(TEMPLATE, PARAMS, 1234));
});
