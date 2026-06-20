import { Game } from './game.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { LEVELS } from './levels.js';
import { SKILLS } from './skills.js';
import { CARD_POOL } from './cards.js';
import { browserLoad, browserWrite, applyClear, nextPlayableIndex } from './save.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
let save = browserLoad();
const game = new Game();
Input.init();
Input.on((a) => {
  if (a.type === 'skill') game.useSkill(a.id);
  else if (a.type === 'pause') { if (game.state === 'playing') game.state = 'paused'; else if (game.state === 'paused') game.state = 'playing'; }
});

const OVERLAY = { menu: 'overlay-menu', levelselect: 'overlay-levelselect', paused: 'overlay-pause', levelclear: 'overlay-levelclear', gameover: 'overlay-gameover', win: 'overlay-win' };
const $ = (id) => document.getElementById(id);
const BTN = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };

function showOverlay(state) {
  for (const [k, id] of Object.entries(OVERLAY)) { const el = $(id); if (el) el.classList.toggle('show', k === state); }
  $('card-chooser').classList.toggle('show', state === 'cardpick');
}

const cardInfo = (id) => CARD_POOL.find((c) => c.id === id) || { name: { __gold__: '金币', __xp__: '经验', __heal__: '修墙' }[id] || id, rarity: 'common' };

function renderCards() {
  const row = $('card-row'); row.innerHTML = '';
  for (const cid of game.pendingCards) {
    const info = cardInfo(cid);
    const el = document.createElement('div');
    el.className = 'card ' + (info.rarity || 'common');
    el.innerHTML = `<div class="c-name">${info.name}</div><div class="c-desc">${describe(info)}</div>`;
    el.addEventListener('click', () => { game.chooseCard(cid); });
    row.appendChild(el);
  }
}
const MOD_LABELS = {
  damagePct: '伤害', fireRatePct: '射速', bulletSpeedPct: '弹速', critRatePct: '暴击率',
  wallHpPct: '城墙上限', xpPct: '经验', goldPct: '金币', refund: '弹药回收',
  multishotAdd: '多重弹', pierceAdd: '穿透', critMultAdd: '暴击伤害', splashAdd: '溅射范围',
  burnDps: '燃烧', poisonDps: '中毒', frostSlow: '冰缓', chainCount: '闪电链',
  knockback: '击退', wallRegen: '修墙/秒', thorns: '反伤', shieldEvery: '护盾周期', magnet: '磁吸', aoeTargets: '索敌',
};
const PCT_KEYS = new Set(['damagePct', 'fireRatePct', 'bulletSpeedPct', 'critRatePct', 'wallHpPct', 'xpPct', 'goldPct', 'refund']);
function describe(info) {
  if (!info.mod) {
    return info.id === '__gold__' ? '金币奖励' : info.id === '__xp__' ? '经验加成' : info.id === '__heal__' ? '修复城墙' : '强化';
  }
  return Object.entries(info.mod).map(([k, v]) => {
    const label = MOD_LABELS[k] || k;
    return PCT_KEYS.has(k) ? `${label} +${Math.round(v * 100)}%` : `${label} +${v}`;
  }).join('，');
}

function buildSkillBar() {
  const bar = $('skill-bar'); bar.innerHTML = '';
  for (const id of ['nuke', 'freeze']) {
    const b = document.createElement('button'); b.className = 'skill-btn'; b.textContent = SKILLS[id].icon;
    b.addEventListener('click', () => game.useSkill(id));
    b.dataset.skill = id; bar.appendChild(b);
  }
}

function startLevel(index) { game.startLevel(index); }

// 按钮
BTN('btn-start', () => { populateLevelSelect(); game.state = 'levelselect'; });
BTN('btn-ls-back', () => { game.state = 'menu'; });
BTN('btn-resume', () => { game.state = 'playing'; });
BTN('btn-restart', () => startLevel(game.levelIndex));
BTN('btn-next', () => startLevel(Math.min(LEVELS.length - 1, game.levelIndex + 1)));
BTN('btn-retry', () => startLevel(game.levelIndex));
BTN('btn-go-menu', () => { game.state = 'menu'; });
BTN('btn-win-replay', () => startLevel(0));
BTN('btn-mute', () => {});

function populateLevelSelect() {
  const track = $('ls-track'); track.innerHTML = '';
  LEVELS.forEach((lv, i) => {
    const unlocked = (i + 1) <= save.unlockedLevel;
    const b = document.createElement('button');
    b.className = 'ls-node' + (unlocked ? '' : ' locked') + ((i === nextPlayableIndex(save, LEVELS.length)) ? ' next' : '');
    b.textContent = lv.boss ? '👑' : (i + 1); b.disabled = !unlocked;
    if (unlocked) b.addEventListener('click', () => startLevel(i));
    track.appendChild(b);
  });
}

let prev = null;
function syncDom() {
  showOverlay(game.state);
  if (game.state === 'cardpick' && prev !== 'cardpick') renderCards();
  // HUD
  if (game.wall) { $('wall-hp-bar').style.width = (game.wall.hp / game.wall.maxHp * 100) + '%'; $('wall-hp-text').textContent = Math.ceil(game.wall.hp); }
  if (game.xpNeed) { $('xp-bar').style.width = (game.xp / game.xpNeed * 100) + '%'; $('hero-lv').textContent = 'Lv.' + (game.heroLevel || 1); }
  for (const b of document.querySelectorAll('.skill-btn')) { const s = game.skillState && game.skillState[b.dataset.skill]; b.classList.toggle('cooling', !!(s && !s.ready)); }
  // 结算落库
  if (game.state !== prev && (game.state === 'levelclear' || game.state === 'win')) {
    save = applyClear(save, LEVELS[game.levelIndex].id, 3); browserWrite(save);
    if ($('menu-best')) $('menu-best').textContent = '🏆 已解锁第 ' + save.unlockedLevel + ' 关';
    if (game.state === 'levelclear') { if ($('lc-msg')) $('lc-msg').textContent = '🏆 已解锁第 ' + save.unlockedLevel + ' 关'; }
    if (game.state === 'win') { if ($('win-msg')) $('win-msg').textContent = '🎉 第一章全 10 关通关！继续守护废土！'; }
  }
  prev = game.state;
}

buildSkillBar();
if ($('menu-best')) $('menu-best').textContent = '🏆 已解锁第 ' + save.unlockedLevel + ' 关';

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045); last = now;
  game.update(dt);
  renderer.render(game, dt);
  syncDom();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
