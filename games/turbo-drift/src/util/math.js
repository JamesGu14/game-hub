// games/turbo-drift/src/util/math.js
import { RENDER, VIEW } from '../config.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const wrap = (v, n) => ((v % n) + n) % n;

// 伪3D 投影：相机坐标 cam{x,y,z}，世界点 world{x,y,z} → 屏幕 {x,y,w,scale}
// 地平线放在屏幕 40% 处（HORIZON），让路面占下方 ~60%，前方看得更远。
const HORIZON = 0.40;
export function project(cam, world) {
  const dz = world.z - cam.z;
  const scale = RENDER.camDepth / (dz <= 0 ? 0.0001 : dz);
  return {
    x: Math.round(VIEW.W / 2 + scale * (world.x - cam.x) * VIEW.W / 2),
    y: Math.round(VIEW.H * HORIZON - scale * (world.y - cam.y) * VIEW.H / 2),
    w: Math.round(scale * RENDER.roadW * VIEW.W / 2),
    scale,
  };
}

export function randFrom(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
