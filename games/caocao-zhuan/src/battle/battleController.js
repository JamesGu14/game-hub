// battle/battleController.js — 回合状态机（Task B5）
//
// 纯逻辑层：不得 import three，不得触碰 DOM。仅依赖 data/* 与同层 battle/* 模块、
// 以及（由外部注入的）rng / bus。所有渲染/UI/音频只通过 bus 事件被动消费本控制器的状态变化。
//
// 契约（plan §1.8 / 任务 B5 / UNIT 运行态契约）：
//
//   new BattleController(map, roster, { rng, bus })
//     - 由 map.deploy（查 GENERALS，faction 'wei'）+ map.enemies（faction 'foe'，
//       ai 取自 enemy.ai）构造 Unit 列表；按 GeneralDef.base（+ level>1 的成长）
//       计算 *顶层* 有效属性（maxHp/atk/def/int/spd/mov），curHp=maxHp，
//       hasMoved/hasActed=false, alive=true, pos 来自部署。
//   .units                                   Unit[]
//   .turn   (从 1 开始)
//   .phase  ('player' | 'enemy' | 'event' | 'resolved')
//   .map / .rng / .bus
//   .selectableTiles(unit) -> Map<"c,r",cost> 委托 pathfind.reachable（排除其余存活单位占格）
//   .moveUnit(unit, to)                       校验可达；更新 pos；hasMoved=true；emit 'unit:moved'
//   .attack(attacker, defender)               调 combat.resolveAttack；施加伤害；
//                                             击杀 alive=false + emit 'unit:died'；
//                                             leveling.gainExp 给攻方发经验（击杀/命中）；
//                                             反击伤害施于攻方（同样可致死/给守方发经验）；
//                                             hasActed=true；emit 'unit:attacked'；再 _checkEnd()
//   .endPlayerTurn()                          phase='enemy'，随后 runEnemyTurn()
//   .runEnemyTurn()                           逐个存活 foe 调 ai.planTurn 并经本类方法执行；
//                                             重置全体 hasMoved/hasActed；turn++；
//                                             emit 'turn:changed' {turn}（触发器在此时机）；
//                                             phase 回 'player'；_checkEnd()
//   _checkEnd()                               victory.evaluate；'win'→emit 'battle:win'，
//                                             'lose'→emit 'battle:lose'，并置 phase='resolved'
//
// 经验规则（任务示意值）：击杀 KILL_EXP=50，命中 HIT_EXP=10。

import { GENERALS } from '../data/generals.js';
import { CLASSES } from '../data/classes.js';
import { reachable as pfReachable, path as pfPath } from './pathfind.js';
import { resolveAttack } from './combat.js';
import { gainExp } from './leveling.js';
import { evaluate as evaluateVictory } from './victory.js';
import { planTurn } from './ai.js';
import { triangleMul } from './classTriangle.js';
import { canDuel, duelChallengeable } from './duel.js';
import { neighbors, tileAt } from './grid.js';
import { TERRAIN } from '../data/terrain.js';

const KILL_EXP = 50;
const HIT_EXP = 10;
// 单挑胜者经验（plan §1 / D2，约 40）。
const DUEL_EXP = 40;

const key = (c, r) => `${c},${r}`;
const manhattan = (a, b) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);

// 兵种的攻击区间（曼哈顿 [min,max]），缺省 [1,1]。
function atkRangeOf(unit) {
  const cls = CLASSES[unit.classId];
  return (cls && cls.atkRange) || [1, 1];
}

// 兵种移动型（'foot' | 'horse'），缺省 'foot'。
function moveTypeOf(unit) {
  const cls = CLASSES[unit.classId];
  return (cls && cls.moveType) || 'foot';
}

// 成长表：武将 growth 优先，其次兵种 growth，兜底全 0。
function growthOf(def) {
  if (def.growth) return def.growth;
  const cls = CLASSES[def.classId];
  return (cls && cls.growth) || { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };
}

/**
 * 由 GeneralDef + 战场布置项构造一个运行态 Unit（顶层有效属性）。
 * @param {object} def       GeneralDef（GENERALS[generalId]）
 * @param {object} placement { c, r, ai?, level?, exp? }
 * @param {'wei'|'foe'} faction
 */
