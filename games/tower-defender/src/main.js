// main.js — 装配:读档 → 选关/游戏 屏幕状态机 → 循环(仅游戏态推进)→ 渲染 + 输入。仅 import 本游戏路径(自含铁律)。
import { BAL } from './data/balance.js';
import { LEVELS } from './data/levels.js';
import { preload } from './core/assets.js';
import * as audio from './core/audio.js';
import { newGameState } from './core/gameState.js';
import { makeLoop } from './core/gameLoop.js';
import { bus } from './core/eventBus.js';
import { browserLoad, browserWrite, applyClear, isUnlocked, nextPlayableIndex, resumeSnapshot, browserWriteResume, browserLoadResume, browserClearResume } from './core/save.js';
import { tryBuild, tryUpgrade, sellTower, upgradeCost } from './systems/economySystem.js';
import { rangeBonusFor } from './systems/terrainSystem.js';
import { drawBoard, drawWeather } from './render/board.js';
import { drawTower, drawEnemy, drawProjectile, drawFx } from './render/entityRenderer.js';
import { sortByY } from './render/ysort.js';
import { drawHud, hitHud, hudButtons, HUD_H } from './render/hud.js';
import { spawnFloat, spawnRing } from './render/fx.js';
import { drawBuildBar, hitBuildBar, buildBarLayout, HOTKEYS } from './ui/buildBar.js';
import { unlockedGenerals, newlyUnlocked } from './data/unlocks.js';
import { drawHeroCard } from './ui/heroCard.js';
import { hitTowerPanel, drawTowerPanel, cycleTowerMode } from './ui/towerPanel.js';
import { hitLevelSelect, drawLevelSelect } from './ui/levelSelect.js';
import { hitStoryCard, drawStoryCard } from './ui/storyCard.js';
import { CHAPTERS } from './data/campaign.js';
import { createTower } from './entities/tower.js';
import { hitResult, drawResult } from './ui/resultPanel.js';
import { GENERALS, towerStats } from './data/generals.js';
import { hitPause, drawPause } from './ui/pauseMenu.js';
import { button, panel, backdrop, vignette } from './ui/theme.js';


const C = BAL.CELL;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const bannerEl = document.getElementById('banner');

const view = { w: 0, h: 0, scale: 1, ox: 0, oy: 0 };
let state = null;
let save = null;
let screen = 'select';        // [P4/检查点A] 'select' | 'story' | 'playing'
let pendingLevel = -1;        // [检查点A] 故事屏待进关卡 index
let pendingResume = null;     // [检查点A] 该关 resume 快照（有则故事屏给续玩选项）
let storyReview = false;      // [检查点A] 「重看故事」复看模式（继续=回到当前对局，不重置）
let selectChapter = 0;        // [检查点A] 选关当前章 index
let recorded = false;         // [P4] 本局是否已写档(胜利只记一次)
let selected = 'liao';
let selectedTower = null;
let hover = null;
let hoverBuild = null;   // [检查点A] 建造栏悬停的将 id（→ 英雄卡浮窗）
let lastProjCount = 0;   // [P6] 弹道数量增量 → 开火音效探测
let sfxPhase = null;     // [P6] 相位切换 → 号角/胜/败音效探测
let unlockNotice = null;   // [spec §4] 本局通关新解锁的武将提示
let isFs = false;          // [全屏] 当前是否全屏(fullscreenchange 同步,驱动 ⛶ 高亮)

function towerAt(cell) {
  return state.towers.find((t) => t.slot.x === cell.x && t.slot.y === cell.y) || null;
}
function curIndex() { return LEVELS.indexOf(state.level); }

// [P4] 进关(原地换关,循环持同一 state 引用)。enterLevel 不校验解锁(供 retry/调试);startLevel 校验。
function enterLevel(n) {
  if (n < 0 || n >= LEVELS.length) return false;
  Object.assign(state, newGameState(LEVELS[n], { unlocked: unlockedGenerals(save) }));
  recorded = false; unlockNotice = null; selected = 'liao'; selectedTower = null;
  lastProjCount = 0; sfxPhase = state.phase;        // [P6] 复位音效追踪（prep→combat 起号角）
  resize(); screen = 'playing';
  audio.startBgm(audio.bgmTrackForLevel(state.level.id));   // [BGM] 按关号轮播 5 首史诗（(id-1)%5；文件未就绪程序乐兜底）
  return true;
}
// [检查点A] 选关 → 故事屏（有续玩则带选项）；校验解锁。
function startLevel(n) {
  if (!isUnlocked(save, n + 1)) return false;
  pendingLevel = n; storyReview = false;
  const snap = browserLoadResume();
  pendingResume = (snap && snap.levelId === LEVELS[n].id) ? snap : null;
  screen = 'story'; audio.stopBgm();
  return true;
}
function toSelect() { screen = 'select'; selectedTower = null; audio.stopBgm(); }

