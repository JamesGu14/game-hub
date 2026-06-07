// core/audio.js — 程序 WebAudio 音效子系统（SFX + 轻量 BGM + 静音）。Phase 6。
// 技法 copy-and-own 自 js/hub.js 的 blip（osc + gain 指数包络）；不 import 跨游戏（自含铁律）。
// 懒建 AudioContext（首次用户手势后 init()，绕 autoplay）；无 AudioContext / 被拒 → 全程静默不崩。
// 只发声：不碰 gameState / save。静音持久化由 main.js 经 save.settings.muted 落地（main 调 setMuted + 写档）。

let ctx = null;            // AudioContext（懒建）
let master = null;         // 主增益（静音闸门）
let muted = false;         // 静音标记（sfx/bgm 据此短路；与 master.gain 双保险）
let bgmTimer = null;       // BGM 排程句柄
let bgmStep = 0;           // BGM 音符游标
let ACFactory = null;      // 测试注入点（替换 AudioContext 构造器）
const lastAt = {};         // 每名节流时间戳（ctx.currentTime 秒）

// —— 测试钩子 ——（生产不用）
export function _setAudioContextFactory(f) { ACFactory = f; }   // 注入假 AudioContext
export function _reset() {                                       // 复位内部（多用例隔离）
  try { stopBgm(); } catch { /* ignore */ }
  ctx = null; master = null; muted = false; bgmStep = 0;
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

// —— 轻量 BGM：缓慢分解和弦循环（程序生成，无音频文件）。muted 时排程仍在但不发声 ——
const BGM_NOTES = [196, 262, 294, 392, 440, 392, 294, 262];   // G 五声·民谣感
export function startBgm() {
  if (bgmTimer) return;
  if (!ctx) init();
  if (!ctx) return;
  const tick = () => {
    if (muted || !ctx) return;
    const f = BGM_NOTES[bgmStep % BGM_NOTES.length];
    bgmStep++;
    tone({ type: 'sine', freq: f, dur: 0.5, gain: 0.035 });
    tone({ type: 'sine', freq: f * 1.5, dur: 0.4, gain: 0.018, begin: 0.06 });   // 五度泛音垫
  };
  try {
    bgmTimer = setInterval(tick, 620);
    if (bgmTimer && typeof bgmTimer.unref === 'function') bgmTimer.unref();   // Node：不阻塞进程退出（浏览器 id 无 unref，忽略）
  } catch { bgmTimer = null; }
}
export function stopBgm() {
  if (bgmTimer) { try { clearInterval(bgmTimer); } catch { /* ignore */ } bgmTimer = null; }
}

// 静音开关：gate master + 标记（sfx/bgm 短路）。返回新 muted。不写 save（main 负责持久化）。
export function setMuted(m) {
  muted = !!m;
  if (master) { try { master.gain.value = muted ? 0 : 0.9; } catch { /* ignore */ } }
  return muted;
}
export function isMuted() { return muted; }
