// data/generals.js — 蜀汉12将塔定义（五虎+诸葛 premium·L3招牌技 / 新6将廉价·无招牌技；§4 造价 + §17.1 硬参数 + §17.2 L3 招牌技）。
// attack: 攻击行为 single|splash|slow|charge|burn（派发见 systems/combat/attacks.js）。
// signature: L3 招牌技 type=cooldown(到点自动放)|passive(常驻)。
// 数值经 towerStats(g, level) 按等级缩放；勿在别处各自算。
import { BAL } from './balance.js';

// —— 五虎将+诸葛（premium，L3 招牌技；单发武力排序 赵>关>马>张>黄，spec §2.1）——
export const GENERALS = {
  huang: {
    id: 'huang', name: '黄忠',
    cost: 90, range: 4.5, interval: 0.7, dmg: 7,   // [改进⑩] 远程消耗位:射程3.5→4.5,攻9→7
    dmgType: 'physical', targets: 'both',   // 单体速射·可空·单发最轻（武力⑤）
    attack: 'single', attackParams: {},
    signature: { id: 'baibu', name: '百步穿杨', type: 'passive', params: {} }, // 25% 暴击 ×2.5 无视护甲（见 damageCalc）
    color: '#ffd24d',
  },
  zhang: {
    id: 'zhang', name: '张飞',
    cost: 140, range: 2.5, interval: 1.8, dmg: 18,
    dmgType: 'physical', targets: 'ground', // 范围溅射·清群·仅地（武力④）
    attack: 'splash', attackParams: { splash: 1 },
    signature: { id: 'nuhou', name: '当阳怒吼', type: 'cooldown', cooldown: 10, params: { stunDur: 1, radius: 1 } },
    color: '#b06b3a',
  },
  guan: {
    id: 'guan', name: '关羽',
    cost: 155, range: 3.0, interval: 2.2, dmg: 28,
    dmgType: 'strategy', targets: 'both',   // 重刀+减速控制（水攻·无视护甲）·可空（武力②）
    attack: 'slow', attackParams: { slowPct: 0.4, slowDur: 2.5 },
    signature: { id: 'shuiyan', name: '水淹七军', type: 'cooldown', cooldown: 12, params: { slowPct: 0.6, slowDur: 3, dmgMult: 1, radius: 1.5 } },
    color: '#3aa6d6',
  },
  zhao: {
    id: 'zhao', name: '赵云',
    cost: 200, range: 5.0, interval: 2.5, dmg: 48,
    dmgType: 'physical', targets: 'ground', // 高单体·狙 BOSS·仅地（武力①）
    attack: 'single', attackParams: {},
    signature: { id: 'qijin', name: '七进七出', type: 'passive', params: { maxChain: 2 } },
    color: '#dfe3ea',
  },
  ma: {
    id: 'ma', name: '马超',
    cost: 175, range: 3.0, interval: 1.4, dmg: 22,
    dmgType: 'physical', targets: 'ground', // 沿道路冲锋·多目标·仅地（武力③）
    attack: 'charge', attackParams: { maxHits: 3 },
    signature: { id: 'tuzhen', name: '西凉突阵', type: 'passive', params: { knockback: 0.5 } },
    color: '#e0533a',
  },
  zhuge: {
    id: 'zhuge', name: '诸葛亮',
    cost: 190, range: 3.0, interval: 1.4, dmg: 8,  // dmg = 灼烧 dps（每秒），非命中直伤
    dmgType: 'fire', targets: 'both',       // 火攻灼烧·克藤甲·可空（谋略系，不参与武力排序）
    attack: 'burn', attackParams: { burnDur: 3 },
    signature: { id: 'huoshao', name: '火烧藤甲', type: 'passive', params: { vsTengjiaMult: 2 } }, // 对南蛮藤甲灼烧 ×2
    color: '#ff7a2f',
  },
  // —— 新 6 将（廉价起步，师门传承，无招牌技；spec §2.2）——
  liao: {
    id: 'liao', name: '廖化',
    cost: 40, range: 4.0, interval: 0.8, dmg: 5,   // [改进⑩] 远程消耗位:射程3.0→4.0,攻6→5
    dmgType: 'physical', targets: 'both',   // 师承黄忠：单体速射·可空·最便宜入门将
    attack: 'single', attackParams: {},
    signature: null,
    color: '#ffe08a',
  },
  zhou: {
    id: 'zhou', name: '周仓',
    cost: 55, range: 2.5, interval: 2.0, dmg: 11,
    dmgType: 'physical', targets: 'ground', // 师承张飞：大刀溅射·仅地
    attack: 'splash', attackParams: { splash: 0.8 },
    signature: null,
    color: '#8a8f99',
  },
  madai: {
    id: 'madai', name: '马岱',
    cost: 55, range: 2.8, interval: 1.3, dmg: 9,
    dmgType: 'physical', targets: 'ground', // 师承马超：轻骑冲锋·贯穿≤2·仅地
    attack: 'charge', attackParams: { maxHits: 2 },
    signature: null,
    color: '#f08a70',
  },
  guanping: {
    id: 'guanping', name: '关平',
    cost: 60, range: 3.0, interval: 1.6, dmg: 6,
    dmgType: 'strategy', targets: 'both',   // 师承关羽：小水攻（谋略·无视护甲）+弱减速·可空
    attack: 'slow', attackParams: { slowPct: 0.25, slowDur: 2 },
    signature: null,
    color: '#7cc4e0',
  },
  zhangbao: {
    id: 'zhangbao', name: '张苞',
    cost: 65, range: 4.0, interval: 1.9, dmg: 16,
    dmgType: 'physical', targets: 'ground', // 重击位（对照赵云）：蛇矛重击单体·仅地
    attack: 'single', attackParams: {},
    signature: null,
    color: '#cf8d56',
  },
  yueying: {
    id: 'yueying', name: '黄月英',
    cost: 75, range: 2.8, interval: 1.5, dmg: 5,  // dmg = 灼烧 dps/层
    dmgType: 'fire', targets: 'both',       // 师承诸葛：机关火弩灼烧·克藤甲·可空·开局即有的火系
    attack: 'burn', attackParams: { burnDur: 2.5 },
    signature: null,
    color: '#ffa05c',
  },
};

