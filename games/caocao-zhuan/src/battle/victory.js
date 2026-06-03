// battle/victory.js — 胜负判定（纯逻辑，不依赖 Three.js / DOM）
//
// 契约（plan §1.8 / §B3 / §1.6）：
//   evaluate(battleState) -> 'win' | 'lose' | null
//   battleState = { units:[Unit], turn, map }
//
//   map.victory.type:
//     'rout'         — 所有 faction!=='wei' 单位死亡 => win
//     'defeatLeader' — map.victory.generalId 敌将死亡 => win
//     'survive'      — turn >= map.victory.turns => win
//     'capture'      — 某存活 wei 单位站在 capture 地形（gate）上 => win
//   map.defeat.type:
//     'leaderDead'   — map.defeat.generalId 单位死亡 => lose
//   另：所有 'wei' 单位死亡 => lose（先于胜利判定）。
//
// 判定顺序：先 lose（败北是硬性兜底），再 win，否则 null（进行中）。

import { TERRAIN } from '../data/terrain.js';

const isAlive = (u) => u && u.alive !== false;

function tileIdAt(map, c, r) {
  if (!map || !map.tiles) return null;
  const row = map.tiles[r];
  return row ? row[c] : null;
}

function checkDefeat(battleState) {
  const { units, map } = battleState;

  // 指定主将阵亡 => lose
  if (map.defeat && map.defeat.type === 'leaderDead' && map.defeat.generalId) {
    const leader = units.find((u) => u.id === map.defeat.generalId);
    if (leader && !isAlive(leader)) return true;
  }

  // 我方（wei）全灭 => lose（兜底，覆盖任何胜利类型）
  const wei = units.filter((u) => u.faction === 'wei');
  if (wei.length > 0 && wei.every((u) => !isAlive(u))) return true;

  return false;
}

function checkVictory(battleState) {
  const { units, turn, map } = battleState;
  const v = map.victory || {};

  switch (v.type) {
    case 'rout': {
      // 所有非 wei 单位死亡（且存在过敌人）
      const foes = units.filter((u) => u.faction !== 'wei');
      return foes.length > 0 && foes.every((u) => !isAlive(u));
    }
    case 'defeatLeader': {
      const target = units.find((u) => u.id === v.generalId);
      return !!(target && !isAlive(target));
    }
    case 'survive': {
      return typeof v.turns === 'number' && turn >= v.turns;
    }
    case 'capture': {
      return units.some(
        (u) =>
          u.faction === 'wei' &&
          isAlive(u) &&
          u.pos &&
          (() => {
            const tid = tileIdAt(map, u.pos.c, u.pos.r);
            const t = tid && TERRAIN[tid];
            return !!(t && t.capture);
          })(),
      );
    }
    default:
      return false;
  }
}

export function evaluate(battleState) {
  if (!battleState || !battleState.map || !Array.isArray(battleState.units)) return null;

  // 败北优先
  if (checkDefeat(battleState)) return 'lose';
  if (checkVictory(battleState)) return 'win';
  return null;
}
