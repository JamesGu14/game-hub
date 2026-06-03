// data/terrain.js — 地形定义（纯数据，不触碰 DOM/Three.js）
//
// 契约（plan §1.3）：
//   export const TERRAIN = { [id]: TerrainDef }
//   TerrainDef {
//     id, name,
//     moveCost:{ foot, horse },   // 进入该格的移动消耗，按 unit 兵种 moveType 取值
//     defBonus,                   // 守方有效防御加成
//     avoidBonus,                 // 回避加成（百分点，命中判定时扣减）
//     passable:bool,              // 是否可进入
//     capture?:bool               // 据点（gate）可被占领
//   }
//
// 地形 id：grass 草 / road 路 / forest 林 / hill 丘 / mountain 山 / water 水 / gate 关门
//
// 说明：
//   - water passable:false，任何兵种不可进入（寻路阻挡）。
//   - mountain horse 消耗 99（实际上骑兵进不去，靠 mov 上限拦住）。
//   - gate 关门：高防 + capture:true，是占领类胜负目标的落点。

export const TERRAIN = {
  grass: {
    id: 'grass',
    name: '草地',
    moveCost: { foot: 1, horse: 1 },
    defBonus: 0,
    avoidBonus: 0,
    passable: true,
  },

  road: {
    id: 'road',
    name: '道路',
    moveCost: { foot: 1, horse: 1 },
    defBonus: 0,
    avoidBonus: 0,
    passable: true,
  },

  forest: {
    id: 'forest',
    name: '森林',
    moveCost: { foot: 1, horse: 2 },
    defBonus: 2,
    avoidBonus: 15,
    passable: true,
  },

  hill: {
    id: 'hill',
    name: '丘陵',
    moveCost: { foot: 2, horse: 3 },
    defBonus: 2,
    avoidBonus: 0,
    passable: true,
  },

  mountain: {
    id: 'mountain',
    name: '山地',
    moveCost: { foot: 3, horse: 99 },
    defBonus: 3,
    avoidBonus: 0,
    passable: true,
  },

  water: {
    id: 'water',
    name: '水域',
    moveCost: { foot: 99, horse: 99 },
    defBonus: 0,
    avoidBonus: 0,
    passable: false,
  },

  gate: {
    id: 'gate',
    name: '关门',
    moveCost: { foot: 1, horse: 1 },
    defBonus: 3,
    avoidBonus: 0,
    passable: true,
    capture: true,
  },
};
