// ui/buildBar.js — 底部建造栏（屏幕坐标）：六将按钮 + 命中检测（热键 1-6 见 main）。
import { GENERALS } from '../data/generals.js';

const ITEMS = ['huang', 'zhang', 'guan', 'zhao', 'ma', 'zhuge'];
const BW = 72, BH = 56, GAP = 8;

export function buildBarLayout(view) {
  const totalW = ITEMS.length * (BW + GAP) - GAP;
  let x = (view.w - totalW) / 2;
  const y = view.h - BH - 12;
  return ITEMS.map((id) => { const b = { id, x, y, w: BW, h: BH }; x += BW + GAP; return b; });
}

export function hitBuildBar(view, sx, sy) {
  for (const b of buildBarLayout(view)) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.id;
  }
  return null;
}

export function drawBuildBar(ctx, state, view, selected) {
  for (const b of buildBarLayout(view)) {
    const g = GENERALS[b.id];
    const afford = state.gold >= g.cost;
    ctx.fillStyle = b.id === selected ? 'rgba(60,208,112,.28)' : 'rgba(28,34,48,.88)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = b.id === selected ? '#3cd070' : '#41506b'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);

    ctx.globalAlpha = afford ? 1 : 0.4;
    ctx.fillStyle = g.color; ctx.fillRect(b.x + b.w / 2 - 9, b.y + 8, 18, 14);
    ctx.fillStyle = '#fff'; ctx.font = '600 13px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(g.name, b.x + b.w / 2, b.y + 34);
    ctx.fillStyle = afford ? '#ffe08a' : '#ff9a9a'; ctx.font = '11px system-ui';
    ctx.fillText('💰' + g.cost, b.x + b.w / 2, b.y + b.h - 9);
    ctx.globalAlpha = 1;
  }
}
