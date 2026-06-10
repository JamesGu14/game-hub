// tests/baseBoards.test.mjs — 基板数据形状校验(取代旧 boardTemplates.test 的职责,切换任务删旧)
// 运行:node games/tower-defender/tests/baseBoards.test.mjs
import assert from 'node:assert';
import { BASE_BOARDS } from '../src/data/baseBoards.js';

const CHAPTER_CAMPS = { 1: 3, 2: 4, 3: 5, 4: 6, 5: 8 };
const TERRAIN_TYPES = new Set(['plateau', 'river', 'shallow', 'mountain', 'rockfall', 'firegully']);

for (const [id, b] of Object.entries(BASE_BOARDS)) {
  assert.equal(b.id, id, `${id} id 自洽`);
  assert.ok(/^ch[1-5][AB]$/.test(id), `${id} 命名 chN[A|B]`);
  assert.equal(b.chapter, +id[2], `${id} chapter 字段`);
  assert.equal(b.cols, 24, `${id} cols`);
  assert.equal(b.rows, 14, `${id} rows`);
  assert.deepEqual(b.castle, { c: 11, r: 6, w: 2, h: 2 }, `${id} castle 统一`);
  assert.equal(b.camps.length, CHAPTER_CAMPS[b.chapter], `${id} 营数=章最大`);
  assert.equal(Object.keys(b.paths).length, b.camps.length, `${id} camps↔paths 数一致`);
  for (const cp of b.camps) {
    const wp = b.paths[cp.id];
    assert.ok(wp, `${id} camp ${cp.id} 有同名 path`);
    assert.deepEqual(wp[0], { x: cp.c, y: cp.r }, `${id} path ${cp.id} 首点=camp`);
  }
  assert.equal(b.slotsVariants.length, 3, `${id} 恰 3 套将位`);
  const sigs = b.slotsVariants.map((s) => JSON.stringify([...s].sort((a, c) => a.x - c.x || a.y - c.y)));
  assert.equal(new Set(sigs).size, 3, `${id} 3 套将位两两不同`);
  // 槽位纯数据快查:界内/不落路/不落城(完整管道校验在 boardVariants.test 全组合,这里是最早门禁)
  const pathCells = new Set();
  for (const pid of Object.keys(b.paths)) {
    const wp = b.paths[pid];
    for (let i = 0; i < wp.length - 1; i++) {
      const a = wp[i], q = wp[i + 1];
      const L = Math.hypot(q.x - a.x, q.y - a.y) || 1e-6;
      const steps = Math.max(1, Math.ceil(L / 0.25));
      for (let k = 0; k <= steps; k++) { const tt = k / steps; pathCells.add(`${Math.round(a.x + (q.x - a.x) * tt)},${Math.round(a.y + (q.y - a.y) * tt)}`); }
    }
  }
  const castleCells = new Set();
  for (let c = b.castle.c; c < b.castle.c + b.castle.w; c++) for (let r = b.castle.r; r < b.castle.r + b.castle.h; r++) castleCells.add(`${c},${r}`);
  b.slotsVariants.forEach((variant, vi) => {
    for (const s of variant) {
      assert.ok(s.x >= 0 && s.x < b.cols && s.y >= 0 && s.y < b.rows, `${id} 套${vi} slot (${s.x},${s.y}) 越界`);
      assert.ok(!pathCells.has(`${s.x},${s.y}`), `${id} 套${vi} slot (${s.x},${s.y}) 落路`);
      assert.ok(!castleCells.has(`${s.x},${s.y}`), `${id} 套${vi} slot (${s.x},${s.y}) 落城`);
    }
  });
  for (const z of b.terrain || []) {
    assert.ok(TERRAIN_TYPES.has(z.type), `${id} terrain 类型 ${z.type} 合法`);
    assert.ok((z.cells && z.cells.length) || (z.rects && z.rects.length), `${id} terrain 区非空`);
  }
}
// 10 板完备 + 每章 A/B 配对
assert.deepEqual(
  Object.keys(BASE_BOARDS).sort(),
  ['ch1A', 'ch1B', 'ch2A', 'ch2B', 'ch3A', 'ch3B', 'ch4A', 'ch4B', 'ch5A', 'ch5B'],
  '恰好 10 张基板',
);
// 每章新机制就位(教学承诺):ch1 高台/ch2 河/ch3 浅滩/ch4 山+落石/ch5 火谷
const typesOf = (ch) => new Set(['A', 'B'].flatMap((h) => (BASE_BOARDS[`ch${ch}${h}`].terrain || []).map((z) => z.type)));
assert.ok(typesOf(1).has('plateau'), 'ch1 有高台');
assert.ok(typesOf(2).has('river'), 'ch2 有河');
assert.ok(typesOf(3).has('shallow'), 'ch3 有浅滩');
assert.ok(typesOf(4).has('mountain') && typesOf(4).has('rockfall'), 'ch4 有山+落石');
assert.ok(typesOf(5).has('firegully'), 'ch5 有火谷');
console.log(`ok baseBoards (${Object.keys(BASE_BOARDS).length} 板)`);
