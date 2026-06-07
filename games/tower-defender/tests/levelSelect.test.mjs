// tests/levelSelect.test.mjs — [P4] 选关卡片命中:已解锁→index、锁定/空白→null
// 运行：node games/tower-defender/tests/levelSelect.test.mjs
import assert from 'node:assert';
import { levelSelectLayout, hitLevelSelect } from '../src/ui/levelSelect.js';
import { defaultSave } from '../src/core/save.js';

const view = { w: 1280, h: 800, scale: 1, ox: 0, oy: 0 };
const total = 8;

// 已解锁卡 → 返回 0-based index
{
  const save = defaultSave(); save.unlockedLevel = 8;
  const c = levelSelectLayout(view, total)[3];
  assert.equal(hitLevelSelect(view, save, total, c.x + 5, c.y + 5), 3, '点第4卡 → idx3');
}

// 锁定卡 → null
{
  const save = defaultSave();   // unlockedLevel=1
  const c = levelSelectLayout(view, total)[3];
  assert.equal(hitLevelSelect(view, save, total, c.x + 5, c.y + 5), null, '锁定卡 → null');
}

// 空白处 → null
{
  const save = defaultSave(); save.unlockedLevel = 8;
  assert.equal(hitLevelSelect(view, save, total, 4, 4), null, '空白 → null');
}

console.log('ok levelSelect');
