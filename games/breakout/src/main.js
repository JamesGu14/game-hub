// Entry point for 打砖块 BREAKOUT: builds the renderer + game, wires input and the
// HTML overlays, and runs the requestAnimationFrame loop.

import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const game = new Game();

Input.init(canvas, (clientX) => renderer.mapClientXToField(clientX));

// ---- Overlay elements -----------------------------------------------------
const el = (id) => document.getElementById(id);
const overlays = {
  menu: el('overlay-menu'),
  paused: el('overlay-pause'),
  levelclear: el('overlay-levelclear'),
  gameover: el('overlay-gameover'),
  win: el('overlay-win'),
};

function showOverlay(name) {
  for (const [key, node] of Object.entries(overlays)) {
    node.classList.toggle('show', key === name);
  }
}

// ---- Menu mode selection --------------------------------------------------
function setMenuChoice(choice) {
  game.menuChoice = choice;
  el('mode-easy').classList.toggle('selected', choice === 'easy');
  el('mode-normal').classList.toggle('selected', choice === 'normal');
  Sound.ui();
}

el('mode-easy').addEventListener('click', () => startWith('easy'));
el('mode-normal').addEventListener('click', () => startWith('normal'));
function startWith(mode) {
  setMenuChoice(mode);
  game.startGame(mode);
}

// ---- Overlay buttons ------------------------------------------------------
el('btn-resume').addEventListener('click', () => game.togglePause());
el('btn-restart').addEventListener('click', () => game.restart());
el('btn-next').addEventListener('click', () => game.nextLevel());
el('btn-retry').addEventListener('click', () => game.startGame(game.mode.id));
el('btn-go-menu').addEventListener('click', () => (game.state = 'menu'));
el('btn-win-retry').addEventListener('click', () => game.startGame(game.mode.id));
el('btn-win-menu').addEventListener('click', () => (game.state = 'menu'));

// Mute toggle (top-right).
const muteBtn = el('btn-mute');
muteBtn.addEventListener('click', () => {
  const m = Sound.toggleMuted();
  muteBtn.textContent = m ? '🔇' : '🔊';
});

// ---- Discrete actions (keyboard / gamepad / click) ------------------------
Input.on((action) => {
  const s = game.state;
  switch (action) {
    case 'launch':
    case 'confirm':
      handleConfirm();
      break;
    case 'pause':
      if (s === 'playing' || s === 'ready' || s === 'paused') game.togglePause();
      break;
    case 'left':
      if (s === 'menu') setMenuChoice('easy');
      break;
    case 'right':
      if (s === 'menu') setMenuChoice('normal');
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
    case 'menu':
      game.startGame(game.menuChoice);
      break;
    case 'ready':
      game.launch();
      break;
    case 'paused':
      game.togglePause();
      break;
    case 'levelclear':
    case 'gameover':
    case 'win':
      game.confirm();
      break;
  }
}

// ---- Overlay text sync ----------------------------------------------------
let lastState = null;
function syncOverlays() {
  const s = game.state;
  const overlayName =
    s === 'playing' || s === 'ready' ? null : s in overlays ? s : null;
  showOverlay(overlayName);

  if (s === lastState) {
    if (s === 'menu') updateMenuBest();
    return;
  }
  lastState = s;

  if (s === 'menu') {
    setMenuChoice(game.menuChoice);
    updateMenuBest();
  } else if (s === 'levelclear') {
    el('lc-title').textContent = `🎉 第 ${game.levelIndex + 1} 关通关！`;
    el('lc-score').textContent = `当前得分 ${game.score}`;
  } else if (s === 'gameover') {
    el('go-score').textContent = `本次得分 ${game.score}`;
    el('go-best').textContent = `最高分 ${game.best.score} · 最远第 ${game.best.level} 关`;
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
  Input.poll();
  game.update(dt);
  renderer.render(game);
  syncOverlays();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
