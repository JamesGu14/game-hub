// entities/enemy.js — 敌实例工厂。[P1] level.scale 在此落点（HP/掉金 × scale）。
import { ENEMIES } from '../data/enemies.js';
import { BAL } from '../data/balance.js';

let _id = 0;

export function createEnemy(type, pathId, path, scale = 1) {
  const def = ENEMIES[type];
  const s = path[0];
  return {
    id: ++_id, type, pathId,
    hp: def.hp * scale, maxHp: def.hp * scale, gold: Math.round(def.gold * scale),
    speed: def.speed, flying: !!def.flying, color: def.color,
    seg: 0, t: 0,                                   // 当前段起点 index + 段内进度
    gx: s.x, gy: s.y,                               // 格坐标（float）
    px: s.x * BAL.CELL + BAL.CELL / 2, py: s.y * BAL.CELL + BAL.CELL / 2, // 像素中心
    alive: true, statuses: {},
  };
}