function makeUnit(def, placement, faction) {
  const base = def.base || {};
  const level = placement.level || def.level || 1;
  const exp = placement.exp || 0;

  // 顶层有效属性从 base 起算（hp -> maxHp）。
  let maxHp = base.hp || 0;
  let atk = base.atk || 0;
  let dfn = base.def || 0;
  let intel = base.int || 0;
  let spd = base.spd || 0;
  const mov = base.mov || 0;

  // level>1：叠加 (level-1) 次成长。
  if (level > 1) {
    const g = growthOf(def);
    const lv = level - 1;
    maxHp += (g.hp || 0) * lv;
    atk += (g.atk || 0) * lv;
    dfn += (g.def || 0) * lv;
    intel += (g.int || 0) * lv;
    spd += (g.spd || 0) * lv;
  }

  return {
    id: def.id,
    name: def.name,
    title: def.title,
    faction,
    classId: def.classId,
    level,
    exp,
    maxHp,
    curHp: maxHp,
    atk,
    def: dfn,
    int: intel,
    spd,
    mov,
    pos: { c: placement.c, r: placement.r },
    hasMoved: false,
    hasActed: false,
    alive: true,
    // 玩家方 ai 恒为 null；敌方取布置项 ai（再退化到 def.ai）。
    ai: faction === 'foe' ? (placement.ai || def.ai || 'reckless') : null,
    skills: Array.isArray(def.skills) ? [...def.skills] : [],
    appearance: def.appearance ? { ...def.appearance } : {},
  };
}

// roster 项 -> { generalId } 规范化（支持纯字符串 id 或 {generalId,level,exp,...} 对象）。
function rosterEntry(item) {
  if (typeof item === 'string') return { generalId: item };
  if (item && typeof item === 'object') {
    return { generalId: item.generalId || item.id, level: item.level, exp: item.exp };
  }
  return null;
}

export class BattleController {
  /**
   * @param {object} map    战役地图（plan §1.6）：{cols,rows,tiles,deploy,enemies,victory,defeat,triggers?}
   * @param {Array}  roster 玩家武将名册：[generalId] 或 [{generalId,level,exp}]（用于覆盖 deploy 的等级/经验）
   * @param {{rng:()=>number, bus:{on,off,emit}}} opts
   */
  constructor(map, roster, { rng, bus } = {}) {
    this.map = map;
    this.rng = rng || Math.random;
    this.bus = bus || { on() {}, off() {}, emit() {} };
    this.turn = 1;
    this.phase = 'player';
    this.units = [];

    // roster 覆盖表：generalId -> {level,exp}（玩家持久化进度）
    const rosterById = new Map();
    for (const item of roster || []) {
      const e = rosterEntry(item);
      if (e && e.generalId) rosterById.set(e.generalId, e);
    }

    // 我方（wei）：来自 map.deploy
    for (const d of map.deploy || []) {
      const def = GENERALS[d.generalId];
      if (!def) continue;
      const over = rosterById.get(d.generalId) || {};
      this.units.push(
        makeUnit(def, { c: d.c, r: d.r, level: over.level, exp: over.exp }, 'wei'),
      );
    }

    // 敌方（foe）：来自 map.enemies，ai 取布置项
    for (const e of map.enemies || []) {
      const def = GENERALS[e.generalId];
      if (!def) continue;
      this.units.push(makeUnit(def, { c: e.c, r: e.r, ai: e.ai }, 'foe'));
    }
  }

  // ---- 内部查询 -----------------------------------------------------------

  /** 存活单位。 */
  livingUnits() {
    return this.units.filter((u) => u.alive);
  }

  /** 当前被占格集合（存活单位），可排除某个单位（移动者自身）。 */
  _occupiedSet(exclude) {
    const occ = new Set();
    for (const u of this.units) {
      if (!u.alive) continue;
      if (u === exclude) continue;
      occ.add(key(u.pos.c, u.pos.r));
    }
    return occ;
  }

  /** (c,r) 处存活单位（如有）。 */
  _unitAt(c, r) {
    return this.units.find((u) => u.alive && u.pos.c === c && u.pos.r === r) || null;
  }

  // ---- 玩家相位动作 -------------------------------------------------------

