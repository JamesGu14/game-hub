// games/turbo-drift/src/items.js
import { ITEM_KINDS } from './config.js';
import { rank } from './race.js';

export { ITEM_KINDS };

export function rollItem(rng) {
  return ITEM_KINDS[Math.floor(rng() * ITEM_KINDS.length)];
}

// 命中：有护盾则消耗护盾、不打转；否则设打转计时。永不淘汰。
export function applyHit(target, spinDur) {
  if (target.shield && target.shield > 0) {
    return { ...target, shield: 0 };
  }
  return { ...target, spinTimer: Math.max(target.spinTimer || 0, spinDur) };
}

// 名次紧邻 self 前一名的 racer id；self 是头名则 null
export function missileTarget(racers, trackLen, selfId) {
  const order = rank(racers, trackLen); // leader first
  const idx = order.indexOf(selfId);
  if (idx <= 0) return null;
  return order[idx - 1];
}
