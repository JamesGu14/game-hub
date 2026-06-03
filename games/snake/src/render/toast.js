/** Renders a sliding achievement toast at the top center of the screen. */
export function drawAchievementToast(ctx, w, ach, t) {
    const total = 2.5;
    const enter = 0.3;
    const exit = 0.3;
    let alpha = 1;
    let dy = 0;
    if (t < enter) {
        const p = t / enter;
        alpha = p;
        dy = -40 * (1 - p);
    }
    else if (t > total - exit) {
        const p = (total - t) / exit;
        alpha = Math.max(0, p);
        dy = -10 * (1 - p);
    }
    const panelW = 360;
    const panelH = 86;
    const x = (w - panelW) / 2;
    const y = 88 + dy;
    ctx.save();
    ctx.globalAlpha = alpha;
    // Panel background
    ctx.fillStyle = 'rgba(15,23,42,0.92)';
    roundRect(ctx, x, y, panelW, panelH, 14);
    ctx.fill();
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.stroke();
    // Emoji
    ctx.font = '48px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(ach.emoji, x + 44, y + panelH / 2);
    // Text
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px "PingFang SC", sans-serif';
    ctx.fillText('🏆 解锁成就', x + 90, y + 22);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px "PingFang SC", sans-serif';
    ctx.fillText(ach.label, x + 90, y + 50);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px ui-monospace, monospace';
    ctx.fillText(ach.pinyin, x + 90, y + 72);
    ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
}