  /**
   * 该单位本回合可移动到的格 -> Map<"c,r",cost>（委托 pathfind，排除其它存活单位占格）。
   */
  selectableTiles(unit) {
    const occupied = this._occupiedSet(unit);
    return pfReachable(unit, this.map, occupied);
  }

  /**
   * 移动单位到 to（须在 selectableTiles 内）；更新 pos、hasMoved；emit 'unit:moved'。
   * 非法（不可达）则抛错，不改状态。
   */
  moveUnit(unit, to) {
    if (!unit || !unit.alive) throw new Error('moveUnit: unit not alive');
    const reach = this.selectableTiles(unit);
    const tKey = key(to.c, to.r);
    if (!reach.has(tKey)) {
      throw new Error(`moveUnit: target ${tKey} not reachable (unreachable)`);
    }
    const from = { c: unit.pos.c, r: unit.pos.r };
    const occupied = this._occupiedSet(unit);
    const movePath = pfPath(this.map, from, to, moveTypeOf(unit), occupied);
    unit.pos = { c: to.c, r: to.r };
    unit.hasMoved = true;
    this.bus.emit('unit:moved', { unit, from, to: { c: to.c, r: to.r }, path: movePath });
    return unit;
  }

  /**
   * 结算一次攻击：施伤、击杀、反击、发经验、emit 事件，最后 _checkEnd。
   * @returns combat.resolveAttack 的结果对象（{hit,dmg,killed,counter,log}）。
   */
  attack(attacker, defender) {
    if (!attacker || !attacker.alive) throw new Error('attack: attacker not alive');
    if (!defender || !defender.alive) throw new Error('attack: defender not alive');

    const result = resolveAttack(attacker, defender, this.map, this.rng);

    // 主攻命中 -> 施伤于守方
    if (result.hit) {
      defender.curHp -= result.dmg;
      // 攻方发经验：命中 HIT_EXP，击杀额外 KILL_EXP。
      gainExp(attacker, result.killed ? KILL_EXP : HIT_EXP);
      if (defender.curHp <= 0 || result.killed) {
        defender.curHp = Math.min(defender.curHp, 0);
        if (defender.alive) {
          defender.alive = false;
          this.bus.emit('unit:died', { unit: defender });
        }
      }
    }

    // 反击 -> 施伤于攻方（仅当 combat 返回 counter）
    if (result.counter && result.counter.hit) {
      attacker.curHp -= result.counter.dmg;
      // 守方（反击者）发经验
      gainExp(defender, result.counter.killed ? KILL_EXP : HIT_EXP);
      if (attacker.curHp <= 0 || result.counter.killed) {
        attacker.curHp = Math.min(attacker.curHp, 0);
        if (attacker.alive) {
          attacker.alive = false;
          this.bus.emit('unit:died', { unit: attacker });
        }
      }
    }

    attacker.hasActed = true;
    this.bus.emit('unit:attacked', { attacker, defender, result });

    this._checkEnd();
    return result;
  }

  // ---- 单挑（duel）钩子 ---------------------------------------------------

  /**
   * 该单位本回合可发起单挑的目标列表：存活、敌方、与 unit 曼哈顿距离 1，
   * 且 duelChallengeable(unit,target) 通过（近战发起方 + 异阵营 + 双方存活）。
   * 发起方须可单挑（canDuel）且尚未行动（!hasActed）；否则返回空数组。
   * @param {object} unit 发起方
   * @returns {object[]} 可挑战的敌方 units
   */
  canDuelTargets(unit) {
    if (!unit || !unit.alive) return [];
    if (!canDuel(unit)) return [];
    if (unit.hasActed) return [];
    return this.units.filter(
      (t) =>
        t !== unit &&
        t.alive &&
        manhattan(unit.pos, t.pos) === 1 &&
        duelChallengeable(unit, t),
    );
  }

