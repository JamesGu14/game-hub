import { CONFIG } from '../config';
import type { HoldButton, CooldownButton } from '../input/skillBtn';

const TAU = Math.PI * 2;

export function drawHoldButton(
  ctx: CanvasRenderingContext2D,
  btn: HoldButton,
  emoji: string,
  label: string,
): void {
  const c = btn.getCenter();
  if (c.x === 0 && c.y === 0) return;

  // Base disc
  ctx.beginPath();
  ctx.arc(c.x, c.y, CONFIG.SKILL_BTN_RADIUS, 0, TAU);
  if (btn.locked) {
    ctx.fillStyle = 'rgba(120,80,80,0.35)';
  } else if (btn.pressed) {
    ctx.fillStyle = 'rgba(251,191,36,0.85)';
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
  }
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = btn.locked
    ? 'rgba(239,68,68,0.75)'
    : 'rgba(255,255,255,0.6)';
  ctx.stroke();

  // Emoji
  ctx.font = '34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, c.x, c.y - 6);

  // Label + pinyin
  ctx.font = '12px "PingFang SC", sans-serif';
  ctx.fillStyle = btn.locked ? 'rgba(255,255,255,0.6)' : '#fff';
  ctx.fillText(label, c.x, c.y + CONFIG.SKILL_BTN_RADIUS + 14);
}

export function drawCooldownButton(
  ctx: CanvasRenderingContext2D,
  btn: CooldownButton,
  emoji: string,
  label: string,
): void {
  const c = btn.getCenter();
  if (c.x === 0 && c.y === 0) return;
  const r = CONFIG.SKILL_BTN_RADIUS;
  const ready = btn.cooldownLeft <= 0;

  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, TAU);
  ctx.fillStyle = ready ? 'rgba(96,165,250,0.55)' : 'rgba(255,255,255,0.18)';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.stroke();

  // Cooldown arc (sweeping from top, growing as it cools)
  if (!ready) {
    const progress = btn.getCooldownProgress();
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.arc(c.x, c.y, r - 4, -Math.PI / 2, -Math.PI / 2 + TAU * progress);
    ctx.closePath();
    ctx.fillStyle = 'rgba(96,165,250,0.7)';
    ctx.fill();
  }

  ctx.font = '34px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, c.x, c.y - 6);

  ctx.font = '12px "PingFang SC", sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(label, c.x, c.y + r + 14);
}
