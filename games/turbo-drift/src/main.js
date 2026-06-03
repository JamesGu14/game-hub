// games/turbo-drift/src/main.js
import { VIEW, RENDER, RACE, AI, DRIFT, NITRO, ITEMS } from './config.js';
import { TRACKS, trackById } from './track.js';
import { CARS, carById, isUnlocked } from './cars.js';
import { loadSave, writeSave, applyResult } from './save.js';
import { stepPlayer, driftStep } from './player.js';
import { stepAI } from './ai.js';
import { progress, updateLap, place, RaceClock } from './race.js';
import { rollItem, applyHit, missileTarget } from './items.js';
import { readInput } from './input.js';
import { render } from './render.js';
import { Audio } from './audio.js';
import { wrap, clamp } from './util/math.js';

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let scale = 1, offX = 0, offY = 0;
function fit() {
  cv.width = cv.clientWidth; cv.height = cv.clientHeight;
  scale = Math.min(cv.width / VIEW.W, cv.height / VIEW.H);
  offX = (cv.width - VIEW.W * scale) / 2; offY = (cv.height - VIEW.H * scale) / 2;
}
new ResizeObserver(fit).observe(cv); fit();

const storage = window.localStorage;
let save = loadSave(storage);
let muted = false;

const $ = id => document.getElementById(id);
const overlays = ['menu', 'garage', 'track', 'pause', 'finish'];
function show(name) { overlays.forEach(o => $(`overlay-${o}`).classList.toggle('show', o === name)); state.screen = name; }
function hideAll() { overlays.forEach(o => $(`overlay-${o}`).classList.remove('show')); }

const NITRO_MAX = NITRO.durationByTier[NITRO.durationByTier.length - 1];

const state = {
  screen: 'menu', carId: save.lastCar || 'lightning', trackId: 'track1',
  player: null, ai: [], clock: null, drift: { charge: 0, active: false },
  nitroTimer: 0, item: null, boxesTaken: new Set(), oilSlicks: [], finishedPlace: 0,
  pausePrev: false, itemPrev: false,
};

function buildGarage() {
  const grid = $('garage-cars'); grid.innerHTML = '';
  for (const c of CARS) {
    const unlocked = isUnlocked(c, save);
    const card = document.createElement('div');
    card.className = 'garage-card' + (unlocked ? '' : ' locked') + (c.id === state.carId ? ' sel' : '');
    card.innerHTML = `<div class="swatch" style="background:${c.color}"></div>
      <div><b>${c.name}</b></div>
      <div class="stat">极速 ${'★'.repeat(Math.round(c.top * 3))} 加速 ${'★'.repeat(Math.round(c.accel * 3))}</div>
      <div class="stat">${unlocked ? '' : '🔒 通关解锁'}</div>`;
    if (unlocked) card.onclick = () => { state.carId = c.id; buildGarage(); };
    grid.appendChild(card);
  }
}

function buildTrackList() {
  const grid = $('track-list'); grid.innerHTML = '';
  for (const t of TRACKS) {
    const card = document.createElement('div');
    card.className = 'garage-card' + (t.id === state.trackId ? ' sel' : '');
    const best = save.bestLap[t.id];
    card.innerHTML = `<div><b>${t.name}</b></div>
      <div class="stat">${t.id === 'track4' ? '❄️ 最难' : ''}</div>
      <div class="stat">${best ? '最佳 ' + (best / 1000).toFixed(1) + 's' : '未完成'}</div>`;
    card.onclick = () => { state.trackId = t.id; startRace(); };
    grid.appendChild(card);
  }
}

