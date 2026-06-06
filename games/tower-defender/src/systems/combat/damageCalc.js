// systems/combat/damageCalc.js — 单次直伤数值：等级缩放 × 伤害类型抗性 + 暴击（§17.1/17.3）。
// 返回 { dmg, isCrit }；调用方负责 enemy.hp-=dmg 与 killEnemy。
// 注意：诸葛 burn 不走此函数（其伤害是 statusSystem 的 DoT，dps=towerStats.dmg）。
import { BAL } from '../../data/balance.js';
import { towerStats } from '../../data/generals.js';

export function calcDamage(tower, g, enemy, rng) {
  const base = towerStats(g, tower.level).dmg;
  // 黄忠 L3 百步穿杨（被动）：25% 暴击 ×2.5 且无视护甲（跳过 resist）。
  if (tower.level >= BAL.MAX_TOWER_LEVEL && g.signature?.id === 'baibu' && rng() < BAL.CRIT_CHANCE) {
    return { dmg: base * BAL.CRIT_MULT, isCrit: true };
  }
  const mult = enemy.resist?.[g.dmgType] ?? 1;     // 类型×抗性；未列项默认 ×1
  return { dmg: base * mult, isCrit: false };
}
