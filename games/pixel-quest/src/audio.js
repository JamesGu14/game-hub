// Web Audio SFX + a gentle looping background melody for 像素冒险 PIXEL QUEST.
// No asset files: everything is synthesized. AudioContext is created lazily on first
// sound so it starts after a user gesture. Respects the mute flag.

let ctx = null;
let muted = false;
let musicTimer = null;
let musicStep = 0;
let musicTheme = 'overworld';

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
  if (ctx && ctx.state === 'suspended') {
    try { ctx.resume(); } catch { /* ignore */ }
  }
  return ctx;
}

function tone(freq, dur, type = 'triangle', gainPeak = 0.12, when = 0) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  try {
    const t0 = a.currentTime + when;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch {
    /* audio is optional */
  }
}

function slide(f0, f1, dur, type = 'square', gainPeak = 0.1) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  try {
    const t0 = a.currentTime;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(gainPeak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

// Short, gentle, public-domain-feel loops per theme (original note sequences).
const MELODIES = {
  overworld: [523, 659, 784, 659, 523, 587, 659, 0, 494, 587, 659, 0, 523, 0, 392, 0],
  underground: [262, 0, 311, 0, 262, 0, 196, 0, 233, 0, 196, 0, 175, 0, 0, 0],
  sky: [659, 784, 880, 784, 659, 587, 523, 0, 587, 659, 784, 0, 880, 0, 659, 0],
  castle: [220, 0, 233, 0, 220, 0, 185, 0, 196, 0, 185, 0, 165, 0, 0, 0],
};

export const Sound = {
  setMuted(v) {
    muted = v;
    if (muted) Sound.stopMusic();
  },
  toggleMuted() {
    muted = !muted;
    if (muted) Sound.stopMusic();
    return muted;
  },
  isMuted() {
    return muted;
  },

  // ---- discrete SFX ----
  jump() { slide(420, 720, 0.16, 'square', 0.1); },
  stomp() { slide(500, 160, 0.12, 'square', 0.12); },
  coin() { tone(988, 0.07, 'square', 0.1); tone(1319, 0.12, 'square', 0.1, 0.06); },
  bump() { tone(160, 0.07, 'square', 0.1); },
  brickBreak() { tone(220, 0.05, 'square', 0.1); tone(130, 0.1, 'square', 0.09, 0.03); },
  powerupAppear() { tone(520, 0.08, 'triangle', 0.1); tone(700, 0.1, 'triangle', 0.1, 0.07); },
  powerupGet() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'triangle', 0.12, i * 0.07)); },
  fireball() { slide(700, 380, 0.1, 'sawtooth', 0.08); },
  kick() { slide(300, 520, 0.1, 'square', 0.1); },
  shell() { tone(420, 0.05, 'square', 0.09); },
  flag() { [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.14, 'triangle', 0.12, i * 0.1)); },
  oneUp() { [659, 784, 988, 1319].forEach((f, i) => tone(f, 0.13, 'triangle', 0.12, i * 0.09)); },
  hurt() { slide(440, 180, 0.3, 'sawtooth', 0.11); },
  die() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.11, i * 0.16)); },
  levelClear() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'triangle', 0.12, i * 0.11)); },
  gameOver() { [392, 330, 262].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.1, i * 0.2)); },
  win() { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.22, 'triangle', 0.13, i * 0.16)); },
  ui() { tone(523, 0.05, 'triangle', 0.08); },

  // ---- gentle looping background music ----
  startMusic(theme) {
    musicTheme = theme || 'overworld';
    musicStep = 0;
    if (musicTimer) return;
    if (muted) return;
    const seq = MELODIES[musicTheme] || MELODIES.overworld;
    musicTimer = setInterval(() => {
      if (muted) return;
      const f = seq[musicStep % seq.length];
      musicStep++;
      if (f > 0) tone(f, 0.16, 'triangle', 0.045);
    }, 200);
  },
  stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  },
};
