// save.js — 进度档（注入 storage 的纯函数 + browser 包装）。copy-and-own 自 tower-defender/src/core/save.js。
// key: save_bz_v1。schema: { version, unlockedLevel, stars:{levelId:stars}, settings:{muted} }
const KEY = 'save_bz_v1';
export const CURRENT_VERSION = 1;
const MIGRATIONS = {};   // 改 schema 时：CURRENT_VERSION+1 并在此注册 from→to 转换

export function _applyMigrations(d, migrations = MIGRATIONS, current = CURRENT_VERSION) {
  let v = Number.isInteger(d.version) ? d.version : 0, out = d;
  while (v < current && migrations[v]) { out = migrations[v](out); v++; }
  return out;
}

export function defaultSave() {
  return { version: CURRENT_VERSION, unlockedLevel: 1, stars: {}, settings: { muted: false } };
}

export function loadSave(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = _applyMigrations(JSON.parse(raw));
    const def = defaultSave();
    return {
      version: CURRENT_VERSION,
      unlockedLevel: Number.isInteger(d.unlockedLevel) && d.unlockedLevel >= 1 ? d.unlockedLevel : def.unlockedLevel,
      stars: d.stars && typeof d.stars === 'object' ? { ...d.stars } : {},
      settings: { muted: !!(d.settings && d.settings.muted) },
    };
  } catch { return defaultSave(); }
}

export function writeSave(storage, save) {
  try { storage.setItem(KEY, JSON.stringify(save)); } catch { /* 隐私模式/配额 → 忽略 */ }
  return save;
}

export function applyClear(save, levelId, stars) {
  const next = { version: CURRENT_VERSION, unlockedLevel: save.unlockedLevel, stars: { ...save.stars }, settings: { ...save.settings } };
  if (!next.stars[levelId] || stars > next.stars[levelId]) next.stars[levelId] = stars;
  if (levelId + 1 > next.unlockedLevel) next.unlockedLevel = levelId + 1;
  return next;
}

export const isUnlocked = (save, levelId) => levelId <= save.unlockedLevel;
export function nextPlayableIndex(save, total) {
  for (let i = 0; i < total; i++) { if (!save.stars[i + 1]) return i; }
  return Math.max(0, total - 1);
}

export const browserLoad = () => loadSave(window.localStorage);
export const browserWrite = (s) => writeSave(window.localStorage, s);
