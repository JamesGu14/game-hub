// tests/terrainBonus.test.mjs — terrainBonuses 三类型取值 + effectiveStats 三加成
// 运行：node games/tower-defender/tests/terrainBonus.test.mjs
import assert from 'node:assert';
import { BAL } from '../src/data/balance.js';
import { terrainBonuses, rangeBonusFor } from '../src/systems/terrainSystem.js';

// 合成关：terrainAt[y][x] 查表（plateau/barracks/archtower/平地/越界）
const fake = { terrainAt: [['plateau', 'barracks'], ['archtower', null]] };

assert.deepEqual(terrainBonuses(fake, { x: 0, y: 0 }),
  { rangeBonus: BAL.PLATEAU_RANGE_BONUS, dmgMult: 1, intervalMult: 1 }, 'plateau 只加射程');
assert.deepEqual(terrainBonuses(fake, { x: 1, y: 0 }),
  { rangeBonus: 0, dmgMult: BAL.BARRACKS_DMG_MULT, intervalMult: 1 }, 'barracks 只加攻击');
assert.deepEqual(terrainBonuses(fake, { x: 0, y: 1 }),
  { rangeBonus: 0, dmgMult: 1, intervalMult: BAL.ARCHTOWER_INTERVAL_MULT }, 'archtower 只加攻速');
assert.deepEqual(terrainBonuses(fake, { x: 1, y: 1 }),
  { rangeBonus: 0, dmgMult: 1, intervalMult: 1 }, '平地无加成');
assert.deepEqual(terrainBonuses({}, { x: 0, y: 0 }),
  { rangeBonus: 0, dmgMult: 1, intervalMult: 1 }, '无 terrainAt 防御性默认');
assert.deepEqual(terrainBonuses(fake, { x: 5, y: 5 }),
  { rangeBonus: 0, dmgMult: 1, intervalMult: 1 }, '越界 slot 安全默认');

// 常量量级自检（温和 +25%）
assert.equal(BAL.BARRACKS_DMG_MULT, 1.25, '营 +25%');
assert.equal(BAL.ARCHTOWER_INTERVAL_MULT, 0.8, '塔 间隔×0.8=攻速+25%');

// rangeBonusFor 薄封装仍可用（plateau.test 依赖）
assert.equal(rangeBonusFor(fake, { x: 0, y: 0 }), BAL.PLATEAU_RANGE_BONUS, 'rangeBonusFor 委托');
assert.equal(rangeBonusFor(fake, { x: 1, y: 1 }), 0, 'rangeBonusFor 平地 0');

console.log('ok terrainBonus');
