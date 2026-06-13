// tests/levelSelect.test.mjs — [检查点A] 分章选关：命中卡→{kind:'level',index}、导航→{kind:'chapter',delta}
// 运行：node games/tower-defender/tests/levelSelect.test.mjs
import assert from 'node:assert';
import { levelSelectLayout, hitLevelSelect, cheatHotspot } from '../src/ui/levelSelect.js';
import { defaultSave } from '../src/core/save.js';

const view = { w: 1280, h: 800 };
// 构造 50 假关（5 章 × 10）
const levels = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, chapter: Math.floor(i / 10) + 1, name: 'L' + (i + 1), faction: 'wei' }));

// 第 1 章：显示 idx 0..9 共 10 卡
{
  const L = levelSelectLayout(view, levels, 0);
  assert.equal(L.cards.length, 10, '第1章 10 卡');
  assert.equal(L.cards[0].index, 0); assert.equal(L.cards[9].index, 9);
  assert.equal(L.prev, null, '首章无上一章');
  assert.ok(L.next, '首章有下一章');
}

// 第 3 章：显示 idx 20..29
{
  const L = levelSelectLayout(view, levels, 2);
  assert.equal(L.cards[0].index, 20, '第3章首卡=idx20');
  assert.ok(L.prev && L.next, '中间章有上下');
}

// 末章无下一章
{
  const L = levelSelectLayout(view, levels, 4);
  assert.ok(L.prev && !L.next, '末章无下一章');
}

// 命中已解锁卡 → {kind:'level',index}
{
  const save = defaultSave(); save.unlockedLevel = 50;
  const c = levelSelectLayout(view, levels, 0).cards[3];
  assert.deepEqual(hitLevelSelect(view, save, levels, 0, c.x + 5, c.y + 5), { kind: 'level', index: 3 }, '点第4卡 → idx3');
}

// 锁定卡 → null
{
  const save = defaultSave();   // unlockedLevel=1
  const c = levelSelectLayout(view, levels, 0).cards[3];
  assert.equal(hitLevelSelect(view, save, levels, 0, c.x + 5, c.y + 5), null, '锁定卡 → null');
}

// 命中「下一章」→ {kind:'chapter',delta:1}
{
  const save = defaultSave(); save.unlockedLevel = 50;
  const L = levelSelectLayout(view, levels, 0);
  assert.deepEqual(hitLevelSelect(view, save, levels, 0, L.next.x + 5, L.next.y + 5), { kind: 'chapter', delta: 1 }, '下一章');
}

// [作弊] 隐藏热区:"卫"(成都保卫战 第4字)字形矩形,落标题带内、不压副标题、位于中线右侧
{
  const ctx = { save() {}, restore() {}, set font(v) {}, measureText: (s) => ({ width: s.length * 46 }) };
  const hs = cheatHotspot(ctx, view, levels, 0);
  const L = levelSelectLayout(view, levels, 0);
  assert.ok(hs && typeof hs.x === 'number' && hs.w > 0 && hs.h > 0, 'cheatHotspot 返回矩形');
  assert.ok(hs.x + hs.w / 2 > view.w / 2, '"卫"在标题中线右侧(第4字)');
  assert.ok(hs.y + hs.h < L.header.chapterY, '不压章节副标题');
  assert.ok(hs.y > L.header.titleY - 46, '在标题带内');
}

console.log('ok levelSelect');
