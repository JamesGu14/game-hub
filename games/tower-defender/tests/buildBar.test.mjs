// tests/buildBar.test.mjs — 建造栏布局/命中:单行(仅新6将)/两行(解锁五虎后)/锁定将不可命中(spec §5)
// 运行:node games/tower-defender/tests/buildBar.test.mjs
import assert from 'node:assert';
import { buildBarLayout, hitBuildBar, ROW_CHEAP, ROW_PREMIUM, HOTKEYS } from '../src/ui/buildBar.js';

const view = { w: 1280, h: 800 };
const mkState = (ids) => ({ unlocked: ids ? new Set(ids) : null, gold: 999 });

// 行序与价格升序
assert.deepEqual(ROW_CHEAP, ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'], '下排新6将价格升序');
assert.deepEqual(ROW_PREMIUM, ['huang', 'zhang', 'guan', 'ma', 'zhuge', 'zhao'], '上排五虎+诸葛价格升序');

// 新档:无五虎解锁 → 单行 6 项,全部可点
{
  const st = mkState(ROW_CHEAP);
  const L = buildBarLayout(view, st);
  assert.equal(L.length, 6, '第1章单行 6 牌');
  assert.ok(L.every((b) => !b.locked), '全部解锁');
  const ys = new Set(L.map((b) => b.y));
  assert.equal(ys.size, 1, '单行同一 y');
  assert.equal(hitBuildBar(view, st, L[0].x + 5, L[0].y + 5), 'liao', '命中下排首位');
}

// 解锁赵/张后:两行 12 牌,上排 4 锁定;锁定命中返回 null
{
  const st = mkState([...ROW_CHEAP, 'zhao', 'zhang']);
  const L = buildBarLayout(view, st);
  assert.equal(L.length, 12, '两行 12 牌');
  const top = L.filter((b) => b.row === 'premium'), bottom = L.filter((b) => b.row === 'cheap');
  assert.equal(top.length, 6, '上排 6'); assert.equal(bottom.length, 6, '下排 6');
  assert.ok(top[0].y < bottom[0].y, '上排在下排之上');
  const zhao = top.find((b) => b.id === 'zhao'), huang = top.find((b) => b.id === 'huang');
  assert.equal(zhao.locked, false, '赵云已解锁');
  assert.equal(huang.locked, true, '黄忠锁定');
  assert.equal(hitBuildBar(view, st, zhao.x + 5, zhao.y + 5), 'zhao', '解锁将可命中');
  assert.equal(hitBuildBar(view, st, huang.x + 5, huang.y + 5), null, '锁定将命中 null');
}

// unlocked=null(调试/单测)→ 全解锁两行
assert.equal(buildBarLayout(view, mkState(null)).length, 12, 'null=全解锁 12 牌');

// 热键映射:下排 1-6,上排 qwerty
assert.equal(HOTKEYS['1'], 'liao'); assert.equal(HOTKEYS['6'], 'yueying');
assert.equal(HOTKEYS['q'], 'huang'); assert.equal(HOTKEYS['y'], 'zhao');
console.log('ok buildBar');
