// battle/duel.js — 单挑状态机（纯逻辑，禁止 import three / 触碰 DOM）
//
// 契约（plan §1）：
//   canDuel(unit)                       近战类(leader/infantry/spear/cavalry)→true；archer/strategist→false
//   duelChallengeable(attacker,defender) attacker.canDuel && defender 存活 && 双方异阵营
//   class Duel(a, b, { rng })           a=发起/玩家侧，b=对手；HP 取自 curHp（伤害直接带回战场）
//     .actions()  -> [{id,label,desc}]  固定 5 个：attack/power/defend/risk/retreat
//     .state      -> { a,b, aId,bId, aHp,bHp, maxA,maxB, round, maxRounds:6,
//                      over,winner,loser,fled, log:[] }
//     .step(playerActionId) -> RoundResult
//   duelOutcome(duel) -> { winnerId,loserId,loserHpAfter,fled,expGain }
//
// 数值（plan §1）：jitter=0.9+rng()*0.2
//   attack : dmg=max(1,round((atk - def*0.5)*jitter))，命中~90%
//   power  : dmg≈1.6×attack，命中~70%；miss → 本回合自身受击 +25%（露破绽）
//   defend : 本回合受到的伤害 ×0.5；若被攻击则反击 0.4×attack
//   risk   : dmg≈1.9×attack，且自身本回合受击 ×1.3
//   retreat: 成功率=clamp(50+(self.spd-foe.spd)*3,20,90)；成功→fled 结束；失败→白挨一次 attack
//   maxRounds 6：到顶双方仍存活 → 比 HP% 高者胜（败者不死、留残血）。
//
// rng 消耗顺序（确定性，单测据此构造序列）：每回合
//   1) 玩家行动结算（其内部按需消耗：strike=命中 roll + jitter；retreat=1 roll）
//   2) 敌方行动结算（同上）
//   敌方“选哪个行动”不消耗注入 rng（用内部 _aiRoll 的状态哈希），以保持序列稳定。
//
// 依赖：data/classes.js（兵种近战判定）、battle/duelAi.js（敌方决策）。core/rng 由调用方注入。

import { CLASSES } from '../data/classes.js';
import { pickDuelAction } from './duelAi.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 近战兵种（可主动发起单挑）
const MELEE_CLASSES = new Set(['leader', 'infantry', 'spear', 'cavalry']);

function unitAlive(u) {
  return !!u && u.alive !== false && (u.curHp === undefined || u.curHp > 0);
}

/** 是否为近战兵种（可单挑）。 */
export function canDuel(unit) {
  if (!unit) return false;
  const cls = unit.classId;
  // 直接按兵种 id 判定；CLASSES 仅用于校验 id 合法性（不强制）。
  if (MELEE_CLASSES.has(cls)) return true;
  if (CLASSES[cls]) return false; // 已知兵种但非近战（archer/strategist）
  return false;
}

/** 发起方可否向 defender 发起单挑：近战发起方 + 异阵营 + 双方存活。 */
export function duelChallengeable(attacker, defender) {
  if (!attacker || !defender) return false;
  if (!canDuel(attacker)) return false;
  if (!unitAlive(attacker) || !unitAlive(defender)) return false;
  if (attacker.faction === defender.faction) return false;
  return true;
}

// 固定行动集合
const ACTIONS = [
  { id: 'attack', label: '普攻', desc: '稳健出招，命中高、伤害中等。' },
  { id: 'power', label: '强攻', desc: '全力一击，伤害高但易落空；落空则露破绽多受伤。' },
  { id: 'defend', label: '防御', desc: '本回合受伤减半，并对来犯者小幅反击。' },
  { id: 'risk', label: '拼命', desc: '舍身猛攻，重创对手但自身也多受伤。' },
  { id: 'retreat', label: '撤退', desc: '凭脚程脱离；速度越高越易成功，失败则白挨一击。' },
];

// 单次普攻基础伤害（不含倍率）：max(1, round((atk - def*0.5)*jitter))
function baseHit(atkU, defU, jitter) {
  const raw = ((atkU.atk || 0) - (defU.def || 0) * 0.5) * jitter;
  return Math.max(1, Math.round(raw));
}

