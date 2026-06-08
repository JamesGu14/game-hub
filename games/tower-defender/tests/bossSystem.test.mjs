// tests/bossSystem.test.mjs — 司马懿双技:summon(15s召2魏卒,继承位置) + stunTower(8s震最近塔,combat停火)
// 运行：node games/tower-defender/tests/bossSystem.test.mjs
import assert from 'node:assert';
import { bossSystem } from '../src/systems/bossSystem.js';
import { combatSystem } from '../src/systems/combatSystem.js';
import { createEnemy } from '../src/entities/enemy.js';
import { createTower } from '../src/entities/tower.js';

const path = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
const level = { faction: 'wei', scale: 1, paths: { a: path } };
function mkBoss() {
  const b = createEnemy('boss', 'a', path, 1, { faction: 'wei', name: '司马懿', bossSkills: ['summon', 'stunTower'] });
  b.seg = 1; b.progress = 1; b.px = 200; b.py = 50; return b;
}

// summon:15s 召 2 魏卒,继承 boss 位置
{
  const boss = mkBoss();
  const s = { phase: 'combat', time: 0, level, enemies: [boss], towers: [] };
  for (let i = 0; i < 15.05 * 60; i++) { s.time += 1 / 60; bossSystem(s, 1 / 60); }
  const minions = s.enemies.filter((e) => e.type === 'footman');
  assert.equal(minions.length, 2, '15s 召 2 名');
  assert.equal(minions[0].name, '魏卒', '魏卒皮');
  assert.ok(Math.abs(minions[0].px - boss.px) < 1 && minions[0].progress === boss.progress, '继承 boss 路点位置');
}

// stunTower:8s 震最近塔;远塔不受;combat 该塔停火
{
  const boss = mkBoss();
  const near = createTower('huang', { x: 5, y: 1 }); near.px = 210; near.py = 50;
  const far = createTower('zhao', { x: 0, y: 0 }); far.px = 2000; far.py = 2000;
  const s = { phase: 'combat', time: 0, level, enemies: [boss], towers: [near, far] };
  for (let i = 0; i < 8.05 * 60; i++) { s.time += 1 / 60; bossSystem(s, 1 / 60); }
  assert.ok(near.stunnedUntil > s.time, '最近塔被震慑');
  assert.equal(far.stunnedUntil, 0, '远塔不受');

  const e = createEnemy('footman', 'a', path, 1); e.px = 210; e.py = 50;
  near.target = e; const hp0 = e.hp;
  combatSystem({ phase: 'combat', time: s.time, rng: () => 0.99, enemies: [e], towers: [near], projectiles: [], fx: [], gold: 0 }, 1 / 60);
  assert.equal(e.hp, hp0, '被震塔停火(敌血不掉)');
}

// summon 继承 boss 的 wave ramp（rampHp/dmgTakenMult）
{
  const boss = mkBoss();
  boss.rampHp = 2; boss.dmgTakenMult = 0.85;
  const s = { phase: 'combat', time: 0, level, enemies: [boss], towers: [] };
  for (let i = 0; i < 15.05 * 60; i++) { s.time += 1 / 60; bossSystem(s, 1 / 60); }
  const minion = s.enemies.find((e) => e.type === 'footman');
  assert.equal(minion.hp, 120, '召出魏卒继承 rampHp2 → 60×2=120');
  assert.equal(minion.dmgTakenMult, 0.85, '召出魏卒继承 dmgTakenMult');
}

console.log('ok bossSystem');
