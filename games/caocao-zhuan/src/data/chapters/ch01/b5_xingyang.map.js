// 第五战 · 荥阳追击（章末转折）  (Task B5 — battle map)
// 10 列 × 8 行等距战场。terrainId 取自 data/terrain.js：
//   grass 草 / road 路 / forest 林 / hill 丘 / mountain 山 / water 水(不可通行) / gate 关门
//
// 基调（计划 §2 第5战）：董卓焚洛阳西遁，诸侯按兵不动，唯曹操孤军西进追击；
//   行至荥阳，徐荣早伏精兵于林莽丘陵之间——一场艰难的「虽败犹荣」之战。
//
// 布局意图（伏击地形）：
//   · 西半幅（r0..r2，敌方/洛阳方向）：一线汴水(water)横亘，仅 (c=4) 一处 road 焦土小道可西去；
//     两侧密林(forest)与丘陵(hill)正是徐荣伏兵藏身之所。
//   · 中部一条东西向 road 焦道，自我方阵地(东) 通向洛阳(西)，是孤军冒进之路。
//   · 东南角设一座 gate 关门——撤离点（退向酸枣联军的隘口）；曹军且战且退的归路。
//   · 我方初始部署于东侧(r6..r7)，沿焦道列阵；伏兵于回合触发后由两翼林丘杀出。
//
// 坐标约定：c = 列(0..9)，r = 行(0..7)；tiles[r][c]。
// 行 0 (西/上，洛阳方向) ←敌伏兵纵深；行 7 (东/下) ←我方与撤离隘口

export const MAP = {
  id: 'ch01_b5',
  name: '荥阳追击',
  cols: 10,
  rows: 8,
  tiles: [
    // c: 0          1         2         3         4        5         6         7         8         9
    ['mountain', 'forest', 'forest', 'hill',   'road',  'hill',   'forest', 'forest', 'mountain','mountain'], // r0  洛阳方向·伏兵纵深
    ['forest',   'forest', 'hill',   'grass',  'road',  'grass',  'hill',   'forest', 'forest',  'mountain'], // r1  两翼林丘伏击位
    ['water',    'water',  'grass',  'forest', 'road',  'forest', 'grass',  'water',  'water',   'grass'   ], // r2  汴水横亘·c4 焦道渡口
    ['grass',    'grass',  'forest', 'road',   'road',  'road',   'forest', 'grass',  'grass',   'grass'   ], // r3
    ['grass',    'hill',   'grass',  'road',   'road',  'road',   'grass',  'hill',   'grass',   'grass'   ], // r4  中部焦道(东西向)
    ['grass',    'grass',  'forest', 'road',   'grass', 'grass',  'forest', 'grass',  'grass',   'grass'   ], // r5
    ['grass',    'forest', 'grass',  'road',   'grass', 'grass',  'grass',  'grass',  'forest',  'grass'   ], // r6  我方部署区
    ['mountain', 'grass',  'grass',  'road',   'grass', 'grass',  'grass',  'grass',  'grass',   'gate'    ]  // r7  gate(c9r7) 东南撤离隘口
  ],
  // 我方部署：曹操孤军，沿焦道东侧列阵，本欲西追，却已入伏中。
  deploy: [
    { generalId: 'caocao',     c: 3, r: 7 }, // 主将曹操，居中（road）
    { generalId: 'xiahoudun',  c: 3, r: 6 }, // 步兵元让前锋当道（road）
    { generalId: 'dianwei',    c: 4, r: 6 }, // 猛士典韦贴身护主（grass）
    { generalId: 'caoren',     c: 2, r: 6 }, // 枪兵子孝护翼（grass）
    { generalId: 'caohong',    c: 4, r: 7 }, // 骑兵子廉机动断后（grass）
    { generalId: 'xiahouyuan', c: 5, r: 7 }  // 弓手妙才远程压制（grass）
  ],
  // 敌方：徐荣伏兵。boss 徐荣压阵焦道西口；西凉伏兵藏于两翼林丘，
  //   回合触发后(turnStart trigger)由旁白点出其杀出——AI cautious 善战、reckless 猛冲。
  enemies: [
    { generalId: 'xurong',    c: 4, r: 1, ai: 'cautious' }, // 徐荣据焦道西口(road) 设伏压阵
    { generalId: 'lx_archer', c: 3, r: 0, ai: 'cautious' }, // 弓手据丘高地俯射(hill)
    { generalId: 'lx_archer', c: 5, r: 0, ai: 'cautious' }, // 弓手据丘高地俯射(hill)
    { generalId: 'lx_spear',  c: 2, r: 1, ai: 'cautious' }, // 枪兵伏左翼林丘(hill)
    { generalId: 'lx_spear',  c: 6, r: 1, ai: 'cautious' }, // 枪兵伏右翼林丘(hill)
    { generalId: 'lx_inf',    c: 1, r: 1, ai: 'reckless'  }, // 步卒伏左翼密林(forest)
    { generalId: 'lx_inf',    c: 7, r: 1, ai: 'reckless'  }, // 步卒伏右翼密林(forest)
    { generalId: 'lx_inf',    c: 3, r: 3, ai: 'reckless'  }, // 步卒断渡口杀来(road)
    { generalId: 'lx_cav',    c: 1, r: 3, ai: 'reckless'  }, // 骑兵左翼包抄(grass)
    { generalId: 'lx_cav',    c: 7, r: 3, ai: 'reckless'  }  // 骑兵右翼包抄(grass)
  ],
  // 章末败战基调：坚持且战且退 6 回合即算「全师而退·虽败犹荣」（survive）。
  // 主将曹操若阵亡则败北（leaderDead）。撤离隘口 gate(c9r7) 为旁白所指归路。
  victory: { type: 'survive', turns: 6 },
  defeat:  { type: 'leaderDead', generalId: 'caocao' },
  introScenario: 'ch01_b5_intro',
  outroScenario: 'ch01_b5_outro',
  // 触发器：埋伏触发（回合 2 伏兵尽出）+ 悲壮护主（回合 4 中箭遇险）。
  // 引擎仅在 on:'turnStart' 且 turn 匹配时按 scenarioId 播放（battleController._fireTurnStartTriggers）。
  triggers: [
    { on: 'turnStart', turn: 2, scenarioId: 'ch01_b5_ambush' },
    { on: 'turnStart', turn: 4, scenarioId: 'ch01_b5_rescue' }
  ]
};

export default MAP;
