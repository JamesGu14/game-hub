// combat.js — 数值地基。三层叠加：最终 = 基础 × (1+Σ局内%) × (1+Σ局外%)。纯函数。
const pct = (m, k) => (m && typeof m[k] === 'number' ? m[k] : 0);
const add = (m, k) => (m && typeof m[k] === 'number' ? m[k] : 0);

export function effectiveStats(base, inMods = {}, outMods = {}) {
  const mul = (k) => (1 + pct(inMods, k)) * (1 + pct(outMods, k));
  // 射速%越高→间隔越短：interval / (1+Σ射速%)。两层相乘。
  const fireMul = (1 + pct(inMods, 'fireRatePct')) * (1 + pct(outMods, 'fireRatePct'));
  return {
    damage: base.damage * mul('damagePct'),
    fireInterval: base.fireInterval / fireMul,
    bulletSpeed: base.bulletSpeed * mul('bulletSpeedPct'),
    pierce: base.pierce + add(inMods, 'pierceAdd') + add(outMods, 'pierceAdd'),
    multishot: base.multishot + add(inMods, 'multishotAdd') + add(outMods, 'multishotAdd'),
    critRate: Math.min(1, base.critRate + pct(inMods, 'critRatePct') + pct(outMods, 'critRatePct')),
    critMult: base.critMult + add(inMods, 'critMultAdd') + add(outMods, 'critMultAdd'),
    splash: base.splash + add(inMods, 'splashAdd') + add(outMods, 'splashAdd'),
  };
}

export function rollDamage(stats, rng) {
  const isCrit = rng() < stats.critRate;
  return { amount: isCrit ? stats.damage * stats.critMult : stats.damage, isCrit };
}

export function applyDamage(enemy, amount, fromFront) {
  let dmg = amount;
  if (fromFront && enemy.frontShield) dmg = amount * (1 - enemy.frontShield);
  enemy.hp -= dmg;
  return dmg;
}

export function tickDoT(enemy, dt) {
  if (!enemy.dots || enemy.dots.length === 0) return 0;
  let total = 0;
  for (const d of enemy.dots) {
    const t = Math.min(dt, d.remain);
    const dmg = d.dps * t;
    total += dmg; d.remain -= t;
  }
  enemy.hp -= total;
  enemy.dots = enemy.dots.filter((d) => d.remain > 1e-6);
  return total;
}
