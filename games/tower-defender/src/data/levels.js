// data/levels.js — 运行时确定性展开（检查点A·§5.1）。
// CAMPAIGN（50 关谱）× boardTemplates（板型）× waveGen（确定性波次）→ LEVELS。
// 对外仍 export const LEVELS（与现手写关完全同形）；下游（渲染/存档/verify/winnable）零感知。
// 铁律：加载期无 Math.random/Date — waveGen seed=level.id（有限数），genWaves 强制确定性。
import { CAMPAIGN } from './campaign.js';
import { TEMPLATES } from './boardTemplates.js';
import { genWaves } from './waveGen.js';
import { BOSSES, LIEUTENANTS } from './bosses.js';
import { CITY_POOLS } from './cities.js';

// 城名切片起点：章内累计 camp 数（spec §5.2）。确定性，加载期无随机。
const CITY_AT = (() => {
  const next = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, at = {};
  for (const c of CAMPAIGN) {
    const tmpl = TEMPLATES[c.templateId];
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
  const tmpl = TEMPLATES[c.templateId];
  if (!tmpl) throw new Error(`levels: 未知 templateId '${c.templateId}' (L${c.id})`);
  const subset = (c.pathSubset && c.pathSubset.length) ? c.pathSubset : Object.keys(tmpl.paths);
  const paths = {}; for (const id of subset) paths[id] = tmpl.paths[id];
  const cityNames = CITY_POOLS[c.chapter].slice(CITY_AT[c.id], CITY_AT[c.id] + subset.length);
  const camps = tmpl.camps.filter((cp) => subset.includes(cp.id)).map((cp, i) => ({ ...cp, cityName: cityNames[i] }));
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
    { ...tmpl, camps, paths },
    { waveCount: c.waveCount, difficulty: c.difficulty, enemyTiers: c.enemyTiers, boss, lieutenants },
    c.id,                                   // seed = level.id（确定性）
  );
  return {
    id: c.id, name: c.name, chapter: c.chapter, faction: c.faction,
    scale, startGold, castleHp,
    rampMax: c.rampMax,                       // 可选：覆盖 wave HP ramp 上限（缺省 → BAL.WAVE_HP_RAMP_MAX）
    cols: tmpl.cols, rows: tmpl.rows, castle: tmpl.castle,
    camps, paths, slots: tmpl.slots, waves,
  };
}

export const LEVELS = CAMPAIGN.map(expand);
