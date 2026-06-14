// tests/codexScreen.test.mjs — 成就中心 layout/hit 纯几何（无 canvas）
import assert from 'node:assert';
import { codexLayout, hitCodex } from '../src/ui/codexScreen.js';

const view = { w: 1024, h: 720, dpr: 1 };

// 图鉴标签：44 张卡 across 三分区
{
  const L = codexLayout(view, 'codex');
  assert.equal(L.cards.length, 44, '44 张卡');
  assert.equal(L.cards.filter((c) => c.side === 'shu').length, 12, '我方 12');
  assert.equal(L.cards.filter((c) => c.side === 'boss').length, 20, '名将 20');
  assert.equal(L.cards.filter((c) => c.side === 'lieut').length, 12, '副将 12');
  assert.ok(L.tabs.codex && L.tabs.ach && L.back, '有标签与返回');
}

// 成就标签：无卡，15 行成就
{
  const L = codexLayout(view, 'ach');
  assert.equal(L.cards.length, 0, '成就页无卡格');
  assert.equal(L.rows.length, 15, '15 条成就行');
}

// hit：点第一张卡 → {kind:'card', id}
{
  const L = codexLayout(view, 'codex');
  const c0 = L.cards[0];
  const r = hitCodex(view, 'codex', c0.x + 2, c0.y + 2, null);
  assert.deepEqual(r, { kind: 'card', id: c0.id }, '点卡返回 card+id');
}

// hit：点成就标签 → 切 tab
{
  const L = codexLayout(view, 'codex');
  const t = L.tabs.ach;
  assert.deepEqual(hitCodex(view, 'codex', t.x + 2, t.y + 2, null), { kind: 'tab', tab: 'ach' }, '点成就标签');
}

// hit：详情打开时点空白 → 关详情
{
  assert.deepEqual(hitCodex(view, 'codex', 1, 1, 'guan'), { kind: 'closeDetail' }, '详情态点空白关闭');
}

// hit：返回
{
  const L = codexLayout(view, 'codex');
  const b = L.back;
  assert.deepEqual(hitCodex(view, 'codex', b.x + 2, b.y + 2, null), { kind: 'back' }, '点返回');
}

console.log('codexScreen.test.mjs OK');
