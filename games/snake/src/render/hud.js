import { ITEM_EMOJI } from '../game/item';
import { CONFIG } from '../config';
const TAU = Math.PI * 2;
/** Top-left length + kills HUD. */
export function drawTopLeft(ctx, length, kills) {
    ctx.font = 'bold 48px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fbbf24';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 4;
    const lengthText = `🐍 ${length}`;
    ctx.strokeText(lengthText, 16, 16);
    ctx.fillText(lengthText, 16, 16);
    ctx.font = 'bold 28px ui-monospace, monospace';
    ctx.fillStyle = '#fff';
    const killText = `⚔ ${kills}`;
    ctx.strokeText(killText, 16, 72);
    ctx.fillText(killText, 16, 72);
}
/** Top-center active effects bar. */
export function drawActiveEffects(ctx, w, snake) {
    const effects = [];
    if (snake.shieldTimer > 0) {
        effects.push({ type: 'shield', remaining: snake.shieldTimer, total: CONFIG.ITEM_SHIELD_SEC });
    }
    if (snake.magnetTimer > 0) {
        effects.push({ type: 'magnet', remaining: snake.magnetTimer, total: CONFIG.ITEM_MAGNET_SEC });
    }
    if (snake.freeBoostTimer > 0) {
        effects.push({ type: 'freeBoost', remaining: snake.freeBoostTimer, total: CONFIG.ITEM_FREE_BOOST_SEC });
    }
    if (snake.foodRainTimer > 0) {
        effects.push({ type: 'foodRain', remaining: snake.foodRainTimer, total: CONFIG.ITEM_FOOD_RAIN_SEC });
    }
    if (effects.length === 0)
        return;
    const slotW = 80;
    const slotH = 56;
    const gap = 12;
    const totalW = effects.length * slotW + (effects.length - 1) * gap;
    let x = (w - totalW) / 2;
    const y = 16;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const e of effects) {
        // Background
        ctx.fillStyle = 'rgba(15,23,42,0.7)';
        roundRect(ctx, x, y, slotW, slotH, 12);
        ctx.fill();
        // Emoji
        ctx.font = '28px sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(ITEM_EMOJI[e.type], x + slotW / 2, y + 24);
        // Timer bar
        const barX = x + 8;
        const barY = y + slotH - 12;
        const barW = slotW - 16;
        const barH = 6;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(barX, barY, barW * (e.remaining / e.total), barH);
        x += slotW + gap;
    }
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
/** Top-right circular minimap. */
export function drawMinimap(ctx, w, player, aiSnakes) {
    const size = 120;
    const margin = 16;
    const cx = w - margin - size / 2;
    const cy = margin + size / 2;
    const worldR = CONFIG.WORLD_RADIUS;
    const scale = size / 2 / worldR;
    // Background disc
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, TAU);
    ctx.fillStyle = 'rgba(15,23,42,0.6)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // AI dots
    for (const s of aiSnakes) {
        if (!s.alive)
            continue;
        const px = cx + s.pos.x * scale;
        const py = cy + s.pos.y * scale;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, TAU);
        ctx.fillStyle = s.color;
        ctx.fill();
    }
    // Player dot
    if (player.alive) {
        const px = cx + player.pos.x * scale;
        const py = cy + player.pos.y * scale;
        ctx.beginPath();
        ctx.arc(px, py, 4.5, 0, TAU);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}
