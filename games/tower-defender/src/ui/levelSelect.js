// ui/levelSelect.js — [检查点A] 分章/分页选关（屏幕坐标 layout/hit/draw）= 游戏主页。
// 一次显示一章（≤10 关，5×2 网格）+ 章头 + ◀上一章/下一章▶。layout/hit 单一来源。
import { isUnlocked, nextPlayableIndex } from '../core/save.js';
import { FACTIONS } from '../data/factions.js';
import { CHAPTERS } from '../data/campaign.js';
import { backdrop, panel, title, seal, button, roundRect, FONT, PAL } from './theme.js';

const COLS = 5;
const NAV_W = 132, NAV_H = 44;

// 当前章关卡（全局 index 升序）
function chapterLevels(levels, chapterIdx) {
  const chId = CHAPTERS[chapterIdx]?.id;
  const out = [];
  for (let i = 0; i < levels.length; i++) if (levels[i].chapter === chId) out.push({ index: i, lv: levels[i] });
  return out;
}

export function levelSelectLayout(view, levels, chapterIdx) {
  const list = chapterLevels(levels, chapterIdx);
  const cols = COLS, rows = Math.max(1, Math.ceil(list.length / cols));
  const cw = Math.max(150, Math.min(220, (view.w - 120) / cols - 16));
  const ch = Math.max(92, Math.min(120, (view.h - 280) / rows - 16));
  const gap = 18;
  const gridW = cols * cw + (cols - 1) * gap;
  const gridH = rows * ch + (rows - 1) * gap;
  // 标题区(150) + 网格 + 导航行 作为整块在视口内垂直居中（小屏时贴顶，留 12px）
  const HEADER_H = 150, GAP_NAV = 44;
  const totalH = HEADER_H + gridH + GAP_NAV + NAV_H;
  const top = Math.max(12, (view.h - totalH) / 2);
  const x0 = (view.w - gridW) / 2, y0 = top + HEADER_H;
  const cards = list.map((it, k) => {
    const r = Math.floor(k / cols), c = k % cols;
    return { index: it.index, x: x0 + c * (cw + gap), y: y0 + r * (ch + gap), w: cw, h: ch };
  });
  const header = { titleY: top + 50, chapterY: top + 100, subY: top + 126 };
  const navY = y0 + gridH + GAP_NAV;
  const prev = chapterIdx > 0 ? { x: view.w / 2 - 160 - NAV_W, y: navY, w: NAV_W, h: NAV_H } : null;
  const next = chapterIdx < CHAPTERS.length - 1 ? { x: view.w / 2 + 160, y: navY, w: NAV_W, h: NAV_H } : null;
  return { cards, prev, next, header, navY };
}

export function hitLevelSelect(view, save, levels, chapterIdx, sx, sy) {
  const L = levelSelectLayout(view, levels, chapterIdx);
  for (const card of L.cards) {
    if (sx >= card.x && sx <= card.x + card.w && sy >= card.y && sy <= card.y + card.h) {
      return isUnlocked(save, card.index + 1) ? { kind: 'level', index: card.index } : null;
    }
  }
  if (L.prev && sx >= L.prev.x && sx <= L.prev.x + L.prev.w && sy >= L.prev.y && sy <= L.prev.y + L.prev.h) return { kind: 'chapter', delta: -1 };
  if (L.next && sx >= L.next.x && sx <= L.next.x + L.next.w && sy >= L.next.y && sy <= L.next.y + L.next.h) return { kind: 'chapter', delta: 1 };
  return null;
}

export function drawLevelSelect(ctx, view, save, levels, chapterIdx) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(ctx, view.w, view.h);
  const chapter = CHAPTERS[chapterIdx];

  const nextIdx = nextPlayableIndex(save, levels.length);
  const L = levelSelectLayout(view, levels, chapterIdx);

  title(ctx, '成都保卫战', view.w / 2, L.header.titleY, 46);
  ctx.fillStyle = PAL.gold; ctx.font = FONT.head(22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`第 ${chapter.id} 章 · ${chapter.title}`, view.w / 2, L.header.chapterY);
  ctx.fillStyle = PAL.dim; ctx.font = FONT.body(13);
  ctx.fillText('蜀汉守成都 · 六将御三方 —— 选择关卡', view.w / 2, L.header.subY);
  for (const card of L.cards) {
    const lv = levels[card.index];
    const unlocked = isUnlocked(save, card.index + 1);
    const stars = save.stars[card.index + 1] || 0;
    const fac = FACTIONS[lv.faction] || FACTIONS.nanman;
    const isNext = card.index === nextIdx && unlocked;
    panel(ctx, card.x, card.y, card.w, card.h, { variant: unlocked ? 'wood' : 'ink', r: 12, glow: isNext });

    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.45;
    roundRect(ctx, card.x + 12, card.y + 12, card.w - 24, 6, 3);
    const fg = ctx.createLinearGradient(card.x, 0, card.x + card.w, 0);
    fg.addColorStop(0, fac.tint.grassA); fg.addColorStop(1, fac.tint.grassB);
    ctx.fillStyle = fg; ctx.fill();
    ctx.restore();

    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.5;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = unlocked ? PAL.gold : PAL.goldDim; ctx.font = FONT.body(12, 700);
    ctx.fillText('第 ' + (card.index + 1) + ' 关', card.x + 14, card.y + 40);
    ctx.fillStyle = unlocked ? PAL.cream : PAL.dim; ctx.font = FONT.head(17);
    ctx.fillText(lv.name, card.x + 14, card.y + 66);
    ctx.fillStyle = PAL.dim; ctx.font = FONT.body(11);
    ctx.fillText(fac.name + '军', card.x + 14, card.y + 85);
    ctx.restore();

    if (!unlocked) {
      seal(ctx, card.x + card.w - 26, card.y + card.h - 26, 15, '封', { shape: 'square' });
    } else {
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = FONT.body(15);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < stars ? PAL.goldBright : 'rgba(212,175,55,.26)';
        ctx.fillText('★', card.x + 14 + i * 18, card.y + card.h - 13);
      }
      if (isNext) {
        ctx.textAlign = 'right'; ctx.fillStyle = PAL.goldBright; ctx.font = FONT.head(14);
        ctx.fillText('▶ 续战', card.x + card.w - 12, card.y + card.h - 12);
      }
    }
  }

  // 章节导航
  if (L.prev) button(ctx, L.prev, { label: '◀ 上一章', variant: 'wood' });
  if (L.next) button(ctx, L.next, { label: '下一章 ▶', variant: 'wood' });
  ctx.fillStyle = PAL.gold; ctx.font = FONT.head(18); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(`${chapter.id} / ${CHAPTERS.length}`, view.w / 2, L.navY + NAV_H / 2);
}
