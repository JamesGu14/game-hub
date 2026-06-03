// tests/duel.test.mjs — 单挑状态机（纯逻辑，Node 直跑）
// 运行：node games/caocao-zhuan/tests/duel.test.mjs
//
// 数值契约（plan §1）：
//   jitter = 0.9 + rng()*0.2
//   attack : dmg=max(1,round((atk - def*0.5)*jitter)) 命中~90%
//   power  : dmg≈1.6×attack 命中~70%；miss 则本回合受击 +25%
//   defend : 本回合受到伤害×0.5，若被攻击则反击 0.4×attack
//   risk   : dmg≈1.9×attack，且自身本回合受击 ×1.3
//   retreat: 成功率=clamp(50+(self.spd-foe.spd)*3,20,90)；成功→fled 结束；失败→白挨一次 attack
//   回合上限 6：到顶仍双方存活 → 比 HP% 高者胜（败者不死、留残血）。
//
// rng 调用顺序（确定性）。每回合：
//   玩家行动结算先消耗 rng，然后敌方行动结算。
//   单次 strike：先命中 roll(rng*100)、命中后 jitter(rng)。
//   retreat：消耗 1 个 rng 做成功 roll(rng*100)。
import assert from 'node:assert';
import { Duel, canDuel, duelChallengeable, duelOutcome } from '../src/battle/duel.js';

// 固定 rng：返回脚本化的序列，耗尽后回退到 fallback 常量。
function seqRng(values, fallback = 0.5) {
  let i = 0;
  return () => (i < values.length ? values[i++] : fallback);
}

// 单位工厂（只放 duel 读取的字段）
function unit(o) {
  return {
    id: 'u',
    name: '某将',
    classId: 'infantry',
    faction: 'wei',
    atk: 20,
    def: 10,
    int: 10,
    spd: 10,
    curHp: 60,
    maxHp: 60,
    alive: true,
    ai: null,
    pos: { c: 0, r: 0 },
    ...o,
  };
}

// === canDuel ===
{
  assert.strictEqual(canDuel(unit({ classId: 'leader' })), true, 'leader can duel');
  assert.strictEqual(canDuel(unit({ classId: 'infantry' })), true, 'infantry can duel');
  assert.strictEqual(canDuel(unit({ classId: 'spear' })), true, 'spear can duel');
  assert.strictEqual(canDuel(unit({ classId: 'cavalry' })), true, 'cavalry can duel');
  assert.strictEqual(canDuel(unit({ classId: 'archer' })), false, 'archer cannot duel');
  assert.strictEqual(canDuel(unit({ classId: 'strategist' })), false, 'strategist cannot duel');
}

// === duelChallengeable ===
{
  const att = unit({ id: 'a', classId: 'infantry', faction: 'wei' });
  const foe = unit({ id: 'b', classId: 'spear', faction: 'foe' });
  assert.strictEqual(duelChallengeable(att, foe), true, 'melee vs alive opposite-faction → true');

  // 同阵营 → false
  const ally = unit({ id: 'c', classId: 'spear', faction: 'wei' });
  assert.strictEqual(duelChallengeable(att, ally), false, 'same faction → false');

  // 死的目标 → false
  const dead = unit({ id: 'd', classId: 'spear', faction: 'foe', alive: false });
  assert.strictEqual(duelChallengeable(att, dead), false, 'dead defender → false');

  // curHp<=0 的目标 → false
  const downed = unit({ id: 'e', classId: 'spear', faction: 'foe', curHp: 0 });
  assert.strictEqual(duelChallengeable(att, downed), false, 'curHp<=0 defender → false');

  // 弓兵发起方 → false（不能主动单挑）
  const archer = unit({ id: 'f', classId: 'archer', faction: 'wei' });
  assert.strictEqual(duelChallengeable(archer, foe), false, 'archer attacker → false');
}

// === Duel.actions() 固定集合 ===
{
  const a = unit({ id: 'a', faction: 'wei' });
  const b = unit({ id: 'b', faction: 'foe' });
  const d = new Duel(a, b, { rng: seqRng([]) });
  const ids = d.actions().map((x) => x.id);
  assert.deepStrictEqual(
    ids.sort(),
    ['attack', 'defend', 'power', 'retreat', 'risk'].sort(),
    'actions has fixed 5 ids'
  );
  for (const act of d.actions()) {
    assert.ok(typeof act.label === 'string' && act.label.length > 0, 'action has label');
    assert.ok(typeof act.desc === 'string' && act.desc.length > 0, 'action has desc');
  }
}

