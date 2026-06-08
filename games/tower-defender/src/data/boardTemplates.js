// data/boardTemplates.js — 板型池（检查点A·§5.2）。几何 + slots 种子自现 8 关布局（均已过 verify）。
// 每套：{ cols, rows, castle, camps, paths, slots }。camp.id === path key。
// levels.js 展开时按 pathSubset 取路子集，slots 用全量（覆盖 superset ⊇ subset，verify 必过）。
// 铁律：render-free、纯数据、无随机。

// —— 2 营（种子 L1 南蛮）——
const twoCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [{ id: 'a', c: 1, r: 2 }, { id: 'b', c: 22, r: 11 }],
  paths: {
    a: [{ x: 1, y: 2 }, { x: 1, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 9 }, { x: 4, y: 9 }, { x: 4, y: 11 }, { x: 11, y: 11 }, { x: 11, y: 7 }],
    b: [{ x: 22, y: 11 }, { x: 22, y: 8 }, { x: 15, y: 8 }, { x: 15, y: 4 }, { x: 19, y: 4 }, { x: 19, y: 2 }, { x: 12, y: 2 }, { x: 12, y: 6 }],
  },
  slots: [{ x: 6, y: 10 }, { x: 17, y: 3 }, { x: 10, y: 9 }, { x: 13, y: 4 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 6, y: 6 }, { x: 20, y: 9 }, { x: 9, y: 9 }, { x: 14, y: 4 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 9, y: 10 }, { x: 14, y: 3 }],
};

// —— 3 营（种子 L3 南蛮：2 营 + 顶部 c 路）——
const threeCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...twoCamp.camps, { id: 'c', c: 13, r: 0 }],
  paths: { ...twoCamp.paths, c: [{ x: 13, y: 0 }, { x: 13, y: 3 }, { x: 9, y: 3 }, { x: 9, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 9, y: 4 }, { x: 9, y: 6 }, { x: 11, y: 6 }] },
  slots: [{ x: 8, y: 3 }, { x: 13, y: 4 }, { x: 6, y: 10 }, { x: 17, y: 3 }, { x: 9, y: 8 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 20, y: 9 }, { x: 9, y: 10 }, { x: 5, y: 3 }, { x: 9, y: 7 }, { x: 11, y: 0 }, { x: 7, y: 3 }, { x: 10, y: 4 }, { x: 11, y: 4 }, { x: 10, y: 5 }, { x: 14, y: 3 }, { x: 11, y: 2 }, { x: 14, y: 4 }, { x: 8, y: 2 }, { x: 7, y: 6 }],
};

// —— 4 营（种子 L4 东吴：3 营 + 底中 d 路）——
const fourCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...threeCamp.camps, { id: 'd', c: 11, r: 13 }],
  paths: { ...threeCamp.paths, d: [{ x: 11, y: 13 }, { x: 16, y: 13 }, { x: 16, y: 9 }, { x: 12, y: 9 }, { x: 12, y: 7 }] },
  slots: [{ x: 8, y: 3 }, { x: 13, y: 4 }, { x: 10, y: 9 }, { x: 6, y: 10 }, { x: 15, y: 11 }, { x: 17, y: 3 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 10, y: 7 }, { x: 20, y: 9 }, { x: 5, y: 3 }, { x: 12, y: 11 }, { x: 11, y: 0 }, { x: 7, y: 3 }, { x: 10, y: 4 }, { x: 11, y: 4 }, { x: 10, y: 5 }, { x: 14, y: 3 }, { x: 11, y: 2 }, { x: 14, y: 4 }, { x: 8, y: 2 }, { x: 11, y: 5 }, { x: 7, y: 6 }],
};

