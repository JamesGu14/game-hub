// render/board.js — 盘面：棋盘格 + 弯曲蜀道 + 将位 + 成都 + 敌营（色块占位）。只读 state。
// 约定：调用方已把 ctx 变换设到「板像素坐标」（见 main.js camera）。
import { BAL } from '../data/balance.js';
import { tintOf } from '../data/factions.js';

const C = BAL.CELL;

export function drawBoard(ctx, state) {
  const { cols, rows, paths, slots, castle, camps } = state.level;
  const tint = tintOf(state.level.faction);     // [P3] 势力盘面色调(南蛮绿/东吴青/曹魏冷灰)

  // 棋盘格草地
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = ((r + c) & 1) ? tint.grassA : tint.grassB;
      ctx.fillRect(c * C, r * C, C, C);
    }
  }

  // 弯曲蜀道（沿 waypoint 画粗线）
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const id in paths) {
    const wp = paths[id];
    ctx.beginPath();
    ctx.moveTo(wp[0].x * C + C / 2, wp[0].y * C + C / 2);
    for (let i = 1; i < wp.length; i++) ctx.lineTo(wp[i].x * C + C / 2, wp[i].y * C + C / 2);
    ctx.strokeStyle = tint.road; ctx.lineWidth = C * 0.72; ctx.stroke();
    ctx.strokeStyle = tint.road2; ctx.lineWidth = C * 0.58; ctx.stroke();
  }

  // 将位（未占用 = 虚线绿框）
  ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.strokeStyle = '#9be07a';
  for (const s of slots) {
    if (state.towers.some((t) => t.slot.x === s.x && t.slot.y === s.y)) continue;
    ctx.strokeRect(s.x * C + 4, s.y * C + 4, C - 8, C - 8);
  }
  ctx.setLineDash([]);

  // 敌营（深色块 + 旗）
  for (const cp of camps) {
    ctx.fillStyle = '#4a3550'; ctx.fillRect(cp.c * C + 3, cp.r * C + 3, C - 6, C - 6);
    ctx.fillStyle = '#b3243a'; ctx.fillRect(cp.c * C + C / 2 - 1, cp.r * C + 4, 8, 5);
  }

  // 成都 2×2
  ctx.fillStyle = '#9aa0a8';
  ctx.fillRect(castle.c * C + 2, castle.r * C + 2, castle.w * C - 4, castle.h * C - 4);
  ctx.fillStyle = '#5f6268'; ctx.lineWidth = 2;
  ctx.strokeRect(castle.c * C + 2, castle.r * C + 2, castle.w * C - 4, castle.h * C - 4);
  ctx.fillStyle = '#2b2b30'; ctx.font = `bold ${C * 0.46}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('成都', (castle.c + castle.w / 2) * C, (castle.r + castle.h / 2) * C);
}
