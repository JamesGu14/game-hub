// systems/combat/signatureSkills.js — L3 招牌技·冷却技（§17.2）。
// combatSystem 在 level>=3 且 signatureCd<=0 时调 fireSignature；返回 true（成功放）才进 CD。
// 被动（黄忠暴击/赵云连射/马超击退/诸葛火烧藤甲）内联在 damageCalc/attacks，本模块不含。
import { BAL } from '../../data/balance.js';
import { towerStats } from '../../data/generals.js';
import { applySlow, applyStun } from './statusEffects.js';
import { killEnemy } from './kill.js';
import { spawnRing } from '../../render/fx.js';

const CELL = BAL.CELL;

export function fireSignature(state, tower, g, now) {
  switch (g.signature?.id) {
    case 'shuiyan': return fireShuiyan(state, tower, g, now);  // 关羽 水淹七军
    case 'nuhou':   return fireNuhou(state, tower, g, now);    // 张飞 当阳怒吼
    default:        return false;
  }
}

// 关羽 水淹七军（冷却12s）：以当前 target 为中心，radius 内敌重减速 + 一次谋略伤。无目标不放。
function fireShuiyan(state, tower, g, now) {
  const target = tower.target;
  if (!target || !target.alive) return false;
  const p = g.signature.params;
  const r = (p.radius || 1.5) * CELL, r2 = r * r;
  const dmg = towerStats(g, tower.level).dmg * (p.dmgMult || 1);  // 谋略伤·无视护甲（常规）
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const dx = e.px - target.px, dy = e.py - target.py;
    if (dx * dx + dy * dy > r2) continue;
    applySlow(e, p.slowPct, p.slowDur, now);
    e.hp -= dmg;
    if (e.hp <= 0) killEnemy(state, e);
  }
  spawnRing(state, target.px, target.py, g.color, r);
  return true;
}

// 张飞 当阳怒吼（冷却10s）：当前 target 周围 radius 内地面敌定身 stunDur。无目标不放。
function fireNuhou(state, tower, g, now) {
  const target = tower.target;
  if (!target || !target.alive) return false;
  const p = g.signature.params;
  const r = (p.radius || 1) * CELL, r2 = r * r;
  for (const e of state.enemies) {
    if (!e.alive || e.flying) continue;
    const dx = e.px - target.px, dy = e.py - target.py;
    if (dx * dx + dy * dy <= r2) applyStun(e, p.stunDur, now);
  }
  spawnRing(state, target.px, target.py, g.color, r);
  return true;
}
