// tests/storyScene.test.mjs — 演绎门禁2(spec §8.2):两幕 layout/hit/状态机推进 + stub ctx draw 不抛
// + save/restore 平衡。打字机速度是纯表现常量(rAF 时间驱动),不测速率,只测"未显完→全显→下一句→done"语义。
// 运行:node games/tower-defender/tests/storyScene.test.mjs
import assert from 'node:assert';
import { newStoryState, storySceneLayout, hitStoryScene, toDialogue, advanceDialogue, drawStoryScene } from '../src/ui/storyScene.js';
import { storyContentFor } from '../src/data/storylines.js';
import { LEVELS } from '../src/data/levels.js';

const view = { w: 1280, h: 800 };
const BASE = new Set(['liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying']);
const mkContent = () => ({ narration: '测试旁白讲解两句话。第二句。', script: [
  { who: 'liao', text: '报告主公，敌军来了！' },
  { who: 'liubei', text: '好。' },
  { who: 'zhongjiang', text: '（齐声）末将在！' },
] });

// 1) 初态 + 幕1 layout/hit:无续玩单继续钮;有续玩续上次+重头;review 单继续
{
  const st = newStoryState(mkContent(), { hasResume: false, review: false });
  assert.equal(st.act, 'narration'); assert.equal(st.lineIdx, 0);
  const L = storySceneLayout(view, st);
  assert.equal(L.buttons.length, 1); assert.equal(L.buttons[0].id, 'continue');
  const b = L.buttons[0];
  assert.equal(hitStoryScene(view, st, b.x + 2, b.y + 2), 'continue', '命中继续');
  assert.equal(hitStoryScene(view, st, 1, 1), null, '幕1 空白点击不消费(防误触,按钮制)');
}
{
  const st = newStoryState(mkContent(), { hasResume: true, review: false });
  const ids = storySceneLayout(view, st).buttons.map((b) => b.id).sort();
  assert.deepEqual(ids, ['restart', 'resume'], '续上次/重头');
  const r = storySceneLayout(view, st).buttons.find((b) => b.id === 'resume');
  assert.equal(hitStoryScene(view, st, r.x + 2, r.y + 2), 'resume');
}
{
  const st = newStoryState(mkContent(), { hasResume: true, review: true });
  const L = storySceneLayout(view, st);
  assert.equal(L.buttons.length, 1, 'review 模式忽略续玩,单继续钮');
}

// 2) 幕2 layout/hit:跳过钮命中;其余区域=tap;跳过钮不与 fs ⛶(右上 w-56..w-20)重叠
{
  const st = newStoryState(mkContent(), { hasResume: false, review: false });
  toDialogue(st, 1000);
  assert.equal(st.act, 'dialogue');
  const L = storySceneLayout(view, st);
  assert.ok(L.skip && L.box, '幕2 有跳过钮与对话框几何');
  assert.ok(L.skip.x + L.skip.w < view.w - 56, '跳过钮避让右上 ⛶');
  assert.equal(hitStoryScene(view, st, L.skip.x + 2, L.skip.y + 2), 'skip');
  assert.equal(hitStoryScene(view, st, view.w / 2, view.h / 2), 'tap');
}

// 3) 状态机推进:未显完 tap=全显(reveal)→ 已显完 tap=下一句(next)→ 末句已显完=done
{
  const st = newStoryState(mkContent(), { hasResume: false, review: false });
  toDialogue(st, 1000);
  assert.equal(advanceDialogue(st, 1050), 'reveal', '打字中 → 全显');   // 50ms 仅 ~1 字
  assert.equal(st.revealAll, true);
  assert.equal(advanceDialogue(st, 1100), 'next', '全显后 → 下一句');
  assert.equal(st.lineIdx, 1); assert.equal(st.revealAll, false);
  assert.equal(advanceDialogue(st, 99000), 'next', '句2"好。"自然显完 → 下一句(时间驱动,无需先 reveal)');
  assert.equal(st.lineIdx, 2);
  assert.equal(advanceDialogue(st, 999000), 'done', '末句显完 → done');
  assert.equal(advanceDialogue(st, 999100), 'done', 'done 幂等');
}

// 4) stub ctx draw 不抛 + save/restore 平衡:两幕 × 样板关(L1)/生成关(L2) × 多行号/时刻
{
  let depth = 0, maxNeg = 0;
  const ctx = new Proxy({
    save() { depth++; }, restore() { depth--; if (depth < 0) maxNeg++; },
    measureText(t) { return { width: (t ? String(t).length : 0) * 8 }; },
    createLinearGradient() { return { addColorStop() {} }; },
    createRadialGradient() { return { addColorStop() {} }; },
    beginPath() {}, moveTo() {}, lineTo() {}, arc() {}, arcTo() {}, closePath() {},
    fill() {}, stroke() {}, fillRect() {}, strokeRect() {}, fillText() {}, strokeText() {}, clip() {},
    setTransform() {}, ellipse() {}, rect() {}, setLineDash() {}, drawImage() {},
  }, { get(t, p) { return p in t ? t[p] : () => {}; }, set() { return true; } });

  for (const lv of [LEVELS[0], LEVELS[1]]) {
    const content = storyContentFor(lv, BASE);
    for (const hasResume of [false, true]) {
      const st = newStoryState(content, { hasResume, review: false });
      drawStoryScene(ctx, view, st, lv, 16.7);                       // 幕1
      toDialogue(st, 1000);
      drawStoryScene(ctx, view, st, lv, 1050);                       // 幕2 打字中
      advanceDialogue(st, 1050);
      drawStoryScene(ctx, view, st, lv, 2000);                       // 幕2 全显(▼ 闪烁分支)
      while (advanceDialogue(st, 9e6) !== 'done') drawStoryScene(ctx, view, st, lv, 9e6);   // 逐句到末句
      drawStoryScene(ctx, view, st, lv, 9e6);
    }
  }
  assert.equal(depth, 0, 'save/restore 平衡');
  assert.equal(maxNeg, 0, '无多余 restore');
}

// 5) 小窗布局不炸(iPad 横屏类):几何均有限数
{
  const small = { w: 1024, h: 640 };
  const st = newStoryState(mkContent(), { hasResume: false, review: false });
  toDialogue(st, 0);
  const L = storySceneLayout(small, st);
  for (const r of [L.box, L.skip, L.portraits.left, L.portraits.right]) {
    for (const k of ['x', 'y', 'w', 'h']) assert.ok(Number.isFinite(r[k]), `小窗 ${k} 有限`);
  }
  assert.ok(L.portraits.left.y > 0, '小窗立绘不越上沿');
}

console.log('ok storyScene');
