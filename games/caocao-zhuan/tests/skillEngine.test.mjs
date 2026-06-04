// tests/skillEngine.test.mjs — 计略结算（纯函数，Node 直跑）
// 运行：node games/caocao-zhuan/tests/skillEngine.test.mjs
//
// 覆盖（plan §1.3）：
//   1) 火计 AOE：area1 命中范围内全部敌人，确定性伤害；友军/范围外不受影响
//   2) 治疗：单体回血确定值
//   3) intDiff 高 rng 未命中（low-int 施法者 vs high-int 目标）
//   4) 乱心：命中后产出 confuse 状态条目（不直接 mutate）
//   5) 单体计略射程 / area0：射程外不可选，AOE 仅命中目标格本体
//   6) aoeCells / skillTargets 基本几何
//   7) 不 mutate 输入单位
import assert from 'node:assert';
import { SKILLS } from '../src/data/skills.js';
import { resolveSkill, skillTargets, aoeCells } from '../src/battle/skillEngine.js';

// 全 grass 的方阵地图
function gridMap(n = 5) {
  return { cols: n, rows: n, tiles: Array.from({ length: n }, () => Array(n).fill('grass')) };
}

// 固定 rng：常数 0.5 -> intDiff 掷骰=50、jitter=1.0（确定性）
const rngMid = () => 0.5;
// 高 rng：0.999 -> intDiff 掷骰=99.9（命中率<99.9 时强制未命中）、jitter≈1.0998
const rngHigh = () => 0.999;

const u = (o) => ({ int: 5, def: 8, curHp: 40, alive: true, ...o });

// --- 1) 火计 AOE：area1 命中范围内全部敌人；友军 & 范围外不受影响 ---
// caster int20。火计 power14, area1, intDiff, element fire。
// dmg = round(14×(1+20/40=1.5)×1(grass)×1.0(jitter) − defEff)
// defEff = def8×1×0.6 + grass.defBonus0 + int5×0.5 = 4.8+2.5 = 7.3
// raw = 21 − 7.3 = 13.7 -> 14
{
  const map = gridMap();
  const caster = { id: 'c', faction: 'wei', int: 20, def: 5, pos: { c: 0, r: 0 }, name: '军师' };
  const e1 = u({ id: 'e1', faction: 'foe', pos: { c: 2, r: 0 } }); // AOE 心
  const e2 = u({ id: 'e2', faction: 'foe', pos: { c: 3, r: 0 } }); // 心右 1（在 area1 内）
  const e3 = u({ id: 'e3', faction: 'foe', pos: { c: 2, r: 1 } }); // 心下 1（在 area1 内）
  const eFar = u({ id: 'e4', faction: 'foe', pos: { c: 4, r: 4 } }); // 远在 AOE 外
  const ally = u({ id: 'a1', faction: 'wei', pos: { c: 1, r: 0 } }); // 友军 — 不应被敌系火计命中
  const units = [caster, e1, e2, e3, eFar, ally];

  const res = resolveSkill(caster, SKILLS.fire, { c: 2, r: 0 }, units, map, rngMid);
  assert.strictEqual(res.element, 'fire', 'fire element reported');
  const hitIds = res.hits.map((h) => h.unitId).sort();
  assert.deepStrictEqual(hitIds, ['e1', 'e2', 'e3'], 'AOE hits all 3 in-range enemies, no ally/no far');
  for (const h of res.hits) {
    assert.strictEqual(h.dmg, 14, `deterministic AOE dmg=14 for ${h.unitId}`);
    assert.ok(!h.missed, 'all hit (int20 vs int5 -> chance 100)');
  }
  // 不 mutate：所有 curHp 维持 40
  for (const x of [e1, e2, e3, ally]) assert.strictEqual(x.curHp, 40, 'no mutation of curHp');
}

// --- 2) 治疗：单体回血确定值 ---
// heal power16, area0, always。heal = round(16×1.5×1.0) = 24
{
  const map = gridMap();
  const caster = { id: 'c', faction: 'wei', int: 20, pos: { c: 0, r: 0 } };
  const hurt = u({ id: 'h', faction: 'wei', curHp: 10, pos: { c: 1, r: 0 } });
  const res = resolveSkill(caster, SKILLS.heal, { c: 1, r: 0 }, [caster, hurt], map, rngMid);
  assert.strictEqual(res.hits.length, 1, 'single heal target');
  assert.strictEqual(res.hits[0].unitId, 'h', 'heals the ally on the cell');
  assert.strictEqual(res.hits[0].heal, 24, 'deterministic heal=24');
  assert.ok(res.hits[0].dmg == null, 'heal has no dmg field');
  assert.strictEqual(hurt.curHp, 10, 'heal does not mutate target curHp');
}

