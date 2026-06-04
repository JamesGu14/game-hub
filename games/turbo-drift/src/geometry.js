// games/turbo-drift/src/geometry.js
// 把赛道段标量数据 (curve, worldY) 在地面平面累积成真实 3D 中线路径（纯函数、可单测）。
// 设计见 docs/superpowers/specs/2026-06-03-turbo-drift-3d-renderer-design.md §3。
import { RENDER } from './config.js';

export const CURVE_TO_RAD = 0.006; // 每段 curve 标量 → 地面转角（弧度）；调大弯更急
const Y_SCALE = 1;                 // worldY 高度缩放

// 把赛道段(curve, worldY) 在地面平面累积成真实 3D 中线路径。
// 注：现有 4 条赛道是为伪3D 设计（净转角≈0、非几何闭环），中线是一条开放路径，
// 由 worldAt 按里程取模循环。首尾接缝（终点线）由渲染层做护栏：跳过 wrap 路面四边形
// + 过线时相机直切（不 lerp），避免一圈一次的剧烈扫动。闭环平滑属可选项（spec §3/§12）。
export function buildCenterline(track) {
  const segs = track.segs, n = segs.length, seg = RENDER.segLen;
  const pts = []; let heading = 0, x = 0, z = 0;
  for (let i = 0; i < n; i++) {
    heading += segs[i].curve * CURVE_TO_RAD;
    x += Math.sin(heading) * seg;
    z += Math.cos(heading) * seg;
    pts.push({ x, y: segs[i].worldY * Y_SCALE, z, heading });
  }
  return pts;
}

const lerp = (a, b, t) => a + (b - a) * t;

export function headingAt(pts, zDist) {
  const seg = RENDER.segLen, total = pts.length;
  const s = zDist / seg;
  const i = ((Math.floor(s) % total) + total) % total;
  const j = (i + 1) % total;
  const f = s - Math.floor(s);
  // 接缝：末段(j回绕到0)不向起点插值（开放路径，否则朝向横跨全图突变）；过线由相机直切处理。
  if (j === 0) return pts[i].heading;
  return lerp(pts[i].heading, pts[j].heading, f);
}

// 由里程 z 与横向 lateral(-1..1) 求世界点 + 该处朝向。
export function worldAt(pts, zDist, lateral) {
  const seg = RENDER.segLen, total = pts.length;
  const s = zDist / seg;
  const i = ((Math.floor(s) % total) + total) % total;
  const j = (i + 1) % total;
  const f = s - Math.floor(s);
  // 接缝：末段(j回绕到0)不向起点插值，否则会横跨整张图 smear；过线由相机直切处理。
  const a = pts[i], b = (j === 0) ? a : pts[j];
  const cx = lerp(a.x, b.x, f), cy = lerp(a.y, b.y, f), cz = lerp(a.z, b.z, f);
  const h = lerp(a.heading, b.heading, f);
  // 朝向 (sin h, cos h) 的右法向
  const rx = Math.cos(h), rz = -Math.sin(h);
  return {
    pos: { x: cx + rx * lateral * RENDER.roadW, y: cy, z: cz + rz * lateral * RENDER.roadW },
    heading: h,
  };
}

export const trackLength = pts => pts.length * RENDER.segLen;
