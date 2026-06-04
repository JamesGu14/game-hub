// data/skills.js — 计略库（纯数据，不触碰 DOM/Three.js）
//
// 契约（plan §1.1，冻结）：
//   export const SKILLS = { [id]: SkillDef }
//   SkillDef {
//     id, name,
//     kind:'damage'|'heal'|'buff'|'debuff'|'control', // 引擎按 kind 分派结算
//     target:'enemy'|'ally'|'self'|'tile',
//     range:[min,max],   // 施法距离（曼哈顿）。range:[0,0] 表示仅自身
//     area:0,            // AOE 半径（0=单体，1/2=以目标格为心的曼哈顿半径）
//     uses:3,            // 每场可用次数
//     power:0,           // 伤害/治疗基数（实现期按施法者 int 放缩）
//     hit:'always'|'intDiff', // intDiff: 命中=clamp(85+(caster.int-target.int),...)
//     element:null|'fire'|'thunder'|'water'|'dark',
//     status:null|{type,turns,magnitude},  // 命中后施加的状态（见 statuses.js）
//     learnableBy:[classId...],            // 哪些兵种可习得（与兵种自洽）
//   }
//
// 数值约定（实现期由 battle/skillEngine.js 解释，详见 plan §1.3）：
//   伤害：power × (1 + caster.int/常数) × element/相性 × rng抖动 − 目标 def 抗（int 相关）。
//   治疗：与伤害同理回血（kind:'heal'，target:'ally'）。
//   buff/debuff/control：命中后对目标 applyStatus(status)。
//
// 状态类型（status.type）：
//   poison（每回合 -magnitude HP）、confuse（本方回合可能无法行动）、
//   immobilize（不能移动，可原地攻/计）、
//   atk_up/atk_down/def_up/def_down/spd_up（数值乘改，持续 turns）。
//
// 兵种 id：infantry/spear/cavalry/archer/strategist/leader
// 进阶 id：guard_elite/spear_elite/cavalry_elite/crossbow/grand_strategist/lord
//   —— 计略主力为谋士(strategist)及其进阶(grand_strategist)，主将(leader/lord) 辅以治疗/增益。

// 计略主力兵种（伤害/控场/治疗皆可习）
const CASTER = ['strategist', 'grand_strategist'];
// 主将系（侧重治疗/增益）
const LEADER = ['leader', 'lord'];

