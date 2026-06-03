// battle/classTriangle.js — 兵种相克系数（纯逻辑，禁止 import three / 触碰 DOM）
//
// 契约（plan §1.2）：
//   export function triangleMul(attackerClassId, defenderClassId): number
//   基线表（示意）：
//     spear>cavalry=1.5；
//     cavalry>archer=1.4, cavalry>infantry=1.3, cavalry<spear=0.7；
//     archer>infantry=1.3, archer<cavalry=0.8；
//     strategist 作守方被物理 1.2（脆）；
//     其余=1.0。
//
// 仅依赖兵种 id 字符串，不读取 CLASSES（系数是相克关系，不属于单兵种属性）。

// 显式相克表：MATCHUP[attacker][defender] = mul
const MATCHUP = {
  spear: { cavalry: 1.5 },
  cavalry: { archer: 1.4, infantry: 1.3, spear: 0.7 },
  archer: { infantry: 1.3, cavalry: 0.8 },
};

/**
 * 攻方对守方的兵种克制系数。
 * @param {string} attackerClassId
 * @param {string} defenderClassId
 * @returns {number}
 */
export function triangleMul(attackerClassId, defenderClassId) {
  // 显式相克关系优先
  const row = MATCHUP[attackerClassId];
  if (row && Object.prototype.hasOwnProperty.call(row, defenderClassId)) {
    return row[defenderClassId];
  }
  // 谋士作守方：被任意物理攻击 ×1.2（脆）
  if (defenderClassId === 'strategist') {
    return 1.2;
  }
  // 其余无相克关系
  return 1.0;
}
