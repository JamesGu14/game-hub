// src/data/achievements.js — 15 条挑战成就定义 + evaluate（纯函数，render-free）。
// evaluate(ach, save, run) → 当前"已达成但未 earned"的 id 数组（main.js 据此弹横幅 + 落盘）。
// run = { maxRunKills, castleHpFull }（结算/击杀时由 main.js 组装）。
import { LEVELS } from './levels.js';
import { CHAPTERS } from './campaign.js';
import { unlockedGenerals } from './unlocks.js';
import { BOSSES } from './bosses.js';
import { totalKills } from '../core/achievements.js';

const FIVE_TIGERS = ['guan', 'zhang', 'zhao', 'ma', 'huang'];

function chapterLevelNums(chId) {
  const out = [];
  for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i].chapter === chId) out.push(i + 1);
  return out;
}
function chapterCleared(save, chId) {
  const ns = chapterLevelNums(chId);
  return ns.length > 0 && ns.every((n) => (save.stars[n] || 0) >= 1);
}
function chapterAllThreeStar(save, chId) {
  const ns = chapterLevelNums(chId);
  return ns.length > 0 && ns.every((n) => save.stars[n] === 3);
}
const anyChapter = (save, fn) => CHAPTERS.some((c) => fn(save, c.id));

export const ACHIEVEMENTS = [
  { id: 'first_blood',    name: '初战告捷', cat: '进度', desc: '通关第 1 关',              test: (c) => (c.save.stars[1] || 0) >= 1 },
  { id: 'pacify_region',  name: '一方平定', cat: '进度', desc: '通关任意一整章',          test: (c) => anyChapter(c.save, chapterCleared) },
  { id: 'three_kingdoms', name: '三分天下', cat: '进度', desc: '通关全部 50 关',          test: (c) => LEVELS.every((_, i) => (c.save.stars[i + 1] || 0) >= 1) },
  { id: 'gather_heroes',  name: '群英荟萃', cat: '进度', desc: '解锁全部 12 位我方武将',  test: (c) => c.unlocked.size >= 12 },
  { id: 'five_tigers',    name: '五虎上将', cat: '收集', desc: '集齐五虎上将',            test: (c) => FIVE_TIGERS.every((id) => c.unlocked.has(id)) },
  { id: 'know_enemy',     name: '知己知彼', cat: '收集', desc: '点亮全部 20 名敌方名将',  test: (c) => Object.keys(BOSSES).every((id) => c.ach.seen[id]) },
  { id: 'martial_temple', name: '武庙立像', cat: '收集', desc: '点亮全部 44 张武将卡',    test: (c) => c.cardsLit >= 44 },
  { id: 'dazzling',       name: '流光溢彩', cat: '收集', desc: '任一武将达到钻石段位',    test: (c) => c.maxKills >= 400 },
  { id: 'pinnacle',       name: '登峰造极', cat: '收集', desc: '任一武将达到王者段位',    test: (c) => c.maxKills >= 2500 },
  { id: 'slayer',         name: '万人敌',   cat: '壮举', desc: '单局某将击杀 ≥ 50',        test: (c) => (c.run.maxRunKills || 0) >= 50 },
  { id: 'impregnable',    name: '固若金汤', cat: '壮举', desc: '满血通关任意关',          test: (c) => c.run.castleHpFull === true },
  { id: 'perfect_battle', name: '完美战役', cat: '壮举', desc: '任意关三星通关',          test: (c) => c.anyThreeStar },
  { id: 'masterstroke',   name: '运筹帷幄', cat: '壮举', desc: '某一整章全部三星',        test: (c) => anyChapter(c.save, chapterAllThreeStar) },
  { id: 'slaughter',      name: '杀敌如麻', cat: '累计', desc: '累计击杀 1000',            test: (c) => c.total >= 1000 },
  { id: 'reaper',         name: '名将收割', cat: '累计', desc: '累计击败敌将 100',         test: (c) => (c.ach.namedDefeats || 0) >= 100 },
];

const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
export const achName = (id) => (ACH_BY_ID[id]?.name || id);

export function evaluate(ach, save, run = {}) {
  const unlocked = unlockedGenerals(save);
  const seenCount = Object.keys(ach.seen || {}).filter((k) => ach.seen[k]).length;
  const killVals = Object.values(ach.kills || {});
  const ctx = {
    ach, save, run, unlocked,
    cardsLit: unlocked.size + seenCount,          // 12 友(解锁) + 敌(seen)，自然封顶 44
    maxKills: killVals.length ? Math.max(...killVals) : 0,
    total: totalKills(ach),
    anyThreeStar: Object.values(save.stars || {}).some((s) => s === 3),
  };
  const out = [];
  for (const a of ACHIEVEMENTS) if (!ach.earned[a.id] && a.test(ctx)) out.push(a.id);
  return out;
}
