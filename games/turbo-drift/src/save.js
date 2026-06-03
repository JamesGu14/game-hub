// games/turbo-drift/src/save.js
import { unlockFor } from './cars.js';

const KEY = 'turbo-drift.save';

export function defaultSave() {
  return { unlocked: ['lightning'], bestLap: {}, lastCar: 'lightning', progress: {} };
}

export function loadSave(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = JSON.parse(raw);
    const def = defaultSave();
    return {
      unlocked: Array.isArray(d.unlocked) && d.unlocked.length ? d.unlocked : def.unlocked,
      bestLap: d.bestLap && typeof d.bestLap === 'object' ? d.bestLap : {},
      lastCar: typeof d.lastCar === 'string' ? d.lastCar : def.lastCar,
      progress: d.progress && typeof d.progress === 'object' ? d.progress : {},
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(storage, save) {
  try { storage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
  return save;
}

// 完赛结果合入存档（纯函数，返回新对象）
export function applyResult(save, trackId, place, lapMs) {
  const next = {
    unlocked: [...save.unlocked],
    bestLap: { ...save.bestLap },
    lastCar: save.lastCar,
    progress: { ...save.progress },
  };
  const car = unlockFor(trackId, place);
  if (car && !next.unlocked.includes(car)) next.unlocked.push(car);
  if (lapMs != null && (next.bestLap[trackId] == null || lapMs < next.bestLap[trackId])) {
    next.bestLap[trackId] = lapMs;
  }
  next.progress[trackId] = place === 1 ? 'win' : (place <= 3 ? 'podium' : 'raced');
  return next;
}

// 浏览器便捷封装
export const browserLoad = () => loadSave(window.localStorage);
export const browserWrite = save => writeSave(window.localStorage, save);
