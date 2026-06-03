export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const angleOf = (dx, dy) => Math.atan2(dy, dx);
export const toRad = (deg) => (deg * Math.PI) / 180;
export const toDeg = (rad) => (rad * 180) / Math.PI;
export const vecFromAngle = (angle, mag = 1) => ({ x: Math.cos(angle) * mag, y: Math.sin(angle) * mag });
