// Thin driver for 丛林尖兵 JUNGLE BLITZ.
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const game = new Game();

Input.init(canvas, (cx) => renderer.mapClientXToField(cx));
Input.on((action) => game.handleAction(action));

// Overlay map: game state → overlay element id.
const OVERLAY_IDS = {
  menu:       'overlay-menu',
  paused:     'overlay-pause',
  stageclear: 'overlay-stageclear',
  gameover:   'overlay-gameover',
  win:        'overlay-win',
};

function showOverlay(stateName) {
  for (const [key, id] of Object.entries(OVERLAY_IDS)) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('show', key === stateName);
  }
}

function syncOverlays() {
  showOverlay(game.state);

  // Menu best score.
  const menuBest = document.getElementById('menu-best');
  if (menuBest) {
    menuBest.textContent = '🏆 最高分 ' + game.best.score + ' · 最远第 ' + game.best.stage + ' 关';
  }

  // Stage clear.
  const scTitle = document.getElementById('sc-title');
  const scScore = document.getElementById('sc-score');
  if (scScore) scScore.textContent = '本关得分：' + game.score;

  // Game over.
  const goScore = document.getElementById('go-score');
  const goBest  = document.getElementById('go-best');
  if (goScore) goScore.textContent = '得分：' + game.score;
  if (goBest)  goBest.textContent  = '🏆 最高分 ' + game.best.score;

  // Win.
  const winScore = document.getElementById('win-score');
  const winBest  = document.getElementById('win-best');
  if (winScore) winScore.textContent = '最终得分：' + game.score;
  if (winBest)  winBest.textContent  = '🏆 最高分 ' + game.best.score;

  // Stage banner.
  const banner = document.getElementById('stage-banner');
  const sbText = document.getElementById('sb-text');
  if (banner && sbText) {
    const stageLabel = game.stage
      ? '第 ' + (game.stageIndex + 1) + ' 关 · ' + game.stage.name
      : '';
    sbText.textContent = stageLabel;
    banner.classList.toggle('show', game.bannerMs > 0);
  }
}

// Button wiring.
const BTN = (id, fn) => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
};
BTN('btn-start',    () => { Sound.resume(); Sound.ui(); game.startGame(); });
BTN('btn-resume',   () => { Sound.ui(); game.togglePause(); });
BTN('btn-restart',  () => { Sound.ui(); game.restartStage(); });
BTN('btn-next',     () => { Sound.ui(); game.nextStage(); });
BTN('btn-continue', () => { Sound.ui(); game.continueFromCheckpoint(); });
BTN('btn-go-menu',  () => { Sound.ui(); game.toMenu(); });
BTN('btn-win-retry',() => { Sound.ui(); game.startGame(); });

// Mute button — toggles audio and updates glyph.
const btnMute = document.getElementById('btn-mute');
function updateMuteGlyph() {
  if (btnMute) btnMute.textContent = Sound.isMuted() ? '🔇' : '🔊';
}
if (btnMute) {
  btnMute.addEventListener('click', () => {
    Sound.resume();
    Sound.toggleMuted();
    updateMuteGlyph();
  });
}

// Also handle mute action from keyboard/gamepad input.
Input.on((action) => {
  if (action === 'mute') {
    Sound.resume();
    Sound.toggleMuted();
    updateMuteGlyph();
  }
});

// RAF loop.
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
