// 第一战 · 陈留起兵  (Task A4 — battle map)
// 10 列 × 8 行等距战场。terrainId 取自 data/terrain.js：
//   grass 草 / road 路 / forest 林 / hill 丘 / mountain 山 / water 水(不可通行) / gate 关门
//
// 布局意图（可读战场）：
//   · 一条自西南向东北的 road 主路，串起我方与敌方阵地；
//   · 西侧一片 forest 林（回避/防御），南侧一座 hill 丘（弓手高地射点）；
//   · 中部一条南北向 water 河带（不可通行），仅在 (c=4) 留一处 road 渡口可过河；
//   · 敌方阵地东北角设一座 gate 关门（守军据点，可夺取）。
// 所有我方部署格与敌方布阵格均落在可通行地形上（非水）。
//
// 坐标约定：c = 列(0..9)，r = 行(0..7)；tiles[r][c]。

// 行 0 (北/上) ←敌方一侧；行 7 (南/下) ←我方一侧
export const MAP = {
  id: 'ch01_b1',
  name: '陈留起兵',
  cols: 10,
  rows: 8,
  tiles: [
    // c: 0        1         2         3         4        5         6         7         8         9
    ['mountain','grass',   'grass',  'road',   'road',  'grass',  'grass',  'gate',   'grass',  'mountain'], // r0  关门据点
    ['grass',   'grass',   'forest', 'grass',  'road',  'water',  'grass',  'grass',  'grass',  'grass'   ], // r1
    ['grass',   'forest',  'forest', 'grass',  'road',  'water',  'water',  'grass',  'road',   'grass'   ], // r2  敌方布阵区
    ['grass',   'forest',  'grass',  'grass',  'road',  'water',  'grass',  'road',   'road',   'grass'   ], // r3
    ['grass',   'grass',   'grass',  'road',   'road',  'road',   'road',   'road',   'grass',  'grass'   ], // r4  渡口(c4)在此过河
    ['grass',   'grass',   'road',   'road',   'water', 'grass',  'grass',  'grass',  'grass',  'grass'   ], // r5
    ['grass',   'road',    'road',   'grass',  'water', 'grass',  'forest', 'grass',  'grass',  'mountain'], // r6  我方部署区
    ['hill',    'road',    'grass',  'grass',  'grass', 'grass',  'forest', 'grass',  'grass',  'grass'   ]  // r7  hill(c0) 弓手高地
  ],
  // 我方部署：陈留起兵的曹氏宗族军，列于西南一隅，沿主路待发。
  deploy: [
    { generalId: 'caocao',     c: 1, r: 6 }, // 主将曹操，居中后侧（road）
    { generalId: 'xiahoudun',  c: 2, r: 6 }, // 步兵元让前压（road）
    { generalId: 'caoren',     c: 1, r: 7 }, // 枪兵子孝护翼（road）
    { generalId: 'caohong',    c: 2, r: 7 }, // 骑兵子廉机动（grass）
    { generalId: 'xiahouyuan', c: 0, r: 7 }  // 弓手妙才据 hill 高地（hill, c0r7）
  ],
  // 敌方：黄巾残党，盘踞东北，依关门(gate)与林地立寨。
  enemies: [
    { generalId: 'yt_capt',   c: 7, r: 0, ai: 'cautious' }, // 渠帅守关门(gate, c7r0)
    { generalId: 'yt_archer', c: 6, r: 1, ai: 'cautious' }, // 弓手据关前(grass)
    { generalId: 'yt_spear',  c: 2, r: 2, ai: 'reckless'  }, // 枪兵伏于西林(forest)
    { generalId: 'yt_inf1',   c: 7, r: 2, ai: 'reckless'  }, // 力士当道(grass)
    { generalId: 'yt_inf2',   c: 8, r: 3, ai: 'reckless'  }  // 力士护寨(road)
  ],
  victory: { type: 'rout' },
  defeat:  { type: 'leaderDead', generalId: 'caocao' },
  introScenario: 'ch01_b1_intro',
  outroScenario: 'ch01_b1_outro'
};

export default MAP;
