// battle/duelAi.js — 单挑 AI 行动选择（纯逻辑，禁止 import three / 触碰 DOM）
//
// 契约（plan §1）：
//   pickDuelAction(self, foe, state)  -> actionId
//     按 self.ai 性格 + 自身 hp% + 武力差(self.atk - foe.def 近似) 加权：
//       reckless → 多 power/risk
//       cautious → 残血(低 hp%) defend/retreat；优势(高 hp% 且对手低/武力占优) attack
//       guard/默认 → 均衡 attack/defend
//   actionId ∈ {'attack','power','defend','risk','retreat'}
//
// 测试需要确定性，故允许可选第 4 参 rng（()=>[0,1)）。生产环境（Duel.step）
// 会把自身注入的 rng 透传进来；缺省退化为 Math.random（保持 plan 的 3 参主契约）。
//
// 实现：为每个行动算一个非负权重（依性格/局势），按权重做轮盘选择（rng 决定落点）。

const ACTION_IDS = ['attack', 'power', 'defend', 'risk', 'retreat'];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// 自身在 state 中是 a 侧还是 b 侧（用 id 匹配）。
function selfHpPct(self, state) {
  if (!state) return 1;
  if (self && state.aId !== undefined && self.id === state.aId) {
    return state.maxA ? state.aHp / state.maxA : 1;
  }
  if (self && state.bId !== undefined && self.id === state.bId) {
    return state.maxB ? state.bHp / state.maxB : 1;
  }
  // 无 aId/bId 时：按 atk/curHp 推断不可靠，退化用 state 提供的 self 侧。
  // 约定：duelAi 由 Duel.step 调用时 self 恒为 b 侧（敌方），故默认读 b。
  if (state.maxB) return state.bHp / state.maxB;
  return 1;
}

function foeHpPct(self, state) {
  if (!state) return 1;
  if (self && state.aId !== undefined && self.id === state.aId) {
    return state.maxB ? state.bHp / state.maxB : 1;
  }
  if (self && state.bId !== undefined && self.id === state.bId) {
    return state.maxA ? state.aHp / state.maxA : 1;
  }
  if (state.maxA) return state.aHp / state.maxA;
  return 1;
}

// 武力优势：self 估算单击伤害（atk - foe.def*0.5）相对 foe 反打的比值（>0 表示占优）。
function powerEdge(self, foe) {
  const selfHit = Math.max(1, (self.atk || 0) - (foe.def || 0) * 0.5);
  const foeHit = Math.max(1, (foe.atk || 0) - (self.def || 0) * 0.5);
  return (selfHit - foeHit) / Math.max(selfHit, foeHit); // -1..1
}

// 依性格/局势给出各行动权重（非负）。
function weights(self, foe, state) {
  const hp = clamp(selfHpPct(self, state), 0, 1);
  const fhp = clamp(foeHpPct(self, state), 0, 1);
  const edge = powerEdge(self, foe); // -1..1，正=自己占优
  const low = hp < 0.35; // 残血阈值
  const favorable = edge > 0.1 || fhp < 0.4; // 占优或对手残血

  // 基线均衡权重
  const w = { attack: 3, power: 1.5, defend: 2, risk: 1, retreat: 0.6 };

  const ai = self && self.ai;
  if (ai === 'reckless') {
    // 激进：大幅抬高 power/risk，压低防守/撤退
    w.attack = 2;
    w.power = 5 + edge * 2;
    w.risk = 4 + (favorable ? 2 : 0);
    w.defend = 0.5;
    w.retreat = low ? 0.6 : 0.1; // 几乎不退；极残血略升
  } else if (ai === 'cautious') {
    if (low) {
      // 残血：保命为主
      w.attack = 0.8;
      w.power = 0.3;
      w.risk = 0.2;
      w.defend = 4;
      w.retreat = 4 + (edge < 0 ? 2 : 0); // 劣势更想退
    } else if (favorable) {
      // 优势：进攻
      w.attack = 5;
      w.power = 2 + Math.max(0, edge) * 2;
      w.risk = 1;
      w.defend = 1;
      w.retreat = 0.2;
    } else {
      // 均势/略劣但血量尚可：稳健，攻防兼顾
      w.attack = 3;
      w.power = 1;
      w.risk = 0.5;
      w.defend = 3;
      w.retreat = 1;
    }
  } else {
    // guard / 默认：均衡，attack+defend 为主；局势微调
    w.attack = 3 + Math.max(0, edge) * 1.5;
    w.power = 1.5;
    w.defend = 3 + (low ? 1.5 : 0);
    w.risk = low ? 0.4 : 1;
    w.retreat = low ? 1.5 : 0.4; // 平时少退，残血略升但仍不主导
  }

  // 全程保证非负
  for (const k of ACTION_IDS) w[k] = Math.max(0, w[k] || 0);
  return w;
}

/**
 * 选择敌方（self）的单挑行动。
 * @param {object} self - 行动方 Unit（读 ai/atk/def/spd/id）
 * @param {object} foe  - 对手 Unit
 * @param {object} state - Duel.state（读 aHp/bHp/maxA/maxB、可选 aId/bId）
 * @param {() => number} [rng] - 可选确定性随机源；缺省 Math.random
 * @returns {string} actionId ∈ {'attack','power','defend','risk','retreat'}
 */
export function pickDuelAction(self, foe, state, rng = Math.random) {
  const w = weights(self || {}, foe || {}, state || {});
  const total = ACTION_IDS.reduce((s, id) => s + w[id], 0);
  if (!(total > 0)) return 'attack'; // 兜底
  let roll = clamp(rng(), 0, 0.999999) * total;
  for (const id of ACTION_IDS) {
    roll -= w[id];
    if (roll < 0) return id;
  }
  return 'attack';
}

export default { pickDuelAction };
