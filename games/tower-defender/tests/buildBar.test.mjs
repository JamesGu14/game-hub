// tests/buildBar.test.mjs — 建造栏布局/命中:永远单行(6牌→解锁五虎后12牌横排)/窄屏自适应/锁定将不可命中(spec §5/实测②)
// 运行:node games/tower-defender/tests/buildBar.test.mjs
import assert from 'node:assert';
import { buildBarLayout, hitBuildBar, ROW_CHEAP, ROW_PREMIUM, HOTKEYS } from '../src/ui/buildBar.js';

const view = { w: 1280, h: 800 };
const mkState = (ids) => ({ unlocked: ids ? new Set(ids) : null, gold: 999 });

// 段序与价格升序
assert.deepEqual(ROW_CHEAP, ['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'], '左段新6将价格升序');
assert.deepEqual(ROW_PREMIUM, ['huang', 'zhang', 'guan', 'ma', 'zhuge', 'zhao'], '右段五虎+诸葛价格升序');

// 新档:无五虎解锁 → 单行 6 项,全部可点
{
  const st = mkState(ROW_CHEAP);
  const L = buildBarLayout(view, st);
  assert.equal(L.length, 6, '第1章单行 6 牌');
  assert.ok(L.every((b) => !b.locked), '全部解锁');
  const ys = new Set(L.map((b) => b.y));
  assert.equal(ys.size, 1, '单行同一 y');
  assert.equal(hitBuildBar(view, st, L[0].x + 5, L[0].y + 5), 'liao', '命中首位');
}

// 解锁赵/张后:仍单行 12 牌(廉价 6 在左、五虎 6 在右),锁定命中返回 null
{
  const st = mkState([...ROW_CHEAP, 'zhao', 'zhang']);
  const L = buildBarLayout(view, st);
  assert.equal(L.length, 12, '解锁五虎后 12 牌');
  assert.equal(new Set(L.map((b) => b.y)).size, 1, '[实测②] 永远单行同一 y(两行曾在 iPad 盖棋盘)');
  assert.deepEqual(L.map((b) => b.id), [...ROW_CHEAP, ...ROW_PREMIUM], '廉价段在左、五虎段在右');
  assert.deepEqual(L.map((b) => b.row), [...Array(6).fill('cheap'), ...Array(6).fill('premium')], 'row 段位语义保留');
  const zhao = L.find((b) => b.id === 'zhao'), huang = L.find((b) => b.id === 'huang');
  assert.equal(zhao.locked, false, '赵云已解锁');
  assert.equal(huang.locked, true, '黄忠锁定');
  assert.equal(hitBuildBar(view, st, zhao.x + 5, zhao.y + 5), 'zhao', '解锁将可命中');
  assert.equal(hitBuildBar(view, st, huang.x + 5, huang.y + 5), null, '锁定将命中 null');
  // 宽屏 1280:12 牌放得下满尺寸(74px),不缩
  assert.ok(L.every((b) => b.w === 74), '宽屏满尺寸牌宽');
}

// unlocked=null(调试/单测)→ 全解锁 12 牌单行
assert.equal(buildBarLayout(view, mkState(null)).length, 12, 'null=全解锁 12 牌');

// [实测②] 窄屏自适应(iPad 竖屏 768):12 牌缩宽不越界、不重叠、触控底线 ≥44px
{
  const narrow = { w: 768, h: 1024 };
  const st = mkState(null);
  const L = buildBarLayout(narrow, st);
  assert.equal(L.length, 12, '窄屏仍 12 牌');
  assert.equal(new Set(L.map((b) => b.y)).size, 1, '窄屏仍单行');
  assert.ok(L.every((b) => b.w >= 44), `触控底线 ≥44px(实际 ${L[0].w})`);
  assert.ok(L[0].x >= 0 && L[11].x + L[11].w <= narrow.w, '不越界');
  for (let i = 1; i < L.length; i++) assert.ok(L[i].x >= L[i - 1].x + L[i - 1].w, '牌间不重叠');
  // 命中与布局同源:窄牌中心命中各自 id
  for (const b of L) assert.equal(hitBuildBar(narrow, st, b.x + b.w / 2, b.y + b.h / 2), b.id, `窄屏命中 ${b.id}`);
}

// 热键映射:左段 1-6,右段 qwerty
assert.equal(HOTKEYS['1'], 'liao'); assert.equal(HOTKEYS['6'], 'yueying');
assert.equal(HOTKEYS['q'], 'huang'); assert.equal(HOTKEYS['y'], 'zhao');
console.log('ok buildBar');
