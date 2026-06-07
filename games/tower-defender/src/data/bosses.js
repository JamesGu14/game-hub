// data/bosses.js — 各关末波名将 BOSS 定义（§5/§7）。
// 仅司马懿带主动技（§17.3「仅司马懿带技」）；其余 = 高血换名 boss 原型（部分 hpMult 更肉）。
// levels.js 在 boss spawn 里展开:{ ...BOSSES.<id> } → 提供 id/name/hpMult/bossSkills 给 createEnemy。
// [P6] id 透传到 e.bossId，供 entityRenderer 取 boss sprite（boss_<id>）；缺图回退色块。
export const BOSSES = {
  mulu: { id: 'mulu', name: '木鹿大王', hpMult: 1.0 },     // L2 南蛮（有 sprite）
  wutugu: { id: 'wutugu', name: '兀突骨', hpMult: 1.3 },    // L3 南蛮藤甲（有 sprite）
  ganning: { id: 'ganning', name: '甘宁', hpMult: 1.0 },    // L4 东吴（v2 美术）
  luxun: { id: 'luxun', name: '陆逊', hpMult: 1.2 },        // L5 东吴（v2）
  zhangliao: { id: 'zhangliao', name: '张辽', hpMult: 1.0 }, // L6 曹魏（v2）
  zhanghe: { id: 'zhanghe', name: '张郃', hpMult: 1.0 },     // L7 曹魏（v2）
  xuchu: { id: 'xuchu', name: '许褚', hpMult: 1.1 },         // L7 曹魏·双BOSS（v2）
  simayi: { id: 'simayi', name: '司马懿', hpMult: 1.6, bossSkills: ['summon', 'stunTower'] }, // L8 终·双技（v2）
};
