// core/save.js — 进度档（注入 storage 的纯函数 + browser 包装）。copy-and-own 自 turbo-drift/src/save.js。
// render-free、可单测（注入假 storage）。key: save_td_v1。
// schema: { version, unlockedLevel, stars:{levelId:stars}, settings:{muted,speed} }

const KEY = 'save_td_v1';

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

// 浏览器便捷封装
export const browserLoad = () => loadSave(window.localStorage);
export const browserWrite = (s) => writeSave(window.localStorage, s);
