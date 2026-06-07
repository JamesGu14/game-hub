// ui/pauseMenu.js — [P5] 暂停菜单（屏幕坐标 layout/hit/draw）：继续/重开本关/选关/← 返回游戏中心。
// 由 ESC 或点 HUD ⏸ 触发（见 main.js）。paused 时 gameLoop 已不推进模拟，本菜单仅叠加渲染 + 路由。
import { panel, button, title, FONT, PAL } from './theme.js';

const PW = 320, BTN_H = 48, GAP = 12, HEAD_H = 78, PAD_BOT = 20;
const ITEMS = [
  { id: 'resume', label: '继续', variant: 'jade' },
  { id: 'restart', label: '重开本关', variant: 'gold' },
  { id: 'select', label: '选关', variant: 'wood' },
  { id: 'hub', label: '← 返回游戏中心', variant: 'ghost' },
];

// 居中面板矩形。
function panelRect(view) {
  const ph = HEAD_H + ITEMS.length * BTN_H + (ITEMS.length - 1) * GAP + PAD_BOT;
  return { x: (view.w - PW) / 2, y: (view.h - ph) / 2, w: PW, h: ph };
}

// 按钮组（含 id/label/variant + 屏幕矩形）。hit 与 draw 共用。
export function pauseLayout(view) {
  const P = panelRect(view);
  const bw = PW - 56, bx = P.x + 28;
  let by = P.y + HEAD_H;
  return ITEMS.map((it) => { const b = { ...it, x: bx, y: by, w: bw, h: BTN_H }; by += BTN_H + GAP; return b; });
}

// 命中 → 'resume'|'restart'|'select'|'hub'|null。
export function hitPause(view, sx, sy) {
  for (const b of pauseLayout(view)) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.id;
  }
  return null;
}

// state 可选：传入则显示「第 N 关 · 关名」副标题。
export function drawPause(ctx, view, state) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(8,6,4,.62)'; ctx.fillRect(0, 0, view.w, view.h);   // 压暗

  const P = panelRect(view);
  panel(ctx, P.x, P.y, P.w, P.h, { variant: 'wood', r: 16 });
  title(ctx, '暂停', view.w / 2, P.y + 38, 34);
  if (state && state.level) {
    ctx.fillStyle = PAL.dim; ctx.font = FONT.body(13); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(`第 ${state.level.id} 关 · ${state.level.name}`, view.w / 2, P.y + 62);
  }
  for (const b of pauseLayout(view)) button(ctx, b, { label: b.label, variant: b.variant });
}
