// ui/resultPanel.js — [P4/P5] 结算面板：朱印「胜/败」+ 金星 + 下一关/重玩/选关。
// [P5] 三国皮肤：压暗 + 居中木匾 + theme.seal 大印 + theme.button。layout(resultButtons) 为单一来源。
import { panel, button, title, seal, FONT, PAL } from './theme.js';

const BTN_W = 124, BTN_H = 44, GAP = 16;
const BTN_Y_OFF = 84;        // 按钮下移,给解锁提示行留位(spec §4)

// 按钮组：won 且非末关 → next/retry/select；否则 retry/select。total = LEVELS.length。
export function resultButtons(view, state, total) {
  const won = state.phase === 'won';
  const hasNext = won && state.level.id < total;
  const ids = hasNext ? ['next', 'retry', 'select'] : ['retry', 'select'];
  const totalW = ids.length * BTN_W + (ids.length - 1) * GAP;
  let x = (view.w - totalW) / 2;
  const y = view.h / 2 + BTN_Y_OFF;
  return ids.map((id) => { const b = { id, x, y, w: BTN_W, h: BTN_H }; x += BTN_W + GAP; return b; });
}

export function hitResult(view, state, total, sx, sy) {
  for (const b of resultButtons(view, state, total)) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.id;
  }
  return null;
}

export function drawResult(ctx, view, state, total, opts = {}) {
  const won = state.phase === 'won';
  const cx = view.w / 2, cy = view.h / 2;
  ctx.setTransform(view.dpr || 1, 0, 0, view.dpr || 1, 0, 0);   // [C5] 屏幕坐标含 dpr
  ctx.fillStyle = 'rgba(8,6,4,.66)'; ctx.fillRect(0, 0, view.w, view.h);   // 压暗

  // 居中木匾底板（宽度容纳按钮组）
  const btns = resultButtons(view, state, total);
  const PW = Math.max(440, btns.length * BTN_W + (btns.length - 1) * GAP + 72);
  panel(ctx, cx - PW / 2, cy - 156, PW, 296, { variant: 'wood', r: 16 });

  // 大印「胜 / 败」
  const R = 46;
  if (won) {
    seal(ctx, cx, cy - 92, R, '胜', { color: PAL.jade, textColor: PAL.goldBright });
    ctx.save(); ctx.strokeStyle = PAL.gold; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy - 92, R + 8, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  } else {
    seal(ctx, cx, cy - 92, R, '败', { color: '#585450', textColor: '#d8d2c8' });
  }

  // 标题文字
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (won) {
    title(ctx, '守城成功', cx, cy - 24, 30);
  } else {
    title(ctx, '成都失守', cx, cy - 18, 30);
    ctx.fillStyle = PAL.dim; ctx.font = FONT.body(14);
    ctx.fillText('再整军备战，卷土重来', cx, cy + 8);
  }

  // 金星 + 解锁提示（仅 won）
  if (won) {
    const s = state.stars || 0;
    ctx.font = FONT.body(30); ctx.textBaseline = 'middle';
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < s ? PAL.goldBright : 'rgba(212,175,55,.26)';
      ctx.fillText('★', cx - 38 + i * 38, cy + 8);
    }
    if (state.level.id < total) {
      ctx.fillStyle = PAL.jadeBright; ctx.font = FONT.body(13, 700);
      ctx.fillText('已解锁 · 第 ' + (state.level.id + 1) + ' 关', cx, cy + 33);
    }
    if (opts.unlockNotice) {
      ctx.fillStyle = PAL.goldBright; ctx.font = FONT.body(15, 700);
      ctx.fillText(opts.unlockNotice, cx, cy + 58);
    }
  }

  // 按钮
  const labels = { next: '下一关 ▶', retry: '重玩', select: '选关' };
  const variants = { next: 'jade', retry: 'gold', select: 'wood' };
  for (const b of btns) button(ctx, b, { label: labels[b.id], variant: variants[b.id] });
}