function startRace() {
  hideAll();
  const car = carById(state.carId);
  // 玩家略微领先起跑，3 个 AI 在身后正向错位（z 都 >= 0，保证 floor(z/len) 圈数正确）
  state.player = { id: 'player', z: 900, x: 0, speed: 0, spinTimer: 0, shield: 0, hitGraceTimer: 0, lap: 0, _prevZ: 900, color: car.color, car };
  const oppCars = CARS.filter(c => c.id !== car.id).slice(0, 3);
  state.ai = oppCars.map((c, i) => {
    const z = (2 - i) * 300; // 600 / 300 / 0，都在玩家身后但 >= 0
    return { id: 'ai' + i, z, x: (i - 1) * 0.4, speed: 0, spinTimer: 0, shield: 0, lap: 0, _prevZ: z,
      color: c.color, car: c, itemCooldown: 3 + i * 2 };
  });
  state.drift = { charge: 0, active: false }; state.nitroTimer = 0; state.item = null;
  state.boxesTaken = new Set(); state.oilSlicks = []; state.finishedPlace = 0;
  state.clock = new RaceClock(RACE.countdownSec);
  state.screen = 'racing';
  save.lastCar = state.carId; writeSave(storage, save);
  Audio.unlock(); Audio.startEngine();
  lastT = performance.now(); acc = 0;
}

let lastT = performance.now(), acc = 0;
const STEP = 1 / 60;
function loop(now) {
  const frameDt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (state.screen === 'racing') { acc += frameDt; while (acc >= STEP) { update(STEP); acc -= STEP; } }
  draw();
  requestAnimationFrame(loop);
}

function update(dt) {
  const track = trackById(state.trackId);
  const len = track.length;
  const input = readInput();

  if (input.pause && !state.pausePrev) { state.pausePrev = true; pause(); return; }
  state.pausePrev = input.pause;

  const phase = state.clock.tick(dt);
  if (phase === 'countdown') return;

  const pseg = wrap(Math.floor(state.player.z / RENDER.segLen), track.segs.length);
  const curve = track.segs[pseg].curve;
  const onRoad = Math.abs(state.player.x) < 1.1;

  // 漂移 → 氮气
  const dr = driftStep(state.drift, { drifting: input.drifting, steer: input.steer }, dt);
  if (dr.state.active && !state.drift.active) Audio.drift();
  state.drift = dr.state;
  if (dr.released && dr.released.nitroDur > 0) { state.nitroTimer = dr.released.nitroDur; Audio.nitro(); }
  const nitroOn = state.nitroTimer > 0; if (nitroOn) state.nitroTimer = Math.max(0, state.nitroTimer - dt);

  // 玩家物理
  const np = stepPlayer(state.player,
    { throttle: input.throttle, steer: input.steer, drifting: state.drift.active, nitro: nitroOn ? 1 : 0 },
    { car: state.player.car, curve, onRoad, assist: true }, dt);
  Object.assign(state.player, np);
  if (state.player.shield > 0) state.player.shield = Math.max(0, state.player.shield - dt);
  if (state.player.hitGraceTimer > 0) state.player.hitGraceTimer = Math.max(0, state.player.hitGraceTimer - dt);
  const lapBefore = state.player.lap;
  Object.assign(state.player, updateLap(state.player, len));
  if (state.player.lap > lapBefore) state.boxesTaken.clear();

  // 道具箱拾取
  for (const segIdx of track.itemBoxes) {
    const boxZ = segIdx * RENDER.segLen;
    if (!state.boxesTaken.has(segIdx) && !state.item &&
        Math.abs(wrap(state.player.z, len) - boxZ) < RENDER.segLen) {
      state.item = rollItem(Math.random); state.boxesTaken.add(segIdx); Audio.pickup();
    }
  }
  if (input.item && state.item && !state.itemPrev) useItem(state.item);
  state.itemPrev = input.item;

  // AI
  const playerProg = progress(state.player, len);
  for (const a of state.ai) {
    const aseg = wrap(Math.floor(a.z / RENDER.segLen), track.segs.length);
    const acurve = track.segs[aseg].curve;
    Object.assign(a, stepAI(a, { car: a.car, curve: acurve, onRoad: true,
      playerProgress: playerProg, aiProgress: progress(a, len) }, dt));
    if (a.shield > 0) a.shield = Math.max(0, a.shield - dt);
    Object.assign(a, updateLap(a, len));
    a.itemCooldown -= dt;
    if (a.itemCooldown <= 0 && Math.random() < AI.itemUseChance * dt * 6) {
      a.itemCooldown = 7;
      const tgt = missileTarget([state.player, ...state.ai], len, a.id);
      // 不去攻击正在打转 / 处于免疫窗口的玩家（避免对 7 岁连续针对）
      const skipPlayer = tgt === 'player' && (state.player.spinTimer > 0 || state.player.hitGraceTimer > 0);
      if (!skipPlayer) hitRacer(tgt, ITEMS.oil.spinDur);
    }
  }

  // 油渍
  for (const oil of state.oilSlicks) {
    for (const r of [state.player, ...state.ai]) {
      if (Math.abs(wrap(r.z, len) - oil.z) < 120 && Math.abs(r.x - oil.x) < 0.3) hitRacerObj(r, ITEMS.oil.spinDur);
    }
    oil.life -= dt;
  }
  state.oilSlicks = state.oilSlicks.filter(o => o.life > 0);

  // 车-车碰撞（仅减速 + 轻推，永不出局）
  const all = [state.player, ...state.ai];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const A = all[i], B = all[j];
    if (Math.abs(wrap(A.z, len) - wrap(B.z, len)) < 100 && Math.abs(A.x - B.x) < 0.28) {
      A.speed *= 0.93; B.speed *= 0.93;
      const push = A.x < B.x ? 0.02 : -0.02; A.x -= push; B.x += push;
    }
  }

  Audio.engine(clamp(state.player.speed / 12000, 0, 1.4));

  if (state.player.lap >= RACE.laps && !state.finishedPlace) finishRace();
}