function investedFor(generalId, level) {
  let inv = GENERALS[generalId].cost;
  const tmp = { generalId, level: 1 };
  for (let L = 1; L < level; L++) { tmp.level = L; inv += upgradeCost(tmp); }
  return inv;
}

// 续玩：从快照恢复到「所在波的备战起点」（v1 不重建半场出兵，稳健）。
function applyResume(snap) {
  const n = LEVELS.findIndex((l) => l.id === snap.levelId);
  if (n < 0) return false;
  enterLevel(n);
  state.waveIndex = Math.max(0, Math.min(snap.waveIndex, state.level.waves.length - 1));
  state.gold = snap.gold;
  state.castleHp = Math.min(snap.castleHp, state.castleMaxHp);
  state.phase = 'prep'; state.prepTimer = BAL.PREP_SECONDS;
  state.enemies = []; state.activeSpawns = []; state.earlyRequested = false; state.allWavesEmitted = false;
  state.towers = (snap.towers || []).map((ts) => {
    const t = createTower(ts.generalId, ts.slot);
    t.level = ts.level; t.mode = ts.mode; t.totalInvested = investedFor(ts.generalId, ts.level);
    t.rangeBonus = rangeBonusFor(state.level, ts.slot);   // [地形] 按 slot 重算（快照零迁移）
    return t;
  });
  return true;
}
// 故事屏「继续/续上次/重头」路由。
function fromStory(act) {
  if (storyReview) { screen = 'playing'; storyReview = false; if (state.paused) state.paused = false; return; }
  if (act === 'resume' && pendingResume) { applyResume(pendingResume); browserClearResume(); screen = 'playing'; audio.startBgm(); }   // 续玩成功即清档（防下次/刷新读到旧波）
  else { browserClearResume(); enterLevel(pendingLevel); }   // continue / restart 都重头
  pendingResume = null;
}
// [检查点A] 退出对局即清续玩（退到选关/大厅=放弃）。
function leaveToSelect() { browserClearResume(); toSelect(); }

// —— [全屏] 标准 + webkit 前缀(iPad Safari/Chrome 同 WebKit 内核走前缀);不支持(如 iPhone)按钮隐藏 ——
const docEl = document.documentElement;
const fsSupported = () => !!(docEl.requestFullscreen || docEl.webkitRequestFullscreen);
const fsState = () => ({ supported: fsSupported(), active: isFs });
function toggleFullscreen() {
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  } else {
    const p = (docEl.requestFullscreen || docEl.webkitRequestFullscreen).call(docEl);
    if (p && p.catch) p.catch(() => { /* 用户/系统拒绝 → 保持原状,无需提示 */ });
  }
}
// 选关/故事屏没有 HUD,单独画右上角 ⛶(几何与 HUD 同源)。
function drawFsButton() {
  if (!fsSupported()) return;
  button(ctx, hudButtons(view).fs, { label: '⛶', variant: isFs ? 'jade' : 'wood', active: isFs });
}

const EARLY_BTN = () => ({ x: view.w / 2 - 80, y: HUD_H + 8, w: 160, h: 32 });

function resize() {
  view.w = canvas.width = window.innerWidth;
  view.h = canvas.height = window.innerHeight;
  const bw = state.level.cols * C, bh = state.level.rows * C;
  const TOP = HUD_H + 6, BOT = 76, availH = view.h - TOP - BOT;
  view.scale = Math.min(view.w / bw, availH / bh);
  view.ox = (view.w - bw * view.scale) / 2;
  view.oy = TOP + (availH - bh * view.scale) / 2;
}

function screenToCell(sx, sy) {
  const bx = (sx - view.ox) / view.scale, by = (sy - view.oy) / view.scale;
  return { x: Math.floor(bx / C), y: Math.floor(by / C) };
}
function slotAt(cell) {
  return state.level.slots.find((s) => s.x === cell.x && s.y === cell.y) || null;
}
function inBtn(b, sx, sy) { return sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h; }