export class Duel {
  constructor(a, b, { rng } = {}) {
    this.a = a;
    this.b = b;
    this._rng = typeof rng === 'function' ? rng : Math.random;
    // 内部 AI 决策用的独立状态（不消耗注入 rng，保证战斗 rng 序列稳定可测）。
    this._aiSeed = 0x9e3779b9 >>> 0;

    this.state = {
      a,
      b,
      aId: a.id,
      bId: b.id,
      aHp: a.curHp,
      bHp: b.curHp,
      maxA: a.maxHp != null ? a.maxHp : a.curHp,
      maxB: b.maxHp != null ? b.maxHp : b.curHp,
      round: 0,
      maxRounds: 6,
      over: false,
      winner: null,
      loser: null,
      fled: false,
      log: [],
    };
  }

  actions() {
    // 返回副本，避免外部篡改常量。
    return ACTIONS.map((x) => ({ ...x }));
  }

  // 敌方“选哪个行动”用的确定性伪随机（依当前局势状态哈希；不动注入 rng）。
  _aiRoll() {
    let a = (this._aiSeed + this.state.round * 0x6d2b79f5 + this.state.bHp * 374761393 + this.state.aHp) | 0;
    a = Math.imul(a ^ (a >>> 15), 1 | a);
    a = (a + Math.imul(a ^ (a >>> 7), 61 | a)) ^ a;
    const v = ((a ^ (a >>> 14)) >>> 0) / 4294967296;
    this._aiSeed = (this._aiSeed + 0x6d2b79f5) | 0;
    return v;
  }

  jitter() {
    return 0.9 + this._rng() * 0.2;
  }

  // 命中判定：roll(rng*100) < hitChance
  _rollHit(hitChance) {
    return this._rng() * 100 < hitChance;
  }

  /**
   * 推进一回合。actorIsA=true 时 player(a) 用 playerActionId、enemy(b) 用 AI；
   * 双方伤害累入 acc，并标注修饰（防御减伤、露破绽、拼命）。
   * @returns {RoundResult}
   */
  step(playerActionId) {
    const s = this.state;
    if (s.over) {
      // 已结束：返回一个无副作用的快照
      return {
        playerAction: playerActionId,
        enemyAction: null,
        dmgToEnemy: 0,
        dmgToPlayer: 0,
        aHp: s.aHp,
        bHp: s.bHp,
        defended: false,
        over: true,
        winner: s.winner,
        loser: s.loser,
        fled: s.fled,
        line: '胜负已分。',
      };
    }

    s.round += 1;
    const enemyAction = pickDuelAction(this.b, this.a, s, () => this._aiRoll());

    // 本回合双方意图（含防御标记，用于减伤/反击；露破绽/拼命用于受击放大）
    const pA = { id: playerActionId, defending: playerActionId === 'defend' };
    const eB = { id: enemyAction, defending: enemyAction === 'defend' };

    // 累积伤害（结算完一并应用，避免“先死再被打”的次序问题）
    let dmgToEnemy = 0; // a 造成给 b
    let dmgToPlayer = 0; // b 造成给 a
    let fled = false;
    const lines = [];

    // ---- 玩家(a) 行动 ----
    const pRes = this._resolveAction(this.a, this.b, pA, eB);
    dmgToEnemy += pRes.dmgToFoe;
    dmgToPlayer += pRes.dmgToSelf; // 例：power miss 不在此，attack 无自伤
    if (pRes.fled) fled = true;
    if (pRes.line) lines.push(pRes.line);
    // 玩家行动对自身受击的“修饰”（power miss 露破绽 / risk 自身放大）由 enemy 打击时套用
    const playerVuln = pRes.selfVulnMul; // 1, 1.25(power miss), 1.3(risk)

    // 撤退成功：立即结束（不再结算敌方）
    if (fled) {
      this._applyDamage(dmgToEnemy, dmgToPlayer);
      s.fled = true;
      s.over = true;
      s.winner = null;
      // 败者=撤退方(玩家 a)，双方均不死
      s.loser = this.a.id;
      const rr = this._roundResult(playerActionId, enemyAction, dmgToEnemy, dmgToPlayer, pA.defending, lines);
      return rr;
    }

    // ---- 敌方(b) 行动 ----
    const eRes = this._resolveAction(this.b, this.a, eB, pA);
    dmgToPlayer += eRes.dmgToFoe; // b 打 a
    dmgToEnemy += eRes.dmgToSelf;
    if (eRes.line) lines.push(eRes.line);
    const enemyVuln = eRes.selfVulnMul;

    // 应用“受击修饰”：玩家 power-miss / risk 使其受击放大（作用于敌方造成的伤害）
    if (playerVuln && playerVuln !== 1 && eRes.dmgToFoe > 0) {
      const extra = Math.round(eRes.dmgToFoe * (playerVuln - 1));
      dmgToPlayer += extra;
    }
    // 敌方 power-miss / risk 同理放大其受到的伤害（来自玩家普通打击 pRes.dmgToFoe）
    if (enemyVuln && enemyVuln !== 1 && pRes.dmgToFoe > 0) {
      const extra = Math.round(pRes.dmgToFoe * (enemyVuln - 1));
      dmgToEnemy += extra;
    }

    // 防御减伤：若一方防御，则其本回合“受到的伤害”×0.5（作用于对方造成的总伤）
    if (pA.defending) dmgToPlayer = Math.round(dmgToPlayer * 0.5);
    if (eB.defending) dmgToEnemy = Math.round(dmgToEnemy * 0.5);

    this._applyDamage(dmgToEnemy, dmgToPlayer);

    // 判定结束
    this._checkOver(playerActionId, enemyAction);

    const rr = this._roundResult(playerActionId, enemyAction, dmgToEnemy, dmgToPlayer, pA.defending, lines);
    return rr;
  }

