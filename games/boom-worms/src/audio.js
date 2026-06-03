// Tiny Web Audio sound effects — no asset files, synth only.
// AudioContext is created lazily on first sound (after a user gesture).

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

function tone({ freq, dur, type = 'square', gain = 0.12, slideTo = null }) {
  if (muted) return;
  const a = ac();
  if (!a) return;
  try {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo !== null) {
      osc.frequency.setValueAtTime(freq, a.currentTime);
      osc.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
    }
    g.gain.setValueAtTime(0.0001, a.currentTime);
    g.gain.exponentialRampToValueAtTime(gain, a.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
    osc.connect(g).connect(a.destination);
    osc.start();
    osc.stop(a.currentTime + dur);
  } catch {
    /* audio is optional */
  }
}

export const Sound = {
  toggleMuted() {
    muted = !muted;
    return muted;
  },
  isMuted() {
    return muted;
  },
  resume() {
    const a = ac();
    if (a && a.state === 'suspended') a.resume().catch(() => {});
  },

  // --- gameplay SFX ---

  // charge(level 0..1): pitch rises as hold builds power
  charge(level = 0) {
    const freq = 200 + level * 600; // 200 Hz (empty) → 800 Hz (full)
    tone({ freq, dur: 0.06, type: 'triangle', gain: 0.06 + level * 0.04 });
  },

  // fire(weaponKey): distinct launch SFX per weapon
  fire(weaponKey) {
    switch (weaponKey) {
      case 'bazooka':
        tone({ freq: 280, dur: 0.12, type: 'sawtooth', gain: 0.13, slideTo: 80 });
        break;
      case 'grenade':
        tone({ freq: 360, dur: 0.08, type: 'square', gain: 0.1 });
        break;
      case 'dynamite':
        tone({ freq: 160, dur: 0.1, type: 'square', gain: 0.1 });
        break;
      case 'shotgun':
        tone({ freq: 220, dur: 0.05, type: 'sawtooth', gain: 0.14 });
        setTimeout(() => tone({ freq: 200, dur: 0.05, type: 'sawtooth', gain: 0.12 }), 60);
        break;
      case 'firepunch':
        tone({ freq: 180, dur: 0.09, type: 'square', gain: 0.12, slideTo: 300 });
        break;
      case 'airstrike':
        tone({ freq: 660, dur: 0.18, type: 'sawtooth', gain: 0.1, slideTo: 200 });
        break;
      case 'holy':
        tone({ freq: 523, dur: 0.12, type: 'triangle', gain: 0.12 });
        setTimeout(() => tone({ freq: 784, dur: 0.12, type: 'triangle', gain: 0.12 }), 80);
        break;
      default:
        tone({ freq: 280, dur: 0.08, type: 'square', gain: 0.1 });
    }
  },

  // explode(big): small or large boom
  explode(big = false) {
    if (big) {
      tone({ freq: 180, dur: 0.5, type: 'sawtooth', gain: 0.18, slideTo: 30 });
      setTimeout(() => tone({ freq: 100, dur: 0.4, type: 'sawtooth', gain: 0.14, slideTo: 30 }), 80);
    } else {
      tone({ freq: 220, dur: 0.22, type: 'sawtooth', gain: 0.13, slideTo: 50 });
    }
  },

  // splash: worm falls into water
  splash() {
    tone({ freq: 600, dur: 0.08, type: 'sine', gain: 0.1, slideTo: 200 });
    setTimeout(() => tone({ freq: 300, dur: 0.14, type: 'sine', gain: 0.08, slideTo: 100 }), 60);
  },

  // pickup: crate collected
  pickup() {
    tone({ freq: 600, dur: 0.07, type: 'triangle', gain: 0.11 });
    setTimeout(() => tone({ freq: 900, dur: 0.09, type: 'triangle', gain: 0.11 }), 80);
  },

  // jump: worm jumps
  jump() {
    tone({ freq: 320, dur: 0.1, type: 'triangle', gain: 0.1, slideTo: 600 });
  },

  // land: worm lands on ground
  land() {
    tone({ freq: 100, dur: 0.08, type: 'triangle', gain: 0.09, slideTo: 60 });
  },

  // turn: next worm's turn begins
  turn() {
    tone({ freq: 440, dur: 0.07, type: 'triangle', gain: 0.1 });
    setTimeout(() => tone({ freq: 550, dur: 0.07, type: 'triangle', gain: 0.1 }), 80);
  },

  // levelClear: level completed
  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, dur: 0.14, type: 'triangle', gain: 0.12 }), i * 110)
    );
  },

  // gameOver: player loses
  gameOver() {
    [392, 330, 262].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, dur: 0.24, type: 'sawtooth', gain: 0.1 }), i * 180)
    );
  },

  // win: campaign complete
  win() {
    [523, 659, 784, 1047, 1319, 1047].forEach((f, i) =>
      setTimeout(() => tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.13 }), i * 110)
    );
  },

  // ui: generic button click / menu interaction
  ui() {
    tone({ freq: 440, dur: 0.05, type: 'triangle', gain: 0.08 });
  },
};
