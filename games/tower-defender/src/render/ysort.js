// render/ysort.js — 实体绘制顺序：按脚底 py 升序（远→近）排序，供 billboard y-sort 遮挡。
// 纯函数（不改 state、不触 DOM/ctx）：返回新数组，原数组不变 → 可单测。
// 用法：main render 合并 [...towers, ...enemies] → sortByY → 依次 drawTower/drawEnemy（小 py 先画、被大 py 盖住）。
export function sortByY(entities) {
  // 复制后排序（Array.sort 原地）：不破坏调用方的 towers/enemies。py 升序；NaN/缺失视作 0。
  return entities.slice().sort((a, b) => ((a && a.py) || 0) - ((b && b.py) || 0));
}