  /**
   * 把单挑结果回写主战场（plan §1 / D2）。
   *   - 败者 curHp = loserHpAfter；若 <=0 → alive=false 并 emit 'unit:died'。
   *   - fled：把败者退走到相邻可通行空格（若有）。
   *   - 胜者经验 leveling.gainExp(~40)。
   *   - 发起者（胜者若是己方，否则参战的 wei 一方）hasActed=true。
   *   - emit 'duel:end' {winnerId,loserId,fled}，随后 _checkEnd()。
   * @param {{winnerId:string|null, loserId:string|null, loserHpAfter:number, fled:boolean, expGain?:number}} outcome
   */
  applyDuelOutcome({ winnerId, loserId, loserHpAfter, fled } = {}) {
    const winner = winnerId != null ? this.units.find((u) => u.id === winnerId) : null;
    const loser = loserId != null ? this.units.find((u) => u.id === loserId) : null;

    if (loser) {
      loser.curHp = loserHpAfter;
      if (loser.curHp <= 0) {
        loser.curHp = Math.min(loser.curHp, 0);
        if (loser.alive) {
          loser.alive = false;
          this.bus.emit('unit:died', { unit: loser });
        }
      } else if (fled) {
        // 退走：移到相邻可通行的空格（若有）。
        const spot = this._retreatTile(loser);
        if (spot) {
          const from = { c: loser.pos.c, r: loser.pos.r };
          loser.pos = { c: spot.c, r: spot.r };
          this.bus.emit('unit:moved', { unit: loser, from, to: { c: spot.c, r: spot.r }, path: [spot] });
        }
      }
    }

    // 胜者发经验（~40）。
    if (winner && winner.alive) {
      gainExp(winner, DUEL_EXP);
    }

    // 发起者标记已行动：胜者若属玩家方(wei)则取胜者，否则取参战的 wei 一方。
    const initiator =
      winner && winner.faction === 'wei'
        ? winner
        : [winner, loser].find((u) => u && u.faction === 'wei');
    if (initiator) initiator.hasActed = true;

    this.bus.emit('duel:end', { winnerId: winnerId || null, loserId: loserId || null, fled: !!fled });

    this._checkEnd();
  }

  /** 在败者四邻找一个界内、可通行、未被其它存活单位占据的空格用于退走。 */
  _retreatTile(loser) {
    const occupied = this._occupiedSet(loser);
    for (const nb of neighbors(this.map, loser.pos.c, loser.pos.r)) {
      const tid = tileAt(this.map, nb.c, nb.r);
      const def = TERRAIN[tid];
      if (!def || def.passable === false) continue;
      if (occupied.has(key(nb.c, nb.r))) continue;
      return nb;
    }
    return null;
  }

  // ---- 相位流转 -----------------------------------------------------------

  /** 结束玩家相位 -> 敌方相位 -> 跑敌方回合。 */
  endPlayerTurn() {
    if (this.phase === 'resolved') return;
    this.phase = 'enemy';
    this.runEnemyTurn();
  }

  /**
   * 敌方回合：逐个存活 foe 调 ai.planTurn 执行 move/attack；
   * 然后重置 hasMoved/hasActed，turn++，emit 'turn:changed'，回玩家相位，_checkEnd。
   */
  runEnemyTurn() {
    if (this.phase === 'resolved') return;
    this.phase = 'enemy';

    const foes = this.units.filter((u) => u.faction === 'foe' && u.alive);
    for (const foe of foes) {
      if (!foe.alive) continue;
      if (this.phase === 'resolved') break;
      this._runOneEnemy(foe);
    }

    if (this.phase === 'resolved') return; // 敌方回合中已分胜负

    // 新回合：重置全体行动标记
    for (const u of this.units) {
      u.hasMoved = false;
      u.hasActed = false;
    }
    this.turn += 1;
    this.phase = 'event';
    // 回合开始触发器（map.triggers 中 on:'turnStart'）：发事件，由 story 层接管。
    this._fireTurnStartTriggers();
    this.bus.emit('turn:changed', { phase: 'player', turn: this.turn });
    this.phase = 'player';
    this._checkEnd();
  }

