// data/bosses.js — 各关末波名将 BOSS 定义（§5/§7）。
// 仅司马懿带主动技（§17.3「仅司马懿带技」）；其余 = 高血换名 boss 原型（部分 hpMult 更肉）。
// levels.js 在 boss spawn 里展开:{ ...BOSSES.<id> } → 提供 name/hpMult/bossSkills 给 createEnemy。
export const BOSSES = {
  mulu: { name: '木鹿大王', hpMult: 1.0 },     // L2 南蛮
  wutugu: { name: '兀突骨', hpMult: 1.3 },      // L3 南蛮藤甲
  ganning: { name: '甘宁', hpMult: 1.0 },       // L4 东吴
  luxun: { name: '陆逊', hpMult: 1.2 },         // L5 东吴
  zhangliao: { name: '张辽', hpMult: 1.0 },     // L6 曹魏
  zhanghe: { name: '张郃', hpMult: 1.0 },       // L7 曹魏
  xuchu: { name: '许褚', hpMult: 1.1 },         // L7 曹魏(双BOSS)
  simayi: { name: '司马懿', hpMult: 1.6, bossSkills: ['summon', 'stunTower'] }, // L8 终·双技
};
