// tests/chapterThemes.test.mjs — 主题数据完整性:5 章字段全/hex 合法/池非空/themeOf 回退
// 运行:node games/tower-defender/tests/chapterThemes.test.mjs
import assert from 'node:assert';
import { CHAPTER_THEMES, themeOf } from '../src/data/chapterThemes.js';

const HEX = /^#[0-9a-f]{6}$/i;
for (let ch = 1; ch <= 5; ch++) {
  const t = CHAPTER_THEMES[ch];
  assert.ok(t, `章${ch} 存在`);
  assert.ok(typeof t.name === 'string' && t.name.length >= 2, `章${ch} name`);
  assert.equal(t.grass.length, 2, `章${ch} grass×2`);
  t.grass.forEach((c) => assert.match(c, HEX, `章${ch} grass hex`));
  assert.equal(t.jitter.length, 3, `章${ch} jitter×3`);
  t.jitter.forEach((c) => assert.match(c, HEX, `章${ch} jitter hex`));
  for (const k of ['edge', 'outer', 'inner', 'worn']) assert.match(t.road[k], HEX, `章${ch} road.${k}`);
  assert.ok(t.patches.length >= 3, `章${ch} 拼块池≥3`);
  assert.ok(t.decors.length >= 2, `章${ch} 小景池≥2`);
  assert.equal(t.landmarks.length, 2, `章${ch} 地标池=2`);
  assert.ok(typeof t.accent === 'string', `章${ch} accent`);
  assert.ok('accentPatch' in t && (t.accentPatch === null || t.patches.includes(t.accentPatch)), `章${ch} accentPatch 合法`);
  assert.ok(t.vignette.startsWith('rgba('), `章${ch} vignette`);
  assert.ok(Object.keys(t.colors).length >= 6, `章${ch} colors 非空`);
  for (const k in t.colors) assert.match(t.colors[k], HEX, `章${ch} colors.${k}`);
  assert.ok(Array.isArray(t.waterAffinity), `章${ch} waterAffinity 数组`);
}
assert.equal(themeOf(99), CHAPTER_THEMES[1], 'themeOf 越界回退章1');
assert.equal(themeOf(undefined), CHAPTER_THEMES[1], 'themeOf 缺参回退');
assert.equal(themeOf(3), CHAPTER_THEMES[3], 'themeOf 正常');
console.log('ok chapterThemes');