// —— 5 营（种子 L5 东吴：4 营 + 右上 e 路）——
const fiveCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...fourCamp.camps, { id: 'e', c: 22, r: 1 }],
  paths: { ...fourCamp.paths, e: [{ x: 22, y: 1 }, { x: 18, y: 1 }, { x: 18, y: 6 }, { x: 12, y: 6 }] },
  slots: [{ x: 8, y: 3 }, { x: 13, y: 4 }, { x: 17, y: 3 }, { x: 10, y: 9 }, { x: 16, y: 7 }, { x: 6, y: 10 }, { x: 14, y: 11 }, { x: 3, y: 4 }, { x: 20, y: 9 }, { x: 10, y: 7 }, { x: 19, y: 0 }, { x: 5, y: 3 }, { x: 14, y: 12 }, { x: 11, y: 0 }, { x: 11, y: 4 }, { x: 14, y: 4 }, { x: 7, y: 3 }, { x: 10, y: 4 }, { x: 10, y: 5 }, { x: 13, y: 7 }, { x: 14, y: 7 }, { x: 14, y: 8 }, { x: 11, y: 5 }, { x: 13, y: 8 }],
};

// —— 6 营（种子 L6 曹魏：5 营 + 左下 f 路）——
const sixCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...fiveCamp.camps, { id: 'f', c: 1, r: 13 }],
  paths: { ...fiveCamp.paths, f: [{ x: 1, y: 13 }, { x: 4, y: 13 }, { x: 4, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 11 }, { x: 11, y: 11 }, { x: 11, y: 7 }] },
  slots: [{ x: 10, y: 9 }, { x: 6, y: 10 }, { x: 8, y: 3 }, { x: 13, y: 4 }, { x: 17, y: 3 }, { x: 16, y: 7 }, { x: 14, y: 11 }, { x: 3, y: 4 }, { x: 20, y: 9 }, { x: 10, y: 7 }, { x: 2, y: 12 }, { x: 19, y: 0 }, { x: 4, y: 6 }, { x: 14, y: 12 }, { x: 4, y: 0 }, { x: 11, y: 0 }, { x: 9, y: 9 }, { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 8 }, { x: 9, y: 8 }, { x: 13, y: 7 }, { x: 13, y: 8 }, { x: 9, y: 7 }, { x: 11, y: 4 }, { x: 14, y: 4 }, { x: 7, y: 3 }, { x: 7, y: 10 }],
};

// —— 8 营（种子 L8 曹魏决战：7 营 + 右中 g、上中 h 路）——
const eightCamp = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...sixCamp.camps, { id: 'g', c: 23, r: 7 }, { id: 'h', c: 8, r: 0 }],
  paths: {
    ...sixCamp.paths,
    g: [{ x: 23, y: 7 }, { x: 20, y: 7 }, { x: 20, y: 11 }, { x: 16, y: 11 }, { x: 16, y: 7 }, { x: 12, y: 7 }],
    h: [{ x: 8, y: 0 }, { x: 8, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 6 }, { x: 8, y: 6 }, { x: 11, y: 6 }],
  },
  // 种子 L8 精确 29 点（L8 已 ship 且过 verify，覆盖 a–h 全 8 路；**勿手加冗余点**，易落路上触发 verify 错误）
  slots: [{ x: 10, y: 9 }, { x: 7, y: 3 }, { x: 14, y: 8 }, { x: 6, y: 10 }, { x: 17, y: 3 }, { x: 11, y: 4 }, { x: 18, y: 10 }, { x: 3, y: 4 }, { x: 21, y: 9 }, { x: 7, y: 7 }, { x: 14, y: 12 }, { x: 16, y: 5 }, { x: 2, y: 12 }, { x: 11, y: 2 }, { x: 19, y: 0 }, { x: 2, y: 7 }, { x: 13, y: 4 }, { x: 6, y: 7 }, { x: 9, y: 7 }, { x: 9, y: 9 }, { x: 10, y: 8 }, { x: 8, y: 3 }, { x: 9, y: 8 }, { x: 10, y: 7 }, { x: 13, y: 8 }, { x: 9, y: 10 }, { x: 10, y: 5 }, { x: 10, y: 4 }, { x: 10, y: 10 }],
};

export const TEMPLATES = { twoCamp, threeCamp, fourCamp, fiveCamp, sixCamp, eightCamp };
