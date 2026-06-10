// tests/levels-winnable.test.mjs — 每关用「首次遭遇时的最优可用阵容」满将位升满(L5)→ headless 跑到 won
// 阵容 = unlockedGenerals({unlockedLevel: 关号}) 中选 6 人:五虎/诸葛优先(老门禁原序,对空+火+控覆盖),
// 不足 6 用新将按覆盖优先补位 —— 语义=玩家会上场的合理编队;第1章纯新6将、第2章赵张+新4将,前期硬门禁不放水(spec §8.2)。
// (不平均轮放全部已解锁将:后期 12 将平摊会让一半将位放天花板仅五虎 45-60% 的廉价将,玩家不会这么摆,门禁失真。)
// --sample:15 关快测(调参循环);无 flag = 全 50 关(提交门禁)。
// 运行:node games/tower-defender/tests/levels-winnable.test.mjs
import assert from 'node:assert';
import { newGameState } from '../src/core/gameState.js';
import { LEVELS } from '../src/data/levels.js';
import { step } from '../src/core/gameLoop.js';
import { tryBuild, tryUpgrade } from '../src/systems/economySystem.js';
import { BAL } from '../src/data/balance.js';
import { makeRng } from '../src/core/rng.js';
import { unlockedGenerals } from '../src/data/unlocks.js';

const PREMIUM_PRIORITY = ['huang', 'zhuge', 'guan', 'zhao', 'ma', 'zhang'];      // 老门禁原序(对空+火+控)
const CHEAP_PRIORITY = ['liao', 'yueying', 'guanping', 'zhangbao', 'zhou', 'madai']; // 对空/火/控优先补位

function loadoutFor(levelId) {
  const un = unlockedGenerals({ unlockedLevel: levelId });
  return [...PREMIUM_PRIORITY.filter((id) => un.has(id)), ...CHEAP_PRIORITY.filter((id) => un.has(id))].slice(0, 6);
}

const SAMPLE = process.argv.includes('--sample');
const SAMPLE_IDS = new Set([1, 5, 10, 11, 15, 20, 21, 25, 30, 31, 35, 40, 41, 45, 50]);

for (let i = 0; i < LEVELS.length; i++) {
  if (SAMPLE && !SAMPLE_IDS.has(LEVELS[i].id)) continue;
  const roster = loadoutFor(LEVELS[i].id);
  const s = newGameState(LEVELS[i]);
  s.rng = makeRng(LEVELS[i].id);
  s.gold = 99999999;
  s.level.slots.forEach((sl, k) => {
    if (tryBuild(s, sl, roster[k % roster.length])) {
      const t = s.towers[s.towers.length - 1];
      while (tryUpgrade(s, t)) { /* 升满 */ }
    }
  });
  assert.ok(s.towers.length > 0 && s.towers.every((t) => t.level === BAL.MAX_TOWER_LEVEL), `L${LEVELS[i].id} 满防升至 L${BAL.MAX_TOWER_LEVEL}`);
  const guard = Math.max(400000, s.level.waves.length * 20000);
  let g = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && g < guard) {
    if (s.phase === 'prep') s.earlyRequested = true;
    step(s, 1 / 60);
    g++;
  }
  assert.equal(s.phase, 'won', `L${LEVELS[i].id} 阵容[${roster.join(',')}]满防应可通关(实际 ${s.phase}, castleHp ${s.castleHp})`);
}

console.log('ok levels-winnable');
