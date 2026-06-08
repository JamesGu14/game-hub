// tests/campaign.test.mjs — 50 关谱完整性（§6/§9.1）
// 运行：node games/tower-defender/tests/campaign.test.mjs
import assert from 'node:assert';
import { CHAPTERS, CAMPAIGN } from '../src/data/campaign.js';
import { TEMPLATES } from '../src/data/boardTemplates.js';
import { BOSSES } from '../src/data/bosses.js';
import { ENEMIES } from '../src/data/enemies.js';

const VALID_FACTIONS = new Set(['nanman', 'wu', 'wei']);

assert.equal(CHAPTERS.length, 5, '5 章');
assert.equal(CAMPAIGN.length, 50, '50 关');

// id 连续唯一 1..50
const ids = CAMPAIGN.map((c) => c.id);
assert.deepEqual(ids, Array.from({ length: 50 }, (_, i) => i + 1), 'id 连续唯一 1..50');

const STORY_KEYS = ['hook', 'year', 'place', 'sides', 'result', 'idiom'];
const sampleIds = new Set([1, 11, 21, 31, 41, 50]);   // 6 样板关（含 L50 司马懿终局）

for (const c of CAMPAIGN) {
  assert.ok(c.name && c.name.length, `L${c.id} 有 name`);
  assert.ok(c.chapter >= 1 && c.chapter <= 5, `L${c.id} chapter 合法`);
  assert.ok(VALID_FACTIONS.has(c.faction), `L${c.id} faction 合法`);
  assert.ok(TEMPLATES[c.templateId], `L${c.id} templateId ${c.templateId} 合法`);
  assert.ok(c.waveCount >= 20, `L${c.id} waveCount≥20`);
  assert.ok(typeof c.difficulty === 'number', `L${c.id} difficulty 数`);
  assert.ok(Array.isArray(c.enemyTiers) && c.enemyTiers.length, `L${c.id} enemyTiers 非空`);
  assert.equal(c.enemyTiers[0], 'footman', `L${c.id} enemyTiers[0]=footman（教学保底）`);
  for (const t of c.enemyTiers) assert.ok(ENEMIES[t], `L${c.id} enemyTier ${t} 合法`);
  assert.ok(c.boss && BOSSES[c.boss.id], `L${c.id} boss.id ${c.boss?.id} 在册`);
  // pathSubset（若有）⊆ 模板路
  if (c.pathSubset) for (const p of c.pathSubset) assert.ok(TEMPLATES[c.templateId].paths[p], `L${c.id} pathSubset ${p} ∈ 模板`);
  // story 6 键齐全（全关）
  assert.ok(c.story, `L${c.id} 有 story`);
  for (const k of STORY_KEYS) assert.ok(typeof c.story[k] === 'string', `L${c.id} story.${k} 是字符串`);
  // 'portrait' 键存在（null 或字符串）
  assert.ok('portrait' in c.story, `L${c.id} story.portrait 键存在`);
  // 样板关 story 非占位（hook ≥4 字、idiom 非空且非 '—'）
  if (sampleIds.has(c.id)) {
    assert.ok(c.story.hook.length >= 4 && c.story.idiom && c.story.idiom !== '—', `样板 L${c.id} story 充实`);
  }
}

// 章节覆盖 1..5 各 10 关
for (let ch = 1; ch <= 5; ch++) {
  assert.equal(CAMPAIGN.filter((c) => c.chapter === ch).length, 10, `第${ch}章 10 关`);
}
// 终关 50 = 司马懿（带主动技）
assert.equal(CAMPAIGN[49].boss.id, 'simayi', 'L50 boss=司马懿');

// difficulty 全局单调非降（章带 positional 公式，无锯齿 → 不触发 balance-report 单调告警）
for (let i = 1; i < CAMPAIGN.length; i++) {
  assert.ok(CAMPAIGN[i].difficulty >= CAMPAIGN[i - 1].difficulty, `L${i + 1} difficulty 不低于 L${i}`);
}

console.log('ok campaign');
