import { CONFIG } from '../config';
import type { Snake } from '../game/snake';

const TAU = Math.PI * 2;

/**
 * 绘制蛇：身体段从尾到头，头部含眼睛、玩家蛇头顶皇冠。
 * 已应用相机变换 —— 坐标系是世界坐标。
 */
export function drawSnake(ctx: CanvasRenderingContext2D, snake: Snake): void {
  if (!snake.alive) return;
  // Invincibility blink: roughly 5 Hz
  if (snake.invincibleTimer > 0 && Math.floor(performance.now() / 100) % 2 === 0) {
    return;
  }
  const segments = snake.getSegments();
  if (segments.length === 0) return;

  // Shield aura (under body)
  if (snake.hasShield) {
    ctx.save();
    ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
    for (const s of segments) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, CONFIG.SEGMENT_RADIUS + 6, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Boost fire trail under body (when boosting)
  if (snake.isBoosting) {
    ctx.save();
    ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
    for (let i = Math.min(segments.length - 1, 12); i >= 6; i--) {
      const s = segments[i];
      ctx.beginPath();
      ctx.arc(s.x, s.y, CONFIG.SEGMENT_RADIUS + 4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  // Body: tail → head (so head renders on top)
  for (let i = segments.length - 1; i >= 1; i--) {
    const s = segments[i];
    ctx.beginPath();
    ctx.arc(s.x, s.y, CONFIG.SEGMENT_RADIUS, 0, TAU);
    ctx.fillStyle = snake.color;
    ctx.fill();
  }

  // Head
  const head = segments[0];
  ctx.beginPath();
  ctx.arc(head.x, head.y, CONFIG.HEAD_RADIUS, 0, TAU);
  ctx.fillStyle = snake.color;
  ctx.fill();

  // Eyes
  drawEyes(ctx, head.x, head.y, snake.angle);

  // Player crown emoji + name label above head
  if (snake.isPlayer) {
    ctx.save();
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('👑', head.x, head.y - CONFIG.HEAD_RADIUS - 6);
    ctx.restore();
  }

  // Name label
  ctx.save();
  ctx.font = `${snake.isPlayer ? 14 : 11}px "PingFang SC", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#1f2937';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  const labelY = head.y + CONFIG.HEAD_RADIUS + 6;
  ctx.strokeText(snake.name, head.x, labelY);
  ctx.fillText(snake.name, head.x, labelY);
  ctx.restore();
}

function drawEyes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
): void {
  const headR = CONFIG.HEAD_RADIUS;
  const eyeOffsetForward = headR * 0.35;
  const eyeOffsetSide = headR * 0.5;
  const eyeR = headR * 0.32;
  const pupilR = headR * 0.18;

  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const sideX = -sinA;
  const sideY = cosA;

  for (const sign of [-1, 1]) {
    const ex = cx + cosA * eyeOffsetForward + sideX * eyeOffsetSide * sign;
    const ey = cy + sinA * eyeOffsetForward + sideY * eyeOffsetSide * sign;
    // White
    ctx.beginPath();
    ctx.arc(ex, ey, eyeR, 0, TAU);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // Pupil (looks slightly forward)
    const px = ex + cosA * eyeR * 0.3;
    const py = ey + sinA * eyeR * 0.3;
    ctx.beginPath();
    ctx.arc(px, py, pupilR, 0, TAU);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
  }
}
