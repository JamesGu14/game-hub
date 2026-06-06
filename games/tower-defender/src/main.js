// main.js — 装配：预加载 → 建状态 → 循环 → 渲染 + 输入。仅 import 本游戏路径（自含铁律）。
import { BAL } from './data/balance.js';
import { LEVELS } from './data/levels.js';
import { preload } from './core/assets.js';
import { newGameState } from './core/gameState.js';
import { makeLoop } from './core/gameLoop.js';
import { bus } from './core/eventBus.js';
import { tryBuild } from './systems/economySystem.js';
import { drawBoard } from './render/board.js';
import { drawTower, drawEnemy, drawProjectile, drawFx } from './render/entityRenderer.js';
import { drawHud } from './render/hud.js';
import { spawnFloat } from './render/fx.js';
import { drawBuildBar, hitBuildBar } from './ui/buildBar.js';
import { GENERALS } from './data/generals.js';

const C = BAL.CELL;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const bannerEl = document.getElementById('banner');

const view = { w: 0, h: 0, scale: 1, ox: 0, oy: 0 };
let state = null;
let selected = 'huang';
let hover = null;            // { x, y } 悬停格

const EARLY_BTN = () => ({ x: view.w / 2 - 72, y: 44, w: 144, h: 30 });

function resize() {
  view.w = canvas.width = window.innerWidth;
  view.h = canvas.height = window.innerHeight;
  const bw = state.level.cols * C, bh = state.level.rows * C;
  const TOP = 38, BOT = 76, availH = view.h - TOP - BOT;   // 只留 HUD + 建造栏，其余铺满
  view.scale = Math.min(view.w / bw, availH / bh);
  view.ox = (view.w - bw * view.scale) / 2;
  view.oy = TOP + (availH - bh * view.scale) / 2;
}

function screenToCell(sx, sy) {
  const bx = (sx - view.ox) / view.scale, by = (sy - view.oy) / view.scale;
  return { x: Math.floor(bx / C), y: Math.floor(by / C) };
}

function slotAt(cell) {
  return state.level.slots.find((s) => s.x === cell.x && s.y === cell.y) || null;
}

function inBtn(b, sx, sy) { return sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h; }

function render(s) {
  // 背景
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a120b'; ctx.fillRect(0, 0, view.w, view.h);

  // 板坐标
  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  drawBoard(ctx, s);

  // 悬停将位的射程预览
  if (hover) {
    const slot = slotAt(hover);
    if (slot && !s.towers.some((t) => t.slot.x === slot.x && t.slot.y === slot.y)) {
      const g = GENERALS[selected];
      ctx.strokeStyle = 'rgba(191,224,255,.5)'; ctx.fillStyle = 'rgba(191,224,255,.08)';
      ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(slot.x * C + C / 2, slot.y * C + C / 2, g.range * C, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  for (const e of s.enemies) drawEnemy(ctx, e);
  for (const t of s.towers) drawTower(ctx, t);
  for (const p of s.projectiles) drawProjectile(ctx, p);
  for (const f of s.fx) drawFx(ctx, f);

  // 屏幕坐标：HUD / 建造栏 / 提前出兵 / 横幅
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud(ctx, s, view);
  drawBuildBar(ctx, s, view, selected);
  if (s.phase === 'prep') {
    const b = EARLY_BTN();
    ctx.fillStyle = 'rgba(255,159,67,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#2b1d12'; ctx.font = '700 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚔ 提前出兵 (↵)', b.x + b.w / 2, b.y + b.h / 2);
  }
  updateBanner(s);
}

function updateBanner(s) {
  if (s.phase === 'won') { bannerEl.textContent = '守城成功 ' + '★'.repeat(s.stars || 0); bannerEl.classList.add('show'); }
  else if (s.phase === 'lost') { bannerEl.textContent = '成都失守…'; bannerEl.classList.add('show'); }
  else bannerEl.classList.remove('show');
}

function onPointerDown(ev) {
  const sx = ev.clientX, sy = ev.clientY;
  const pick = hitBuildBar(view, sx, sy);
  if (pick) { selected = pick; return; }
  if (state.phase === 'prep' && inBtn(EARLY_BTN(), sx, sy)) { state.earlyRequested = true; return; }
  const slot = slotAt(screenToCell(sx, sy));
  if (slot) tryBuild(state, slot, selected);
}

function onPointerMove(ev) { hover = screenToCell(ev.clientX, ev.clientY); }

function onKey(ev) {
  if (ev.code === 'Space') { state.paused = !state.paused; ev.preventDefault(); }
  else if (ev.key === 'f' || ev.key === 'F') { state.speed = state.speed === 1 ? 2 : 1; }
  else if (ev.key === 'Enter') { if (state.phase === 'prep') state.earlyRequested = true; }
  else if (ev.key === '1') { selected = 'huang'; }
}

async function boot() {
  await preload();
  state = newGameState(LEVELS[0]);
  resize();
  // 调试/QA 钩子（无害）：供 browser-qa 读状态、模拟建塔/出兵。
  window.__td = {
    get state() { return state; },
    get view() { return view; },
    build(cx, cy) { const s = state.level.slots.find((p) => p.x === cx && p.y === cy); return s ? tryBuild(state, s, selected) : false; },
    early() { if (state.phase === 'prep') state.earlyRequested = true; },
    setSpeed(n) { state.speed = n; },
  };
  bus.on('enemyKilled', ({ enemy }) => spawnFloat(state, enemy.px, enemy.py, '+' + enemy.gold));

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('keydown', onKey);

  const loop = makeLoop(state, render);
  document.addEventListener('visibilitychange', loop.onVisible);
  loop.start();
}

boot();
