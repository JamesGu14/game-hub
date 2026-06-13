// tests/campaign.test.mjs — 50 关谱完整性（§6/§9.1）
// 运行：node games/tower-defender/tests/campaign.test.mjs
import assert from 'node:assert';
import { CHAPTERS, CAMPAIGN } from '../src/data/campaign.js';
import { BASE_BOARDS as TEMPLATES } from '../src/data/baseBoards.js';
import { BOSSES, LIEUTENANTS } from '../src/data/bosses.js';
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
  assert.ok(c.waveCount >= 30 && c.waveCount <= 34, `L${c.id} waveCount∈[30,34]（[改进③]每关+10波）`);
  assert.ok(typeof c.difficulty === 'number', `L${c.id} difficulty 数`);
  assert.ok(Array.isArray(c.enemyTiers) && c.enemyTiers.length, `L${c.id} enemyTiers 非空`);
  assert.equal(c.enemyTiers[0], 'footman', `L${c.id} enemyTiers[0]=footman（教学保底）`);
  for (const t of c.enemyTiers) assert.ok(ENEMIES[t], `L${c.id} enemyTier ${t} 合法`);
  assert.ok(c.boss && BOSSES[c.boss.id], `L${c.id} boss.id ${c.boss?.id} 在册`);
  // 副将（检查点A）：≥1 名，id 合法（BOSSES 或 LIEUTENANTS）
  assert.ok(Array.isArray(c.lieutenants) && c.lieutenants.length >= 1, `L${c.id} 有副将`);
  for (const lid of c.lieutenants) assert.ok(BOSSES[lid] || LIEUTENANTS[lid], `L${c.id} 副将 ${lid} 在册`);
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

// [2026-06-13 平衡] 兵种池 ≤ 章内位置带（floor 2 留变化性）：堵"章首样板关挂全章兵种池"漂移——
// 旧 L11 挂 heavy（L12-17 反而没有）→ James 实玩第15波重甲墙;章首=该章最易（§6 注释），tiers 必须随位置渐进。
for (const c of CAMPAIGN) {
  const C = CHAPTERS[c.chapter - 1];
  const k = (c.id - 1) % 10;
  const band = Math.max(2, 1 + Math.round((k / 9) * (C.tiers.length - 1)));
  assert.ok(c.enemyTiers.length <= band, `L${c.id} 兵种数 ${c.enemyTiers.length} ≤ 位置带 ${band}（章首勿挂全章池）`);
}

// [演绎段1] 样板关精写剧本:narration(2-3句讲解)+ script(8-12句对话),无占位、句长≤60
for (const id of sampleIds) {
  const st = CAMPAIGN[id - 1].story;
  assert.ok(typeof st.narration === 'string' && st.narration.length >= 40, `L${id} narration 充实`);
  assert.ok(Array.isArray(st.script) && st.script.length >= 8 && st.script.length <= 12, `L${id} script 8-12 句(实际 ${st.script && st.script.length})`);
  for (const [i, line] of st.script.entries()) {
    assert.deepEqual(Object.keys(line).sort(), ['text', 'who'], `L${id} 句${i} 恰好 who/text 两键`);
    assert.ok(typeof line.who === 'string' && line.who.length >= 2, `L${id} 句${i} who`);
    assert.ok(typeof line.text === 'string' && line.text.length > 0 && line.text.length <= 60, `L${id} 句${i} ≤60 字(实际 ${line.text && line.text.length})`);
    assert.ok(!line.text.includes('undefined') && !line.text.includes('{'), `L${id} 句${i} 无占位`);
  }
}

console.log('ok campaign');
