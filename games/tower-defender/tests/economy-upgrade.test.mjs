// tests/economy-upgrade.test.mjs — 升级造价/封顶/买不起 + 拆除返还 60%（§17.1）
// 运行：node games/tower-defender/tests/economy-upgrade.test.mjs
import assert from 'node:assert';
import { tryBuild, tryUpgrade, sellTower, upgradeCost } from '../src/systems/economySystem.js';

// 升级造价 L2=70×1.0、L3=70×1.6；满级封顶；invested 累加
{
  const s = { gold: 1000, towers: [] };
  tryBuild(s, { x: 1, y: 1 }, 'huang');           // -70 → 930；L1，invested 70
  const t = s.towers[0];
  assert.equal(upgradeCost(t), 70, 'L2 造价 70');
  assert.equal(tryUpgrade(s, t), true);
  assert.equal(t.level, 2); assert.equal(s.gold, 860, '升 L2 -70');
  assert.equal(t.totalInvested, 140, 'invested 70+70');
  assert.equal(upgradeCost(t), 112, 'L3 造价 112');
  assert.equal(tryUpgrade(s, t), true);
  assert.equal(t.level, 3); assert.equal(s.gold, 748, '升 L3 -112');
  assert.equal(t.totalInvested, 252);
  assert.equal(tryUpgrade(s, t), false, 'L3 满级不可升');
  assert.equal(upgradeCost(t), Infinity, '满级造价 ∞');
}

// 钱不够升级 → false、不变
{
  const s = { gold: 70, towers: [] };
  assert.equal(tryBuild(s, { x: 0, y: 0 }, 'huang'), true);   // gold → 0
  const t = s.towers[0];
  assert.equal(tryUpgrade(s, t), false, '钱不够不升级');
  assert.equal(t.level, 1, '仍 L1');
}

// 拆除返还 = 总投入 ×0.6
{
  const s = { gold: 1000, towers: [] };
  tryBuild(s, { x: 2, y: 2 }, 'zhao');            // 160 → 840；invested 160
  const t = s.towers[0];
  tryUpgrade(s, t);                                // L2 cost 160 → 680；invested 320
  const refund = sellTower(s, t);
  assert.equal(refund, Math.floor(320 * 0.6), '返还 192（总投入×0.6）');
  assert.equal(s.towers.length, 0, '塔已拆');
  assert.equal(s.gold, 680 + 192, '返还入账');
}

console.log('ok economy-upgrade');
