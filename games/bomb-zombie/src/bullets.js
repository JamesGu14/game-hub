// bullets.js — 子弹移动/碰撞/穿透/溅射/命中挂特效。纯逻辑（注入 rng + onHit 回调）。
import { rollDamage, applyDamage } from './combat.js';
import { dist } from './util.js';
import { BULLET, FIELD } from './config.js';

export function makeBullet(x, y, vx, vy, stats) {
  return { x, y, vx, vy, r: BULLET.r, life: BULLET.life,
    pierceLeft: Math.round(stats.pierce), hitIds: [], dmg: stats.damage,
    critRate: stats.critRate, critMult: stats.critMult, splash: stats.splash };
}

function attachEffects(enemy, inMods) {
  if (inMods.burnDps) enemy.dots.push({ dps: inMods.burnDps, remain: 2.0 });
  if (inMods.poisonDps) enemy.dots.push({ dps: inMods.poisonDps, remain: 3.0 });
  if (inMods.frostSlow) enemy.frozen = Math.max(enemy.frozen || 0, 1.2);
}

export function stepBullets(bullets, enemies, stats, run, dt, rng, onHit) {
  const inMods = (run && run.inMods) || {};
  const alive = [];
  for (const b of bullets) {
    b.life -= dt;
    if (b.life <= 0) continue;
    let consumed = false;
    for (const e of enemies) {
      if (e.hp <= 0 || b.hitIds.includes(e.id)) continue;
      if (dist(b.x, b.y, e.x, e.y) <= b.r + e.r) {
        const fromFront = b.vy < 0;                   // 由下往上=正面
        const res = rollDamage({ damage: b.dmg, critRate: b.critRate, critMult: b.critMult }, rng);
        applyDamage(e, res.amount, fromFront);
        attachEffects(e, inMods);
        if (b.splash > 0) {                            // 溅射：范围内其它怪受 50% 伤害
          for (const o of enemies) {
            if (o.id === e.id || o.hp <= 0) continue;
            if (dist(e.x, e.y, o.x, o.y) <= b.splash) applyDamage(o, res.amount * 0.5, false);
          }
        }
        if (onHit) onHit(e, res);
        b.hitIds.push(e.id);
        if (b.pierceLeft > 0) { b.pierceLeft--; } else { consumed = true; break; }
      }
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.x < -20 || b.x > FIELD.W + 20 || b.y < -20 || b.y > FIELD.H + 20) continue;
    if (!consumed) alive.push(b);
  }
  return alive;
}
