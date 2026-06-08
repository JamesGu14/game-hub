// tests/bosses.test.mjs — boss 名册完整性（§5.2 扩 15-20）
// 运行：node games/tower-defender/tests/bosses.test.mjs
import assert from 'node:assert';
import { BOSSES } from '../src/data/bosses.js';

const ids = Object.keys(BOSSES);
assert.ok(ids.length >= 15 && ids.length <= 20, `boss 数 ${ids.length} 应在 15-20`);
for (const id of ids) {
  const b = BOSSES[id];
  assert.equal(b.id, id, `${id} id 自洽`);
  assert.ok(typeof b.name === 'string' && b.name.length, `${id} 有 name`);
  assert.ok(typeof b.hpMult === 'number' && b.hpMult >= 1, `${id} hpMult≥1`);
}
// 司马懿仍带双主动技
assert.ok(BOSSES.simayi.bossSkills?.includes('summon') && BOSSES.simayi.bossSkills?.includes('stunTower'), '司马懿 召唤+震慑');
// 5 样板战 boss 必在册
for (const id of ['xiahoudun', 'zhangliao', 'caocao', 'xiahouyuan', 'luxun']) {
  assert.ok(BOSSES[id], `样板战 boss ${id} 在册`);
}

console.log('ok bosses');
