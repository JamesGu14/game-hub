// data/baseBoards.js — 10 张章主题手写基板(板型+地形 spec §3.1)。Task 4-8 逐章填充。
// 每板:{ id, chapter, half, cols:24, rows:14, castle:{c:11,r:6,w:2,h:2}, camps, paths, slotsVariants:[×3], terrain }
// terrain type ∈ plateau|river|shallow|mountain|rockfall|firegully;river/mountain=禁建+敌不走(设计期保证,verify 硬校验)。
// 铁律:render-free、纯数据、零随机;渡口/浮桥=路径格,river rects 在该列留缺口(无挖洞机制)。
export const BASE_BOARDS = {};
