// Persistent save for 丛林勇士 (localStorage with an in-memory fallback so it runs in
// Node tests). Single JSON key. cleared state lives only in perLevel[id].cleared
// (spec §13 M6 — no separate clearedLevels list). Never throws on bad data.

import { STORAGE_KEY, STARS } from './config.js';

const VERSION = 1;

// In-memory shim used when localStorage is absent (Node) or unavailable (private mode).
const mem = (() => {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
})();

// Pick a backend ONCE: a real localStorage only if it actually round-trips (Node 25
// exposes a non-functional localStorage that throws on write — fall back to mem there).
let _be = null;
export function _backend() {
  if (_be) return _be;
  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      localStorage.setItem('__jw_probe__', '1');
      if (localStorage.getItem('__jw_probe__') === '1') {
        localStorage.removeItem('__jw_probe__');
        _be = localStorage;
        return _be;
      }
    }
  } catch { /* localStorage unavailable/broken */ }
  _be = mem;
  return _be;
}

function defaults() {
  return {
    version: VERSION,
    unlockedMax: 1,
    perLevel: {},
    settings: { mode: 'casual', volume: 1 },
    konami: false,
  };
}

function levelDefault() { return { cleared: false, bestTime: null, bestScore: 0, bestStars: 0 }; }

export function load() {
  let raw = null;
  try { raw = _backend().getItem(STORAGE_KEY); } catch { /* ignore */ }
  if (!raw) return defaults();
  let data;
  try { data = JSON.parse(raw); } catch { return defaults(); }
  if (!data || typeof data !== 'object' || data.version !== VERSION) {
    // Migration policy (spec §13): unknown/old version → safe reset (fill defaults).
    return defaults();
  }
  const d = defaults();
  return {
    version: VERSION,
    unlockedMax: Number.isFinite(data.unlockedMax) ? data.unlockedMax : d.unlockedMax,
    perLevel: data.perLevel && typeof data.perLevel === 'object' ? data.perLevel : {},
    settings: { ...d.settings, ...(data.settings || {}) },
    konami: !!data.konami,
  };
}

export function save(state) {
  try { _backend().setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function levelInfo(id) {
  const s = load();
  return { ...levelDefault(), ...(s.perLevel[id] || {}) };
}

export function markCleared(id, { time, score, stars }) {
  const s = load();
  const cur = { ...levelDefault(), ...(s.perLevel[id] || {}) };
  cur.cleared = true;
  if (score > cur.bestScore) cur.bestScore = score;
  if (stars > cur.bestStars) cur.bestStars = stars;
  if (cur.bestTime == null || (time != null && time < cur.bestTime)) cur.bestTime = time;
  s.perLevel[id] = cur;
  s.unlockedMax = Math.max(s.unlockedMax, id + 1);
  save(s);
  return s;
}

export function isUnlocked(id) { return id <= load().unlockedMax; }

export function getMode() { return load().settings.mode; }
export function setMode(m) { const s = load(); s.settings.mode = m; save(s); }

export function getKonami() { return load().konami; }
export function setKonami(v) { const s = load(); s.konami = !!v; save(s); }

export function reset() { const d = defaults(); save(d); return d; }

// ⭐ rating (spec §13 H8). casual = time only; classic = min(time tier, death tier).
export function rateStars({ time, deaths, mode }) {
  const timeTier = time <= STARS.timeThreshold ? 3 : (time <= STARS.timeThreshold * STARS.timeMul2 ? 2 : 1);
  if (mode === 'classic') {
    const deathTier = deaths === 0 ? 3 : (deaths <= 2 ? 2 : 1);
    return Math.min(timeTier, deathTier);
  }
  return timeTier;
}
