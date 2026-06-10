// tests/terrainSystem.test.mjs — 浅滩减速/火谷envBurn/落石计时 的确定性(板型+地形 spec §4)
// 运行:node games/tower-defender/tests/terrainSystem.test.mjs
import assert from 'node:assert';
import { BAL } from '../src/data/balance.js';
import { terrainSystem, initTerrainState } from '../src/systems/terrainSystem.js';
import { expandTerrain } from '../src/data/boardVariants.js';
import { createEnemy } from '../src/entities/enemy.js';
import { effectiveSpeed } from '../src/systems/combat/statusEffects.js';

// 合成关:一条直路 y=5,x=0..12;地形按用例注入
const PATH = [{ x: 0, y: 5 }, { x: 12, y: 5 }];
function makeLevel(terrain) {
  const b = { id: 'fixT', cols: 24, rows: 14, terrain };
  const ex = expandTerrain(b);
  return { id: 901, scale: 1, cols: 24, rows: 14, paths: { a: PATH }, terrain: ex.terrain, terrainAt: ex.terrainAt };
}
function makeState(level, enemies) {
  return { phase: 'combat', time: 0, level, enemies, gold: 0, terrain: initTerrainState(level) };
}

// —— shallow:区内每帧维持减速(×0.7),出区 0.2s 后自然衰退;飞兵豁免;取最强不叠加 ——
{
  const lv = makeLevel([{ type: 'shallow', cells: [{ x: 4, y: 5 }, { x: 5, y: 5 }] }]);
  const e = createEnemy('footman', 'a', PATH, 1);
  e.gx = 4.3; e.gy = 5;                       // 格 (4,5) 内
  const s = makeState(lv, [e]);
  terrainSystem(s);
  assert.ok(Math.abs(effectiveSpeed(e, s.time) - e.speed * (1 - BAL.SHALLOW_SLOW_PCT)) < 1e-9, '区内 ×0.7');
  // 与塔减速取最强不叠加:已有更强减速(0.4)时维持 0.4
  e.statuses.slow = { pct: 0.4, until: 10 };
  terrainSystem(s);
  assert.equal(e.statuses.slow.pct, 0.4, '取最强不叠加');
  // 出区:SHALLOW_SLOW_DUR+0.05 后减速过期
  const e2 = createEnemy('footman', 'a', PATH, 1); e2.gx = 4.3; e2.gy = 5;
  const s2 = makeState(lv, [e2]);
  terrainSystem(s2);
  e2.gx = 8; s2.time += BAL.SHALLOW_SLOW_DUR + 0.05;
  terrainSystem(s2);                          // 出区后 tick 不再刷新
  assert.equal(effectiveSpeed(e2, s2.time), e2.speed, '出区自然衰退');
  // 飞兵不受浅滩影响
  const f = createEnemy('flyer', 'a', PATH, 1); f.gx = 4.3; f.gy = 5;
  const s3 = makeState(lv, [f]);
  terrainSystem(s3);
  assert.equal(effectiveSpeed(f, s3.time), f.speed, '飞兵豁免');
  // 非 combat 相位不施加(prep 备战中浅滩不工作于敌——本就无敌,语义守卫)
  const e3 = createEnemy('footman', 'a', PATH, 1); e3.gx = 4.3; e3.gy = 5;
  const s4 = makeState(lv, [e3]); s4.phase = 'prep';
  terrainSystem(s4);
  assert.equal(effectiveSpeed(e3, s4.time), e3.speed, 'prep 不施加');
}
// initTerrainState:disabled 集与 rockfall 计时骨架
{
  const lv = makeLevel([{ type: 'rockfall', cells: [{ x: 4, y: 5 }] }, { type: 'shallow', cells: [{ x: 6, y: 5 }] }]);
  const ts = initTerrainState(lv);
  assert.equal(ts.rockfalls.length, 1, 'rockfall 区建计时器');
  assert.equal(ts.rockfalls[0].zoneIdx, 0, 'zoneIdx 指向 level.terrain 下标');
  assert.equal(ts.rockfalls[0].nextStrikeAt, BAL.ROCKFALL_PERIOD, '首次落石=PERIOD');
  assert.ok(ts.disabled instanceof Set && ts.disabled.size === 0, 'disabled 空集');
  const lv2 = makeLevel([{ type: 'rockfall', cells: [{ x: 4, y: 5 }] }]);
  lv2.disableTerrain = ['rockfall'];
  assert.equal(initTerrainState(lv2).rockfalls.length, 0, '禁用类型不建计时器');
}
console.log('ok terrainSystem');
