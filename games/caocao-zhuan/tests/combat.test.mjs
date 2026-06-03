// tests/combat.test.mjs — 战斗结算（纯函数，Node 直跑）
// 运行：node games/caocao-zhuan/tests/combat.test.mjs
import assert from 'node:assert';
import { resolveAttack } from '../src/battle/combat.js';

// 最小地图：1 行 N 列，tiles[r][c] = terrainId
function mapRow(...ids) {
  return { cols: ids.length, rows: 1, tiles: [ids] };
}

// 单位工厂（只放 combat 读取的字段）
function unit(o) {
  return {
    classId: 'infantry',
    atk: 10, def: 5, int: 5, spd: 5,
    curHp: 30,
    pos: { c: 0, r: 0 },
    ...o,
  };
}

// rng 注入：先 hit 判定、后 jitter。()=>0.5 时 jitter=1.0、hit roll=50。
const rngMid = () => 0.5;        // 命中（50<hit）、jitter=1.0
const rngHigh = () => 0.999;     // 强制 miss（99.9 >= hit）、jitter≈1.0998

// --- 1) 确定性伤害 + 相克 + 击杀/反击距离 ---
// 攻方枪 atk20 @ (0,0)，守方骑 def8 @ (1,0)，全 grass(defBonus0)。
// triangle spear>cavalry=1.5 → dmg=round((20*1.5*1 - 8)*1.0)=round(22)=22
{
  const map = mapRow('grass', 'grass');
  const atk = unit({ classId: 'spear', atk: 20, def: 6, spd: 5, curHp: 30, pos: { c: 0, r: 0 } });
  const def = unit({ classId: 'cavalry', atk: 14, def: 8, spd: 5, curHp: 30, pos: { c: 1, r: 0 } });
  const res = resolveAttack(atk, def, map, rngMid);
  assert.strictEqual(res.hit, true, 'should hit');
  assert.strictEqual(res.dmg, 22, 'spear vs cavalry on grass dmg=22');
  assert.strictEqual(res.killed, false, 'cavalry survives 22 of 30');
  // 守方存活、相邻(dist1)、cavalry counterRange[1,1] → 应回反击
  assert.ok(res.counter, 'counter present (in range, alive)');
  // 反击：cavalry atk14 vs spear def6，triangle cavalry<spear=0.7
  // round((14*0.7 - 6)*1.0)=round(9.8-6)=round(3.8)=4
  assert.strictEqual(res.counter.hit, true, 'counter hit');
  assert.strictEqual(res.counter.dmg, 4, 'counter dmg=4');
  assert.strictEqual(res.counter.killed, false, 'attacker survives counter');
  // 不得修改输入
  assert.strictEqual(def.curHp, 30, 'inputs not mutated (defender)');
  assert.strictEqual(atk.curHp, 30, 'inputs not mutated (attacker)');
}

// --- 2) 地形 defBonus 降伤：森林 defBonus2 → defEff=8+2=10 → dmg=round(30-10)=20 ---
{
  const grass = mapRow('grass', 'grass');
  const forest = mapRow('grass', 'forest');
  const atk = unit({ classId: 'spear', atk: 20, pos: { c: 0, r: 0 } });
  const defG = unit({ classId: 'cavalry', def: 8, spd: 5, curHp: 30, pos: { c: 1, r: 0 } });
  const defF = unit({ classId: 'cavalry', def: 8, spd: 5, curHp: 30, pos: { c: 1, r: 0 } });
  const onGrass = resolveAttack(atk, defG, grass, rngMid);
  const onForest = resolveAttack(atk, defF, forest, rngMid);
  assert.ok(onForest.dmg < onGrass.dmg, 'forest defBonus lowers dmg');
  assert.strictEqual(onForest.dmg, 20, 'forest dmg=20 (defEff 10)');
}

// --- 3) 击杀置 killed=true，且不回反击（守方已亡） ---
{
  const map = mapRow('grass', 'grass');
  const atk = unit({ classId: 'spear', atk: 20, pos: { c: 0, r: 0 } });
  const def = unit({ classId: 'cavalry', def: 8, spd: 5, curHp: 10, pos: { c: 1, r: 0 } });
  const res = resolveAttack(atk, def, map, rngMid); // dmg 22 >= 10
  assert.strictEqual(res.killed, true, 'kill flips killed=true');
  assert.strictEqual(res.counter, null, 'no counter when defender dead');
}

// --- 4) 反击仅当攻方在守方 counterRange 内 ---
// 弓兵守方 counterRange[0,0]（空区间）→ 即便相邻也无反击。
{
  const map = mapRow('grass', 'grass');
  const atk = unit({ classId: 'infantry', atk: 18, pos: { c: 0, r: 0 } });
  const def = unit({ classId: 'archer', def: 4, spd: 5, curHp: 40, pos: { c: 1, r: 0 } });
  const res = resolveAttack(atk, def, map, rngMid);
  assert.strictEqual(res.killed, false, 'archer survives');
  assert.strictEqual(res.counter, null, 'archer no melee counter (range[0,0])');
}
// 攻方在守方近战 counterRange 外（距离2 > infantry counterRange[1,1]）→ 无反击。
{
  const map = mapRow('grass', 'grass', 'grass'); // attacker archer at range 2
  const atk = unit({ classId: 'archer', atk: 18, spd: 5, pos: { c: 0, r: 0 } });
  const def = unit({ classId: 'infantry', def: 4, spd: 5, curHp: 60, pos: { c: 2, r: 0 } });
  const res = resolveAttack(atk, def, map, rngMid); // dist 2, infantry counterRange[1,1]
  assert.strictEqual(res.counter, null, 'no counter when attacker out of counterRange');
}

// --- 5) 强制 miss：rng 高 → hit:false、dmg:0、无反击 ---
{
  const map = mapRow('grass', 'grass');
  const atk = unit({ classId: 'spear', atk: 20, spd: 5, pos: { c: 0, r: 0 } });
  const def = unit({ classId: 'cavalry', def: 8, spd: 5, curHp: 30, pos: { c: 1, r: 0 } });
  const res = resolveAttack(atk, def, map, rngHigh);
  assert.strictEqual(res.hit, false, 'forced miss');
  assert.strictEqual(res.dmg, 0, 'miss dmg=0');
  assert.strictEqual(res.killed, false, 'miss no kill');
  assert.strictEqual(res.counter, null, 'miss no counter');
}

// --- 6) 命中下限/伤害下限：dmg 至少 1 ---
{
  const map = mapRow('grass', 'grass');
  const atk = unit({ classId: 'infantry', atk: 3, spd: 5, pos: { c: 0, r: 0 } });
  const def = unit({ classId: 'infantry', def: 50, spd: 5, curHp: 30, pos: { c: 1, r: 0 } });
  const res = resolveAttack(atk, def, map, rngMid);
  assert.strictEqual(res.dmg, 1, 'dmg floored at 1 on hit');
}

console.log('combat ok');
