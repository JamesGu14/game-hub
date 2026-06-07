// tests/progress.test.mjs — [P4] 选关/解锁助手:isUnlocked / nextPlayableIndex / applyClear 链
// 运行：node games/tower-defender/tests/progress.test.mjs
import assert from 'node:assert';
import { defaultSave, isUnlocked, nextPlayableIndex, applyClear } from '../src/core/save.js';

// isUnlocked(levelId 1-based)
{
  const s = defaultSave(); s.unlockedLevel = 3;
  assert.equal(isUnlocked(s, 1), true);
  assert.equal(isUnlocked(s, 3), true);
  assert.equal(isUnlocked(s, 4), false, '未解锁');
}

// nextPlayableIndex(0-based)
{
  const s = defaultSave(); s.stars = { 1: 3, 2: 1 };
  assert.equal(nextPlayableIndex(s, 8), 2, '下一未通关 = 第3关(idx2)');
}
{
  const s = defaultSave();
  assert.equal(nextPlayableIndex(s, 8), 0, '新档 → idx0');
}
{
  const s = defaultSave(); for (let i = 1; i <= 8; i++) s.stars[i] = 3;
  assert.equal(nextPlayableIndex(s, 8), 7, '全通关 → 末关 idx7');
}

// applyClear 解锁链 + isUnlocked 协同
{
  let g = defaultSave();
  g = applyClear(g, 1, 2);
  assert.equal(g.unlockedLevel, 2);
  assert.equal(isUnlocked(g, 2), true, '通 L1 → L2 解锁');
  assert.equal(isUnlocked(g, 3), false, 'L3 仍锁');
}

console.log('ok progress');
