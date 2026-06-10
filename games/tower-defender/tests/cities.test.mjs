// tests/cities.test.mjs — 城名池：池长度=由 CAMPAIGN×TEMPLATES 推导的需求、章内唯一、2-4 汉字
// 运行：node games/tower-defender/tests/cities.test.mjs
import assert from 'node:assert';
import { CITY_POOLS } from '../src/data/cities.js';
import { CAMPAIGN } from '../src/data/campaign.js';
import { TEMPLATES } from '../src/data/boardTemplates.js';

// 推导各章 camp 总需求（样板关按 pathSubset，生成关按模板全路）
const need = {};
for (const c of CAMPAIGN) {
  const tmpl = TEMPLATES[c.templateId];
  const n = (c.pathSubset && c.pathSubset.length) || Object.keys(tmpl.paths).length;
  need[c.chapter] = (need[c.chapter] || 0) + n;
}

for (const ch of [1, 2, 3, 4, 5]) {
  const pool = CITY_POOLS[ch];
  assert.ok(Array.isArray(pool), `章${ch} 池存在`);
  assert.equal(pool.length, need[ch], `章${ch} 池长 ${pool && pool.length} 应= ${need[ch]}`);
  assert.equal(new Set(pool).size, pool.length, `章${ch} 城名章内唯一`);
  for (const name of pool) assert.ok(/^[一-鿿]{2,4}$/.test(name), `城名「${name}」应为 2-4 个汉字`);
}
console.log('ok cities');
