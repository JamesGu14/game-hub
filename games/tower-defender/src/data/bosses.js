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
  // —— 检查点A 扩充 12 条（覆盖 50 关战役主将；美术 v1 fallback 色块+名）——
  huaxiong: { id: 'huaxiong', name: '华雄', hpMult: 1.0 },
  lvbu: { id: 'lvbu', name: '吕布', hpMult: 1.4 },
  yanliang: { id: 'yanliang', name: '颜良', hpMult: 1.0 },
  wenchou: { id: 'wenchou', name: '文丑', hpMult: 1.0 },
  caocao: { id: 'caocao', name: '曹操', hpMult: 1.3 },
  xiahoudun: { id: 'xiahoudun', name: '夏侯惇', hpMult: 1.1 },
  xiahouyuan: { id: 'xiahouyuan', name: '夏侯渊', hpMult: 1.1 },
  caoren: { id: 'caoren', name: '曹仁', hpMult: 1.2 },
  zhangren: { id: 'zhangren', name: '张任', hpMult: 1.0 },
  menghuo: { id: 'menghuo', name: '孟获', hpMult: 1.1 },
  sunquan: { id: 'sunquan', name: '孙权', hpMult: 1.2 },
  zhuran: { id: 'zhuran', name: '朱然', hpMult: 1.0 },
};

// —— 副将名册（偏冷门名将，作末波随主将出场的小 BOSS；hpMult 较主将低；v1 无 sprite → 渲染回退色块+名）——
// [检查点A 实玩反馈]「敌方武将增加」：每关主将再带 2 名副将（campaign.lieutenants），越靠后的波将领越多。
export const LIEUTENANTS = {
  // 曹魏
  lidian: { id: 'lidian', name: '李典', hpMult: 0.8 },
  yuejin: { id: 'yuejin', name: '乐进', hpMult: 0.8 },
  yujin: { id: 'yujin', name: '于禁', hpMult: 0.85 },
  caohong: { id: 'caohong', name: '曹洪', hpMult: 0.85 },
  caoxiu: { id: 'caoxiu', name: '曹休', hpMult: 0.8 },
  niujin: { id: 'niujin', name: '牛金', hpMult: 0.75 },
  // 东吴
  zhoutai: { id: 'zhoutai', name: '周泰', hpMult: 0.85 },
  jiangqin: { id: 'jiangqin', name: '蒋钦', hpMult: 0.8 },
  dingfeng: { id: 'dingfeng', name: '丁奉', hpMult: 0.85 },
  xusheng: { id: 'xusheng', name: '徐盛', hpMult: 0.8 },
  panzhang: { id: 'panzhang', name: '潘璋', hpMult: 0.8 },
  handang: { id: 'handang', name: '韩当', hpMult: 0.85 },
};
