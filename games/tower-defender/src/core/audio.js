// core/audio.js — 程序 WebAudio 音效（SFX）+ 文件 BGM（HTMLAudioElement 流播，程序乐兜底）+ 静音。
// 技法 copy-and-own 自 js/hub.js 的 blip（osc + gain 指数包络）；不 import 跨游戏（自含铁律）。
// 懒建 AudioContext（首次用户手势后 init()，绕 autoplay）；无 AudioContext / 被拒 → SFX 静默不崩。
// BGM 走 HTMLAudioElement（file:// 双击与 http 部署均可播本地 mp3）；无 Audio / 文件不可用 → 程序行军乐兜底。
// 只发声：不碰 gameState / save。静音持久化由 main.js 经 save.settings.muted 落地（main 调 setMuted + 写档）。

let ctx = null;            // AudioContext（懒建，供 SFX + 程序兜底 BGM）
let master = null;         // 主增益（SFX 静音闸门）
let muted = false;         // 静音标记（sfx/bgm 据此短路；与 master.gain / bgmEl.volume 同步）
let bgmTimer = null;       // 程序兜底 BGM 排程句柄
let bgmStep = 0;           // 程序兜底 BGM 音符游标
let ACFactory = null;      // 测试注入点（替换 AudioContext 构造器）
const lastAt = {};         // 每名节流时间戳（ctx.currentTime 秒）

// —— 文件 BGM 状态（西式管弦史诗轨，用 HTMLAudioElement 流播；程序乐作兜底）——
const bgmEls = [];         // 每轨 Audio 元素缓存：index → HTMLAudioElement
let bgmEl = null;          // 当前在播 Audio 元素
let bgmCurrent = -1;       // 当前在播文件轨 index（-1=无/程序兜底）
let bgmWanted = -1;        // 期望轨 index（startBgm 设）
let bgmFileActive = false; // 是否在播文件轨（区别程序兜底 timer）
let bgmOn = false;         // BGM 总开关（startBgm↔stopBgm 之间为 true）

// —— 测试钩子 ——（生产不用）
export function _setAudioContextFactory(f) { ACFactory = f; }   // 注入假 AudioContext
export function _reset() {                                       // 复位内部（多用例隔离）
  try { stopBgm(); } catch { /* ignore */ }
  stopVoice();
  for (const e of bgmEls) { if (e) { try { e.pause(); } catch { /* ignore */ } } }
  ctx = null; master = null; muted = false; bgmStep = 0;
  bgmEls.length = 0; bgmEl = null;
  bgmCurrent = -1; bgmWanted = -1; bgmFileActive = false; bgmOn = false;
  for (const k of Object.keys(lastAt)) delete lastAt[k];
}

function resolveAC() {
  if (ACFactory) return ACFactory;
  if (typeof window !== 'undefined') return window.AudioContext || window.webkitAudioContext || null;
  return null;
}

// 懒建（首次手势调用）。幂等；suspended 则尝试 resume（解锁 autoplay）。失败 → 保持静默。
export function init() {
  if (ctx) { try { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); } catch { /* ignore */ } return ctx; }
  try {
    const AC = resolveAC();
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(ctx.destination);
    if (ctx.state === 'suspended' && ctx.resume) { try { ctx.resume(); } catch { /* ignore */ } }
  } catch { ctx = null; master = null; }
  return ctx;
}

// 单音：osc(type, freq[→freq2 滑音]) + gain 指数包络 → master。begin=相对起始偏移（和弦/分解）。
function tone({ type = 'triangle', freq = 440, freq2 = null, dur = 0.08, gain = 0.12, begin = 0 } = {}) {
  if (!ctx || !master) return;
  try {
    const t0 = ctx.currentTime + begin;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freq2 != null && osc.frequency.exponentialRampToValueAtTime) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq2), t0 + dur);
    }
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + Math.min(0.02, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* 单音失败不影响其余 */ }
}

