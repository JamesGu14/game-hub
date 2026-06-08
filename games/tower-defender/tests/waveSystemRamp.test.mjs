// tests/waveSystemRamp.test.mjs — startWave 每波算 ramp 存 spawn；出兵透传 → 末波敌兵更肉
// 运行：node games/tower-defender/tests/waveSystemRamp.test.mjs
import assert from 'node:assert';
import { waveSystem } from '../src/systems/waveSystem.js';

const path = [{ x: 0, y: 0 }, { x: 5, y: 0 }];
function mkLevel() {
  const spawn = { campId: 'a', pathId: 'a', enemyType: 'footman', count: 1, spawnInterval: 1, leadDelay: 0 };
  return {
    faction: 'wei', scale: 1, paths: { a: path },
    waves: [
      { waveId: 1, startDelay: 0, spawns: [{ ...spawn }] },
      { waveId: 2, startDelay: 0, spawns: [{ ...spawn }] },
    ],
  };
}
function mkState(waveIndex) {
  return {
    phase: 'prep', prepTimer: 0, earlyRequested: false, waveIndex,
    level: mkLevel(), enemies: [], activeSpawns: [], gold: 0, time: 0, campsFallen: {},
  };
}

// 首波(index0,t=0)：spawn rampHp=1，敌兵 hp=60
{
  const s = mkState(0);
  waveSystem(s, 1 / 60);                 // prep→startWave(combat)
  assert.ok(Math.abs(s.activeSpawns[0].rampHp - 1) < 1e-9, '首波 spawn rampHp=1');
  waveSystem(s, 1);                      // 推进出兵
  assert.equal(s.enemies[0].hp, 60, '首波步卒 60');
  assert.equal(s.enemies[0].dmgTakenMult, 1, '首波无减伤');
}

// 末波(index1,t=1)：spawn rampHp=2、dmgTakenMult=0.85，敌兵 hp=120
{
  const s = mkState(1);
  waveSystem(s, 1 / 60);
  assert.ok(Math.abs(s.activeSpawns[0].rampHp - 2) < 1e-9, '末波 spawn rampHp=2');
  assert.ok(Math.abs(s.activeSpawns[0].dmgTakenMult - 0.85) < 1e-9, '末波 spawn dmgTakenMult=0.85');
  waveSystem(s, 1);
  assert.equal(s.enemies[0].hp, 120, '末波步卒 120');
  assert.ok(Math.abs(s.enemies[0].dmgTakenMult - 0.85) < 1e-9, '末波敌兵带 dmgTakenMult');
}

console.log('ok waveSystemRamp');
