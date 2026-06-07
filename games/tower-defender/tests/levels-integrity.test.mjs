// tests/levels-integrity.test.mjs — 关卡完整性 + CP1 南蛮 L1-3 结构(§7)
// 运行：node games/tower-defender/tests/levels-integrity.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { verifyLevel } from '../tools/verify-levels.mjs';

assert.equal(LEVELS.length, 8, '完整 8 关战役(南蛮3+东吴2+曹魏3)');

const campsExp = { 1: 2, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8 };  // §7 敌营 2→8
const factionExp = { 1: 'nanman', 2: 'nanman', 3: 'nanman', 4: 'wu', 5: 'wu', 6: 'wei', 7: 'wei', 8: 'wei' };
const VALID_FACTIONS = new Set(['nanman', 'wu', 'wei']);
const typesOf = (lv) => new Set(lv.waves.flatMap((w) => w.spawns.map((s) => s.enemyType)));

for (const lv of LEVELS) {
  const r = verifyLevel(lv);
  assert.equal(r.errors.length, 0, `L${lv.id} 完整性错误: ${r.errors.join('; ')}`);
  assert.ok(VALID_FACTIONS.has(lv.faction), `L${lv.id} 势力合法`);
  if (factionExp[lv.id]) assert.equal(lv.faction, factionExp[lv.id], `L${lv.id} 势力=${factionExp[lv.id]}`);
  if (campsExp[lv.id]) assert.equal(lv.camps.length, campsExp[lv.id], `L${lv.id} 敌营数=${campsExp[lv.id]}`);
}

// L1 纯教学:无 BOSS/藤甲
const l1 = typesOf(LEVELS[0]);
assert.ok(!l1.has('boss') && !l1.has('tengjia'), 'L1 纯教学(无BOSS/藤甲)');
assert.ok(typesOf(LEVELS[1]).has('boss'), 'L2 末波 BOSS');
const l3 = typesOf(LEVELS[2]);
assert.ok(l3.has('tengjia') && l3.has('boss'), 'L3 含藤甲+BOSS');
// L4 东吴:引入飞兵 + 重甲
const l4 = typesOf(LEVELS[3]);
assert.ok(l4.has('flyer') && l4.has('heavy') && l4.has('boss'), 'L4 含飞兵+重甲+BOSS');
// L5 东吴:引入方士
const l5 = typesOf(LEVELS[4]);
assert.ok(l5.has('shaman') && l5.has('boss'), 'L5 含方士+BOSS');
// L6-8 曹魏:全兵种
const l8 = typesOf(LEVELS[7]);
for (const t of ['footman', 'wolf', 'heavy', 'flyer', 'shaman', 'boss']) assert.ok(l8.has(t), `L8 含 ${t}`);
// L8 终 BOSS 司马懿带主动技(summon + stunTower)
const simayi = LEVELS[7].waves.flatMap((w) => w.spawns).find((s) => s.bossSkills);
assert.ok(simayi && simayi.bossSkills.includes('summon') && simayi.bossSkills.includes('stunTower') && simayi.name === '司马懿', 'L8 司马懿带召唤+震慑双技');

console.log('ok levels-integrity');
