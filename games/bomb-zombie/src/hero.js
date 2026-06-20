// hero.js — 自动索敌 + 按射速产子弹。纯逻辑。
import { dist } from './util.js';
import { makeBullet } from './bullets.js';

export function acquireTarget(enemies, hx, hy) {
  let best = null, bd = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0) continue;
    const d = dist(hx, hy, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

export function fireTick(hero, stats, enemies, dt) {
  hero.fireTimer = (hero.fireTimer || 0) + dt;
  const out = [];
  while (hero.fireTimer >= stats.fireInterval) {
    hero.fireTimer -= stats.fireInterval;
    const target = acquireTarget(enemies, hero.x, hero.y);
    if (!target) { hero.fireTimer = 0; break; }       // 无目标不积压
    const baseAng = Math.atan2(target.y - hero.y, target.x - hero.x);
    const n = Math.max(1, Math.round(stats.multishot));
    const spread = 0.12;                              // 多重弹微扇角
    for (let i = 0; i < n; i++) {
      const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
      const a = baseAng + off;
      out.push(makeBullet(hero.x, hero.y, Math.cos(a) * stats.bulletSpeed, Math.sin(a) * stats.bulletSpeed, stats));
    }
  }
  return out;
}
