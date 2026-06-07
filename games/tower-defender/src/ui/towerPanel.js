// ui/towerPanel.js — [P5] 点将面板（屏幕坐标）：竹简底 + 升级/拆除/切目标。
// layout/hit 为单一来源（draw 共用）。点面板内（非按钮）也消费点击，防穿透建塔。
import { BAL } from '../data/balance.js';
import { GENERALS } from '../data/generals.js';
import { assets } from '../core/assets.js';
import { upgradeCost, sellRefund } from '../systems/economySystem.js';
import { panel, button, roundRect, FONT, PAL } from './theme.js';

const PW = 168, PH = 82, BTN_H = 28, GAP = 7;
const TOP_GUARD = 56;        // 上界避开木匾 HUD（HUD_H 50 + 余量）
const MODES = ['first', 'last', 'strongest', 'weakest'];
const MODE_GLYPH = { first: '最前', last: '最后', strongest: '最强', weakest: '最弱' };

export function cycleTowerMode(tower) {
  tower.mode = MODES[(MODES.indexOf(tower.mode) + 1) % MODES.length];
}

export function towerPanelLayout(view, tower) {
  const sx = view.ox + tower.px * view.scale;
  const sy = view.oy + tower.py * view.scale;
  let x = sx - PW / 2, y = sy - PH - 24;        // 浮在塔上方
  x = Math.max(8, Math.min(view.w - PW - 8, x));
  y = Math.max(TOP_GUARD, Math.min(view.h - PH - 8, y));
  const bw = (PW - GAP * 4) / 3;
  const by = y + PH - BTN_H - 8;
  const buttons = ['upgrade', 'sell', 'mode'].map((id, i) => ({ id, x: x + GAP + (bw + GAP) * i, y: by, w: bw, h: BTN_H }));
  return { x, y, w: PW, h: PH, buttons };
}

// 返回 'upgrade'|'sell'|'mode'|'panel'(面板内空白，消费)|null(面板外)。
export function hitTowerPanel(view, tower, sx, sy) {
  const L = towerPanelLayout(view, tower);
  for (const b of L.buttons) if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h) return b.id;
  if (sx >= L.x && sx <= L.x + L.w && sy >= L.y && sy <= L.y + L.h) return 'panel';
  return null;
}

export function drawTowerPanel(ctx, view, state, tower) {
  const g = GENERALS[tower.generalId];
  const L = towerPanelLayout(view, tower);
  panel(ctx, L.x, L.y, L.w, L.h, { variant: 'parch', r: 10 });

  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  // 将名 + 等级（深字楷体）。[P6] 有立绘 → 头像缩略（缺则将色点）
  const portrait = assets.images['gen_' + tower.generalId];
  if (portrait) {
    const ps = 28, pxL = L.x + 10, pyT = L.y + 4;
    roundRect(ctx, pxL, pyT, ps, ps, 6); ctx.fillStyle = g.color; ctx.fill();
    ctx.save(); roundRect(ctx, pxL, pyT, ps, ps, 6); ctx.clip();
    const ih = ps * (portrait.height / portrait.width || 1.35);
    ctx.drawImage(portrait, pxL, pyT - ih * 0.04, ps, ih);
    ctx.restore();
    roundRect(ctx, pxL, pyT, ps, ps, 6); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.stroke();
    ctx.fillStyle = PAL.ink; ctx.font = FONT.head(16); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${g.name}  L${tower.level}`, pxL + ps + 8, L.y + 17);
  } else {
    ctx.fillStyle = g.color; ctx.beginPath(); ctx.arc(L.x + 16, L.y + 17, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = PAL.ink; ctx.font = FONT.head(16);
    ctx.fillText(`${g.name}  L${tower.level}`, L.x + 28, L.y + 17);
  }

  // 招牌技行
  if (tower.level >= BAL.MAX_TOWER_LEVEL && g.signature) {
    ctx.fillStyle = '#9a3a12'; ctx.font = FONT.body(11, 700);
    ctx.fillText('★ ' + g.signature.name, L.x + 12, L.y + 37);
  } else {
    ctx.fillStyle = 'rgba(60,46,26,.62)'; ctx.font = FONT.body(11, 600);
    ctx.fillText('升满 L3 解锁招牌技', L.x + 12, L.y + 37);
  }

  for (const b of L.buttons) {
    let label, sub = '', variant = 'gold', disabled = false;
    if (b.id === 'upgrade') {
      if (tower.level >= BAL.MAX_TOWER_LEVEL) { label = '满级'; disabled = true; }
      else { const c = upgradeCost(tower); label = '升级'; sub = '💰' + c; disabled = state.gold < c; }
    } else if (b.id === 'sell') { label = '拆除'; sub = '+' + sellRefund(tower); variant = 'danger'; }
    else { label = '目标'; sub = MODE_GLYPH[tower.mode]; variant = 'jade'; }
    button(ctx, b, { label, sub, variant, disabled });
  }
}
