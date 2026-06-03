import { CONFIG } from '../config';
const TAU = Math.PI * 2;
/** Draw joystick in screen-space (caller must reset transform first). */
export function drawJoystick(ctx, joy) {
    const c = joy.getCenter();
    if (c.x === 0 && c.y === 0)
        return;
    // Outer ring
    ctx.beginPath();
    ctx.arc(c.x, c.y, CONFIG.JOYSTICK_OUTER_RADIUS, 0, TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.stroke();
    // Stick head position
    const sx = c.x + joy.stickX * CONFIG.JOYSTICK_OUTER_RADIUS;
    const sy = c.y + joy.stickY * CONFIG.JOYSTICK_OUTER_RADIUS;
    ctx.beginPath();
    ctx.arc(sx, sy, CONFIG.JOYSTICK_INNER_RADIUS, 0, TAU);
    ctx.fillStyle = joy.isActive ? 'rgba(74,222,128,0.85)' : 'rgba(255,255,255,0.55)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();
}
