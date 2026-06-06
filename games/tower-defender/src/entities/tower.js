// entities/tower.js — 将塔实例工厂。
import { BAL } from '../data/balance.js';

let _tid = 0;

export function createTower(generalId, slot) {
  return {
    id: ++_tid, generalId,
    slot: { x: slot.x, y: slot.y },
    px: slot.x * BAL.CELL + BAL.CELL / 2, py: slot.y * BAL.CELL + BAL.CELL / 2,
    level: 1, cooldown: 0, target: null, mode: 'first',   // M1 仅 first（最前）
  };
}
