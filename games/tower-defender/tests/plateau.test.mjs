// tests/plateau.test.mjs — 高台:建塔得 rangeBonus / 平地无 / 射程链生效 / 助手防御性
// 运行:node games/tower-defender/tests/plateau.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { newGameState } from '../src/core/gameState.js';
import { tryBuild } from '../src/systems/economySystem.js';
import { rangeBonusFor, terrainTypeAt } from '../src/systems/terrainSystem.js';
import { targetingSystem } from '../src/systems/targetingSystem.js';
import { createEnemy } from '../src/entities/enemy.js';
import { GENERALS, towerStats } from '../src/data/generals.js';
import { BAL } from '../src/data/balance.js';

// 找一关带 plateau 且某将位在台上(ch1 必有;按数据动态找,不锚死关号)
const lv = LEVELS.find((l) => l.terrain.some((z) => z.type === 'plateau')
  && l.slots.some((s) => l.terrainAt[s.y][s.x] === 'plateau'));
assert.ok(lv, '存在 plateau 且台上有将位的关(ch1 教学承诺)');
const onSlot = lv.slots.find((s) => lv.terrainAt[s.y][s.x] === 'plateau');
const offSlot = lv.slots.find((s) => lv.terrainAt[s.y][s.x] !== 'plateau');

// 1) 助手:台上 0.5 / 平地 0 / 无 terrainAt 的合成关 0(防御)
assert.equal(rangeBonusFor(lv, onSlot), BAL.PLATEAU_RANGE_BONUS, '台上 bonus');
assert.equal(rangeBonusFor(lv, offSlot), 0, '平地 0');
assert.equal(rangeBonusFor({}, { x: 0, y: 0 }), 0, '无 terrainAt 防御性 0');
assert.equal(terrainTypeAt(lv, onSlot.x, onSlot.y), 'plateau', 'terrainTypeAt');

// 2) tryBuild 落 rangeBonus
{
  const s = newGameState(lv); s.gold = 99999;
  tryBuild(s, onSlot, 'huang'); tryBuild(s, offSlot, 'zhang');
  assert.equal(s.towers[0].rangeBonus, BAL.PLATEAU_RANGE_BONUS, '建在台上得加成');
  assert.equal(s.towers[1].rangeBonus, 0, '平地无加成');
}

// 3) 射程链:敌在 (基础射程+0.25) 处=基础圈外、加成圈内 → 有加成锁得到,摘掉锁不到
{
  const s = newGameState(lv); s.gold = 99999; s.phase = 'combat';
  tryBuild(s, onSlot, 'huang');
  const t = s.towers[0];
  const baseR = towerStats(GENERALS.huang, 1).range;
  const pid = Object.keys(lv.paths)[0];
  const e = createEnemy('footman', pid, lv.paths[pid], 1);
  e.px = t.px + (baseR + 0.25) * BAL.CELL; e.py = t.py; e.alive = true;
  s.enemies = [e];
  targetingSystem(s);
  assert.equal(t.target, e, '高台塔凭 +0.5 锁定到基础圈外的敌');
  t.rangeBonus = 0;
  targetingSystem(s);
  assert.equal(t.target, null, '无加成锁不到(差异来自 bonus)');
}
console.log('ok plateau');
