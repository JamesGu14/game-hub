// Entry point for 炮炮虫 BOOM WORMS.
// Bootstrap, RAF loop, overlay sync, button + mode wiring.
// Mirrors games/jungle-blitz/src/main.js conventions.

import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound, Music } from './audio.js';
import { LEVELS } from './levels.js';
import { levelNodeState } from './progress.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const game = new Game();

// Wire Input into Game (so _updateAim can read held state)
game.setInput(Input);

Input.init(canvas, (cx, cy) => renderer.mapClientToField(cx, cy));
Input.on((action) => game.handleAction(action));

// Also handle mute from keyboard/gamepad
Input.on((action) => {
  if (action && action.type === 'mute') {
    Sound.resume();
    Sound.toggleMuted();
    _updateMuteGlyph();
  }
});

// ---------------------------------------------------------------------------
// Overlay map: game.state → overlay element id
// ---------------------------------------------------------------------------
const OVERLAY_IDS = {
  menu:        'overlay-menu',
  levelselect: 'overlay-levelselect',
  paused:      'overlay-pause',
  levelclear:  'overlay-levelclear',
  gameover:    'overlay-gameover',
  win:         'overlay-win',
};

function showOverlay(stateName) {
  for (const [key, id] of Object.entries(OVERLAY_IDS)) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('show', key === stateName);
  }
}

let _prevState = null;

function syncOverlays() {
  showOverlay(game.state);

  // --- Audio: fire terminal stings + start/stop BGM on state transitions ---
  if (game.state !== _prevState) {
    if (game.state === 'levelclear') Sound.levelClear();
    else if (game.state === 'gameover') Sound.gameOver();
    else if (game.state === 'win') Sound.win();

    const inPlay = game.state === 'aim' || game.state === 'firing' ||
                   game.state === 'projectile' || game.state === 'resolve';
    if (inPlay) Music.start(game.levelIndex || 0);  // idempotent while already playing
    else Music.stop();                              // menu / pause / clear / over / win

    _prevState = game.state;
  }

  // Menu: best progress
  const menuBest = document.getElementById('menu-best');
  if (menuBest) {
    const lv = game.best && game.best.level ? game.best.level : 0;
    menuBest.textContent = lv > 0
      ? '🏆 最远进度：第 ' + lv + ' 关已通关'
      : '🏆 最远进度：第 1 关';
  }

  // Level clear message
  const lcMsg = document.getElementById('lc-msg');
  if (lcMsg && game.state === 'levelclear') {
    if (game.mode === 'duo') {
      lcMsg.textContent = game.bannerText || '本局结束！';
    } else {
      lcMsg.textContent = '第 ' + (game.levelIndex + 1) + ' 关通关！';
    }
  }

  // Game over message
  const goMsg = document.getElementById('go-msg');
  if (goMsg && game.state === 'gameover') {
    goMsg.textContent = game.mode === 'duo' ? '本局结束！' : '再努力一次！';
  }

  // Win message (all levels cleared) — dynamic, replaces the old hardcoded text (§11.13)
  const winMsg = document.getElementById('win-msg');
  if (winMsg && game.state === 'win') {
    winMsg.textContent = '恭喜通关全部 ' + LEVELS.length + ' 关！🎉';
  }

  // Turn banner
  const banner = document.getElementById('turn-banner');
  const bannerText = document.getElementById('turn-banner-text');
  if (banner && bannerText) {
    bannerText.textContent = game.bannerText || '';
    banner.classList.toggle('show', (game.bannerMs || 0) > 0);
  }

  // Power bar (DOM bar reflects charging state)
  const powerBar = document.getElementById('power-bar');
  if (powerBar) {
    const { Aim } = _getAimRef();
    const { AIM } = _getConfigRef();
    if (game.state === 'firing' && Aim && AIM && Aim.charging) {
      const pct = ((Aim.power - AIM.minSpeed) / (AIM.maxSpeed - AIM.minSpeed)) * 100;
      powerBar.style.width = Math.min(100, Math.max(0, pct)) + '%';
    } else {
      powerBar.style.width = '0%';
    }
  }

  // Wind indicator
  const windEl = document.getElementById('wind-indicator');
  if (windEl) {
    if (game.level && game.windEnabled && game.wind !== 0) {
      const dir = game.wind > 0 ? '→' : '←';
      windEl.textContent = '💨 ' + dir + ' ' + Math.round(Math.abs(game.wind));
    } else {
      windEl.textContent = '';
    }
  }
}