  // 结算单个角色 actor 对 target 的行动；返回 {dmgToFoe,dmgToSelf,fled,selfVulnMul,line}
  // 注：reaction（防御反击）在防御方一侧产出；减伤/受击放大在 step 汇总时统一套。
  _resolveAction(actor, target, intent, foeIntent) {
    const out = { dmgToFoe: 0, dmgToSelf: 0, fled: false, selfVulnMul: 1, line: '' };
    const name = actor.name || actor.classId;
    const tname = target.name || target.classId;

    switch (intent.id) {
      case 'attack': {
        const hit = this._rollHit(90);
        if (!hit) {
          this._rng(); // 维持 jitter 槽位一致性（未命中不计伤）
          out.line = `${name} 出招被 ${tname} 闪过。`;
          return out;
        }
        const j = this.jitter();
        out.dmgToFoe = baseHit(actor, target, j);
        out.line = `${name} 一击命中，伤 ${out.dmgToFoe}。`;
        return out;
      }
      case 'power': {
        const hit = this._rollHit(70);
        if (!hit) {
          this._rng();
          out.selfVulnMul = 1.25; // 露破绽：本回合自身受击 +25%
          out.line = `${name} 强攻落空，露出破绽！`;
          return out;
        }
        const j = this.jitter();
        out.dmgToFoe = Math.max(1, Math.round(baseHit(actor, target, j) * 1.6));
        out.line = `${name} 强攻得手，重创 ${out.dmgToFoe}！`;
        return out;
      }
      case 'risk': {
        const hit = this._rollHit(85);
        if (!hit) {
          this._rng();
          out.selfVulnMul = 1.3; // 拼命无论命中都更易受伤
          out.line = `${name} 拼命一搏却落空，门户大开！`;
          return out;
        }
        const j = this.jitter();
        out.dmgToFoe = Math.max(1, Math.round(baseHit(actor, target, j) * 1.9));
        out.selfVulnMul = 1.3; // 自身本回合受击 ×1.3
        out.line = `${name} 不顾自身猛攻，伤 ${out.dmgToFoe}！`;
        return out;
      }
      case 'defend': {
        // 防御本身不主动出伤；若对方意图为攻击型(attack/power/risk)，则小反击 0.4×attack。
        const foeAttacks = ['attack', 'power', 'risk'].includes(foeIntent && foeIntent.id);
        if (foeAttacks) {
          const j = this.jitter();
          const counter = Math.max(1, Math.round(baseHit(actor, target, j) * 0.4));
          out.dmgToFoe = counter;
          out.line = `${name} 严防回刺，反击 ${counter}。`;
        } else {
          out.line = `${name} 凝神戒备。`;
        }
        return out;
      }
      case 'retreat': {
        const rate = clamp(50 + ((actor.spd || 0) - (target.spd || 0)) * 3, 20, 90);
        const ok = this._rng() * 100 < rate;
        if (ok) {
          out.fled = true;
          out.line = `${name} 拨马退走，脱离战团。`;
        } else {
          // 失败：白挨一次对方 attack（用对方 attack 公式，命中固定，吃一记普攻）
          const j = this.jitter();
          out.dmgToSelf = baseHit(target, actor, j);
          out.line = `${name} 撤退不及，被 ${tname} 追击 ${out.dmgToSelf}！`;
        }
        return out;
      }
      default: {
        // 未知行动 → 当普攻处理（稳健兜底）
        const hit = this._rollHit(90);
        if (!hit) {
          this._rng();
          out.line = `${name} 出招落空。`;
          return out;
        }
        const j = this.jitter();
        out.dmgToFoe = baseHit(actor, target, j);
        out.line = `${name} 出招命中，伤 ${out.dmgToFoe}。`;
        return out;
      }
    }
  }

