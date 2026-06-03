// Weapon fire dispatch — turns aim+power+weapon into projectile(s) or instant effects.
// fire() returns an array of Projectile objects (may be empty for melee/hitscan).
// Side-effects: decrements team ammo; hitscan/melee call ctx.onExplode and ctx.carveAt directly.

import { WEAPONS } from './config.js';
import { makeProjectile } from './projectile.js';
import { vecFromAngle, dist } from './util/math.js';
import { applyExplosion } from './combat.js';

/**
 * Fire a weapon.
 *
 * @param {string}  weaponKey - key into WEAPONS config
 * @param {object}  worm      - firing worm { x, y, facing, team, ... }
 * @param {object}  aim       - { angle: number (radians), speed: number (px/s) }
 * @param {object}  ctx
 *   team          {object}   - firing team (ammo decremented here)
 *   allWorms      {Worm[]}   - all worms (for melee/hitscan hit tests)
 *   terrain       {object}   - Terrain instance (.solid(x,y), .carveAt(cx,cy,r))
 *   gravity       {number}   - px/s^2 projectile gravity
 *   wind          {number}   - px/s^2 wind (only used for windAffected weapons)
 *   onExplode     {function(x,y,radius,dmg,weaponKey)}
 *
 * @returns {object[]} array of live projectile objects (empty for melee/hitscan)
 */
