// render/ground.js — [背景spec] 章节化地表:布点纯函数 + 离屏烘焙 + 轻动效。
// 布点零 canvas/DOM(node 可单测);seed='ground-'+level.id 走 makeRng,零 Math.random。
// 烘焙只持当前关 1 张(≈7MB,防 50 关全缓存 OOM);BAL.GROUND_THEMES=false 时本模块不被触达。
import { BAL } from '../data/balance.js';
import { makeRng } from '../core/rng.js';
import { themeOf } from '../data/chapterThemes.js';
import { terrainTypeAt } from '../systems/terrainSystem.js';

const C = BAL.CELL;
const key = (x, y) => x + ',' + y;

// —— 布点助手(spec §5.1):路径格展开 / 硬禁区 / 软禁区(沿路 8 邻 1 格) ——
// 注:路径段须轴对齐(dx/dy 必有一为零,50关数据均满足);对角段会步进不达终点,勿喂斜段。
export function pathCellSet(level) {
  const set = new Set();
  for (const id in level.paths) {
    const wp = level.paths[id];
    for (let i = 1; i < wp.length; i++) {
      const a = wp[i - 1], b = wp[i];
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      let x = a.x, y = a.y;
      set.add(key(x, y));
      while (x !== b.x || y !== b.y) { x += dx; y += dy; set.add(key(x, y)); }
    }
  }
  return set;
}

export function hardBanSet(level, pathSet) {
  const ban = new Set(pathSet);
  for (const s of level.slots) ban.add(key(s.x, s.y));
  const { c, r, w, h } = level.castle;
  for (let y = r; y < r + h; y++) for (let x = c; x < c + w; x++) ban.add(key(x, y));
  for (let x = c; x < c + w; x++) ban.add(key(x, r + h));                  // 城名牌行(spec §5.1)
  for (const cp of level.camps) {
    ban.add(key(cp.c, cp.r));
    if (cp.r + 1 < level.rows) ban.add(key(cp.c, cp.r + 1));   // 名牌格盘内才加(底行营无名牌行,防越界key埋雷)
  }
  for (let y = 0; y < level.rows; y++) for (let x = 0; x < level.cols; x++) {
    if (terrainTypeAt(level, x, y)) ban.add(key(x, y));                    // 玩法地形:复用 terrainAt,不造第二套索引
  }
  return ban;
}

// 注:边缘路径格的8邻会产生越界/负坐标 key;布点扫描只走盘内格,越界 key 静默无害。
export function softBanSet(level, pathSet) {
  const soft = new Set();
  for (const k of pathSet) {
    const [x, y] = k.split(',').map(Number);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const k2 = key(x + dx, y + dy);
      if (!pathSet.has(k2)) soft.add(k2);
    }
  }
  return soft;
}
