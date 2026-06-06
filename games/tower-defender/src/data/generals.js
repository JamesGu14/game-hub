// data/generals.js — 蜀汉将塔定义。M1 仅黄忠（射程/攻速/伤害/类型 = §17.1 起点）。
// Phase 2 再补张飞/关羽/赵云/马超/诸葛 + 升级曲线 + L3 招牌技。
export const GENERALS = {
  huang: {
    id: 'huang', name: '黄忠',
    cost: 70, range: 3.5, interval: 0.7, dmg: 9,
    dmgType: 'physical', targets: 'both',   // 可打地面+空中
    color: '#ffd24d',
  },
};
