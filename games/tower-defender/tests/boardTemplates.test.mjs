// tests/boardTemplates.test.mjs — 每板型几何过 verifyLevel（0 errors/0 leaks）+ 必带 slots
// 运行：node games/tower-defender/tests/boardTemplates.test.mjs
import assert from 'node:assert';
import { TEMPLATES } from '../src/data/boardTemplates.js';
import { verifyLevel } from '../tools/verify-levels.mjs';

const ids = Object.keys(TEMPLATES);
assert.ok(ids.length >= 4 && ids.length <= 16, `板型数 ${ids.length} 应在 4-16`);

for (const id of ids) {
  const t = TEMPLATES[id];
  assert.ok(Array.isArray(t.slots) && t.slots.length > 0, `${id} 必带 slots`);
  assert.ok(Array.isArray(t.camps) && t.camps.length > 0, `${id} 有 camps`);
  assert.ok(t.paths && Object.keys(t.paths).length === t.camps.length, `${id} camps↔paths 数一致`);
  // camp.id 与 path key 一一对应
  for (const c of t.camps) assert.ok(t.paths[c.id], `${id} camp ${c.id} 有同名 path`);
  // 构造最小关跑 verify（全路各一波 footman，验几何+slot 覆盖）
  const lv = {
    id: 'T_' + id, faction: 'nanman', scale: 1, startGold: 300, castleHp: 20,
    cols: t.cols, rows: t.rows, castle: t.castle, camps: t.camps, paths: t.paths, slots: t.slots,
    waves: [{ waveId: 1, startDelay: 0, spawns: t.camps.map((c) => ({ campId: c.id, pathId: c.id, enemyType: 'footman', count: 1, spawnInterval: 1, leadDelay: 0 })) }],
  };
  const r = verifyLevel(lv);
  assert.equal(r.errors.length, 0, `${id} verify errors: ${r.errors.join('; ')}`);
  assert.equal(r.leaks.length, 0, `${id} verify leaks: ${JSON.stringify(r.leaks)}`);
}

console.log('ok boardTemplates');