function useItem(kind) {
  const len = trackById(state.trackId).length;
  if (kind === 'boost') { state.nitroTimer = Math.max(state.nitroTimer, ITEMS.boost.dur); Audio.nitro(); }
  else if (kind === 'shield') { state.player.shield = ITEMS.shield.dur; }
  else if (kind === 'oil') { state.oilSlicks.push({ z: wrap(state.player.z - 150, len), x: state.player.x, life: ITEMS.oil.life }); }
  else if (kind === 'shrink') { for (const a of state.ai) a.speed *= ITEMS.shrink.slowMul; }
  else if (kind === 'missile') { hitRacer(missileTarget([state.player, ...state.ai], len, 'player'), ITEMS.missile.spinDur); }
  state.item = null; Audio.pickup();
}

function hitRacer(id, dur) {
  if (!id) return;
  if (id === 'player') return hitRacerObj(state.player, dur);
  const a = state.ai.find(x => x.id === id); if (a) hitRacerObj(a, dur);
}
function hitRacerObj(r, dur) {
  // 玩家命中后短暂免疫，避免被连续针对（撞车/道具都走这里）
  if (r === state.player && state.player.hitGraceTimer > 0) return;
  const res = applyHit({ spinTimer: r.spinTimer || 0, shield: r.shield || 0 }, dur);
  r.spinTimer = res.spinTimer; r.shield = res.shield;
  if (res.spinTimer > 0) {
    Audio.hit();
    if (r === state.player) state.player.hitGraceTimer = 1.4;
  }
}

function finishRace() {
  const len = trackById(state.trackId).length;
  const p = place([state.player, ...state.ai], len, 'player');
  state.finishedPlace = p; state.screen = 'finish';
  Audio.stopEngine(); if (p <= 3) Audio.win();
  const lapMs = Math.round(state.clock.elapsedMs / RACE.laps);
  const prevUnlocked = new Set(save.unlocked);
  save = applyResult(save, state.trackId, p, lapMs); writeSave(storage, save);
  const newCar = save.unlocked.find(c => !prevUnlocked.has(c));
  $('finish-title').textContent = p === 1 ? '🏆 第一名！' : (p <= 3 ? '🎉 上台领奖！' : '😺 完赛啦！');
  $('finish-place').textContent = `第 ${p} / ${RACE.racers} 名 · 用时 ${(state.clock.elapsedMs / 1000).toFixed(1)}s`;
  $('finish-unlock').textContent = newCar ? `🔓 解锁新车：${carById(newCar).name}！` : '';
  show('finish');
}

