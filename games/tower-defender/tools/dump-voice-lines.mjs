// tools/dump-voice-lines.mjs — [演绎段2] 枚举 50 关全部配音句(narration + script × 3 roster 态),
// 按 who|text 去重 → JSON 供 gen-voice.py 消费。export 供单测;CLI:node tools/dump-voice-lines.mjs [关号,关号...]
// roster 态:点将三人组演化只有 3 种(新档/过L10/过L20;过L30 与 L20 同,见 storylines ROLLCALL_PRIORITY),
// 枚举三态再去重 = 任意存档下可能出现的全部台词。dev 工具,游戏运行时不引用。
import { LEVELS } from '../src/data/levels.js';
import { storyContentFor } from '../src/data/storylines.js';
import { CAST } from '../src/data/cast.js';

const BASE6 = ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'];
export const ROSTER_STATES = [
  new Set(BASE6),                                                          // 新档 → 廖化/张苞/关平
  new Set([...BASE6, 'zhao', 'zhang']),                                    // 过L10 → 赵云/张飞/廖化
  new Set([...BASE6, 'zhao', 'zhang', 'zhuge', 'guan', 'ma', 'huang']),    // 过L20+(L30 同) → 赵云/张飞/关羽
];

// levels 子集 → [{ who, text, voice:{name,rate|null,pitch|null} }],who|text 唯一、顺序确定
export function enumerateVoiceLines(levels = LEVELS) {
  const out = new Map();
  const add = (who, text) => {
    const key = `${who}|${text}`;
    if (out.has(key)) return;
    const v = CAST[who].voice;
    out.set(key, { who, text, voice: { name: v.name, rate: v.rate || null, pitch: v.pitch || null } });
  };
  for (const lv of levels) {
    for (const roster of ROSTER_STATES) {
      const c = storyContentFor(lv, roster);
      add('narrator', c.narration);
      for (const line of c.script) add(line.who, line.text);
    }
  }
  return [...out.values()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2] ? process.argv[2].split(',').map(Number) : null;
  const levels = only ? LEVELS.filter((l) => only.includes(l.id)) : LEVELS;
  process.stdout.write(JSON.stringify(enumerateVoiceLines(levels)));
}
