// systems/economySystem.js — 经济：建造/升级/拆除扣金（输入触发）。
// 无周期性收入（屯田已砍）；掉金在 combat 同步、清波/提前出兵奖励在 waveSystem。
import { GENERALS } from '../data/generals.js';
import { BAL } from '../data/balance.js';
import { createTower } from '../entities/tower.js';

// 每步占位（保持循环顺序统一；无周期性经济）
export function economySystem(_state, _dt) { /* no-op */ }

export function canBuild(state, generalId) {
  if (state.unlocked && !state.unlocked.has(generalId)) return false;   // [spec §3] 未解锁不可建
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

// —— 升级造价（§17.1 L2/L3 + §5.3 L4/L5）。封顶仍由 MAX_TOWER_LEVEL 判定 ——
const UP_COST_MULT = { 1: BAL.UPGRADE_COST_L2, 2: BAL.UPGRADE_COST_L3, 3: BAL.UPGRADE_COST_L4, 4: BAL.UPGRADE_COST_L5 };
export function upgradeCost(tower) {
  if (tower.level >= BAL.MAX_TOWER_LEVEL) return Infinity;
  const base = GENERALS[tower.generalId].cost;
  return Math.round(base * UP_COST_MULT[tower.level]);
}

export function canUpgrade(state, tower) {
  return tower.level < BAL.MAX_TOWER_LEVEL && state.gold >= upgradeCost(tower);
}

// 返回 true=升级成功。满级或买不起 → false。
export function tryUpgrade(state, tower) {
  if (!canUpgrade(state, tower)) return false;
  const cost = upgradeCost(tower);
  state.gold -= cost;
  tower.totalInvested += cost;     // 拆除返还基数累加
  tower.level += 1;
  return true;
}

// —— [P2] 拆除（返还 = 总投入 ×0.6）——
export function sellRefund(tower) {
  return Math.floor(tower.totalInvested * BAL.SELL_REFUND);
}

// 返回返还金额（0=塔不在场上）。
export function sellTower(state, tower) {
  const i = state.towers.indexOf(tower);
  if (i < 0) return 0;
  state.towers.splice(i, 1);
  const refund = sellRefund(tower);
  state.gold += refund;
  return refund;
}
