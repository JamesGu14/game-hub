// cards.js — 三选一卡池/抽取/应用/保底进化。命门：构筑深度与 build 高潮。纯逻辑。
import { CARD_RARITY } from './config.js';
import { pickWeighted } from './util.js';

// mod 字段对应 combat.effectiveStats 的 inMods 键。max=最大叠层。
export const CARD_POOL = [
  // —— 武器强化 ——
  { id: 'dmg',      name: '强力弹头', rarity: 'common',   max: 8, mod: { damagePct: 0.15 } },
  { id: 'rate',     name: '高速枪机', rarity: 'common',   max: 8, mod: { fireRatePct: 0.12 } },
  { id: 'multi',    name: '多重射击', rarity: 'rare',     max: 4, mod: { multishotAdd: 1 } },
  { id: 'pierce',   name: '穿甲弹',   rarity: 'uncommon', max: 4, mod: { pierceAdd: 1 } },
  { id: 'crit',     name: '瞄准镜',   rarity: 'uncommon', max: 6, mod: { critRatePct: 0.4 } },
  { id: 'critdmg',  name: '致命要害', rarity: 'rare',     max: 5, mod: { critMultAdd: 0.4 } },
  { id: 'splash',   name: '高爆弹',   rarity: 'uncommon', max: 5, mod: { splashAdd: 12 } },
  { id: 'speed',    name: '加速弹',   rarity: 'common',   max: 5, mod: { bulletSpeedPct: 0.15 } },
  // —— 元素特效（mod 触发挂载在 bullets 命中时，见 Task8 注；这里先记 inMods 标记位）——
  { id: 'burn',     name: '燃烧弹',   rarity: 'rare',     max: 5, mod: { burnDps: 6 } },
  { id: 'frost',    name: '冰霜弹',   rarity: 'uncommon', max: 4, mod: { frostSlow: 0.6 } },
  { id: 'chain',    name: '闪电链',   rarity: 'rare',     max: 4, mod: { chainCount: 1 } },
  { id: 'poison',   name: '剧毒',     rarity: 'uncommon', max: 5, mod: { poisonDps: 4 } },
  { id: 'knock',    name: '冲击波',   rarity: 'common',   max: 4, mod: { knockback: 18 } },
  // —— 防御 ——
  { id: 'wallhp',   name: '加固城墙', rarity: 'common',   max: 6, mod: { wallHpPct: 0.2 } },
  { id: 'wallregen',name: '自动修墙', rarity: 'uncommon', max: 5, mod: { wallRegen: 4 } },
  { id: 'shieldcd', name: '能量护盾', rarity: 'rare',     max: 3, mod: { shieldEvery: 12 } },
  { id: 'thorns',   name: '反伤尖刺', rarity: 'uncommon', max: 4, mod: { thorns: 8 } },
  // —— 经济·构筑 ——
  { id: 'xpgain',   name: '战斗经验', rarity: 'common',   max: 6, mod: { xpPct: 0.15 } },
  { id: 'goldgain', name: '拾荒者',   rarity: 'common',   max: 5, mod: { goldPct: 0.2 } },
  { id: 'magnet',   name: '吸引力场', rarity: 'uncommon', max: 3, mod: { magnet: 1 } },
  { id: 'refund',   name: '弹药回收', rarity: 'common',   max: 4, mod: { pierceAdd: 0.0, refund: 0.1 } },
  { id: 'rangeup',  name: '广域索敌', rarity: 'common',   max: 4, mod: { aoeTargets: 1 } },
  { id: 'firstaid', name: '应急维修', rarity: 'uncommon', max: 3, mod: { wallHpPct: 0.1, wallRegen: 2 } },
  { id: 'overload', name: '超载内核', rarity: 'epic',     max: 3, mod: { damagePct: 0.25, fireRatePct: 0.1 } },
  // —— 进化卡（叠满基础卡 + 前置后保底出现，替换基础卡）——
  { id: 'evo_gatling', name: '⚡加特林风暴', rarity: 'epic', evoFrom: 'rate',   prereq: ['multi'],  mod: { fireRatePct: 1.2, multishotAdd: 2 } },
  { id: 'evo_nova',    name: '☄️新星爆轰', rarity: 'epic', evoFrom: 'splash', prereq: ['dmg'],    mod: { splashAdd: 40, damagePct: 0.3 } },
  { id: 'evo_inferno', name: '🔥炼狱燃烧', rarity: 'epic', evoFrom: 'burn',   prereq: ['crit'],   mod: { burnDps: 30 } },
];

const byId = (id) => CARD_POOL.find((c) => c.id === id);

export function buildRun() { return { stacks: {}, inMods: {}, evolved: [] }; }

export function applyCard(run, cardId) {
  const card = byId(cardId);
  if (!card) return run;
  run.stacks[cardId] = (run.stacks[cardId] || 0) + 1;
  for (const [k, v] of Object.entries(card.mod || {})) {
    run.inMods[k] = (run.inMods[k] || 0) + v;
  }
  if (card.evoFrom) run.evolved.push(card.evoFrom);   // 标记基础卡被进化替换
  return run;
}

export function evolutionReady(run) {
  const out = [];
  for (const c of CARD_POOL) {
    if (!c.evoFrom) continue;
    if (run.stacks[c.id]) continue;                    // 已进化过
    const base = byId(c.evoFrom);
    const maxed = (run.stacks[c.evoFrom] || 0) >= base.max;
    const preOk = (c.prereq || []).every((p) => (run.stacks[p] || 0) >= 1);
    if (maxed && preOk) out.push(c.id);
  }
  return out;
}

const FALLBACK = ['__gold__', '__xp__', '__heal__'];

function selectable(run) {
  return CARD_POOL.filter((c) => {
    if (c.evoFrom) return false;                       // 进化卡只走保底通道
    if (run.evolved.includes(c.id)) return false;      // 已被进化替换，退池
    if (c.max && (run.stacks[c.id] || 0) >= c.max) return false;  // 叠满退池
    return true;
  });
}

export function draw3(run, rng) {
  const out = [];
  const evos = evolutionReady(run);
  if (evos.length) out.push(evos[0]);                  // 保底塞一张进化卡

  const pool = selectable(run).slice();
  while (out.length < 3 && pool.length) {
    const pick = pickWeighted(pool, (c) => CARD_RARITY[c.rarity] || 1, rng);
    out.push(pick.id);
    pool.splice(pool.indexOf(pick), 1);                // 组内去重
  }
  let fi = 0;
  while (out.length < 3) out.push(FALLBACK[fi++ % FALLBACK.length]);  // 兜底补齐
  return out;
}
