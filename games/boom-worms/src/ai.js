import { vecFromAngle, dist } from './util/math.js';
import { simulate } from './util/trajectory.js';
import { PHYSICS, AIM, FIELD } from './config.js';

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

// Score how good a shot is from (sx,sy) at the given target: lower = better.
// Combines landing error from solveAim with a penalty when the arc is walled.
// Used to decide whether walking a step actually improves the shot.
function _shotScore(sx, sy, target, gravity, wind, terrain) {
  let err = 9999;
  const sol = solveAim(sx, sy, target.x, target.y, gravity, AIM.minSpeed, AIM.maxSpeed, wind);
  if (sol) {
    const dir = target.x >= sx ? 1 : -1;
    const { y } = yAtTargetX(sx, sy, sol.angle, sol.speed, gravity, wind, target.x, dir);
    err = Math.abs(y - target.y);
  }
  const blocked = terrain ? _arcBlocked(sx, sy, target.x, target.y, gravity, wind, terrain) : false;
  return err + (blocked ? 120 : 0);
}

/**
 * Decide a small tactical reposition for the worm BEFORE it aims.
 * Returns { dir: -1|0|1, maxDist } — dir 0 means "stay put, current shot is fine".
 *
 * Rules (all bounded, all cheap):
 *  - If the current spot already gives a clean, in-range shot, don't move.
 *  - Otherwise probe one worm-width toward and away from the target; walk in
 *    whichever direction improves the shot score most (clearer arc / better
 *    range), defaulting toward the target when out of comfortable range.
 *  - Movement shrinks as aiError rises: dumb (easy-level) AIs barely shuffle,
 *    sharp (late-level) AIs take the full step. High-error AIs may skip moving.
 */
function _planReposition(worm, target, gravity, wind, terrain, aiError) {
  const PROBE = 26;                       // ~1 worm width probe distance
  const d = dist(worm.x, worm.y, target.x, target.y);
  const toward = target.x >= worm.x ? 1 : -1;

  // Sloppy AIs often just don't bother repositioning (keeps easy levels easy).
  if (Math.random() < aiError * 0.6) return { dir: 0, maxDist: 0 };

  const here = _shotScore(worm.x, worm.y, target, gravity, wind, terrain);
  const skill = 1 - aiError;              // 0 (dumb) .. 1 (sharp)

  // Already a clean, comfortably-in-range shot. A competent AI still takes a
  // short closing step so it looks alive ("repositioning"), the chance scaling
  // with skill; a sloppy AI just holds (keeps easy levels easy).
  if (here < 26 && d < 520) {
    if (toward !== 0 && Math.random() < skill * 0.7 && d > 90) {
      const px = worm.x + toward * PROBE;
      const okFooting = !terrain || terrain.ground(px | 0, 0) != null;
      if (px > 8 && px < FIELD.W - 8 && okFooting) {
        return { dir: toward, maxDist: Math.round((0.4 + 0.6 * skill) * 90) };
      }
    }
    return { dir: 0, maxDist: 0 };
  }

  // Probe both directions (only where footing is solid & dry).
  let bestDir = 0, bestScore = here - 6;  // require a real improvement to move
  for (const dir of [toward, -toward]) {
    const px = worm.x + dir * PROBE;
    if (px < 8 || px > FIELD.W - 8) continue;
    if (terrain) {
      const gy = terrain.ground(px | 0, 0);
      if (gy == null) continue;           // gap / water ahead — never head there
    }
    const probeY = worm.y;                // approx: scoring is x-column dominated
    const score = _shotScore(px, probeY, target, gravity, wind, terrain);
    if (score < bestScore) { bestScore = score; bestDir = dir; }
  }

  // If nothing clearly better but we're out of comfortable range, close in.
  if (bestDir === 0 && d > 520) bestDir = toward;

  // Distance budget: a few worm-widths, scaled DOWN by sloppiness. Sharp AIs
  // (aiError→0) may walk up to ~120px; dumb AIs barely move.
  const maxDist = Math.round((1 - 0.55 * aiError) * 120);
  return { dir: bestDir, maxDist: bestDir === 0 ? 0 : Math.max(24, maxDist) };
}

