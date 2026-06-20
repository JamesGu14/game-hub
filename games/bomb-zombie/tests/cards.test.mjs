import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CARD_POOL, buildRun, applyCard, evolutionReady, draw3 } from '../src/cards.js';
import { rngFrom } from '../src/util.js';

test('CARD_POOL 至少24张普通卡 + 含进化卡', () => {
  const base = CARD_POOL.filter((c) => !c.evoFrom);
  assert.ok(base.length >= 24, `基础卡仅 ${base.length}`);
  assert.ok(CARD_POOL.some((c) => c.evoFrom), '需有进化卡');
});

test('applyCard 叠层并累加 mod 到 inMods', () => {
  const run = buildRun();
  applyCard(run, 'dmg');
  applyCard(run, 'dmg');
  const dmgCard = CARD_POOL.find((c) => c.id === 'dmg');
  assert.equal(run.stacks.dmg, 2);
  assert.ok(Math.abs(run.inMods.damagePct - dmgCard.mod.damagePct * 2) < 1e-9);
});

test('draw3 组内去重、永远3张', () => {
  const run = buildRun();
  const rng = rngFrom(42);
  for (let k = 0; k < 30; k++) {
    const three = draw3(run, rng);
    assert.equal(three.length, 3);
    assert.equal(new Set(three).size, 3);  // 去重
  }
});

test('叠满的卡退出卡池（不再被抽到，除非其进化）', () => {
  const run = buildRun();
  const card = CARD_POOL.find((c) => !c.evoFrom && c.max);
  for (let i = 0; i < card.max; i++) applyCard(run, card.id);
  const rng = rngFrom(7);
  for (let k = 0; k < 60; k++) {
    const three = draw3(run, rng);
    assert.ok(!three.includes(card.id) || three.includes(`${card.id}`) === false);
  }
});

test('叠满+前置满足 → evolutionReady 命中且 draw3 保底出进化卡', () => {
  const run = buildRun();
  const evo = CARD_POOL.find((c) => c.evoFrom);
  const baseId = evo.evoFrom;
  const baseCard = CARD_POOL.find((c) => c.id === baseId);
  for (const p of (evo.prereq || [])) applyCard(run, p);
  for (let i = 0; i < baseCard.max; i++) applyCard(run, baseId);
  assert.ok(evolutionReady(run).includes(evo.id));
  const three = draw3(run, rngFrom(3));
  assert.ok(three.includes(evo.id), '保底未出进化卡');
});

test('applyCard 进化卡替换基础卡', () => {
  const run = buildRun();
  const evo = CARD_POOL.find((c) => c.evoFrom);
  applyCard(run, evo.evoFrom);
  applyCard(run, evo.id);
  assert.ok(run.stacks[evo.id] >= 1);
  assert.equal(run.evolved && run.evolved.includes(evo.evoFrom), true);
});
