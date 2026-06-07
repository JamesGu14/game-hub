// ui/levelSelect.js — [P4] 选关界面(屏幕坐标 layout/hit/draw)。8 关卡片:锁/星/下一关高亮。
// 精美标题/动画 = Phase 5;本期最小可玩。
import { isUnlocked, nextPlayableIndex } from '../core/save.js';
import { FACTIONS } from '../data/factions.js';

const COLS = 4;

export function levelSelectLayout(view, total) {
  const cols = COLS, rows = Math.ceil(total / cols);
  const cw = Math.max(140, Math.min(230, (view.w - 80) / cols - 16));
  const ch = Math.max(96, Math.min(120, (view.h - 200) / rows - 16));
  const gap = 18;
  const gridW = cols * cw + (cols - 1) * gap;
  const x0 = (view.w - gridW) / 2, y0 = 128;
  const cards = [];
  for (let i = 0; i < total; i++) {
    const r = Math.floor(i / cols), c = i % cols;
    cards.push({ index: i, x: x0 + c * (cw + gap), y: y0 + r * (ch + gap), w: cw, h: ch });
  }
  return cards;
}

// 命中已解锁卡 → 0-based index;锁定/空白 → null。
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
  ctx.fillStyle = '#15100a'; ctx.fillRect(0, 0, view.w, view.h);

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe08a'; ctx.font = '700 34px system-ui';
  ctx.fillText('成都保卫战', view.w / 2, 56);
  ctx.fillStyle = '#9aa6b8'; ctx.font = '15px system-ui';
  ctx.fillText('蜀汉守成都 · 六将御三方 —— 选择关卡', view.w / 2, 90);

  const nextIdx = nextPlayableIndex(save, levels.length);
  for (const card of levelSelectLayout(view, levels.length)) {
    const lv = levels[card.index];
    const unlocked = isUnlocked(save, card.index + 1);
    const stars = save.stars[card.index + 1] || 0;
    const tint = (FACTIONS[lv.faction] || FACTIONS.nanman).tint;

    ctx.fillStyle = unlocked ? 'rgba(30,38,52,.96)' : 'rgba(20,22,28,.9)';
    ctx.fillRect(card.x, card.y, card.w, card.h);
    ctx.fillStyle = tint.grassB; ctx.fillRect(card.x, card.y, card.w, 7);   // 势力色条
    const isNext = card.index === nextIdx && unlocked;
    ctx.lineWidth = isNext ? 3 : 1.5;
    ctx.strokeStyle = isNext ? '#ffd24d' : (unlocked ? '#41506b' : '#2a2e38');
    ctx.strokeRect(card.x, card.y, card.w, card.h);

    ctx.globalAlpha = unlocked ? 1 : 0.5;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cfe0ff'; ctx.font = '700 17px system-ui';
    ctx.fillText('第 ' + (card.index + 1) + ' 关', card.x + 14, card.y + 32);
    ctx.fillStyle = '#fff'; ctx.font = '600 16px system-ui';
    ctx.fillText(lv.name, card.x + 14, card.y + 56);
    ctx.fillStyle = '#8aa6b8'; ctx.font = '12px system-ui';
    ctx.fillText((FACTIONS[lv.faction] || {}).name || '', card.x + 14, card.y + 76);

    if (!unlocked) {
      ctx.globalAlpha = 1; ctx.fillStyle = '#7f8794'; ctx.font = '26px system-ui'; ctx.textAlign = 'right';
      ctx.fillText('🔒', card.x + card.w - 12, card.y + card.h / 2 + 8);
    } else {
      ctx.font = '15px system-ui'; ctx.textAlign = 'left';
      ctx.fillStyle = stars > 0 ? '#ffd24d' : '#7f8794';
      ctx.fillText(stars > 0 ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : '未通关', card.x + 14, card.y + card.h - 14);
    }
    ctx.globalAlpha = 1;
  }
}
