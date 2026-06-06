// systems/statusSystem.js — 顶层状态系统（§17.3）：每步 tick 治疗 + 灼烧 DoT，按净值结算，到期清理，DoT 致死。
// gameLoop 在 combatSystem 之后调用。减速/定身不在此（由 pathSystem 经 effectiveSpeed 读取，惰性到期）。
import { BAL } from '../data/balance.js';
import { killEnemy } from './combat/kill.js';

const CELL = BAL.CELL;

export function statusSystem(state, dt) {
  if (state.phase !== 'combat') return;          // [P0-3] 相位守卫
  const now = state.time;
  const healers = state.enemies.filter((e) => e.alive && e.heal);

  for (const e of state.enemies) {
    if (!e.alive) continue;

    // 治疗：范围内所有方士求和，每目标每秒封顶 HEAL_CAP_PER_SEC；不奶自己。
    let heal = 0;
    if (healers.length) {
      for (const h of healers) {
        if (h === e) continue;
        const dx = h.px - e.px, dy = h.py - e.py;
        if (dx * dx + dy * dy <= (h.heal.range * CELL) ** 2) heal += h.heal.perSec;
      }
      if (heal > BAL.HEAL_CAP_PER_SEC) heal = BAL.HEAL_CAP_PER_SEC;
    }

    // 灼烧：到期层剔除，余层 dps 求和。
    const burns = (e.statuses.burn || []).filter((b) => b.until > now);
    e.statuses.burn = burns;
    let burn = 0;
    for (const b of burns) burn += b.dps;

    // 净值结算（治疗抵消 DoT），不超 maxHp。
    const net = (heal - burn) * dt;
    if (net) e.hp = Math.min(e.maxHp, e.hp + net);
    if (e.hp <= 0) killEnemy(state, e);            // DoT 致死同样掉金 + emit
  }
}
