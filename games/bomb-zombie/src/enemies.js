// enemies.js — 兵种工厂与下行运动。纯逻辑。
import { ENEMIES, WALL, LANES, FIELD } from './config.js';

export const laneX = (lane) => {
  const cell = FIELD.W / LANES;
  return cell * (lane + 0.5);
};

export function makeEnemy(type, lane, id) {
  const d = ENEMIES[type];
  return {
    id, type, lane,
    x: laneX(lane), y: -d.r - 4,
    hp: d.hp, hpMax: d.hp, r: d.r,
    speed: d.speed, atk: d.atk, attackInterval: d.attackInterval, atkTimer: 0,
    xp: d.xp, color: d.color,
    dots: [], frozen: 0, atWall: false,
    frontShield: d.frontShield || 0,
    explodeDmg: d.explodeDmg || 0, explodeR: d.explodeR || 0,
    range: d.range || 0, spitDmg: d.spitDmg || 0, spitInterval: d.spitInterval || 0, spitTimer: 0,
    summonInterval: d.summonInterval || 0, summonTimer: 0, summonType: d.summonType || null,
  };
}

export function stepEnemy(e, dt) {
  if (e.atWall) return true;
  const slow = e.frozen > 0 ? 0.4 : 1;
  e.y += e.speed * slow * dt;
  if (e.frozen > 0) e.frozen = Math.max(0, e.frozen - dt);
  if (e.y >= WALL.y) { e.y = WALL.y; e.atWall = true; return true; }
  return false;
}
