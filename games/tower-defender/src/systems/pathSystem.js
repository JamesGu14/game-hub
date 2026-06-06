// systems/pathSystem.js — 敌沿蜀道 waypoint 推进；到成都同步扣城。
// [N1] 到城：同步改 castleHp + 立即翻 phase（不靠事件）；事件仅通知。 [N5] 到城不掉金。
import { ENEMIES } from '../data/enemies.js';
import { BAL } from '../data/balance.js';
import { bus } from '../core/eventBus.js';

export function pathSystem(state, dt) {
  if (state.phase !== 'combat') return;          // [P0-3] 相位守卫
  const paths = state.level.paths;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    const path = paths[e.pathId];
    let move = e.speed * dt;                      // 本步可走的格数
    while (move > 0 && e.alive) {
      const a = path[e.seg], b = path[e.seg + 1];
      if (!b) { reachCastle(state, e); break; }   // 无下一点 = 到成都
      const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
      const remain = (1 - e.t) * segLen;
      if (move >= remain) { move -= remain; e.seg++; e.t = 0; }
      else { e.t += move / segLen; move = 0; }
    }
    updatePos(e, path);
  }
}

function updatePos(e, path) {
  const a = path[e.seg], b = path[e.seg + 1];
  if (!b) { e.gx = a.x; e.gy = a.y; }
  else { e.gx = a.x + (b.x - a.x) * e.t; e.gy = a.y + (b.y - a.y) * e.t; }
  e.px = e.gx * BAL.CELL + BAL.CELL / 2;
  e.py = e.gy * BAL.CELL + BAL.CELL / 2;
}

function reachCastle(state, e) {
  const dmg = ENEMIES[e.type].castleDmg;
  state.castleHp -= dmg;                          // [N1] 同步
  e.alive = false;
  if (state.castleHp <= 0) { state.castleHp = 0; state.phase = 'lost'; }
  bus.emit('castleDamaged', { dmg });             // 纯通知（[N5] 不掉金）
}
