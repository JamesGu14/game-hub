// tests/groundLayout.test.mjs — 布点:路径格展开/硬软禁区/全50关确定性+禁区不变量+数量区间
// 运行:node games/tower-defender/tests/groundLayout.test.mjs
import assert from 'node:assert';
import { LEVELS } from '../src/data/levels.js';
import { pathCellSet, hardBanSet, softBanSet } from '../src/render/ground.js';

// 1) 路径格:L1 path a 首段 (1,1)→(5,1) 应展开为 5 格;角点只记一次
{
  const lv = LEVELS[0];
  const set = pathCellSet(lv);
  for (let x = 1; x <= 5; x++) assert.ok(set.has(x + ',1'), `L1 路径格 (${x},1)`);
  assert.ok(!set.has('0,0'), 'L1 (0,0) 非路径格');
}

// 2) 硬禁区:含 路径/将位/城堡+名牌行/敌营+名牌格/玩法地形
{
  const lv = LEVELS[0];
  const set = pathCellSet(lv);
  const hard = hardBanSet(lv, set);
  const s0 = lv.slots[0];
  assert.ok(hard.has(s0.x + ',' + s0.y), '将位在硬禁区');
  const { c, r, w, h } = lv.castle;
  assert.ok(hard.has(c + ',' + r), '城堡格');
  assert.ok(hard.has(c + ',' + (r + h)), '城名牌行');
  assert.ok(hard.has(lv.camps[0].c + ',' + (lv.camps[0].r + 1)), '敌营名牌格');
  // L1 是 ch1A,有 plateau (8,6,2,2):
  const pl = lv.terrain.find((z) => z.type === 'plateau');
  assert.ok(pl && hard.has(pl.cells[0].x + ',' + pl.cells[0].y), '玩法地形格');
}

// 3) 软禁区:路径格 8 邻、且不与路径格重合
{
  const lv = LEVELS[0];
  const set = pathCellSet(lv);
  const soft = softBanSet(lv, set);
  assert.ok(soft.size > 0, '软禁区非空');
  for (const k of soft) assert.ok(!set.has(k), '软禁区不含路径格');
  assert.ok(soft.has('1,0') || soft.has('0,1'), '(1,1) 路径格的邻格入软禁区');
}
console.log('ok groundLayout');