// ---------------------------------------------------------------------------
// Lazy refs (avoid import cycles by accessing after module loading)
// ---------------------------------------------------------------------------
function _getAimRef() {
  // Import Aim — already loaded since game.js imports it
  return { Aim: _aimRef };
}
function _getConfigRef() {
  return { AIM: _aimConfigRef };
}

// We need AIM config and Aim state. Grab them inline on first use.
let _aimRef = null;
let _aimConfigRef = null;

import('./aim.js').then(m => { _aimRef = m.Aim; });
import('./config.js').then(m => { _aimConfigRef = m.AIM; });

// ---------------------------------------------------------------------------
// Level select route map
// ---------------------------------------------------------------------------
function populateLevelSelect() {
  const track = document.getElementById('levelselect-track');
  const prog = document.getElementById('levelselect-progress');
  if (!track) return;
  const best = (game.best && game.best.level) ? game.best.level : 0; // highest cleared, 1-based
  const total = LEVELS.length;
  if (prog) {
    prog.textContent = best > 0
      ? '🏆 最远进度：第 ' + best + ' 关已通关'
      : '🏆 还未通关任何关卡';
  }
  track.innerHTML = '';
  let nextNode = null;
  LEVELS.forEach((lv, idx) => {
    const num = idx + 1;
    const stt = levelNodeState(num, best, total); // 'cleared' | 'next' | 'locked'
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'ls-node ' + stt;
    node.style.setProperty('--node-color', lv.palette.land);
    node.disabled = (stt === 'locked');
    const badge = stt === 'locked' ? '🔒' : (stt === 'next' ? '▶' : '✓');
    node.innerHTML =
      '<span class="ls-num">' + num + '</span>' +
      '<span class="ls-name">' + lv.name + '</span>' +
      '<span class="ls-badge">' + badge + '</span>';
    if (stt !== 'locked') {
      node.addEventListener('click', () => {
        Sound.resume();
        Sound.ui();
        game.startGame(idx, 'solo');
      });
    }
    track.appendChild(node);
    if (stt === 'next') nextNode = node;
  });
  // Auto-scroll to the next playable node — deferred one frame so the overlay
  // (toggled to display:flex by the next syncOverlays) is laid out first.
  const target = nextNode || track.lastElementChild;
  if (target && target.scrollIntoView) {
    requestAnimationFrame(() => target.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }
}

// ---------------------------------------------------------------------------
// Button wiring
// ---------------------------------------------------------------------------
const BTN = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
};

// Optional ?level=N (1-based) for replay
const levelParam = parseInt(new URLSearchParams(location.search).get('level'), 10);
const startIndex = Number.isFinite(levelParam) ? Math.max(0, levelParam - 1) : 0;

BTN('btn-solo', () => {
  Sound.resume();
  Sound.ui();
  if (Number.isFinite(levelParam)) {
    game.startGame(startIndex, 'solo'); // ?level=N debug shortcut → skip the select screen
  } else {
    populateLevelSelect();
    game.showLevelSelect();
  }
});
BTN('btn-ls-back', () => {
  Sound.ui();
  game.toMenu();
});
BTN('btn-duo', () => {
  Sound.resume();
  Sound.ui();
  game.startGame(0, 'duo');
});
BTN('btn-resume', () => {
  Sound.ui();
  game.togglePause();
});
BTN('btn-restart', () => {
  Sound.ui();
  game.restartLevel();
});
BTN('btn-next', () => {
  Sound.ui();
  game.nextLevel();
});
BTN('btn-retry', () => {
  Sound.ui();
  game.restartLevel();
});
BTN('btn-go-menu', () => {
  Sound.ui();
  game.toMenu();
});
BTN('btn-win-replay', () => {
  Sound.ui();
  game.startGame(0, game.mode);
});

// Wind checkbox
const chkWind = document.getElementById('chk-wind');
if (chkWind) {
  chkWind.addEventListener('change', () => {
    game.windEnabled = chkWind.checked;
  });
}

// Mute button
const btnMute = document.getElementById('btn-mute');
function _updateMuteGlyph() {
  if (btnMute) btnMute.textContent = Sound.isMuted() ? '🔇' : '🔊';
}
if (btnMute) {
  btnMute.addEventListener('click', () => {
    Sound.resume();
    Sound.toggleMuted();
    _updateMuteGlyph();
  });
}

// ---------------------------------------------------------------------------
// RAF loop
// ---------------------------------------------------------------------------
let last = performance.now();

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045);
  last = now;

  Input.poll();
  game.update(dt);
  renderer.render(game, dt);
  syncOverlays();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
