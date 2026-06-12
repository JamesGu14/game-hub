// core/save.js — 进度档（注入 storage 的纯函数 + browser 包装）。copy-and-own 自 turbo-drift/src/save.js。
// render-free、可单测（注入假 storage）。key: save_td_v1。
// schema: { version, unlockedLevel, stars:{levelId:stars}, settings:{muted,speed} }

const KEY = 'save_td_v1';
const RKEY = 'save_td_resume_v1';   // [检查点A·§5.4] 中断续玩快照 key

// [C1] 存档 schema 版本。改 schema 时：①CURRENT_VERSION+1 ②在 MIGRATIONS 注册 from→to 的转换函数。
// 迁移先于字段归一化执行；归一化(loadSave 末段)是纵深防御兜底，不替代迁移。
export const CURRENT_VERSION = 1;

// MIGRATIONS[v] = (旧版 v 形状的对象) => (v+1 形状的对象)。随 schema 演进追加，例：
//   1: (d) => ({ ...d, progress: d.unlockedLevel, unlockedLevel: undefined, version: 2 }),
// 缺 version 的远古档视作 v0；链中断(缺某步)则停在该版本，由归一化兜底。游戏运行时不修改此表。
const MIGRATIONS = {};

// 注入式纯函数（migrations/current 可注入 → 单测证明链按序执行，非死代码）。
export function _applyMigrations(d, migrations = MIGRATIONS, current = CURRENT_VERSION) {
  let v = Number.isInteger(d.version) ? d.version : 0;
  let out = d;
  while (v < current && migrations[v]) { out = migrations[v](out); v++; }
  return out;
}

export function defaultSave() {
  return { version: CURRENT_VERSION, unlockedLevel: 1, stars: {}, settings: { muted: false, speed: 1 } };
}

export function loadSave(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = _applyMigrations(JSON.parse(raw));   // [C1] 先升级到当前 schema
    const def = defaultSave();
    return {
      version: CURRENT_VERSION,
      unlockedLevel: Number.isInteger(d.unlockedLevel) && d.unlockedLevel >= 1 ? d.unlockedLevel : def.unlockedLevel,
      stars: d.stars && typeof d.stars === 'object' ? { ...d.stars } : {},
      settings: {
        muted: !!(d.settings && d.settings.muted),
        speed: d.settings && [1, 2].includes(d.settings.speed) ? d.settings.speed : 1,
      },
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage, save) {
  try { storage.setItem(KEY, JSON.stringify(save)); } catch { /* 隐私模式/配额 → 忽略 */ }
  return save;
}

// 通关合入：取更高星 + 解锁下一关（纯函数，返回新对象）
export function applyClear(save, levelId, stars) {
  const next = {
    version: CURRENT_VERSION,
    unlockedLevel: save.unlockedLevel,
    stars: { ...save.stars },
    settings: { ...save.settings },
  };
  if (!next.stars[levelId] || stars > next.stars[levelId]) next.stars[levelId] = stars;
  if (levelId + 1 > next.unlockedLevel) next.unlockedLevel = levelId + 1;
  return next;
}

// [P4] 选关助手(纯函数)。levelId 1-based;LEVELS 索引 0-based。
export function isUnlocked(save, levelId) {
  return levelId <= save.unlockedLevel;
}
// 「下一未通关」的 0-based 索引(全通关 → 末关)。total = LEVELS.length。
export function nextPlayableIndex(save, total) {
  for (let i = 0; i < total; i++) { if (!save.stars[i + 1]) return i; }
  return Math.max(0, total - 1);
}

// 浏览器便捷封装
export const browserLoad = () => loadSave(window.localStorage);
export const browserWrite = (s) => writeSave(window.localStorage, s);

// —— [检查点A·§5.4] 中断续玩：state 快照 写/读/清（注入式纯函数，可单测）——
// 退出游戏中（非结算）写快照；重进该关给「续上次/重头」；胜/负/退到选关清除。
// [C1] 快照形状随 state schema 变化；版本不匹配即丢弃（loadResume），从本波备战起点重放，无损。
export const RESUME_VERSION = 1;
export function resumeSnapshot(state) {
  return {
    version: RESUME_VERSION,
    levelId: state.level.id,
    waveIndex: state.waveIndex,
    gold: state.gold,
    castleHp: state.castleHp,
    phase: state.phase,
    prepTimer: state.prepTimer,
    towers: state.towers.map((t) => ({ generalId: t.generalId, slot: { x: t.slot.x, y: t.slot.y }, level: t.level, mode: t.mode })),
    seed: state.level.id,
  };
}
export function writeResume(storage, snap) {
  try { storage.setItem(RKEY, JSON.stringify(snap)); } catch { /* 隐私模式/配额 → 忽略 */ }
}
export function loadResume(storage) {
  try {
    const raw = storage && storage.getItem(RKEY);
    if (!raw) return null;
    const snap = JSON.parse(raw);
    if (!snap || snap.version !== RESUME_VERSION) return null;   // [C1] 版本不匹配/无版本 → 丢弃
    return snap;
  } catch { return null; }
}
export function clearResume(storage) {
  try { storage.removeItem(RKEY); } catch { /* 忽略 */ }
}
export const browserWriteResume = (snap) => writeResume(window.localStorage, snap);
export const browserLoadResume = () => loadResume(window.localStorage);
export const browserClearResume = () => clearResume(window.localStorage);
