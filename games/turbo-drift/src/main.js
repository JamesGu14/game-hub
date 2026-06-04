// games/turbo-drift/src/main.js
import { RENDER, RACE, AI, DRIFT, NITRO, ITEMS } from './config.js';
import { TRACKS, trackById } from './track.js';
import { CARS, carById, isUnlocked } from './cars.js';
import { loadSave, writeSave, applyResult } from './save.js';
import { stepPlayer, driftStep } from './player.js';
import { stepAI } from './ai.js';
import { progress, updateLap, place, RaceClock } from './race.js';
import { rollItem, applyHit, missileTarget } from './items.js';
import { readInput } from './input.js';
import { Renderer3D } from './render3d.js';
import { Audio } from './audio.js';
import { wrap, clamp } from './util/math.js';

const cv = document.getElementById('game');
const r3d = new Renderer3D(cv);
// HUD：叠在 3D 画布上的 2D 覆盖层（名次/圈/时间/漂移/氮气/道具/倒计时）
const hud = document.getElementById('hud');
const hctx = hud.getContext('2d');
let hudW = 0, hudH = 0;
function fitHud() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  hudW = hud.clientWidth; hudH = hud.clientHeight;
  hud.width = Math.floor(hudW * dpr); hud.height = Math.floor(hudH * dpr);
  hctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
new ResizeObserver(() => { r3d.resize(); fitHud(); }).observe(cv);
fitHud();

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

// 开发标定钩子（仅 ?debug）：暴露渲染器与状态给浏览器冒烟测试，生产环境零影响。
if (typeof location !== 'undefined' && new URLSearchParams(location.search).has('debug')) {
  window.__td = { get r3d() { return r3d; }, get state() { return state; }, trackById };
}

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
  state.player = { id: 'player', z: 900, x: 0, speed: 0, spinTimer: 0, shield: 0, hitGraceTimer: 0, steerAngle: 0, lap: 0, _prevZ: 900, color: car.color, car };
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
  r3d.setTrack(trackById(state.trackId));
  Audio.unlock(); Audio.startEngine();
  lastT = performance.now(); acc = 0;
}

let lastT = performance.now(), acc = 0;
const STEP = 1 / 60;
function loop(now) {
  const frameDt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  if (state.screen === 'racing') { acc += frameDt; while (acc >= STEP) { update(STEP); acc -= STEP; } }
  draw(frameDt);
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

  // 车-车碰撞（仅减速 + 横向弹开，永不出局；窗口放大避免高速穿模）
  const all = [state.player, ...state.ai];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const A = all[i], B = all[j];
    let dz = Math.abs(wrap(A.z, len) - wrap(B.z, len)); dz = Math.min(dz, len - dz);
    if (dz < 240 && Math.abs(A.x - B.x) < 0.42) {
      A.speed *= 0.88; B.speed *= 0.88;
      // 谁在左谁被推得更左，弹开避免重叠穿模
      const dir = A.x <= B.x ? 1 : -1;
      A.x = clamp(A.x - dir * 0.06, -0.95, 0.95);
      B.x = clamp(B.x + dir * 0.06, -0.95, 0.95);
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

function draw(dt) {
  if (state.player) {
    const track = trackById(state.trackId);
    const len = track.length;
    const racers = [state.player, ...state.ai].map(r => ({
      id: r.id, z: r.z, x: r.x, color: r.color, steerAngle: r.steerAngle, spinTimer: r.spinTimer,
    }));
    r3d.updateCars(racers);
    if (r3d.updateBoxes) r3d.updateBoxes(track, state.boxesTaken);
    r3d.follow(state.player, len, dt || 1 / 60);
    if (r3d.updateEffects) r3d.updateEffects(state, dt || 1 / 60);
    r3d.render();
  }
  drawHudOverlay();
}

const ITEM_EMOJI = { boost: '🚀', shield: '🛡️', oil: '🍌', shrink: '⚡', missile: '🎯' };

function drawHudOverlay() {
  hctx.clearRect(0, 0, hudW, hudH);
  if (!state.player || state.screen !== 'racing') return;
  const len = trackById(state.trackId).length;
  const pPlace = place([state.player, ...state.ai], len, 'player');
  const driftPct = state.drift.charge / DRIFT.maxCharge;
  const nitroPct = clamp(state.nitroTimer / NITRO_MAX, 0, 1);
  const item = state.item ? ITEM_EMOJI[state.item] : '';

  // 左上：名次 / 圈 / 时间（避开左上角 HUB 按钮，从 y=56 起）
  hctx.textAlign = 'left'; hctx.textBaseline = 'alphabetic';
  hctx.fillStyle = 'rgba(6,10,30,0.5)';
  roundRect(hctx, 14, 56, 196, 78, 12); hctx.fill();
  hctx.fillStyle = '#fff'; hctx.font = "bold 20px 'PingFang SC', system-ui";
  hctx.fillText(`🏁 第 ${pPlace}/${RACE.racers} 名`, 26, 84);
  hctx.font = "bold 16px 'PingFang SC', system-ui";
  hctx.fillText(`圈 ${Math.min(state.player.lap + 1, RACE.laps)}/${RACE.laps}`, 26, 110);
  hctx.fillText(`⏱ ${(state.clock.elapsedMs / 1000).toFixed(1)}s`, 112, 110);

  // 右上：漂移槽（金）/ 氮气条（青）/ 道具（避开右上角静音按钮，从 y=62 起）
  const bx = hudW - 186, bw = 172;
  drawBar(bx, 62, bw, 12, driftPct, '#ffd54f', '漂移 DRIFT');
  drawBar(bx, 88, bw, 12, nitroPct, '#00e5ff', '氮气 NITRO');
  if (item) { hctx.font = '32px system-ui'; hctx.textAlign = 'right'; hctx.fillText(item, hudW - 16, 138); hctx.textAlign = 'left'; }

  // 倒计时大字
  if (state.clock.phase === 'countdown') {
    const n = Math.ceil(state.clock.countdown);
    const txt = n > 0 ? String(n) : 'GO!';
    hctx.fillStyle = 'rgba(255,255,255,0.96)';
    hctx.strokeStyle = 'rgba(6,10,30,0.6)'; hctx.lineWidth = 7;
    hctx.textAlign = 'center'; hctx.textBaseline = 'middle';
    hctx.font = "900 96px 'PingFang SC', system-ui";
    hctx.strokeText(txt, hudW / 2, hudH / 2);
    hctx.fillText(txt, hudW / 2, hudH / 2);
    hctx.textAlign = 'left'; hctx.textBaseline = 'alphabetic';
  }
}

function drawBar(x, y, w, h, pct, color, label) {
  hctx.fillStyle = 'rgba(255,255,255,0.9)'; hctx.font = "bold 10px 'PingFang SC', system-ui";
  hctx.textAlign = 'left'; hctx.textBaseline = 'alphabetic'; hctx.fillText(label, x, y - 3);
  hctx.fillStyle = 'rgba(255,255,255,0.22)'; roundRect(hctx, x, y, w, h, 5); hctx.fill();
  hctx.fillStyle = color; roundRect(hctx, x, y, w * clamp(pct, 0, 1), h, 5); hctx.fill();
}

function roundRect(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
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
