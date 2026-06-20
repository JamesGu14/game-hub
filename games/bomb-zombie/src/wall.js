// wall.js — 城墙血量与堆墙啃咬结算。纯逻辑。
import { WALL } from './config.js';

export function makeWall() { return { hp: WALL.maxHp, maxHp: WALL.maxHp }; }

// 每只 atWall 僵尸累计 atkTimer，满 attackInterval 触发一次 atk 伤害；多只线性叠加。
export function resolveGnaw(wall, enemies, dt) {
  let total = 0;
  for (const e of enemies) {
    if (!e.atWall) continue;
    e.atkTimer += dt;
    while (e.atkTimer >= e.attackInterval) {
      e.atkTimer -= e.attackInterval;
      total += e.atk;
    }
  }
  if (total > 0) wall.hp = Math.max(0, wall.hp - total);
  return total;
}

export function wallDamage(wall, amount) { wall.hp = Math.max(0, wall.hp - amount); }
export function isDefeated(wall) { return wall.hp <= 0; }
