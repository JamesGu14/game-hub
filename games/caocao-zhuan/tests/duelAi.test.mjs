// tests/duelAi.test.mjs — 单挑 AI 行动选择（纯逻辑，Node 直跑）
// 运行：node games/caocao-zhuan/tests/duelAi.test.mjs
//
// 契约（plan §1）：pickDuelAction(self, foe, state) -> actionId
//   reckless → 多 power/risk
//   cautious → 残血倾向 defend/retreat；优势局倾向 attack
//   guard/默认 → 均衡 attack/defend
//
// 统计法：用确定性 rng 序列扫一遍 [0,1) 的若干采样点，统计行动分布，
// 断言性格倾向（避免对单点 rng 的脆弱断言）。
import assert from 'node:assert';
import { pickDuelAction } from '../src/battle/duelAi.js';

const ACTION_IDS = ['attack', 'power', 'defend', 'risk', 'retreat'];

function unit(o) {
  return { id: 'u', classId: 'infantry', atk: 20, def: 10, spd: 10, ai: null, ...o };
}

// state 工厂：含 hp%（self=a 侧 or b 侧由调用方语义决定，这里 self 是 b/敌方）。
// pickDuelAction 读取 self/foe 的当前 hp，从 state 取 aHp/bHp/maxA/maxB。
function stateOf({ aHp, bHp, maxA = 100, maxB = 100, round = 1 }) {
  return { aHp, bHp, maxA, maxB, round, maxRounds: 6, over: false, log: [] };
}

// 采样：扫 N 个均匀 rng 值，返回行动计数 map。
function distribution(self, foe, state, n = 200) {
  const counts = Object.fromEntries(ACTION_IDS.map((id) => [id, 0]));
  for (let i = 0; i < n; i++) {
    const r = (i + 0.5) / n; // 0..1 均匀
    const id = pickDuelAction(self, foe, state, () => r);
    assert.ok(ACTION_IDS.includes(id), `valid action id (got ${id})`);
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}

// === 返回值始终是合法 actionId ===
{
  const self = unit({ id: 'b', ai: 'reckless' });
  const foe = unit({ id: 'a' });
  const st = stateOf({ aHp: 60, bHp: 60 });
  const id = pickDuelAction(self, foe, st, () => 0.5);
  assert.ok(ACTION_IDS.includes(id), 'always a valid action');
}

// === reckless：低风险（满血优势）局 → 多 power/risk ===
{
  const self = unit({ id: 'b', ai: 'reckless', atk: 26, def: 10 });
  const foe = unit({ id: 'a', atk: 12, def: 8 });
  // self 是 b 侧、满血优势
  const st = stateOf({ aHp: 100, bHp: 100, maxA: 100, maxB: 100 });
  const dist = distribution(self, foe, st);
  const aggressive = dist.power + dist.risk;
  const passive = dist.defend + dist.retreat;
  assert.ok(aggressive > passive, `reckless favors power/risk (agg=${aggressive} vs pas=${passive})`);
  assert.ok(aggressive >= 100, `reckless mostly aggressive (agg=${aggressive}/200)`);
}

// === cautious：残血 → 倾向 defend/retreat ===
{
  const self = unit({ id: 'b', ai: 'cautious', atk: 16, def: 12, spd: 14 });
  const foe = unit({ id: 'a', atk: 24, def: 10, spd: 8 });
  // self=b 残血（18/100），foe 满血
  const st = stateOf({ aHp: 100, bHp: 18, maxA: 100, maxB: 100 });
  const dist = distribution(self, foe, st);
  const survive = dist.defend + dist.retreat;
  const aggressive = dist.power + dist.risk;
  assert.ok(survive > aggressive, `cautious low-hp favors defend/retreat (sur=${survive} agg=${aggressive})`);
  assert.ok(survive >= 100, `cautious low-hp mostly defensive (sur=${survive}/200)`);
}

// === cautious：优势局（满血、对手残血）→ 倾向 attack ===
{
  const self = unit({ id: 'b', ai: 'cautious', atk: 22, def: 12 });
  const foe = unit({ id: 'a', atk: 14, def: 8 });
  // self=b 满血，foe 残血
  const st = stateOf({ aHp: 20, bHp: 100, maxA: 100, maxB: 100 });
  const dist = distribution(self, foe, st);
  // 优势时不应主要走 retreat；attack 应是主力（attack+power 攻势 > defend+retreat）
  const offense = dist.attack + dist.power + dist.risk;
  const defensive = dist.defend + dist.retreat;
  assert.ok(offense > defensive, `cautious favorable favors offense (off=${offense} def=${defensive})`);
  assert.ok(dist.attack >= dist.retreat, `cautious favorable: attack >= retreat`);
}

// === guard/默认：均衡（attack/defend 占主，极端动作不主导）===
{
  const self = unit({ id: 'b', ai: 'guard', atk: 20, def: 10 });
  const foe = unit({ id: 'a', atk: 20, def: 10 });
  const st = stateOf({ aHp: 60, bHp: 60, maxA: 100, maxB: 100 });
  const dist = distribution(self, foe, st);
  const balanced = dist.attack + dist.defend;
  const extreme = dist.power + dist.risk + dist.retreat;
  assert.ok(balanced >= extreme, `guard balanced: attack+defend >= power+risk+retreat (bal=${balanced} ext=${extreme})`);
  // 不应全程撤退（均衡型武力相当不会大量逃）
  assert.ok(dist.retreat < dist.attack, 'guard rarely retreats at even hp');
}

// === 默认（未知 ai）等同均衡，不抛错 ===
{
  const self = unit({ id: 'b', ai: 'mystery', atk: 20, def: 10 });
  const foe = unit({ id: 'a', atk: 20, def: 10 });
  const st = stateOf({ aHp: 60, bHp: 60 });
  const id = pickDuelAction(self, foe, st, () => 0.42);
  assert.ok(ACTION_IDS.includes(id), 'unknown ai still returns valid action');
}

console.log('duelAi ok');
