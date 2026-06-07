// Web Audio SFX for 丛林勇士. No asset files: tones are synthesized. AudioContext is
// created lazily on first sound (after a user gesture). play(id) maps the ids that
// world.playSound(id) emits. BGM arrives in M5.

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); }
    catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch { /* ignore */ } }
  return ctx;
}

function tone(freq, dur, type = 'square', gainPeak = 0.1, when = 0) {
  if (muted) return;
  const a = ac(); if (!a) return;
  try {
    const t0 = a.currentTime + when;
    const osc = a.createOscillator(); const gain = a.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* audio is optional */ }
}

function slide(f0, f1, dur, type = 'square', gainPeak = 0.1) {
  if (muted) return;
  const a = ac(); if (!a) return;
  try {
    const t0 = a.currentTime;
    const osc = a.createOscillator(); const gain = a.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
    gain.gain.setValueAtTime(gainPeak, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(a.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  } catch { /* ignore */ }
}

const SFX = {
  shoot() { tone(880, 0.05, 'square', 0.06); },
  jump() { slide(420, 760, 0.16, 'square', 0.09); },
  land() { tone(180, 0.05, 'square', 0.06); },
  hit() { slide(520, 160, 0.14, 'square', 0.11); },
  die() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.2, 'sawtooth', 0.1, i * 0.14)); },
  clear() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'triangle', 0.12, i * 0.11)); },
  ui() { tone(523, 0.05, 'triangle', 0.07); },
  pickup() { [659, 988, 1319].forEach((f, i) => tone(f, 0.1, 'triangle', 0.1, i * 0.05)); },
  barrier() { tone(330, 0.18, 'sine', 0.1); tone(495, 0.22, 'sine', 0.08, 0.06); },
  combo() { tone(1319, 0.05, 'square', 0.07); },
};

export const Sound = {
  setMuted(v) { muted = v; },
  toggleMuted() { muted = !muted; return muted; },
  isMuted() { return muted; },
  // Dispatcher used by world.playSound(id).
  play(id) { const fn = SFX[id]; if (fn) fn(); },
};
