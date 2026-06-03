import { CONFIG } from '../config';
import type { Bullet } from '../game/bullet';
import type { Camera } from '../game/camera';

const TAU = Math.PI * 2;

function withAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function drawBullets(
  ctx: CanvasRenderingContext2D,
  bullets: readonly Bullet[],
  camera: Camera,
): void {
  const halfW = camera.cssWidth / camera.viewScale / 2;
  const halfH = camera.cssHeight / camera.viewScale / 2;
  const margin = 50;
  const minX = camera.pos.x - halfW - margin;
  const maxX = camera.pos.x + halfW + margin;
  const minY = camera.pos.y - halfH - margin;
  const maxY = camera.pos.y + halfH + margin;

  for (const b of bullets) {
    if (!b.alive) continue;
    if (b.pos.x < minX || b.pos.x > maxX) continue;
    if (b.pos.y < minY || b.pos.y > maxY) continue;

    // Glow
    const glow = ctx.createRadialGradient(
      b.pos.x,
      b.pos.y,
      0,
      b.pos.x,
      b.pos.y,
      CONFIG.BULLET_RADIUS * 2.5,
    );
    glow.addColorStop(0, withAlpha(b.color, 0.6));
    glow.addColorStop(1, withAlpha(b.color, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, CONFIG.BULLET_RADIUS * 2.5, 0, TAU);
    ctx.fill();

    // Core
    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(b.pos.x, b.pos.y, CONFIG.BULLET_RADIUS, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
