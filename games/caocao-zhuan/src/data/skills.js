// data/skills.js — 计略定义（纯数据，不触碰 DOM/Three.js）
//
// 契约（plan §1.4）：v1 仅需 heal / fire / guard 三个，证明计略系统；引擎按 kind 分派。
//   export const SKILLS = { [id]: SkillDef }
//   SkillDef {
//     id, name,
//     kind:'support'|'magic'|'self',  // 引擎按 kind 分派结算逻辑
//     target:'ally'|'enemy'|'self',
//     range,                          // 施放距离（曼哈顿，0=仅自身）
//     area,                           // 影响半径（0=单体）
//     uses,                           // 每场可用次数
//     power,                          // 基础威力
//     element?,                       // 法术属性（如 fire）
//     formula?,                       // 数值公式标识，供 combat 分派
//     hit?,                           // 命中判定标识
//     buff?,                          // self 类增益描述
//   }
//
// 数值公式（实现期由 battle/combat.js 解释）：
//   heal  formula:'fixedPlusInt' → 回复量 = power + 施法者 int 的一部分。
//   fire  hit:'intDiff'          → 命中受双方 int 差影响；伤害走火属性（element:'fire'），AOE area:1。
//   guard kind:'self'            → 本回合提升自身防御（buff.def），不消耗目标。

export const SKILLS = {
  heal: {
    id: 'heal',
    name: '治疗',
    kind: 'support',
    target: 'ally',
    range: 1,
    area: 0,
    uses: 3,
    power: 12,
    formula: 'fixedPlusInt',
  },

  fire: {
    id: 'fire',
    name: '火计',
    kind: 'magic',
    element: 'fire',
    target: 'enemy',
    range: 2,
    area: 1,
    uses: 3,
    power: 14,
    hit: 'intDiff',
  },

  guard: {
    id: 'guard',
    name: '防御',
    kind: 'self',
    target: 'self',
    range: 0,
    area: 0,
    uses: 99,
    power: 0,
    // 本回合提升防御：守方有效防御 +50%（实现期由 combat 应用）
    buff: { def: 0.5, turns: 1 },
  },
};