// Re-solve the aim from the worm's CURRENT position (called after repositioning),
// pick the weapon for the new geometry, and return { weaponKey, target:{angle,speed} }.
function _resolveAim(worm, target, team, gravity, wind, terrain, aiError) {
  const weaponKey = _chooseWeapon(worm, target, team, terrain, gravity, wind);
  const dx = target.x - worm.x;
  worm.facing = dx >= 0 ? 1 : -1;

  let tgt;
  if (weaponKey === 'firepunch') {
    tgt = { angle: dx >= 0 ? 0 : Math.PI, speed: AIM.minSpeed };
  } else {
    let sol;
    try { sol = solveAim(worm.x, worm.y, target.x, target.y, gravity, AIM.minSpeed, AIM.maxSpeed, wind); } catch { /* fall through */ }
    if (!sol && terrain) {
      // Direct arc unsolved/blocked — fall back to a high lob so we still fire
      // something plausible toward the target rather than freezing.
      try { sol = solveAim(worm.x, worm.y, target.x, target.y - 80, gravity, AIM.minSpeed, AIM.maxSpeed, wind); } catch { /* noop */ }
    }
    tgt = sol ? jitterAim(sol, aiError, Math.random)
              : { angle: dx >= 0 ? -Math.PI / 4 : Math.PI + Math.PI / 4, speed: 420 };
  }
  tgt.speed = Math.max(AIM.minSpeed, Math.min(AIM.maxSpeed, tgt.speed));
  return { weaponKey, target: tgt };
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

    // --- First frame of the turn: pick the target and a small reposition plan,
    //     then enter `delay`. The final aim is solved LATER (after the worm has
    //     walked), so it always reflects the firing position, not the spawn. ---
    if (!st) {
      const worm = game._activeWorm();
      if (!worm || !worm.alive) { game._advanceTurn(); return; }
      const targets = game.teams[0].worms.filter(w => w.alive);
      if (!targets.length) { game._advanceTurn(); return; }
      const target = targets.reduce((b, w) =>
        w.hp < b.hp || (w.hp === b.hp && dist(worm.x, worm.y, w.x, w.y) < dist(worm.x, worm.y, b.x, b.y)) ? w : b);

      const gravity = PHYSICS.projGravity, wind = game.wind, terrain = game.terrain;
      const aiError = game.level.aiError ?? 0;

      // Face the target and plan a bounded tactical step toward a better shot.
      worm.facing = target.x >= worm.x ? 1 : -1;
      const plan = _planReposition(worm, target, gravity, wind, terrain, aiError);

      game._aiState = {
        phase: 'delay', t: 0,
        target: null,                 // aim solved at the end of reposition
        targetWorm: target,
        walkDir: plan.dir,            // -1 | 0 | 1
        walkBudget: plan.maxDist,     // px of horizontal travel allowed
        startX: worm.x,
        aiError,
      };
      game._aiAiming = true;
      return;
    }

    const Aim = game.aim;
    st.t += dt;
    const gravity = PHYSICS.projGravity, wind = game.wind, terrain = game.terrain;

    // 1. Think delay (telegraph the upcoming shot).
    if (st.phase === 'delay') {
      if (st.t > 0.5) { st.phase = st.walkDir !== 0 ? 'reposition' : 'resolveAim'; st.t = 0; }
      return;
    }

    // 2. Reposition: walk a small, bounded distance toward the chosen spot.
    //    Bounded by BOTH time (≤1.3s) AND distance (st.walkBudget). Stops early
    //    on a wall, a gap/water ahead, or arrival. Never walks into a drown.
    if (st.phase === 'reposition') {
      const worm = game._activeWorm();
      if (!worm || !worm.alive) { game._advanceTurn(); game._aiAiming = false; game._aiState = null; return; }

      const travelled = Math.abs(worm.x - st.startX);
      const nextX = worm.x + st.walkDir * (PHYSICS.moveSpeed * dt + 1);
      const blocked = terrain && terrain.solid((worm.x + st.walkDir * 14) | 0, (worm.y) | 0);
      const footingSafe = game._aiFootingSafe(nextX);
      const fellOff = !worm.onGround && st.t > 0.4;   // started falling — stop & shoot

      const done = travelled >= st.walkBudget || st.t > 1.3 || blocked || !footingSafe || fellOff;
      if (done) {
        st.phase = 'resolveAim'; st.t = 0;
        return;
      }
      game._aiWalk(worm, st.walkDir, dt);
      return;
    }

    // 2b. Resolve the aim from the (possibly new) position — fresh solveAim,
    //     fresh weapon choice — then seed the visible reticle rotation.
    if (st.phase === 'resolveAim') {
      const worm = game._activeWorm();
      if (!worm || !worm.alive) { game._advanceTurn(); game._aiAiming = false; game._aiState = null; return; }
      const target = st.targetWorm;
      if (!target.alive) {
        // Original target died mid-turn (rare) — just fire a fallback so the
        // turn still ends; resolve handles re-targeting next turn.
        game._advanceTurn(); game._aiAiming = false; game._aiState = null; return;
      }
      const team = game.teams[game.active.team];
      const r = _resolveAim(worm, target, team, gravity, wind, terrain, st.aiError);
      game.weaponKey = r.weaponKey;
      st.target = r.target;

      Aim.charging = false; Aim.power = AIM.minSpeed;
      const dx = target.x - worm.x;
      Aim.angle = dx >= 0 ? -0.05 : Math.PI + 0.05;   // start near-horizontal so the rotation is visible
      st.phase = 'aim'; st.t = 0;
      return;
    }

    // 3. Rotate the reticle toward the target angle.
    if (st.phase === 'aim') {
      const diff = st.target.angle - Aim.angle;
      Aim.angle += Math.sign(diff) * Math.min(Math.abs(diff), 2.2 * dt);
      if (Math.abs(st.target.angle - Aim.angle) < 0.02 || st.t > 2.0) {
        Aim.angle = st.target.angle; st.phase = 'charge'; st.t = 0; Aim.startCharge();
      }
      return;
    }

    // 4. Charge the power bar up to the chosen speed, then fire.
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

