// render/entityRenderer.js — 渲染契约：drawTower/drawEnemy/drawProjectile/drawFx。
// [P2] 六敌变体 + 状态染色 + 塔等级/目标模式/招牌技充能条。仍色块占位（sprite 留 Phase 6）。只读对象，不改 state。
import { BAL } from '../data/balance.js';
import { GENERALS } from '../data/generals.js';

const C = BAL.CELL;

const ENEMY_R = { footman: 0.26, wolf: 0.22, tengjia: 0.32, flyer: 0.24, shaman: 0.26, boss: 0.44 };
const MODE_GLYPH = { first: '前', last: '后', strongest: '强', weakest: '弱' };

export function drawTower(ctx, t) {
  const g = GENERALS[t.generalId];
  const s = C * 0.32;
  ctx.fillStyle = g.color;
  ctx.fillRect(t.px - s, t.py - s, s * 2, s * 2);
  ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5;
  ctx.strokeRect(t.px - s, t.py - s, s * 2, s * 2);
  ctx.fillStyle = '#3a2a08'; ctx.font = `bold ${C * 0.34}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(g.name[0], t.px, t.py - C * 0.02);

  // 等级 pips（L1-3 金点）
  for (let i = 0; i < t.level; i++) {
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath(); ctx.arc(t.px - s + 4 + i * 6, t.py + s - 4, 2.2, 0, Math.PI * 2); ctx.fill();
  }
  // 目标模式角标（右上）
  ctx.fillStyle = 'rgba(20,24,34,.82)'; ctx.fillRect(t.px + s - 11, t.py - s - 2, 13, 12);
  ctx.fillStyle = '#cfe0ff'; ctx.font = `bold ${C * 0.22}px system-ui`;
  ctx.fillText(MODE_GLYPH[t.mode] || '前', t.px + s - 4, t.py - s + 4);

  // L3 冷却技充能条（仅冷却技）
  if (t.level >= BAL.MAX_TOWER_LEVEL && g.signature?.type === 'cooldown') {
    const cd = g.signature.cooldown || 1;
    const ratio = Math.max(0, Math.min(1, 1 - t.signatureCd / cd));
    ctx.fillStyle = '#23304a'; ctx.fillRect(t.px - s, t.py + s + 2, s * 2, 3);
    ctx.fillStyle = ratio >= 1 ? '#ffd24d' : '#5b8de0';
    ctx.fillRect(t.px - s, t.py + s + 2, s * 2 * ratio, 3);
  }
}

export function drawEnemy(ctx, e, now = 0) {
  const lift = e.flying ? -C * 0.34 : 0;
  const cy = e.py + lift;
  const R = (ENEMY_R[e.type] || 0.26) * C;

  // 投影
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(e.px, e.py + R * 0.55, R * 0.7, R * 0.28, 0, 0, Math.PI * 2); ctx.fill();

  // 治疗光环（方士）
  if (e.heal) {
    ctx.strokeStyle = 'rgba(232,67,147,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(e.px, cy, e.heal.range * C, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }

  // 本体
  ctx.fillStyle = e.color;
  ctx.beginPath(); ctx.arc(e.px, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = e.isBoss ? 2.5 : 1.5; ctx.stroke();

  // 类型特征
  if (e.type === 'tengjia') {            // 藤甲：交叉护甲纹
    ctx.strokeStyle = 'rgba(40,60,20,.7)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(e.px - R * 0.7, cy); ctx.lineTo(e.px + R * 0.7, cy);
    ctx.moveTo(e.px, cy - R * 0.7); ctx.lineTo(e.px, cy + R * 0.7); ctx.stroke();
  }
  if (e.flying) {                        // 飞兵：双翼
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.ellipse(e.px - R, cy, R * 0.7, R * 0.32, -0.5, 0, Math.PI * 2);
    ctx.ellipse(e.px + R, cy, R * 0.7, R * 0.32, 0.5, 0, Math.PI * 2); ctx.fill();
  }
  if (e.heal) {                          // 方士：白十字
    ctx.fillStyle = '#fff';
    ctx.fillRect(e.px - 1.5, cy - R * 0.5, 3, R); ctx.fillRect(e.px - R * 0.5, cy - 1.5, R, 3);
  }
  if (e.isBoss) {                        // BOSS：金冠点
    ctx.fillStyle = '#ffd24d';
    ctx.beginPath(); ctx.arc(e.px, cy - R * 0.55, R * 0.18, 0, Math.PI * 2); ctx.fill();
  }

  // 状态染色
  const st = e.statuses || {};
  if (st.slow && st.slow.until > now) {
    ctx.strokeStyle = 'rgba(91,141,224,.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(e.px, cy, R + 2, 0, Math.PI * 2); ctx.stroke();
  }
  if (st.burn && st.burn.some((b) => b.until > now)) {
    ctx.fillStyle = 'rgba(255,122,47,.9)';
    ctx.beginPath(); ctx.arc(e.px + R * 0.6, cy - R * 0.6, 2.5, 0, Math.PI * 2);
    ctx.arc(e.px - R * 0.5, cy - R * 0.7, 2, 0, Math.PI * 2); ctx.fill();
  }
  if (st.stun && st.stun.until > now) {
    ctx.fillStyle = '#ffe08a'; ctx.font = `bold ${C * 0.3}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✦', e.px, cy - R - 5);
  }

  // 血条
  const w = Math.max(C * 0.5, R * 1.8), hp = Math.max(0, e.hp) / e.maxHp;
  ctx.fillStyle = '#3a1414'; ctx.fillRect(e.px - w / 2, cy - R - 7, w, 4);
  ctx.fillStyle = e.isBoss ? '#ff5577' : '#3ad06f'; ctx.fillRect(e.px - w / 2, cy - R - 7, w * hp, 4);
}

export function drawProjectile(ctx, p) {
  ctx.strokeStyle = p.color; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(p.fromX, p.fromY); ctx.lineTo(p.toX, p.toY); ctx.stroke();
}

export function drawFx(ctx, f) {
  if (f.kind === 'ring') {               // AoE/溅射光圈：随老化扩散+淡出
    const k = 1 - f.ttl / (f.maxTtl || 0.4);
    ctx.globalAlpha = Math.max(0, f.ttl / (f.maxTtl || 0.4)) * 0.8;
    ctx.strokeStyle = f.color || '#fff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(f.x, f.y, (f.r || C) * (0.5 + 0.5 * k), 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
    return;
  }
  // float（飘字）
  ctx.globalAlpha = Math.max(0, f.ttl / 0.8);
  ctx.fillStyle = f.color || '#ffe08a';
  ctx.font = `bold ${C * 0.4}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(f.text, f.x, f.y - (0.8 - f.ttl) * 28);
  ctx.globalAlpha = 1;
}
