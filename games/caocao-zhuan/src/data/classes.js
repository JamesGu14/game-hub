// data/classes.js — 兵种定义（纯数据，不触碰 DOM/Three.js）
//
// 契约（plan §1.1）：
//   export const CLASSES = { [id]: ClassDef }
//   ClassDef {
//     id, name,
//     moveType:'foot'|'horse',
//     atkRange:[min,max], counterRange:[min,max],   // 曼哈顿距离，[min,max]
//     growth:{ hp, atk, def, int, spd },            // 每级增量基线（可被武将 growth 覆盖）
//     skills:[skillId...], promoteTo:[classId...]
//   }
//
// 兵种 id：infantry 步 / spear 枪 / cavalry 骑 / archer 弓 / strategist 谋士 / leader 主将
//
// 设计要点（与 §1 / §3.2 一致）：
//   - 步兵：均衡近战，标准移动与反击。
//   - 枪兵：克骑（相克在 battle/classTriangle.js），近战、可反击。
//   - 骑兵：horse 移动型（地形消耗不同）、机动高、近战。
//   - 弓兵：atkRange [2,2]，纯远程，counterRange 为空 [0,0] —— 不参与近战反击。
//   - 谋士：atkRange [1,2]，攻击/计略以 int 见长，低防（脆），是计略主力。
//   - 主将：曹操等核心，机动高（mov 高在 generals.base.mov），近战兼计略。

export const CLASSES = {
  infantry: {
    id: 'infantry',
    name: '步兵',
    moveType: 'foot',
    atkRange: [1, 1],
    counterRange: [1, 1],
    growth: { hp: 6, atk: 3, def: 2, int: 1, spd: 2 },
    skills: ['guard'],
    promoteTo: ['guard_elite'],
  },

  spear: {
    id: 'spear',
    name: '枪兵',
    moveType: 'foot',
    atkRange: [1, 1],
    counterRange: [1, 1],
    growth: { hp: 6, atk: 3, def: 3, int: 1, spd: 1 },
    skills: ['guard'],
    promoteTo: ['spear_elite'],
  },

  cavalry: {
    id: 'cavalry',
    name: '骑兵',
    moveType: 'horse',
    atkRange: [1, 1],
    counterRange: [1, 1],
    growth: { hp: 6, atk: 4, def: 2, int: 1, spd: 3 },
    skills: ['guard'],
    promoteTo: ['cavalry_elite'],
  },

  archer: {
    id: 'archer',
    name: '弓兵',
    moveType: 'foot',
    atkRange: [2, 2],
    // 纯远程，不参与近战反击（min>max 表示空区间，combat 视为无反击）
    counterRange: [0, 0],
    growth: { hp: 5, atk: 3, def: 1, int: 2, spd: 2 },
    skills: [],
    promoteTo: ['crossbow'],
  },

  strategist: {
    id: 'strategist',
    name: '谋士',
    moveType: 'foot',
    // 物理攻击与计略可达 1~2 格；以 int 见长
    atkRange: [1, 2],
    counterRange: [1, 1],
    growth: { hp: 4, atk: 1, def: 1, int: 4, spd: 2 },
    skills: ['fire', 'heal'],
    promoteTo: ['grand_strategist'],
  },

  leader: {
    id: 'leader',
    name: '主将',
    moveType: 'foot',
    atkRange: [1, 1],
    counterRange: [1, 1],
    growth: { hp: 7, atk: 3, def: 2, int: 3, spd: 2 },
    skills: ['heal'],
    promoteTo: ['lord'],
  },
};
