import { dist } from './util/math.js';

export function explosionDamage(d, radius, maxDmg) {
  if (d >= radius) return 0;
  return Math.round(maxDmg * (1 - d / radius));
}

// Mutates worm hp/vx/vy. Returns [{id, dmg}] for worms actually hit.
export function applyExplosion(worms, cx, cy, radius, maxDmg, knockScale = 1) {
  const hits = [];
  for (const w of worms) {
    if (!w.alive) continue;
    const d = dist(cx, cy, w.x, w.y);
    const dmg = explosionDamage(d, radius, maxDmg);
    if (dmg <= 0) continue;
    w.hp = Math.max(0, w.hp - dmg);
    const push = (1 - d / radius) * 260 * knockScale;
    const ang = Math.atan2(w.y - cy, w.x - cx);
    w.vx += Math.cos(ang) * push;
    w.vy += Math.sin(ang) * push - 120 * (1 - d / radius); // slight upward pop
    hits.push({ id: w.id, dmg });
  }
  return hits;
}

export const drowned = (w, waterY) => w.y >= waterY;
