// battle/leveling.js — 经验与升级（纯逻辑，不依赖 Three.js / DOM）
//
// 契约（plan §1.8 / §B3）：
//   gainExp(unit, amt) -> { leveledUp:bool, gains:{hp,atk,def,int,spd} }
//
// 规则：
//   - exp 累加到 unit.exp；每满 100 exp 升 1 级（支持一次大经验跨多级）。
//   - 每级按成长表加属性：优先 unit.growth，其次 CLASSES[unit.classId].growth。
//   - 成长键 hp/atk/def/int/spd 分别加到 maxHp/atk/def/int/spd（注意 hp -> maxHp）。
//   - curHp 随 maxHp 的 hp 增量同步增加（升级回血/扩容）。
//   - mutates unit（level/exp/maxHp/curHp/atk/def/int/spd），返回多级汇总 gains 与是否升级。

import { CLASSES } from '../data/classes.js';

const EXP_PER_LEVEL = 100;

// 解析单位的成长表：unit.growth 优先，否则取兵种基线。
function growthOf(unit) {
  if (unit.growth) return unit.growth;
  const cls = CLASSES[unit.classId];
  return (cls && cls.growth) || { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };
}

export function gainExp(unit, amt) {
  const gains = { hp: 0, atk: 0, def: 0, int: 0, spd: 0 };

  // 累加经验（容错：未初始化的 exp 视为 0）。
  unit.exp = (unit.exp || 0) + amt;

  // 每满 100 升一级，支持多级。
  while (unit.exp >= EXP_PER_LEVEL) {
    unit.exp -= EXP_PER_LEVEL;
    unit.level = (unit.level || 1) + 1;

    const g = growthOf(unit);
    const dhp = g.hp || 0;
    const datk = g.atk || 0;
    const ddef = g.def || 0;
    const dint = g.int || 0;
    const dspd = g.spd || 0;

    unit.maxHp += dhp;
    unit.curHp += dhp; // curHp 与 maxHp 同步增长
    unit.atk += datk;
    unit.def += ddef;
    unit.int += dint;
    unit.spd += dspd;

    gains.hp += dhp;
    gains.atk += datk;
    gains.def += ddef;
    gains.int += dint;
    gains.spd += dspd;
  }

  const leveledUp = gains.hp || gains.atk || gains.def || gains.int || gains.spd ? true : false;
  return { leveledUp, gains };
}
