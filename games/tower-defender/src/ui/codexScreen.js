// src/ui/codexScreen.js — 成就中心(屏幕坐标 layout/hit/draw 单一来源)。copy-pattern 自 ui/levelSelect.js。
// 两标签:武将图鉴(三分区 44 卡) / 挑战成就(15 行)。点卡 → 大卡详情浮层。
import { GENERALS } from '../data/generals.js';
import { BOSSES, LIEUTENANTS } from '../data/bosses.js';
import { unlockedGenerals } from '../data/unlocks.js';
import { TIERS, tierIndex } from '../core/achievements.js';
import { ACHIEVEMENTS } from '../data/achievements.js';
import { HERO_LORE } from './heroCard.js';                 // 见 Step 3a：heroCard 需导出 HERO_LORE
import { generalSprite, assets } from '../core/assets.js';
import { backdrop, panel, button, title, roundRect, FONT, PAL } from './theme.js';

const SECTIONS = [
  { side: 'shu',   label: '我方武将', ids: () => Object.keys(GENERALS) },
  { side: 'boss',  label: '敌方 · 名将', ids: () => Object.keys(BOSSES) },
  { side: 'lieut', label: '敌方 · 副将', ids: () => Object.keys(LIEUTENANTS) },
];
const COLS = 10, CW = 74, CH = 96, GAP = 10, TOP = 132;

export function codexLayout(view, tab) {
  const tabW = 150, tabH = 40, ty = 64;
  const tabs = {
    codex: { x: view.w / 2 - tabW - 6, y: ty, w: tabW, h: tabH },
    ach:   { x: view.w / 2 + 6,        y: ty, w: tabW, h: tabH },
  };
  const back = { x: 20, y: 18, w: 96, h: 38 };
  const cards = [], sections = [];
  const rows = [];
  if (tab === 'codex') {
    let y = TOP;
    for (const sec of SECTIONS) {
      const ids = sec.ids();
      const gridW = COLS * CW + (COLS - 1) * GAP;
      const x0 = (view.w - gridW) / 2;
      sections.push({ label: sec.label, side: sec.side, y: y - 24 });
      ids.forEach((id, k) => {
        const r = Math.floor(k / COLS), c = k % COLS;
        cards.push({ id, side: sec.side, x: x0 + c * (CW + GAP), y: y + r * (CH + GAP), w: CW, h: CH });
      });
      const rowsN = Math.ceil(ids.length / COLS);
      y += rowsN * (CH + GAP) + 34;
    }
  } else {
    const lw = Math.min(560, view.w - 80), x0 = (view.w - lw) / 2;
    let y = TOP;
    for (const a of ACHIEVEMENTS) { rows.push({ id: a.id, x: x0, y, w: lw, h: 44 }); y += 50; }
  }
  return { tabs, back, cards, sections, rows };
}

export function hitCodex(view, tab, sx, sy, detailId) {
  if (detailId) return { kind: 'closeDetail' };                 // 详情态：任意点击关闭
  const L = codexLayout(view, tab);
  const inb = (b) => b && sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h;
  if (inb(L.back)) return { kind: 'back' };
  if (inb(L.tabs.codex)) return { kind: 'tab', tab: 'codex' };
  if (inb(L.tabs.ach)) return { kind: 'tab', tab: 'ach' };
  for (const c of L.cards) if (inb(c)) return { kind: 'card', id: c.id };
  return null;
}

// —— 渲染（render-only）——
function enemyName(id) { return (BOSSES[id] || LIEUTENANTS[id])?.name || id; }
function cardImg(id, side) { return side === 'shu' ? generalSprite(id, 3) : (assets.images['boss_' + id] || null); }

export function drawCodex(ctx, view, save, ach, tab, detailId) {
  ctx.setTransform(view.dpr || 1, 0, 0, view.dpr || 1, 0, 0);
  backdrop(ctx, view.w, view.h);
  title(ctx, '成就中心', view.w / 2, 38, 30);
  const L = codexLayout(view, tab);
  button(ctx, L.back, { label: '◀ 返回', variant: 'wood' });
  button(ctx, L.tabs.codex, { label: '武将图鉴', variant: tab === 'codex' ? 'jade' : 'wood', active: tab === 'codex' });
  button(ctx, L.tabs.ach,   { label: '挑战成就', variant: tab === 'ach' ? 'jade' : 'wood', active: tab === 'ach' });

  if (tab === 'codex') {
    const unlocked = unlockedGenerals(save);
    for (const s of L.sections) {
      ctx.fillStyle = PAL.gold; ctx.font = FONT.head(16); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(s.label, (view.w - (COLS * CW + (COLS - 1) * GAP)) / 2, s.y);
    }
    for (const c of L.cards) {
      const lit = c.side === 'shu' ? unlocked.has(c.id) : !!ach.seen[c.id];
      drawMiniCard(ctx, c, lit, c.side === 'shu' ? tierIndex(ach.kills[c.id] || 0) : -1);
    }
    if (detailId) drawDetail(ctx, view, save, ach, detailId);
  } else {
    for (const r of L.rows) drawAchRow(ctx, r, ach);
  }
}

