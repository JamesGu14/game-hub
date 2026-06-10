// data/boardVariants.js — 板型变体引擎(板型+地形 spec §3.2)。纯函数、零随机、render-free。
// 三维变体:镜像(×4) × 将位套(×3) × 路子集(前半窗口轮换) → 50 关路线或将位全部唯一。
// 铁律:本文件不 import campaign(防环);resolveBoard 是 levels.js 的唯一取板入口。
import { BASE_BOARDS } from './baseBoards.js';

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
      for (let k = 0; k <= steps; k++) {
        const t = k / steps;
        cells.add(`${Math.round(a.x + (b.x - a.x) * t)},${Math.round(a.y + (b.y - a.y) * t)}`);
      }
    }
  }
  return cells;
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
  return {
    id: boardId, mirror, slotsIdx,
    cols: b.cols, rows: b.rows, castle: b.castle,
    camps, paths, slots: b.slotsVariants[slotsIdx],
    terrain, terrainAt,
  };
}
