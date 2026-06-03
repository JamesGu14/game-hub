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
// AIController — drives an AI worm's turn frame-by-frame so the aim is visible.
// Call AIController.step(game, dt) every frame while the active team is AI.
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
   * Drive one AI turn frame-by-frame so the player sees the AI "aim" like a
   * human: think delay → rotate the reticle to the target angle → charge the
   * power bar up to the chosen speed → fire. Progress is held in `game._aiState`
   * (null between turns). Called every frame from game.js `_updateAim` while the
   * active team is AI.
   *
   * game must expose: active, teams, level, terrain, wind, weaponKey, aim,
   * _activeWorm(), _fireActiveWorm(launchParams), _advanceTurn().
   */
  step(game, dt) {
    let st = game._aiState;

    // --- First frame of the turn: pick target/weapon and the final aim, then
    //     seed the state machine starting from a near-horizontal angle. ---
    if (!st) {
      const worm = game._activeWorm();
      if (!worm || !worm.alive) { game._advanceTurn(); return; }
      const targets = game.teams[0].worms.filter(w => w.alive);
      if (!targets.length) { game._advanceTurn(); return; }
      const target = targets.reduce((b, w) =>
        w.hp < b.hp || (w.hp === b.hp && dist(worm.x, worm.y, w.x, w.y) < dist(worm.x, worm.y, b.x, b.y)) ? w : b);

      const gravity = PHYSICS.projGravity, wind = game.wind, terrain = game.terrain;
      const team = game.teams[game.active.team];
      const weaponKey = _chooseWeapon(worm, target, team, terrain, gravity, wind);
      game.weaponKey = weaponKey;

      const dx = target.x - worm.x;
      worm.facing = dx >= 0 ? 1 : -1;
      let tgt;
      if (weaponKey === 'firepunch') {
        tgt = { angle: dx >= 0 ? 0 : Math.PI, speed: AIM.minSpeed };
      } else {
        let sol;
        try { sol = solveAim(worm.x, worm.y, target.x, target.y, gravity, AIM.minSpeed, AIM.maxSpeed, wind); } catch { /* fall through */ }
        tgt = sol ? jitterAim(sol, game.level.aiError, Math.random)
                  : { angle: dx >= 0 ? -Math.PI / 4 : Math.PI + Math.PI / 4, speed: 420 };
      }
      tgt.speed = Math.max(AIM.minSpeed, Math.min(AIM.maxSpeed, tgt.speed));

      const Aim = game.aim;
      Aim.charging = false; Aim.power = AIM.minSpeed;
      Aim.angle = dx >= 0 ? -0.05 : Math.PI + 0.05;   // start near-horizontal so the rotation is visible
      game._aiState = { phase: 'delay', t: 0, target: tgt };
      game._aiAiming = true;
      return;
    }

    const Aim = game.aim;
    st.t += dt;

    // 1. Think delay (telegraph the upcoming shot).
    if (st.phase === 'delay') {
      if (st.t > 0.5) { st.phase = 'aim'; st.t = 0; }
      return;
    }

    // 2. Rotate the reticle toward the target angle.
    if (st.phase === 'aim') {
      const diff = st.target.angle - Aim.angle;
      Aim.angle += Math.sign(diff) * Math.min(Math.abs(diff), 2.2 * dt);
      if (Math.abs(st.target.angle - Aim.angle) < 0.02) {
        Aim.angle = st.target.angle; st.phase = 'charge'; st.t = 0; Aim.startCharge();
      }
      return;
    }

    // 3. Charge the power bar up to the chosen speed, then fire.
    if (st.phase === 'charge') {
      Aim.stepCharge(dt);
      if (Aim.power >= st.target.speed || st.t > 3) {
        const lp = Aim.release();
        lp.angle = st.target.angle; lp.speed = st.target.speed;
        game._aiAiming = false; game._aiState = null;
        game._fireActiveWorm(lp); game._aiPending = false;
      }
      return;
    }
  },
};

