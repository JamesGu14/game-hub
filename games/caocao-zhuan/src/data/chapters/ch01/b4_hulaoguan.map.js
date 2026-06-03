// 第四战 · 虎牢关（三英战吕布）  (Task B4 — battle map)
// 12 列 × 9 行等距战场。terrainId 取自 data/terrain.js：
//   grass 草 / road 路 / forest 林 / hill 丘 / mountain 山 / water 水(不可通行) / gate 关门
//
// 布局意图（关隘攻坚 + 单挑舞台）：
//   · 北侧(r0)一线 mountain 关墙，正中 (c5/c6,r0) 双 gate 即虎牢关门——攻坚/夺取落点；
//   · 关前 (c5,r1) 一片开阔 road 校场，吕布在此当关、跃马挑诸侯——三英战吕布的演武台；
//   · 中部 (c2..c4 / c7..c9) 两翼 forest 林带，西凉伏兵据林；东侧一道 water 涧带，仅 (c9,r4) road 桥可渡；
//   · 南侧(r7/r8)我方与客将列阵：曹军主力居中偏西，刘关张三英居中偏东直面关门。
// 所有我方部署格与敌方布阵格均落在可通行地形上（非水）。
//
// 坐标约定：c = 列(0..11)，r = 行(0..8)；tiles[r][c]。
// 行 0 (北/上) ←虎牢关一侧；行 8 (南/下) ←联军一侧。

export const MAP = {
  id: 'ch01_b4',
  name: '虎牢关',
  cols: 12,
  rows: 9,
  tiles: [
    // c: 0          1          2         3         4         5        6        7         8         9        10         11
    ['mountain','mountain','mountain','grass',   'road',   'gate',  'gate',  'road',   'grass',  'mountain','mountain','mountain'], // r0  关墙·虎牢关门(c5/c6)
    ['mountain','grass',   'grass',   'grass',   'road',   'road',  'road',  'road',   'grass',  'grass',   'grass',   'mountain'], // r1  关前校场(吕布当关)
    ['grass',   'grass',   'forest',  'forest',  'grass',  'road',  'road',  'grass',  'forest', 'forest',  'grass',   'grass'   ], // r2  两翼林带(西凉伏兵)
    ['grass',   'forest',  'forest',  'grass',   'grass',  'road',  'road',  'grass',  'grass',  'forest',  'forest',  'grass'   ], // r3
    ['grass',   'grass',   'grass',   'road',    'road',   'road',  'road',  'road',   'road',   'road',    'water',   'grass'   ], // r4  横向干道·东(c10)涧
    ['grass',   'grass',   'road',    'road',    'grass',  'grass', 'grass', 'grass',  'road',   'road',    'water',   'grass'   ], // r5
    ['grass',   'hill',    'road',    'grass',   'grass',  'grass', 'grass', 'grass',  'grass',  'road',    'forest',  'grass'   ], // r6  hill(c1)弓手高地
    ['hill',    'road',    'grass',   'grass',   'grass',  'road',  'road',  'grass',  'grass',  'grass',   'grass',   'grass'   ], // r7  曹军主力部署区
    ['grass',   'grass',   'grass',   'grass',   'road',   'road',  'road',  'road',   'grass',  'grass',   'grass',   'grass'   ]  // r8  客将三英列阵
  ],
  // 我方部署：曹军主力(西/中) + 刘关张三英客将(中/东，直面关门)。三英 faction 'wei' 仅本战。
  deploy: [
    // —— 曹军主力 ——
    { generalId: 'caocao',     c: 2, r: 7 }, // 主将曹操，居中后侧（grass）
    { generalId: 'xiahoudun',  c: 1, r: 7 }, // 步兵元让前压（road）
    { generalId: 'caoren',     c: 3, r: 7 }, // 枪兵子孝护翼（grass）
    { generalId: 'caohong',    c: 2, r: 6 }, // 骑兵子廉机动（road）
    { generalId: 'xiahouyuan', c: 1, r: 6 }, // 弓手妙才据 hill 高地（hill, c1r6）
    { generalId: 'dianwei',    c: 0, r: 7 }, // 猛士典韦护主（hill, c0r7）
    // —— 客将 · 三英（仅本战玩家可控，居中偏东，正对关门）——
    { generalId: 'liubei',     c: 6, r: 8 }, // 玄德居中（road）
    { generalId: 'guanyu',     c: 7, r: 8 }, // 云长右翼（road）
    { generalId: 'zhangfei',   c: 5, r: 8 }  // 翼德左翼（road）
  ],
  // 敌方：吕布当关(关前校场)，西凉兵据关墙、林带与关门。
  enemies: [
    { generalId: 'lubu',      c: 6, r: 1, ai: 'reckless'  }, // 吕布跃马当关(road, 关前校场)——boss
    { generalId: 'lx_cav',    c: 4, r: 1, ai: 'reckless'  }, // 西凉骑卫(road)
    { generalId: 'lx_cav',    c: 7, r: 1, ai: 'reckless'  }, // 西凉骑卫(road)
    { generalId: 'lx_archer', c: 5, r: 0, ai: 'cautious'  }, // 弓手据关门(gate, c5r0)
    { generalId: 'lx_archer', c: 6, r: 0, ai: 'cautious'  }, // 弓手据关门(gate, c6r0)
    { generalId: 'lx_spear',  c: 2, r: 2, ai: 'cautious'  }, // 枪兵伏西林(forest)
    { generalId: 'lx_spear',  c: 9, r: 2, ai: 'cautious'  }, // 枪兵伏东林(forest)
    { generalId: 'lx_inf',    c: 3, r: 3, ai: 'reckless'  }, // 步卒挡西路(grass)
    { generalId: 'lx_inf',    c: 8, r: 3, ai: 'reckless'  }  // 步卒挡东路(grass)
  ],
  // 目标：斩吕布(defeatLeader) —— 三英战吕布将其武力耗尽即可破关。
  // 备用「击退」基调由剧情 flag(ch01_b4_lubu_routed) 表达，集成层据此撤走吕布。
  victory: { type: 'defeatLeader', generalId: 'lubu' },
  defeat:  { type: 'leaderDead', generalId: 'caocao' },
  introScenario: 'ch01_b4_intro',
  outroScenario: 'ch01_b4_outro',
  // 触发器（与 story.triggers 同步；引擎读 map.triggers 的 on:'turnStart'）：
  //   第 3 回合「三英战吕布」单挑序列启动（张飞→关羽→刘备 依次车轮战）。
  // reachTile/hpBelow 为可选元数据，便于集成层改用「贴近吕布」或「吕布残血」触发；
  // 引擎当前仅原生识别 turnStart，故主触发用 turnStart 保证可靠。
  triggers: [
    {
      on: 'turnStart',
      turn: 3,
      scenarioId: 'ch01_b4_three_heroes',
      // —— 可选替代触发条件（集成层可改用，引擎默认忽略）——
      reachTile: { generalId: 'zhangfei', near: { c: 6, r: 1 }, within: 2 },
      hpBelow: { generalId: 'lubu', ratio: 0.92 }
    }
  ]
};

export default MAP;