// 升级曲线（§17.1 硬坡 + §5.3 软坡）：断点=SIGNATURE_LEVEL。
// L1→SIGNATURE_LEVEL：dmg×1.5 · interval×0.9（重排spec §2.3）。
// SIGNATURE_LEVEL→MAX：软坡 dmg×SOFT(1.3) · interval×SOFT(0.95)（防 L5 秒杀）。range 全程线性 +0.5/级。
export function towerStats(g, level) {
  const HARD = Math.min(level, BAL.SIGNATURE_LEVEL) - 1;   // 硬坡指数 0..(SIGNATURE_LEVEL-1)
  const SOFT = Math.max(0, level - BAL.SIGNATURE_LEVEL);   // 软坡指数 0..(MAX-SIGNATURE_LEVEL)
  return {
    dmg: g.dmg * BAL.UPGRADE_DMG_MULT ** HARD * BAL.UPGRADE_DMG_MULT_SOFT ** SOFT,
    range: g.range + BAL.UPGRADE_RANGE_ADD * (level - 1),
    interval: g.interval * BAL.UPGRADE_INTERVAL_MULT ** HARD * BAL.UPGRADE_INTERVAL_MULT_SOFT ** SOFT,
  };
}

// 等级数值 × 地形加成（建塔时写 tower.dmgMult/rangeBonus/intervalMult；缺则默认）。
// 收口：所有战斗/UI 取数走此函数，勿在调用点再 +rangeBonus（防双计）。
export function effectiveStats(tower) {
  const s = towerStats(GENERALS[tower.generalId], tower.level);
  return {
    dmg: s.dmg * (tower.dmgMult || 1),
    range: s.range + (tower.rangeBonus || 0),
    interval: s.interval * (tower.intervalMult || 1),
  };
}
