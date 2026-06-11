// tests/voiceLines.test.mjs — [演绎段2] 配音台词枚举门禁:确定性/who∈CAST/L1 样片=13 句/全量规模合理
// 运行:node games/tower-defender/tests/voiceLines.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { CAST } from '../src/data/cast.js';
import { enumerateVoiceLines, ROSTER_STATES } from '../tools/dump-voice-lines.mjs';

// 1) roster 态:恰 3 态,覆盖全部点将三人组演化
assert.equal(ROSTER_STATES.length, 3, '3 个 roster 态');

// 2) L1(样板关):narration 1 + script 12 = 13 句(样板关不随 roster 变,三态去重后仍 13)
const l1 = enumerateVoiceLines(LEVELS.filter((l) => l.id === 1));
assert.equal(l1.length, 13, `L1 样片 13 句(实际 ${l1.length})`);
assert.ok(l1.some((e) => e.who === 'narrator'), 'L1 含旁白');

// 3) 每条:who∈CAST、text 非空≤60、voice.name 是 zh-CN 音色
for (const e of l1) {
  assert.ok(CAST[e.who], `who=${e.who} 在 CAST`);
  assert.ok(e.text.length > 0 && e.text.length <= 60, 'text 合法');
  assert.ok(e.voice.name.startsWith('zh-CN-'), '带音色');
}

// 4) 生成关(L2):三态点将名单不同 → 枚举量 > 单态句数(6 句),且确定性
const l2a = enumerateVoiceLines(LEVELS.filter((l) => l.id === 2));
const l2b = enumerateVoiceLines(LEVELS.filter((l) => l.id === 2));
assert.deepEqual(l2a, l2b, 'L2 枚举确定性');
assert.ok(l2a.length > 6, `L2 含 roster 变体(实际 ${l2a.length})`);

// 5) 全量 50 关:规模在 spec 预估带内(~350-800,32kbps 总体积 12-20MB 量级)
const all = enumerateVoiceLines(LEVELS);
assert.ok(all.length >= 300 && all.length <= 900, `全量规模合理(实际 ${all.length})`);
const keys = new Set(all.map((e) => `${e.who}|${e.text}`));
assert.equal(keys.size, all.length, 'who|text 键唯一');

console.log(`ok voiceLines(L1=13 句,全量=${all.length} 句)`);
