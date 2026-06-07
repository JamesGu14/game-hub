// Entry point for 丛林勇士: builds the renderer + game, wires the title / select / mode /
// gameover / Konami overlays, and runs the requestAnimationFrame loop.

import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Sprites } from './sprites.js';
import { LEVELS } from './levels.js';
import * as Save from './save.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const game = new Game();
Input.init(canvas);
if (typeof window !== 'undefined') window.__game = game;

const el = (id) => document.getElementById(id);

// ---- Konami toast (created dynamically) ----
const toast = document.createElement('div');
toast.id = 'konami-toast';
document.body.appendChild(toast);
let toastTimer = 0;
function showToast(msg) { toast.textContent = msg; toast.classList.add('show'); toastTimer = 2.2; }

// ---- mode toggle ----
function reflectMode() {
  el('mode-casual').classList.toggle('selected', game.mode.id === 'casual');
  el('mode-classic').classList.toggle('selected', game.mode.id === 'classic');
}
el('mode-casual').addEventListener('click', () => { game.setMode('casual'); reflectMode(); Sound.play('ui'); });
el('mode-classic').addEventListener('click', () => { game.setMode('classic'); reflectMode(); Sound.play('ui'); });

// ---- title / select / gameover buttons ----
el('btn-start').addEventListener('click', () => game.goSelect());
el('btn-select-back').addEventListener('click', () => game.goTitle());
el('btn-continue').addEventListener('click', () => game.continueRun());
el('btn-go-select').addEventListener('click', () => game.goSelect());

function buildSelect() {
  const grid = el('select-grid');
  grid.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const id = i + 1;
    const info = Save.levelInfo(id);
    const unlocked = Save.isUnlocked(id);
    const card = document.createElement('button');
    card.className = 'level-card' + (unlocked ? '' : ' locked') + (unlocked && !info.cleared ? ' next' : '');
    const stars = info.bestStars ? '⭐'.repeat(info.bestStars) : '';
    const sub = !unlocked ? '' : (info.cleared ? `${stars} · ${info.bestScore}` : 'NEXT');
    card.innerHTML = `<b>${unlocked ? lv.name : '🔒'}</b><span>${sub}</span>`;
    if (unlocked) card.addEventListener('click', () => { game.selectLevel(i); Sound.play('ui'); });
    grid.appendChild(card);
  });
}

function refreshTitleBest() {
  const cleared = LEVELS.reduce((n, _lv, i) => n + (Save.levelInfo(i + 1).cleared ? 1 : 0), 0);
  el('title-best').textContent = `已通关 ${cleared}/${LEVELS.length} 关`
    + (Save.getKonami() ? ' · 🦅 彩蛋已解锁' : '');
}

// ---- mute / fullscreen ----
const muteBtn = el('btn-mute');
muteBtn.addEventListener('click', () => { muteBtn.textContent = Sound.toggleMuted() ? '🔇' : '🔊'; });
const fsBtn = el('btn-fullscreen');
function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
function fsSupported() { const d = document.documentElement; return !!(d.requestFullscreen || d.webkitRequestFullscreen); }
if (fsBtn) {
  if (!fsSupported()) fsBtn.style.display = 'none';
  else fsBtn.addEventListener('click', () => {
    try {
      if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else { const d = document.documentElement; (d.requestFullscreen || d.webkitRequestFullscreen).call(d); }
    } catch (_) { /* ignore */ }
    setTimeout(() => renderer.resize(), 60);
  });
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) { Sprites.clearCache(); renderer.resize(); } });

// ---- discrete actions ----
Input.on((action) => {
  if (action === 'confirm') {
    if (game.state !== 'playing') game.confirm(); // title->select, select->L1, clear->select, gameover->continue
  } else if (action === 'mute') {
    muteBtn.textContent = Sound.toggleMuted() ? '🔇' : '🔊';
  } else if (action === 'konami') {
    game.onKonami();
    showToast(game.mode.id === 'classic' ? '🦅 KONAMI! 30 条命' : '🦅 KONAMI! 隐藏特效');
  }
});

// ---- overlay sync ----
const overlays = { title: el('overlay-title'), select: el('overlay-select'), gameover: el('overlay-gameover') };
let lastState = null;
function syncOverlay() {
  const s = game.state;
  for (const [k, node] of Object.entries(overlays)) node.classList.toggle('show', k === s);
  if (s === lastState) return;
  lastState = s;
  if (s === 'title') { reflectMode(); refreshTitleBest(); }
  else if (s === 'select') buildSelect();
  else if (s === 'gameover') el('go-score').textContent = `本次得分 ${game.score}`;
}

// ---- main loop ----
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045);
  last = now;
  try {
    Input.poll();
    game.update(dt);
    renderer.render(game);
    if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) toast.classList.remove('show'); }
    syncOverlay();
  } catch (err) {
    if ((frame._errs = (frame._errs || 0) + 1) <= 8) console.error('[loop] frame error:', err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
