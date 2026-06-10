// tests/economy-upgrade.test.mjs — 升级造价/封顶/买不起 + 拆除返还 60%（§17.1）
// 运行：node games/tower-defender/tests/economy-upgrade.test.mjs
import assert from 'node:assert';
import { tryBuild, tryUpgrade, sellTower, upgradeCost } from '../src/systems/economySystem.js';
import { BAL } from '../src/data/balance.js';
import { GENERALS } from '../src/data/generals.js';

// 升级造价 L2..L5（× 基础 cost）；满级=MAX_TOWER_LEVEL；invested 累加
{
  const s = { gold: 100000, towers: [] };
  tryBuild(s, { x: 1, y: 1 }, 'huang');           // -90；L1，invested 90
  const t = s.towers[0];
  const base = GENERALS.huang.cost;               // 90
  const costAt = (lvl) => Math.round(base * { 1: BAL.UPGRADE_COST_L2, 2: BAL.UPGRADE_COST_L3, 3: BAL.UPGRADE_COST_L4, 4: BAL.UPGRADE_COST_L5 }[lvl]);
  let invested = 90;
  for (let lvl = 1; lvl < BAL.MAX_TOWER_LEVEL; lvl++) {
    const c = costAt(lvl);
    assert.equal(upgradeCost(t), c, `L${lvl + 1} 造价 ${c}`);
    assert.equal(tryUpgrade(s, t), true, `升 L${lvl + 1}`);
    assert.equal(t.level, lvl + 1);
    invested += c;
    assert.equal(t.totalInvested, invested, `invested 累加到 ${invested}`);
  }
  assert.equal(t.level, BAL.MAX_TOWER_LEVEL, `已到满级 L${BAL.MAX_TOWER_LEVEL}`);
  assert.equal(tryUpgrade(s, t), false, '满级不可升');
  assert.equal(upgradeCost(t), Infinity, '满级造价 ∞');
}

// 钱不够升级 → false、不变
{
  const s = { gold: 90, towers: [] };
  assert.equal(tryBuild(s, { x: 0, y: 0 }, 'huang'), true);   // gold → 0
  const t = s.towers[0];
  assert.equal(tryUpgrade(s, t), false, '钱不够不升级');
  assert.equal(t.level, 1, '仍 L1');
}

// 拆除返还 = 总投入 ×0.6
{
  const s = { gold: 1000, towers: [] };
  tryBuild(s, { x: 2, y: 2 }, 'zhao');            // 200 → 800；invested 200
  const t = s.towers[0];
  tryUpgrade(s, t);                                // L2 cost 200 → 600；invested 400
  const refund = sellTower(s, t);
  assert.equal(refund, Math.floor(400 * 0.6), '返还 240（总投入×0.6）');
  assert.equal(s.towers.length, 0, '塔已拆');
  assert.equal(s.gold, 600 + 240, '返还入账');
}

console.log('ok economy-upgrade');
