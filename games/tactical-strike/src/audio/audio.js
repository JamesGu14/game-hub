// audio.js — Web Audio API sound engine (no external files)

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------
export let ctx = null;
export let masterGain = null;
export let noiseBuffer = null;
export let concurrentShots = 0;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Clamp a value between min and max.
 */
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

/**
 * Apply a simple attack/decay envelope to a GainNode.
 * @param {GainNode} gainNode
 * @param {number} attack  - attack time in seconds
 * @param {number} decay   - decay time in seconds
 * @param {number} dur     - total duration in seconds (used to schedule final ramp)
 */
function makeEnvelope(gainNode, attack, decay, dur) {
  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(1, now + attack);
  gainNode.gain.linearRampToValueAtTime(0, now + attack + decay);
  // Ensure silence after full duration
  if (attack + decay < dur) {
    gainNode.gain.setValueAtTime(0, now + dur);
  }
}

/**
 * Create a BufferSourceNode playing the pre-generated noiseBuffer
 * trimmed to durationSec by scheduling stop.
 * Caller must connect and start.
 * @param {number} durationSec
 * @returns {AudioBufferSourceNode}
 */
function makeNoiseSource(durationSec) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = false;
  return src;
}

/**
 * Play a single oscillator burst connected to masterGain.
 * @param {OscillatorType} type  - oscillator type string
 * @param {number} freq          - frequency in Hz
 * @param {number} dur           - duration in seconds
 * @param {{ attack: number, decay: number }} env - envelope times in seconds
 */
function playOscBurst(type, freq, dur, env) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);

  makeEnvelope(gain, env.attack, env.decay, dur);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + dur);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialise the AudioContext, master gain, and pre-generate white noise.
 * Safe to call multiple times (no-op after first successful init).
 */
export function initAudio() {
  if (ctx) return;

  ctx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = ctx.createGain();
  masterGain.gain.value = 0.6;
  masterGain.connect(ctx.destination);

  // Pre-generate 1 second of white noise
  const sampleRate = ctx.sampleRate;
  const frameCount = sampleRate * 1; // 1 second
  noiseBuffer = ctx.createBuffer(1, frameCount, sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < frameCount; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  if (ctx.state === 'suspended') {
    ctx.resume();
  }
}

/**
 * Set master volume.
 * @param {number} v - value in [0, 1]
 */
export function setVolume(v) {
  if (!masterGain) return;
  masterGain.gain.value = clamp(v, 0, 1);
}

/**
 * Play a gunshot sound shaped by weaponType ('rifle' | 'pistol').
 * Concurrent shots are capped at 8.
 * @param {'rifle'|'pistol'} weaponType
 */
export function playGunshot(weaponType) {
  if (!ctx) return;
  if (concurrentShots >= 8) return;
  concurrentShots++;

  const profiles = {
    pistol: { dur: 0.09, bpFreq: 700, bpQ: 9,  hpFreq: null, oscType: 'sine',     oscFreq: 220, oscGain: 0.35 },
    smg:    { dur: 0.07, bpFreq: 900, bpQ: 12, hpFreq: null, oscType: 'sine',     oscFreq: 160, oscGain: 0.30 },
    rifle:  { dur: 0.14, bpFreq: 800, bpQ: 8,  hpFreq: 200,  oscType: 'sawtooth', oscFreq: 110, oscGain: 0.40 },
    sniper: { dur: 0.28, bpFreq: 400, bpQ: 6,  hpFreq: 100,  oscType: 'sawtooth', oscFreq: 60,  oscGain: 0.55 },
  };
  const p = profiles[weaponType] || profiles.rifle;
  const now = ctx.currentTime;
  const durationSec = p.dur;

  const noiseSrc = makeNoiseSource(durationSec);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(1, now + 0.002);
  noiseGain.gain.linearRampToValueAtTime(0, now + durationSec);

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = p.bpFreq;
  bp.Q.value = p.bpQ;
  noiseSrc.connect(bp);

  let lastFilter = bp;
  if (p.hpFreq != null) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = p.hpFreq;
    bp.connect(hp);
    lastFilter = hp;
  }
  lastFilter.connect(noiseGain);
  noiseGain.connect(masterGain);

  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = p.oscType;
  osc.frequency.setValueAtTime(p.oscFreq, now);
  const attack = 0.002;
  const decay = durationSec - attack;
  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(p.oscGain, now + attack);
  oscGain.gain.linearRampToValueAtTime(0, now + attack + decay);
  osc.connect(oscGain);
  oscGain.connect(masterGain);

  noiseSrc.start(now);
  noiseSrc.stop(now + durationSec);
  osc.start(now);
  osc.stop(now + durationSec);

  setTimeout(() => { concurrentShots = Math.max(0, concurrentShots - 1); }, durationSec * 1000 + 50);
}

/** Knife swing whoosh. */
export function playKnifeSwing() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 0.12;
  const noiseSrc = makeNoiseSource(dur);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 250; bp.Q.value = 4;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.4, now + 0.005);
  gain.gain.linearRampToValueAtTime(0, now + dur);
  noiseSrc.connect(bp); bp.connect(gain); gain.connect(masterGain);
  noiseSrc.start(now); noiseSrc.stop(now + dur);
}

