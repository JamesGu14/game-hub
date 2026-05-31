import { FIELD, CAMERA } from '../config.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// Forward-only camera: returns max(prevCamX, clampedTarget).
export function cameraTarget(playerX, worldW, prevCamX) {
  const want = playerX - FIELD.W * CAMERA.followRatio;
  const clamped = clamp(want, 0, Math.max(0, worldW - FIELD.W));
  return Math.max(prevCamX, clamped);
}

// 8-direction aim unit vector from input flags + state.
export function resolveAim({ facing, moveX, aimUp, aimDown, onGround }) {
  const s = Math.SQRT1_2;
  if (aimUp) return moveX === 0 ? { x: 0, y: -1 } : { x: Math.sign(moveX) * s, y: -s };
  if (aimDown && !onGround) return moveX === 0 ? { x: 0, y: 1 } : { x: Math.sign(moveX) * s, y: s };
  return { x: facing, y: 0 }; // prone (aimDown && onGround) also shoots horizontal
}

// Fan of unit vectors around baseAngle (radians); span = spreadDeg degrees total.
export function spreadDirections(baseAngle, pellets, spreadDeg) {
  const span = (spreadDeg * Math.PI) / 180;
  const out = [];
  for (let i = 0; i < pellets; i++) {
    const t = pellets === 1 ? 0.5 : i / (pellets - 1);
    const a = baseAngle - span / 2 + t * span;
    out.push({ x: Math.cos(a), y: Math.sin(a) });
  }
  return out;
}

export const angleOf = (x, y) => Math.atan2(y, x);
