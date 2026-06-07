// main.js — 装配:读档 → 选关/游戏 屏幕状态机 → 循环(仅游戏态推进)→ 渲染 + 输入。仅 import 本游戏路径(自含铁律)。
import { BAL } from './data/balance.js';
import { LEVELS } from './data/levels.js';
import { preload } from './core/assets.js';
import { newGameState } from './core/gameState.js';
import { makeLoop } from './core/gameLoop.js';
import { bus } from './core/eventBus.js';
import { browserLoad, browserWrite, applyClear, isUnlocked, nextPlayableIndex } from './core/save.js';
import { tryBuild, tryUpgrade, sellTower } from './systems/economySystem.js';
import { drawBoard } from './render/board.js';
import { drawTower, drawEnemy, drawProjectile, drawFx } from './render/entityRenderer.js';
import { drawHud } from './render/hud.js';
import { spawnFloat } from './render/fx.js';
import { drawBuildBar, hitBuildBar } from './ui/buildBar.js';
import { hitTowerPanel, drawTowerPanel, cycleTowerMode } from './ui/towerPanel.js';
import { hitLevelSelect, drawLevelSelect } from './ui/levelSelect.js';
import { hitResult, drawResult } from './ui/resultPanel.js';
import { GENERALS } from './data/generals.js';

const GEN_IDS = ['huang', 'zhang', 'guan', 'zhao', 'ma', 'zhuge'];

const C = BAL.CELL;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const bannerEl = document.getElementById('banner');

const view = { w: 0, h: 0, scale: 1, ox: 0, oy: 0 };
let state = null;
let save = null;
let screen = 'select';        // [P4] 'select' | 'playing'
let recorded = false;         // [P4] 本局是否已写档(胜利只记一次)
let selected = 'huang';
let selectedTower = null;
let hover = null;

function towerAt(cell) {
  return state.towers.find((t) => t.slot.x === cell.x && t.slot.y === cell.y) || null;
}
function curIndex() { return LEVELS.indexOf(state.level); }

// [P4] 进关(原地换关,循环持同一 state 引用)。enterLevel 不校验解锁(供 retry/调试);startLevel 校验。
function enterLevel(n) {
  if (n < 0 || n >= LEVELS.length) return false;
  Object.assign(state, newGameState(LEVELS[n]));
  recorded = false; selected = 'huang'; selectedTower = null;
  resize(); screen = 'playing';
  return true;
}
function startLevel(n) { return isUnlocked(save, n + 1) ? enterLevel(n) : false; }
function toSelect() { screen = 'select'; selectedTower = null; }

const EARLY_BTN = () => ({ x: view.w / 2 - 72, y: 44, w: 144, h: 30 });

function resize() {
  view.w = canvas.width = window.innerWidth;
  view.h = canvas.height = window.innerHeight;
  const bw = state.level.cols * C, bh = state.level.rows * C;
  const TOP = 38, BOT = 76, availH = view.h - TOP - BOT;
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
  // [P4] 选关屏:只画选关页
  if (screen === 'select') { drawLevelSelect(ctx, view, save, LEVELS); return; }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#1a120b'; ctx.fillRect(0, 0, view.w, view.h);

  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  drawBoard(ctx, s);

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

  for (const e of s.enemies) drawEnemy(ctx, e, s.time);
  for (const t of s.towers) drawTower(ctx, t, s.time);
  for (const p of s.projectiles) drawProjectile(ctx, p);
  for (const f of s.fx) drawFx(ctx, f);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud(ctx, s, view);
  drawBuildBar(ctx, s, view, selected);
  if (selectedTower && s.towers.includes(selectedTower)) drawTowerPanel(ctx, view, s, selectedTower);
  if (s.phase === 'prep') {
    const b = EARLY_BTN();
    ctx.fillStyle = 'rgba(255,159,67,.9)'; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#2b1d12'; ctx.font = '700 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚔ 提前出兵 (↵)', b.x + b.w / 2, b.y + b.h / 2);
  }

  // [P4] 结算:胜利写档(一次)+ 结算面板
  if (s.phase === 'won' || s.phase === 'lost') {
    if (s.phase === 'won' && !recorded) {
      recorded = true;
      save = applyClear(save, s.level.id, s.stars);
      browserWrite(save);
    }
    drawResult(ctx, view, s, LEVELS.length);
  }
}

