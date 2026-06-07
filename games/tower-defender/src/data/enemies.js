// data/enemies.js — 六类敌兵原型（§5 数值 + §17.3 抗性/特性）。
// speed = 格/秒（footman 0.7 为基准）；resist[dmgType] 未列项默认 ×1.0。
// scale 在 entities/enemy.js 工厂落点（HP/掉金 × level.scale）。Phase 3 再做三势力换皮命名。
export const ENEMIES = {
  footman: {
    id: 'footman', name: '步卒',
    hp: 60, speed: 0.7, gold: 5, castleDmg: 1, flying: false,
    color: '#c0392b',
  },
  wolf: {
    id: 'wolf', name: '狼骑',
    hp: 35, speed: 1.05, gold: 4, castleDmg: 1, flying: false,  // 快·考验减速
    color: '#e67e22',
  },
  tengjia: {
    id: 'tengjia', name: '藤甲兵',
    hp: 180, speed: 0.45, gold: 12, castleDmg: 2, flying: false,
    resist: { physical: 0.5, fire: 1.5, strategy: 1.0 },        // 抗物理·怕火·谋略常规
    tag: 'tengjia',                                             // 诸葛 L3 火烧藤甲 ×2 键此
    color: '#6b8e23',
  },
  flyer: {
    id: 'flyer', name: '飞兵',
    hp: 70, speed: 0.7, gold: 8, castleDmg: 1, flying: true,    // 直扑成都·仅防空将可打
    color: '#b39ddb',
  },
  shaman: {
    id: 'shaman', name: '方士',
    hp: 50, speed: 0.7, gold: 15, castleDmg: 1, flying: false,  // 全场最低血档 →「最弱」可靠点杀
    heal: { range: 1.5, perSec: 8 },                           // 治疗周围友军（封顶见 BAL.HEAL_CAP_PER_SEC）
    color: '#e84393',
  },
  heavy: {
    id: 'heavy', name: '重甲',
    hp: 200, speed: 0.5, gold: 14, castleDmg: 2, flying: false,
    resist: { physical: 0.6 },                                  // 吴/魏重甲：抗物理较轻、不怕火（区别南蛮藤甲）
    tag: 'heavy',
    color: '#7f8c9b',
  },
  boss: {
    id: 'boss', name: '名将',
    hp: 800, speed: 0.45, gold: 80, castleDmg: 5, flying: false,
    resist: { physical: 0.9 },                                  // 轻抗物理；主动技仅司马懿（见 data/bosses.js + bossSystem）
    isBoss: true,
    color: '#2c2c54',
  },
};