export function fire(weaponKey, worm, aim, ctx) {
  const def = WEAPONS[weaponKey];
  if (!def) return [];

  const { team, allWorms, terrain, gravity, wind, onExplode } = ctx;

  // Decrement ammo (skip if Infinity or already 0)
  if (def.ammo !== Infinity) {
    const cur = team.ammo[weaponKey] ?? def.ammo;
    if (cur <= 0) return [];
    team.ammo[weaponKey] = cur - 1;
  }

  const facing = worm.facing ?? 1;
  // Muzzle: just in front of and at the center of the worm
  const muzzleX = worm.x + facing * 18;
  const muzzleY = worm.y;

  switch (def.kind) {
    case 'projectile': // bazooka
      return [_spawnProjectile(weaponKey, def, muzzleX, muzzleY, aim, worm.team)];

    case 'grenade':
    case 'holy':
      return [_spawnGrenade(weaponKey, def, muzzleX, muzzleY, aim, worm.team)];

    case 'dynamite':
      return [_spawnDynamite(weaponKey, def, worm.x, worm.y + 14, worm.team)]; // feet

    case 'hitscan':
      _fireHitscan(weaponKey, def, muzzleX, muzzleY, aim, worm, allWorms, terrain, onExplode);
      return [];

    case 'melee':
      _fireMelee(weaponKey, def, worm, allWorms, onExplode);
      return [];

    case 'airstrike':
      return _fireAirstrike(weaponKey, def, aim, worm.team, worm);

    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Projectile spawners
// ---------------------------------------------------------------------------

function _spawnProjectile(weaponKey, def, x, y, aim, ownerTeam) {
  const vel = vecFromAngle(aim.angle, aim.speed);
  return makeProjectile({
    kind: def.kind,
    weaponKey,
    x, y,
    vx: vel.x, vy: vel.y,
    fuse: Infinity,
    r: 5,
    dmg: def.dmg,
    radius: def.radius,
    bounce: 0,
    windAffected: def.windAffected ?? false,
    ownerTeam,
  });
}

function _spawnGrenade(weaponKey, def, x, y, aim, ownerTeam) {
  const vel = vecFromAngle(aim.angle, aim.speed);
  return makeProjectile({
    kind: def.kind,
    weaponKey,
    x, y,
    vx: vel.x, vy: vel.y,
    fuse: def.fuse ?? 3,
    r: 6,
    dmg: def.dmg,
    radius: def.radius,
    bounce: def.bounce ?? 0.5,
    windAffected: def.windAffected ?? false,
    ownerTeam,
  });
}

function _spawnDynamite(weaponKey, def, x, y, ownerTeam) {
  // Dynamite is placed at the worm's feet with near-zero velocity (just drops)
  return makeProjectile({
    kind: 'dynamite',
    weaponKey,
    x, y,
    vx: 0, vy: 0,
    fuse: def.fuse ?? 3.5,
    r: 7,
    dmg: def.dmg,
    radius: def.radius,
    bounce: 0,
    windAffected: false,
    ownerTeam,
  });
}

// ---------------------------------------------------------------------------
// Hitscan (shotgun): raymarch along aim angle, fire `shots` rays with slight spread
// ---------------------------------------------------------------------------

function _fireHitscan(weaponKey, def, muzzleX, muzzleY, aim, worm, allWorms, terrain, onExplode) {
  const shots = def.shots ?? 1;
  const range = def.range ?? 260;
  const spreadRad = 0.06; // ±3° spread per pellet (spread increases with pellet index)

  for (let s = 0; s < shots; s++) {
    // Alternate spread: shot 0 = base angle, shot 1 = base + spread, etc.
    const offset = (s - (shots - 1) / 2) * spreadRad;
    const angle = aim.angle + offset;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let hitX = muzzleX + dx * range;
    let hitY = muzzleY + dy * range;
    let hitWorm = null;

    // Step along the ray at ~4px intervals
    const steps = Math.ceil(range / 4);
    for (let i = 1; i <= steps; i++) {
      const rx = muzzleX + dx * (i * 4);
      const ry = muzzleY + dy * (i * 4);

      // Terrain hit
      if (terrain.solid(rx | 0, ry | 0)) {
        hitX = rx;
        hitY = ry;
        // Small carve at hit point
        terrain.carveAt(rx | 0, ry | 0, def.radius ?? 16);
        break;
      }

      // Worm hit (skip owner team)
      for (const w of allWorms) {
        if (!w.alive) continue;
        if (w.team === worm.team) continue;
        if (dist(rx, ry, w.x, w.y) < 14) {
          hitX = w.x;
          hitY = w.y;
          hitWorm = w;
          break;
        }
      }
      if (hitWorm) break;
    }

    // Apply damage at hit point
    if (hitWorm) {
      // Direct worm hit: deal full dmg + strong knockback
      hitWorm.hp = Math.max(0, hitWorm.hp - def.dmg);
      if (hitWorm.hp <= 0) hitWorm.alive = false;
      // Knockback: push away from shooter
      const kx = hitWorm.x - muzzleX;
      const ky = hitWorm.y - muzzleY;
      const kd = Math.hypot(kx, ky) || 1;
      hitWorm.vx += (kx / kd) * 180;
      hitWorm.vy += (ky / kd) * 180 - 60;
    } else {
      // Area-effect at terrain impact
      onExplode(hitX, hitY, def.radius ?? 16, def.dmg, weaponKey);
    }
  }
}

// ---------------------------------------------------------------------------
// Melee (firepunch): damages worms within range in front; applies up+forward knock
// ---------------------------------------------------------------------------

function _fireMelee(weaponKey, def, worm, allWorms, onExplode) {
  const range = def.range ?? 40;
  const facing = worm.facing ?? 1;

  for (const w of allWorms) {
    if (!w.alive) continue;
    // safe=true means firepunch never hits the owner's own team
    if (def.safe && w.team === worm.team) continue;

    const dx = w.x - worm.x;
    const dy = w.y - worm.y;
    const d = Math.hypot(dx, dy);

    if (d > range) continue;
    // Must be in front (same horizontal direction as facing)
    if (Math.sign(dx) !== 0 && Math.sign(dx) !== Math.sign(facing)) continue;

    w.hp = Math.max(0, w.hp - def.dmg);
    if (w.hp <= 0) w.alive = false;

    // Upward + forward knockback
    w.vx += facing * (def.knockX ?? 220);
    w.vy += def.knockUp ?? -360;
  }

  // Small visual/audio cue at the punch impact point (not a real explosion, radius=0)
  // onExplode with radius=0 triggers effect only
  onExplode(worm.x + facing * range * 0.5, worm.y, 0, 0, weaponKey);
}

// ---------------------------------------------------------------------------
// Airstrike: bombs falling vertically from top at the target X column
// ---------------------------------------------------------------------------

function _fireAirstrike(weaponKey, def, aim, ownerTeam, worm) {
  const bombs = def.bombs ?? 5;
  // aim.x is set by game._fireActiveWorm; fall back to in-front-of-worm, then center.
  const facing = worm ? (worm.facing ?? 1) : 1;
  const fallback = worm ? worm.x + facing * 200 : 480;
  const targetX = aim.x ?? fallback;
  const spread = 40; // px spread between bomb columns
  const projectiles = [];

  for (let i = 0; i < bombs; i++) {
    const bx = targetX + (i - Math.floor(bombs / 2)) * spread;
    projectiles.push(makeProjectile({
      kind: 'airstrike',
      weaponKey,
      x: bx,
      y: -20,        // starts above screen
      vx: 0,
      vy: 180,       // falls downward at fixed speed
      fuse: Infinity,
      r: 5,
      dmg: def.dmg,
      radius: def.radius ?? 30,
      bounce: 0,
      windAffected: false,
      ownerTeam,
    }));
  }

  return projectiles;
}
