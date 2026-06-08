// tests/levels-integrity.test.mjs — 50 关战役完整性（§6/§9.2）
// 运行：node games/tower-defender/tests/levels-integrity.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { CHAPTERS } from '../src/data/campaign.js';
import { verifyLevel } from '../tools/verify-levels.mjs';

assert.equal(LEVELS.length, 50, '50 关战役');

// id 连续唯一 1..50
assert.deepEqual(LEVELS.map((l) => l.id), Array.from({ length: 50 }, (_, i) => i + 1), 'id 连续唯一');

const VALID_FACTIONS = new Set(['nanman', 'wu', 'wei']);
for (const lv of LEVELS) {
  const r = verifyLevel(lv);
  assert.equal(r.errors.length, 0, `L${lv.id} 完整性错误: ${r.errors.join('; ')}`);
  assert.equal(r.leaks.length, 0, `L${lv.id} 漏怪: ${JSON.stringify(r.leaks)}`);
  assert.ok(VALID_FACTIONS.has(lv.faction), `L${lv.id} 势力合法`);
  assert.ok(lv.chapter >= 1 && lv.chapter <= CHAPTERS.length, `L${lv.id} 章号合法`);
  assert.ok(lv.waves.length >= 20, `L${lv.id} ≥20 波（实际 ${lv.waves.length}）`);
  // 末波含 boss
  const lastSpawns = lv.waves[lv.waves.length - 1].spawns;
  assert.ok(lastSpawns.some((s) => s.enemyType === 'boss'), `L${lv.id} 末波含 boss`);
}

// 每章 10 关
for (const ch of CHAPTERS) {
  assert.equal(LEVELS.filter((l) => l.chapter === ch.id).length, 10, `第${ch.id}章 10 关`);
}

// 终关 50 = 司马懿带主动技（summon + stunTower）
const simayi = LEVELS[49].waves.flatMap((w) => w.spawns).find((s) => s.bossSkills);
assert.ok(simayi && simayi.bossSkills.includes('summon') && simayi.bossSkills.includes('stunTower') && simayi.name === '司马懿', 'L50 司马懿双技');

// boss 覆盖正确：展开后末波 boss spawn 的 name/hpMult = campaign 记录覆盖值（防 {...baseBoss,...c.boss} merge 顺序 reverse）。
// L21 赤壁样板 boss={id:caocao,name:'曹操',hpMult:1.3} 覆盖 BOSSES.caocao。
const chibiBoss = LEVELS[20].waves[LEVELS[20].waves.length - 1].spawns.find((s) => s.enemyType === 'boss');
assert.equal(chibiBoss.name, '曹操', 'L21 boss name 来自 campaign 覆盖');
assert.ok(Math.abs(chibiBoss.hpMult - 1.3) < 1e-9, 'L21 boss hpMult=1.3（campaign 覆盖 BOSSES）');

// 多敌将（检查点A）：L1 末段含 主将夏侯惇 + 副将李典/于禁（敌方武将增加）
const l1Generals = new Set(LEVELS[0].waves.flatMap((w) => w.spawns).filter((s) => s.enemyType === 'boss').map((s) => s.name));
assert.ok(l1Generals.has('夏侯惇') && l1Generals.has('李典') && l1Generals.has('于禁'), `L1 应含主将+2副将（实际 ${[...l1Generals].join('/')}）`);

console.log('ok levels-integrity');
