// tools/suggest-slots.mjs — [dev] 关卡将位自动布点(贪心集合覆盖)。
// 给定 paths/castle,生成「不在路上/不在城上/不在营上、完整覆盖每段(≤MIN_RANGE)」的将位集,
// 输出静态数组供粘贴进 levels.js(非运行时生成 → 不违反"手工关卡";仅作者辅助)。
// 用法A(全量):node tools/suggest-slots.mjs
// 用法B(基板):node tools/suggest-slots.mjs --board ch1A [--seed N]
//   对单张基板全路布点;排除 river/mountain;plateau 格优先有将位;3 种子(--seed 指定单个)输出互不相同的将位套。
import { LEVELS } from '../src/data/levels.js';
import { BASE_BOARDS } from '../src/data/baseBoards.js';
import { expandTerrain } from '../src/data/boardVariants.js';
import { makeRng } from '../src/core/rng.js';

const MIN_RANGE = 2.5, GRACE = 1.0, STEP = 0.5;

function suggest(level, seed = 0) {
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

  // 候选格:界内、非路、非城、非营、非禁建地形(river/mountain)
  let cands = [];
  for (let x = 0; x < level.cols; x++) for (let y = 0; y < level.rows; y++) {
    const k = `${x},${y}`;
    if (pathCells.has(k) || castleCells.has(k) || campCells.has(k)) continue;
    const ty = level.terrainAt && level.terrainAt[y] ? level.terrainAt[y][x] : null;
    if (ty === 'river' || ty === 'mountain') continue;
    cands.push({ x, y });
  }

  // 打分抖动 + plateau 加成(seed=0 且无 terrainAt → 零影响,旧 LEVELS 行为完全不变)
  const rng = makeRng(seed * 7919 + 1);
  const jitter = new Map();
  const bias = (c) => {
    if (!seed && !(level.terrainAt)) return 0;          // LEVELS 模式(seed=0 且无 terrainAt)bias 全零→旧行为逐位不变;board 模式 seed≥1 不走此分支
    const key = `${c.x},${c.y}`;
    if (!jitter.has(key)) jitter.set(key, seed ? (rng() - 0.5) * 0.6 : 0);
    const onPlateau = level.terrainAt && level.terrainAt[c.y] && level.terrainAt[c.y][c.x] === 'plateau' ? 0.5 : 0;
    return onPlateau + jitter.get(key);
  };

  // 贪心:每轮选覆盖最多未覆盖点的候选(cnt===0 不可入选)
  const covered = new Array(pts.length).fill(false);
  const r2 = MIN_RANGE * MIN_RANGE;
  const slots = []; let remaining = pts.length;
  while (remaining > 0) {
    let best = null, bestScore = 0, bestList = null, bestIdx = -1;
    for (let ci = 0; ci < cands.length; ci++) {
      const c = cands[ci], cx = c.x + 0.5, cy = c.y + 0.5; let cnt = 0; const list = [];
      for (let i = 0; i < pts.length; i++) { if (covered[i]) continue; const dx = pts[i].x - cx, dy = pts[i].y - cy; if (dx * dx + dy * dy <= r2) { cnt++; list.push(i); } }
      if (cnt === 0) continue;
      const score = cnt + bias(c);
      if (best === null || score > bestScore) { bestScore = score; best = c; bestList = list; bestIdx = ci; }
    }
    if (!best) break;
    slots.push(best); for (const i of bestList) covered[i] = true; remaining -= bestList.length; cands.splice(bestIdx, 1);
  }

  // 冗余位:覆盖达成后,再按"贴路程度"补点,给玩家建造选择(目标 ≈ 覆盖数 ×1.7)。
  const target = Math.ceil(slots.length * 1.7);
  const scored = cands.map((c) => {
    const cx = c.x + 0.5, cy = c.y + 0.5; let s = 0;
    for (const pt of pts) { const dx = pt.x - cx, dy = pt.y - cy; if (dx * dx + dy * dy <= r2) s++; }
    return { c, s };
  }).filter((o) => o.s > 0).sort((a, b) => (b.s + bias(b.c)) - (a.s + bias(a.c)));
  for (const o of scored) { if (slots.length >= target) break; slots.push(o.c); }

  // plateau 兜底:每个 plateau 区若无任何已选 slot,从区内候选挑"贴路程度最高"的补入
  if (level.terrainAt) {
    for (const z of level.terrain || []) {
      if (z.type !== 'plateau') continue;
      if (z.cells.some((c) => slots.some((s) => s.x === c.x && s.y === c.y))) continue;
      const inZone = scored.filter((o) => z.cellSet.has(`${o.c.x},${o.c.y}`) && !slots.includes(o.c));
      if (inZone.length) slots.push(inZone[0].c);
      else console.error(`  [warn] plateau 区无可用候选(路太远?该区将无将位,verify ④ 会拦)`);
    }
  }

  return { slots, uncovered: remaining };
}

const bIdx = process.argv.indexOf('--board');
if (bIdx > 0) {
  const id = process.argv[bIdx + 1];
  const board = BASE_BOARDS[id];
  if (!board) { console.error(`无基板 ${id};现有: ${Object.keys(BASE_BOARDS).join(',') || '(空)'}`); process.exit(1); }
  const { terrain, terrainAt } = expandTerrain(board);
  const sIdx = process.argv.indexOf('--seed');
  const seeds = sIdx > 0 ? [+process.argv[sIdx + 1]] : [1, 2, 3];
  if (seeds.some((s) => !Number.isFinite(s))) { console.error('--seed 需要整数值'); process.exit(1); }
  const lv = { cols: board.cols, rows: board.rows, castle: board.castle, camps: board.camps, paths: board.paths, terrain, terrainAt };
  for (const seed of seeds) {
    const { slots, uncovered } = suggest(lv, seed);
    const tag = uncovered ? ` ⚠ ${uncovered} 点无法覆盖` : '';
    console.log(`// ${id} seed${seed}: ${slots.length} 将位${tag}`);
    console.log(`[${slots.map((s) => `{ x: ${s.x}, y: ${s.y} }`).join(', ')}],`);
  }
} else {
  // 原 LEVELS 全量模式(逐位不变)
  for (const lv of LEVELS) {
    const { slots, uncovered } = suggest(lv);
    const tag = uncovered ? ` ⚠ ${uncovered} 点无法覆盖(路贴墙/城?)` : '';
    console.log(`// L${lv.id} ${lv.name}: ${slots.length} 将位${tag}`);
    console.log(`slots: [${slots.map((s) => `{ x: ${s.x}, y: ${s.y} }`).join(', ')}],`);
  }
}