export const SKILLS = {
  // ============================================================
  // 攻击系（damage）—— 命中 intDiff，伤害按 int 放缩
  // ============================================================
  fire: {
    id: 'fire',
    name: '火计',
    kind: 'damage',
    target: 'enemy',
    range: [1, 3],
    area: 1, // 以目标格为心，曼哈顿半径 1 的范围灼烧
    uses: 3,
    power: 14,
    hit: 'intDiff',
    element: 'fire',
    status: null,
    learnableBy: [...CASTER],
  },

  thunder: {
    id: 'thunder',
    name: '落雷',
    kind: 'damage',
    target: 'enemy',
    range: [1, 4], // 远射程的精准单体
    area: 0, // 单体
    uses: 2,
    power: 24, // 单体高伤
    hit: 'intDiff',
    element: 'thunder',
    status: null,
    learnableBy: [...CASTER],
  },

  flood: {
    id: 'flood',
    name: '水攻',
    kind: 'damage',
    target: 'enemy',
    range: [2, 4],
    area: 2, // 大范围 AOE（曼哈顿半径 2）
    uses: 2,
    power: 11, // 范围大、单体偏低
    hit: 'intDiff',
    element: 'water',
    status: null,
    learnableBy: [...CASTER],
  },

  darkmagic: {
    id: 'darkmagic',
    name: '妖术',
    kind: 'damage',
    target: 'enemy',
    range: [1, 3],
    area: 1,
    uses: 2,
    power: 12, // 伤害稍低，附带降攻
    hit: 'intDiff',
    element: 'dark',
    status: { type: 'atk_down', turns: 2, magnitude: 0.25 }, // 命中者攻击 ×0.75
    learnableBy: [...CASTER],
  },

  poison: {
    id: 'poison',
    name: '毒雾',
    kind: 'damage',
    target: 'enemy',
    range: [1, 3],
    area: 1,
    uses: 2,
    power: 6, // 直伤低，靠持续中毒
    hit: 'intDiff',
    element: null,
    status: { type: 'poison', turns: 3, magnitude: 5 }, // 每回合 -5 HP，持续 3 回合
    learnableBy: [...CASTER],
  },

  // ============================================================
  // 治疗/增益系（heal / buff）—— 对友军，命中 always
  // ============================================================
  heal: {
    id: 'heal',
    name: '治疗',
    kind: 'heal',
    target: 'ally',
    range: [1, 2],
    area: 0, // 单体
    uses: 3,
    power: 16,
    hit: 'always',
    element: null,
    status: null,
    learnableBy: [...CASTER, ...LEADER],
  },

  healwave: {
    id: 'healwave',
    name: '群疗',
    kind: 'heal',
    target: 'ally',
    range: [0, 2],
    area: 1, // 范围回血
    uses: 2,
    power: 11,
    hit: 'always',
    element: null,
    status: null,
    learnableBy: [...CASTER, ...LEADER],
  },

  inspire: {
    id: 'inspire',
    name: '鼓舞',
    kind: 'buff',
    target: 'ally',
    range: [0, 2],
    area: 1, // 范围增攻
    uses: 2,
    power: 0,
    hit: 'always',
    element: null,
    status: { type: 'atk_up', turns: 3, magnitude: 0.3 }, // 攻击 ×1.3
    learnableBy: [...CASTER, ...LEADER],
  },

  ironwall: {
    id: 'ironwall',
    name: '铁壁',
    kind: 'buff',
    target: 'ally', // 含自身（target='ally' 允许选自己）
    range: [0, 2],
    area: 0,
    uses: 3,
    power: 0,
    hit: 'always',
    element: null,
    status: { type: 'def_up', turns: 3, magnitude: 0.4 }, // 防御 ×1.4
    learnableBy: [...CASTER, ...LEADER],
  },

  haste: {
    id: 'haste',
    name: '疾风',
    kind: 'buff',
    target: 'ally',
    range: [0, 2],
    area: 0,
    uses: 2,
    power: 0,
    hit: 'always',
    element: null,
    status: { type: 'spd_up', turns: 3, magnitude: 0.3 }, // 速度 ×1.3（实现期一并提升移动力）
    learnableBy: [...CASTER, ...LEADER],
  },

  // ============================================================
  // 妨碍/控场系（debuff / control）—— 对敌，命中 intDiff
  // ============================================================
  confuse: {
    id: 'confuse',
    name: '乱心',
    kind: 'control',
    target: 'enemy',
    range: [1, 3],
    area: 1,
    uses: 2,
    power: 0,
    hit: 'intDiff',
    element: null,
    status: { type: 'confuse', turns: 2, magnitude: 0 }, // 本方回合可能无法行动
    learnableBy: [...CASTER],
  },

  root: {
    id: 'root',
    name: '定身',
    kind: 'control',
    target: 'enemy',
    range: [1, 3],
    area: 0, // 单体
    uses: 3,
    power: 0,
    hit: 'intDiff',
    element: null,
    status: { type: 'immobilize', turns: 2, magnitude: 0 }, // 不能移动，可原地攻/计
    learnableBy: [...CASTER],
  },

  weaken: {
    id: 'weaken',
    name: '弱体',
    kind: 'debuff',
    target: 'enemy',
    range: [1, 3],
    area: 1,
    uses: 2,
    power: 0,
    hit: 'intDiff',
    element: null,
    status: { type: 'def_down', turns: 3, magnitude: 0.3 }, // 防御 ×0.7
    learnableBy: [...CASTER],
  },

  // ============================================================
  // 保留：防御（self）—— 本回合提升自身防御（实现期由 ironwall 风格的临时 def_up 应用）
  // ============================================================
  guard: {
    id: 'guard',
    name: '防御',
    kind: 'buff',
    target: 'self',
    range: [0, 0],
    area: 0,
    uses: 99,
    power: 0,
    hit: 'always',
    element: null,
    // 本回合（1 回合）提升自身防御 ×1.5
    status: { type: 'def_up', turns: 1, magnitude: 0.5 },
    learnableBy: ['infantry', 'spear', 'cavalry', 'archer', 'strategist', 'leader',
      'guard_elite', 'spear_elite', 'cavalry_elite', 'crossbow', 'grand_strategist', 'lord'],
  },
};
