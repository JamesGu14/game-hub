// data/waveRamp.js — 关内 wave 难度递增（纯函数·确定性）。
// 首波(waveIndex=0)→末波(waveIndex=waveCount-1)：线性抬 HP、t² 后置抬全局减伤。
// 叠在 level.scale 之上；每关独立（关间不累积）。常量见 BAL.WAVE_HP_RAMP_MAX / WAVE_DEF_RAMP_MIN。
// hpMax：HP ramp 末波上限，默认 BAL.WAVE_HP_RAMP_MAX；可由 level.rampMax 覆盖（如 L50 司马懿终关设 1.0 豁免，保其出厂难度）。
import { BAL } from './balance.js';

export function waveRamp(waveIndex, waveCount, hpMax = BAL.WAVE_HP_RAMP_MAX) {
  const t = waveCount > 1 ? waveIndex / (waveCount - 1) : 0;     // 首波0→末波1；waveCount=1 防除零
  const hpMult = 1 + (hpMax - 1) * t;                          // 线性 1→hpMax
  const dmgTakenMult = 1 - (1 - BAL.WAVE_DEF_RAMP_MIN) * t * t; // 后置 t²：1→0.85
  return { hpMult, dmgTakenMult };
}
