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
  for (const z of b.terrain || []) {
    assert.ok(TERRAIN_TYPES.has(z.type), `${id} terrain 类型 ${z.type} 合法`);
    assert.ok((z.cells && z.cells.length) || (z.rects && z.rects.length), `${id} terrain 区非空`);
  }
}
console.log(`ok baseBoards (${Object.keys(BASE_BOARDS).length} 板)`);
