// systems/economySystem.js — 经济：建造扣金（输入触发）。
// M1 无周期性收入（屯田已砍）；掉金在 combat 同步、清波/提前出兵奖励在 waveSystem。
import { GENERALS } from '../data/generals.js';
import { createTower } from '../entities/tower.js';

// 每步占位（保持循环顺序统一；M1 无周期性经济）
export function economySystem(_state, _dt) { /* no-op */ }

export function canBuild(state, generalId) {
  return state.gold >= GENERALS[generalId].cost;
}

export function slotOccupied(state, slot) {
  return state.towers.some((t) => t.slot.x === slot.x && t.slot.y === slot.y);
}

// 返回 true=建成。买不起或将位已占 → false（UI 静默失败/置灰）。
export function tryBuild(state, slot, generalId) {
  if (!canBuild(state, generalId)) return false;
  if (slotOccupied(state, slot)) return false;
  state.gold -= GENERALS[generalId].cost;
  state.towers.push(createTower(generalId, slot));
  return true;
}
