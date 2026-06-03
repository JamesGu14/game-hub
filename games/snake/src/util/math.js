export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (a, b) => {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
};
export const dist = (a, b) => Math.sqrt(dist2(a, b));
/** Shortest signed angular difference (target - current) ∈ (-π, π]. */
export const angleDiff = (current, target) => {
    let d = (target - current) % TAU;
    if (d > Math.PI)
        d -= TAU;
    if (d <= -Math.PI)
        d += TAU;
    return d;
};
export const randRange = (lo, hi) => lo + Math.random() * (hi - lo);
