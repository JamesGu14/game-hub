// systems/waveSystem.js — 备战倒计时 / 提前出兵 / 按波次表分批出兵 / 相位 prep↔combat / 清波奖励。
import { BAL } from '../data/balance.js';
import { createEnemy } from '../entities/enemy.js';
import { waveRamp } from '../data/waveRamp.js';

export function waveSystem(state, dt) {
  if (state.phase === 'won' || state.phase === 'lost') return;
  const level = state.level;

  if (state.phase === 'prep') {
    state.prepTimer -= dt;
    if (state.prepTimer <= 0 || state.earlyRequested) startWave(state);
    return;
  }

  // combat：推进出兵计时
  for (const sp of state.activeSpawns) {
    if (sp.remaining <= 0) continue;
    if (sp.leadTimer > 0) { sp.leadTimer -= dt; continue; }
    sp.timer -= dt;
    while (sp.timer <= 0 && sp.remaining > 0) {
      state.enemies.push(createEnemy(sp.enemyType, sp.pathId, level.paths[sp.pathId], level.scale,
        { faction: level.faction, name: sp.name, bossSkills: sp.bossSkills, hpMult: sp.hpMult, bossId: sp.bossId,
          rampHp: sp.rampHp, dmgTakenMult: sp.dmgTakenMult }));  // [P3] 换皮+BOSS [P6] bossId→sprite + wave 关内 ramp 透传
      sp.remaining--;
      sp.timer += sp.interval;
      if (sp.remaining === 0) state.campsFallen[sp.campId] = true;  // 该营出尽 → 攻陷
    }
  }

  // 本波出尽且场上清空 → 清波
  const allEmitted = state.activeSpawns.every((sp) => sp.remaining <= 0);
  if (allEmitted && state.enemies.length === 0) {
    state.gold += BAL.WAVE_CLEAR_BONUS;
    if (state.waveIndex + 1 < level.waves.length) {
      state.waveIndex++;
      state.phase = 'prep';
      const nextDelay = level.waves[state.waveIndex].startDelay;
      state.prepTimer = nextDelay > 0 ? nextDelay : BAL.PREP_SECONDS;
      state.earlyRequested = false;
      state.activeSpawns = [];
    } else {
      state.allWavesEmitted = true;   // 末波清空 → victorySystem 判 won
    }
  }
}

function startWave(state) {
  const wave = state.level.waves[state.waveIndex];
  const ramp = waveRamp(state.waveIndex, state.level.waves.length);  // 本波算一次（同波常量）
  if (state.earlyRequested && state.prepTimer > 0) {
    const bonus = Math.min(Math.ceil(state.prepTimer) * BAL.EARLY_BONUS_PER_SEC, BAL.EARLY_BONUS_CAP);
    state.gold += bonus;            // [漏洞#4] 封顶 30
  }
  state.earlyRequested = false;
  state.prepTimer = 0;
  state.phase = 'combat';
  state.activeSpawns = wave.spawns.map((s) => ({
    campId: s.campId, pathId: s.pathId, enemyType: s.enemyType,
    remaining: s.count, interval: s.spawnInterval, timer: 0, leadTimer: s.leadDelay || 0,
    name: s.name, bossSkills: s.bossSkills, hpMult: s.hpMult, bossId: s.id,   // [P3] 透传给 createEnemy（换皮/BOSS）[P6] bossId→sprite
    rampHp: ramp.hpMult, dmgTakenMult: ramp.dmgTakenMult,   // wave 关内难度 ramp（所有 spawn 同波同值，含 boss/副将）
  }));
}
