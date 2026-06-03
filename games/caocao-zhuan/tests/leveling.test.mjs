// tests/leveling.test.mjs — gainExp 升级逻辑（TDD）
// 运行：node games/caocao-zhuan/tests/leveling.test.mjs
//
// 契约（plan §1.8 / §B3）：
//   gainExp(unit, amt) -> { leveledUp:bool, gains:{hp,atk,def,int,spd} }
//   - exp 累加；每满 100 exp => level+1，按 CLASSES[unit.classId].growth
//     （或 unit.growth 优先）加到 maxHp/atk/def/int/spd；
//   - curHp 随 maxHp 的 hp 增量同步增加；
//   - 支持一次大经验跨多级；mutates unit；返回汇总 gains + 是否升级。

import assert from 'node:assert';
import { gainExp } from '../src/battle/leveling.js';

// --- 用例 1：未跨 100，不升级，不加属性 ---
{
  const u = {
    classId: 'infantry', level: 1, exp: 0,
    maxHp: 50, curHp: 40, atk: 10, def: 5, int: 3, spd: 4,
    growth: { hp: 6, atk: 3, def: 2, int: 1, spd: 2 },
  };
  const res = gainExp(u, 50);
  assert.equal(res.leveledUp, false, 'amt<100 不应升级');
  assert.equal(u.exp, 50, 'exp 应累加到 50');
  assert.equal(u.level, 1, 'level 不变');
  assert.equal(u.maxHp, 50, 'maxHp 不变');
  assert.equal(u.curHp, 40, 'curHp 不变');
  assert.deepEqual(res.gains, { hp: 0, atk: 0, def: 0, int: 0, spd: 0 }, '无成长');
}

// --- 用例 2：跨 100 单次升级，按 unit.growth 加属性，curHp 同步 +hp ---
{
  const u = {
    classId: 'infantry', level: 1, exp: 80,
    maxHp: 50, curHp: 40, atk: 10, def: 5, int: 3, spd: 4,
    growth: { hp: 6, atk: 3, def: 2, int: 1, spd: 2 },
  };
  const res = gainExp(u, 30); // 80+30=110 => 升 1 级，余 10 exp
  assert.equal(res.leveledUp, true, '跨 100 应升级');
  assert.equal(u.level, 2, 'level => 2');
  assert.equal(u.exp, 10, 'exp 余 10');
  assert.equal(u.maxHp, 56, 'maxHp +6');
  assert.equal(u.curHp, 46, 'curHp 同步 +6');
  assert.equal(u.atk, 13, 'atk +3');
  assert.equal(u.def, 7, 'def +2');
  assert.equal(u.int, 4, 'int +1');
  assert.equal(u.spd, 6, 'spd +2');
  assert.deepEqual(res.gains, { hp: 6, atk: 3, def: 2, int: 1, spd: 2 }, '单级汇总');
}

// --- 用例 3：大经验跨多级，gains 为多级汇总，curHp 累计同步 ---
{
  const u = {
    classId: 'infantry', level: 1, exp: 0,
    maxHp: 50, curHp: 50, atk: 10, def: 5, int: 3, spd: 4,
    growth: { hp: 6, atk: 3, def: 2, int: 1, spd: 2 },
  };
  const res = gainExp(u, 250); // 升 2 级，余 50 exp
  assert.equal(res.leveledUp, true, '应升级');
  assert.equal(u.level, 3, '升 2 级 => level 3');
  assert.equal(u.exp, 50, 'exp 余 50');
  assert.equal(u.maxHp, 62, 'maxHp +12');
  assert.equal(u.curHp, 62, 'curHp +12');
  assert.equal(u.atk, 16, 'atk +6');
  assert.equal(u.def, 9, 'def +4');
  assert.equal(u.int, 5, 'int +2');
  assert.equal(u.spd, 8, 'spd +4');
  assert.deepEqual(res.gains, { hp: 12, atk: 6, def: 4, int: 2, spd: 4 }, '两级汇总');
}

// --- 用例 4：无 unit.growth 时回退到 CLASSES[classId].growth（cavalry）---
{
  const u = {
    classId: 'cavalry', level: 1, exp: 0,
    maxHp: 60, curHp: 60, atk: 12, def: 6, int: 4, spd: 8,
    // 无 growth 字段，应使用 CLASSES.cavalry.growth = {hp:6,atk:4,def:2,int:1,spd:3}
  };
  const res = gainExp(u, 100);
  assert.equal(res.leveledUp, true, '满 100 升级');
  assert.equal(u.level, 2, 'level 2');
  assert.equal(u.maxHp, 66, 'cavalry hp +6');
  assert.equal(u.atk, 16, 'cavalry atk +4');
  assert.equal(u.spd, 11, 'cavalry spd +3');
  assert.deepEqual(res.gains, { hp: 6, atk: 4, def: 2, int: 1, spd: 3 }, '兵种成长');
}

console.log('leveling ok');
