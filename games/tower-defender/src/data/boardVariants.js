// data/boardVariants.js — 板型变体引擎(板型+地形 spec §3.2)。纯函数、零随机、render-free。
// 三维变体:镜像(×4) × 将位套(×3) × 路子集(前半窗口轮换) → 50 关路线或将位全部唯一。
// 铁律:本文件不 import campaign(防环);resolveBoard 是 levels.js 的唯一取板入口。
import { BASE_BOARDS } from './baseBoards.js';
import { BAL } from './balance.js';

// [将位贴路] 将位距活跃路的最大距离(格):≤3.5 时 L1 黄忠(3.5)即可及、视觉贴路;
// 高台位放宽 +PLATEAU_RANGE_BONUS。resolveBoard 过滤与 verify-levels ⑤ 共用(同源铁律)。
export const SLOT_MAX_DIST = 3.5;

const MIRRORS = ['none', 'h', 'v', 'hv'];
const SLOTS_VARIANTS = 3;                       // 每板固定 3 套(2 套时章内后半 (mirror,slotsIdx) 会撞车,已推演)
const SUBSET_SIZE = { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6 };   // 章内前半营数 = 现状承诺(城名池切片不动的根)

// —— 镜像(返回深拷贝;mode: none|h|v|hv)——
const mx = (x, cols) => cols - 1 - x;
const my = (y, rows) => rows - 1 - y;

export function mirrorBoard(board, mode) {
  const fx = mode === 'h' || mode === 'hv';
  const fy = mode === 'v' || mode === 'hv';
  const { cols, rows } = board;
  const P = (p) => ({ x: fx ? mx(p.x, cols) : p.x, y: fy ? my(p.y, rows) : p.y });
  const out = {
    ...board,
    castle: {
      c: fx ? cols - board.castle.c - board.castle.w : board.castle.c,
      r: fy ? rows - board.castle.r - board.castle.h : board.castle.r,
      w: board.castle.w, h: board.castle.h,
    },
    camps: board.camps.map((cp) => ({ ...cp, c: fx ? mx(cp.c, cols) : cp.c, r: fy ? my(cp.r, rows) : cp.r })),
    paths: Object.fromEntries(Object.entries(board.paths).map(([id, wp]) => [id, wp.map(P)])),
    slotsVariants: board.slotsVariants.map((set) => set.map(P)),
    terrain: (board.terrain || []).map((z) => ({
      ...z,
      ...(z.cells ? { cells: z.cells.map(P) } : {}),
      ...(z.rects ? {
        rects: z.rects.map((r) => ({
          x: fx ? cols - r.x - r.w : r.x, y: fy ? rows - r.y - r.h : r.y, w: r.w, h: r.h,
        })),
      } : {}),
    })),
  };
  return out;
}

// —— 三维变体映射(写死公式,加载期零随机;spec §3.2)。k = 章内关序 0..9 ——
export function variantFor(chapter, k) {
  return {
    boardId: `ch${chapter}${k < 5 ? 'A' : 'B'}`,
    mirror: MIRRORS[k % 4],
    slotsIdx: (chapter + k) % SLOTS_VARIANTS,
  };
}

// 前半关(k=1..4)取子集:camps 顺序环上起点 (k-1)%n 的连续 m 条;k=0(样板)与后半 = null(全路)。
// 城名分配顺序 = 子集按模板 camps 原序过滤(levels.js 现行为),子集规则确定 ⇒ 城名分配确定。
export function pathSubsetFor(chapter, k, pathIds) {
  if (k === 0 || k >= 5) return null;
  const m = SUBSET_SIZE[chapter], n = pathIds.length;
  if (!m) throw new Error(`pathSubsetFor: 未知 chapter ${chapter}`);
  const start = (k - 1) % n;
  return Array.from({ length: m }, (_, i) => pathIds[(start + i) % n]);
}

// —— terrain 展开:rects→cells 并集 + terrainAt[r][c] 查表(加载期烘焙;spec §4)——
export function expandTerrain(board) {
  const terrainAt = Array.from({ length: board.rows }, () => Array(board.cols).fill(null));
  const terrain = (board.terrain || []).map((z) => {
    const seen = new Set();
    const cells = [];
    const push = (x, y) => {
      if (x < 0 || x >= board.cols || y < 0 || y >= board.rows) {
        throw new Error(`expandTerrain: ${z.type} 格 (${x},${y}) 超出 ${board.id || '?'} 板界 [${board.cols}×${board.rows}]`);
      }
      const key = `${x},${y}`;
      if (!seen.has(key)) { seen.add(key); cells.push({ x, y }); }
    };
    for (const c of z.cells || []) push(c.x, c.y);
    for (const r of z.rects || []) {
      for (let x = r.x; x < r.x + r.w; x++) for (let y = r.y; y < r.y + r.h; y++) push(x, y);
    }
    for (const c of cells) terrainAt[c.y][c.x] = z.type;
    return { type: z.type, cells, cellSet: seen };
  });
  return { terrain, terrainAt };
}

