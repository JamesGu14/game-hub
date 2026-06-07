// ui/buildBar.js — [P5] 底部建造栏（屏幕坐标）：六将木牌（头像+楷体将名+金价）+ 命中检测（热键 1-6 见 main）。
// layout/hit 为单一来源（draw 共用），BW/BH 微调，hit 自动跟随。
import { GENERALS } from '../data/generals.js';
import { panel, roundRect, FONT, PAL } from './theme.js';

const ITEMS = ['huang', 'zhang', 'guan', 'zhao', 'ma', 'zhuge'];
const BW = 74, BH = 60, GAP = 8;

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
  buildBarLayout(view).forEach((b, i) => {
    const g = GENERALS[b.id];
    const afford = state.gold >= g.cost;
    const sel = b.id === selected;
    panel(ctx, b.x, b.y, b.w, b.h, { variant: 'wood', r: 9, glow: sel });

    ctx.save();
    if (!afford) ctx.globalAlpha = 0.55;
    // 头像牌：将色底 + 上亮下暗叠层 + 白字描边将名首字
    const aw = b.w - 18, ah = 24, ax = b.x + 9, ay = b.y + 7;
    roundRect(ctx, ax, ay, aw, ah, 5);
    ctx.fillStyle = g.color; ctx.fill();
    const sh = ctx.createLinearGradient(0, ay, 0, ay + ah);
    sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(1, 'rgba(0,0,0,.34)');
    roundRect(ctx, ax, ay, aw, ah, 5); ctx.fillStyle = sh; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = FONT.head(15); ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(20,12,4,.7)'; ctx.strokeText(g.name[0], ax + aw / 2, ay + ah / 2 + 0.5);
    ctx.fillStyle = '#fff'; ctx.fillText(g.name[0], ax + aw / 2, ay + ah / 2 + 0.5);
    // 将名（楷体）
    ctx.fillStyle = sel ? PAL.goldBright : PAL.cream; ctx.font = FONT.head(13);
    ctx.fillText(g.name, b.x + b.w / 2, b.y + 44);
    ctx.restore();

    // 金价（买不起标红）
    ctx.fillStyle = afford ? PAL.goldBright : PAL.warn; ctx.font = FONT.body(11, 700);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('💰' + g.cost, b.x + b.w / 2, b.y + b.h - 9);

    // 左上热键角标（对应 1-6）
    ctx.fillStyle = 'rgba(20,13,6,.78)';
    roundRect(ctx, b.x + 4, b.y + 4, 14, 13, 3); ctx.fill();
    ctx.fillStyle = PAL.gold; ctx.font = FONT.body(9, 700); ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), b.x + 11, b.y + 11);
  });
}
