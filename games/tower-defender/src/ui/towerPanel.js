// ui/towerPanel.js — [P2] 最小点将面板（屏幕坐标）：升级 / 拆除 / 切目标模式。
// 精美版留 Phase 5；本版只求功能可用、鼠标可玩。点面板内（非按钮）也消费点击，防穿透建塔。
import { BAL } from '../data/balance.js';
import { GENERALS } from '../data/generals.js';
import { upgradeCost, sellRefund } from '../systems/economySystem.js';

const PW = 156, PH = 70, BTN_H = 26, GAP = 6;
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
  y = Math.max(40, Math.min(view.h - PH - 8, y));
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
  ctx.fillStyle = 'rgba(16,20,30,.96)'; ctx.fillRect(L.x, L.y, L.w, L.h);
  ctx.strokeStyle = g.color; ctx.lineWidth = 2; ctx.strokeRect(L.x, L.y, L.w, L.h);

  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff'; ctx.font = '700 13px system-ui';
  ctx.fillText(`${g.name} L${tower.level}`, L.x + 10, L.y + 14);
  if (tower.level >= BAL.MAX_TOWER_LEVEL && g.signature) {
    ctx.fillStyle = '#ffd24d'; ctx.font = '11px system-ui';
    ctx.fillText('★ ' + g.signature.name, L.x + 10, L.y + 31);
  } else {
    ctx.fillStyle = '#7f93a8'; ctx.font = '11px system-ui';
    ctx.fillText('升满 L3 解锁招牌技', L.x + 10, L.y + 31);
  }

  for (const b of L.buttons) {
    let label, sub = '', enabled = true, bg = '#2a3447';
    if (b.id === 'upgrade') {
      if (tower.level >= BAL.MAX_TOWER_LEVEL) { label = '满级'; enabled = false; }
      else { const c = upgradeCost(tower); label = '升级'; sub = '💰' + c; enabled = state.gold >= c; }
    } else if (b.id === 'sell') { label = '拆除'; sub = '+' + sellRefund(tower); bg = '#3a2230'; }
    else { label = '目标'; sub = MODE_GLYPH[tower.mode]; bg = '#22303a'; }

    ctx.globalAlpha = enabled ? 1 : 0.45;
    ctx.fillStyle = bg; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.strokeStyle = '#4a5a78'; ctx.lineWidth = 1; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = '600 11px system-ui';
    ctx.fillText(label, b.x + b.w / 2, b.y + 9);
    ctx.fillStyle = b.id === 'upgrade' ? (enabled ? '#ffe08a' : '#ff9a9a') : '#cfe0ff';
    ctx.font = '10px system-ui';
    if (sub) ctx.fillText(sub, b.x + b.w / 2, b.y + b.h - 8);
    ctx.globalAlpha = 1;
  }
}
