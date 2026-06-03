import { vecFromAngle, dist } from './util/math.js';
import { simulate } from './util/trajectory.js';
import { PHYSICS, AIM } from './config.js';

// Simulate and return the y-position when x crosses target column tx (dir-aware).
function yAtTargetX(sx, sy, angle, speed, gravity, wind, tx, dir) {
  const v = vecFromAngle(angle, speed);
  const r = simulate({ x: sx, y: sy }, v,
    { gravity, wind, dt: 1 / 120, maxSteps: 5000 },
    (x) => (dir === 1 ? x >= tx : x <= tx));
  return { y: r.last.y, hit: r.hit };
}

// Try a fan of angles; for each, binary-search speed to land closest to target.
// Returns {angle, speed} or null. Deterministic.
export function solveAim(sx, sy, tx, ty, gravity, speedMin, speedMax, wind = 0) {
  const dir = tx >= sx ? 1 : -1;
  let best = null, bestErr = Infinity;
  // angles from ~5deg to ~80deg above horizontal, on the target's side
  // Use finer step (2.0 deg) as recommended in plan
  for (let deg = 5; deg <= 80; deg += 2.0) {
    const angle = dir === 1 ? -deg * Math.PI / 180 : Math.PI + deg * Math.PI / 180;
    // For this angle, binary-search speed to match ty at the target x column.
    // Heuristic: higher speed => reaches x faster => less time to fall => higher y at x.
    // So: y too low (overshot in y) => need more speed; y too high => less speed.
    let lo = speedMin, hi = speedMax;
    for (let it = 0; it < 26; it++) {
      const speed = (lo + hi) / 2;
      const { y } = yAtTargetX(sx, sy, angle, speed, gravity, wind, tx, dir);
      const err = Math.abs(y - ty);
      if (err < bestErr) { bestErr = err; best = { angle, speed }; }
      // More speed => reaches target x earlier => y is higher (less time to fall).
      // If current y is below ty (too low / overshot), increase speed to arrive earlier.
      if (y > ty) lo = speed; else hi = speed;
    }
  }
  return best;
}

// errLevel 0..1; rng()->[0,1). errLevel 0 => no change.
export function jitterAim(sol, errLevel, rng) {
  if (errLevel <= 0) return { ...sol };
  const angJit = (rng() - 0.5) * 2 * errLevel * 0.5;     // up to ±0.25 rad at err=1
  const spdJit = 1 + (rng() - 0.5) * 2 * errLevel * 0.4; // up to ±20% at err=1
  return { angle: sol.angle + angJit, speed: sol.speed * spdJit };
}

// ---------------------------------------------------------------------------
// AIController — drives an AI worm's complete turn via timed steps.
// Call AIController.takeTurn(game) when nextActive lands on an AI worm.
// ---------------------------------------------------------------------------

// Check if the direct ballistic arc from (sx,sy) to (tx,ty) hits terrain
// before reaching the target x column (rough wall-blocking heuristic).
function _arcBlocked(sx, sy, tx, ty, gravity, wind, terrain) {
  const dir = tx >= sx ? 1 : -1;
  // Quick-solve a baseline shot and check intermediate points for terrain hits
  const sol = solveAim(sx, sy, tx, ty, gravity, AIM.minSpeed, AIM.maxSpeed, wind);
  if (!sol) return false;
  const v = vecFromAngle(sol.angle, sol.speed);
  const r = simulate({ x: sx, y: sy }, v,
    { gravity, wind, dt: 1 / 60, maxSteps: 3000 },
    (x, y) => {
      // Stop at target column
      if (dir === 1 ? x >= tx : x <= tx) return true;
      // Stop at terrain (if available — terrain may be null in pure tests)
      if (terrain && terrain.solid(x | 0, y | 0)) return true;
      return false;
    });
  // If we stopped at terrain before reaching target column, arc is blocked
  if (terrain && terrain.solid(r.last.x | 0, r.last.y | 0)) return true;
  return false;
}

// Pick the best weapon given battlefield context.
function _chooseWeapon(worm, target, team, terrain, gravity, wind) {
  const d = dist(worm.x, worm.y, target.x, target.y);

  // Firepunch if adjacent (within melee range + a small buffer)
  if (d < 55 && (team.ammo['firepunch'] === Infinity || (team.ammo['firepunch'] ?? 0) > 0)) {
    return 'firepunch';
  }

  // Try grenade if direct bazooka arc is blocked by terrain
  if (terrain && _arcBlocked(worm.x, worm.y, target.x, target.y, gravity, wind, terrain)) {
    if (team.ammo['grenade'] === Infinity || (team.ammo['grenade'] ?? 0) > 0) {
      return 'grenade';
    }
  }

  // Default: bazooka (infinite ammo)
  return 'bazooka';
}

export const AIController = {
  /**
   * Execute one full AI turn on `game`.
   * game must expose: active, teams, level, terrain, wind, weaponKey,
   * _activeWorm(), _fireActiveWorm(launchParams), _advanceTurn(), aim (Aim singleton).
   *
   * Called from game.js _runAITurn() after the telegraph delay has elapsed.
   */
  takeTurn(game) {
    const worm = game._activeWorm();
    if (!worm || !worm.alive) {
      game._advanceTurn();
      return;
    }

    // 1. Select target: alive team-0 worm with lowest HP (nearest as tiebreak)
    const targets = game.teams[0].worms.filter(w => w.alive);
    if (!targets.length) {
      game._advanceTurn();
      return;
    }
    const target = targets.reduce((best, w) => {
      if (w.hp < best.hp) return w;
      if (w.hp === best.hp && dist(worm.x, worm.y, w.x, w.y) < dist(worm.x, worm.y, best.x, best.y)) return w;
      return best;
    });

    const activeTeam = game.teams[game.active.team];
    const gravity = PHYSICS.projGravity;
    const wind = game.wind;
    const terrain = game.terrain;

    // 2. Choose weapon
    const weaponKey = _chooseWeapon(worm, target, activeTeam, terrain, gravity, wind);
    game.weaponKey = weaponKey;

    // 3. Compute aim solution
    let launchParams;
    if (weaponKey === 'firepunch') {
      // Melee: face toward target, speed doesn't matter much
      const dx = target.x - worm.x;
      worm.facing = dx >= 0 ? 1 : -1;
      launchParams = { angle: dx >= 0 ? 0 : Math.PI, speed: AIM.minSpeed };
    } else {
      try {
        const sol = solveAim(
          worm.x, worm.y, target.x, target.y,
          gravity, AIM.minSpeed, AIM.maxSpeed, wind
        );
        if (sol) {
          launchParams = jitterAim(sol, game.level.aiError, Math.random);
        }
      } catch {
        // solver threw — use fallback below
      }

      if (!launchParams) {
        // Fallback: lob at 45° toward target
        const dx = target.x - worm.x;
        const angle = dx >= 0 ? -Math.PI / 4 : Math.PI + Math.PI / 4;
        launchParams = { angle, speed: 420 };
      }
    }

    // 4. Sync Aim singleton so renderer shows the chosen angle
    const { Aim } = game._getAim();
    if (Aim) {
      Aim.angle = launchParams.angle;
      Aim.power = launchParams.speed;
    }

    // 5. Fire through the same path the human uses
    game._fireActiveWorm(launchParams);
    game._aiPending = false;
  },
};

