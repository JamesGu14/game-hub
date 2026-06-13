// render/entityRenderer.js — 渲染契约：drawTower/drawEnemy/drawProjectile/drawFx。
// [P6] sprite 双路径：有图 billboard 贴图（脚底锚 py + 投影）/ 无图回退现色块；信息层始终画。
// 增强补间：待机浮动 + 出手前冲弹/提亮 + 受击闪白（纯表现，读时间戳 t.lastFireAt/aimX·aimY、e.lastHitAt）。
// 只读对象，不改 state。core 资源层 assets.images[id] 取图；缺则回退（东吴/曹魏暂无图 → 色块照常可玩）。
import { BAL } from '../data/balance.js';
import { GENERALS } from '../data/generals.js';
import { assets, generalSprite } from '../core/assets.js';

const C = BAL.CELL;

const ENEMY_R = { footman: 0.26, wolf: 0.22, tengjia: 0.32, flyer: 0.24, shaman: 0.26, heavy: 0.3, cavalry: 0.28, boss: 0.44 };
const MODE_GLYPH = { first: '前', last: '后', strongest: '强', weakest: '弱' };

// —— 补间常量（集中调参）——
const IDLE_K = 3.2;          // 待机浮动角速度（rad/s）
const IDLE_AMP = C * 0.05;   // 待机浮动幅度（px）
const FIRE_DUR = 0.18;       // 出手补间时长（s）
const HIT_DUR = 0.12;        // 受击闪白时长（s）
const UP_DUR = 0.5;          // [升级特效] 金光弹跳时长（s,读 t.upgradedAt;L3 时顺带掩护立绘换阶）

// 0→1 衰减脉冲（now-since<dur 时 1→0，否则 0）。无时间戳字段 → 0（渐进增强：跳过补间）。
function pulse(since, now, dur) {
  if (since == null) return 0;
  const k = (now - since) / dur;
  return k >= 0 && k < 1 ? 1 - k : 0;
}
export function aspect(img) {
  const a = img && img.width ? img.height / img.width : 1.35;
  return a > 0 && Number.isFinite(a) ? a : 1.35;
}
function shadow(ctx, x, y, rx, ry) {
  ctx.fillStyle = 'rgba(0,0,0,.22)';
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
}

