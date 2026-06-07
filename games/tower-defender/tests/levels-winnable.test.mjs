// tests/levels-winnable.test.mjs — 每关满将位 L3 防御 → headless 跑到 won(理论可达性,§成功指标)
// 运行：node games/tower-defender/tests/levels-winnable.test.mjs
import assert from 'node:assert';
import { newGameState } from '../src/core/gameState.js';
import { LEVELS } from '../src/data/levels.js';
import { step } from '../src/core/gameLoop.js';
import { tryBuild, tryUpgrade } from '../src/systems/economySystem.js';

const defenders = ['huang', 'zhuge', 'guan', 'zhao', 'ma', 'zhang'];   // 含诸葛(火克藤甲)+防空将

for (let i = 0; i < LEVELS.length; i++) {
  const s = newGameState(LEVELS[i]);
  s.gold = 999999;
  s.level.slots.forEach((sl, k) => {
    if (tryBuild(s, sl, defenders[k % 6])) { const t = s.towers[s.towers.length - 1]; tryUpgrade(s, t); tryUpgrade(s, t); }
  });
  let guard = 0;
  while (s.phase !== 'won' && s.phase !== 'lost' && guard < 400000) {
    if (s.phase === 'prep') s.earlyRequested = true;
    step(s, 1 / 60);
    guard++;
  }
  assert.equal(s.phase, 'won', `L${i + 1} 满防应可通关(实际 ${s.phase}, castleHp ${s.castleHp})`);
}

console.log('ok levels-winnable');
