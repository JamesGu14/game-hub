// systems/bossSystem.js — [P3] 司马懿(L8 终 BOSS)2 主动技(§17.3)。
// summon: 每 BOSS_SUMMON_CD 秒在自身路点位置召 BOSS_SUMMON_COUNT 名魏卒(继承 seg/t/progress/px,沿路继续)。
// stunTower: 每 BOSS_STUN_CD 秒令最近一座将塔 stunnedUntil=now+BOSS_STUN_DUR(combatSystem 停火)。
// 单时钟:技能 CD 用 dt 递减(不乘 speed)。仅带 bossSkills 的敌(=司马懿)走此。
import { BAL } from '../data/balance.js';
import { createEnemy } from '../entities/enemy.js';

export function bossSystem(state, dt) {
  if (state.phase !== 'combat') return;          // [P0-3] 相位守卫
  const now = state.time;
  for (const e of state.enemies) {
    if (!e.alive || !e.bossSkills) continue;      // 召出的小兵无 bossSkills → 跳过(不会无限召)
    const T = e.skillTimers;
    if (e.bossSkills.includes('summon')) {
      T.summon -= dt;
      if (T.summon <= 0) { summon(state, e); T.summon = BAL.BOSS_SUMMON_CD; }
    }
    if (e.bossSkills.includes('stunTower')) {
      T.stunTower -= dt;
      if (T.stunTower <= 0) { stunTower(state, e, now); T.stunTower = BAL.BOSS_STUN_CD; }
    }
  }
}

// 在 boss 当前位置召小兵,继承路点 → 沿路继续(不从敌营重生跑全程)。
function summon(state, boss) {
  const path = state.level.paths[boss.pathId];
  for (let i = 0; i < BAL.BOSS_SUMMON_COUNT; i++) {
    const m = createEnemy('footman', boss.pathId, path, state.level.scale, { faction: state.level.faction });
    m.seg = boss.seg; m.t = boss.t; m.progress = boss.progress;
    m.gx = boss.gx; m.gy = boss.gy; m.px = boss.px; m.py = boss.py;
    state.enemies.push(m);
  }
}

// 震慑离 boss 最近的一座将塔。
function stunTower(state, boss, now) {
  let best = null, bd = Infinity;
  for (const t of state.towers) {
    const dx = t.px - boss.px, dy = t.py - boss.py, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = t; }
  }
  if (best) best.stunnedUntil = now + BAL.BOSS_STUN_DUR;
}
