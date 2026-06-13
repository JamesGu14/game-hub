// tests/barracksArchtower.test.mjs — 营/塔/高台建塔生效 + plateau 防双计 + 死区
// 运行：node games/tower-defender/tests/barracksArchtower.test.mjs
import assert from 'node:assert';
import { tryBuild } from '../src/systems/economySystem.js';
import { effectiveStats, GENERALS, towerStats } from '../src/data/generals.js';
import { BAL } from '../src/data/balance.js';

// 合成关：一格 barracks/archtower/plateau，各配同坐标将位 + 一格平地将位
function synthLevel() {
  const cols = 12, rows = 8;
  const terrainAt = Array.from({ length: rows }, () => Array(cols).fill(null));
  terrainAt[2][3] = 'barracks'; terrainAt[2][5] = 'archtower'; terrainAt[2][7] = 'plateau';
  return { id: 9001, cols, rows, terrainAt };   // tryBuild 仅需 level.terrainAt（经 terrainBonuses 查表）
}
const lv = synthLevel();
const build = (x, y) => {                         // 手搭最小 state，避开 newGameState 的 waves 依赖
  const s = { gold: 999999, level: lv, towers: [], unlocked: null };
  assert.ok(tryBuild(s, { x, y }, 'huang'), `建塔 ${x},${y}`);
  return s.towers[0];
};
const b1 = towerStats(GENERALS.huang, 1);

// 本任务断言：plateau 射程恰 +0.5（绝非 +1.0，防迁移双计）+ 平地基础
assert.equal(effectiveStats(build(7, 2)).range, b1.range + BAL.PLATEAU_RANGE_BONUS, '高台 射程恰+0.5（防双计）');
const flat = build(1, 5);
assert.equal(effectiveStats(flat).dmg, b1.dmg, '平地 基础 dmg');
assert.equal(effectiveStats(flat).range, b1.range, '平地 基础射程');

// Task 4 后：tryBuild 写 dmgMult/intervalMult → 营加伤、塔加速
const camp = build(3, 2), tower = build(5, 2);
assert.ok(Math.abs(effectiveStats(camp).dmg - b1.dmg * BAL.BARRACKS_DMG_MULT) < 1e-9, '营 dmg+25%');
assert.equal(effectiveStats(camp).range, b1.range, '营 不改射程');
assert.ok(Math.abs(effectiveStats(tower).interval - b1.interval * BAL.ARCHTOWER_INTERVAL_MULT) < 1e-9, '塔 攻速+25%');
assert.equal(effectiveStats(tower).dmg, b1.dmg, '塔 不改攻击');

console.log('ok barracksArchtower');
