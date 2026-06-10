// tests/economy.test.mjs — 建造扣金 / 钱不够 / 将位已占 / 提前出兵奖励封顶
// 运行：node games/tower-defender/tests/economy.test.mjs
import assert from 'node:assert';
import { canBuild, tryBuild } from '../src/systems/economySystem.js';
import { waveSystem } from '../src/systems/waveSystem.js';
import { newGameState } from '../src/core/gameState.js';

const LV = { startGold: 200, castleHp: 20, scale: 1, paths: {}, waves: [{ spawns: [] }] };

// 够钱建塔 → 扣金、塔 +1
{
  const s = { gold: 100, towers: [] };
  assert.equal(canBuild(s, 'huang'), true);
  assert.equal(tryBuild(s, { x: 1, y: 1 }, 'huang'), true);
  assert.equal(s.gold, 10, '扣 90');
  assert.equal(s.towers.length, 1);
  // 将位已占 → 失败
  s.gold = 100;
  assert.equal(tryBuild(s, { x: 1, y: 1 }, 'huang'), false, '将位已占');
  assert.equal(s.gold, 100, '失败不扣金');
}

// 钱不够 → 失败、不变
{
  const s = { gold: 10, towers: [] };
  assert.equal(tryBuild(s, { x: 0, y: 0 }, 'huang'), false);
  assert.equal(s.gold, 10);
  assert.equal(s.towers.length, 0);
}

// 提前出兵奖励封顶 30
{
  const s = {
    phase: 'prep', prepTimer: 30, earlyRequested: true, gold: 0, waveIndex: 0,
    activeSpawns: [], enemies: [], campsFallen: {},
    level: { scale: 1, paths: {}, waves: [{ spawns: [] }] },
  };
  waveSystem(s, 0);
  assert.equal(s.phase, 'combat', '提前出兵 → combat');
  assert.equal(s.gold, 30, '剩 30s ×2=60 → 封顶 30');
}

// —— [spec §3] 解锁门禁:state.unlocked 存在时,未解锁将不可建;缺省(null)=全解锁(存量测试零破坏)——
{
  const s = newGameState(LV, { unlocked: new Set(['liao']) });
  s.gold = 9999;
  assert.equal(canBuild(s, 'liao'), true, '已解锁可建');
  assert.equal(canBuild(s, 'zhao'), false, '未解锁不可建(金够也不行)');
  assert.equal(tryBuild(s, { x: 1, y: 1 }, 'zhao'), false, 'tryBuild 同样拦截');
  const s2 = newGameState(LV);
  s2.gold = 9999;
  assert.equal(canBuild(s2, 'zhao'), true, '缺省全解锁');
}

console.log('ok economy');