function drawMiniCard(ctx, c, lit, tier) {
  if (!lit) {                                          // 未解锁：斜纹剪影
    roundRect(ctx, c.x, c.y, c.w, c.h, 8); ctx.fillStyle = '#241a12'; ctx.fill();
    ctx.strokeStyle = 'rgba(120,90,50,.4)'; ctx.stroke();
    ctx.fillStyle = 'rgba(200,170,110,.5)'; ctx.font = FONT.head(28); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', c.x + c.w / 2, c.y + c.h / 2);
    return;
  }
  // 解锁：流光段位底 + 立绘 + 名/段
  const t = tier >= 0 ? TIERS[tier] : null;
  roundRect(ctx, c.x, c.y, c.w, c.h, 8);
  ctx.fillStyle = t ? tierColor(tier) : '#5a3414'; ctx.fill();
  const img = cardImg(c.id, c.side);
  if (img) { ctx.save(); roundRect(ctx, c.x + 3, c.y + 3, c.w - 6, c.h - 26, 6); ctx.clip();
    const ih = (c.w - 6) * (img.height / img.width || 1.3); ctx.drawImage(img, c.x + 3, c.y + 3, c.w - 6, ih); ctx.restore(); }
  ctx.strokeStyle = t ? 'rgba(255,235,170,.8)' : 'rgba(200,160,90,.5)'; ctx.lineWidth = 1.5; roundRect(ctx, c.x, c.y, c.w, c.h, 8); ctx.stroke();
  ctx.fillStyle = PAL.cream; ctx.font = FONT.head(11); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const nm = c.side === 'shu' ? GENERALS[c.id].name : enemyName(c.id);
  ctx.fillText(nm, c.x + c.w / 2, c.y + c.h - 8);
  if (tier === 5) { ctx.fillText('👑', c.x + c.w - 12, c.y + 16); }
}

function tierColor(i) { return ['#7a4a1e', '#8a8f99', '#caa23a', '#3fb6cc', '#9a5bd0', '#c0392b'][i] || '#5a3414'; }

function drawAchRow(ctx, r, ach) {
  const a = ACHIEVEMENTS.find((x) => x.id === r.id);
  const got = !!ach.earned[r.id];
  panel(ctx, r.x, r.y, r.w, r.h, { variant: got ? 'wood' : 'ink', r: 8 });
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = got ? PAL.gold : PAL.dim; ctx.font = FONT.head(14);
  ctx.fillText((got ? '✅ ' : '🔒 ') + a.name, r.x + 12, r.y + r.h / 2 - 7);
  ctx.fillStyle = PAL.dim; ctx.font = FONT.body(11);
  ctx.fillText('[' + a.cat + '] ' + a.desc, r.x + 12, r.y + r.h / 2 + 11);
}

function drawDetail(ctx, view, save, ach, id) {
  const isShu = !!GENERALS[id];
  ctx.fillStyle = 'rgba(8,5,3,.72)'; ctx.fillRect(0, 0, view.w, view.h);
  const W = 360, H = 420, x = (view.w - W) / 2, y = (view.h - H) / 2;
  panel(ctx, x, y, W, H, { variant: 'parch', r: 14 });
  const img = cardImg(id, isShu ? 'shu' : (BOSSES[id] ? 'boss' : 'lieut'));
  if (img) { ctx.save(); roundRect(ctx, x + 20, y + 20, W - 40, 220, 10); ctx.clip();
    const iw = W - 40, ih = iw * (img.height / img.width || 1.3); ctx.drawImage(img, x + 20, y + 20, iw, ih); ctx.restore(); }
  ctx.fillStyle = PAL.ink; ctx.font = FONT.head(22); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const nm = isShu ? GENERALS[id].name : enemyName(id);
  ctx.fillText(nm, x + W / 2, y + 272);
  ctx.font = FONT.body(12); ctx.fillStyle = 'rgba(60,46,26,.92)';
  if (isShu) {
    const k = ach.kills[id] || 0, ti = tierIndex(k);
    ctx.fillText('段位:' + TIERS[ti].name + '  ·  累计击杀 ' + k, x + W / 2, y + 298);
    const lore = HERO_LORE[id];
    if (lore) wrapText(ctx, lore.bio, x + 24, y + 322, W - 48, 16);
  } else {
    ctx.fillText('敌方武将 · 已击败', x + W / 2, y + 298);
  }
  ctx.fillStyle = PAL.dim; ctx.font = FONT.body(11); ctx.fillText('（点击任意处关闭）', x + W / 2, y + H - 16);
}

function wrapText(ctx, text, x, y, maxW, lh) {
  ctx.textAlign = 'left'; let line = '', yy = y;
  for (const ch of text) { if (ctx.measureText(line + ch).width > maxW && line) { ctx.fillText(line, x, yy); line = ch; yy += lh; } else line += ch; }
  if (line) ctx.fillText(line, x, yy);
}
