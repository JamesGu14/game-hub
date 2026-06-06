// data/levels.js — 关卡定义。M1 仅 L1。
// 24×14 棋盘、成都 2×2 居中、2 敌营、两条长蛇形弯道(行程长，给塔更多输出窗口)。
// 坐标单位 = 格；path 首点 = 敌营、末点 = 成都格(敌到末点即到城)。
export const LEVELS = [
  {
    id: 1, name: '南征·序战', faction: 'nanman',
    cols: 24, rows: 14, scale: 1, startGold: 280, castleHp: 20,
    castle: { c: 11, r: 6, w: 2, h: 2 },               // 占 (11,6)(12,6)(11,7)(12,7)
    camps: [{ id: 'a', c: 0, r: 2 }, { id: 'b', c: 23, r: 3 }],
    paths: {
      // 左路：右→下→左→下→右→上→入城，蛇形
      a: [{ x: 0, y: 2 }, { x: 8, y: 2 }, { x: 8, y: 5 }, { x: 3, y: 5 }, { x: 3, y: 9 }, { x: 9, y: 9 }, { x: 9, y: 7 }, { x: 11, y: 7 }],
      // 右路：左→下→右→下→左→上→入城，蛇形
      b: [{ x: 23, y: 3 }, { x: 16, y: 3 }, { x: 16, y: 7 }, { x: 20, y: 7 }, { x: 20, y: 10 }, { x: 13, y: 10 }, { x: 13, y: 6 }, { x: 12, y: 6 }],
    },
    slots: [
      // 左路两侧
      { x: 4, y: 3 }, { x: 9, y: 3 }, { x: 6, y: 4 }, { x: 4, y: 7 }, { x: 6, y: 8 }, { x: 10, y: 6 },
      // 右路两侧
      { x: 19, y: 4 }, { x: 15, y: 5 }, { x: 18, y: 6 }, { x: 19, y: 9 }, { x: 16, y: 9 }, { x: 14, y: 8 },
    ],
    // 10 波，单营→双营递增（M1 仅步卒；Phase 2 起按势力换皮、加兵种变化）。
    waves: [
      { waveId: 1,  startDelay: 0, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 6,  spawnInterval: 1.2,  leadDelay: 0 }] },
      { waveId: 2,  startDelay: 6, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'footman', count: 7,  spawnInterval: 1.1,  leadDelay: 0 }] },
      { waveId: 3,  startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 1.1, leadDelay: 2 },
      ] },
      { waveId: 4,  startDelay: 6, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.9,  leadDelay: 0 }] },
      { waveId: 5,  startDelay: 6, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'footman', count: 10, spawnInterval: 0.9,  leadDelay: 0 }] },
      { waveId: 6,  startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 9, spawnInterval: 0.8, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 9, spawnInterval: 0.8, leadDelay: 1 },
      ] },
      { waveId: 7,  startDelay: 7, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 14, spawnInterval: 0.75, leadDelay: 0 }] },
      { waveId: 8,  startDelay: 7, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'footman', count: 14, spawnInterval: 0.75, leadDelay: 0 }] },
      { waveId: 9,  startDelay: 8, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 12, spawnInterval: 0.7, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 12, spawnInterval: 0.7, leadDelay: 0 },
      ] },
      { waveId: 10, startDelay: 8, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 16, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 16, spawnInterval: 0.6, leadDelay: 1 },
      ] },
    ],
  },
];
