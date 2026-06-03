// audio/audio.js — 原创合成音效（WebAudio，全部程序化，无外部音频文件）
//
// 契约（Task C4）：
//   export const sfx = {
//     select(), move(), attack(), hit(), heal(), win(), lose(),
//     setMuted(bool),       // 接 game.settings.muted 与窗口静音开关
//     resume(),             // 用户手势时恢复 AudioContext
//     isMuted(),
//   }
//
// 设计：惰性创建 AudioContext（首次用户输入时），所有音色用振荡器 + 增益包络
// 现场合成，国风短促清脆的提示音。静音状态同步到 game.settings.muted 与
// window.__cczMuted（main.js / index.html 占位的静音约定）。
//
// 本模块仅依赖 WebAudio + window/game；不 import three。

import { game } from '../core/gameState.js';

let ctx = null;
let master = null;
let muted = false;

// 惰性建上下文（必须在用户手势内首次调用，浏览器才允许出声）。
function ensureCtx() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  } catch (_) {
    ctx = null;
  }
  return ctx;
}

// 用户手势时恢复（autoplay 策略）。
function resume() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') {
    c.resume().catch(() => {});
  }
  return c;
}

// 包络化的单振荡器音（带可选频率滑移）。
function blip(opts) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const {
    type = 'sine',
    freq = 440,
    toFreq = null,
    dur = 0.14,
    gain = 0.3,
    attack = 0.006,
    delay = 0,
  } = opts || {};
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (toFreq != null) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, toFreq), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(master || c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// 短促噪声爆（受击/攻击的金石质感），用衰减白噪声 + 带通近似。
function noiseBurst(opts) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const { dur = 0.16, gain = 0.28, freq = 1200, delay = 0 } = opts || {};
  const t0 = c.currentTime + delay;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) {
    // 指数衰减白噪声
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = 0.9;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp);
  bp.connect(g);
  g.connect(master || c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

// 短旋律（用于胜/负），notes:[{f,d}] 顺序播放。
function arpeggio(notes, { type = 'triangle', gain = 0.26, gap = 0.0 } = {}) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  let t = 0;
  for (const note of notes) {
    blip({ type, freq: note.f, dur: note.d, gain, delay: t });
    t += note.d + gap;
  }
}

export const sfx = {
  // 选中单位：清脆上扬短音。
  select() {
    blip({ type: 'triangle', freq: 660, toFreq: 880, dur: 0.1, gain: 0.22 });
  },
  // 移动：低柔踏步双音。
  move() {
    blip({ type: 'sine', freq: 300, dur: 0.08, gain: 0.18 });
    blip({ type: 'sine', freq: 240, dur: 0.1, gain: 0.16, delay: 0.07 });
  },
  // 出手攻击：下滑方波 + 轻噪。
  attack() {
    blip({ type: 'sawtooth', freq: 420, toFreq: 180, dur: 0.13, gain: 0.22 });
    noiseBurst({ dur: 0.1, gain: 0.14, freq: 900, delay: 0.02 });
  },
  // 命中：金石撞击噪爆 + 低顿。
  hit() {
    noiseBurst({ dur: 0.16, gain: 0.3, freq: 1500 });
    blip({ type: 'square', freq: 150, toFreq: 90, dur: 0.12, gain: 0.2 });
  },
  // 治疗：温润上行三音。
  heal() {
    arpeggio(
      [
        { f: 523, d: 0.1 },
        { f: 659, d: 0.1 },
        { f: 784, d: 0.16 },
      ],
      { type: 'sine', gain: 0.2 },
    );
  },
  // 胜利：明亮上行号角。
  win() {
    arpeggio(
      [
        { f: 523, d: 0.14 },
        { f: 659, d: 0.14 },
        { f: 784, d: 0.16 },
        { f: 1047, d: 0.34 },
      ],
      { type: 'triangle', gain: 0.28 },
    );
  },
  // 失败：沉降下行。
  lose() {
    arpeggio(
      [
        { f: 392, d: 0.18 },
        { f: 311, d: 0.2 },
        { f: 233, d: 0.4 },
      ],
      { type: 'sawtooth', gain: 0.22 },
    );
  },

  // 静音开关：同步 game.settings.muted + window.__cczMuted + master 增益。
  setMuted(value) {
    muted = !!value;
    if (game && game.state && game.state.settings) {
      game.state.settings.muted = muted;
    }
    if (typeof window !== 'undefined') window.__cczMuted = muted;
    if (master && ctx) {
      try {
        master.gain.setTargetAtTime(muted ? 0 : 0.5, ctx.currentTime, 0.02);
      } catch (_) {
        master.gain.value = muted ? 0 : 0.5;
      }
    }
    return muted;
  },

  isMuted() {
    return muted;
  },

  resume,
};

export default sfx;
