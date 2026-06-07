// data/levels.js — 正式 8 关战役(§7)。Phase 3 进行中:南蛮 L1-3(CP1);东吴/曹魏 5 关 CP2/CP3 续。
// 换皮由 level.faction 驱动(waveSystem 自动套皮);名将 BOSS 见 data/bosses.js。
// 无漏怪硬约束(§17.4):每段蜀道落在某将位 2.5 格内 → tools/verify-levels.mjs 校验。
import { BOSSES } from './bosses.js';

// —— 南蛮 2 营布局(L1/L2 共用;左路 a + 右路 b,点对称于成都) ——
const NANMAN_2CAMP = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [{ id: 'a', c: 1, r: 2 }, { id: 'b', c: 22, r: 11 }],
  paths: {
    a: [{ x: 1, y: 2 }, { x: 1, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 9 }, { x: 4, y: 9 }, { x: 4, y: 11 }, { x: 11, y: 11 }, { x: 11, y: 7 }],
    b: [{ x: 22, y: 11 }, { x: 22, y: 8 }, { x: 15, y: 8 }, { x: 15, y: 4 }, { x: 19, y: 4 }, { x: 19, y: 2 }, { x: 12, y: 2 }, { x: 12, y: 6 }],
  },
  // slots 改为每关单列(由 tools/suggest-slots.mjs 生成:不在路/城/营上、完整覆盖)
};

// —— 南蛮 3 营布局(L3;在 2 营基础上加顶部 c 路) ——
const NANMAN_3CAMP = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...NANMAN_2CAMP.camps, { id: 'c', c: 13, r: 0 }],
  // c 路:顶营蛇形下行,末点落成都 TL 格 (11,6)(加长至 ~22 格,与主路差距收窄)
  paths: { ...NANMAN_2CAMP.paths, c: [{ x: 13, y: 0 }, { x: 13, y: 3 }, { x: 9, y: 3 }, { x: 9, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 4 }, { x: 9, y: 4 }, { x: 9, y: 6 }, { x: 11, y: 6 }] },
};

// —— 东吴 4 营布局(L4;3 营 a/b/c + 底中 d 路) ——
const WU_4CAMP = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...NANMAN_3CAMP.camps, { id: 'd', c: 11, r: 13 }],
  // d 路:底营右绕上行,末点落成都 BR 格 (12,7)
  paths: { ...NANMAN_3CAMP.paths, d: [{ x: 11, y: 13 }, { x: 16, y: 13 }, { x: 16, y: 9 }, { x: 12, y: 9 }, { x: 12, y: 7 }] },
};

// —— 东吴 5 营布局(L5;4 营 + 右上 e 路) ——
const WU_5CAMP = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...WU_4CAMP.camps, { id: 'e', c: 22, r: 1 }],
  // e 路:右上营左行下绕,末点落成都 TR 格 (12,6)
  paths: { ...WU_4CAMP.paths, e: [{ x: 22, y: 1 }, { x: 18, y: 1 }, { x: 18, y: 6 }, { x: 12, y: 6 }] },
};

// —— 曹魏 6 营(L6;5 营 + 左下 f 路) ——
const WEI_6CAMP = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...WU_5CAMP.camps, { id: 'f', c: 1, r: 13 }],
  paths: { ...WU_5CAMP.paths, f: [{ x: 1, y: 13 }, { x: 4, y: 13 }, { x: 4, y: 8 }, { x: 8, y: 8 }, { x: 8, y: 11 }, { x: 11, y: 11 }, { x: 11, y: 7 }] },
};

// —— 曹魏 7 营(L7;6 营 + 右中 g 路) ——
const WEI_7CAMP = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...WEI_6CAMP.camps, { id: 'g', c: 23, r: 7 }],
  paths: { ...WEI_6CAMP.paths, g: [{ x: 23, y: 7 }, { x: 20, y: 7 }, { x: 20, y: 11 }, { x: 16, y: 11 }, { x: 16, y: 7 }, { x: 12, y: 7 }] },
};

// —— 曹魏 8 营(L8 决战;7 营 + 上中 h 路) ——
const WEI_8CAMP = {
  cols: 24, rows: 14, castle: { c: 11, r: 6, w: 2, h: 2 },
  camps: [...WEI_7CAMP.camps, { id: 'h', c: 8, r: 0 }],
  paths: { ...WEI_7CAMP.paths, h: [{ x: 8, y: 0 }, { x: 8, y: 2 }, { x: 4, y: 2 }, { x: 4, y: 6 }, { x: 8, y: 6 }, { x: 11, y: 6 }] },
};

