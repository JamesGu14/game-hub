// systems/targetingSystem.js — 每塔按目标模式选敌（§4 目标选择）。
// first 最前(progress最大=最接近成都) | last 最后 | strongest 血最多 | weakest 血最少。
// 射程用 towerStats(随等级)；防空过滤;统一「越大越优」键，last/weakest 取负。
import { GENERALS, towerStats } from '../data/generals.js';
import { BAL } from '../data/balance.js';

export function targetingSystem(state) {
  if (state.phase !== 'combat') return;          // [P0-3] 相位守卫
  for (const tower of state.towers) {
    const g = GENERALS[tower.generalId];
    const rangePx = towerStats(g, tower.level).range * BAL.CELL;
    const r2 = rangePx * rangePx;
    let best = null, bestKey = null;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.flying && g.targets === 'ground') continue;   // 防空：仅 targets='both'/'air' 可打飞兵
      const dx = e.px - tower.px, dy = e.py - tower.py;
      if (dx * dx + dy * dy > r2) continue;
      const key = tower.mode === 'last' ? -e.progress
        : tower.mode === 'strongest' ? e.hp
          : tower.mode === 'weakest' ? -e.hp
            : e.progress;                                  // 默认 first
      if (bestKey === null || key > bestKey) { bestKey = key; best = e; }
    }
    tower.target = best;
  }
}
