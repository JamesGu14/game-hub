// systems/combat/damageCalc.js — 伤害计算。
// M1：物理基础伤害直出。Phase 2 接 dmgType（物理/谋略/火）× 抗性矩阵 + 暴击（注入 rng）。
export function calcDamage(general, _enemy) {
  return general.dmg;
}
