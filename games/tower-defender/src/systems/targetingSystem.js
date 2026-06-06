// systems/targetingSystem.js — 每塔选目标。M1 仅「最前」（沿路进度最大 = 最接近成都）。
import { GENERALS } from '../data/generals.js';
import { BAL } from '../data/balance.js';

export function targetingSystem(state) {
  if (state.phase !== 'combat') return;          // [P0-3] 相位守卫
  for (const tower of state.towers) {
    const g = GENERALS[tower.generalId];
    const rangePx = g.range * BAL.CELL;
    const r2 = rangePx * rangePx;
    let best = null, bestProgress = -1;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.flying && g.targets === 'ground') continue;   // 防空：仅 targets='both'/'air' 可打飞兵
      const dx = e.px - tower.px, dy = e.py - tower.py;
      if (dx * dx + dy * dy > r2) continue;
      const progress = e.seg + e.t;
      if (progress > bestProgress) { bestProgress = progress; best = e; }
    }
    tower.target = best;
  }
}
