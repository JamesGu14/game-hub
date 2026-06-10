// tests/plate.test.mjs — 名牌几何：宽度随字数递增、水平居中、scale 放大
// 运行：node games/tower-defender/tests/plate.test.mjs
import assert from 'node:assert';
import { plateRect } from '../src/render/plate.js';

const C = 36;
const r2 = plateRect('街亭', 100, 200, C);
const r3 = plateRect('五丈原', 100, 200, C);
const r4 = plateRect('葭萌关城', 100, 200, C);
assert.ok(r2.w < r3.w && r3.w < r4.w, '宽度随字数递增');
for (const r of [r2, r3, r4]) {
  assert.ok(Math.abs((r.x + r.w / 2) - 100) < 0.51, '水平居中于 cx');
  assert.equal(r.y, 200, '牌顶贴 footY');
  assert.ok(r.h > 0 && r.fontPx > 0, '高度/字号为正');
  assert.equal(r.textX, 100, '文字 x=cx');
  assert.ok(r.textY > r.y && r.textY < r.y + r.h, '文字 y 在牌内');
}
const big = plateRect('成都', 100, 200, C, 1.3);
assert.ok(big.fontPx > r2.fontPx && big.w > r2.w, 'scale=1.3 整体放大');
console.log('ok plate');
