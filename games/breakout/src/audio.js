// Tiny Web Audio sound effects — no asset files (same approach as js/hub.js blip()).
// The AudioContext is created lazily on first sound so it starts after a user gesture.

let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
    }
  }
  return ctx;
}

function tone(freq, dur, type = 'triangle', gainPeak = 0.12) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  try {
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainPeak, a.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    osc.connect(gain).connect(a.destination);
    osc.start();
    osc.stop(a.currentTime + dur);
  } catch {
    /* audio is optional */
  }
}

export const Sound = {
  setMuted(v) {
    muted = v;
  },
  toggleMuted() {
    muted = !muted;
    return muted;
  },
  isMuted() {
    return muted;
  },
  // Bright little ping when the ball clears a brick.
  brick() {
    tone(520 + Math.random() * 80, 0.07, 'triangle', 0.1);
  },
  hard() {
    tone(300, 0.08, 'square', 0.08);
  },
  paddle() {
    tone(220, 0.06, 'sine', 0.12);
  },
  wall() {
    tone(180, 0.04, 'sine', 0.07);
  },
  launch() {
    tone(660, 0.12, 'triangle', 0.12);
  },
  powerup() {
    tone(700, 0.08, 'triangle', 0.12);
    setTimeout(() => tone(950, 0.1, 'triangle', 0.12), 80);
  },
  loseLife() {
    tone(300, 0.18, 'sawtooth', 0.1);
    setTimeout(() => tone(180, 0.22, 'sawtooth', 0.1), 120);
  },
  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone(f, 0.16, 'triangle', 0.12), i * 110),
    );
  },
  win() {
    [523, 659, 784, 1047, 1319].forEach((f, i) =>
      setTimeout(() => tone(f, 0.2, 'triangle', 0.13), i * 140),
    );
  },
  gameOver() {
    [392, 330, 262].forEach((f, i) =>
      setTimeout(() => tone(f, 0.26, 'sawtooth', 0.1), i * 180),
    );
  },
  ui() {
    tone(440, 0.05, 'triangle', 0.08);
  },
};