// === Duel.state 初值 ===
{
  const a = unit({ id: 'a', faction: 'wei', curHp: 60, maxHp: 60 });
  const b = unit({ id: 'b', faction: 'foe', curHp: 50, maxHp: 50 });
  const d = new Duel(a, b, { rng: seqRng([]) });
  assert.strictEqual(d.state.aHp, 60, 'aHp from curHp');
  assert.strictEqual(d.state.bHp, 50, 'bHp from curHp');
  assert.strictEqual(d.state.maxA, 60, 'maxA');
  assert.strictEqual(d.state.maxB, 50, 'maxB');
  assert.strictEqual(d.state.round, 0, 'round starts 0');
  assert.strictEqual(d.state.maxRounds, 6, 'maxRounds 6');
  assert.strictEqual(d.state.over, false, 'not over');
  assert.deepStrictEqual(d.state.log, [], 'empty log');
}

// === attack 确定伤害 ===
// rng=0.5 → jitter=1.0；命中 roll=50<90 命中。
// a: atk20, b: def10 → dmg=max(1,round((20-10*0.5)*1.0))=round(15)=15
// 敌方 b 行动用 attack（强迫 ai 选 attack；这里给 b.ai='guard' 走均衡，
// 但我们用脚本 rng 控制其结算）。为隔离玩家侧伤害，给 b 配低 atk。
{
  // 玩家 attack 回合，rng 序列：
  //   [玩家 hit roll, 玩家 jitter, 敌方 hit roll, 敌方 jitter]
  // 玩家命中(0.5→50<90)、jitter1.0。玩家普攻基础伤害 round((20-8*0.5)*1.0)=16。
  // 注：敌方若选 power/risk 会“露破绽/拼命”使其本回合受击放大；defend 会有小反击；
  // 故按实际敌方行动断言玩家普攻是否兑现，保证契约公式被精确校验。
  const a = unit({ id: 'a', faction: 'wei', atk: 20, def: 10, spd: 10, curHp: 50, maxHp: 50 });
  const b = unit({ id: 'b', faction: 'foe', atk: 12, def: 8, spd: 10, curHp: 90, maxHp: 90, ai: 'guard' });
  const d = new Duel(a, b, { rng: seqRng([0.5, 0.5, 0.5, 0.5]) });
  const r = d.step('attack');
  const BASE = 16; // 玩家普攻基础伤害
  // dmgToEnemy 至少包含玩家普攻;若敌方 risk/power-miss 露破绽则被放大,defend 则含反击.
  assert.ok(r.dmgToEnemy >= BASE, `player attack lands >=16 (got ${r.dmgToEnemy}, enemy=${r.enemyAction})`);
  assert.strictEqual(r.bHp, 90 - r.dmgToEnemy, 'bHp = 90 - dmgToEnemy');
  assert.strictEqual(r.aHp, d.state.aHp, 'RoundResult aHp matches state');
  assert.strictEqual(r.over, false, 'not over after one hit');
  assert.strictEqual(r.playerAction, 'attack', 'reports player action');
  assert.ok(typeof r.enemyAction === 'string', 'reports enemy action');
  assert.ok(typeof r.line === 'string' && r.line.length > 0, 'has narrative line');

  // 精确公式校验:用一个“敌方必非攻势/非防御”的稳定场景——
  // 敌方残血+劣势的 cautious 会选 defend/retreat;retreat 失败只对“敌方自身”加伤,
  // 不污染 dmgToEnemy.这里改用 guard 敌方但读取实际行动做精确对照.
  if (r.enemyAction === 'attack') {
    // 敌方普通攻击:不放大、不反击 → dmgToEnemy 恰为玩家普攻基础值.
    assert.strictEqual(r.dmgToEnemy, BASE, 'enemy plain attack → dmgToEnemy exactly 16');
  }
}

