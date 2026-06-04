// 第二战 · 会盟酸枣  (Task B2 — battle map)
// 12 列 × 9 行等距战场。terrainId 取自 data/terrain.js：
//   grass 草 / road 路 / forest 林 / hill 丘 / mountain 山 / water 水(不可通行) / gate 关门
//
// 布局意图（可读战场，教学：计略/谋士 + 林/丘地形）：
//   · 南侧（r6–r8）是酸枣联军大营，曹军先锋自此沿一条南北向 road 主路北上；
//   · 中部一片 forest 林（西侧 c1–c3）供谋士/弓手伏射与回避；
//   · 东侧一座 hill 丘高地（c9–c10, r3–r4）作弓手射点与争夺要点；
//   · 北方（r0–r2）一条东西向 water 汴水带阻隔（不可通行），仅 c5 / c8 两处 road 浅滩可渡，
//     董卓军先锋据浅滩列阵迎击；
//   · 西北与东北两角各一座 mountain 山，封死侧翼、收束战线。
// 所有我方部署格与敌方布阵格均落在可通行地形上（非水）。
//
// 坐标约定：c = 列(0..11)，r = 行(0..8)；tiles[r][c]。
// 行 0 (北/上) ←董卓军一侧；行 8 (南/下) ←联军大营一侧。

export const MAP = {
  id: 'ch01_b2',
  name: '会盟酸枣',
  cols: 12,
  rows: 9,
  tiles: [
    // c: 0          1         2         3         4         5        6         7         8        9         10        11
    ['mountain', 'water',   'water',   'grass',  'grass',  'road',  'grass',  'grass',  'road',  'grass',  'water',   'mountain'], // r0  汴水浅滩(c5/c8 road)
    ['grass',    'water',   'water',   'grass',  'road',   'road',  'grass',  'grass',  'road',  'grass',  'grass',   'grass'   ], // r1  董卓军先锋布阵区
    ['grass',    'forest',  'grass',   'grass',  'road',   'grass', 'grass',  'forest', 'road',  'grass',  'grass',   'grass'   ], // r2
    ['grass',    'forest',  'forest',  'grass',  'road',   'grass', 'grass',  'forest', 'road',  'grass',  'hill',    'grass'   ], // r3  东侧 hill 高地
    ['grass',    'forest',  'grass',   'grass',  'road',   'road',  'road',   'road',   'road',  'grass',  'hill',    'grass'   ], // r4  东西横向主路交汇
    ['grass',    'grass',   'grass',   'road',   'road',   'grass', 'grass',  'grass',  'road',  'grass',  'grass',   'grass'   ], // r5
    ['grass',    'grass',   'road',    'road',   'grass',  'grass', 'forest', 'grass',  'road',  'grass',  'grass',   'grass'   ], // r6  联军前哨/曹军部署区
    ['grass',    'road',    'road',    'grass',  'grass',  'grass', 'forest', 'grass',  'road',  'grass',  'grass',   'grass'   ], // r7  曹军部署区
    ['mountain', 'road',    'grass',   'grass',  'grass',  'grass', 'grass',  'grass',  'road',  'grass',  'grass',   'mountain']  // r8  酸枣大营
  ],
  // 我方部署：曹操率宗族军先锋北上探敌；谋士荀彧、戏志才本战剧情登场（列于阵后参赞军机）。
  deploy: [
    { generalId: 'caocao',     c: 4, r: 7 }, // 主将曹操居中（road 主路）
    { generalId: 'xiahoudun',  c: 3, r: 7 }, // 步兵元让前压（grass）
    { generalId: 'caoren',     c: 8, r: 7 }, // 枪兵子孝护东翼主路（road）
    { generalId: 'caohong',    c: 2, r: 7 }, // 骑兵子廉据西路待机（road）
    { generalId: 'xiahouyuan', c: 1, r: 7 }, // 弓手妙才据西林（road，邻 forest）
    { generalId: 'xunyu',      c: 4, r: 8 }, // 谋士文若参赞中军（grass）
    { generalId: 'xizhicai',   c: 8, r: 8 }  // 谋主志才随东路（road）
  ],
  // 敌方：董卓军先锋据汴水浅滩与北岸列阵，西凉步骑弓杂处，倚林伏击。
  enemies: [
    { generalId: 'dz_van',    c: 5, r: 0, ai: 'cautious' }, // 先锋主将守 c5 浅滩(road)
    { generalId: 'lx_spear',  c: 8, r: 1, ai: 'cautious' }, // 枪兵护 c8 浅滩(road)
    { generalId: 'lx_archer', c: 4, r: 1, ai: 'cautious' }, // 弓手据北岸主路(road)
    { generalId: 'lx_inf',    c: 7, r: 2, ai: 'reckless'  }, // 步卒伏于东林(forest)
    { generalId: 'lx_inf',    c: 1, r: 2, ai: 'reckless'  }, // 步卒伏于西林(forest)
    { generalId: 'lx_cav',    c: 8, r: 3, ai: 'reckless'  }, // 骑兵自东路主路扑出(road)
    { generalId: 'lx_archer', c: 10, r: 3, ai: 'cautious' }, // 弓手据东侧 hill 高地(hill)
    { generalId: 'lijru',     c: 9, r: 1, ai: 'strategist' } // 董卓谋士李儒,据北岸阵后参赞军机(grass)
  ],
  victory: { type: 'defeatLeader', generalId: 'dz_van' },
  defeat:  { type: 'leaderDead', generalId: 'caocao' },
  introScenario: 'ch01_b2_intro',
  outroScenario: 'ch01_b2_outro'
};

export default MAP;
