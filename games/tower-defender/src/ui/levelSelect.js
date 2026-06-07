// ui/levelSelect.js — [P4/P5] 选关界面（屏幕坐标 layout/hit/draw）= 游戏主页。
// [P5] 三国皮肤：楷体大标题 + 势力旗色卡（theme.panel）+ 金星 + 朱印「封」锁 + 下一关金框 glow。
// layout/hit 为单一来源（命中测试依赖），仅 draw 换 theme。
import { isUnlocked, nextPlayableIndex } from '../core/save.js';
import { FACTIONS } from '../data/factions.js';
import { backdrop, panel, title, seal, roundRect, FONT, PAL } from './theme.js';

const COLS = 4;

export function levelSelectLayout(view, total) {
  const cols = COLS, rows = Math.ceil(total / cols);
  const cw = Math.max(140, Math.min(230, (view.w - 80) / cols - 16));
  const ch = Math.max(96, Math.min(124, (view.h - 200) / rows - 16));
  const gap = 18;
  const gridW = cols * cw + (cols - 1) * gap;
  const x0 = (view.w - gridW) / 2, y0 = 132;
  const cards = [];
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    cards.push({ index: i, x: x0 + c * (cw + gap), y: y0 + r * (ch + gap), w: cw, h: ch });
  }
  return cards;
}

// 命中已解锁卡 → 0-based index；锁定/空白 → null。
export function hitLevelSelect(view, save, total, sx, sy) {
  for (const card of levelSelectLayout(view, total)) {
    if (sx >= card.x && sx <= card.x + card.w && sy >= card.y && sy <= card.y + card.h) {
      return isUnlocked(save, card.index + 1) ? card.index : null;
    }
  }
  return null;
}

export function drawLevelSelect(ctx, view, save, levels) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(ctx, view.w, view.h);

  // 标题 + 副标题
  title(ctx, '成都保卫战', view.w / 2, 58, 52);
  ctx.fillStyle = PAL.dim; ctx.font = FONT.body(15); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('蜀汉守成都 · 六将御三方 —— 选择关卡', view.w / 2, 100);

  const nextIdx = nextPlayableIndex(save, levels.length);
  for (const card of levelSelectLayout(view, levels.length)) {
    const lv = levels[card.index];
    const unlocked = isUnlocked(save, card.index + 1);
    const stars = save.stars[card.index + 1] || 0;
    const fac = FACTIONS[lv.faction] || FACTIONS.nanman;
    const isNext = card.index === nextIdx && unlocked;

    panel(ctx, card.x, card.y, card.w, card.h, { variant: unlocked ? 'wood' : 'ink', r: 12, glow: isNext });

    // 顶部势力旗色条
    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.45;
    roundRect(ctx, card.x + 12, card.y + 12, card.w - 24, 6, 3);
    const fg = ctx.createLinearGradient(card.x, 0, card.x + card.w, 0);
    fg.addColorStop(0, fac.tint.grassA); fg.addColorStop(1, fac.tint.grassB);
    ctx.fillStyle = fg; ctx.fill();
    ctx.restore();

    // 文字块
    ctx.save();
    if (!unlocked) ctx.globalAlpha = 0.5;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = unlocked ? PAL.gold : PAL.goldDim; ctx.font = FONT.body(13, 700);
    ctx.fillText('第 ' + (card.index + 1) + ' 关', card.x + 16, card.y + 42);
    ctx.fillStyle = unlocked ? PAL.cream : PAL.dim; ctx.font = FONT.head(20);
    ctx.fillText(lv.name, card.x + 16, card.y + 71);
    ctx.fillStyle = PAL.dim; ctx.font = FONT.body(12);
    ctx.fillText(fac.name + '军', card.x + 16, card.y + 91);
    ctx.restore();

    if (!unlocked) {
      // 朱印「封」锁
      seal(ctx, card.x + card.w - 28, card.y + card.h - 28, 17, '封', { shape: 'square' });
    } else {
      // 三星（已得金亮 / 未得暗金）
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = FONT.body(16);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = i < stars ? PAL.goldBright : 'rgba(212,175,55,.26)';
        ctx.fillText('★', card.x + 16 + i * 19, card.y + card.h - 14);
      }
      // 下一关「续战」角标
      if (isNext) {
        ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = PAL.goldBright; ctx.font = FONT.head(15);
        ctx.fillText('▶ 续战', card.x + card.w - 14, card.y + card.h - 13);
      }
    }
  }

  // 底部提示
  ctx.fillStyle = 'rgba(167,176,192,.6)'; ctx.font = FONT.body(13);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('点击已解锁关卡出征 · 通关得星解锁下一关', view.w / 2, view.h - 38);
}
