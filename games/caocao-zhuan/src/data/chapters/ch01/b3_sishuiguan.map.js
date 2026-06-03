// 第三战 · 汜水关  (Task B3 — battle map)
// 10 列 × 8 行等距战场。terrainId 取自 data/terrain.js：
//   grass 草 / road 路 / forest 林 / hill 丘 / mountain 山 / water 水(不可通行) / gate 关门
//
// 布局意图（攻坚/关隘地形教学，曹军侧翼破关）：
//   · 北缘横亘一道关墙：以 mountain 山体夹一段 gate 关门(c3..c6 r0)，即汜水关正面，是夺取目标；
//   · 关前有一条东西向 road 横道(r1) 与南北两条上关甬道，唯有道路与草地可直抵关门；
//   · 关下设一道东西向 water 壕沟(r3)，仅 c2 / c7 两处 road 桥可渡，逼联军分两路仰攻；
//   · 西侧一片 forest 密林(r4..r6 c0..c2) 可供侧翼迂回隐蔽，东南一座 hill 丘(c8 r6) 作弓手射点；
//   · 我方(曹军侧翼)自南缘(r6/r7)沿主路压上。
// 所有我方部署格与敌方布阵格均落在可通行地形上（非水）。
//
// 坐标约定：c = 列(0..9)，r = 行(0..7)；tiles[r][c]。

// 行 0 (北/上) ←汜水关守军一侧；行 7 (南/下) ←曹军一侧
export const MAP = {
  id: 'ch01_b3',
  name: '汜水关',
  cols: 10,
  rows: 8,
  tiles: [
    // c: 0          1          2         3         4        5         6         7         8          9
    ['mountain','mountain','mountain','gate',   'gate',  'gate',   'gate',   'mountain','mountain','mountain'], // r0  汜水关·关门(c3..c6)
    ['grass',   'grass',   'road',    'road',   'road',  'road',   'road',   'road',   'grass',   'grass'    ], // r1  关前横道
    ['grass',   'grass',   'road',    'grass',  'grass', 'grass',  'grass',  'road',   'grass',   'grass'    ], // r2  敌方布阵区
    ['grass',   'water',   'road',    'water',  'water', 'water',  'water',  'road',   'water',   'grass'    ], // r3  壕沟(c2/c7 为桥)
    ['forest',  'forest',  'forest',  'grass',  'road',  'road',   'grass',  'grass',  'grass',   'grass'    ], // r4
    ['forest',  'forest',  'grass',   'grass',  'road',  'road',   'grass',  'grass',  'grass',   'grass'    ], // r5
    ['forest',  'grass',   'grass',   'road',   'road',  'grass',  'grass',  'grass',  'hill',    'grass'    ], // r6  我方部署区 / hill(c8) 射点
    ['grass',   'grass',   'road',    'road',   'grass', 'grass',  'grass',  'grass',  'grass',   'mountain' ]  // r7  曹军一侧
  ],
  // 我方部署：曹军侧翼,自南缘主路与两侧分进,准备分扑左右两桥仰攻关门。
  deploy: [
    { generalId: 'caocao',     c: 4, r: 6 }, // 主将曹操居中(road)
    { generalId: 'xiahoudun',  c: 3, r: 6 }, // 步兵元让前压左路(road)
    { generalId: 'caoren',     c: 2, r: 7 }, // 枪兵子孝走西桥一路(road)
    { generalId: 'caohong',    c: 6, r: 6 }, // 骑兵子廉趋东路机动(grass)
    { generalId: 'xiahouyuan', c: 8, r: 6 }  // 弓手妙才据东南土丘射点(hill, c8r6)
  ],
  // 敌方：华雄督西凉精兵守汜水关,依关门与关前横道立阵。
  enemies: [
    { generalId: 'huaxiong',  c: 4, r: 1, ai: 'cautious' }, // 守将华雄,坐镇关门正前(road)
    { generalId: 'lx_spear',  c: 2, r: 1, ai: 'cautious' }, // 西凉枪兵扼西桥关口(road)
    { generalId: 'lx_spear',  c: 7, r: 1, ai: 'cautious' }, // 西凉枪兵扼东桥关口(road)
    { generalId: 'lx_archer', c: 4, r: 0, ai: 'cautious' }, // 西凉弓手据关门居高(gate)
    { generalId: 'lx_inf',    c: 2, r: 2, ai: 'reckless'  }, // 西凉步卒守西阵(road)
    { generalId: 'lx_inf',    c: 7, r: 2, ai: 'reckless'  }, // 西凉步卒守东阵(road)
    { generalId: 'lx_cav',    c: 5, r: 2, ai: 'reckless'  }  // 西凉骑兵居中策应(grass)
  ],
  // 目标：曹军侧翼破关——任一存活我军登上关门(gate)即夺关告捷。
  victory: { type: 'capture' },
  defeat:  { type: 'leaderDead', generalId: 'caocao' },
  introScenario: 'ch01_b3_intro',
  outroScenario: 'ch01_b3_outro'
};

export default MAP;
