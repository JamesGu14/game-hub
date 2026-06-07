// 15-level campaign data for 炮炮虫 BOOM WORMS. Pure data — importable by node:test.
import { FIELD, WATER } from './config.js';

export const LEVELS = [
  // 1 · 绿草训练场 — 入门 · 平缓教学
  {
    name: '绿草训练场', theme: 'grass',
    palette: { sky: '#87ceeb', land: '#5a8a3c', land2: '#3d6b24', water: '#1a6db5' },
    terrainParams: { ruggedness: 0.28, peaks: 3, platforms: 1, caves: 0, floors: 0 },
    playerCount: 3, enemyCount: 2, aiError: 0.90, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 2 · 糖果乐园 — 入门 · 平台
  {
    name: '糖果乐园', theme: 'candy',
    palette: { sky: '#ffb3d9', land: '#ff69b4', land2: '#c2185b', water: '#80deea' },
    terrainParams: { ruggedness: 0.42, peaks: 4, platforms: 2, caves: 0, floors: 0 },
    playerCount: 3, enemyCount: 3, aiError: 0.80, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 3 · 阳光海滩 — 简单 · 缓坡 + 水
  {
    name: '阳光海滩', theme: 'beach',
    palette: { sky: '#87ceeb', land: '#e8c97a', land2: '#c9a84c', water: '#1a8fc7' },
    terrainParams: { ruggedness: 0.38, peaks: 3, platforms: 1, caves: 0, floors: 0 },
    playerCount: 3, enemyCount: 3, aiError: 0.70, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 4 · 神秘丛林 — 简单 · 洞穴 + 楼层   (M3: objective→timed)
  {
    name: '神秘丛林', theme: 'jungle',
    palette: { sky: '#2d5a27', land: '#1a7a1a', land2: '#0f5c0f', water: '#1a5c3a' },
    terrainParams: { ruggedness: 0.55, peaks: 5, platforms: 3, caves: 2, floors: 3 },
    playerCount: 3, enemyCount: 3, aiError: 0.62, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 5 · 溶洞深渊 — 进阶 · 尖刺首秀   (M2: hazards.spikes)
  {
    name: '溶洞深渊', theme: 'cave',
    palette: { sky: '#241d33', land: '#6b5a7a', land2: '#46384f', water: '#16263a' },
    terrainParams: { ruggedness: 0.52, peaks: 4, platforms: 2, caves: 3, floors: 2 },
    playerCount: 3, enemyCount: 3, aiError: 0.55, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 6 · 火山熔岩 — 进阶 · 熔岩池   (M2: hazards.lava, M3: objective→decapitate)
  {
    name: '火山熔岩', theme: 'volcano',
    palette: { sky: '#3a1410', land: '#6e3b2a', land2: '#4a2418', water: '#2a0a06' },
    terrainParams: { ruggedness: 0.62, peaks: 5, platforms: 2, caves: 1, floors: 2 },
    playerCount: 3, enemyCount: 3, aiError: 0.48, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 7 · 云端天空 — 进阶 · 多浮空平台   (M3: objective→capture)
  {
    name: '云端天空', theme: 'sky',
    palette: { sky: '#b3d9ff', land: '#ffffff', land2: '#d0e8ff', water: '#4a90d9' },
    terrainParams: { ruggedness: 0.48, peaks: 4, platforms: 4, caves: 0, floors: 4 },
    playerCount: 3, enemyCount: 3, aiError: 0.42, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 8 · 冰雪世界 — 困难 · 冰面打滑   (M2: hazards.ice)
  {
    name: '冰雪世界', theme: 'ice',
    palette: { sky: '#cfe8f5', land: '#bfe0ec', land2: '#8fc0d8', water: '#3a7aa0' },
    terrainParams: { ruggedness: 0.45, peaks: 4, platforms: 3, caves: 0, floors: 3 },
    playerCount: 3, enemyCount: 4, aiError: 0.37, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 9 · 沙漠绿洲 — 困难 · 沙丘起伏
  {
    name: '沙漠绿洲', theme: 'desert',
    palette: { sky: '#f0d9a8', land: '#d8a85a', land2: '#b0824a', water: '#2a9ec0' },
    terrainParams: { ruggedness: 0.50, peaks: 5, platforms: 2, caves: 0, floors: 2 },
    playerCount: 3, enemyCount: 4, aiError: 0.32, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 10 · 毒沼泽 — 困难 · 酸水 + 楼层   (M2: hazards.acid)
  {
    name: '毒沼泽', theme: 'swamp',
    palette: { sky: '#34402f', land: '#5a7a3c', land2: '#3a5424', water: '#5f7a1f' },
    terrainParams: { ruggedness: 0.42, peaks: 4, platforms: 2, caves: 1, floors: 4 },
    playerCount: 3, enemyCount: 4, aiError: 0.28, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 11 · 机关工厂 — 精英 · 弹床 + 迷宫   (M2: hazards.bounce, M3: objective→capture)
  {
    name: '机关工厂', theme: 'factory',
    palette: { sky: '#33333f', land: '#7a7a8a', land2: '#55555f', water: '#23303f' },
    terrainParams: { ruggedness: 0.50, peaks: 4, platforms: 4, caves: 1, floors: 4 },
    playerCount: 3, enemyCount: 4, aiError: 0.24, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 12 · 黄昏废墟 — 精英 · 尖刺 + 熔岩   (M2: hazards.spikes+lava, M3: objective→decapitate)
  {
    name: '黄昏废墟', theme: 'ruins',
    palette: { sky: '#5a3a32', land: '#8a6a4a', land2: '#5e4632', water: '#352636' },
    terrainParams: { ruggedness: 0.60, peaks: 5, platforms: 3, caves: 2, floors: 3 },
    playerCount: 3, enemyCount: 4, aiError: 0.20, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 13 · 暗夜墓园 — 精英 · 冰面 + 洞穴   (M2: hazards.ice, M3: objective→timed)
  {
    name: '暗夜墓园', theme: 'night',
    palette: { sky: '#16163a', land: '#46466a', land2: '#2a2a4a', water: '#141426' },
    terrainParams: { ruggedness: 0.55, peaks: 5, platforms: 2, caves: 3, floors: 2 },
    playerCount: 3, enemyCount: 5, aiError: 0.16, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 14 · 彩虹山 — 地狱 · 崎岖 + 楼层
  {
    name: '彩虹山', theme: 'rainbow',
    palette: { sky: '#1a0533', land: '#9b59b6', land2: '#6c3483', water: '#1a0a2e' },
    terrainParams: { ruggedness: 0.80, peaks: 6, platforms: 2, caves: 2, floors: 5 },
    playerCount: 3, enemyCount: 5, aiError: 0.12, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
  },
  // 15 · 终焉决战 — 地狱 · 熔岩 + 弹床   (M2: hazards.lava+bounce, M3: objective→decapitate)
  {
    name: '终焉决战', theme: 'finale',
    palette: { sky: '#2a0a1a', land: '#7a2a3a', land2: '#561a28', water: '#16060f' },
    terrainParams: { ruggedness: 0.78, peaks: 6, platforms: 3, caves: 2, floors: 5 },
    playerCount: 3, enemyCount: 5, aiError: 0.08, wind: 0,
    objective: { type: 'eliminate' }, hazards: {},
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
    objective: lv.objective ?? { type: 'eliminate' },  // forwarded for M3 checkOutcome
    hazards: lv.hazards ?? {},                          // forwarded for M2 terrain/physics
  };
}
