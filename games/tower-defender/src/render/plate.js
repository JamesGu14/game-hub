// render/plate.js — 城名牌几何（纯函数，无 ctx/DOM，供 board.js 绘制与单测）。
// 返回 { x, y, w, h, fontPx, textX, textY }：牌顶贴 footY、水平居中于 cx。
export function plateRect(text, cx, footY, C, scale = 1) {
  const fontPx = Math.round(C * 0.3 * scale);
  const padX = Math.round(C * 0.12 * scale), padY = Math.round(C * 0.07 * scale);
  const w = text.length * fontPx + padX * 2;
  const h = fontPx + padY * 2;
  return { x: cx - w / 2, y: footY, w, h, fontPx, textX: cx, textY: footY + h / 2 };
}
