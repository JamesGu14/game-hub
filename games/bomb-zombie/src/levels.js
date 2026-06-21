// levels.js — 第1章「城郊废土」波次数据 + 难度派生 + 经验曲线。纯数据/纯函数。
import { XP } from './config.js';

export const expForLevel = (n) => Math.round(XP.base * Math.pow(XP.growth, n - 1));

// 随关号单调递增的难度系数（敌人血量与密度），game.js 用 hpScale 乘 hpMax。
export const levelParams = (n) => ({ hpScale: 1 + (n - 1) * 0.18, densityScale: 1 + (n - 1) * 0.15 });

// 工具：把一组 (type,count,interval) 包成一波
const wave = (enemies, startDelay = 1.2, lane) => ({ enemies, startDelay, ...(lane != null ? { lane } : {}) });
const g = (type, count, interval) => ({ type, count, interval });

// 关 1-9 渐进引入兵种；关 10 Boss。由 tools/sim-run.mjs 校到「10/10 可通关 + 单关~7-13级」(渐贵经验曲线,升级体感越来越慢)。
export const LEVELS = [
  { id: 1, name: '废土前哨', waves: [ wave([g('normal', 8, 0.7)]), wave([g('normal', 12, 0.5)]) ] },
  { id: 2, name: '断桥', waves: [ wave([g('normal', 10, 0.6)]), wave([g('fast', 6, 0.5), g('normal', 8, 0.6)]) ] },
  { id: 3, name: '加油站', waves: [ wave([g('normal', 12, 0.5)]), wave([g('fast', 10, 0.4)]), wave([g('tank', 2, 1.5), g('normal', 10, 0.5)]) ] },
  { id: 4, name: '废弃营地', waves: [ wave([g('normal', 14, 0.45)]), wave([g('exploder', 5, 1.0), g('normal', 10, 0.5)]), wave([g('tank', 3, 1.2)]) ] },
  { id: 5, name: '高速公路', waves: [ wave([g('fast', 14, 0.35)]), wave([g('shielded', 6, 0.9)]), wave([g('tank', 3, 1.2), g('normal', 12, 0.45)]) ] },
  { id: 6, name: '污水处理厂', waves: [ wave([g('spitter', 6, 1.0), g('normal', 12, 0.5)]), wave([g('exploder', 6, 0.9)]), wave([g('shielded', 8, 0.8)]) ] },
  { id: 7, name: '地下车库', waves: [ wave([g('normal', 16, 0.4)]), wave([g('tank', 3, 1.1), g('fast', 10, 0.4)]), wave([g('summoner', 2, 2.0), g('normal', 10, 0.5)]) ] },
  { id: 8, name: '军火库', waves: [ wave([g('shielded', 8, 0.8)]), wave([g('exploder', 6, 0.9), g('spitter', 4, 1.0)]), wave([g('tank', 4, 1.0)]) ] },
  { id: 9, name: '城门废墟', waves: [ wave([g('fast', 16, 0.35)]), wave([g('summoner', 2, 2.0), g('shielded', 6, 0.8)]), wave([g('tank', 4, 1.0), g('exploder', 6, 0.8)]) ] },
  { id: 10, name: '尸潮之王', boss: { hp: 6000, atk: 60, summonInterval: 4, phaseAt: [0.66, 0.33] },
    waves: [ wave([g('normal', 12, 0.5)]), wave([g('tank', 3, 1.2), g('fast', 10, 0.4)]) ] },
];

export function totalEnemies(level) {
  let n = 0;
  for (const w of level.waves) for (const grp of w.enemies) n += grp.count;
  return n;
}
