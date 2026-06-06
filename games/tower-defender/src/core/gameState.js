// core/gameState.js — render-free 单局状态 + 相位机。
// 铁律：本模块不得 import 渲染/DOM（localStorage 经 save.js 守卫，不在此触碰）。
// 单一真相源：所有权威变更同步写本对象；事件只通知（见 eventBus）。
// phase: 'prep'（备战，可建塔，倒计时）| 'combat'（交战）| 'won' | 'lost'

import { BAL } from '../data/balance.js';

export function newGameState(level) {
  return {
    phase: 'prep',
    level,
    gold: level.startGold,
    castleHp: level.castleHp,
    castleMaxHp: level.castleHp,
    waveIndex: 0,                 // 当前波（0-based）
    prepTimer: BAL.PREP_SECONDS,  // 备战剩余秒
    earlyRequested: false,        // 玩家请求提前出兵
    speed: 1,                     // 1 | 2
    paused: false,
    time: 0,                      // 累计游戏时间（秒）
    towers: [],
    enemies: [],
    projectiles: [],              // 纯表现（hitscan 轨迹）
    fx: [],                       // 飘字等
    activeSpawns: [],             // 当前波展开的出兵计时器
    campsFallen: {},              // campId -> true（出兵出尽即攻陷）
    allWavesEmitted: false,       // 末波 spawns 出尽
    stars: 0,
  };
}
