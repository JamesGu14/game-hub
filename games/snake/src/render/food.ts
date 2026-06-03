import { CONFIG } from '../config';
import type { Food, ExpOrb } from '../game/food';
import type { Camera } from '../game/camera';

const TAU = Math.PI * 2;

interface ViewportBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function viewportBounds(camera: Camera, margin: number): ViewportBounds {
  const halfW = camera.cssWidth / camera.viewScale / 2;
  const halfH = camera.cssHeight / camera.viewScale / 2;
  return {
    minX: camera.pos.x - halfW - margin,
    maxX: camera.pos.x + halfW + margin,
    minY: camera.pos.y - halfH - margin,
    maxY: camera.pos.y + halfH + margin,
  };
}

export function drawFoods(
  ctx: CanvasRenderingContext2D,
  foods: readonly Food[],
  camera: Camera,
): void {
  const b = viewportBounds(camera, 30);
  ctx.font = `${CONFIG.FOOD_EMOJI_SIZE}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const f of foods) {
    if (f.pos.x < b.minX || f.pos.x > b.maxX) continue;
    if (f.pos.y < b.minY || f.pos.y > b.maxY) continue;
    ctx.fillText(f.emoji, f.pos.x, f.pos.y);
  }
}

export function drawExpOrbs(
  ctx: CanvasRenderingContext2D,
  orbs: readonly ExpOrb[],
  camera: Camera,
): void {
  const b = viewportBounds(camera, CONFIG.EXP_ORB_RADIUS + 20);
  for (const orb of orbs) {
    if (orb.pos.x < b.minX || orb.pos.x > b.maxX) continue;
    if (orb.pos.y < b.minY || orb.pos.y > b.maxY) continue;
    const fade = orb.ttl < 3 ? orb.ttl / 3 : 1;

    // Glow
    const gradR = CONFIG.EXP_ORB_RADIUS * 2.2;
    const grad = ctx.createRadialGradient(
      orb.pos.x,
      orb.pos.y,
      0,
      orb.pos.x,
      orb.pos.y,
      gradR,
    );
    grad.addColorStop(0, withAlpha(orb.color, 0.55 * fade));
    grad.addColorStop(1, withAlpha(orb.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(orb.pos.x, orb.pos.y, gradR, 0, TAU);
    ctx.fill();

    // Core
    ctx.fillStyle = withAlpha(orb.color, fade);
    ctx.beginPath();
    ctx.arc(orb.pos.x, orb.pos.y, CONFIG.EXP_ORB_RADIUS, 0, TAU);
    ctx.fill();
  }
}

function withAlpha(hex: string, a: number): string {
  // Accept #rrggbb format only (we control inputs).
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}