// 各音效 = 一组 tone()（短促、暖、五声音阶感）。命名见 sfx(name)。
const SFX = {
  fire:    () => tone({ type: 'square', freq: 620, freq2: 440, dur: 0.05, gain: 0.05 }),                                  // 开火（极短 pew）
  kill:    () => { tone({ freq: 740, dur: 0.06, gain: 0.08 }); tone({ freq: 990, dur: 0.07, gain: 0.06, begin: 0.04 }); }, // 命中击杀
  build:   () => { tone({ type: 'sine', freq: 392, dur: 0.08, gain: 0.1 }); tone({ type: 'sine', freq: 587, dur: 0.12, gain: 0.09, begin: 0.07 }); }, // 建造（上行二音）
  upgrade: () => [523, 659, 784].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.1, gain: 0.09, begin: i * 0.06 })),  // 升级（三和弦上行）
  sell:    () => tone({ type: 'sine', freq: 494, freq2: 330, dur: 0.14, gain: 0.09 }),                                    // 拆除（下滑）
  horn:    () => { tone({ type: 'sawtooth', freq: 233, dur: 0.28, gain: 0.07 }); tone({ type: 'sawtooth', freq: 311, dur: 0.34, gain: 0.06, begin: 0.12 }); }, // 出兵号角
  cityHit: () => tone({ type: 'sawtooth', freq: 150, freq2: 80, dur: 0.22, gain: 0.12 }),                                 // 成都受创
  victory: () => [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', freq: f, dur: 0.18, gain: 0.1, begin: i * 0.12 })),  // 胜·号角
  defeat:  () => [392, 311, 233, 175].forEach((f, i) => tone({ type: 'sawtooth', freq: f, dur: 0.22, gain: 0.1, begin: i * 0.14 })),   // 败·哀号
  ui:      () => tone({ type: 'triangle', freq: 660, dur: 0.05, gain: 0.07 }),                                            // UI 点按
};
// 高频音效节流（秒）：防同帧多发糊成噪声。
const THROTTLE = { fire: 0.05, kill: 0.03, cityHit: 0.05 };

// 播一个具名音效。muted 直接静默（不建 osc）；首次自动 init（懒初始化一次）。
export function sfx(name) {
  if (muted) return;
  if (!ctx) init();
  if (!ctx) return;
  const play = SFX[name];
  if (!play) return;
  const th = THROTTLE[name];
  if (th != null) {
    const t = ctx.currentTime;
    if (lastAt[name] != null && t - lastAt[name] < th) return;   // 节流窗内丢弃
    lastAt[name] = t;
  }
  play();
}

// —— 战争 BGM ——
// 主路：西式管弦史诗 mp3，HTMLAudioElement 流播（loop+volume）。本地文件在 file:// 双击与 http 部署下均可播
//       （区别 fetch+decodeAudioData：后者在 Chrome file:// 下被 CORS 拦）。BGM 不经 master，静音由 setMuted 同步 volume。
// 兜底：无 Audio（如 Node 测试）/ 文件不可用 → 程序行军乐（战鼓+号角，下方 bgmTick），绝不静默崩。
// 轨文件：CC-BY 4.0 · Kevin MacLeod · incompetech.com（见 assets/bgm/CREDITS.txt）。
const BGM_FILES = [
  'west-1-crossing-the-chasm.mp3',      // A · 每章首关开篇主题
  'west-2-five-armies.mp3',             // B
  'west-3-heroic-age.mp3',              // C
  'west-4-strength-of-the-titans.mp3',  // D
  'west-5-the-descent.mp3',             // E · 终关
];
const BGM_VOL = 0.35;                                             // BGM 音量（压在 SFX 之下；可调）

// 纯函数：关号(1-based) → 轨 index。章内 10 关恰好两轮 A→E；负/0 也安全。测试点。
export function bgmTrackForLevel(levelId) {
  const n = BGM_FILES.length;
  return (((levelId - 1) % n) + n) % n;
}
function bgmUrl(i) {
  try { return new URL('../../assets/bgm/' + BGM_FILES[i], import.meta.url).href; }
  catch { return null; }
}
// 取/建第 i 轨 Audio 元素（缓存 + preload）。无 Audio（Node）/ 建失败 → null（回退程序乐）。
function bgmAudio(i) {
  if (bgmEls[i]) return bgmEls[i];
  if (typeof Audio === 'undefined') return null;
  const url = bgmUrl(i);
  if (!url) return null;
  try {
    const el = new Audio(url);
    el.loop = true; el.preload = 'auto'; el.volume = muted ? 0 : BGM_VOL;
    bgmEls[i] = el;
    return el;
  } catch { return null; }
}
function prefetchNext(i) { bgmAudio((i + 1) % BGM_FILES.length); }   // 预建下一首元素 → 浏览器预缓冲，切关更顺
function stopBgmFile() {
  if (bgmEl) { try { bgmEl.pause(); } catch { /* ignore */ } }
  bgmEl = null; bgmFileActive = false;
}
function playBgmFile(i) {
  const el = bgmAudio(i);
  if (!el) return false;
  try {
    stopBgmProcedural();                                          // 切到文件轨：停程序兜底
    for (const e of bgmEls) { if (e && e !== el) { try { e.pause(); } catch { /* ignore */ } } }   // 防叠播
    el.volume = muted ? 0 : BGM_VOL;
    try { el.currentTime = 0; } catch { /* ignore */ }
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});    // autoplay 被拒：静默（下次手势再起）
    bgmEl = el; bgmCurrent = i; bgmFileActive = true;
    return true;
  } catch { return false; }
}

