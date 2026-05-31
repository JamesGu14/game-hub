// Thin driver for 丛林尖兵 JUNGLE BLITZ.
import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';

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
const BTN = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
BTN('btn-start',    () => game.startGame());
BTN('btn-resume',   () => game.togglePause());
BTN('btn-restart',  () => game.restartStage());
BTN('btn-next',     () => game.nextStage());
BTN('btn-continue', () => game.continueFromCheckpoint());
BTN('btn-go-menu',  () => game.toMenu());
BTN('btn-win-retry',() => game.startGame());

// Mute button — visual toggle only; audio wired in a later task.
const btnMute = document.getElementById('btn-mute');
if (btnMute) {
  btnMute.addEventListener('click', () => {
    game.handleAction('mute');
  });
}

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
