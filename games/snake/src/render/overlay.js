/**
 * 屏幕空间覆盖层（死亡屏等）。在重置 transform 后调用。
 */
export function drawDeathOverlay(ctx, w, h, info) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 64px "PingFang SC", sans-serif';
    ctx.fillText('💥', w / 2, h / 2 - 110);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 36px "PingFang SC", sans-serif';
    ctx.fillText(`你被「${info.killerName}」吃掉了`, w / 2, h / 2 - 30);
    ctx.font = '24px "PingFang SC", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(`本局长度 ${info.lengthAtDeath} · 击杀 ${info.kills}`, w / 2, h / 2 + 30);
    // Countdown
    const remaining = Math.max(0, Math.ceil(info.timer));
    ctx.font = 'bold 56px ui-monospace, monospace';
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`${remaining}`, w / 2, h / 2 + 110);
    ctx.font = '18px "PingFang SC", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('秒后重生', w / 2, h / 2 + 155);
}