function render(s) {
  // [P4] 选关屏:只画选关页
  if (screen === 'select') { drawLevelSelect(ctx, view, save, LEVELS, selectChapter); drawFsButton(); return; }
  if (screen === 'story') { drawStoryCard(ctx, view, LEVELS[pendingLevel], !!pendingResume); drawFsButton(); return; }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  backdrop(ctx, view.w, view.h);
  // [P5] 棋盘木框托盘（屏幕坐标，使战场与 UI 统一）
  const bpw = s.level.cols * C * view.scale, bph = s.level.rows * C * view.scale;
  panel(ctx, view.ox - 7, view.oy - 7, bpw + 14, bph + 14, { variant: 'wood', r: 8 });

  ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  drawBoard(ctx, s);

  if (hover) {
    const slot = slotAt(hover);
    if (slot && !s.towers.some((t) => t.slot.x === slot.x && t.slot.y === slot.y)) {
      const g = GENERALS[selected];
      ctx.strokeStyle = 'rgba(191,224,255,.5)'; ctx.fillStyle = 'rgba(191,224,255,.08)';
      ctx.lineWidth = 1.5; ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(slot.x * C + C / 2, slot.y * C + C / 2, (g.range + rangeBonusFor(state.level, slot)) * C, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // [检查点A] 选中塔：场上画攻击范围光圈（射程随等级）
  if (selectedTower && s.towers.includes(selectedTower)) {
    const sg = GENERALS[selectedTower.generalId];
    const srng = towerStats(sg, selectedTower.level).range + (selectedTower.rangeBonus || 0);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,210,77,.6)'; ctx.fillStyle = 'rgba(255,210,77,.08)';
    ctx.lineWidth = 1.5; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(selectedTower.px, selectedTower.py, srng * C, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
  }

  // [P6] y-sort：塔+敌按脚底 py 升序绘制（远→近遮挡）；弹道/特效仍最后。
  for (const ent of sortByY([...s.towers, ...s.enemies])) {
    if (ent.generalId != null) drawTower(ctx, ent, s.time);
    else drawEnemy(ctx, ent, s.time);
  }
  for (const p of s.projectiles) drawProjectile(ctx, p);
  for (const f of s.fx) drawFx(ctx, f);
  drawWeather(ctx, s);   // [地形] L50 大雨(板坐标系内、实体之上)

  // [P6] 音效探测（render 侧，不碰 core/sim）：开火=弹道增量；相位切换=号角/胜/败。
  if (s.projectiles.length > lastProjCount) audio.sfx('fire');
  lastProjCount = s.projectiles.length;
  if (s.phase !== sfxPhase) {
    if (s.phase === 'combat' && sfxPhase === 'prep') audio.sfx('horn');
    else if (s.phase === 'won') { audio.sfx('victory'); audio.stopBgm(); }
    else if (s.phase === 'lost') { audio.sfx('defeat'); audio.stopBgm(); }
    sfxPhase = s.phase;
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx, view.w, view.h);
  drawHud(ctx, s, view, fsState());
  drawBuildBar(ctx, s, view, selected);
  if (hoverBuild && !s.paused) drawHeroCard(ctx, view, hoverBuild, buildBarLayout(view, state).find((b) => b.id === hoverBuild));
  if (selectedTower && s.towers.includes(selectedTower)) drawTowerPanel(ctx, view, s, selectedTower);
  if (s.phase === 'prep') button(ctx, EARLY_BTN(), { label: '⚔ 提前出兵 ↵', variant: 'gold' });

  // [P4] 结算:胜利写档(一次)+ 结算面板
  if (s.phase === 'won' || s.phase === 'lost') {
    if (!recorded) {
      browserClearResume();                       // [检查点A] 胜/负先清续玩（防写档异常残留脏档）
      recorded = true;
      if (s.phase === 'won') {
        const prev = save.unlockedLevel;
        save = applyClear(save, s.level.id, s.stars); browserWrite(save);
        const ids = newlyUnlocked(prev, save.unlockedLevel);
        unlockNotice = ids.length ? '⚔️ 新武将来援:' + ids.map((id) => GENERALS[id].name).join('、') + '!' : null;
      }
    }
    drawResult(ctx, view, s, LEVELS.length, { unlockNotice });
  }

  // [P5] 暂停菜单（playing 且非结算时叠加渲染）
  if (s.paused && s.phase !== 'won' && s.phase !== 'lost') drawPause(ctx, view, s, save.settings.muted);
}

function onPointerDown(ev) {
  audio.init();                       // [P6] 首次手势解锁 AudioContext（幂等）
  const sx = ev.clientX, sy = ev.clientY;

  // [全屏] 任意屏右上角 ⛶ 优先消费(选关/故事/对局/结算/暂停均可用;pointerdown=用户手势,满足 API 要求)
  if (fsSupported() && hitHud(view, sx, sy) === 'fs') { toggleFullscreen(); audio.sfx('ui'); return; }

  // [P4] 选关屏
  if (screen === 'select') {
    const r = hitLevelSelect(view, save, LEVELS, selectChapter, sx, sy);
    if (r && r.kind === 'level') startLevel(r.index);
    else if (r && r.kind === 'chapter') selectChapter = Math.max(0, Math.min(CHAPTERS.length - 1, selectChapter + r.delta));
    return;
  }
  if (screen === 'story') {
    const act = hitStoryCard(view, !!pendingResume, sx, sy);
    if (act) fromStory(act);
    return;
  }
  // [P4] 结算屏(胜/负):仅响应结算按钮,消费其余点击
  if (state.phase === 'won' || state.phase === 'lost') {
    const act = hitResult(view, state, LEVELS.length, sx, sy);
    if (act === 'next') startLevel(curIndex() + 1);
    else if (act === 'retry') enterLevel(curIndex());
    else if (act === 'select') leaveToSelect();
    return;
  }

  // —— 游戏中 ——
  // [P5] HUD 可点 ⏸/⏩（木匾按钮，任何相位可点）
  const hud = hitHud(view, sx, sy);
  if (hud === 'pause') { state.paused = !state.paused; return; }
  if (hud === 'speed') { if (!state.paused) state.speed = state.speed === 1 ? 2 : 1; return; }
  // [P5] 暂停菜单优先消费（paused 时整屏拦截，防穿透建塔）
  if (state.paused) {
    const act = hitPause(view, sx, sy);
    if (act === 'resume') state.paused = false;
    else if (act === 'restart') { browserClearResume(); enterLevel(curIndex()); }
    else if (act === 'story') { storyReview = true; pendingLevel = curIndex(); pendingResume = null; screen = 'story'; }
    else if (act === 'select') { state.paused = false; leaveToSelect(); }
    else if (act === 'mute') { save.settings.muted = !save.settings.muted; audio.setMuted(save.settings.muted); browserWrite(save); audio.sfx('ui'); }
    else if (act === 'hub') { browserClearResume(); window.location.href = '../../index.html'; }
    return;
  }
  const pick = hitBuildBar(view, state, sx, sy);
  if (pick) { selected = pick; selectedTower = null; audio.sfx('ui'); return; }
  if (selectedTower && state.towers.includes(selectedTower)) {
    const act = hitTowerPanel(view, selectedTower, sx, sy);
    if (act === 'upgrade') {
      if (tryUpgrade(state, selectedTower)) {
        audio.sfx('upgrade');
        selectedTower.upgradedAt = state.time;   // [升级特效] 0.5s 金光弹跳(drawTower 读此时间戳)
        spawnRing(state, selectedTower.px, selectedTower.py, '#ffd24d', C * 0.95, 0.5);
        spawnFloat(state, selectedTower.px, selectedTower.py - C * 1.3, 'L' + selectedTower.level + '!', '#ffd24d');
      }
      return;
    }
    if (act === 'sell') { sellTower(state, selectedTower); audio.sfx('sell'); selectedTower = null; return; }
    if (act === 'mode') { cycleTowerMode(selectedTower); audio.sfx('ui'); return; }
    if (act === 'panel') return;
  }
  if (state.phase === 'prep' && inBtn(EARLY_BTN(), sx, sy)) { state.earlyRequested = true; return; }
  const cell = screenToCell(sx, sy);
  const t = towerAt(cell);
  if (t) { selectedTower = t; return; }
  selectedTower = null;
  const slot = slotAt(cell);
  if (slot && tryBuild(state, slot, selected)) audio.sfx('build');
}

function onPointerMove(ev) {
  hover = screenToCell(ev.clientX, ev.clientY);
  hoverBuild = (screen === 'playing' && !state.paused && state.phase !== 'won' && state.phase !== 'lost')
    ? hitBuildBar(view, state, ev.clientX, ev.clientY) : null;
}

function onKey(ev) {
  audio.init();                                           // [P6] 键盘也算手势，解锁音频
  if (screen !== 'playing') return;                       // 选关/结算屏忽略游戏热键
  if (state.phase === 'won' || state.phase === 'lost') {
    if (ev.key === 'Escape') toSelect();
    return;
  }
  if (ev.code === 'Space') { state.paused = !state.paused; ev.preventDefault(); }
  else if (ev.key === 'f' || ev.key === 'F') { state.speed = state.speed === 1 ? 2 : 1; }
  else if (ev.key === 'Enter') { if (state.phase === 'prep') state.earlyRequested = true; }
  else if (ev.key === 'Escape') { if (selectedTower) selectedTower = null; else state.paused = !state.paused; }
  else if (HOTKEYS[ev.key.toLowerCase()]) {
    const id = HOTKEYS[ev.key.toLowerCase()];
    if (!state.unlocked || state.unlocked.has(id)) { selected = id; selectedTower = null; }
  }
  else if (ev.key === '[') { const i = curIndex(); if (i > 0) enterLevel(i - 1); }   // 调试切关
  else if (ev.key === ']') { const i = curIndex(); if (i < LEVELS.length - 1) enterLevel(i + 1); }
}

async function boot() {
  await preload();
  save = browserLoad();
  audio.setMuted(save.settings.muted);                                    // [P6] 应用持久化静音（ctx 懒建后生效）
  state = newGameState(LEVELS[nextPlayableIndex(save, LEVELS.length)], { unlocked: unlockedGenerals(save) });   // 预建有效 state(供 resize/loop)
  resize();
  screen = 'select';
  if (bannerEl) bannerEl.classList.remove('show');   // 改用 resultPanel,不再用 #banner

  // 调试/QA 钩子:读状态、模拟操作、切关/选关、读档。
  window.__td = {
    get state() { return state; },
    get view() { return view; },
    get screen() { return screen; },
    getSave() { return save; },
    build(cx, cy, id = selected) { const s = state.level.slots.find((p) => p.x === cx && p.y === cy); return s ? tryBuild(state, s, id) : false; },
    upgrade(cx, cy) { const t = towerAt({ x: cx, y: cy }); return t ? tryUpgrade(state, t) : false; },
    sell(cx, cy) { const t = towerAt({ x: cx, y: cy }); return t ? sellTower(state, t) : 0; },
    setMode(cx, cy, m) { const t = towerAt({ x: cx, y: cy }); if (t) t.mode = m; return !!t; },
    select(id) { selected = id; },
    setGold(n) { state.gold = n; },
    loadLevel(n) { return enterLevel(n); },     // 调试:直接进任意关(不校验解锁)
    toSelect,
    showStory(n) { return startLevel(n); },
    getResume() { return browserLoadResume(); },
    fromStory,
    setChapter(i) { selectChapter = Math.max(0, Math.min(CHAPTERS.length - 1, i)); },
    get pendingResume() { return pendingResume; },
    early() { if (state.phase === 'prep') state.earlyRequested = true; },
    setSpeed(n) { state.speed = n; },
  };
  bus.on('enemyKilled', ({ enemy }) => { spawnFloat(state, enemy.px, enemy.py, '+' + enemy.gold); audio.sfx('kill'); });
  bus.on('castleDamaged', () => audio.sfx('cityHit'));   // [P6] 成都受创警示音

  window.addEventListener('resize', resize);
  // [全屏] 进/退全屏同步 ⛶ 高亮并重排画布(含 ESC 退出/系统手势退出)
  const onFsChange = () => { isFs = !!(document.fullscreenElement || document.webkitFullscreenElement); resize(); };
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  window.addEventListener('keydown', onKey);

  const loop = makeLoop(state, render, () => screen === 'playing');   // [P4] 仅游戏态推进模拟
  document.addEventListener('visibilitychange', loop.onVisible);
  // [检查点A] 中断续玩：游戏中（非结算）切后台/关页 → 写快照。
  function persistResume() {
    if (screen === 'playing' && (state.phase === 'prep' || state.phase === 'combat')) {
      browserWriteResume(resumeSnapshot(state));
    }
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) persistResume(); });
  window.addEventListener('beforeunload', persistResume);
  loop.start();
}

boot();
