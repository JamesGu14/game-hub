// systems/combatSystem.js — 编排器：每塔 tick 攻击CD + 招牌技CD → 在射程内对 target 按 attack 派发。
// 击杀走 attacks→killEnemy（同步掉金 + emit）；伤害/效果细节见 combat/attacks.js、combat/signatureSkills.js。
import { GENERALS, towerStats } from '../data/generals.js';
import { BAL } from '../data/balance.js';
import { runAttack } from './combat/attacks.js';
import { fireSignature } from './combat/signatureSkills.js';

export function combatSystem(state, dt) {
  if (state.phase !== 'combat') return;          // [P0-3] 相位守卫
  const now = state.time, rng = state.rng;
  for (const tower of state.towers) {
    const g = GENERALS[tower.generalId];
    if (now < (tower.stunnedUntil || 0)) continue;  // [P3] 被司马懿震慑：整塔停摆（含 CD 冻结）
    if (tower.cooldown > 0) tower.cooldown -= dt;
    if (tower.signatureCd > 0) tower.signatureCd -= dt;

    // L3 冷却技到点自动释放（关羽水淹七军 / 张飞当阳怒吼）；成功放才进 CD。
    if (tower.level >= BAL.SIGNATURE_LEVEL && g.signature?.type === 'cooldown' && tower.signatureCd <= 0) {
      if (fireSignature(state, tower, g, now)) tower.signatureCd = g.signature.cooldown;
    }

    const target = tower.target;
    if (tower.cooldown > 0 || !target || !target.alive) continue;
    const stats = towerStats(g, tower.level);     // 升级生效：射程/间隔随等级
    const dx = target.px - tower.px, dy = target.py - tower.py;
    if (dx * dx + dy * dy > (stats.range * BAL.CELL) ** 2) continue;   // 命中前确认在射程

    runAttack(state, tower, g, target, now, rng);
    tower.cooldown = stats.interval;
    tower.lastFireAt = now;                        // [P6] 出手时间戳（纯表现：entityRenderer 出手前冲/提亮补间）
    tower.aimX = target.px; tower.aimY = target.py; // [P6] 出手朝向（前冲方向）
  }
}