// —— 程序兜底：行军战鼓 + 低音号角动机（无 Audio / 文件不可用时）。muted 时不发声 ——
const BGM_STEP_MS = 300;                                          // ~100 BPM 行军（每 2 步一拍）
const BGM_HORN = [110, 0, 0, 0, 131, 0, 0, 0, 147, 0, 131, 0, 110, 0, 0, 0];   // A2→C3→D3→C3→A2 英雄小调,落重拍
function bgmTick() {
  if (muted || !ctx) return;
  const i = bgmStep % 16;
  bgmStep++;
  if (i % 2 === 0) tone({ type: 'sine', freq: 64, freq2: 38, dur: 0.13, gain: i % 8 === 0 ? 0.16 : 0.09 });  // 战鼓 boom（重拍加重）
  if (i % 4 === 2) tone({ type: 'square', freq: 2000, dur: 0.02, gain: 0.022 });                              // 反拍军鼓 click
  const f = BGM_HORN[i];
  if (f) {                                                                                                    // 低音号角（双层厚铜管）
    tone({ type: 'sawtooth', freq: f, dur: 0.62, gain: 0.06 });
    tone({ type: 'sawtooth', freq: f * 1.5, dur: 0.5, gain: 0.03, begin: 0.02 });
  }
}
function startBgmProcedural() {
  if (bgmTimer) return;
  if (!ctx) init();
  if (!ctx) return;
  try {
    bgmTimer = setInterval(bgmTick, BGM_STEP_MS);
    if (bgmTimer && typeof bgmTimer.unref === 'function') bgmTimer.unref();   // Node：不阻塞进程退出（浏览器 id 无 unref，忽略）
  } catch { bgmTimer = null; }
}
function stopBgmProcedural() {
  if (bgmTimer) { try { clearInterval(bgmTimer); } catch { /* ignore */ } bgmTimer = null; }
}

// 进关时调用：trackIndex=目标轨（main 用 bgmTrackForLevel 算）。省略=沿用当前期望轨。
// 文件轨流播（loop）；Audio 不可用则程序乐兜底。已在播该轨→幂等不重启。
export function startBgm(trackIndex) {
  if (typeof trackIndex === 'number' && trackIndex >= 0) bgmWanted = trackIndex % BGM_FILES.length;
  if (bgmWanted < 0) bgmWanted = 0;
  bgmOn = true;
  if (bgmFileActive && bgmCurrent === bgmWanted) return;         // 已在播目标文件轨：不重启
  const want = bgmWanted;
  if (playBgmFile(want)) { prefetchNext(want); return; }         // 文件轨直接流播（file:///http 均可）
  startBgmProcedural();                                          // 无 Audio：程序乐兜底
}
export function stopBgm() {
  bgmOn = false;
  stopBgmFile();
  stopBgmProcedural();
  bgmCurrent = -1;
}

// 静音开关：gate master（SFX）+ 同步 BGM 元素 volume + 标记（sfx/bgmTick 短路）。返回新 muted。不写 save。
export function setMuted(m) {
  muted = !!m;
  if (master) { try { master.gain.value = muted ? 0 : 0.9; } catch { /* ignore */ } }
  for (const e of bgmEls) { if (e) { try { e.volume = muted ? 0 : BGM_VOL; } catch { /* ignore */ } } }
  return muted;
}
export function isMuted() { return muted; }

// —— [演绎段2] 剧情语音(与 SFX/BGM 的 WebAudio 无关,走 HTMLAudio 流式,本地 mp3 即点即播)——
// 单实例:切句即停旧播新;muted 复用本模块静音态(静音≠跳过,字幕流程由调用方照走);
// 缺文件/autoplay 拒绝(无手势的 __td.showStory)→ .catch 静默,绝不影响演绎推进。
// preloadVoice:建 preload='auto' 实例交给浏览器 HTTP 缓存即弃(spec §4:逐句预热,无整关预载管理)。
let AudioFactory = typeof Audio !== 'undefined' ? (src) => new Audio(src) : null;
export function _setAudioFactory(f) { AudioFactory = f; }       // 单测注入
let voiceEl = null, voiceSrcNow = null;

export function playVoice(src) {
  stopVoice();
  if (!src || muted || !AudioFactory) return;
  try {
    voiceEl = AudioFactory(src); voiceSrcNow = src;
    const p = voiceEl.play();
    if (p && p.catch) p.catch(() => {});
  } catch { voiceEl = null; voiceSrcNow = null; }
}
export function stopVoice() {
  if (voiceEl) { try { voiceEl.pause(); } catch { /* 已释放 */ } }
  voiceEl = null; voiceSrcNow = null;
}
export function preloadVoice(src) {
  if (!src || !AudioFactory) return;
  try { const a = AudioFactory(src); a.preload = 'auto'; } catch { /* 静默 */ }
}
export function currentVoiceSrc() { return voiceSrcNow; }       // QA/冒烟断言
