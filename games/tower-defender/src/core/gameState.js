// core/gameState.js — render-free 单局状态 + 相位机。
// 铁律：本模块不得 import 渲染/DOM（localStorage 经 save.js 守卫，不在此触碰）。
// 单一真相源：所有权威变更同步写本对象；事件只通知（见 eventBus）。
// phase: 'prep'（备战，可建塔，倒计时）| 'combat'（交战）| 'won' | 'lost'

import { BAL } from '../data/balance.js';
import { makeRng } from './rng.js';
import { initTerrainState } from '../systems/terrainSystem.js';

export function newGameState(level, opts = {}) {
  return {
    phase: 'prep',
    level,
    unlocked: opts.unlocked || null,   // [spec §3] 已解锁将 Set;null=全解锁(单测/老调用零破坏)
    rng: makeRng(),               // [P2] 暴击/被动随机源（时间种子；单测各自注入 stub）
    gold: level.startGold,
    castleHp: level.castleHp,
    castleMaxHp: level.castleHp,
    waveIndex: 0,                 // 当前波（0-based）
    prepTimer: BAL.PREP_SECONDS,  // 备战剩余秒
    earlyRequested: false,        // 玩家请求提前出兵
    speed: 1,                     // 0(战术冻结) | 1 | 2;0 经 advance 的 dt*speed 天然停摆全部模拟
    speedPrev: 1,                 // [0×] 冻结前的速度(1|2),解冻恢复用;换关随 newGameState 归位
    paused: false,
    time: 0,                      // 累计游戏时间（秒）
    towers: [],
    enemies: [],
    projectiles: [],              // 纯表现（hitscan 轨迹）
    fx: [],                       // 飘字等
    activeSpawns: [],             // 当前波展开的出兵计时器
    campsFallen: {},              // campId -> true（出兵出尽即攻陷）
    allWavesEmitted: false,       // 末波 spawns 出尽
    terrain: initTerrainState(level),   // [地形] 运行时状态（落石计时/禁用集;敌身上的状态在敌实例）
    stars: 0,
    runKills: {},                 // [成就] 单局分将击杀计数(每关复位;万人敌判定 + 击杀归因)
  };
}

// —— [0×/实测④] 战术冻结:敌不进军、塔不攻击、不出兵、计时停摆(advance 乘 speed=0 → step 不跑),
// 但建造/升级/拆除走 economySystem 直改 state 不依赖 step,照常可用——给孩子从容思考武将排布。
// 不入 resume 快照、不入存档(settings.speed 校验 [1,2]);换关 newGameState 自动回 1×。

// 0× 钮:冻结 ↔ 解冻(恢复冻结前速度)。返回新 speed。
export function toggleFreeze(state) {
  if (state.speed === 0) {
    state.speed = state.speedPrev || 1;
  } else {
    state.speedPrev = state.speed;
    state.speed = 0;
  }
  return state.speed;
}

// 速度钮:冻结时=以所示速度(speedPrev)解冻;平时 1↔2 循环。返回新 speed。
export function cycleSpeed(state) {
  if (state.speed === 0) state.speed = state.speedPrev || 1;
  else state.speed = state.speed === 1 ? 2 : 1;
  return state.speed;
}
