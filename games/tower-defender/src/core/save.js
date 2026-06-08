// core/save.js — 进度档（注入 storage 的纯函数 + browser 包装）。copy-and-own 自 turbo-drift/src/save.js。
// render-free、可单测（注入假 storage）。key: save_td_v1。
// schema: { version, unlockedLevel, stars:{levelId:stars}, settings:{muted,speed} }

const KEY = 'save_td_v1';
const RKEY = 'save_td_resume_v1';   // [检查点A·§5.4] 中断续玩快照 key

export function defaultSave() {
  return { version: 1, unlockedLevel: 1, stars: {}, settings: { muted: false, speed: 1 } };
}

export function loadSave(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw);
    const def = defaultSave();
    return {
      version: 1,
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
    version: 1,
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
export function resumeSnapshot(state) {
  return {
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
  try { const raw = storage && storage.getItem(RKEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
export function clearResume(storage) {
  try { storage.removeItem(RKEY); } catch { /* 忽略 */ }
}
export const browserWriteResume = (snap) => writeResume(window.localStorage, snap);
export const browserLoadResume = () => loadResume(window.localStorage);
export const browserClearResume = () => clearResume(window.localStorage);
