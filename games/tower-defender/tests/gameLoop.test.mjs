// tests/gameLoop.test.mjs — [P0-1] 累加器封顶 / 速度倍率 / [P0-3] 相位守卫 / prep→combat
// 运行：node games/tower-defender/tests/gameLoop.test.mjs
import assert from 'node:assert';
import { BAL } from '../src/data/balance.js';
import { step, advance } from '../src/core/gameLoop.js';
import { createEnemy } from '../src/entities/enemy.js';

// [P0-1] 巨帧 → 步数封顶 MAX_STEPS（防螺旋死亡）
{
  let n = 0;
  const st = { speed: 1, _acc: 0 };
  const ran = advance(st, 10, () => n++);
  assert.equal(ran, BAL.MAX_STEPS, '封顶 3 步');
  assert.equal(n, BAL.MAX_STEPS);
}

// 速度 2× → 一个 FIXED 帧推进 2 步
{
  let n = 0;
  const st = { speed: 2, _acc: 0 };
  assert.equal(advance(st, BAL.FIXED_DT, () => n++), 2, '2x → 2 步');
}

// [P0-3] lost 时 step 不推进敌
{
  const path = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
  const e = createEnemy('footman', 'p', path, 1);
  const s = { phase: 'lost', time: 0, enemies: [e], fx: [], projectiles: [], towers: [], level: { paths: { p: path } } };
  step(s, 1);
  assert.equal(e.seg, 0); assert.equal(e.t, 0, 'lost 不推进');
}

// prep 倒计时归零 → combat
{
  const s = {
    phase: 'prep', time: 0, prepTimer: 0.5, earlyRequested: false, waveIndex: 0, gold: 0,
    activeSpawns: [], enemies: [], fx: [], projectiles: [], towers: [], campsFallen: {}, allWavesEmitted: false,
    level: { scale: 1, paths: { a: [{ x: 0, y: 0 }, { x: 1, y: 0 }] }, waves: [{ spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 1, spawnInterval: 1, leadDelay: 0 }] }] },
  };
  step(s, 1);
  assert.equal(s.phase, 'combat', 'prep 倒计时归零 → combat');
}

console.log('ok gameLoop');
