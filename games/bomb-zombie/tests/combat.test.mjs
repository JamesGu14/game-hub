import { test } from 'node:test';
import assert from 'node:assert/strict';
import { effectiveStats, rollDamage, applyDamage, tickDoT } from '../src/combat.js';
import { HERO } from '../src/config.js';

test('同类%加法叠、层间相乘：两张+20%伤害=base*1.4', () => {
  const s = effectiveStats(HERO, { damagePct: 0.4 }, { damagePct: 0 });
  assert.ok(Math.abs(s.damage - HERO.damage * 1.4) < 1e-9);
});

test('局内与局外两层相乘：局内+50%、局外+100% = base*1.5*2', () => {
  const s = effectiveStats(HERO, { damagePct: 0.5 }, { damagePct: 1.0 });
  assert.ok(Math.abs(s.damage - HERO.damage * 1.5 * 2.0) < 1e-9);
});

test('射速%降低 fireInterval（射速越高间隔越短）', () => {
  const s = effectiveStats(HERO, { fireRatePct: 1.0 }, {});  // +100%射速
  assert.ok(Math.abs(s.fireInterval - HERO.fireInterval / 2) < 1e-9);
});

test('多重弹/穿透走加法整数通道', () => {
  const s = effectiveStats(HERO, { multishotAdd: 2, pierceAdd: 3 }, {});
  assert.equal(s.multishot, HERO.multishot + 2);
  assert.equal(s.pierce, HERO.pierce + 3);
});

test('暴击率封顶 100%', () => {
  const s = effectiveStats(HERO, { critRatePct: 5 }, {});  // 远超100%
  assert.equal(s.critRate, 1);
});

test('rollDamage 暴击翻 critMult 倍', () => {
  const stats = { damage: 10, critRate: 1, critMult: 2 };
  const r = rollDamage(stats, () => 0.0);
  assert.equal(r.isCrit, true);
  assert.equal(r.amount, 20);
});

test('护盾僵尸正面减伤 frontShield', () => {
  const e = { hp: 100, frontShield: 0.5 };
  const dealt = applyDamage(e, 40, true);  // 正面
  assert.equal(dealt, 20);
  assert.equal(e.hp, 80);
});

test('tickDoT 按层扣血并递减时长', () => {
  const e = { hp: 100, dots: [{ dps: 10, remain: 0.5 }] };
  const d = tickDoT(e, 0.5);
  assert.equal(d, 5);
  assert.equal(e.hp, 95);
  assert.equal(e.dots.length, 0);  // 时长耗尽移除
});
