// 6-level campaign data for 炮炮虫 BOOM WORMS. Pure data — importable by node:test.
import { FIELD, WATER } from './config.js';

export const LEVELS = [
  {
    name: '绿草训练场',
    theme: 'grass',
    palette: { sky: '#87ceeb', land: '#5a8a3c', land2: '#3d6b24', water: '#1a6db5' },
    terrainParams: { ruggedness: 0.28, peaks: 3, platforms: 1, caves: 0, floors: 0 },
    playerCount: 3,
    enemyCount: 2,
    aiError: 0.9,
    wind: 0,
  },
  {
    name: '糖果乐园',
    theme: 'candy',
    palette: { sky: '#ffb3d9', land: '#ff69b4', land2: '#c2185b', water: '#80deea' },
    terrainParams: { ruggedness: 0.42, peaks: 4, platforms: 2, caves: 0, floors: 0 },
    playerCount: 3,
    enemyCount: 3,
    aiError: 0.7,
    wind: 0,
  },
  {
    name: '阳光海滩',
    theme: 'beach',
    palette: { sky: '#87ceeb', land: '#e8c97a', land2: '#c9a84c', water: '#1a8fc7' },
    terrainParams: { ruggedness: 0.38, peaks: 3, platforms: 1, caves: 0, floors: 0 },
    playerCount: 3,
    enemyCount: 3,
    aiError: 0.55,
    wind: 0,
  },
  {
    name: '神秘丛林',
    theme: 'jungle',
    palette: { sky: '#2d5a27', land: '#1a7a1a', land2: '#0f5c0f', water: '#1a5c3a' },
    terrainParams: { ruggedness: 0.55, peaks: 5, platforms: 3, caves: 2, floors: 3 },
    playerCount: 3,
    enemyCount: 3,
    aiError: 0.4,
    wind: 0,
  },
  {
    name: '云端天空',
    theme: 'sky',
    palette: { sky: '#b3d9ff', land: '#ffffff', land2: '#d0e8ff', water: '#4a90d9' },
    terrainParams: { ruggedness: 0.48, peaks: 4, platforms: 4, caves: 0, floors: 4 },
    playerCount: 3,
    enemyCount: 3,
    aiError: 0.28,
    wind: 0,
  },
  {
    name: '彩虹山决战',
    theme: 'rainbow',
    palette: { sky: '#1a0533', land: '#9b59b6', land2: '#6c3483', water: '#1a0a2e' },
    terrainParams: { ruggedness: 0.8, peaks: 6, platforms: 2, caves: 2, floors: 5 },
    playerCount: 3,
    enemyCount: 4,
    aiError: 0.12,
    wind: 0,
  },
];

// Build a fully resolved level descriptor for index i.
// spawns[0] = playerCount xs evenly spread in [60, FIELD.W*0.4]
// spawns[1] = enemyCount xs evenly spread in [FIELD.W*0.6, FIELD.W-60]
// Deterministic — no RNG.
export function buildLevel(i) {
  const lv = LEVELS[i];
  const { playerCount, enemyCount } = lv;

  const spread = (count, lo, hi) => {
    if (count === 1) return [Math.round((lo + hi) / 2)];
    const step = (hi - lo) / (count - 1);
    return Array.from({ length: count }, (_, k) => Math.round(lo + k * step));
  };

  const spawns = {
    0: spread(playerCount, 60, Math.round(FIELD.W * 0.4)),
    1: spread(enemyCount, Math.round(FIELD.W * 0.6), FIELD.W - 60),
  };

  return {
    index: i,
    name: lv.name,
    theme: lv.theme,
    palette: lv.palette,
    terrainParams: lv.terrainParams,
    playerCount,
    enemyCount,
    aiError: lv.aiError,
    wind: lv.wind,
    waterY: WATER.defaultY,
    spawns,
  };
}
