// Entry point for 像素冒险 PIXEL QUEST: builds the renderer + game, wires input and the
// HTML overlays, and runs the requestAnimationFrame loop.

import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Sprites } from './sprites.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const game = new Game();

Input.init(canvas);

const el = (id) => document.getElementById(id);
const overlays = {
  menu: el('overlay-menu'),
  story: el('overlay-story'),
  paused: el('overlay-pause'),
  levelclear: el('overlay-levelclear'),
  gameover: el('overlay-gameover'),
  win: el('overlay-win'),
  dialogue: el('overlay-dialogue'),
};

function showOverlay(name) {
  for (const [key, node] of Object.entries(overlays)) {
    if (node) node.classList.toggle('show', key === name);
  }
}

// ---- Menu mode selection --------------------------------------------------
function setMenuChoice(choice) {
  game.menuChoice = choice;
  el('mode-easy').classList.toggle('selected', choice === 'easy');
  el('mode-classic').classList.toggle('selected', choice === 'classic');
  Sound.ui();
}

el('mode-easy').addEventListener('click', () => startWith('easy'));
el('mode-classic').addEventListener('click', () => startWith('classic'));
function startWith(mode) {
  game.menuChoice = mode;
  el('mode-easy').classList.toggle('selected', mode === 'easy');
  el('mode-classic').classList.toggle('selected', mode === 'classic');
  game.startGame(mode);
}

// ---- Story panel ----------------------------------------------------------
el('btn-story-go').addEventListener('click', () => game.beginAfterStory());

// ---- Overlay buttons ------------------------------------------------------
el('btn-resume').addEventListener('click', () => game.togglePause());
el('btn-restart').addEventListener('click', () => game.restart());
el('btn-next').addEventListener('click', () => game.nextLevel());
el('btn-retry').addEventListener('click', () => game.continueRun());
el('btn-go-menu').addEventListener('click', () => (game.state = 'menu'));
el('btn-win-retry').addEventListener('click', () => game.startGame(game.mode.id));
el('btn-win-menu').addEventListener('click', () => (game.state = 'menu'));
// 对话:点击弹窗任意处(含 ▶ 区域,事件冒泡)推进一句。只挂在容器上,避免重复推进。
el('overlay-dialogue').addEventListener('click', () => game.advanceDialogue());

// Mute toggle (top-right).
const muteBtn = el('btn-mute');
muteBtn.addEventListener('click', () => {
  const m = Sound.toggleMuted();
  muteBtn.textContent = m ? '🔇' : '🔊';
});

// Fullscreen toggle (top-right, left of mute). iPhone Safari doesn't support
// element fullscreen, so hide the button where the API is unavailable.
const fsBtn = el('btn-fullscreen');
function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
function fsSupported() {
  const d = document.documentElement;
  return !!(d.requestFullscreen || d.webkitRequestFullscreen || canvas.webkitRequestFullscreen);
}
function toggleFullscreen() {
  try {
    if (fsElement()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const d = document.documentElement;
      (d.requestFullscreen || d.webkitRequestFullscreen).call(d);
    }
  } catch (_) { /* ignore */ }
}
if (fsBtn) {
  if (!fsSupported()) {
    fsBtn.style.display = 'none';
  } else {
    fsBtn.addEventListener('click', toggleFullscreen);
    const syncFs = () => {
      const on = !!fsElement();
      fsBtn.textContent = on ? '🗗' : '⛶';
      fsBtn.title = on ? '退出全屏' : '全屏';
      renderer.resize(); // canvas must match the new viewport size
    };
    document.addEventListener('fullscreenchange', syncFs);
    document.addEventListener('webkitfullscreenchange', syncFs);
  }
}

// When returning to a backgrounded tab, iOS may have blanked our cached sprite
// canvases — rebuild them so we never come back to an empty/black scene.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { Sprites.clearCache(); renderer.resize(); }
});

// ---- Discrete actions (keyboard / gamepad / touch) ------------------------
Input.on((action) => {
  const s = game.state;
  switch (action) {
    case 'confirm':
      // Only menus/transition screens consume confirm; in-game it's just jump.
      if (s !== 'playing') handleConfirm();
      break;
    case 'jump':
      // jump is handled via Input.held in the player; nothing discrete needed in-game.
      break;
    case 'fire':
      game.tryFire();
      break;
    case 'pause':
      if (s === 'playing' || s === 'ready' || s === 'paused') game.togglePause();
      break;
    case 'back':
      if (s === 'paused') game.togglePause();
      break;
    case 'mute':
      muteBtn.textContent = Sound.toggleMuted() ? '🔇' : '🔊';
      break;
  }
});

