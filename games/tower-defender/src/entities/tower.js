// entities/tower.js — 将塔实例工厂。
import { BAL } from '../data/balance.js';
import { GENERALS } from '../data/generals.js';

let _tid = 0;

export function createTower(generalId, slot) {
  return {
    id: ++_tid, generalId,
    slot: { x: slot.x, y: slot.y },
    px: slot.x * BAL.CELL + BAL.CELL / 2, py: slot.y * BAL.CELL + BAL.CELL / 2,
    level: 1, cooldown: 0, target: null,
    mode: 'first',                                  // [P2] first | last | strongest | weakest
    totalInvested: GENERALS[generalId].cost,        // [P2] 拆除返还基数（建造+各级升级累加）
    signatureCd: 0,                                 // [P2] L3 冷却技计时（单时钟 dt 递减）
  };
}