/** Knife hit clang. */
export function playKnifeHit() {
  if (!ctx) return;
  const now = ctx.currentTime;
  const dur = 0.05;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle'; osc.frequency.setValueAtTime(880, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.5, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
  osc.connect(gain); gain.connect(masterGain);
  osc.start(now); osc.stop(now + dur);
}

/**
 * Play a two-click reload sound: 600 Hz then 800 Hz, 40ms each, 100ms apart.
 */
export function playReload() {
  if (!ctx) return;

  const playClick = (freq, offsetSec) => {
    const now = ctx.currentTime + offsetSec;
    const dur = 0.04; // 40ms
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    // Sharp envelope: very short attack, decay to fill duration
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + dur);
  };

  playClick(600, 0);
  playClick(800, 0.1); // 100ms apart
}

/**
 * Play a footstep: sine 60 Hz through lowpass 300 Hz, 90ms total.
 */
export function playFootstep() {
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.09; // 90ms
  const attack = 0.005; // 5ms
  const decay = 0.08;   // 80ms

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lp = ctx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(60, now);

  lp.type = 'lowpass';
  lp.frequency.value = 300;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(1, now + attack);
  gain.gain.linearRampToValueAtTime(0, now + attack + decay);

  osc.connect(lp);
  lp.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + dur);
}

/**
 * Play a hit marker: two simultaneous sines 880 Hz + 1320 Hz, 60ms, sharp attack.
 */
export function playHitMarker() {
  if (!ctx) return;

  const dur = 0.06; // 60ms
  [880, 1320].forEach((freq) => {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(now);
    osc.stop(now + dur);
  });
}

/**
 * Play a player-hit sound: noise burst 220ms through bandpass 400 Q2
 * plus a sine 200 Hz with lowpass sweep 800→200 Hz over 200ms.
 */
export function playPlayerHit() {
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.22; // 220ms

  // --- Noise burst ---
  const noiseSrc = makeNoiseSource(dur);
  const noiseGain = ctx.createGain();
  const bp = ctx.createBiquadFilter();

  bp.type = 'bandpass';
  bp.frequency.value = 400;
  bp.Q.value = 2;

  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.8, now + 0.005);
  noiseGain.gain.linearRampToValueAtTime(0, now + dur);

  noiseSrc.connect(bp);
  bp.connect(noiseGain);
  noiseGain.connect(masterGain);

  noiseSrc.start(now);
  noiseSrc.stop(now + dur);

  // --- Sine with lowpass cutoff sweep ---
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  const lp = ctx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(200, now);

  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(800, now);
  lp.frequency.linearRampToValueAtTime(200, now + dur);

  oscGain.gain.setValueAtTime(0, now);
  oscGain.gain.linearRampToValueAtTime(0.6, now + 0.005);
  oscGain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(lp);
  lp.connect(oscGain);
  oscGain.connect(masterGain);

  osc.start(now);
  osc.stop(now + dur);
}

/**
 * Play a death sound: sine glide 400→80 Hz over 700ms with lowpass 500 Hz.
 */
export function playDeath() {
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.7; // 700ms

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lp = ctx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(400, now);
  osc.frequency.linearRampToValueAtTime(80, now + dur);

  lp.type = 'lowpass';
  lp.frequency.value = 500;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.7, now + 0.01);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(lp);
  lp.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + dur);
}

/**
 * Play a bot-death sound: sine glide 300→100 Hz over 350ms with lowpass 500 Hz.
 */
export function playBotDeath() {
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.35; // 350ms

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const lp = ctx.createBiquadFilter();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(300, now);
  osc.frequency.linearRampToValueAtTime(100, now + dur);

  lp.type = 'lowpass';
  lp.frequency.value = 500;

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.6, now + 0.01);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(lp);
  lp.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + dur);
}

/**
 * Play a round-win staccato arpeggio: C4 → E4 → G4, 80ms each.
 */
export function playRoundWin() {
  if (!ctx) return;

  const notes = [261.63, 329.63, 392.0]; // C4, E4, G4
  const noteDur = 0.08; // 80ms each
  const gap = 0.085; // slight gap between notes

  notes.forEach((freq, i) => {
    const start = ctx.currentTime + i * gap;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, start);

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.6, start + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, start + noteDur);

    osc.connect(gain);
    gain.connect(masterGain);

    osc.start(start);
    osc.stop(start + noteDur);
  });
}

/**
 * Play a round-lose sound: sine glide G3(196 Hz) → Eb3(155.56 Hz) over 600ms.
 */
export function playRoundLose() {
  if (!ctx) return;

  const now = ctx.currentTime;
  const dur = 0.6; // 600ms

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(196, now);         // G3
  osc.frequency.linearRampToValueAtTime(155.56, now + dur); // Eb3

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.6, now + 0.01);
  gain.gain.linearRampToValueAtTime(0, now + dur);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + dur);
}
