import { vecFromAngle } from './util/math.js';
import { simulate } from './util/trajectory.js';

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
