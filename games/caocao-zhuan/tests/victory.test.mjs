// tests/victory.test.mjs — evaluate 胜负判定（TDD）
// 运行：node games/caocao-zhuan/tests/victory.test.mjs
//
// 契约（plan §1.8 / §B3 / §1.6）：
//   evaluate(battleState) -> 'win' | 'lose' | null
//   battleState = { units:[Unit], turn, map }
//   map.victory.type:
//     'rout'          — 所有 faction!=='wei' 单位死亡 => win
//     'defeatLeader'  — map.victory.generalId 敌将死亡 => win
//     'survive'       — turn >= map.victory.turns => win
//     'capture'       — 某 wei 单位站在 gate/capture 格 => win
//   map.defeat.type:
//     'leaderDead'    — map.defeat.generalId 死亡 => lose
//   并且：所有 'wei' 单位死亡 => lose（覆盖任何 victory 类型）

import assert from 'node:assert';
import { evaluate } from '../src/battle/victory.js';

const wei = (id, alive = true) => ({ id, faction: 'wei', alive, pos: { c: 0, r: 0 } });
const foe = (id, alive = true) => ({ id, faction: 'foe', alive, pos: { c: 5, r: 5 } });

// --- rout: 敌全灭 => win ---
{
  const map = { victory: { type: 'rout' }, defeat: { type: 'leaderDead', generalId: 'caocao' } };
  const units = [wei('caocao'), foe('yt_capt', false), foe('yt_inf1', false)];
  assert.equal(evaluate({ units, turn: 4, map }), 'win', 'rout 敌全灭应 win');
}

// --- rout: 还有敌存活 => null（进行中）---
{
  const map = { victory: { type: 'rout' }, defeat: { type: 'leaderDead', generalId: 'caocao' } };
  const units = [wei('caocao'), foe('yt_capt', true), foe('yt_inf1', false)];
  assert.equal(evaluate({ units, turn: 4, map }), null, '尚有敌存活应 null');
}

// --- leaderDead: 曹操亡 => lose（优先于 win 判定）---
{
  const map = { victory: { type: 'rout' }, defeat: { type: 'leaderDead', generalId: 'caocao' } };
  const units = [wei('caocao', false), wei('xiahoudun', true), foe('yt_capt', true)];
  assert.equal(evaluate({ units, turn: 2, map }), 'lose', '曹操亡应 lose');
}

// --- 所有 wei 死 => lose ---
{
  const map = { victory: { type: 'rout' }, defeat: { type: 'leaderDead', generalId: 'caocao' } };
  const units = [wei('xiahoudun', false), wei('caoren', false), foe('yt_capt', true)];
  assert.equal(evaluate({ units, turn: 2, map }), 'lose', '我方全灭应 lose');
}

// --- defeatLeader: 敌将死 => win ---
{
  const map = { victory: { type: 'defeatLeader', generalId: 'yt_capt' }, defeat: { type: 'leaderDead', generalId: 'caocao' } };
  const units = [wei('caocao', true), foe('yt_capt', false), foe('yt_inf1', true)];
  assert.equal(evaluate({ units, turn: 3, map }), 'win', '斩敌将应 win');
}

// --- defeatLeader: 敌将仍活 => null ---
{
  const map = { victory: { type: 'defeatLeader', generalId: 'yt_capt' }, defeat: { type: 'leaderDead', generalId: 'caocao' } };
  const units = [wei('caocao', true), foe('yt_capt', true)];
  assert.equal(evaluate({ units, turn: 3, map }), null, '敌将存活应 null');
}

// --- survive: 回合达标 => win ---
{
  const map = { victory: { type: 'survive', turns: 5 }, defeat: { type: 'leaderDead', generalId: 'caocao' } };
  const units = [wei('caocao', true), foe('yt_capt', true)];
  assert.equal(evaluate({ units, turn: 5, map }), 'win', 'turn>=turns 应 win');
  assert.equal(evaluate({ units, turn: 6, map }), 'win', 'turn 超过也 win');
}

// --- survive: 回合未达标 => null ---
{
  const map = { victory: { type: 'survive', turns: 5 }, defeat: { type: 'leaderDead', generalId: 'caocao' } };
  const units = [wei('caocao', true), foe('yt_capt', true)];
  assert.equal(evaluate({ units, turn: 4, map }), null, 'turn<turns 应 null');
}

// --- capture: wei 单位站在 capture 格 => win ---
{
  // 3x1 地图，最右为 gate(capture:true)
  const map = {
    cols: 3, rows: 1,
    tiles: [['grass', 'grass', 'gate']],
    victory: { type: 'capture' },
    defeat: { type: 'leaderDead', generalId: 'caocao' },
  };
  const onGate = { id: 'caocao', faction: 'wei', alive: true, pos: { c: 2, r: 0 } };
  const foeAlive = foe('yt_capt', true);
  assert.equal(evaluate({ units: [onGate, foeAlive], turn: 2, map }), 'win', 'wei 占关门应 win');
}

// --- capture: 无 wei 在关门 => null ---
{
  const map = {
    cols: 3, rows: 1,
    tiles: [['grass', 'grass', 'gate']],
    victory: { type: 'capture' },
    defeat: { type: 'leaderDead', generalId: 'caocao' },
  };
  const offGate = { id: 'caocao', faction: 'wei', alive: true, pos: { c: 0, r: 0 } };
  assert.equal(evaluate({ units: [offGate, foe('yt_capt', true)], turn: 2, map }), null, '未占关门应 null');
}

console.log('victory ok');
