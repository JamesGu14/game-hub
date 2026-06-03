// battle/combat.js — 战斗结算（纯逻辑，禁止 import three / 触碰 DOM）
//
// 契约（plan §1.8 / §1.2）：
//   resolveAttack(attacker, defender, map, rng)
//     -> { hit:bool, dmg:int, killed:bool, counter:{hit,dmg,killed}|null, log:[strings] }
//
// 规则（plan B2）：
//   damage   = max(1, round((attacker.atk * triangleMul * terrainAtkMod - defEff) * jitter))
//   defEff   = defender.def + TERRAIN[defenderTile].defBonus
//   jitter   = 0.9 + rng()*0.2            （rng 注入，确定性）
//   terrainAtkMod = 1                     （预留）
//   hit%     = clamp(85 + (atk.spd - def.spd) - TERRAIN[defenderTile].avoidBonus, 30, 100)
//   命中判定 : rng()*100 < hit% → 命中；未命中 → dmg 0、无反击
//   killed   : defender.curHp - dmg <= 0（不修改入参，仅报告）
//   counter  : 仅当守方存活 且 攻方位置在守方 counterRange 曼哈顿距离 [min,max] 内；
//              用同一公式攻守互换；弓兵 counterRange[0,0] → 无近战反击。
//
// 依赖：纯数据 CLASSES / TERRAIN + 同层 classTriangle（均不触碰 DOM/three）。

import { TERRAIN } from '../data/terrain.js';
import { CLASSES } from '../data/classes.js';
import { triangleMul } from './classTriangle.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 读取某格地形定义（tiles[r][c] = terrainId），找不到回退 grass。
function terrainAt(map, pos) {
  const id = map && map.tiles && map.tiles[pos.r] ? map.tiles[pos.r][pos.c] : undefined;
  return TERRAIN[id] || TERRAIN.grass;
}

const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

// 单次有向打击（attacker 打 defender），返回 { hit, dmg, killed }。
// 不修改入参；rng() 调用顺序：先命中、命中后再 jitter（确定性）。
function strike(attacker, defender, map, rng, log, label) {
  const defTerrain = terrainAt(map, defender.pos);
  const hitChance = clamp(
    85 + (attacker.spd - defender.spd) - defTerrain.avoidBonus,
    30,
    100
  );
  const roll = rng() * 100;
  const hit = roll < hitChance;
  if (!hit) {
    log.push(`${label}: ${attacker.name || attacker.classId} 未命中 ${defender.name || defender.classId}`);
    return { hit: false, dmg: 0, killed: false };
  }
  const tri = triangleMul(attacker.classId, defender.classId);
  const terrainAtkMod = 1; // 预留
  const defEff = defender.def + defTerrain.defBonus;
  const jitter = 0.9 + rng() * 0.2;
  const raw = (attacker.atk * tri * terrainAtkMod - defEff) * jitter;
  const dmg = Math.max(1, Math.round(raw));
  const killed = defender.curHp - dmg <= 0;
  log.push(
    `${label}: ${attacker.name || attacker.classId} 命中 ${defender.name || defender.classId} ` +
    `造成 ${dmg}（克制×${tri}${defTerrain.defBonus ? `, ${defTerrain.name}守+${defTerrain.defBonus}` : ''}）` +
    `${killed ? ' — 击杀！' : ''}`
  );
  return { hit: true, dmg, killed };
}

// 攻方是否落在守方反击范围内（曼哈顿距离 ∈ [min,max]；空区间如 [0,0] → 无反击）。
function inCounterRange(defender, attacker) {
  const cls = CLASSES[defender.classId];
  const range = (cls && cls.counterRange) || [1, 1];
  const [min, max] = range;
  if (max < min) return false; // 显式空区间
  const dist = manhattan(defender.pos, attacker.pos);
  // [0,0] 视为弓兵无近战反击：dist 至少为 1（攻击必相隔≥1），故落不进 [0,0]
  return dist >= min && dist <= max && dist >= 1;
}

/**
 * 结算一次攻击（含命中、相克、地形、击杀、反击）。不修改入参。
 * @param {object} attacker - Unit（读 atk/spd/classId/pos/curHp）
 * @param {object} defender - Unit（读 def/spd/classId/pos/curHp）
 * @param {object} map      - { tiles:[[terrainId]] }
 * @param {() => number} rng - 注入的 [0,1) 随机源（确定性）
 * @returns {{hit:boolean, dmg:number, killed:boolean, counter:{hit:boolean,dmg:number,killed:boolean}|null, log:string[]}}
 */
export function resolveAttack(attacker, defender, map, rng) {
  const log = [];
  const main = strike(attacker, defender, map, rng, log, '攻击');

  // 未命中：无伤害、无反击
  if (!main.hit) {
    return { hit: false, dmg: 0, killed: false, counter: null, log };
  }
  // 击杀：守方已亡，无反击
  if (main.killed) {
    return { hit: true, dmg: main.dmg, killed: true, counter: null, log };
  }
  // 守方存活：判定反击（攻方须在守方 counterRange 内）
  let counter = null;
  if (inCounterRange(defender, attacker)) {
    counter = strike(defender, attacker, map, rng, log, '反击');
  }
  return { hit: true, dmg: main.dmg, killed: false, counter, log };
}
