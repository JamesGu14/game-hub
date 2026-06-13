// core/hit.js — [改进⑧] 点击命中:按棋盘像素距离取最近塔。
// 旧法 towerAt 按脚下单格精确匹配——立绘画在格上方(头/身伸出格顶),点视觉主体时坐标落上一格判空→选不中
//（"在武将头上点好几次"的根因）。改为按到立绘视觉中心(脚底上方 0.5 格)的像素距离取最近,半径覆盖立绘主体。
import { BAL } from '../data/balance.js';

const C = BAL.CELL;
const HIT_R = C * 0.7;   // 命中半径(覆盖立绘主体 + 容差)

// towers=state.towers;bx,by=棋盘像素坐标(=(screenX-view.ox)/view.scale)。返回最近塔或 null。
export function towerAtPixel(towers, bx, by) {
  let best = null, bestD2 = HIT_R * HIT_R;
  for (const t of towers) {
    const cx = t.px, cy = t.py - C * 0.5;   // 视觉中心(立绘主体居中处,比脚底更贴手感)
    const dx = bx - cx, dy = by - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) { bestD2 = d2; best = t; }
  }
  return best;
}