function handleConfirm() {
  switch (game.state) {
    case 'menu': game.startGame(game.menuChoice); break;
    case 'story': game.beginAfterStory(); break;
    case 'ready': game.confirm(); break;
    case 'paused': game.togglePause(); break;
    case 'dialogue': game.confirm(); break;
    case 'levelclear':
    case 'gameover':
    case 'win': game.confirm(); break;
  }
}

// ---- Overlay text sync ----------------------------------------------------
let lastState = null;
let _lastDlgNode = null; // 对话当前节点的脏标记(state 不变但 index 变时需刷新)
function syncOverlays() {
  const s = game.state;
  const overlayName = (s === 'playing' || s === 'ready') ? null : (s in overlays ? s : null);
  showOverlay(overlayName);

  // 对话节点刷新:state 一直是 'dialogue' 但 index 会变,不能走 lastState 短路。
  if (s === 'dialogue') {
    const node = game.currentDialogueNode();
    if (node !== _lastDlgNode) {
      _lastDlgNode = node;
      if (node) {
        el('dlg-speaker').textContent = node.speaker;
        el('dlg-text').textContent = node.text;
        const cv = Sprites.portrait(node.portrait);
        const pc = el('dlg-portrait');
        const px = pc.getContext('2d');
        px.imageSmoothingEnabled = false;
        px.clearRect(0, 0, pc.width, pc.height);
        // 头像按原始像素尺寸居中绘制(画布 40×40,CSS 放大到 96 pixelated)
        px.drawImage(cv, Math.floor((pc.width - cv.width) / 2), Math.floor((pc.height - cv.height) / 2));
      }
    }
  } else if (_lastDlgNode !== null) {
    _lastDlgNode = null;
  }

  // Touch controls visible only during gameplay.
  const tc = el('touch-controls');
  if (tc) tc.classList.toggle('active', s === 'playing' || s === 'ready');

  if (s === lastState) {
    if (s === 'menu') updateMenuBest();
    return;
  }
  lastState = s;

  if (s === 'menu') {
    setMenuChoice(game.menuChoice);
    updateMenuBest();
  } else if (s === 'levelclear') {
    el('lc-title').textContent = `🎉 关卡 ${game.currentLevelId()} 通关！`;
    el('lc-score').textContent = `当前得分 ${game.score}`;
  } else if (s === 'gameover') {
    el('go-score').textContent = `本次得分 ${game.score}`;
    el('go-best').textContent = `最高分 ${game.best.score} · 最远关卡 第 ${game.best.level} 关`;
  } else if (s === 'win') {
    el('win-score').textContent = `总得分 ${game.score}`;
    el('win-best').textContent = `最高分 ${game.best.score}`;
  }
}

function updateMenuBest() {
  el('menu-best').textContent = `🏆 最高分 ${game.best.score} · 最远第 ${game.best.level} 关`;
}

// ---- Main loop ------------------------------------------------------------
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045);
  last = now;
  try {
    Input.poll();
    const t0 = performance.now();
    game.update(dt);
    renderer.render(game);
    const cost = performance.now() - t0;
    // Dev aid: warn on long frames so we can locate jank by level/state instead of
    // guessing. Normally silent. (Safe to remove once perf is settled.)
    if (cost > 24) {
      console.warn(`[perf] long frame ${cost.toFixed(1)}ms · lvl ${game.currentLevelId && game.currentLevelId()} · state=${game.state} · coins=${game.coinsArr && game.coinsArr.length} enemies=${game.enemies && game.enemies.length} particles=${game.particles && game.particles.length} fireballs=${game.fireballs && game.fireballs.length}`);
    }
    syncOverlays();
  } catch (err) {
    // Never let one bad frame kill the rAF loop (that would freeze the game).
    if ((frame._errs = (frame._errs || 0) + 1) <= 8) console.error('[loop] frame error:', err);
  }
  requestAnimationFrame(frame); // always reschedule, even after an error
}
requestAnimationFrame(frame);