export function drawTower(ctx, t, now = 0) {
  const g = GENERALS[t.generalId];
  const img = generalSprite(t.generalId, t.level);
  const s = C * 0.32;

  // —— 补间量 ——
  const phase = t.slot ? t.slot.x * 7 + t.slot.y * 13 : (t.id || 0);   // 每塔独立相位（不齐步浮动）
  const bob = Math.sin(now * IDLE_K + phase) * IDLE_AMP;
  const fire = pulse(t.lastFireAt, now, FIRE_DUR);                     // 出手脉冲 1→0
  const up = pulse(t.upgradedAt, now, UP_DUR);                         // 升级脉冲 1→0
  const upArc = up > 0 ? Math.sin((1 - up) * Math.PI) : 0;             // 0→峰→0 弹跳弧
  const pop = (1 + fire * 0.12) * (1 + upArc * 0.16);                  // 出手缩放弹 × 升级弹跳
  let lx = 0, ly = 0, tilt = 0;
  if (fire > 0) {
    const ax = t.aimX ?? t.px, ay = t.aimY ?? (t.py - C);
    const dx = ax - t.px, dy = ay - t.py, d = Math.hypot(dx, dy) || 1;
    const lunge = Math.sin(fire * Math.PI) * C * 0.16;                 // 冲出再回（0→峰→0）
    lx = (dx / d) * lunge; ly = (dy / d) * lunge;
    tilt = (dx >= 0 ? 1 : -1) * fire * 0.2;                            // 朝向侧轻摆（武器挥动感）
  }
  const stunned = now < (t.stunnedUntil || 0);

  if (img) {
    // [P6.1] 按**高度**归一：各将同高=同视觉大小（修诸葛偏大），略缩小减少邻格重叠。
    const h = C * 1.42, w = h / aspect(img), footPad = C * 0.1;
    shadow(ctx, t.px, t.py + footPad, w * 0.34, w * 0.13);
    ctx.save();
    ctx.translate(t.px + lx, t.py + bob + ly);
    if (tilt) ctx.rotate(tilt);
    ctx.scale(pop, pop);
    ctx.drawImage(img, -w / 2, -h + footPad, w, h);
    if (fire > 0) {                                                    // 出手提亮（蓄力/挥砍闪光）
      ctx.globalAlpha = fire * 0.25; ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(img, -w / 2, -h + footPad, w, h);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (up > 0) {                                                      // [升级特效] 金光罩体+立绘提亮(0.5s 渐隐)
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = up * 0.45;
      ctx.drawImage(img, -w / 2, -h + footPad, w, h);
      const gr = ctx.createRadialGradient(0, -h * 0.45, 2, 0, -h * 0.45, h * 0.62);
      gr.addColorStop(0, 'rgba(255,214,90,.85)'); gr.addColorStop(1, 'rgba(255,214,90,0)');
      ctx.fillStyle = gr; ctx.fillRect(-w, -h * 1.15, w * 2, h * 1.4);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (stunned) {                                                     // 震慑灰罩盖立绘
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#12121a';
      ctx.fillRect(-w / 2, -h + footPad, w, h); ctx.globalAlpha = 1;
    }
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(t.px, t.py + bob);
    ctx.scale(pop, pop);
    ctx.fillStyle = g.color;
    ctx.fillRect(-s, -s, s * 2, s * 2);
    ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.strokeRect(-s, -s, s * 2, s * 2);
    ctx.fillStyle = '#3a2a08'; ctx.font = `bold ${C * 0.34}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(g.name[0], 0, -C * 0.02);
    if (up > 0) {                                                      // [升级特效] 回退色块:金框闪光
      ctx.globalAlpha = up * 0.7; ctx.strokeStyle = '#ffd24d'; ctx.lineWidth = 3;
      ctx.strokeRect(-s - 3, -s - 3, (s + 3) * 2, (s + 3) * 2); ctx.globalAlpha = 1;
    }
    ctx.restore();
    if (stunned) { ctx.fillStyle = 'rgba(18,18,26,.55)'; ctx.fillRect(t.px - s, t.py - s, s * 2, s * 2); }
  }

  // —— 信息层（始终画；屏幕直绘，不随 bob/pop，稳定可读）——
  // 等级（头顶 Lv.N 描边金字；脚下金点旧法在武将贴近时被邻格脚部遮挡，改头顶）
  {
    const lvY = img ? t.py - C * 1.45 : t.py - s - 8;   // 有立绘=头顶上方;色块回退=方块顶上
    ctx.font = `bold ${C * 0.3}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(20,12,4,.85)';
    ctx.strokeText('Lv.' + t.level, t.px, lvY);
    ctx.fillStyle = '#ffe08a'; ctx.fillText('Lv.' + t.level, t.px, lvY);
  }
  // 目标模式角标（右上）
  ctx.fillStyle = 'rgba(20,24,34,.82)'; ctx.fillRect(t.px + s - 11, t.py - s - 2, 13, 12);
  ctx.fillStyle = '#cfe0ff'; ctx.font = `bold ${C * 0.22}px system-ui`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(MODE_GLYPH[t.mode] || '前', t.px + s - 4, t.py - s + 4);

  // L3 冷却技充能条（仅冷却技）
  if (t.level >= BAL.SIGNATURE_LEVEL && g.signature?.type === 'cooldown') {
    const cd = g.signature.cooldown || 1;
    const ratio = Math.max(0, Math.min(1, 1 - t.signatureCd / cd));
    ctx.fillStyle = '#23304a'; ctx.fillRect(t.px - s, t.py + s + 2, s * 2, 3);
    ctx.fillStyle = ratio >= 1 ? '#ffd24d' : '#5b8de0';
    ctx.fillRect(t.px - s, t.py + s + 2, s * 2 * ratio, 3);
  }

  // [P3] 被司马懿震慑：✋（停火 2s）。灰罩已在本体分支按形态画。
  if (stunned) {
    ctx.fillStyle = '#fff'; ctx.font = `${C * 0.4}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('✋', t.px, t.py - (img ? C * 0.5 : 0));
  }
}

// [需求①] 敌兵选图:faction 专属图(enemy_<faction>_<type>)优先 → 原型通用图(enemy_<type>)→ null(调用方画色块)。
export function enemySprite(e) {
  return (e.faction && assets.images['enemy_' + e.faction + '_' + e.type]) || assets.images['enemy_' + e.type] || null;
}

export function drawEnemy(ctx, e, now = 0) {
  const lift = e.flying ? -C * 0.34 : 0;
  const bob = Math.sin(now * IDLE_K + (e.id || 0) * 1.7) * (IDLE_AMP * 0.6);
  const cy = e.py + lift + bob;                                  // 本体中心（含抬升+浮动）
  const R = (ENEMY_R[e.type] || 0.26) * C;
  const img = e.isBoss ? assets.images['boss_' + e.bossId] : enemySprite(e);
  const flash = pulse(e.lastHitAt, now, HIT_DUR);               // 受击闪白脉冲
  const crit = pulse(e.critFlashAt, now, 0.25);                 // [改进④] 暴击闪红脉冲(比受击白更久更醒目)

  // 投影（地面 e.py，不随抬升/浮动）
  shadow(ctx, e.px, e.py + R * 0.55, R * 0.7, R * 0.28);

  // 治疗光环（方士）
  if (e.heal) {
    ctx.strokeStyle = 'rgba(232,67,147,.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(e.px, cy, e.heal.range * C, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }

  if (img) {
    // —— sprite 本体（脚底≈cy+R 接地）——
    const w = R * 2.8, h = w * aspect(img), footPad = R * 0.12;
    ctx.save();
    ctx.translate(e.px, cy);
    ctx.drawImage(img, -w / 2, R + footPad - h, w, h);
    if (flash > 0) {                                            // 受击提亮（白罩感）
      ctx.globalAlpha = flash * 0.6; ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(img, -w / 2, R + footPad - h, w, h);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    if (crit > 0) {                                            // [改进④] 暴击闪红(覆盖立绘区,lighter 染亮红)
      ctx.globalAlpha = crit * 0.6; ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ff3020'; ctx.fillRect(-w / 2, R + footPad - h, w, h);
      ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    }
    ctx.restore();
  } else {
    // —— 现色块本体 + 类型特征 ——
    ctx.fillStyle = e.color;
    ctx.beginPath(); ctx.arc(e.px, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = e.isBoss ? 2.5 : 1.5; ctx.stroke();

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
    if (flash > 0) {                       // 受击白罩
      ctx.globalAlpha = flash * 0.7; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.px, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    if (crit > 0) {                        // [改进④] 暴击闪红
      ctx.globalAlpha = crit * 0.75; ctx.fillStyle = '#ff3020';
      ctx.beginPath(); ctx.arc(e.px, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
  }

  // —— 状态染色（始终画，锚 cy）——
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

  // [P3] BOSS 显名(名将)
  if (e.isBoss) {
    ctx.fillStyle = '#ffe08a'; ctx.font = `bold ${C * 0.3}px system-ui`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.name, e.px, cy + R + 9);
  }
}

export function drawProjectile(ctx, p) {
  const dx = p.toX - p.fromX, dy = p.toY - p.fromY;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  ctx.save();
  ctx.lineCap = 'round';
  if (p.kind === 'single') {                         // 箭矢：细杆 + 箭头三角
    ctx.strokeStyle = p.color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.toX - ux * 14, p.toY - uy * 14); ctx.lineTo(p.toX, p.toY); ctx.stroke();
    const a = 4;
    ctx.fillStyle = p.color; ctx.beginPath();
    ctx.moveTo(p.toX, p.toY);
    ctx.lineTo(p.toX - ux * 7 - uy * a, p.toY - uy * 7 + ux * a);
    ctx.lineTo(p.toX - ux * 7 + uy * a, p.toY - uy * 7 - ux * a);
    ctx.closePath(); ctx.fill();
  } else if (p.kind === 'burn') {                     // 火弹：橙红弹头 + 渐隐拖尾
    const g = ctx.createLinearGradient(p.fromX, p.fromY, p.toX, p.toY);
    g.addColorStop(0, 'rgba(255,120,40,0)'); g.addColorStop(1, p.color);
    ctx.strokeStyle = g; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.fromX, p.fromY); ctx.lineTo(p.toX, p.toY); ctx.stroke();
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.toX, p.toY, 3.5, 0, Math.PI * 2); ctx.fill();
  } else if (p.kind === 'slow') {                     // 水弹：蓝弹头 + 波纹
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.toX, p.toY, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(p.toX, p.toY, 6, 0, Math.PI * 2); ctx.stroke();
  } else {                                            // splash/charge：保留粗线(刀光/突进残影)
    ctx.strokeStyle = p.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.fromX, p.fromY); ctx.lineTo(p.toX, p.toY); ctx.stroke();
  }
  ctx.restore();
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
