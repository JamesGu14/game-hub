// render/entityRenderer.js — [P1-7] 渲染契约：drawTower/drawEnemy/drawProjectile/drawFx。
// M1 占位实现（色块 + 文字）；M6 换 sprite 时只改本文件。只读对象，不改 state。
import { BAL } from '../data/balance.js';
import { GENERALS } from '../data/generals.js';

const C = BAL.CELL;

export function drawTower(ctx, t) {
  const g = GENERALS[t.generalId];
  ctx.fillStyle = g.color;
  ctx.fillRect(t.px - C * 0.32, t.py - C * 0.32, C * 0.64, C * 0.64);
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(t.px - C * 0.32, t.py - C * 0.32, C * 0.64, C * 0.64);
  ctx.fillStyle = '#3a2a08'; ctx.font = `bold ${C * 0.34}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(g.name[0], t.px, t.py);
}

export function drawEnemy(ctx, e) {
  ctx.fillStyle = e.color;
  ctx.beginPath(); ctx.arc(e.px, e.py, C * 0.26, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.5; ctx.stroke();
  // 血条
  const w = C * 0.5, hp = Math.max(0, e.hp) / e.maxHp;
  ctx.fillStyle = '#3a1414'; ctx.fillRect(e.px - w / 2, e.py - C * 0.42, w, 4);
  ctx.fillStyle = '#3ad06f'; ctx.fillRect(e.px - w / 2, e.py - C * 0.42, w * hp, 4);
}

export function drawProjectile(ctx, p) {
  ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.fromX, p.fromY); ctx.lineTo(p.toX, p.toY); ctx.stroke();
}

export function drawFx(ctx, f) {
  ctx.globalAlpha = Math.max(0, f.ttl / 0.8);
  ctx.fillStyle = f.color || '#ffe08a';
  ctx.font = `bold ${C * 0.4}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(f.text, f.x, f.y - (0.8 - f.ttl) * 28);
  ctx.globalAlpha = 1;
}
