export interface Vec2 {
  x: number;
  y: number;
}

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const dist2 = (a: Vec2, b: Vec2): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
};

export const dist = (a: Vec2, b: Vec2): number => Math.sqrt(dist2(a, b));

/** Shortest signed angular difference (target - current) ∈ (-π, π]. */
export const angleDiff = (current: number, target: number): number => {
  let d = (target - current) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
};

export const randRange = (lo: number, hi: number): number =>
  lo + Math.random() * (hi - lo);
