// Weapons for 丛林勇士. fire() is PURE: it returns bullet specs (no entity import, no
// DOM) so it unit-tests cleanly and never creates an entities<->weapons import cycle.
// The caller (Player.fire) turns specs into Bullet instances via world.spawnBullets.
//
// M1 ships the default rifle. M2/M4 extend the WEAPONS table (machine/spread/laser/
// fire) and this function reads `spread`/`pierce` straight off the table.

import { WEAPONS, BULLET, DEFAULT_WEAPON, RAPID_SPEED_MUL } from './config.js';

export function cooldownFor(weaponId) {
  const w = WEAPONS[weaponId] || WEAPONS[DEFAULT_WEAPON];
  return w.cooldown;
}

// fire(weaponId, originX, originY, aim, opts) -> Array<bulletSpec>
//   aim:  unit vector { x, y } from resolveAim
//   opts: { rapid?:boolean } (rapid is used from M4)
export function fire(weaponId, originX, originY, aim, opts = {}) {
  const w = WEAPONS[weaponId] || WEAPONS[DEFAULT_WEAPON];
  const speed = w.speed * (opts.rapid ? RAPID_SPEED_MUL : 1);
  const specs = [];

  const push = (vx, vy) => specs.push({
    x: originX, y: originY, vx, vy, dmg: w.dmg, pierce: !!w.pierce, life: BULLET.life, gravity: w.gravity || 0,
  });

  if (w.spread && w.spread > 1) {
    // Fan of `spread` bullets centered on aim (M2: spread weapon).
    const half = (w.spreadAngle || 0.32) * (w.spread - 1) / 2;
    const base = Math.atan2(aim.y, aim.x);
    for (let i = 0; i < w.spread; i++) {
      const a = base - half + (w.spreadAngle || 0.32) * i;
      push(Math.cos(a) * speed, Math.sin(a) * speed);
    }
  } else {
    push(aim.x * speed, aim.y * speed);
  }
  return specs;
}
