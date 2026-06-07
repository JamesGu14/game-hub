// tools/suggest-slots.mjs — [dev] 关卡将位自动布点(贪心集合覆盖)。
// 给定 paths/castle,生成「不在路上/不在城上/不在营上、完整覆盖每段(≤MIN_RANGE)」的将位集,
// 输出静态数组供粘贴进 levels.js(非运行时生成 → 不违反"手工关卡";仅作者辅助)。
// 用法:node tools/suggest-slots.mjs
import { LEVELS } from '../src/data/levels.js';

const MIN_RANGE = 2.5, GRACE = 1.0, STEP = 0.5;

function suggest(level) {
  const cs = level.castle;
  const castleCells = new Set();
  for (let c = cs.c; c < cs.c + cs.w; c++) for (let r = cs.r; r < cs.r + cs.h; r++) castleCells.add(`${c},${r}`);
  const campCells = new Set((level.camps || []).map((c) => `${c.c},${c.r}`));

  const pathCells = new Set();
  const pts = [];   // 需覆盖的采样点(格中心坐标),含出生豁免
  for (const pid in level.paths) {
    const wp = level.paths[pid]; let dist = 0;
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1];
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
      const rs = Math.max(1, Math.ceil(L / 0.25));
      for (let k = 0; k <= rs; k++) { const tt = k / rs; pathCells.add(`${Math.round(a.x + (b.x - a.x) * tt)},${Math.round(a.y + (b.y - a.y) * tt)}`); }
      const ps = Math.max(1, Math.ceil(L / STEP));
      for (let k = 0; k <= ps; k++) { const tt = k / ps; if (dist + L * tt < GRACE) continue; pts.push({ x: a.x + (b.x - a.x) * tt + 0.5, y: a.y + (b.y - a.y) * tt + 0.5 }); }
      dist += L;
    }
  }

  // 候选格:界内、非路、非城、非营
  let cands = [];
  for (let x = 0; x < level.cols; x++) for (let y = 0; y < level.rows; y++) {
    const k = `${x},${y}`;
    if (pathCells.has(k) || castleCells.has(k) || campCells.has(k)) continue;
    cands.push({ x, y });
  }

  // 贪心:每轮选覆盖最多未覆盖点的候选
  const covered = new Array(pts.length).fill(false);
  const r2 = MIN_RANGE * MIN_RANGE;
  const slots = []; let remaining = pts.length;
  while (remaining > 0) {
    let best = null, bestCnt = 0, bestList = null, bestIdx = -1;
    for (let ci = 0; ci < cands.length; ci++) {
      const c = cands[ci], cx = c.x + 0.5, cy = c.y + 0.5; let cnt = 0; const list = [];
      for (let i = 0; i < pts.length; i++) { if (covered[i]) continue; const dx = pts[i].x - cx, dy = pts[i].y - cy; if (dx * dx + dy * dy <= r2) { cnt++; list.push(i); } }
      if (cnt > bestCnt) { bestCnt = cnt; best = c; bestList = list; bestIdx = ci; }
    }
    if (!best) break;
    slots.push(best); for (const i of bestList) covered[i] = true; remaining -= bestCnt; cands.splice(bestIdx, 1);
  }

  // 冗余位:覆盖达成后,再按"贴路程度"补点,给玩家建造选择(目标 ≈ 覆盖数 ×1.7)。
  const target = Math.ceil(slots.length * 1.7);
  const scored = cands.map((c) => {
    const cx = c.x + 0.5, cy = c.y + 0.5; let s = 0;
    for (const pt of pts) { const dx = pt.x - cx, dy = pt.y - cy; if (dx * dx + dy * dy <= r2) s++; }
    return { c, s };
  }).filter((o) => o.s > 0).sort((a, b) => b.s - a.s);
  for (const o of scored) { if (slots.length >= target) break; slots.push(o.c); }

  return { slots, uncovered: remaining };
}

for (const lv of LEVELS) {
  const { slots, uncovered } = suggest(lv);
  const tag = uncovered ? ` ⚠ ${uncovered} 点无法覆盖(路贴墙/城?)` : '';
  console.log(`// L${lv.id} ${lv.name}: ${slots.length} 将位${tag}`);
  console.log(`slots: [${slots.map((s) => `{ x: ${s.x}, y: ${s.y} }`).join(', ')}],`);
}
