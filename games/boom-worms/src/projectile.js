// Live projectile: integrates ballistics, handles fuse/bounce/collision/explosion.
// updateProjectile mutates the projectile in-place and calls ctx.onExplode when needed.
// No DOM — canvas interaction is via ctx.terrain which is supplied by the game layer.

import { stepBallistic } from './util/trajectory.js';
import { WEAPONS } from './config.js';
import { dist } from './util/math.js';

/**
 * Factory — create a live projectile object.
 * @param {object} opts
 *   kind        {string}  - weapon kind key (matches WEAPONS[key].kind or weaponKey)
 *   weaponKey   {string}  - original weapon key (for onExplode callback)
 *   x, y        {number}  - spawn position
 *   vx, vy      {number}  - initial velocity
 *   fuse        {number}  - seconds until auto-explode (grenade/dynamite/holy)
 *   r           {number}  - collision radius
 *   dmg         {number}  - max damage at center
 *   radius      {number}  - explosion radius (px)
 *   bounce      {number}  - velocity retention on terrain bounce (0–1)
 *   windAffected{boolean} - whether horizontal wind affects this projectile
 *   ownerTeam   {0|1}
 */
export function makeProjectile({
  kind, weaponKey, x, y, vx, vy,
  fuse = Infinity,
  r = 5,
  dmg = 0,
  radius = 30,
  bounce = 0,
  windAffected = false,
  ownerTeam,
}) {
  return {
    kind,
    weaponKey,
    x, y, vx, vy,
    fuse,
    r,
    dmg,
    radius,
    bounce,
    windAffected,
    ownerTeam,
    dead: false,
    age: 0,            // total seconds alive
  };
}

/**
 * Advance one projectile by dt seconds.
 *
 * @param {object}  p    - projectile (mutated in place)
 * @param {number}  dt   - seconds
 * @param {object}  ctx
 *   terrain       {object}  - Terrain instance with .solid(x,y)
 *   allWorms      {Worm[]}  - all worms from both teams
 *   wind          {number}  - px/s^2 horizontal wind acceleration
 *   gravity       {number}  - px/s^2 downward gravity
 *   onExplode     {function(x,y,radius,dmg,weaponKey)} - called when projectile detonates
 */
export function updateProjectile(p, dt, ctx) {
  if (p.dead) return;

  const { terrain, allWorms, wind, gravity, onExplode } = ctx;
  const effectiveWind = p.windAffected ? wind : 0;

  // --- Fuse countdown (grenade / dynamite / holy) ---
  if (p.fuse !== Infinity) {
    p.fuse -= dt;
    if (p.fuse <= 0) {
      _explode(p, onExplode);
      return;
    }
  }

  p.age += dt;

  // --- Ballistic integration ---
  const next = stepBallistic({ x: p.x, y: p.y, vx: p.vx, vy: p.vy }, dt, gravity, effectiveWind);

  // --- Terrain collision ---
  const hitTerrain = _checkTerrainHit(p, next, terrain);

  if (hitTerrain) {
    if (p.kind === 'grenade' || p.kind === 'holy') {
      // Bounce: reflect and attenuate velocity, push out of solid
      _bounceOff(p, terrain);
    } else {
      // bazooka / projectile: explode immediately on terrain contact
      _explode(p, onExplode);
      return;
    }
  } else {
    // No terrain hit — advance position
    p.x = next.x;
    p.y = next.y;
    p.vx = next.vx;
    p.vy = next.vy;
  }

  // Dynamite is near-stationary; don't check worm collisions mid-air (fuse handles it)
  if (p.kind === 'dynamite') return;

  // --- Worm collision (circle vs worm AABB center) ---
  for (const w of allWorms) {
    if (!w.alive) continue;
    if (w.team === p.ownerTeam && p.kind !== 'airstrike') continue; // owner team safe (except airstrike)
    const d = dist(p.x, p.y, w.x, w.y);
    if (d < p.r + 14) { // 14 = WORM.r (avoid importing to keep this pure-ish)
      if (p.kind === 'grenade' || p.kind === 'holy') {
        // Grenades can hit worms mid-air: trigger explosion immediately
        _explode(p, onExplode);
        return;
      } else {
        _explode(p, onExplode);
        return;
      }
    }
  }

  // --- Out-of-bounds culling (left wall, right wall, or fallen below FIELD.H + margin) ---
  if (p.x < -60 || p.x > 1020 || p.y > 620) {
    p.dead = true;
  }
}

// --- Internal helpers ---

function _checkTerrainHit(p, next, terrain) {
  // Sample a few points along the path to avoid tunnelling at high speed
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const sx = p.x + (next.x - p.x) * t;
    const sy = p.y + (next.y - p.y) * t;
    if (terrain.solid(sx | 0, sy | 0)) return true;
  }
  return false;
}

function _bounceOff(p, terrain) {
  // Reflect velocity on the axis where collision occurs and scale by bounce factor.
  // Simple approach: test X and Y axes separately and negate the offending axis.
  const { bounce } = p;

  // Try moving only in Y — if that collides, reflect vy
  if (terrain.solid(p.x | 0, (p.y + p.vy * 0.016) | 0)) {
    p.vy = -p.vy * bounce;
  }
  // Try moving only in X — if that collides, reflect vx
  if (terrain.solid((p.x + p.vx * 0.016) | 0, p.y | 0)) {
    p.vx = -p.vx * bounce;
  }

  // Push the projectile out of solid: step back until clear, up to 8px
  for (let push = 1; push <= 8; push++) {
    if (!terrain.solid(p.x | 0, p.y | 0)) break;
    p.y -= Math.sign(p.vy || -1); // back out upward by default
  }

  // Kill very slow grenades that are stuck (prevents infinite micro-bounce)
  if (Math.abs(p.vx) < 4 && Math.abs(p.vy) < 4) {
    p.vx = 0;
    p.vy = 0;
  }
}

function _explode(p, onExplode) {
  p.dead = true;
  onExplode(p.x, p.y, p.radius, p.dmg, p.weaponKey);
}
