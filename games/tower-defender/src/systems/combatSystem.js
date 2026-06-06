// systems/combatSystem.js — 编排：塔 CD 到 → 对 target 开火（hitscan 即时结算）+ 产纯表现弹道。
// [N5] 死于 combat 才掉金（到城逃脱不掉金，见 pathSystem）。掉金同步写 state.gold；事件仅通知。
import { GENERALS } from '../data/generals.js';
import { BAL } from '../data/balance.js';
import { calcDamage } from './combat/damageCalc.js';
import { spawnTracer } from './combat/projectileManager.js';
import { bus } from '../core/eventBus.js';

export function combatSystem(state, dt) {
  if (state.phase !== 'combat') return;          // [P0-3] 相位守卫
  for (const tower of state.towers) {
    const g = GENERALS[tower.generalId];
    if (tower.cooldown > 0) tower.cooldown -= dt;
    const target = tower.target;
    if (tower.cooldown > 0 || !target || !target.alive) continue;
    // 命中前确认仍在射程（目标可能已移出）
    const dx = target.px - tower.px, dy = target.py - tower.py;
    if (dx * dx + dy * dy > (g.range * BAL.CELL) ** 2) continue;

    const dmg = calcDamage(g, target);            // hitscan：开火即结算
    target.hp -= dmg;
    spawnTracer(state, tower, target, g.color);
    tower.cooldown = g.interval;

    if (target.hp <= 0 && target.alive) {
      target.alive = false;
      state.gold += target.gold;                  // [N5] 同步掉金
      bus.emit('enemyKilled', { enemy: target }); // 纯通知（fx/飘字/audio）
    }
  }
}