  _applyDamage(dmgToEnemy, dmgToPlayer) {
    this.state.bHp = this.state.bHp - dmgToEnemy;
    this.state.aHp = this.state.aHp - dmgToPlayer;
  }

  _checkOver(playerAction, enemyAction) {
    const s = this.state;
    const aDead = s.aHp <= 0;
    const bDead = s.bHp <= 0;
    if (aDead || bDead) {
      s.over = true;
      if (bDead && !aDead) {
        s.winner = this.a.id;
        s.loser = this.b.id;
      } else if (aDead && !bDead) {
        s.winner = this.b.id;
        s.loser = this.a.id;
      } else {
        // 同归于尽：HP% 高者胜（都<=0 时按更接近 0 者败；并列则玩家 a 胜）
        const pa = s.maxA ? s.aHp / s.maxA : 0;
        const pb = s.maxB ? s.bHp / s.maxB : 0;
        if (pb < pa) {
          s.winner = this.a.id;
          s.loser = this.b.id;
        } else if (pa < pb) {
          s.winner = this.b.id;
          s.loser = this.a.id;
        } else {
          s.winner = this.a.id;
          s.loser = this.b.id;
        }
      }
      s.log.push('胜负已分。');
      return;
    }
    // 回合上限：双方仍存活 → 比 HP%，败者不死。
    if (s.round >= s.maxRounds) {
      s.over = true;
      const pa = s.maxA ? s.aHp / s.maxA : 0;
      const pb = s.maxB ? s.bHp / s.maxB : 0;
      if (pa >= pb) {
        s.winner = this.a.id;
        s.loser = this.b.id;
      } else {
        s.winner = this.b.id;
        s.loser = this.a.id;
      }
      s.log.push('回合用尽，按伤势论胜负。');
    }
  }

  _roundResult(playerAction, enemyAction, dmgToEnemy, dmgToPlayer, defended, lines) {
    const s = this.state;
    for (const l of lines) if (l) s.log.push(l);
    const line = lines.filter(Boolean).join(' ') || `第 ${s.round} 回合。`;
    return {
      playerAction,
      enemyAction,
      dmgToEnemy,
      dmgToPlayer,
      aHp: s.aHp,
      bHp: s.bHp,
      defended: !!defended,
      over: s.over,
      winner: s.over ? s.winner : null,
      loser: s.over ? s.loser : null,
      fled: s.fled,
      line,
    };
  }
}

/**
 * 取单挑结果（用于回写主战场）。
 * @param {Duel} duel
 * @returns {{winnerId:string|null, loserId:string|null, loserHpAfter:number, fled:boolean, expGain:number}}
 */
export function duelOutcome(duel) {
  const s = duel.state;
  const winnerId = s.winner;
  const loserId = s.loser;
  // 败者剩余 HP（其 duel HP，直接写回 curHp）：fled 时不致死（下限 1）。
  let loserHpAfter;
  if (loserId === s.aId) loserHpAfter = s.aHp;
  else if (loserId === s.bId) loserHpAfter = s.bHp;
  else loserHpAfter = 0;

  if (s.fled) {
    // 撤退：双方均不死，败者(撤退方)至少留 1 滴血。
    loserHpAfter = Math.max(1, loserHpAfter);
  } else {
    // 阵亡判定保留 0 / 负；回合上限胜负则败者本就 >0。
    loserHpAfter = Math.round(loserHpAfter);
  }

  // 经验：胜者得 40；撤退（无胜者）不给经验。
  const expGain = !s.fled && winnerId ? 40 : 0;

  return { winnerId: winnerId || null, loserId: loserId || null, loserHpAfter, fled: !!s.fled, expGain };
}

export default { canDuel, duelChallengeable, Duel, duelOutcome };