// === defend 减伤 + 小反击 ===
// 玩家 defend：本回合受到的伤害 ×0.5，并对攻击者反击 0.4×attack。
{
  // 让敌方一定攻击玩家（b.ai reckless 倾向攻击）。
  // rng 序列：玩家 defend 不直接打伤害（无命中 roll）；
  //   敌方 attack：[敌 hit roll=0.5, 敌 jitter=0.5]
  //   defend 反击：[反击 hit roll=0.5, 反击 jitter=0.5]
  const a = unit({ id: 'a', faction: 'wei', atk: 20, def: 10, spd: 10, curHp: 60, maxHp: 60 });
  const b = unit({ id: 'b', faction: 'foe', atk: 30, def: 8, spd: 10, curHp: 80, maxHp: 80, ai: 'reckless' });
  const d = new Duel(a, b, { rng: seqRng([0.5, 0.5, 0.5, 0.5]) });
  const r = d.step('defend');
  // 敌 attack 原始：round((30 - 10*0.5)*1.0)=round(25)=25；defend ×0.5 → round(12.5)=13(or 12)
  // 我们断言「显著减伤」：受伤 < 25 且 > 0
  assert.ok(r.dmgToPlayer > 0 && r.dmgToPlayer < 25, `defend halves incoming (got ${r.dmgToPlayer})`);
  assert.strictEqual(r.defended, true, 'defended flag true');
  // 反击：0.4×(round((20 - 8*0.5)*1.0)=16) = round(16*0.4)=6 （约）
  assert.ok(r.dmgToEnemy > 0, `defend deals counter dmg (got ${r.dmgToEnemy})`);
  assert.ok(r.dmgToEnemy < r.dmgToPlayer + 25, 'counter is small relative to a full hit');
}

// === risk 高伤但自身多受伤（同局对照：risk vs attack）===
{
  // 两个相同初态 Duel：敌方(_aiRoll 依赖局势状态)在第 1 回合会选相同行动，
  // 从而隔离“玩家 risk”相对“玩家 attack”的差异：对敌伤更高、自身受击更多。
  const mk = () => ({
    a: unit({ id: 'a', faction: 'wei', atk: 20, def: 10, spd: 10, curHp: 100, maxHp: 100 }),
    b: unit({ id: 'b', faction: 'foe', atk: 20, def: 8, spd: 10, curHp: 100, maxHp: 100, ai: 'reckless' }),
  });
  const seq = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const u1 = mk();
  const dAtk = new Duel(u1.a, u1.b, { rng: seqRng(seq) });
  const rAtk = dAtk.step('attack');

  const u2 = mk();
  const dRisk = new Duel(u2.a, u2.b, { rng: seqRng(seq) });
  const rRisk = dRisk.step('risk');

  // 同一敌方行动下：risk 对敌伤显著高于普攻（≈1.9× vs 1.0×）
  assert.strictEqual(rAtk.enemyAction, rRisk.enemyAction, 'same enemy action in identical state');
  assert.ok(rRisk.dmgToEnemy > rAtk.dmgToEnemy, `risk hits enemy harder (${rRisk.dmgToEnemy} > ${rAtk.dmgToEnemy})`);
  // risk 基础 16×1.9=round(30.4)=30；普攻 16
  assert.ok(rRisk.dmgToEnemy >= 30, `risk ~1.9x (got ${rRisk.dmgToEnemy})`);
  // 自身受击：risk 的 1.3× 自伤放大使 dmgToPlayer 不低于普攻回合（若敌方该回合有出伤则严格更高）
  assert.ok(rRisk.dmgToPlayer >= rAtk.dmgToPlayer, `risk takes >= dmg (${rRisk.dmgToPlayer} >= ${rAtk.dmgToPlayer})`);
}