  /** 执行单个敌方单位的 AI 计划（move 然后 attack）。 */
  _runOneEnemy(foe) {
    const state = this._aiState();
    let plan;
    try {
      plan = planTurn(foe, state);
    } catch {
      plan = [];
    }
    if (!Array.isArray(plan)) return;

    for (const action of plan) {
      if (!foe.alive || this.phase === 'resolved') break;
      if (action.kind === 'move' && action.to) {
        // AI 落点应已在可达集内；保险起见再校验，不可达则跳过移动。
        const reach = this.selectableTiles(foe);
        if (reach.has(key(action.to.c, action.to.r))) {
          this.moveUnit(foe, action.to);
        }
      } else if (action.kind === 'attack') {
        const target = this._resolveAttackTarget(action, foe);
        if (target && target.alive && this._inAttackRange(foe, target)) {
          this.attack(foe, target);
        }
      }
    }
  }

  // 解析 AI 攻击动作的目标（支持 targetId / target 对象 / {c,r}）。
  _resolveAttackTarget(action, attacker) {
    if (action.targetId != null) {
      return this.units.find((u) => u.id === action.targetId && u.alive) || null;
    }
    if (action.target && action.target.id != null) {
      return this.units.find((u) => u.id === action.target.id && u.alive) || null;
    }
    if (action.to && typeof action.to.c === 'number') {
      return this._unitAt(action.to.c, action.to.r);
    }
    return null;
  }

  /** 攻方按其兵种 atkRange 能否打到守方（曼哈顿距离判定）。 */
  _inAttackRange(attacker, defender) {
    const [mn, mx] = atkRangeOf(attacker);
    const d = manhattan(attacker.pos, defender.pos);
    return d >= mn && d <= mx;
  }

  /**
   * 为 ai.planTurn 构造 battleState 门面：
   *   units / map / occupied
   *   reachable(unit) -> Map（含起点 cost 0；委托 pathfind 并排除占格）
   *   path(from,to)   -> [{c,r}...]（含起点与终点；委托 pathfind 并前置起点）
   *   inAttackRange(attacker,defender) / triangleMul(aCls,dCls)
   */
  _aiState() {
    const self = this;
    return {
      units: this.units,
      map: this.map,
      occupied: this._occupiedSet(null),
      reachable(unit) {
        const occ = self._occupiedSet(unit);
        const m = pfReachable(unit, self.map, occ);
        // AI 约定 reachable 含起点（cost 0），pathfind 不含 —— 在门面补上。
        m.set(key(unit.pos.c, unit.pos.r), 0);
        return m;
      },
      path(from, to) {
        // 找到该 from 对应的单位以确定 moveType（默认 foot）。
        const mover = self.units.find(
          (u) => u.alive && u.pos.c === from.c && u.pos.r === from.r,
        );
        const moveType = mover ? moveTypeOf(mover) : 'foot';
        const occ = mover ? self._occupiedSet(mover) : self._occupiedSet(null);
        const p = pfPath(self.map, from, to, moveType, occ);
        // pathfind 排除起点；AI 约定 path 含起点与终点 —— 前置起点。
        return [{ c: from.c, r: from.r }, ...p];
      },
      inAttackRange(attacker, defender) {
        return self._inAttackRange(attacker, defender);
      },
      triangleMul(aCls, dCls) {
        return triangleMul(aCls, dCls);
      },
    };
  }

  // ---- 触发器 / 胜负 ------------------------------------------------------

  /** 触发 map.triggers 中 on:'turnStart' 且 turn 匹配的项（emit 'scenario:done' 之外仅通报 id）。 */
  _fireTurnStartTriggers() {
    const triggers = (this.map && this.map.triggers) || [];
    for (const t of triggers) {
      if (t.on === 'turnStart' && t.turn === this.turn && t.scenarioId) {
        // 把回合开始剧情触发交给上层（story 层订阅）；不在纯逻辑层播放。
        this.bus.emit('camera:cinematic', { trigger: t, scenarioId: t.scenarioId });
      }
    }
  }

  /** 胜负判定：命中则 emit 'battle:win'/'battle:lose' 并置 phase='resolved'。 */
  _checkEnd() {
    if (this.phase === 'resolved') return;
    const outcome = evaluateVictory({ units: this.units, turn: this.turn, map: this.map });
    if (outcome === 'win') {
      this.phase = 'resolved';
      this.bus.emit('battle:win', { battleState: this });
    } else if (outcome === 'lose') {
      this.phase = 'resolved';
      this.bus.emit('battle:lose', { battleState: this });
    }
  }
}

export default BattleController;
