// battle/statuses.js — 状态效果系统（纯逻辑，禁止 import three / 触碰 DOM）
//
// 契约（plan §1.2）：
//   StatusInstance: { type, turns, magnitude }
//   类型：
//     poison       每回合开始 -magnitude HP（地板 0）
//     confuse      本方回合「可能」无法行动（canAct 注入 rng 概率判定）
//     immobilize   不能移动，可原地攻/计（canMove -> false，canAct 不受影响）
//     atk_up / atk_down / def_up / def_down / spd_up
//                  数值乘子（statMods 汇总），持续 turns 回合
//
//   applyStatus(unit, status)   叠加/刷新到 unit.statuses[]（缺省自动初始化 []）
//   tickStatuses(unit)          回合开始结算 -> { dmg, expired:[type], log:[] }
//   statMods(unit)              -> { atk, def, spd } 乘子（无相关状态恒等 ×1）
//   canAct(unit, rng?)          confuse 概率影响（默认 Math.random，可注入确定性 rng）
//   canMove(unit)               immobilize -> false
//
// 向后兼容关键：
//   - 单位可能没有 statuses 字段（旧用例）；所有读取函数对 undefined/空数组安全。
//   - 无相关状态时 statMods 恒等（×1），tickStatuses no-op，确保旧战斗结算不变。
//
// 纯度：本文件不得 import three，也不得引用任何 data/* 之外的运行态；
//       仅依赖注入的 rng（confuse 概率），其余为纯函数。

// confuse 触发「行动紊乱」的概率（rng < 此值 -> 无法行动）。原创取值，非任何商业表。
const CONFUSE_FAIL_CHANCE = 0.5;

// 增减益 -> 作用维度与方向（+1 增益 / -1 减益）。
const STAT_EFFECT = {
  atk_up: { dim: 'atk', dir: 1 },
  atk_down: { dim: 'atk', dir: -1 },
  def_up: { dim: 'def', dir: 1 },
  def_down: { dim: 'def', dir: -1 },
  spd_up: { dim: 'spd', dir: 1 },
};

// 安全取得单位的状态数组（不存在时返回空数组，不写回）。
function statusesOf(unit) {
  return unit && Array.isArray(unit.statuses) ? unit.statuses : [];
}

/**
 * 叠加/刷新一个状态到 unit.statuses[]（同类型不重复堆叠，取较久 turns + 较强 magnitude）。
 * 缺省自动初始化 unit.statuses=[]。会 mutate unit（写入运行态状态条目）。
 * @param {object} unit
 * @param {{type:string, turns:number, magnitude?:number}} status
 * @returns {object} 写入后的 StatusInstance
 */
export function applyStatus(unit, status) {
  if (!unit || !status || !status.type) return null;
  if (!Array.isArray(unit.statuses)) unit.statuses = [];

  const turns = Math.max(0, status.turns || 0);
  const magnitude = status.magnitude || 0;

  const existing = unit.statuses.find((s) => s.type === status.type);
  if (existing) {
    // 刷新：持续时间取较久，强度取较强（绝对值更大者）。
    existing.turns = Math.max(existing.turns, turns);
    if (Math.abs(magnitude) > Math.abs(existing.magnitude || 0)) {
      existing.magnitude = magnitude;
    }
    return existing;
  }

  const inst = { type: status.type, turns, magnitude };
  unit.statuses.push(inst);
  return inst;
}

/**
 * 回合开始结算：poison 扣血、所有状态 turns--、清理过期。
 * 会 mutate unit（curHp 扣减、statuses 条目 turns-- / 清理）。
 * @param {object} unit
 * @returns {{ dmg:number, expired:string[], log:string[] }}
 */
export function tickStatuses(unit) {
  const result = { dmg: 0, expired: [], log: [] };
  if (!unit || !Array.isArray(unit.statuses) || unit.statuses.length === 0) {
    return result;
  }

  const name = unit.name || unit.classId || '单位';

  // 1) poison 扣血（地板 0）。
  for (const s of unit.statuses) {
    if (s.type === 'poison') {
      const mag = s.magnitude || 0;
      if (mag > 0) {
        result.dmg += mag;
        result.log.push(`${name} 中毒，损失 ${mag} 生命`);
      }
    }
  }
  if (result.dmg > 0 && typeof unit.curHp === 'number') {
    unit.curHp = Math.max(0, unit.curHp - result.dmg);
  }

  // 2) turns-- 并清理过期（turns <= 0）。
  const survivors = [];
  for (const s of unit.statuses) {
    s.turns = (s.turns || 0) - 1;
    if (s.turns <= 0) {
      result.expired.push(s.type);
      result.log.push(`${name} 的「${s.type}」状态消退`);
    } else {
      survivors.push(s);
    }
  }
  unit.statuses = survivors;

  return result;
}

/**
 * 汇总增减益为 { atk, def, spd } 乘子。无相关状态时恒等（×1）。
 * 减益取 (1 - magnitude)，增益取 (1 + magnitude)；同维多条相乘累计。
 * 不 mutate unit。
 * @param {object} unit
 * @returns {{ atk:number, def:number, spd:number }}
 */
export function statMods(unit) {
  const mods = { atk: 1, def: 1, spd: 1 };
  const list = statusesOf(unit);
  for (const s of list) {
    const eff = STAT_EFFECT[s.type];
    if (!eff) continue;
    const mag = s.magnitude || 0;
    const factor = eff.dir > 0 ? 1 + mag : 1 - mag;
    mods[eff.dim] *= factor;
  }
  return mods;
}

/**
 * 单位本回合能否行动。confuse 时按概率（注入 rng 确定性）判定可能无法行动；
 * 无 confuse 时恒为 true。immobilize 不影响行动（可原地攻/计）。
 * @param {object} unit
 * @param {() => number} [rng] 注入的 [0,1) 随机源（默认 Math.random）
 * @returns {boolean}
 */
export function canAct(unit, rng = Math.random) {
  const list = statusesOf(unit);
  const confused = list.some((s) => s.type === 'confuse');
  if (!confused) return true;
  // rng 低于阈值 -> 行动紊乱（无法行动）。
  return rng() >= CONFUSE_FAIL_CHANCE;
}

/**
 * 单位本回合能否移动。immobilize（定身）-> false；否则 true。
 * @param {object} unit
 * @returns {boolean}
 */
export function canMove(unit) {
  const list = statusesOf(unit);
  return !list.some((s) => s.type === 'immobilize');
}

export default { applyStatus, tickStatuses, statMods, canAct, canMove };
