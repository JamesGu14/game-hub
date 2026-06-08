// data/waveGen.js — 纯函数·确定性波次生成器（检查点A·§8）。
// genWaves(template, params, seed) → waves[]（与手写 levels.js 完全同形）。
// 铁律：seed 为 required 有限数；缺失即 throw（堵 rng.js 的 Date/Math.random fallback，加载期零随机外泄）。
// template：{ camps:[{id}], paths:{id:[...]} }（已是 pathSubset 后的子集）。campId === pathId。
// params：{ waveCount, difficulty, enemyTiers, boss:{id,name,hpMult,bossSkills?} }。
import { makeRng } from '../core/rng.js';

const lerp = (a, b, t) => a + (b - a) * t;

// Fisher-Yates（注入 rng，确定性）
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const tmp = a[i]; a[i] = a[j]; a[j] = tmp; }
  return a;
}

export function genWaves(template, params, seed) {
  if (typeof seed !== 'number' || !Number.isFinite(seed)) {
    throw new Error('genWaves: seed 必须为有限数（确定性铁律）');
  }
  const { waveCount, difficulty, enemyTiers, boss, lieutenants = [] } = params;
  const rng = makeRng(seed);
  const lanes = template.camps.map((c) => c.id);          // campId===pathId
  const tiers = enemyTiers.filter((t) => t !== 'boss');    // 可用兵种池（不含 boss）
  const waves = [];

  for (let i = 0; i < waveCount; i++) {
    const last = i === waveCount - 1;
    const intensity = waveCount > 1 ? i / (waveCount - 1) : 0;   // 0→1
    const diffK = 1 + difficulty * 0.20;                        // 章内难度抬升（检查点A 实玩调；L50 winnable 留余量）

    // 同步开火路数：前松（1）→后紧（≤min(lanes,3)）
    const maxLanes = Math.min(lanes.length, 3);
    const laneCount = Math.max(1, Math.round(lerp(1, maxLanes, intensity)));
    const chosenLanes = shuffle(lanes, rng).slice(0, laneCount);

    // 解锁兵种：前松（仅 tiers[0]）→后紧（全 tiers），随 intensity 渐增（教学曲线）
    const unlocked = Math.max(1, Math.min(tiers.length, 1 + Math.floor(intensity * tiers.length)));
    const pool = tiers.slice(0, unlocked);

    // 每路数量：前松（~5）→后紧（~26）× 难度；二次方后置曲线 rampT → 越靠后 wave 增兵越猛（检查点A 实玩反馈）
    const rampT = intensity * intensity;
    const baseCount = Math.round(lerp(5, 26, rampT) * diffK);
    const spawnInterval = +lerp(1.2, 0.5, intensity).toFixed(2);

    const spawns = chosenLanes.map((lane, k) => {
      let type = intensity < 0.18 ? 'footman' : pool[Math.floor(rng() * pool.length)];
      if (last && type === 'flyer') type = 'footman';          // 末波无飞兵
      let count = Math.max(2, baseCount + (Math.floor(rng() * 3) - 1));   // ±1 抖动
      if (last) count = Math.max(2, Math.round(count * 0.5));             // boss 波减量聚焦主将（防满级塔被淹 + 终 boss 震慑叠加打崩）
      return { campId: lane, pathId: lane, enemyType: type, count, spawnInterval, leadDelay: k };
    });

    // 末波：主将压轴；副将落末波前 lieutenants.length 波（越靠后 wave 将领越多 → 收尾成名将关）。
    if (last) {
      spawns.push({ campId: chosenLanes[0], pathId: chosenLanes[0], enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 6, ...boss });
    } else {
      const ltIdx = i - (waveCount - 1 - lieutenants.length);   // 末波前 N 波，每波 1 副将
      if (ltIdx >= 0 && ltIdx < lieutenants.length) {
        spawns.push({ campId: chosenLanes[0], pathId: chosenLanes[0], enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 6, ...lieutenants[ltIdx] });
      }
    }

    waves.push({ waveId: i + 1, startDelay: i === 0 ? 0 : Math.round(lerp(6, 9, intensity)), spawns });
  }
  return waves;
}
