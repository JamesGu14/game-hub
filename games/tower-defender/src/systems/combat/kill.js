// systems/combat/kill.js — 共享击杀:alive=false + 同步掉金 + emit 通知。
// [N5] 死于战斗（含 DoT 致死）才掉金；到城逃脱不掉金（见 pathSystem）。
// 单点化：combat/attacks/signature/statusSystem 一律走此，杜绝重复 emit / 漏掉金。
import { bus } from '../../core/eventBus.js';

export function killEnemy(state, enemy) {
  if (!enemy.alive) return false;                 // 已死幂等：不重复掉金/emit
  enemy.alive = false;
  state.gold += enemy.gold;                        // [N5] 同步写 state（权威）
  bus.emit('enemyKilled', { enemy });             // 纯通知（fx/飘字/audio）
  return true;
}
