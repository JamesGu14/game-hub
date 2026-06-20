// util.js — 纯数学与确定性 RNG 工具。可被 node:test 直接 import。
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

// mulberry32：32 位确定性 PRNG。seed 同 → 序列同（平衡模拟器/可复现测试需要）。
export function rngFrom(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 加权随机：weightFn(item)≥0；总权重 0 时返回首项兜底。
export function pickWeighted(items, weightFn, rng) {
  let total = 0;
  for (const it of items) total += Math.max(0, weightFn(it));
  if (total <= 0) return items[0];
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, weightFn(it));
    if (r < 0) return it;
  }
  return items[items.length - 1];
}
