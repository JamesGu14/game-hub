import { CONFIG } from '../config';
import { ITEM_EMOJI } from '../game/item';
const TAU = Math.PI * 2;
export function drawItems(ctx, items, camera) {
    const halfW = camera.cssWidth / camera.viewScale / 2;
    const halfH = camera.cssHeight / camera.viewScale / 2;
    const margin = 40;
    const minX = camera.pos.x - halfW - margin;
    const maxX = camera.pos.x + halfW + margin;
    const minY = camera.pos.y - halfH - margin;
    const maxY = camera.pos.y + halfH + margin;
    for (const it of items) {
        if (it.pos.x < minX || it.pos.x > maxX)
            continue;
        if (it.pos.y < minY || it.pos.y > maxY)
            continue;
        // Pulsing glow
        const t = performance.now() / 600;
        const pulse = 0.5 + 0.5 * Math.sin(t * TAU);
        const glowR = CONFIG.ITEM_RADIUS * (2.0 + pulse * 0.4);
        const grad = ctx.createRadialGradient(it.pos.x, it.pos.y, 0, it.pos.x, it.pos.y, glowR);
        grad.addColorStop(0, 'rgba(255,255,255,0.4)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(it.pos.x, it.pos.y, glowR, 0, TAU);
        ctx.fill();
        // Emoji with slight rotation
        ctx.save();
        ctx.translate(it.pos.x, it.pos.y);
        ctx.rotate(Math.sin(it.rotation) * 0.15);
        ctx.font = `${CONFIG.ITEM_RADIUS * 2}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ITEM_EMOJI[it.type], 0, 0);
        ctx.restore();
    }
}