function onPointerDown(ev) {
  const sx = ev.clientX, sy = ev.clientY;

  // [P4] 选关屏
  if (screen === 'select') {
    const i = hitLevelSelect(view, save, LEVELS.length, sx, sy);
    if (i != null) startLevel(i);
    return;
  }
  // [P4] 结算屏(胜/负):仅响应结算按钮,消费其余点击
  if (state.phase === 'won' || state.phase === 'lost') {
    const act = hitResult(view, state, LEVELS.length, sx, sy);
    if (act === 'next') startLevel(curIndex() + 1);
    else if (act === 'retry') enterLevel(curIndex());
    else if (act === 'select') toSelect();
    return;
  }

  // —— 游戏中 ——
  const pick = hitBuildBar(view, sx, sy);
  if (pick) { selected = pick; selectedTower = null; return; }
  if (selectedTower && state.towers.includes(selectedTower)) {
    const act = hitTowerPanel(view, selectedTower, sx, sy);
    if (act === 'upgrade') { tryUpgrade(state, selectedTower); return; }
    if (act === 'sell') { sellTower(state, selectedTower); selectedTower = null; return; }
    if (act === 'mode') { cycleTowerMode(selectedTower); return; }
    if (act === 'panel') return;
  }
  if (state.phase === 'prep' && inBtn(EARLY_BTN(), sx, sy)) { state.earlyRequested = true; return; }
  const cell = screenToCell(sx, sy);
  const t = towerAt(cell);
  if (t) { selectedTower = t; return; }
  selectedTower = null;
  const slot = slotAt(cell);
  if (slot) tryBuild(state, slot, selected);
}

function onPointerMove(ev) { hover = screenToCell(ev.clientX, ev.clientY); }

function onKey(ev) {
  if (screen !== 'playing') return;                       // 选关/结算屏忽略游戏热键
  if (state.phase === 'won' || state.phase === 'lost') {
    if (ev.key === 'Escape') toSelect();
    return;
  }
  if (ev.code === 'Space') { state.paused = !state.paused; ev.preventDefault(); }
  else if (ev.key === 'f' || ev.key === 'F') { state.speed = state.speed === 1 ? 2 : 1; }
  else if (ev.key === 'Enter') { if (state.phase === 'prep') state.earlyRequested = true; }
  else if (ev.key === 'Escape') { if (selectedTower) selectedTower = null; else toSelect(); }
  else if (ev.key >= '1' && ev.key <= '6') { selected = GEN_IDS[+ev.key - 1]; selectedTower = null; }
  else if (ev.key === '[') { const i = curIndex(); if (i > 0) enterLevel(i - 1); }   // 调试切关
  else if (ev.key === ']') { const i = curIndex(); if (i < LEVELS.length - 1) enterLevel(i + 1); }
}

async function boot() {
  await preload();
  save = browserLoad();
  state = newGameState(LEVELS[nextPlayableIndex(save, LEVELS.length)]);   // 预建有效 state(供 resize/loop)
  resize();
  screen = 'select';
  if (bannerEl) bannerEl.classList.remove('show');   // 改用 resultPanel,不再用 #banner

  // 调试/QA 钩子:读状态、模拟操作、切关/选关、读档。
  window.__td = {
    get state() { return state; },
    get view() { return view; },
    get screen() { return screen; },
    getSave() { return save; },
    build(cx, cy, id = selected) { const s = state.level.slots.find((p) => p.x === cx && p.y === cy); return s ? tryBuild(state, s, id) : false; },
    upgrade(cx, cy) { const t = towerAt({ x: cx, y: cy }); return t ? tryUpgrade(state, t) : false; },
    sell(cx, cy) { const t = towerAt({ x: cx, y: cy }); return t ? sellTower(state, t) : 0; },
    setMode(cx, cy, m) { const t = towerAt({ x: cx, y: cy }); if (t) t.mode = m; return !!t; },
    select(id) { selected = id; },
    setGold(n) { state.gold = n; },
    loadLevel(n) { return enterLevel(n); },     // 调试:直接进任意关(不校验解锁)
    toSelect,
    early() { if (state.phase === 'prep') state.earlyRequested = true; },
    setSpeed(n) { state.speed = n; },
  };
  bus.on('enemyKilled', ({ enemy }) => spawnFloat(state, enemy.px, enemy.py, '+' + enemy.gold));

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('keydown', onKey);

  const loop = makeLoop(state, render, () => screen === 'playing');   // [P4] 仅游戏态推进模拟
  document.addEventListener('visibilitychange', loop.onVisible);
  loop.start();
}

boot();
