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
    // [P2 演示沙盒] 10 波，逐波引入新威胁以验证克制：步卒→轻骑→藤甲(火/谋略)→飞兵(防空)→方士(点杀)→BOSS。
    // 飞兵(8波)与 BOSS(10波)分波出现（§17.3）。Phase 3 将按 §7 重排为南蛮纯教学关 + 正式 8 关战役。
    waves: [
      { waveId: 1,  startDelay: 0, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 6,  spawnInterval: 1.2, leadDelay: 0 }] },
      // 引入轻骑（快·考验关羽减速）
      { waveId: 2,  startDelay: 6, spawns: [
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 1.1, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'wolf',    count: 3, spawnInterval: 0.8, leadDelay: 2 },
      ] },
      { waveId: 3,  startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf',    count: 4, spawnInterval: 0.7, leadDelay: 2 },
      ] },
      { waveId: 4,  startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'wolf',    count: 6, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 0.9, leadDelay: 1 },
      ] },
      // 引入藤甲（抗物理·怕火 → 诸葛火攻 / 关羽谋略）
      { waveId: 5,  startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'tengjia', count: 3, spawnInterval: 2.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 0.9, leadDelay: 1 },
      ] },
      { waveId: 6,  startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 0.8, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'tengjia', count: 2, spawnInterval: 2.5, leadDelay: 3 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf',    count: 6, spawnInterval: 0.6, leadDelay: 1 },
      ] },
      { waveId: 7,  startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 8, spawnInterval: 0.7, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'tengjia', count: 3, spawnInterval: 2.0, leadDelay: 2 },
      ] },
      // 引入飞兵（直扑成都·仅防空将黄/关/诸葛可打）—— 与 BOSS 分波
      { waveId: 8,  startDelay: 8, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'flyer',   count: 5, spawnInterval: 1.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 8, spawnInterval: 0.7, leadDelay: 1 },
      ] },
      // 引入方士（治疗友军·设「最弱/最后」点杀）
      { waveId: 9,  startDelay: 8, spawns: [
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 10, spawnInterval: 0.7, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'shaman',  count: 2,  spawnInterval: 4.0, leadDelay: 2 },
        { campId: 'a', pathId: 'a', enemyType: 'wolf',    count: 4,  spawnInterval: 0.6, leadDelay: 1 },
      ] },
      // 末波 BOSS（高血·扣城5·赵云主要目标）+ 护卫；无飞兵同波
      { waveId: 10, startDelay: 9, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'tengjia', count: 3,  spawnInterval: 2.0, leadDelay: 1 },
        { campId: 'a', pathId: 'a', enemyType: 'boss',    count: 1,  spawnInterval: 1.0, leadDelay: 6 },
      ] },
    ],
  },
];
