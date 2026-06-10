// data/levels.js — 运行时确定性展开（检查点A·§5.1）。
// CAMPAIGN（50 关谱）× baseBoards/boardVariants（板型+地形）× waveGen（确定性波次）→ LEVELS。
// 对外仍 export const LEVELS（与现手写关完全同形）；下游（渲染/存档/verify/winnable）零感知。
// 铁律：加载期无 Math.random/Date — waveGen seed=level.id（有限数），genWaves 强制确定性。
import { CAMPAIGN } from './campaign.js';
import { BASE_BOARDS } from './baseBoards.js';
import { variantFor, resolveBoard } from './boardVariants.js';
import { genWaves } from './waveGen.js';
import { BOSSES, LIEUTENANTS } from './bosses.js';
import { CITY_POOLS } from './cities.js';

// 城名切片起点：章内累计 camp 数（spec §5.2）。确定性，加载期无随机。
const CITY_AT = (() => {
  const next = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, at = {};
  for (const c of CAMPAIGN) {
    const tmpl = BASE_BOARDS[c.templateId];
    const n = (c.pathSubset && c.pathSubset.length) || Object.keys(tmpl.paths).length;
    at[c.id] = next[c.chapter];
    next[c.chapter] += n;
  }
  return at;
})();

// difficulty → 关参数（§5.1 公式；起点，balance-report 可调）
export function difficultyParams(difficulty) {
  return {
    scale: +(1 + difficulty * 0.5).toFixed(3),
    startGold: Math.round(300 + difficulty * 150),
    castleHp: 20,
  };
}

function expand(c) {
  const k = (c.id - 1) % 10;
  // [板型+地形] 公式与 campaign 双源一致性（加载期断言,防漂移）
  const v = variantFor(c.chapter, k);
  if (v.boardId !== c.templateId) throw new Error(`levels: L${c.id} variantFor=${v.boardId} ≠ templateId=${c.templateId}`);
  const board = resolveBoard(c.chapter, k);
  const subsetIds = board.camps.map((cp) => cp.id);
  const declared = c.pathSubset && c.pathSubset.length ? [...c.pathSubset].sort() : Object.keys(BASE_BOARDS[c.templateId].paths).sort();
  if (JSON.stringify([...subsetIds].sort()) !== JSON.stringify(declared)) {
    throw new Error(`levels: L${c.id} 子集不一致 board=[${subsetIds}] campaign=[${declared}]`);
  }
  const cityNames = CITY_POOLS[c.chapter].slice(CITY_AT[c.id], CITY_AT[c.id] + board.camps.length);
  const camps = board.camps.map((cp, i) => ({ ...cp, cityName: cityNames[i] }));
  // 动态地形过滤已在 resolveBoard 完成(0.25 步插值,与 verify ③ 同源)。
  // boss：bosses.js 提供 name/hpMult/bossSkills；campaign 可覆盖 name/hpMult
  const baseBoss = BOSSES[c.boss.id];
  if (!baseBoss) throw new Error(`levels: 未知 boss.id '${c.boss.id}' (L${c.id})`);
  const boss = { ...baseBoss, ...c.boss };
  // 副将（冷门小 BOSS，随末段波出场）：从 LIEUTENANTS（退而 BOSSES）解析为 {id,name,hpMult}
  const lieutenants = (c.lieutenants || []).map((id) => {
    const g = LIEUTENANTS[id] || BOSSES[id];
    if (!g) throw new Error(`levels: 未知 lieutenant '${id}' (L${c.id})`);
    return { ...g };
  });
  const { scale, startGold, castleHp } = difficultyParams(c.difficulty);
  const waves = genWaves(
    { camps, paths: board.paths },
    { waveCount: c.waveCount, difficulty: c.difficulty, enemyTiers: c.enemyTiers, boss, lieutenants },
    c.id,                                   // seed = level.id（确定性）
  );
  return {
    id: c.id, name: c.name, chapter: c.chapter, faction: c.faction,
    scale, startGold, castleHp,
    rampMax: c.rampMax,                       // 可选：覆盖 wave HP ramp 上限（缺省 → BAL.WAVE_HP_RAMP_MAX）
    cols: board.cols, rows: board.rows, castle: board.castle,
    camps, paths: board.paths, slots: board.slots, waves,
    terrain: board.terrain, terrainAt: board.terrainAt,             // [板型+地形] 展开产物(resolveBoard 已过滤孤立区)
    ...(c.disableTerrain ? { disableTerrain: c.disableTerrain } : {}),   // [段2预留] L50 大雨彩蛋透传(terrainSystem 落地前不触发)
    // [演绎段1] 剧情数据透传:story(样板关含 narration/script)+ 已解析 boss/lieutenants(带 name)
    // + waveCount/difficulty(storylines 兵力万数派生)。修复:此前 story 未透传,故事屏小档案画空。
    story: c.story, boss, lieutenants,
    waveCount: c.waveCount, difficulty: c.difficulty,
  };
}

export const LEVELS = CAMPAIGN.map(expand);
