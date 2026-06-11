// core/voiceRegistry.js — [演绎段2] 配音清单(gen-voice.py 产物 assets/voice/registry.json)加载与查询。
// registry: { "<who>|<text>": "<hash>.mp3" }。惰性单次 fetch(进故事屏触发);任何失败 → 空表,
// voiceSrcFor 永远可调(查不到 null = 该句无语音,字幕流程不受影响)。自含:只 fetch 本游戏 assets。
let table = null;       // null=未加载;{}=加载失败/空
let loading = null;     // 进行中的 Promise(防并发重复 fetch)

export function loadVoiceRegistry(fetcher = (typeof fetch !== 'undefined' ? fetch : null)) {
  if (table) return Promise.resolve(table);
  if (loading) return loading;
  if (!fetcher) { table = {}; return Promise.resolve(table); }
  loading = Promise.resolve()
    .then(() => fetcher('assets/voice/registry.json'))
    .then((r) => (r && r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then((j) => { table = j && typeof j === 'object' ? j : {}; loading = null; return table; });
  return loading;
}

export function voiceSrcFor(who, text) {
  const f = table && table[`${who}|${text}`];
  return f ? 'assets/voice/' + f : null;
}

export function _resetVoiceRegistry() { table = null; loading = null; }   // 单测隔离
