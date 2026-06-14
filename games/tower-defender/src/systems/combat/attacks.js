// systems/combat/attacks.js — 五种攻击行为派发（§17.1 + §17.2 被动）。
// 由 combatSystem 在「塔 CD 到、target 在射程」后调用 runAttack。
// single(黄/赵·赵L3连射) · splash(张) · slow(关) · charge(马·马L3击退) · burn(诸葛·诸葛L3×藤甲)。
import { effectiveStats } from '../../data/generals.js';
import { BAL } from '../../data/balance.js';
import { calcDamage } from './damageCalc.js';
import { applySlow, applyBurn } from './statusEffects.js';
import { killEnemy } from './kill.js';
import { spawnTracer } from './projectileManager.js';
import { spawnRing, spawnFloat } from '../../render/fx.js';

const CELL = BAL.CELL;

// 一次直伤命中：算伤→扣血→tracer→（致死则）killEnemy。返回是否击杀。
function hitOnce(state, tower, g, enemy, rng) {
  const { dmg, isCrit } = calcDamage(tower, g, enemy, rng);
  enemy.hp -= dmg;
  enemy.lastHitAt = state.time;                   // [P6] 受击时间戳（纯表现：entityRenderer 受击闪白）
  if (isCrit) {                                   // [改进④] 黄忠百步穿杨暴击：头顶飘字 + 闪红（数值零改，纯特效）
    enemy.critFlashAt = state.time;
    spawnFloat(state, enemy.px, enemy.py - CELL * 0.6, '暴击!', '#ff5a3a');
  }
  spawnTracer(state, tower, enemy, g.color, g.attack);
  if (enemy.hp <= 0) return killEnemy(state, enemy, tower.generalId);
  return false;
}

function inRange(tower, e, rangePx2) {
  const dx = e.px - tower.px, dy = e.py - tower.py;
  return dx * dx + dy * dy <= rangePx2;
}

export function runAttack(state, tower, g, primary, now, rng) {
  const stats = effectiveStats(tower);
  const rangePx2 = (stats.range * CELL) ** 2;
  switch (g.attack) {
    // splash/slow/burn 不在本层判射程(targeting+combatSystem 已确认 primary 在圈内);rangePx2 仅供连射/冲锋选次目标
    case 'splash': return attackSplash(state, tower, g, primary, rng);
    case 'slow':   return attackSlow(state, tower, g, primary, now, rng);
    case 'charge': return attackCharge(state, tower, g, primary, rng, rangePx2);
    case 'burn':   return attackBurn(state, tower, g, primary, now, stats);
    case 'single':
    default:       return attackSingle(state, tower, g, primary, rng, rangePx2);
  }
}

// 黄忠/赵云：单体。赵云 L3 七进七出：击杀后连射最前的下一目标（每次出手最多连 maxChain）。
function attackSingle(state, tower, g, primary, rng, rangePx2) {
  const killed = hitOnce(state, tower, g, primary, rng);
  const chainable = killed && tower.level >= BAL.SIGNATURE_LEVEL && g.signature?.id === 'qijin';
  if (!chainable) return;
  const maxChain = g.signature.params.maxChain || 2;
  let shots = 1, lastKilled = true;
  while (lastKilled && shots < maxChain) {
    let next = null, best = -Infinity;
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.flying && g.targets === 'ground') continue;
      if (!inRange(tower, e, rangePx2)) continue;
      if (e.progress > best) { best = e.progress; next = e; }
    }
    if (!next) break;
    lastKilled = hitOnce(state, tower, g, next, rng);
    shots++;
  }
}

// 张飞：溅射半径内地面多体（含 primary）。
function attackSplash(state, tower, g, primary, rng) {
  hitOnce(state, tower, g, primary, rng);
  const r = (g.attackParams.splash || 1) * CELL, r2 = r * r;
  for (const e of state.enemies) {
    if (!e.alive || e === primary || e.flying) continue;   // 溅射仅地
    const dx = e.px - primary.px, dy = e.py - primary.py;
    if (dx * dx + dy * dy <= r2) hitOnce(state, tower, g, e, rng);
  }
  spawnRing(state, primary.px, primary.py, g.color, r);
}

// 关羽：命中（谋略）+ 减速。
function attackSlow(state, tower, g, primary, now, rng) {
  hitOnce(state, tower, g, primary, rng);
  applySlow(primary, g.attackParams.slowPct, g.attackParams.slowDur, now);
}

// 马超：以 primary（最前目标）为锋尖，沿同 path 冲锋穿透其身后跟随者（progress≤primary）≤maxHits 地面敌；
// L3 西凉突阵：锋尖（primary）末端击退。
function attackCharge(state, tower, g, primary, rng, rangePx2) {
  const maxHits = g.attackParams.maxHits || 3;
  const line = [];
  for (const e of state.enemies) {
    if (!e.alive || e.flying) continue;
    if (e.pathId !== primary.pathId) continue;
    if (e.progress > primary.progress + 1e-9) continue;    // primary 及其身后（含自身）
    if (!inRange(tower, e, rangePx2)) continue;
    line.push(e);
  }
  line.sort((a, b) => b.progress - a.progress);            // 锋尖（primary）在前
  const hits = line.slice(0, maxHits);
  for (const e of hits) hitOnce(state, tower, g, e, rng);
  if (tower.level >= BAL.SIGNATURE_LEVEL && g.signature?.id === 'tuzhen' && hits.length) {
    const front = hits[0];                                  // = primary（冲锋锋尖）
    if (front.alive) front.knockback += g.signature.params.knockback || 0.5;
  }
  spawnTracer(state, tower, primary, g.color, g.attack);
}

// 诸葛：上灼烧（DoT，不走直伤）；L3 火烧藤甲对藤甲 dps×2。
function attackBurn(state, tower, g, primary, now, stats) {
  let dps = stats.dmg;
  if (tower.level >= BAL.SIGNATURE_LEVEL && g.signature?.id === 'huoshao' && primary.tag === 'tengjia') {
    dps *= g.signature.params.vsTengjiaMult || 2;
  }
  applyBurn(primary, dps, g.attackParams.burnDur, now);
  spawnTracer(state, tower, primary, g.color, g.attack);
}