function pause() { show('pause'); }
function resume() { hideAll(); state.screen = 'racing'; lastT = performance.now(); acc = 0; }

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!state.player) return;
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, offX, offY);
  ctx.beginPath(); ctx.rect(0, 0, VIEW.W, VIEW.H); ctx.clip();

  const track = trackById(state.trackId); const len = track.length;
  const baseSeg = wrap(Math.floor(state.player.z / RENDER.segLen), track.segs.length);
  const pZ = wrap(state.player.z, len);
  const aiSprites = state.ai.map(a => ({
    n: Math.round((wrap(a.z, len) - pZ + len) % len / RENDER.segLen), x: a.x, color: a.color,
  })).filter(s => s.n >= 0 && s.n < RENDER.drawDist);
  const boxes = track.itemBoxes.filter(b => !state.boxesTaken.has(b)).map(b => ({
    n: Math.round(((b * RENDER.segLen - pZ + len) % len) / RENDER.segLen), x: 0,
  })).filter(s => s.n >= 0 && s.n < RENDER.drawDist);

  const pPlace = place([state.player, ...state.ai], len, 'player');
  render(ctx, {
    track,
    cam: { x: 0, y: RENDER.camH + track.segs[baseSeg].worldY, z: state.player.z },
    player: { color: state.player.color, lateral: state.player.x, tilt: state.drift.active ? clamp(state.player.x * 0.4, -0.8, 0.8) : 0, nitro: state.nitroTimer > 0 },
    ai: aiSprites, boxes,
    hud: {
      place: pPlace, total: RACE.racers, lap: Math.min(state.player.lap + 1, RACE.laps), laps: RACE.laps,
      time: (state.clock.elapsedMs / 1000).toFixed(1), driftPct: state.drift.charge / DRIFT.maxCharge,
      nitroPct: clamp(state.nitroTimer / NITRO_MAX, 0, 1),
      item: state.item ? ({ boost: '🚀', shield: '🛡️', oil: '🍌', shrink: '⚡', missile: '🎯' })[state.item] : '',
    },
  });

  if (state.clock.phase === 'countdown') {
    const n = Math.ceil(state.clock.countdown);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 80px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(n > 0 ? n : 'GO!', VIEW.W / 2, VIEW.H / 2); ctx.textAlign = 'left';
  }
  ctx.restore();
}

// 浮层按钮
$('btn-play').onclick = () => { buildGarage(); show('garage'); };
$('btn-garage-go').onclick = () => { buildTrackList(); show('track'); };
$('btn-garage-back').onclick = () => show('menu');
$('btn-track-back').onclick = () => { buildGarage(); show('garage'); };
$('btn-resume').onclick = resume;
$('btn-restart').onclick = startRace;
$('btn-next').onclick = () => { buildTrackList(); show('track'); };
$('btn-finish-menu').onclick = () => { refreshMenu(); show('menu'); };
$('btn-mute').onclick = () => { muted = !muted; Audio.setMuted(muted); $('btn-mute').textContent = muted ? '🔇' : '🔊'; };
window.addEventListener('keydown', e => { if (e.key.toLowerCase() === 'm') $('btn-mute').click(); });

function refreshMenu() {
  const best = Object.entries(save.bestLap).map(([k, v]) => `${trackById(k)?.name || k} ${(v / 1000).toFixed(1)}s`).join(' · ');
  $('menu-best').textContent = `🏆 已解锁 ${save.unlocked.length}/4 车${best ? ' · ' + best : ''}`;
}
refreshMenu(); show('menu'); requestAnimationFrame(loop);
