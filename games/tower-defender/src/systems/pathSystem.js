// systems/pathSystem.js — 敌推进。地面沿蜀道 waypoint；飞兵直扑成都中心。到城同步扣城。
// [N1] 到城：同步改 castleHp + 立即翻 phase（不靠事件）；事件仅通知。 [N5] 到城不掉金。
// [P2] 速度经 effectiveSpeed（减速/定身）；飞兵直线无视 waypoint；马超击退先消费；维护 e.progress。
import { ENEMIES } from '../data/enemies.js';
import { BAL } from '../data/balance.js';
import { bus } from '../core/eventBus.js';
import { effectiveSpeed } from './combat/statusEffects.js';

const CELL = BAL.CELL;

export function pathSystem(state, dt) {
  if (state.phase !== 'combat') return;          // [P0-3] 相位守卫
  const now = state.time;
  const paths = state.level.paths;
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (e.flying) { moveFlyer(state, e, dt, now); continue; }   // [P2] 飞兵直线

    const path = paths[e.pathId];
    if (e.knockback > 0) { retreatAlongPath(e, path, e.knockback); e.knockback = 0; }  // [P2] 击退

    let move = effectiveSpeed(e, now) * dt;       // [P2] 减速/定身后的有效速度
    while (move > 0 && e.alive) {
      const a = path[e.seg], b = path[e.seg + 1];
      if (!b) { reachCastle(state, e); break; }   // 无下一点 = 到成都
      const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
      const remain = (1 - e.t) * segLen;
      if (move >= remain) { move -= remain; e.seg++; e.t = 0; }
      else { e.t += move / segLen; move = 0; }
    }
    updatePos(e, path);
    e.progress = e.seg + e.t;                     // [P2] 地面进度 = seg+t
  }
}

function updatePos(e, path) {
  const a = path[e.seg], b = path[e.seg + 1];
  if (!b) { e.gx = a.x; e.gy = a.y; }
  else { e.gx = a.x + (b.x - a.x) * e.t; e.gy = a.y + (b.y - a.y) * e.t; }
  e.px = e.gx * CELL + CELL / 2;
  e.py = e.gy * CELL + CELL / 2;
}

// 飞兵：朝成都中心像素点直线推进；progress=累计飞行格数（单调递增，可被 targeting 排序）。
function moveFlyer(state, e, dt, now) {
  const { castle } = state.level;
  const tx = (castle.c + castle.w / 2) * CELL;
  const ty = (castle.r + castle.h / 2) * CELL;
  const dx = tx - e.px, dy = ty - e.py;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const stepPx = effectiveSpeed(e, now) * CELL * dt;
  if (stepPx >= dist - 0.3 * CELL) {             // 到城门（≤0.3格）
    e.progress += dist / CELL;
    reachCastle(state, e);
    return;
  }
  e.px += (dx / dist) * stepPx; e.py += (dy / dist) * stepPx;
  e.progress += stepPx / CELL;
}

// 沿 path 反向后退 cells 格（夹到起点）。
function retreatAlongPath(e, path, cells) {
  let back = cells;
  while (back > 1e-9) {
    if (e.seg <= 0 && e.t <= 0) { e.seg = 0; e.t = 0; break; }
    const a = path[e.seg], b = path[e.seg + 1] || a;
    const segLen = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
    const into = e.t * segLen;                    // 当前段已走距离
    if (back <= into) { e.t -= back / segLen; back = 0; }
    else { back -= into; e.seg -= 1; e.t = 1; if (e.seg < 0) { e.seg = 0; e.t = 0; break; } }
  }
}

function reachCastle(state, e) {
  const dmg = ENEMIES[e.type].castleDmg;
  state.castleHp -= dmg;                          // [N1] 同步
  e.alive = false;
  if (state.castleHp <= 0) { state.castleHp = 0; state.phase = 'lost'; }
  bus.emit('castleDamaged', { dmg });             // 纯通知（[N5] 不掉金）
}
