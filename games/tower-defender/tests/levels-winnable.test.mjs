// tests/levels-winnable.test.mjs — 每关满将位 升满(MAX=L5)防御 → headless 跑到 won(理论可达性,§成功指标)
// --sample：每章首/中/末 15 关快测(调参循环用)；无 flag = 全 50 关(提交门禁/test.sh)。
// 运行：node games/tower-defender/tests/levels-winnable.test.mjs
import assert from 'node:assert';
import { newGameState } from '../src/core/gameState.js';
import { LEVELS } from '../src/data/levels.js';
import { step } from '../src/core/gameLoop.js';
import { tryBuild, tryUpgrade } from '../src/systems/economySystem.js';
import { BAL } from '../src/data/balance.js';

const defenders = ['huang', 'zhuge', 'guan', 'zhao', 'ma', 'zhang'];   // 含诸葛(火克藤甲)+防空将

const SAMPLE = process.argv.includes('--sample');
const SAMPLE_IDS = new Set([1, 5, 10, 11, 15, 20, 21, 25, 30, 31, 35, 40, 41, 45, 50]);

for (let i = 0; i < LEVELS.length; i++) {
  if (SAMPLE && !SAMPLE_IDS.has(LEVELS[i].id)) continue;
  const s = newGameState(LEVELS[i]);
  s.gold = 99999999;
  s.level.slots.forEach((sl, k) => {
    if (tryBuild(s, sl, defenders[k % 6])) {
      const t = s.towers[s.towers.length - 1];
      while (tryUpgrade(s, t)) { /* 升满到 MAX_TOWER_LEVEL */ }
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
  assert.equal(s.phase, 'won', `L${LEVELS[i].id} 满防应可通关(实际 ${s.phase}, castleHp ${s.castleHp})`);
}

console.log('ok levels-winnable');