// --- 3) intDiff 高 rng 未命中 ---
// 低智施法者(int0) vs 高智目标(int30)：命中=clamp(85+0-30,30,100)=55。
// rngHigh 掷骰 99.9 >= 55 -> missed。对照 rngMid 掷骰 50 < 55 -> 命中。
{
  const map = gridMap();
  const weak = { id: 'wc', faction: 'wei', int: 0, def: 5, pos: { c: 0, r: 0 }, name: '杂兵' };
  const smart = u({ id: 'sf', faction: 'foe', int: 30, pos: { c: 2, r: 0 } });

  const miss = resolveSkill(weak, SKILLS.thunder, { c: 2, r: 0 }, [weak, smart], map, rngHigh);
  assert.strictEqual(miss.hits.length, 1, 'still produces an entry for the target');
  assert.strictEqual(miss.hits[0].missed, true, 'high rng -> miss vs high-int target');
  assert.ok(miss.hits[0].dmg == null, 'missed -> no dmg');

  const hit = resolveSkill(weak, SKILLS.thunder, { c: 2, r: 0 }, [weak, smart], map, rngMid);
  assert.ok(!hit.hits[0].missed, 'mid rng (50<55) -> hit');
  assert.ok(typeof hit.hits[0].dmg === 'number', 'hit -> has dmg');
}

// --- 4) 乱心：命中后产出 confuse 状态条目（不直接 mutate target.statuses） ---
{
  const map = gridMap();
  const caster = { id: 'c', faction: 'wei', int: 20, pos: { c: 0, r: 0 } };
  const foe = u({ id: 'f', faction: 'foe', pos: { c: 2, r: 0 } });
  const res = resolveSkill(caster, SKILLS.confuse, { c: 2, r: 0 }, [caster, foe], map, rngMid);
  const entry = res.hits.find((h) => h.unitId === 'f');
  assert.ok(entry, 'confuse produces a hit entry for the foe');
  assert.ok(entry.status, 'control skill attaches a status effect');
  assert.strictEqual(entry.status.type, 'confuse', 'status type=confuse');
  assert.strictEqual(entry.status.turns, SKILLS.confuse.status.turns, 'turns mirror skill def');
  assert.ok(entry.dmg == null, 'control skill deals no dmg');
  // 不直接 mutate：引擎返回 effects，target 不应被写入 statuses
  assert.ok(!foe.statuses || foe.statuses.length === 0, 'resolveSkill does not mutate target.statuses');
}

// --- 5) 单体计略射程 + area0 ---
// thunder range[1,4], area0。
{
  const map = gridMap();
  const caster = { id: 'c', faction: 'wei', int: 20, pos: { c: 0, r: 0 } };
  const farFoe = u({ id: 'far', faction: 'foe', pos: { c: 4, r: 4 } });   // dist 8 > 4 -> 不可选
  const nearFoe = u({ id: 'near', faction: 'foe', pos: { c: 0, r: 3 } }); // dist 3 ∈ [1,4]
  const adj = u({ id: 'adj', faction: 'foe', pos: { c: 1, r: 3 } });      // 紧邻目标，但 area0 不该被波及

  const targetsFar = skillTargets(caster, SKILLS.thunder, map, [caster, farFoe]);
  assert.deepStrictEqual(targetsFar, [], 'enemy beyond range -> not a legal target');

  const targetsNear = skillTargets(caster, SKILLS.thunder, map, [caster, nearFoe]);
  assert.deepStrictEqual(targetsNear, [{ c: 0, r: 3 }], 'in-range enemy cell is legal');

  // area0：仅命中落点本体，相邻 adj 不受影响。
  const res = resolveSkill(caster, SKILLS.thunder, { c: 0, r: 3 }, [caster, nearFoe, adj], map, rngMid);
  assert.strictEqual(res.hits.length, 1, 'area0 hits only the cell occupant');
  assert.strictEqual(res.hits[0].unitId, 'near', 'the targeted foe is hit');
  // thunder power24×1.5×1.0 − defEff(8×0.6+0+5×0.5=7.3) = 36-7.3=28.7 -> 29
  assert.strictEqual(res.hits[0].dmg, 29, 'deterministic thunder single dmg=29');
}

// --- 6) aoeCells / skillTargets 几何健全性 ---
{
  const map = gridMap();
  const cells = aoeCells({ c: 2, r: 0 }, 1, map);
  const keys = cells.map((x) => `${x.c},${x.r}`).sort();
  // 心(2,0) + 上(2,-1 出界,剔除) + 下(2,1) + 左(1,0) + 右(3,0)
  assert.deepStrictEqual(keys, ['1,0', '2,0', '2,1', '3,0'], 'area1 manhattan, out-of-bounds clipped');

  // area0 -> 仅自身
  assert.deepStrictEqual(aoeCells({ c: 2, r: 2 }, 0, map), [{ c: 2, r: 2 }], 'area0 = the cell itself');

  // self 目标：仅施法者格
  const caster = { id: 'c', faction: 'wei', int: 10, pos: { c: 2, r: 2 } };
  const selfTargets = skillTargets(caster, SKILLS.guard, map, [caster]);
  assert.deepStrictEqual(selfTargets, [{ c: 2, r: 2 }], 'self skill -> caster cell only');
}

console.log('skillEngine ok');
