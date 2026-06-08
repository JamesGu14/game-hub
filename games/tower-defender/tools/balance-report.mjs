// tools/balance-report.mjs — [检查点A·§9.3] headless 经济/DPS/覆盖诊断器（趋势告警，带宽容带，非硬 assert）。
// 用法：node tools/balance-report.mjs。始终 exit 0；打印逐关指标 + 汇总，供调曲线。
import { LEVELS } from '../src/data/levels.js';
import { ENEMIES } from '../src/data/enemies.js';
import { GENERALS, towerStats } from '../src/data/generals.js';
import { BAL } from '../src/data/balance.js';
import { upgradeCost } from '../src/systems/economySystem.js';

const CHEAP = Math.min(...Object.values(GENERALS).map((g) => g.cost));   // 最便宜建造（huang 70）

// 一座塔升到 L=lvl 的累计造价（建造 + 各级升级）
function cumulativeCost(generalId, lvl) {
  let inv = GENERALS[generalId].cost;
  const tmp = { generalId, level: 1 };
  for (let L = 1; L < lvl; L++) { tmp.level = L; inv += upgradeCost(tmp); }
  return inv;
}
const L5_COST = cumulativeCost('huang', BAL.MAX_TOWER_LEVEL);   // 代表性 L5 总价

function report(lv) {
  const scale = lv.scale;
  // 收入：起始金 + 杀敌掉金 + 清波奖励
  let killGold = 0, totalHp = 0, enemyCount = 0;
  for (const w of lv.waves) for (const s of w.spawns) {
    const def = ENEMIES[s.enemyType];
    const hpMult = s.hpMult || 1;
    killGold += Math.round(def.gold * scale) * s.count;
    totalHp += def.hp * scale * hpMult * s.count;
    enemyCount += s.count;
  }
  const income = lv.startGold + killGold + BAL.WAVE_CLEAR_BONUS * lv.waves.length;
  // 预算：覆盖塔数（slots/1.7 近似最小覆盖集）各建满 + 升 L5
  const coverTowers = Math.ceil(lv.slots.length / 1.7);
  const budget = coverTowers * L5_COST;
  const ratio = income / budget;

  // DPS 预算（全 slot 建满 L5 黄忠近似）vs 敌总血
  const l5 = towerStats(GENERALS.huang, BAL.MAX_TOWER_LEVEL);
  const dpsPerTower = l5.dmg / l5.interval;
  const dpsBudget = dpsPerTower * lv.slots.length;
  const timeToClear = totalHp / Math.max(1, dpsBudget);   // 粗估秒（忽略抗性/分散）

  const econOk = ratio >= 1.1;             // income ≥ budget×1.1
  return { id: lv.id, name: lv.name, waves: lv.waves.length, enemyCount, income, budget, ratio, totalHp: Math.round(totalHp), dpsBudget: Math.round(dpsBudget), timeToClear: Math.round(timeToClear), econOk };
}

let warn = 0;
console.log('关 | 波 | 兵 | 收入 | 预算 | income/budget | 敌总血 | DPS预算 | 粗估清场s | 经济');
for (const lv of LEVELS) {
  const r = report(lv);
  if (!r.econOk) warn++;
  console.log(`L${r.id} ${r.name} | ${r.waves} | ${r.enemyCount} | ${r.income} | ${r.budget} | ${r.ratio.toFixed(2)} | ${r.totalHp} | ${r.dpsBudget} | ${r.timeToClear} | ${r.econOk ? '✅' : '⚠ income<budget×1.1'}`);
}
console.log(`\n汇总：${LEVELS.length} 关，经济告警 ${warn} 关（income < budget×1.1）。`);
console.log('指标为趋势参考（带宽容带，非硬门禁）；winnable 硬 assert 才是通关保证。');
process.exit(0);