// === power 高伤低命中；miss 露破绽 ===
{
  // power 命中：dmg≈1.6×attack。同局对照（attack vs power），敌方行动一致以隔离倍率。
  const mk = () => ({
    a: unit({ id: 'a', faction: 'wei', atk: 20, def: 10, spd: 10, curHp: 100, maxHp: 100 }),
    b: unit({ id: 'b', faction: 'foe', atk: 10, def: 8, spd: 10, curHp: 100, maxHp: 100, ai: 'reckless' }),
  });
  const seq = [0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  const u1 = mk();
  const dAtk = new Duel(u1.a, u1.b, { rng: seqRng(seq) });
  const rAtk = dAtk.step('attack');
  const u2 = mk();
  const dHit = new Duel(u2.a, u2.b, { rng: seqRng(seq) });
  const rHit = dHit.step('power');
  assert.strictEqual(rAtk.enemyAction, rHit.enemyAction, 'same enemy action (isolate power mult)');
  // power 命中(0.5<70)：对敌伤显著高于普攻（≈1.6×）。
  assert.ok(rHit.dmgToEnemy > rAtk.dmgToEnemy, `power > plain attack (${rHit.dmgToEnemy} > ${rAtk.dmgToEnemy})`);
  // base 16 ×1.6=round(25.6)=26（若该回合敌方未防御则恰为 26；防御则两者同比例缩放仍更大）
  assert.ok(rHit.dmgToEnemy >= Math.round(rAtk.dmgToEnemy * 1.5), 'power roughly 1.6x of a plain attack');

  // power MISS：hit roll 高（>=70）→ 不命中、且本回合自身受击 +25%。
  // rng：[玩家 power hit=0.99 (miss), 敌 attack hit=0.5, 敌 jitter=0.5]
  const a2 = unit({ id: 'a', faction: 'wei', atk: 20, def: 10, spd: 10, curHp: 60, maxHp: 60 });
  const b2 = unit({ id: 'b', faction: 'foe', atk: 20, def: 8, spd: 10, curHp: 90, maxHp: 90, ai: 'reckless' });
  const dMiss = new Duel(a2, b2, { rng: seqRng([0.99, 0.5, 0.5]) });
  const rMiss = dMiss.step('power');
  assert.strictEqual(rMiss.dmgToEnemy, 0, 'power miss deals 0');
  // 敌 attack 对 a：base round((20-10*0.5))=15；露破绽 +25% → round(15*1.25)=19(or 18/19)
  assert.ok(rMiss.dmgToPlayer >= 17, `power miss exposes self (got ${rMiss.dmgToPlayer})`);
}

// === HP 归零 → over，winner/loser 正确，loser 不复活 ===
{
  const a = unit({ id: 'hero', faction: 'wei', atk: 50, def: 10, spd: 10, curHp: 60, maxHp: 60 });
  const b = unit({ id: 'villain', faction: 'foe', atk: 5, def: 0, spd: 10, curHp: 8, maxHp: 60, ai: 'guard' });
  // 玩家 attack：round((50-0)*1.0)=50 >= 8 → 击杀。
  const d = new Duel(a, b, { rng: seqRng([0.5, 0.5]) });
  const r = d.step('attack');
  assert.strictEqual(r.over, true, 'over when hp hits 0');
  assert.strictEqual(r.winner, 'hero', 'winner is hero');
  assert.strictEqual(r.loser, 'villain', 'loser is villain');
  assert.ok(r.bHp <= 0, 'loser hp <=0');
  // loser 不复活：再 step 不改变结果
  const before = JSON.stringify(d.state);
  const r2 = d.step('attack');
  assert.strictEqual(r2.over, true, 'still over after extra step');
  assert.strictEqual(JSON.stringify(d.state), before, 'state frozen after over');

  // duelOutcome：loserHpAfter<=0 → 阵亡
  const out = duelOutcome(d);
  assert.strictEqual(out.winnerId, 'hero', 'outcome winnerId');
  assert.strictEqual(out.loserId, 'villain', 'outcome loserId');
  assert.ok(out.loserHpAfter <= 0, 'loserHpAfter <=0 (dead)');
  assert.strictEqual(out.fled, false, 'not fled');
  assert.ok(out.expGain > 0, 'winner gains exp');
}

// === retreat：高速方大概率 fled 结束 ===
{
  // self.spd 远高于 foe → 成功率 clamp(50+(self.spd-foe.spd)*3,20,90)
  // self.spd=30, foe.spd=5 → 50+75=125 → clamp 90。roll=0.5 → 50<90 成功。
  const a = unit({ id: 'a', faction: 'wei', spd: 30, curHp: 60, maxHp: 60 });
  const b = unit({ id: 'b', faction: 'foe', spd: 5, curHp: 60, maxHp: 60, ai: 'guard' });
  const d = new Duel(a, b, { rng: seqRng([0.5]) }); // 1 个 roll 用于撤退判定
  const r = d.step('retreat');
  assert.strictEqual(r.fled, true, 'fast retreat succeeds → fled');
  assert.strictEqual(r.over, true, 'fled ends duel');
  assert.strictEqual(r.winner, null, 'no winner on flee');
  const out = duelOutcome(d);
  assert.strictEqual(out.fled, true, 'outcome fled');
  // fled：双方均不死。loser = 撤退方(a)，hp 不为 0。
  assert.ok(out.loserHpAfter > 0, 'fled retreater survives');
}

// === retreat 失败：白挨一次 attack（不结束）===
{
  // self.spd 远低于 foe → 成功率低；roll 高 → 失败。
  // self.spd=5, foe.spd=30 → 50-75=-25 → clamp 20。roll=0.99 → 99>=20 失败。
  const a = unit({ id: 'a', faction: 'wei', spd: 5, def: 10, curHp: 60, maxHp: 60 });
  const b = unit({ id: 'b', faction: 'foe', spd: 30, atk: 20, def: 8, curHp: 60, maxHp: 60, ai: 'guard' });
  // rng：[撤退 roll=0.99 失败, 敌 attack hit=0.5, 敌 jitter=0.5]
  const d = new Duel(a, b, { rng: seqRng([0.99, 0.5, 0.5]) });
  const r = d.step('retreat');
  assert.strictEqual(r.fled, false, 'slow retreat fails');
  assert.strictEqual(r.over, false, 'failed retreat does not end');
  assert.ok(r.dmgToPlayer > 0, 'failed retreat takes a free hit');
  assert.strictEqual(r.dmgToEnemy, 0, 'failed retreat deals no dmg');
}

// === 6 回合上限 → 按 HP% 判胜，败者存活 ===
{
  // 双方都活到第 6 回合：用极低 atk + 高 hp，确保 6 回合内不致死。
  const a = unit({ id: 'a', faction: 'wei', atk: 6, def: 10, spd: 10, curHp: 100, maxHp: 100, ai: null });
  const b = unit({ id: 'b', faction: 'foe', atk: 6, def: 10, spd: 10, curHp: 60, maxHp: 100, ai: 'guard' });
  // a 起始 HP% = 100%，b 起始 HP% = 60%。即便互相小幅掉血，a 的 HP% 仍更高。
  // 用 attack 跑满 6 回合；rng 全 0.5（每回合 4 个：玩家 hit/jitter + 敌 hit/jitter）。
  const d = new Duel(a, b, { rng: seqRng([], 0.5) });
  let last = null;
  for (let i = 0; i < 6 && !d.state.over; i++) {
    last = d.step('attack');
  }
  assert.strictEqual(d.state.round, 6, 'ran 6 rounds');
  assert.strictEqual(last.over, true, 'over at cap');
  assert.strictEqual(last.winner, 'a', 'higher HP% (a) wins at cap');
  assert.strictEqual(last.loser, 'b', 'lower HP% (b) loses at cap');
  // 败者存活：cap 判定不致死
  assert.ok(d.state.bHp > 0, 'loser survives the cap');
  const out = duelOutcome(d);
  assert.ok(out.loserHpAfter > 0, 'duelOutcome loserHpAfter > 0 (survives cap)');
  assert.strictEqual(out.fled, false, 'cap is not a flee');
}

// === Duel 不修改输入单位（伤害只在 duel state 内，回写交给 controller）===
{
  const a = unit({ id: 'a', faction: 'wei', atk: 20, def: 10, curHp: 60, maxHp: 60 });
  const b = unit({ id: 'b', faction: 'foe', atk: 12, def: 8, curHp: 50, maxHp: 50, ai: 'guard' });
  const d = new Duel(a, b, { rng: seqRng([], 0.5) });
  d.step('attack');
  assert.strictEqual(a.curHp, 60, 'input a.curHp not mutated by Duel');
  assert.strictEqual(b.curHp, 50, 'input b.curHp not mutated by Duel');
}

console.log('duel ok');
