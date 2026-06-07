// Entry point for 丛林勇士: builds the renderer + game, wires input + the title overlay,
// and runs the requestAnimationFrame loop.

import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { Sprites } from './sprites.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const game = new Game();
Input.init(canvas);

// Expose for the host-side browser smoke (tests/smoke.mjs) to assert real state.
if (typeof window !== 'undefined') window.__game = game;

const el = (id) => document.getElementById(id);

function startGame() { if (game.state === 'title') game.startLevel(0); }
el('btn-start').addEventListener('click', startGame);

// Mute
const muteBtn = el('btn-mute');
muteBtn.addEventListener('click', () => { muteBtn.textContent = Sound.toggleMuted() ? '🔇' : '🔊'; });

// Fullscreen (hidden where unsupported, e.g. iPhone Safari)
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

// Rebuild sprite caches if iOS blanked them while backgrounded.
document.addEventListener('visibilitychange', () => { if (!document.hidden) { Sprites.clearCache(); renderer.resize(); } });

// Discrete actions (keyboard / gamepad / canvas tap)
Input.on((action) => {
  if (action === 'confirm') {
    if (game.state === 'title') startGame();
    else game.confirm(); // ready -> playing, clear -> title
  } else if (action === 'mute') {
    muteBtn.textContent = Sound.toggleMuted() ? '🔇' : '🔊';
  }
});

// Title overlay visibility follows state.
let lastState = null;
function syncOverlay() {
  if (game.state === lastState) return;
  lastState = game.state;
  el('overlay-title').classList.toggle('show', game.state === 'title');
}

// Main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045);
  last = now;
  try {
    Input.poll();
    game.update(dt);
    renderer.render(game);
    syncOverlay();
  } catch (err) {
    if ((frame._errs = (frame._errs || 0) + 1) <= 8) console.error('[loop] frame error:', err);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