// —— 路径格采样:0.25 步插值 + Math.round,与 verify-levels 同源。
// 两处判定"盖没盖路"必须同一算法防漂移:resolveBoard 过滤和 verify-levels ③ 都调此函数。
export function samplePathCells(paths) {
  const cells = new Set();
  for (const pid of Object.keys(paths)) {
    const wp = paths[pid];
    if (!Array.isArray(wp)) continue;
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1];
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
      const steps = Math.max(1, Math.ceil(L / 0.25));
      for (let step = 0; step <= steps; step++) {   // step 而非 k:本文件 k 固定指章内关序,避免读者混淆
        const t = step / steps;
        cells.add(`${Math.round(a.x + (b.x - a.x) * t)},${Math.round(a.y + (b.y - a.y) * t)}`);
      }
    }
  }
  return cells;
}

// —— 路径连续采样点(格中心坐标):0.25 步插值,无出生豁免。
// [将位贴路] resolveBoard 将位过滤与 verify-levels ⑤ 共用(两处判定"将位离路多远"必须同一算法防漂移)。
export function samplePathPoints(paths) {
  const pts = [];
  for (const pid of Object.keys(paths || {})) {
    const wp = paths[pid];
    if (!Array.isArray(wp)) continue;
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], b = wp[i + 1];
      const L = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
      const steps = Math.max(1, Math.ceil(L / 0.25));
      for (let step = 0; step <= steps; step++) {
        const t = step / steps;
        pts.push({ x: a.x + (b.x - a.x) * t + 0.5, y: a.y + (b.y - a.y) * t + 0.5 });
      }
    }
  }
  return pts;
}

// —— 总装:查板 → 镜像 → 选将位套 → 路子集过滤 → terrain 展开(levels.js 唯一入口)——
export function resolveBoard(chapter, k) {
  const { boardId, mirror, slotsIdx } = variantFor(chapter, k);
  const base = BASE_BOARDS[boardId];
  if (!base) throw new Error(`boardVariants: 未知基板 '${boardId}'`);
  const b = mirrorBoard(base, mirror);
  const allIds = Object.keys(b.paths);
  const subset = pathSubsetFor(chapter, k, allIds) || allIds;
  const paths = {}; for (const id of subset) paths[id] = b.paths[id];
  const camps = b.camps.filter((cp) => subset.includes(cp.id));
  const { terrain: rawTerrain, terrainAt: rawTerrainAt } = expandTerrain(b);
  // 动态地形过滤:路子集关排除了部分路时,用 0.25 步插值采样(与 verify ③ 同源)判断
  // shallow/rockfall/firegully 区是否至少盖 1 个活跃路径格;未覆盖的孤立区剔除。
  // plateau/river/mountain 永不过滤(机制语义不依赖路径覆盖)。
  const pc = samplePathCells(paths);
  const terrain = rawTerrain.filter((z) => {
    if (!['shallow', 'rockfall', 'firegully'].includes(z.type)) return true;
    return z.cells.some((c) => pc.has(`${c.x},${c.y}`));
  });
  const terrainAt = rawTerrainAt.map((row) => [...row]);
  for (const z of rawTerrain) {
    if (!['shallow', 'rockfall', 'firegully'].includes(z.type)) continue;
    if (!z.cells.some((c) => pc.has(`${c.x},${c.y}`))) {
      for (const c of z.cells) terrainAt[c.y][c.x] = null;
    }
  }
  // [将位贴路] 路子集关将位过滤:为被排除道路设计的将位(距活跃路 > SLOT_MAX_DIST)剔除,
  // 与上方动态地形过滤同理。被剔位距活跃路 >3.5 > MIN_RANGE(2.5),对"无漏怪"覆盖判定贡献恒为 0
  // → 数学上不可能新增漏怪、不伤 winnable;高台位 +PLATEAU_RANGE_BONUS 放宽(塔在高台射程更远)。
  const pp = samplePathPoints(paths);
  const slots = b.slotsVariants[slotsIdx].filter((s) => {
    const plateau = terrainAt[s.y] && terrainAt[s.y][s.x] === 'plateau';
    const lim = SLOT_MAX_DIST + (plateau ? BAL.PLATEAU_RANGE_BONUS : 0) + 1e-9;
    for (const p of pp) {
      if (Math.hypot(s.x + 0.5 - p.x, s.y + 0.5 - p.y) <= lim) return true;
    }
    return false;
  });
  return {
    id: boardId, mirror, slotsIdx,
    cols: b.cols, rows: b.rows, castle: b.castle,
    camps, paths, slots,
    terrain, terrainAt,
  };
}
