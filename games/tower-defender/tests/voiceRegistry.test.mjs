// tests/voiceRegistry.test.mjs — [演绎段2] 配音清单:加载/查询/失败静默/单次 fetch
// 运行:node games/tower-defender/tests/voiceRegistry.test.mjs
import assert from 'node:assert';
import { loadVoiceRegistry, voiceSrcFor, _resetVoiceRegistry } from '../src/core/voiceRegistry.js';

const TABLE = { 'narrator|你好': 'ab12cd34ef56.mp3', 'liubei|出征': '0123456789ab.mp3' };
const okFetcher = (calls) => (url) => { calls.push(url); return Promise.resolve({ ok: true, json: () => Promise.resolve(TABLE) }); };

// 1) 加载前查询 → null(不抛)
_resetVoiceRegistry();
assert.equal(voiceSrcFor('narrator', '你好'), null, '未加载 → null');

// 2) 正常加载 + 查询 + 缓存(双 load 单 fetch)
{
  const calls = [];
  await loadVoiceRegistry(okFetcher(calls));
  await loadVoiceRegistry(okFetcher(calls));
  assert.equal(calls.length, 1, '清单只 fetch 一次');
  assert.equal(voiceSrcFor('narrator', '你好'), 'assets/voice/ab12cd34ef56.mp3', '命中拼路径');
  assert.equal(voiceSrcFor('narrator', '不存在'), null, '未命中 → null');
}

// 3) 404 / 网络抛错 → 空表静默(游戏无语音照跑)
_resetVoiceRegistry();
await loadVoiceRegistry(() => Promise.resolve({ ok: false }));
assert.equal(voiceSrcFor('narrator', '你好'), null, '404 → 空表');
_resetVoiceRegistry();
await loadVoiceRegistry(() => Promise.reject(new Error('net')));
assert.equal(voiceSrcFor('narrator', '你好'), null, '网络错 → 空表');

// 4) 无 fetch 环境(node 注入 null)→ 不抛
_resetVoiceRegistry();
await loadVoiceRegistry(null);
assert.equal(voiceSrcFor('a', 'b'), null);

console.log('ok voiceRegistry');
