// games/turbo-drift/src/audio.js
let ctx = null, muted = false;
let engineOsc = null, engineGain = null;

function ac() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); return ctx; }

function blip(freq, dur, type = 'triangle', vol = 0.15) {
  if (muted) return;
  try {
    const c = ac(); const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  } catch {}
}

export const Audio = {
  unlock() { try { ac().resume(); } catch {} },
  setMuted(m) { muted = m; if (m && engineGain) engineGain.gain.value = 0; },
  startEngine() {
    if (muted || engineOsc) return;
    try {
      const c = ac(); engineOsc = c.createOscillator(); engineGain = c.createGain();
      engineOsc.type = 'sawtooth'; engineOsc.frequency.value = 80;
      engineGain.gain.value = 0.05;
      engineOsc.connect(engineGain).connect(c.destination); engineOsc.start();
    } catch {}
  },
  engine(speedRatio) {
    if (muted || !engineOsc) return;
    engineOsc.frequency.value = 70 + speedRatio * 180;
    engineGain.gain.value = 0.03 + speedRatio * 0.04;
  },
  stopEngine() { try { engineOsc && engineOsc.stop(); } catch {} engineOsc = null; engineGain = null; },
  drift() { blip(180, 0.08, 'sawtooth', 0.08); },
  nitro() { blip(520, 0.4, 'square', 0.16); },
  pickup() { blip(880, 0.12, 'triangle', 0.16); },
  hit() { blip(120, 0.25, 'square', 0.18); },
  countdownBeep(go) { blip(go ? 880 : 440, go ? 0.4 : 0.15, 'square', 0.2); },
  win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'triangle', 0.18), i * 140)); },
};
