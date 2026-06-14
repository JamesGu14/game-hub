// tests/achievements.test.mjs — 注入式存档往返 / 损坏回退 / 归一化 / 段位边界 / 记录函数
import assert from 'node:assert';
import {
  defaultAch, loadAch, writeAch, ACH_VERSION,
  TIERS, tierIndex, recordKill, recordDefeatedEnemy, totalKills, cardTier,
} from '../src/core/achievements.js';

function fakeStore() {
  return { m: {}, getItem(k){ return Object.prototype.hasOwnProperty.call(this.m,k)?this.m[k]:null; }, setItem(k,v){ this.m[k]=v; } };
}

// 空 storage → 默认
{ const s = fakeStore(); assert.deepEqual(loadAch(s), defaultAch(), '空 → 默认'); }

// 往返一致
{
  const s = fakeStore();
  const a = defaultAch(); a.kills = { guan: 12 }; a.seen = { lvbu: true }; a.namedDefeats = 3; a.earned = { first_blood: true };
  writeAch(s, a);
  assert.deepEqual(loadAch(s), { version: ACH_VERSION, kills:{guan:12}, seen:{lvbu:true}, namedDefeats:3, earned:{first_blood:true} }, '往返');
}

// 坏 JSON → 默认
{ const bad = { getItem(){ return '{x'; }, setItem(){} }; assert.deepEqual(loadAch(bad), defaultAch(), '坏 JSON → 默认'); }

// 脏字段归一化
{
  const s = fakeStore();
  s.m['save_td_ach_v1'] = JSON.stringify({ kills:'x', seen:5, namedDefeats:-9, earned:null });
  const a = loadAch(s);
  assert.deepEqual(a.kills, {}, '脏 kills → {}');
  assert.deepEqual(a.seen, {}, '脏 seen → {}');
  assert.equal(a.namedDefeats, 0, '负 namedDefeats → 0');
  assert.deepEqual(a.earned, {}, '脏 earned → {}');
}

// 脏 kills 值归一化（负数/非整数 → 0，保留键）
{
  const s = fakeStore();
  s.m['save_td_ach_v1'] = JSON.stringify({ kills:{ guan:-5, zhao:'x', ma:3 } });
  const a = loadAch(s);
  assert.deepEqual(a.kills, { guan:0, zhao:0, ma:3 }, '脏 kills 值 → 非负整数否则0');
}

// 段位边界
{
  assert.equal(TIERS.length, 6, '6 段');
  assert.equal(tierIndex(0), 0, '0 → 青铜');
  assert.equal(tierIndex(49), 0, '49 → 青铜');
  assert.equal(tierIndex(50), 1, '50 → 白银');
  assert.equal(tierIndex(399), 2, '399 → 黄金');
  assert.equal(tierIndex(400), 3, '400 → 钻石');
  assert.equal(tierIndex(2499), 4, '2499 → 荣耀');
  assert.equal(tierIndex(2500), 5, '2500 → 王者');
  assert.equal(tierIndex(undefined), 0, 'undefined → 青铜');
}

// 记录函数
{
  const a = defaultAch();
  recordKill(a, 'guan'); recordKill(a, 'guan'); recordKill(a, null);
  assert.equal(a.kills.guan, 2, 'recordKill 累加;null 不计');
  recordKill(a, ''); assert.equal(Object.prototype.hasOwnProperty.call(a.kills, ''), false, '空字符串 id 不计');
  assert.equal(cardTier(a, 'guan'), 0, 'cardTier 查段位');
  recordDefeatedEnemy(a, 'lvbu'); recordDefeatedEnemy(a, 'lvbu');
  assert.equal(a.seen.lvbu, true, 'seen 标记');
  assert.equal(a.namedDefeats, 2, 'namedDefeats 每次累加');
  recordKill(a, 'zhao'); assert.equal(totalKills(a), 3, 'totalKills 求和');
}

console.log('achievements.test.mjs OK');