export const LEVELS = [
  {
    id: 1, name: '南征·序战', faction: 'nanman', scale: 1.0, startGold: 320, castleHp: 20,
    ...NANMAN_2CAMP,
    slots: [{ x: 6, y: 10 }, { x: 17, y: 3 }, { x: 10, y: 9 }, { x: 13, y: 4 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 6, y: 6 }, { x: 20, y: 9 }, { x: 9, y: 9 }, { x: 14, y: 4 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 9, y: 10 }, { x: 14, y: 3 }],
    // 教学关:仅蛮兵/狼骑,无 BOSS。
    waves: [
      { waveId: 1, startDelay: 0, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 1.2, leadDelay: 0 }] },
      { waveId: 2, startDelay: 6, spawns: [
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 1.1, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 3, spawnInterval: 0.8, leadDelay: 2 },
      ] },
      { waveId: 3, startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 4, spawnInterval: 0.7, leadDelay: 2 },
      ] },
      { waveId: 4, startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 6, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 0.9, leadDelay: 1 },
      ] },
      { waveId: 5, startDelay: 6, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 8, spawnInterval: 0.85, leadDelay: 0 }] },
      { waveId: 6, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 6, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 6, spawnInterval: 0.6, leadDelay: 1 },
      ] },
      { waveId: 7, startDelay: 7, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'footman', count: 12, spawnInterval: 0.7, leadDelay: 0 }] },
      { waveId: 8, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 9, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 9, spawnInterval: 0.6, leadDelay: 1 },
      ] },
    ],
  },
  {
    id: 2, name: '南征·密林', faction: 'nanman', scale: 1.15, startGold: 350, castleHp: 20,
    ...NANMAN_2CAMP,
    slots: [{ x: 6, y: 10 }, { x: 17, y: 3 }, { x: 10, y: 9 }, { x: 13, y: 4 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 6, y: 6 }, { x: 20, y: 9 }, { x: 9, y: 9 }, { x: 14, y: 4 }, { x: 6, y: 7 }, { x: 7, y: 7 }, { x: 9, y: 10 }, { x: 14, y: 3 }],
    // 引入名将 BOSS 机制:末波 木鹿大王。
    waves: [
      { waveId: 1, startDelay: 0, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 1.1, leadDelay: 0 }] },
      { waveId: 2, startDelay: 6, spawns: [
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 7, spawnInterval: 1.0, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 4, spawnInterval: 0.7, leadDelay: 2 },
      ] },
      { waveId: 3, startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 7, spawnInterval: 0.9, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 5, spawnInterval: 0.6, leadDelay: 2 },
      ] },
      { waveId: 4, startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 7, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 7, spawnInterval: 0.85, leadDelay: 1 },
      ] },
      { waveId: 5, startDelay: 6, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'footman', count: 10, spawnInterval: 0.75, leadDelay: 0 }] },
      { waveId: 6, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 7, spawnInterval: 0.55, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 7, spawnInterval: 0.55, leadDelay: 1 },
      ] },
      { waveId: 7, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 12, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 0.8, leadDelay: 2 },
      ] },
      { waveId: 8, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 1 },
      ] },
      // 末波:木鹿大王 + 护卫
      { waveId: 9, startDelay: 8, spawns: [
        { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 6, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 8, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 6, ...BOSSES.mulu },
      ] },
    ],
  },
  {
    id: 3, name: '南征·藤甲', faction: 'nanman', scale: 1.3, startGold: 400, castleHp: 20,
    ...NANMAN_3CAMP,
    slots: [{ x: 8, y: 3 }, { x: 13, y: 4 }, { x: 6, y: 10 }, { x: 17, y: 3 }, { x: 9, y: 8 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 20, y: 9 }, { x: 9, y: 10 }, { x: 5, y: 3 }, { x: 9, y: 7 }, { x: 11, y: 0 }, { x: 7, y: 3 }, { x: 10, y: 4 }, { x: 11, y: 4 }, { x: 10, y: 5 }, { x: 14, y: 3 }, { x: 11, y: 2 }, { x: 14, y: 4 }, { x: 8, y: 2 }, { x: 7, y: 6 }],
    // 引入藤甲兵(抗物理·怕火 → 诸葛火攻/关羽谋略);末波 兀突骨。
    waves: [
      { waveId: 1, startDelay: 0, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 1 },
      ] },
      { waveId: 2, startDelay: 6, spawns: [
        { campId: 'c', pathId: 'c', enemyType: 'footman', count: 6, spawnInterval: 0.9, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 4, spawnInterval: 0.6, leadDelay: 2 },
      ] },
      { waveId: 3, startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 0.9, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 5, spawnInterval: 0.6, leadDelay: 1 },
        { campId: 'c', pathId: 'c', enemyType: 'footman', count: 5, spawnInterval: 0.9, leadDelay: 2 },
      ] },
      // 藤甲首登场
      { waveId: 4, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'tengjia', count: 2, spawnInterval: 2.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 8, spawnInterval: 0.8, leadDelay: 1 },
      ] },
      { waveId: 5, startDelay: 6, spawns: [
        { campId: 'c', pathId: 'c', enemyType: 'wolf', count: 6, spawnInterval: 0.55, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 8, spawnInterval: 0.7, leadDelay: 1 },
      ] },
      { waveId: 6, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'tengjia', count: 2, spawnInterval: 2.5, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'tengjia', count: 2, spawnInterval: 2.5, leadDelay: 1 },
        { campId: 'c', pathId: 'c', enemyType: 'footman', count: 8, spawnInterval: 0.7, leadDelay: 0 },
      ] },
      { waveId: 7, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 8, spawnInterval: 0.5, leadDelay: 1 },
      ] },
      { waveId: 8, startDelay: 7, spawns: [
        { campId: 'c', pathId: 'c', enemyType: 'tengjia', count: 3, spawnInterval: 2.2, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 1 },
      ] },
      { waveId: 9, startDelay: 8, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 8, spawnInterval: 0.5, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 0 },
        { campId: 'c', pathId: 'c', enemyType: 'wolf', count: 8, spawnInterval: 0.5, leadDelay: 1 },
      ] },
      // 末波:兀突骨(藤甲军统帅) + 藤甲护卫
      { waveId: 10, startDelay: 9, spawns: [
        { campId: 'c', pathId: 'c', enemyType: 'footman', count: 8, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'tengjia', count: 3, spawnInterval: 1.8, leadDelay: 1 },
        { campId: 'a', pathId: 'a', enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 6, ...BOSSES.wutugu },
      ] },
    ],
  },
  {
    id: 4, name: '抗吴·荆州', faction: 'wu', scale: 1.5, startGold: 460, castleHp: 20,
    ...WU_4CAMP,
    slots: [{ x: 8, y: 3 }, { x: 13, y: 4 }, { x: 10, y: 9 }, { x: 6, y: 10 }, { x: 15, y: 11 }, { x: 17, y: 3 }, { x: 3, y: 4 }, { x: 17, y: 7 }, { x: 10, y: 7 }, { x: 20, y: 9 }, { x: 5, y: 3 }, { x: 12, y: 11 }, { x: 11, y: 0 }, { x: 7, y: 3 }, { x: 10, y: 4 }, { x: 11, y: 4 }, { x: 10, y: 5 }, { x: 14, y: 3 }, { x: 11, y: 2 }, { x: 14, y: 4 }, { x: 8, y: 2 }, { x: 11, y: 5 }, { x: 7, y: 6 }],
    // 引入飞兵(飞鸢·仅防空将可打) + 重甲(楼船甲士·物理0.6不怕火);末波 甘宁。飞兵与 BOSS 分波。
    waves: [
      { waveId: 1, startDelay: 0, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 1 },
      ] },
      { waveId: 2, startDelay: 6, spawns: [
        { campId: 'c', pathId: 'c', enemyType: 'footman', count: 6, spawnInterval: 0.9, leadDelay: 0 },
        { campId: 'd', pathId: 'd', enemyType: 'wolf', count: 4, spawnInterval: 0.6, leadDelay: 1 },
      ] },
      { waveId: 3, startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 5, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 7, spawnInterval: 0.8, leadDelay: 1 },
        { campId: 'd', pathId: 'd', enemyType: 'footman', count: 6, spawnInterval: 0.8, leadDelay: 2 },
      ] },
      // 重甲(楼船甲士)首登场
      { waveId: 4, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'heavy', count: 2, spawnInterval: 2.0, leadDelay: 0 },
        { campId: 'c', pathId: 'c', enemyType: 'footman', count: 8, spawnInterval: 0.7, leadDelay: 1 },
      ] },
      // 飞兵(飞鸢)首登场
      { waveId: 5, startDelay: 7, spawns: [
        { campId: 'd', pathId: 'd', enemyType: 'flyer', count: 4, spawnInterval: 1.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 8, spawnInterval: 0.7, leadDelay: 1 },
      ] },
      { waveId: 6, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 8, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'heavy', count: 2, spawnInterval: 2.2, leadDelay: 1 },
        { campId: 'c', pathId: 'c', enemyType: 'wolf', count: 6, spawnInterval: 0.55, leadDelay: 1 },
      ] },
      { waveId: 7, startDelay: 7, spawns: [
        { campId: 'd', pathId: 'd', enemyType: 'flyer', count: 4, spawnInterval: 0.9, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 1 },
      ] },
      { waveId: 8, startDelay: 7, spawns: [
        { campId: 'b', pathId: 'b', enemyType: 'heavy', count: 3, spawnInterval: 1.8, leadDelay: 0 },
        { campId: 'c', pathId: 'c', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 1 },
        { campId: 'd', pathId: 'd', enemyType: 'wolf', count: 6, spawnInterval: 0.5, leadDelay: 1 },
      ] },
      { waveId: 9, startDelay: 8, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'flyer', count: 4, spawnInterval: 0.9, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 1 },
      ] },
      { waveId: 10, startDelay: 8, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'heavy', count: 2, spawnInterval: 2.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'heavy', count: 2, spawnInterval: 2.0, leadDelay: 1 },
        { campId: 'c', pathId: 'c', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 0 },
        { campId: 'd', pathId: 'd', enemyType: 'wolf', count: 8, spawnInterval: 0.5, leadDelay: 1 },
      ] },
      // 末波:甘宁 + 护卫(无飞兵同波)
      { waveId: 11, startDelay: 9, spawns: [
        { campId: 'b', pathId: 'b', enemyType: 'heavy', count: 2, spawnInterval: 1.8, leadDelay: 0 },
        { campId: 'c', pathId: 'c', enemyType: 'footman', count: 8, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'd', pathId: 'd', enemyType: 'wolf', count: 6, spawnInterval: 0.55, leadDelay: 1 },
        { campId: 'a', pathId: 'a', enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 6, ...BOSSES.ganning },
      ] },
    ],
  },
  {
    id: 5, name: '抗吴·夷陵', faction: 'wu', scale: 1.7, startGold: 520, castleHp: 20,
    ...WU_5CAMP,
    slots: [{ x: 8, y: 3 }, { x: 13, y: 4 }, { x: 17, y: 3 }, { x: 10, y: 9 }, { x: 16, y: 7 }, { x: 6, y: 10 }, { x: 14, y: 11 }, { x: 3, y: 4 }, { x: 20, y: 9 }, { x: 10, y: 7 }, { x: 19, y: 0 }, { x: 5, y: 3 }, { x: 14, y: 12 }, { x: 11, y: 0 }, { x: 11, y: 4 }, { x: 14, y: 4 }, { x: 7, y: 3 }, { x: 10, y: 4 }, { x: 10, y: 5 }, { x: 13, y: 7 }, { x: 14, y: 7 }, { x: 14, y: 8 }, { x: 11, y: 5 }, { x: 13, y: 8 }],
    // 引入方士(吴术士·治疗友军,设「最弱/最后」点杀);末波 陆逊。
    waves: [
      { waveId: 1, startDelay: 0, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 1 },
        { campId: 'e', pathId: 'e', enemyType: 'footman', count: 6, spawnInterval: 1.0, leadDelay: 2 },
      ] },
      { waveId: 2, startDelay: 6, spawns: [
        { campId: 'c', pathId: 'c', enemyType: 'wolf', count: 5, spawnInterval: 0.6, leadDelay: 0 },
        { campId: 'd', pathId: 'd', enemyType: 'footman', count: 6, spawnInterval: 0.8, leadDelay: 1 },
      ] },
      { waveId: 3, startDelay: 6, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 7, spawnInterval: 0.7, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'heavy', count: 2, spawnInterval: 2.0, leadDelay: 1 },
        { campId: 'e', pathId: 'e', enemyType: 'wolf', count: 5, spawnInterval: 0.6, leadDelay: 1 },
      ] },
      // 方士(吴术士)首登场
      { waveId: 4, startDelay: 7, spawns: [
        { campId: 'c', pathId: 'c', enemyType: 'shaman', count: 2, spawnInterval: 3.0, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 8, spawnInterval: 0.6, leadDelay: 1 },
        { campId: 'd', pathId: 'd', enemyType: 'footman', count: 6, spawnInterval: 0.7, leadDelay: 2 },
      ] },
      { waveId: 5, startDelay: 7, spawns: [
        { campId: 'd', pathId: 'd', enemyType: 'flyer', count: 4, spawnInterval: 0.9, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 8, spawnInterval: 0.6, leadDelay: 1 },
        { campId: 'e', pathId: 'e', enemyType: 'footman', count: 6, spawnInterval: 0.7, leadDelay: 1 },
      ] },
      { waveId: 6, startDelay: 7, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'heavy', count: 2, spawnInterval: 2.0, leadDelay: 0 },
        { campId: 'c', pathId: 'c', enemyType: 'shaman', count: 2, spawnInterval: 3.0, leadDelay: 1 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 8, spawnInterval: 0.5, leadDelay: 1 },
      ] },
      { waveId: 7, startDelay: 7, spawns: [
        { campId: 'e', pathId: 'e', enemyType: 'flyer', count: 4, spawnInterval: 0.9, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 1 },
        { campId: 'd', pathId: 'd', enemyType: 'wolf', count: 6, spawnInterval: 0.5, leadDelay: 1 },
      ] },
      { waveId: 8, startDelay: 8, spawns: [
        { campId: 'b', pathId: 'b', enemyType: 'heavy', count: 3, spawnInterval: 1.8, leadDelay: 0 },
        { campId: 'c', pathId: 'c', enemyType: 'shaman', count: 2, spawnInterval: 3.0, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 1 },
      ] },
      { waveId: 9, startDelay: 8, spawns: [
        { campId: 'd', pathId: 'd', enemyType: 'flyer', count: 5, spawnInterval: 0.8, leadDelay: 0 },
        { campId: 'e', pathId: 'e', enemyType: 'heavy', count: 2, spawnInterval: 2.0, leadDelay: 1 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 1 },
      ] },
      { waveId: 10, startDelay: 8, spawns: [
        { campId: 'a', pathId: 'a', enemyType: 'heavy', count: 2, spawnInterval: 1.9, leadDelay: 0 },
        { campId: 'c', pathId: 'c', enemyType: 'shaman', count: 3, spawnInterval: 2.5, leadDelay: 1 },
        { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 10, spawnInterval: 0.45, leadDelay: 0 },
        { campId: 'e', pathId: 'e', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 1 },
      ] },
      { waveId: 11, startDelay: 8, spawns: [
        { campId: 'd', pathId: 'd', enemyType: 'flyer', count: 5, spawnInterval: 0.8, leadDelay: 0 },
        { campId: 'a', pathId: 'a', enemyType: 'heavy', count: 3, spawnInterval: 1.8, leadDelay: 1 },
        { campId: 'b', pathId: 'b', enemyType: 'footman', count: 12, spawnInterval: 0.5, leadDelay: 1 },
      ] },
      // 末波:陆逊 + 护卫(无飞兵同波)
      { waveId: 12, startDelay: 9, spawns: [
        { campId: 'c', pathId: 'c', enemyType: 'shaman', count: 2, spawnInterval: 2.5, leadDelay: 0 },
        { campId: 'b', pathId: 'b', enemyType: 'heavy', count: 3, spawnInterval: 1.6, leadDelay: 0 },
        { campId: 'e', pathId: 'e', enemyType: 'footman', count: 10, spawnInterval: 0.5, leadDelay: 1 },
        { campId: 'a', pathId: 'a', enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 6, ...BOSSES.luxun },
      ] },
    ],
  },
  {
    id: 6, name: '北伐·陇右', faction: 'wei', scale: 1.9, startGold: 580, castleHp: 20,
    ...WEI_6CAMP,
    slots: [{ x: 10, y: 9 }, { x: 6, y: 10 }, { x: 8, y: 3 }, { x: 13, y: 4 }, { x: 17, y: 3 }, { x: 16, y: 7 }, { x: 14, y: 11 }, { x: 3, y: 4 }, { x: 20, y: 9 }, { x: 10, y: 7 }, { x: 2, y: 12 }, { x: 19, y: 0 }, { x: 4, y: 6 }, { x: 14, y: 12 }, { x: 4, y: 0 }, { x: 11, y: 0 }, { x: 9, y: 9 }, { x: 9, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 8 }, { x: 9, y: 8 }, { x: 13, y: 7 }, { x: 13, y: 8 }, { x: 9, y: 7 }, { x: 11, y: 4 }, { x: 14, y: 4 }, { x: 7, y: 3 }, { x: 7, y: 10 }],
    // 曹魏全兵种(虎豹骑/重甲铁骑/斥候鹰/军师);末波 张辽。6 营。
    waves: [
      { waveId: 1, startDelay: 0, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 6, spawnInterval: 0.9, leadDelay: 0 }, { campId: 'b', pathId: 'b', enemyType: 'footman', count: 6, spawnInterval: 0.9, leadDelay: 1 }] },
      { waveId: 2, startDelay: 6, spawns: [{ campId: 'c', pathId: 'c', enemyType: 'wolf', count: 6, spawnInterval: 0.55, leadDelay: 0 }, { campId: 'd', pathId: 'd', enemyType: 'footman', count: 6, spawnInterval: 0.8, leadDelay: 1 }] },
      { waveId: 3, startDelay: 6, spawns: [{ campId: 'e', pathId: 'e', enemyType: 'footman', count: 7, spawnInterval: 0.7, leadDelay: 0 }, { campId: 'f', pathId: 'f', enemyType: 'wolf', count: 6, spawnInterval: 0.55, leadDelay: 1 }] },
      { waveId: 4, startDelay: 6, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'heavy', count: 2, spawnInterval: 2.0, leadDelay: 0 }, { campId: 'b', pathId: 'b', enemyType: 'footman', count: 8, spawnInterval: 0.7, leadDelay: 1 }] },
      { waveId: 5, startDelay: 6, spawns: [{ campId: 'd', pathId: 'd', enemyType: 'flyer', count: 4, spawnInterval: 0.9, leadDelay: 0 }, { campId: 'c', pathId: 'c', enemyType: 'footman', count: 8, spawnInterval: 0.65, leadDelay: 1 }] },
      { waveId: 6, startDelay: 7, spawns: [{ campId: 'e', pathId: 'e', enemyType: 'shaman', count: 2, spawnInterval: 3.0, leadDelay: 0 }, { campId: 'f', pathId: 'f', enemyType: 'footman', count: 8, spawnInterval: 0.65, leadDelay: 1 }, { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 6, spawnInterval: 0.5, leadDelay: 1 }] },
      { waveId: 7, startDelay: 7, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'heavy', count: 3, spawnInterval: 1.8, leadDelay: 0 }, { campId: 'c', pathId: 'c', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 1 }] },
      { waveId: 8, startDelay: 7, spawns: [{ campId: 'f', pathId: 'f', enemyType: 'flyer', count: 4, spawnInterval: 0.85, leadDelay: 0 }, { campId: 'd', pathId: 'd', enemyType: 'heavy', count: 2, spawnInterval: 1.9, leadDelay: 1 }, { campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 1 }] },
      { waveId: 9, startDelay: 7, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'shaman', count: 2, spawnInterval: 2.8, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'wolf', count: 8, spawnInterval: 0.5, leadDelay: 1 }, { campId: 'c', pathId: 'c', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 1 }] },
      { waveId: 10, startDelay: 8, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'heavy', count: 2, spawnInterval: 1.8, leadDelay: 0 }, { campId: 'd', pathId: 'd', enemyType: 'flyer', count: 5, spawnInterval: 0.8, leadDelay: 1 }, { campId: 'f', pathId: 'f', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 1 }] },
      { waveId: 11, startDelay: 8, spawns: [{ campId: 'c', pathId: 'c', enemyType: 'heavy', count: 3, spawnInterval: 1.6, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'footman', count: 12, spawnInterval: 0.5, leadDelay: 1 }, { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 8, spawnInterval: 0.45, leadDelay: 1 }] },
      { waveId: 12, startDelay: 8, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'flyer', count: 5, spawnInterval: 0.8, leadDelay: 0 }, { campId: 'd', pathId: 'd', enemyType: 'footman', count: 12, spawnInterval: 0.5, leadDelay: 1 }, { campId: 'f', pathId: 'f', enemyType: 'wolf', count: 8, spawnInterval: 0.45, leadDelay: 1 }] },
      // 末波:张辽 + 护卫(无飞兵同波)
      { waveId: 13, startDelay: 9, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'heavy', count: 3, spawnInterval: 1.6, leadDelay: 0 }, { campId: 'c', pathId: 'c', enemyType: 'footman', count: 10, spawnInterval: 0.5, leadDelay: 0 }, { campId: 'd', pathId: 'd', enemyType: 'wolf', count: 8, spawnInterval: 0.5, leadDelay: 1 }, { campId: 'a', pathId: 'a', enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 6, ...BOSSES.zhangliao }] },
    ],
  },
  {
    id: 7, name: '北伐·街亭', faction: 'wei', scale: 2.2, startGold: 640, castleHp: 20,
    ...WEI_7CAMP,
    slots: [{ x: 10, y: 9 }, { x: 14, y: 8 }, { x: 6, y: 10 }, { x: 8, y: 3 }, { x: 17, y: 3 }, { x: 18, y: 10 }, { x: 13, y: 4 }, { x: 21, y: 9 }, { x: 3, y: 4 }, { x: 14, y: 12 }, { x: 9, y: 7 }, { x: 2, y: 12 }, { x: 16, y: 5 }, { x: 19, y: 0 }, { x: 4, y: 6 }, { x: 4, y: 0 }, { x: 11, y: 0 }, { x: 9, y: 9 }, { x: 13, y: 8 }, { x: 9, y: 10 }, { x: 10, y: 8 }, { x: 10, y: 10 }, { x: 9, y: 8 }, { x: 10, y: 7 }, { x: 17, y: 7 }, { x: 17, y: 9 }, { x: 11, y: 4 }, { x: 14, y: 4 }, { x: 18, y: 9 }],
    // 重甲铁骑加量;末波 张郃 + 许褚(双 BOSS)。7 营。
    waves: [
      { waveId: 1, startDelay: 0, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 7, spawnInterval: 0.85, leadDelay: 0 }, { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 6, spawnInterval: 0.55, leadDelay: 1 }] },
      { waveId: 2, startDelay: 6, spawns: [{ campId: 'c', pathId: 'c', enemyType: 'footman', count: 7, spawnInterval: 0.7, leadDelay: 0 }, { campId: 'g', pathId: 'g', enemyType: 'footman', count: 7, spawnInterval: 0.7, leadDelay: 1 }] },
      { waveId: 3, startDelay: 6, spawns: [{ campId: 'd', pathId: 'd', enemyType: 'heavy', count: 2, spawnInterval: 1.9, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'wolf', count: 7, spawnInterval: 0.5, leadDelay: 1 }, { campId: 'f', pathId: 'f', enemyType: 'footman', count: 7, spawnInterval: 0.7, leadDelay: 1 }] },
      { waveId: 4, startDelay: 7, spawns: [{ campId: 'g', pathId: 'g', enemyType: 'flyer', count: 4, spawnInterval: 0.85, leadDelay: 0 }, { campId: 'a', pathId: 'a', enemyType: 'heavy', count: 2, spawnInterval: 1.8, leadDelay: 1 }, { campId: 'b', pathId: 'b', enemyType: 'footman', count: 8, spawnInterval: 0.6, leadDelay: 1 }] },
      { waveId: 5, startDelay: 6, spawns: [{ campId: 'c', pathId: 'c', enemyType: 'shaman', count: 2, spawnInterval: 2.8, leadDelay: 0 }, { campId: 'd', pathId: 'd', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 1 }, { campId: 'f', pathId: 'f', enemyType: 'wolf', count: 8, spawnInterval: 0.5, leadDelay: 1 }] },
      { waveId: 6, startDelay: 7, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'heavy', count: 3, spawnInterval: 1.6, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'flyer', count: 4, spawnInterval: 0.8, leadDelay: 1 }, { campId: 'g', pathId: 'g', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 1 }] },
      { waveId: 7, startDelay: 7, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'heavy', count: 3, spawnInterval: 1.5, leadDelay: 0 }, { campId: 'c', pathId: 'c', enemyType: 'footman', count: 12, spawnInterval: 0.5, leadDelay: 1 }, { campId: 'd', pathId: 'd', enemyType: 'wolf', count: 8, spawnInterval: 0.45, leadDelay: 1 }] },
      { waveId: 8, startDelay: 7, spawns: [{ campId: 'f', pathId: 'f', enemyType: 'flyer', count: 5, spawnInterval: 0.8, leadDelay: 0 }, { campId: 'g', pathId: 'g', enemyType: 'heavy', count: 3, spawnInterval: 1.5, leadDelay: 1 }, { campId: 'a', pathId: 'a', enemyType: 'footman', count: 12, spawnInterval: 0.5, leadDelay: 1 }] },
      { waveId: 9, startDelay: 8, spawns: [{ campId: 'c', pathId: 'c', enemyType: 'shaman', count: 3, spawnInterval: 2.5, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'heavy', count: 3, spawnInterval: 1.5, leadDelay: 1 }, { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 10, spawnInterval: 0.45, leadDelay: 1 }] },
      { waveId: 10, startDelay: 8, spawns: [{ campId: 'd', pathId: 'd', enemyType: 'flyer', count: 5, spawnInterval: 0.75, leadDelay: 0 }, { campId: 'a', pathId: 'a', enemyType: 'heavy', count: 3, spawnInterval: 1.5, leadDelay: 1 }, { campId: 'f', pathId: 'f', enemyType: 'footman', count: 12, spawnInterval: 0.5, leadDelay: 1 }] },
      { waveId: 11, startDelay: 8, spawns: [{ campId: 'g', pathId: 'g', enemyType: 'heavy', count: 4, spawnInterval: 1.4, leadDelay: 0 }, { campId: 'c', pathId: 'c', enemyType: 'footman', count: 12, spawnInterval: 0.45, leadDelay: 1 }, { campId: 'b', pathId: 'b', enemyType: 'wolf', count: 10, spawnInterval: 0.4, leadDelay: 1 }] },
      { waveId: 12, startDelay: 8, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'flyer', count: 5, spawnInterval: 0.75, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'heavy', count: 3, spawnInterval: 1.4, leadDelay: 1 }, { campId: 'd', pathId: 'd', enemyType: 'footman', count: 14, spawnInterval: 0.45, leadDelay: 1 }] },
      { waveId: 13, startDelay: 8, spawns: [{ campId: 'f', pathId: 'f', enemyType: 'heavy', count: 4, spawnInterval: 1.4, leadDelay: 0 }, { campId: 'g', pathId: 'g', enemyType: 'shaman', count: 2, spawnInterval: 2.5, leadDelay: 1 }, { campId: 'c', pathId: 'c', enemyType: 'footman', count: 14, spawnInterval: 0.45, leadDelay: 1 }] },
      // 末波:张郃 + 许褚(双 BOSS,无飞兵同波)
      { waveId: 14, startDelay: 9, spawns: [{ campId: 'c', pathId: 'c', enemyType: 'heavy', count: 3, spawnInterval: 1.4, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'footman', count: 10, spawnInterval: 0.5, leadDelay: 0 }, { campId: 'a', pathId: 'a', enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 5, ...BOSSES.zhanghe }, { campId: 'b', pathId: 'b', enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 8, ...BOSSES.xuchu }] },
    ],
  },
  {
    id: 8, name: '北伐·决战', faction: 'wei', scale: 2.5, startGold: 700, castleHp: 20,
    ...WEI_8CAMP,
    slots: [{ x: 10, y: 9 }, { x: 7, y: 3 }, { x: 14, y: 8 }, { x: 6, y: 10 }, { x: 17, y: 3 }, { x: 11, y: 4 }, { x: 18, y: 10 }, { x: 3, y: 4 }, { x: 21, y: 9 }, { x: 7, y: 7 }, { x: 14, y: 12 }, { x: 16, y: 5 }, { x: 2, y: 12 }, { x: 11, y: 2 }, { x: 19, y: 0 }, { x: 2, y: 7 }, { x: 13, y: 4 }, { x: 6, y: 7 }, { x: 9, y: 7 }, { x: 9, y: 9 }, { x: 10, y: 8 }, { x: 8, y: 3 }, { x: 9, y: 8 }, { x: 10, y: 7 }, { x: 13, y: 8 }, { x: 9, y: 10 }, { x: 10, y: 5 }, { x: 10, y: 4 }, { x: 10, y: 10 }],
    // 全兵种 + 多 BOSS;终 BOSS 司马懿(每15s召2魏卒 + 每8s震慑将塔停火2s) + 张辽护卫。8 营。
    waves: [
      { waveId: 1, startDelay: 0, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'footman', count: 8, spawnInterval: 0.8, leadDelay: 0 }, { campId: 'h', pathId: 'h', enemyType: 'wolf', count: 6, spawnInterval: 0.5, leadDelay: 1 }] },
      { waveId: 2, startDelay: 6, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'footman', count: 8, spawnInterval: 0.7, leadDelay: 0 }, { campId: 'c', pathId: 'c', enemyType: 'wolf', count: 7, spawnInterval: 0.5, leadDelay: 1 }] },
      { waveId: 3, startDelay: 6, spawns: [{ campId: 'd', pathId: 'd', enemyType: 'heavy', count: 2, spawnInterval: 1.8, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'footman', count: 9, spawnInterval: 0.6, leadDelay: 1 }, { campId: 'f', pathId: 'f', enemyType: 'wolf', count: 7, spawnInterval: 0.5, leadDelay: 1 }] },
      { waveId: 4, startDelay: 7, spawns: [{ campId: 'g', pathId: 'g', enemyType: 'flyer', count: 4, spawnInterval: 0.8, leadDelay: 0 }, { campId: 'h', pathId: 'h', enemyType: 'heavy', count: 2, spawnInterval: 1.8, leadDelay: 1 }, { campId: 'a', pathId: 'a', enemyType: 'footman', count: 10, spawnInterval: 0.6, leadDelay: 1 }] },
      { waveId: 5, startDelay: 6, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'shaman', count: 2, spawnInterval: 2.6, leadDelay: 0 }, { campId: 'c', pathId: 'c', enemyType: 'heavy', count: 3, spawnInterval: 1.6, leadDelay: 1 }, { campId: 'd', pathId: 'd', enemyType: 'wolf', count: 8, spawnInterval: 0.45, leadDelay: 1 }] },
      { waveId: 6, startDelay: 7, spawns: [{ campId: 'e', pathId: 'e', enemyType: 'flyer', count: 5, spawnInterval: 0.8, leadDelay: 0 }, { campId: 'f', pathId: 'f', enemyType: 'heavy', count: 3, spawnInterval: 1.6, leadDelay: 1 }, { campId: 'h', pathId: 'h', enemyType: 'footman', count: 10, spawnInterval: 0.55, leadDelay: 1 }] },
      { waveId: 7, startDelay: 7, spawns: [{ campId: 'g', pathId: 'g', enemyType: 'heavy', count: 3, spawnInterval: 1.5, leadDelay: 0 }, { campId: 'a', pathId: 'a', enemyType: 'shaman', count: 2, spawnInterval: 2.5, leadDelay: 1 }, { campId: 'b', pathId: 'b', enemyType: 'footman', count: 12, spawnInterval: 0.5, leadDelay: 1 }] },
      { waveId: 8, startDelay: 7, spawns: [{ campId: 'c', pathId: 'c', enemyType: 'flyer', count: 5, spawnInterval: 0.75, leadDelay: 0 }, { campId: 'd', pathId: 'd', enemyType: 'heavy', count: 3, spawnInterval: 1.5, leadDelay: 1 }, { campId: 'f', pathId: 'f', enemyType: 'wolf', count: 10, spawnInterval: 0.45, leadDelay: 1 }] },
      { waveId: 9, startDelay: 8, spawns: [{ campId: 'h', pathId: 'h', enemyType: 'heavy', count: 3, spawnInterval: 1.5, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'shaman', count: 3, spawnInterval: 2.3, leadDelay: 1 }, { campId: 'a', pathId: 'a', enemyType: 'footman', count: 14, spawnInterval: 0.45, leadDelay: 1 }] },
      { waveId: 10, startDelay: 8, spawns: [{ campId: 'g', pathId: 'g', enemyType: 'flyer', count: 5, spawnInterval: 0.7, leadDelay: 0 }, { campId: 'b', pathId: 'b', enemyType: 'heavy', count: 4, spawnInterval: 1.4, leadDelay: 1 }, { campId: 'c', pathId: 'c', enemyType: 'footman', count: 14, spawnInterval: 0.45, leadDelay: 1 }] },
      { waveId: 11, startDelay: 8, spawns: [{ campId: 'd', pathId: 'd', enemyType: 'heavy', count: 4, spawnInterval: 1.4, leadDelay: 0 }, { campId: 'f', pathId: 'f', enemyType: 'shaman', count: 3, spawnInterval: 2.2, leadDelay: 1 }, { campId: 'h', pathId: 'h', enemyType: 'wolf', count: 12, spawnInterval: 0.4, leadDelay: 1 }] },
      { waveId: 12, startDelay: 8, spawns: [{ campId: 'a', pathId: 'a', enemyType: 'flyer', count: 6, spawnInterval: 0.7, leadDelay: 0 }, { campId: 'e', pathId: 'e', enemyType: 'heavy', count: 4, spawnInterval: 1.3, leadDelay: 1 }, { campId: 'b', pathId: 'b', enemyType: 'footman', count: 14, spawnInterval: 0.45, leadDelay: 1 }] },
      { waveId: 13, startDelay: 8, spawns: [{ campId: 'c', pathId: 'c', enemyType: 'heavy', count: 4, spawnInterval: 1.3, leadDelay: 0 }, { campId: 'g', pathId: 'g', enemyType: 'shaman', count: 3, spawnInterval: 2.2, leadDelay: 1 }, { campId: 'd', pathId: 'd', enemyType: 'footman', count: 14, spawnInterval: 0.4, leadDelay: 1 }] },
      { waveId: 14, startDelay: 8, spawns: [{ campId: 'h', pathId: 'h', enemyType: 'flyer', count: 6, spawnInterval: 0.7, leadDelay: 0 }, { campId: 'f', pathId: 'f', enemyType: 'heavy', count: 4, spawnInterval: 1.3, leadDelay: 1 }, { campId: 'a', pathId: 'a', enemyType: 'wolf', count: 12, spawnInterval: 0.4, leadDelay: 1 }] },
      { waveId: 15, startDelay: 8, spawns: [{ campId: 'b', pathId: 'b', enemyType: 'heavy', count: 5, spawnInterval: 1.2, leadDelay: 0 }, { campId: 'c', pathId: 'c', enemyType: 'shaman', count: 3, spawnInterval: 2.0, leadDelay: 1 }, { campId: 'e', pathId: 'e', enemyType: 'footman', count: 16, spawnInterval: 0.4, leadDelay: 1 }] },
      // 终波:司马懿(召兵+震将) + 张辽护卫(无飞兵同波)
      { waveId: 16, startDelay: 10, spawns: [{ campId: 'c', pathId: 'c', enemyType: 'heavy', count: 4, spawnInterval: 1.3, leadDelay: 0 }, { campId: 'd', pathId: 'd', enemyType: 'footman', count: 12, spawnInterval: 0.45, leadDelay: 0 }, { campId: 'b', pathId: 'b', enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 5, ...BOSSES.zhangliao }, { campId: 'a', pathId: 'a', enemyType: 'boss', count: 1, spawnInterval: 1, leadDelay: 9, ...BOSSES.simayi }] },
    ],
  },
];
