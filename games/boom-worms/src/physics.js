import { PHYSICS, WORM } from './config.js';
import { solidAt } from './terrain.js';
import { clamp } from './util/math.js';

const HALF_W = WORM.w / 2, HALF_H = WORM.h / 2;

// Advance one worm. opts: { waterY, moveX(-1..1), wantJump }
export function stepWorm(w, dt, mask, opts) {
  if (!w.alive) return;
  // `hazards` reserved for M2 (ice friction / bounce / lava / acid / spikes). Destructured
  // now so all 5 call sites are already M2-ready (spec §11.13); unused in M1.
  const { waterY, moveX = 0, wantJump = false, hazards = [] } = opts;

  // horizontal intent
  w.vx = moveX * PHYSICS.moveSpeed;
  if (moveX !== 0) w.facing = moveX > 0 ? 1 : -1;

  if (wantJump && w.onGround) { w.vy = PHYSICS.jumpVel; w.onGround = false; }

  // gravity
  w.vy = clamp(w.vy + PHYSICS.wormGravity * dt, -2000, PHYSICS.maxFall);

  // integrate X with wall block
  const nx = w.x + w.vx * dt;
  if (!solidAt(mask, nx + Math.sign(w.vx) * HALF_W, w.y)) w.x = nx;
  else w.vx = 0;

  // integrate Y
  const ny = w.y + w.vy * dt;
  if (w.vy >= 0) {
    // falling (or resting): check feet
    if (solidAt(mask, w.x, ny + HALF_H)) {
      // Snap to the ground top using an INTEGER row. Keeping gy fractional made a
      // resting worm drift down ~0.4px each frame (the sub-pixel gravity step) and
      // pop back up ~1px every few frames — a ~20Hz shimmer on whichever worm is
      // re-stepped each frame (i.e. the active worm during aiming). Flooring fixes it.
      let gy = (ny + HALF_H) | 0;
      while (gy > 0 && solidAt(mask, w.x, gy - 1)) gy--; // snap to ground top
      w.y = gy - HALF_H; w.vy = 0; w.onGround = true;
    } else { w.y = ny; w.onGround = false; }
  } else {
    // rising: check head
    if (solidAt(mask, w.x, ny - HALF_H)) w.vy = 0; else w.y = ny;
  }

  // drown
  if (w.y >= waterY) { w.alive = false; w.hp = 0; }
  if (w.hp <= 0) w.alive = false;
}
