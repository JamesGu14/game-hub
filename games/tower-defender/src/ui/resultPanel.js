// ui/resultPanel.js — [P4] 最小结算面板(胜/负 + 下一关/重玩/选关)。精美动画结算 = Phase 5。
const BTN_W = 120, BTN_H = 42, GAP = 16;

// 按钮组:won 且非末关 → next/retry/select;否则 retry/select。total = LEVELS.length。
export function resultButtons(view, state, total) {
  const won = state.phase === 'won';
  const hasNext = won && state.level.id < total;
  const ids = hasNext ? ['next', 'retry', 'select'] : ['retry', 'select'];
  const totalW = ids.length * BTN_W + (ids.length - 1) * GAP;
  let x = (view.w - totalW) / 2;
  const y = view.h / 2 + 34;
  return ids.map((id) => { const b = { id, x, y, w: BTN_W, h: BTN_H }; x += BTN_W + GAP; return b; });
}

export function hitResult(view, state, total, sx, sy) {
  for (const b of resultButtons(view, state, total)) {
    if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.id;
  }
  return null;
}

export function drawResult(ctx, view, state, total) {
  const won = state.phase === 'won';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(8,6,4,.6)'; ctx.fillRect(0, 0, view.w, view.h);   // 压暗

  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = won ? '#ffe08a' : '#ff8a8a'; ctx.font = '700 40px system-ui';
  ctx.fillText(won ? '守城成功' : '成都失守…', view.w / 2, view.h / 2 - 52);

  if (won) {
    const s = state.stars || 0;
    ctx.fillStyle = '#ffd24d'; ctx.font = '34px system-ui';
    ctx.fillText('★'.repeat(s) + '☆'.repeat(3 - s), view.w / 2, view.h / 2 - 6);
    if (state.level.id < total) {
      ctx.fillStyle = '#9be07a'; ctx.font = '15px system-ui';
      ctx.fillText('已解锁 第 ' + (state.level.id + 1) + ' 关', view.w / 2, view.h / 2 + 18);
    }
  }

  const labels = { next: '下一关 ▶', retry: '重玩', select: '选关' };
  for (const b of resultButtons(view, state, total)) {
    ctx.fillStyle = b.id === 'next' ? 'rgba(60,208,112,.92)' : 'rgba(40,52,72,.96)';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#5a6b8a'; ctx.lineWidth = 1.5; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.id === 'next' ? '#10240f' : '#fff'; ctx.font = '600 16px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(labels[b.id], b.x + b.w / 2, b.y + b.h / 2);
  }
}
