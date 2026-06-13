// tests/tower-hit.test.mjs — [改进⑧] 点击命中盒:按棋盘像素距离取最近塔(修"点武将头/身选不中")。
// 旧 towerAt 按脚下单格精确匹配,立绘画在格上方→点视觉主体坐标落上一格判空→选不中。
// 运行: node games/tower-defender/tests/tower-hit.test.mjs
import assert from 'node:assert';
import { towerAtPixel } from '../src/core/hit.js';
import { BAL } from '../src/data/balance.js';

const C = BAL.CELL;
const towers = [{ px: 100, py: 100, slot: { x: 2, y: 2 } }];

// 点武将头部(脚底上方 0.8 格 = 视觉主体内、但在脚下格之上)→ 应命中(旧法这里选不中)
assert.equal(towerAtPixel(towers, 100, 100 - C * 0.8), towers[0], '点头部应命中该塔');
// 点脚底中心 → 命中
assert.equal(towerAtPixel(towers, 100, 100), towers[0], '点脚底应命中');
// 点 1.5 格外 → 不命中(返回 null → 上层据此关弹窗/建塔)
assert.equal(towerAtPixel(towers, 100 + C * 1.5, 100), null, '远处不命中');
// 多塔取最近
const two = [{ px: 100, py: 100, slot: { x: 2, y: 2 } }, { px: 200, py: 100, slot: { x: 7, y: 2 } }];
assert.equal(towerAtPixel(two, 195, 100 - C * 0.5), two[1], '取最近塔');
// 空场 → null
assert.equal(towerAtPixel([], 100, 100), null, '空场 null');

console.log('ok tower-hit');
