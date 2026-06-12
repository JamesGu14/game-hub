// tests/gameState.test.mjs — [0×/实测④] 战术冻结状态机:toggleFreeze/cycleSpeed 契约 + 冻结期建/升/拆照常
// 运行:node games/tower-defender/tests/gameState.test.mjs
import assert from 'node:assert';
import { newGameState, toggleFreeze, cycleSpeed } from '../src/core/gameState.js';
import { advance } from '../src/core/gameLoop.js';
import { tryBuild, tryUpgrade, sellTower } from '../src/systems/economySystem.js';

const level = { startGold: 500, castleHp: 10, waves: [], paths: {}, slots: [{ x: 1, y: 1 }] };

// toggleFreeze:1→0(记 speedPrev)→1;2→0→2(解冻恢复冻结前速度)
{
  const s = newGameState(level);
  assert.equal(s.speed, 1, '初始 1×'); assert.equal(s.speedPrev, 1, '初始 speedPrev=1');
  assert.equal(toggleFreeze(s), 0, '冻结'); assert.equal(s.speedPrev, 1, '记下冻结前速度');
  assert.equal(toggleFreeze(s), 1, '解冻恢复 1×');
  s.speed = 2;
  assert.equal(toggleFreeze(s), 0, '2× 下冻结'); assert.equal(s.speedPrev, 2);
  assert.equal(toggleFreeze(s), 2, '解冻恢复 2×');
}

// cycleSpeed:平时 1↔2 循环;冻结时=以所示速度(speedPrev)解冻,不再循环
{
  const s = newGameState(level);
  assert.equal(cycleSpeed(s), 2, '1→2');
  assert.equal(cycleSpeed(s), 1, '2→1');
  s.speed = 2; toggleFreeze(s);
  assert.equal(cycleSpeed(s), 2, '冻结时点速度钮=以 speedPrev 解冻');
}

// 冻结=模拟停摆:advance 巨帧也零步、_acc 残量冻结不消耗
{
  const s = newGameState(level); s._acc = 0;
  toggleFreeze(s);
  let n = 0;
  assert.equal(advance(s, 5, () => n++), 0, '0× → 零步');
  assert.equal(n, 0, 'step 未被调用');
  assert.equal(s._acc, 0, '_acc 不积累');
}

// 冻结期间建/升/拆照常(economySystem 直改 state、不依赖 step——0× 的核心承诺)
{
  const s = newGameState(level);
  toggleFreeze(s);
  assert.ok(tryBuild(s, level.slots[0], 'liao'), '0× 可建造');
  const t = s.towers[0];
  assert.ok(tryUpgrade(s, t), '0× 可升级');
  assert.ok(sellTower(s, t) > 0, '0× 可拆除并返金');
  assert.equal(s.towers.length, 0, '拆除生效');
}

console.log('ok gameState');
