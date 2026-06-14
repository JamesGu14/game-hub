// tests/achievementsEval.test.mjs — 15 条成就判定 / earned 幂等 / runCtx 驱动
import assert from 'node:assert';
import { ACHIEVEMENTS, evaluate } from '../src/data/achievements.js';
import { defaultAch } from '../src/core/achievements.js';
import { LEVELS } from '../src/data/levels.js';
import { CHAPTERS } from '../src/data/campaign.js';
import { BOSSES, LIEUTENANTS } from '../src/data/bosses.js';

const baseSave = () => ({ version: 1, unlockedLevel: 1, stars: {}, settings: {} });

// 15 条齐全 + id 唯一
{
  assert.equal(ACHIEVEMENTS.length, 15, '15 条');
  const ids = new Set(ACHIEVEMENTS.map(a => a.id));
  assert.equal(ids.size, 15, 'id 唯一');
}

// 空档：一条都不达成
{ assert.deepEqual(evaluate(defaultAch(), baseSave(), {}), [], '空档 0 达成'); }

// 初战告捷：通关第 1 关
{
  const s = baseSave(); s.stars = { 1: 2 };
  assert.ok(evaluate(defaultAch(), s, {}).includes('first_blood'), '通 L1 → 初战告捷');
}

// 三分天下：全 50 关有星
{
  const s = baseSave(); for (let i = 1; i <= LEVELS.length; i++) s.stars[i] = 1;
  const got = evaluate(defaultAch(), s, {});
  assert.ok(got.includes('three_kingdoms'), '全清 → 三分天下');
  assert.ok(got.includes('first_blood'), '同时含初战告捷');
}

// 群英荟萃 + 五虎上将：unlockedLevel>30 → 12 将全解锁
{
  const s = baseSave(); s.unlockedLevel = 40;
  const got = evaluate(defaultAch(), s, {});
  assert.ok(got.includes('gather_heroes'), '12 将全解锁');
  assert.ok(got.includes('five_tigers'), '五虎集齐');
}

// 知己知彼：20 名将全 seen
{
  const a = defaultAch(); for (const id of Object.keys(BOSSES)) a.seen[id] = true;
  assert.ok(evaluate(a, baseSave(), {}).includes('know_enemy'), '20 名将 → 知己知彼');
}

// 武庙立像：12 友(unlockedLevel>30) + 32 敌全 seen
{
  const a = defaultAch();
  for (const id of [...Object.keys(BOSSES), ...Object.keys(LIEUTENANTS)]) a.seen[id] = true;
  const s = baseSave(); s.unlockedLevel = 40;
  assert.ok(evaluate(a, s, {}).includes('martial_temple'), '44 卡全亮 → 武庙立像');
}

// 段位类：钻石/王者
{
  const a = defaultAch(); a.kills = { guan: 400 };
  assert.ok(evaluate(a, baseSave(), {}).includes('dazzling'), '400 → 流光溢彩');
  assert.ok(!evaluate(a, baseSave(), {}).includes('pinnacle'), '400 未到王者');
  a.kills.guan = 2500;
  assert.ok(evaluate(a, baseSave(), {}).includes('pinnacle'), '2500 → 登峰造极');
}

// 壮举：万人敌(run) / 固若金汤(run) / 完美战役(stars=3)
{
  assert.ok(evaluate(defaultAch(), baseSave(), { maxRunKills: 50 }).includes('slayer'), '单局50 → 万人敌');
  assert.ok(evaluate(defaultAch(), baseSave(), { castleHpFull: true }).includes('impregnable'), '满血 → 固若金汤');
  const s = baseSave(); s.stars = { 5: 3 };
  assert.ok(evaluate(defaultAch(), s, {}).includes('perfect_battle'), '3星 → 完美战役');
}

// 累计：杀敌如麻 / 名将收割
{
  const a = defaultAch(); a.kills = { guan: 600, zhao: 400 }; a.namedDefeats = 100;
  const got = evaluate(a, baseSave(), {});
  assert.ok(got.includes('slaughter'), '累计1000 → 杀敌如麻');
  assert.ok(got.includes('reaper'), '名将100 → 名将收割');
}

// earned 幂等：已得不再返回
{
  const s = baseSave(); s.stars = { 1: 1 };
  const a = defaultAch(); a.earned = { first_blood: true };
  assert.ok(!evaluate(a, s, {}).includes('first_blood'), '已 earned 不重复');
}

// 一方平定 / 运筹帷幄：第一章全清 / 全三星
{
  const ch1 = CHAPTERS[0].id;
  const idxs = LEVELS.map((l, i) => ({ l, i })).filter(x => x.l.chapter === ch1).map(x => x.i + 1);
  const s1 = baseSave(); for (const n of idxs) s1.stars[n] = 1;
  assert.ok(evaluate(defaultAch(), s1, {}).includes('pacify_region'), '第一章全清 → 一方平定');
  const s3 = baseSave(); for (const n of idxs) s3.stars[n] = 3;
  assert.ok(evaluate(defaultAch(), s3, {}).includes('masterstroke'), '第一章全3星 → 运筹帷幄');
}

// evaluate 容忍缺 earned 字段（防御）——不应抛错
{
  const noEarned = { version: 1, kills: {}, seen: {}, namedDefeats: 0 }; // 故意无 earned
  const s = baseSave(); s.stars = { 1: 1 };
  assert.doesNotThrow(() => evaluate(noEarned, s, {}), 'evaluate 容忍缺 earned');
  assert.ok(evaluate(noEarned, s, {}).includes('first_blood'), '缺 earned 仍正常判定');
}

// 43 卡不触发武庙立像（少 1 敌将）
{
  const a = defaultAch();
  const allEnemy = [...Object.keys(BOSSES), ...Object.keys(LIEUTENANTS)];
  for (const id of allEnemy.slice(0, -1)) a.seen[id] = true; // 31/32 敌将
  const s = baseSave(); s.unlockedLevel = 40;               // 12 友
  assert.ok(!evaluate(a, s, {}).includes('martial_temple'), '43 卡不触发武庙立像');
}

console.log('achievementsEval.test.mjs OK');
