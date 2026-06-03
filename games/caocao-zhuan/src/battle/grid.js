// battle/grid.js — 网格基础查询（纯逻辑，不依赖 Three.js / DOM）
//
// 契约（plan §1.8）：tileAt(map,c,r) / inBounds(map,c,r) / neighbors(map,c,r)
//
// map 形状（plan §1.6）：
//   { cols, rows, tiles }  其中 tiles[r][c] = terrainId（字符串）
//
// 坐标约定：c = 列(column, 0..cols-1)，r = 行(row, 0..rows-1)。
// 仅可 import data/* 与 core/rng.js —— 本文件无外部依赖。

/**
 * 坐标是否在地图边界内。
 * @returns {boolean}
 */
export function inBounds(map, c, r) {
  return c >= 0 && r >= 0 && c < map.cols && r < map.rows;
}

/**
 * 取 (c,r) 处地形 id；出界返回 null。
 * @returns {string|null}
 */
export function tileAt(map, c, r) {
  if (!inBounds(map, c, r)) return null;
  const row = map.tiles[r];
  return row ? row[c] : null;
}

/**
 * 四邻（上下左右）中在界内的格，返回 [{c,r},...]。
 * @returns {{c:number,r:number}[]}
 */
export function neighbors(map, c, r) {
  const out = [];
  const deltas = [
    { c: 1, r: 0 },
    { c: -1, r: 0 },
    { c: 0, r: 1 },
    { c: 0, r: -1 },
  ];
  for (const d of deltas) {
    const nc = c + d.c;
    const nr = r + d.r;
    if (inBounds(map, nc, nr)) out.push({ c: nc, r: nr });
  }
  return out;
}
