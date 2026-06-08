// data/generals.js — 蜀汉六将塔定义（§4 造价 + §17.1 硬参数 + §17.2 L3 招牌技）。
// attack: 攻击行为 single|splash|slow|charge|burn（派发见 systems/combat/attacks.js）。
// signature: L3 招牌技 type=cooldown(到点自动放)|passive(常驻)。
// 数值经 towerStats(g, level) 按等级缩放；勿在别处各自算。
import { BAL } from './balance.js';

export const GENERALS = {
  huang: {
    id: 'huang', name: '黄忠',
    cost: 70, range: 3.5, interval: 0.7, dmg: 9,
    dmgType: 'physical', targets: 'both',   // 单体速射·可空
    attack: 'single', attackParams: {},
    signature: { id: 'baibu', name: '百步穿杨', type: 'passive', params: {} }, // 25% 暴击 ×2.5 无视护甲（见 damageCalc）
    color: '#ffd24d',
  },
  zhang: {
    id: 'zhang', name: '张飞',
    cost: 110, range: 2.5, interval: 1.8, dmg: 20,
    dmgType: 'physical', targets: 'ground', // 范围溅射·清群·仅地
    attack: 'splash', attackParams: { splash: 1 },   // 溅射半径 1 格
    signature: { id: 'nuhou', name: '当阳怒吼', type: 'cooldown', cooldown: 10, params: { stunDur: 1, radius: 1 } },
    color: '#b06b3a',
  },
  guan: {
    id: 'guan', name: '关羽',
    cost: 120, range: 3.0, interval: 1.5, dmg: 10,
    dmgType: 'strategy', targets: 'both',   // 减速控制（水攻·无视护甲）·可空
    attack: 'slow', attackParams: { slowPct: 0.4, slowDur: 2.5 },
    signature: { id: 'shuiyan', name: '水淹七军', type: 'cooldown', cooldown: 12, params: { slowPct: 0.6, slowDur: 3, dmgMult: 1, radius: 1.5 } },
    color: '#3aa6d6',
  },
  zhao: {
    id: 'zhao', name: '赵云',
    cost: 160, range: 5.0, interval: 2.5, dmg: 48,
    dmgType: 'physical', targets: 'ground', // 高单体·狙 BOSS·仅地
    attack: 'single', attackParams: {},
    signature: { id: 'qijin', name: '七进七出', type: 'passive', params: { maxChain: 2 } }, // 击杀后连射，每次出手最多连 2
    color: '#dfe3ea',
  },
  ma: {
    id: 'ma', name: '马超',
    cost: 140, range: 3.0, interval: 1.2, dmg: 14,
    dmgType: 'physical', targets: 'ground', // 沿道路冲锋·多目标·仅地
    attack: 'charge', attackParams: { maxHits: 3 },
    signature: { id: 'tuzhen', name: '西凉突阵', type: 'passive', params: { knockback: 0.5 } }, // 末端击退 0.5 格
    color: '#e0533a',
  },
  zhuge: {
    id: 'zhuge', name: '诸葛亮',
    cost: 150, range: 3.0, interval: 1.4, dmg: 8,  // dmg = 灼烧 dps（每秒），非命中直伤
    dmgType: 'fire', targets: 'both',       // 火攻灼烧·蔓延·克藤甲·可空
    attack: 'burn', attackParams: { burnDur: 3 },
    signature: { id: 'huoshao', name: '火烧藤甲', type: 'passive', params: { vsTengjiaMult: 2 } }, // 对南蛮藤甲灼烧 ×2
    color: '#ff7a2f',
  },
};

// 升级曲线（§17.1 硬坡 + §5.3 软坡）：断点=SIGNATURE_LEVEL。
// L1→SIGNATURE_LEVEL：dmg×1.6 · interval×0.9（原曲线不变）。
// SIGNATURE_LEVEL→MAX：软坡 dmg×SOFT · interval×SOFT（防 L5 秒杀）。range 全程线性 +0.5/级。
export function towerStats(g, level) {
  const HARD = Math.min(level, BAL.SIGNATURE_LEVEL) - 1;   // 硬坡指数 0..(SIGNATURE_LEVEL-1)
  const SOFT = Math.max(0, level - BAL.SIGNATURE_LEVEL);   // 软坡指数 0..(MAX-SIGNATURE_LEVEL)
  return {
    dmg: g.dmg * BAL.UPGRADE_DMG_MULT ** HARD * BAL.UPGRADE_DMG_MULT_SOFT ** SOFT,
    range: g.range + BAL.UPGRADE_RANGE_ADD * (level - 1),
    interval: g.interval * BAL.UPGRADE_INTERVAL_MULT ** HARD * BAL.UPGRADE_INTERVAL_MULT_SOFT ** SOFT,
  };
}
