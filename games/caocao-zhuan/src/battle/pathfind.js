// battle/pathfind.js — 移动范围 / 最短路（纯逻辑，不依赖 Three.js / DOM）
//
// 契约（plan §1.8 / Task B1）：
//   reachable(unit, map, occupied) -> Map<"c,r", cost>   （cost <= unit.mov）
//   path(map, from, to, moveType, occupied) -> [{c,r}...] 最短路（排除起点、含终点）或 []
//
// 规则：
//   - 进入某格的消耗 = TERRAIN[tileId].moveCost[moveType]，按 unit 兵种 moveType 取值。
//   - moveType 由 unit.classId -> CLASSES[classId].moveType（'foot'|'horse'）。
//   - 不可通行：TERRAIN[tileId].passable === false（如 water）→ 不进入、不可越过。
//   - occupied：Set<"c,r"> 已被其他单位占据的格 —— 不可停留、不可经过；
//     但单位自身起点（unit.pos）即使在 occupied 中也可正常出发。
//   - reachable 结果不含起点；只含累计消耗 <= mov 的格。
//
// 仅 import data/* —— 满足纯逻辑层约束。

import { CLASSES } from '../data/classes.js';
import { TERRAIN } from '../data/terrain.js';
import { inBounds, tileAt, neighbors } from './grid.js';

const key = (c, r) => `${c},${r}`;

/**
 * 该单位的移动型（'foot' | 'horse'）。
 */
function moveTypeOf(unit) {
  const cls = CLASSES[unit.classId];
  return cls ? cls.moveType : 'foot';
}

/**
 * 运行态 Unit 的 mov 在顶层（controller 计算后），
 * 但部分调用（如测试/构造前）放在 base.mov —— 两者都兼容。
 */
function movOf(unit) {
  if (typeof unit.mov === 'number') return unit.mov;
  if (unit.base && typeof unit.base.mov === 'number') return unit.base.mov;
  return 0;
}

/**
 * 进入 (c,r) 的消耗；不可通行返回 Infinity。
 */
function enterCost(map, c, r, moveType) {
  const tid = tileAt(map, c, r);
  if (tid == null) return Infinity;
  const def = TERRAIN[tid];
  if (!def || def.passable === false) return Infinity;
  const mc = def.moveCost ? def.moveCost[moveType] : undefined;
  return typeof mc === 'number' ? mc : Infinity;
}

/**
 * Dijkstra 移动范围。
 * @returns {Map<string, number>}  key="c,r" -> 累计消耗（<= mov，不含起点）
 */
export function reachable(unit, map, occupied = new Set()) {
  const moveType = moveTypeOf(unit);
  const maxMov = movOf(unit);
  const startC = unit.pos.c;
  const startR = unit.pos.r;
  const startKey = key(startC, startR);

  const dist = new Map(); // 含起点(=0)以便松弛，最终从结果剔除起点
  dist.set(startKey, 0);

  // 简单的「取最小未确定节点」队列（地图小，线性扫描足够）。
  const frontier = [{ c: startC, r: startR, cost: 0 }];
  const settled = new Set();

  while (frontier.length) {
    // 取当前累计消耗最小者
    let bi = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[bi].cost) bi = i;
    }
    const cur = frontier.splice(bi, 1)[0];
    const curKey = key(cur.c, cur.r);
    if (settled.has(curKey)) continue;
    settled.add(curKey);

    for (const nb of neighbors(map, cur.c, cur.r)) {
      const nKey = key(nb.c, nb.r);
      // 被占格不可停留/经过（起点除外，但起点不会作为邻居出现需进入）
      if (occupied.has(nKey)) continue;
      const step = enterCost(map, nb.c, nb.r, moveType);
      if (!isFinite(step)) continue;
      const nd = cur.cost + step;
      if (nd > maxMov) continue;
      if (!dist.has(nKey) || nd < dist.get(nKey)) {
        dist.set(nKey, nd);
        frontier.push({ c: nb.c, r: nb.r, cost: nd });
      }
    }
  }

  dist.delete(startKey); // 结果不含起点
  return dist;
}

/**
 * 最短路（按移动消耗），排除起点、含终点；不可达返回 []。
 * @returns {{c:number,r:number}[]}
 */
export function path(map, from, to, moveType, occupied = new Set()) {
  const fromKey = key(from.c, from.r);
  const toKey = key(to.c, to.r);
  if (fromKey === toKey) return []; // 原地不动

  if (!inBounds(map, to.c, to.r)) return [];
  // 终点不可通行 / 被占 → 不可达
  if (!isFinite(enterCost(map, to.c, to.r, moveType))) return [];
  if (occupied.has(toKey)) return [];

  const dist = new Map([[fromKey, 0]]);
  const prev = new Map(); // childKey -> {c,r} parent
  const frontier = [{ c: from.c, r: from.r, cost: 0 }];
  const settled = new Set();

  while (frontier.length) {
    let bi = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].cost < frontier[bi].cost) bi = i;
    }
    const cur = frontier.splice(bi, 1)[0];
    const curKey = key(cur.c, cur.r);
    if (settled.has(curKey)) continue;
    settled.add(curKey);
    if (curKey === toKey) break;

    for (const nb of neighbors(map, cur.c, cur.r)) {
      const nKey = key(nb.c, nb.r);
      if (occupied.has(nKey)) continue;
      const step = enterCost(map, nb.c, nb.r, moveType);
      if (!isFinite(step)) continue;
      const nd = cur.cost + step;
      if (!dist.has(nKey) || nd < dist.get(nKey)) {
        dist.set(nKey, nd);
        prev.set(nKey, { c: cur.c, r: cur.r });
        frontier.push({ c: nb.c, r: nb.r, cost: nd });
      }
    }
  }

  if (!prev.has(toKey)) return []; // 不可达

  // 回溯，排除起点、含终点
  const out = [];
  let k = toKey;
  let node = to;
  while (k !== fromKey) {
    out.push({ c: node.c, r: node.r });
    const p = prev.get(k);
    if (!p) return []; // 安全兜底
    node = p;
    k = key(p.c, p.r);
  }
  out.reverse();
  return out;
}
