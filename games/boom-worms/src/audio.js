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

// ---------------------------------------------------------------------------
// Background music — a tiny procedural chiptune loop (synth only, no assets).
// Shares the AudioContext + `muted` flag with Sound. A look-ahead scheduler
// queues notes slightly ahead of the clock so timing stays solid regardless of
// frame rate. Muting silences it live; each level plays in its own key.
// ---------------------------------------------------------------------------

// Schedule one note at an ABSOLUTE AudioContext time `t` (vs tone(), which plays now).
function toneAt(t, { freq, dur, type = 'square', gain = 0.05 }) {
  const a = ac();
  if (!a) return;
  try {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  } catch {
    /* music is optional */
  }
}

const _midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// Major-pentatonic degrees (semitones) — always consonant, never sour.
const _SCALE = [0, 2, 4, 7, 9, 12, 14, 16];
// 16-step melodic motif as indices into _SCALE (-1 = rest). Gentle and bouncy.
const _MELODY = [0, 2, 4, 2, 4, 5, 4, 2, 7, 5, 4, 2, 0, 2, -1, -1];
// Bass note (scale degree) per quarter-note (every 4 steps): root, fifth, root, fourth.
const _BASS = [0, 4, 0, 3];
// Per-level tonic offset so each level has its own colour.
const _LEVEL_ROOT = [0, 2, 4, 5, 7, 9];
const _STEP_DUR = 0.15; // seconds per 1/16 step (~100 BPM feel)

let _mTimer = null;
let _mStep = 0;
let _mNextT = 0;
let _mRoot = 60; // MIDI tonic for the melody

function _scheduleMusic() {
  const a = ac();
  if (!a) return;
  // Queue every note due within the next ~120ms.
  while (_mNextT < a.currentTime + 0.12) {
    if (!muted) {
      const s = _mStep;
      // Bass on quarter notes (low triangle).
      if (s % 4 === 0) {
        const deg = _BASS[(s / 4) % _BASS.length];
        toneAt(_mNextT, { freq: _midi(_mRoot - 24 + deg), dur: 0.34, type: 'triangle', gain: 0.06 });
      }
      // Melody every step (with rests).
      const mi = _MELODY[s % _MELODY.length];
      if (mi >= 0) {
        toneAt(_mNextT, { freq: _midi(_mRoot + _SCALE[mi]), dur: 0.13, type: 'square', gain: 0.034 });
      }
      // Soft tick on offbeats for groove.
      if (s % 2 === 1) {
        toneAt(_mNextT, { freq: 7400, dur: 0.02, type: 'square', gain: 0.01 });
      }
    }
    _mNextT += _STEP_DUR;
    _mStep = (_mStep + 1) % 16;
  }
}

export const Music = {
  // Start the loop in the given level's key. Idempotent: a no-op while already
  // playing (so cycling aim→firing→… never restarts/stutters the tune).
  start(levelIndex = 0) {
    const a = ac();
    if (!a || _mTimer != null) return;
    if (a.state === 'suspended') a.resume().catch(() => {});
    _mRoot = 60 + (_LEVEL_ROOT[levelIndex % _LEVEL_ROOT.length] || 0);
    _mStep = 0;
    _mNextT = a.currentTime + 0.1;
    _mTimer = setInterval(_scheduleMusic, 30);
  },
  stop() {
    if (_mTimer != null) {
      clearInterval(_mTimer);
      _mTimer = null;
    }
  },
  isPlaying() {
    return _mTimer != null;
  },
};
