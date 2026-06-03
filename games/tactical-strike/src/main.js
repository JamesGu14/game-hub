// main.js — game integration
import {
  initScene, getScene, getCamera, getRenderer,
  setMapBoundingBoxes, getMapBoundingBoxes, gameLoop,
} from './engine/scene.js';
import { buildMap } from './engine/map.js';

import { initCamera, getYawPitch, setSensitivityScale } from './player/camera.js';
import {
  initPlayer, updatePlayer, getPlayerState, takeDamage as playerTakeDamage,
} from './player/player.js';
import * as weaponsMod from './player/weapons.js';
import {
  WEAPONS, initLoadout, switchToSlot, getActiveSlot, getLoadout,
  getActiveWeapon, shoot, reload, updateWeapons, getWeaponState,
  getMoney, addMoney, spendMoney, buyAmmoForSlot,
} from './player/weapons.js';

import {
  initBots, updateBots, resetBots, getAliveCount, getBotMeshes,
  damageBotByMesh,
} from './ai/botManager.js';

import {
  updateHUD, startTimer, stopTimer, setRound, showHUD,
} from './ui/hud.js';
import {
  showMainMenu, hideMainMenu,
  showDeathScreen, hideDeathScreen,
  showWinScreen, hideWinScreen,
  updateKillFeed,
} from './ui/screens.js';
import { initBuyMenu, showBuyMenu, hideBuyMenu, isOpen as isBuyMenuOpen, setOnBuy } from './ui/buyMenu.js';

import * as audio from './audio/audio.js';
import { MONEY, COMBAT } from './constants.js';
import {
  initHitFeedback, showHitMarker, spawnDamageNumber, updateHitFeedback,
} from './ui/hitFeedback.js';
import { spawnHitSparks } from './engine/effects.js';
import { initMinimap, renderMinimap } from './ui/minimap.js';
import {
  initViewmodel, setActiveViewmodel, triggerMuzzleFlash, updateViewmodel, setScoped,
  triggerKnifeSlash, triggerRecoil, triggerReload,
} from './player/viewmodel.js';

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const ROUND_SECONDS = 90;
const BUY_PHASE_SECONDS = 15;
let roundNumber = 1;
let gameActive = false;
let playerFaction = 'CT';
let opposingFaction = 'T';
let difficulty = 'normal';
let mapData = null;
let playerSpawnList = [];
let buyPhaseUntil = 0;

const inputState = {
  forward: false, back: false, left: false, right: false,
  sprint: false, shoot: false, jump: false, crouch: false,
};

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function boot() {
  initScene();
  const renderer = getRenderer();
  initCamera(renderer.domElement);
  initViewmodel(getCamera());
  getScene().add(getCamera());

  mapData = buildMap(getScene());
  setMapBoundingBoxes(mapData.boundingBoxes);
  initMinimap(mapData.boundingBoxes);

  playerSpawnList = [
    ...mapData.spawnPoints.ct.map(p => ({ faction: 'CT', position: p })),
    ...mapData.spawnPoints.t.map(p =>  ({ faction: 'T',  position: p })),
  ];

  // Buy menu wiring
  initBuyMenu(weaponsMod);
  setOnBuy((weaponKey, slot) => {
    switchToSlot(slot);
    setActiveViewmodel(getActiveWeapon()?.type || 'pistol');
    updateHUDFromState();
    updateMoneyDisplay();
  });

  bindInput();
  bindGameEvents();
  bindFullscreenButton();
  bindEndScreenClicks();
  bindPointerLock();
  initHitFeedback();
  startLoop();
  showMainMenu(onStartGame);
}

function bindPointerLock() {
  getRenderer().domElement.addEventListener('click', () => {
    if (gameActive && !isBuyMenuOpen()) {
      getRenderer().domElement.requestPointerLock?.();
    }
  });
}

function bindEndScreenClicks() {
  const d = document.getElementById('death-screen');
  const w = document.getElementById('win-screen');
  function handler(e) {
    e.stopPropagation();
    if (_isEndScreenVisible()) nextRound();
  }
  if (d) d.addEventListener('click', handler);
  if (w) w.addEventListener('click', handler);
}

function bindFullscreenButton() {
  const btn = document.getElementById('btn-fullscreen');
  if (!btn) return;
  function isFs() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function syncLabel() { btn.classList.toggle('is-fullscreen', isFs()); }
  function toggle() {
    if (isFs()) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      const el = document.documentElement;
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  }
  btn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyF' && !e.repeat && !e.ctrlKey && !e.metaKey) toggle();
  });
  document.addEventListener('fullscreenchange', syncLabel);
  document.addEventListener('webkitfullscreenchange', syncLabel);
}

// ---------------------------------------------------------------------------
// Round lifecycle
// ---------------------------------------------------------------------------
function onStartGame(faction, diff) {
  audio.initAudio();
  audio.setVolume(0.6);
  playerFaction   = faction;
  opposingFaction = faction === 'CT' ? 'T' : 'CT';
  difficulty      = diff;
  roundNumber     = 1;
  hideMainMenu();
  showHUD();
  initLoadout();
  beginRound();
}

function beginRound() {
  setRound(roundNumber);
  hideDeathScreen();
  hideWinScreen();
  const tut = document.getElementById('tutorial-hint');
  if (tut) tut.classList.toggle('hidden', difficulty !== 'tutorial');

  resetBots();
  initPlayer(playerFaction, playerSpawnList);
  // Reload all weapons (refill ammo)
  // (initLoadout would also reset money; do not call here past round 1)
  initBots(null, difficulty, opposingFaction, onPlayerHitByBot);

  // Sync viewmodel to active weapon
  const w = getActiveWeapon();
  if (w) setActiveViewmodel(w.type);

  startTimer(ROUND_SECONDS, onTimerExpire);
  updateHUDFromState();
  updateMoneyDisplay();

  // Buy phase: open menu for first BUY_PHASE_SECONDS
  buyPhaseUntil = performance.now() + BUY_PHASE_SECONDS * 1000;
  showBuyMenu();

  gameActive = true;
}

function nextRound() {
  roundNumber += 1;
  beginRound();
}

// ---------------------------------------------------------------------------
// Damage / kill callbacks
// ---------------------------------------------------------------------------
function onPlayerHitByBot(damage, isHeadshot) {
  // Reduce damage if crouched
  const p = getPlayerState();
  const finalDamage = p.isCrouched ? damage * COMBAT.CROUCH_DAMAGE_MULT : damage;
  playerTakeDamage(finalDamage, isHeadshot);
  updateHUDFromState();
  _flashHitVignette();
}

function _flashHitVignette() {
  const v = document.getElementById('hit-vignette');
  if (!v) return;
  v.classList.add('flash');
  setTimeout(() => v.classList.remove('flash'), 120);
}

function _flashBotHit(meshRoot) {
  // Bot materials are pooled via _sharedMats — mutating .color would tint
  // every other bot that shares the same material. Clone-on-first-flash so
  // each bot owns its own material thereafter.
  meshRoot.traverse((c) => {
    if (c.isMesh && c.material && c.material.color) {
      if (!c.userData._ownsMaterial) {
        c.material = c.material.clone();
        c.userData._ownsMaterial = true;
      }
      if (c.userData._origColor == null) c.userData._origColor = c.material.color.getHex();
      c.material.color.setHex(0xff3030);
    }
  });
  setTimeout(() => {
    meshRoot.traverse((c) => {
      if (c.isMesh && c.material && c.material.color && c.userData._origColor != null) {
        c.material.color.setHex(c.userData._origColor);
      }
    });
  }, 120);
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
function bindInput() {
  window.addEventListener('keydown', (e) => {
    // Allow buy menu to close even when game active
    if (e.code === 'KeyB') {
      if (gameActive) {
        if (isBuyMenuOpen()) hideBuyMenu();
        else if (performance.now() < buyPhaseUntil) showBuyMenu();
      }
      return;
    }
    if (e.code === 'Escape' && isBuyMenuOpen()) {
      hideBuyMenu();
      return;
    }
    // Don't capture movement keys when buy menu is open
    // Buy ammo hotkeys (allowed while menu is open)
    if (e.code === 'Comma' || e.code === 'Period') {
      const slot = e.code === 'Comma' ? 1 : 2;
      if (gameActive && performance.now() < buyPhaseUntil) {
        if (buyAmmoForSlot(slot)) {
          import('./audio/audio.js').then(a => a.playReload && a.playReload());
          updateHUDFromState();
          updateMoneyDisplay();
        }
      }
      return;
    }

    if (isBuyMenuOpen()) return;

    switch (e.code) {
      case 'KeyW': inputState.forward = true; break;
      case 'KeyS': inputState.back    = true; break;
      case 'KeyA': inputState.left    = true; break;
      case 'KeyD': inputState.right   = true; break;
      case 'ShiftLeft':
      case 'ShiftRight': inputState.sprint = true; break;
      case 'ControlLeft':
      case 'ControlRight': inputState.crouch = true; e.preventDefault(); break;
      case 'Space':
        if (gameActive) {
          inputState.jump = true;
          e.preventDefault();
        } else if (_isEndScreenVisible() || getAliveCount() === 0) {
          nextRound();
        }
        break;

      case 'Digit1':
      case 'Digit2':
      case 'Digit3': {
        if (!gameActive) break;
        const slot = Number(e.code.slice(-1)) - 1;
        if (slot === 2 && !getLoadout()[2]) break;
        switchToSlot(slot);
        setActiveViewmodel(getActiveWeapon()?.type);
        updateHUDFromState();
        break;
      }

      case 'KeyR': {
        if (_isEndScreenVisible() || (!gameActive && !getPlayerState().alive)) {
          nextRound();
        } else if (gameActive) {
          const wasReloading = getWeaponState().isReloading;
          reload();
          const w = getWeaponState();
          if (!wasReloading && w.isReloading) {
            const aw = getActiveWeapon();
            const ms = aw?.reloadMs || 1500;
            triggerReload(w.type, ms / 1000);
          }
          updateHUDFromState();
        }
        break;
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'KeyW': inputState.forward = false; break;
      case 'KeyS': inputState.back    = false; break;
      case 'KeyA': inputState.left    = false; break;
      case 'KeyD': inputState.right   = false; break;
      case 'ShiftLeft':
      case 'ShiftRight': inputState.sprint = false; break;
      case 'ControlLeft':
      case 'ControlRight': inputState.crouch = false; break;
      case 'Space': inputState.jump = false; break;
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (isBuyMenuOpen()) return;
    if (e.button === 0) inputState.shoot = true;
    if (e.button === 2) {
      const w = getActiveWeapon();
      if (!w) return;
      if (w.type === 'sniper') {
        const fov = typeof w.scopeFov === 'number' ? w.scopeFov : 20;
        setScoped(true, fov);
        setSensitivityScale(fov / 75);
      } else if (w.type === 'knife') {
        // Right-click knife = single attack swing
        inputState.knifeAttack = true;
      }
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) inputState.shoot = false;
    if (e.button === 2) {
      setScoped(false);
      setSensitivityScale(1);
      inputState.knifeAttack = false;
    }
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
}

// ---------------------------------------------------------------------------
// Game events
// ---------------------------------------------------------------------------
function _isEndScreenVisible() {
  const d = document.getElementById('death-screen');
  const w = document.getElementById('win-screen');
  const dShown = d && !d.classList.contains('hidden');
  const wShown = w && !w.classList.contains('hidden');
  return dShown || wShown;
}

function bindGameEvents() {
  window.addEventListener('playerKilledBot', (e) => {
    const enemyFaction = e.detail?.faction || opposingFaction;
    updateKillFeed('You', 'Enemy', playerFaction, enemyFaction);
    audio.playHitMarker();
    addMoney(MONEY.KILL_BOUNTY);
    updateMoneyDisplay();
  });
  window.addEventListener('allBotsDefeated', () => {
    if (!gameActive) return;
    gameActive = false;
    stopTimer();
    audio.playRoundWin();
    addMoney(MONEY.ROUND_WIN);
    showWinScreen();
    document.exitPointerLock?.();
  });
  window.addEventListener('playerDied', () => {
    if (!gameActive) return;
    gameActive = false;
    stopTimer();
    audio.playDeath();
    addMoney(MONEY.CONSOLATION);
    showDeathScreen();
    document.exitPointerLock?.();
  });
}

function onTimerExpire() {
  if (!gameActive) return;
  if (getAliveCount() > 0) {
    gameActive = false;
    audio.playRoundLose();
    addMoney(MONEY.TIMER_LOSS);
    showDeathScreen();
    document.exitPointerLock?.();
  }
}

// ---------------------------------------------------------------------------
// HUD sync
// ---------------------------------------------------------------------------
function updateHUDFromState() {
  const p = getPlayerState();
  const w = getWeaponState();
  updateHUD({
    hp: p.hp,
    armor: p.armor,
    currentAmmo: w.currentAmmo < 0 ? '∞' : w.currentAmmo,
    reserveAmmo: w.reserveAmmo < 0 ? '—' : w.reserveAmmo,
    weaponName: `${w.name} [${w.slot + 1}]`,
    isReloading: !!w.isReloading,
  });
}

function updateMoneyDisplay() {
  const el = document.getElementById('buy-money');
  if (el) el.textContent = getMoney();
}

// ---------------------------------------------------------------------------
// Game loop
// ---------------------------------------------------------------------------
function update(dt) {
  if (!gameActive) return;

  // Auto-close buy menu after buy phase ends
  if (isBuyMenuOpen() && performance.now() > buyPhaseUntil) {
    hideBuyMenu();
    // Do not request pointer lock automatically on timeout, it throws WrongDocumentError
    // getRenderer().domElement.requestPointerLock?.();
  }

  // If buy menu is open, freeze player movement but still update bots passively
  const mapBoxes = getMapBoundingBoxes();
  if (!isBuyMenuOpen()) {
    updatePlayer(dt, inputState, mapBoxes);
    // Consume jump (one-shot per press)
    inputState.jump = false;
  }
  if (updateWeapons(performance.now())) {
    updateHUDFromState();
  }

  // Treat knife right-click as an attack too
  const wantShoot = (inputState.shoot || inputState.knifeAttack) && !isBuyMenuOpen();
  if (wantShoot) {
    const camera = getCamera();
    const botMeshes = getBotMeshes();
    const prevAmmo = getWeaponState().currentAmmo;
    const result = shoot(camera, botMeshes);
    const newAmmo = getWeaponState().currentAmmo;
    if (result.weaponType && result.weaponType !== 'knife' && newAmmo < prevAmmo) {
      triggerMuzzleFlash();
      triggerRecoil(result.weaponType);
    }
    if (result.weaponType === 'knife') {
      triggerKnifeSlash();
    }
    if (result.hit && result.hitObject) {
      let root = result.hitObject;
      while (root.parent && !root.userData.isBot) root = root.parent;
      if (root.userData.isBot) {
        const w = getActiveWeapon();
        const dmg = result.isHeadshot ? 9999 : (w?.damage || 0);
        _flashBotHit(root);
        damageBotByMesh(root, dmg);
        const shownDmg = result.isHeadshot ? (w?.damage || 0) * (w?.headshotMult || 2) : dmg;
        showHitMarker(result.isHeadshot);
        spawnDamageNumber(result.hitPoint, shownDmg, result.isHeadshot);
        spawnHitSparks(result.hitPoint, result.isHeadshot);
      }
    }
    updateHUDFromState();
  }

  const playerPos = getPlayerState().position;
  updateBots(dt, playerPos, mapBoxes);

  const isMoving = inputState.forward || inputState.back || inputState.left || inputState.right;
  updateViewmodel(dt, isMoving, inputState.sprint);
}

function render() {
  if (!gameActive) return;
  const p = getPlayerState();
  const { yaw } = getYawPitch();
  renderMinimap(p.position, yaw, playerFaction, getBotMeshes(), opposingFaction);
  updateHitFeedback(getCamera());
}

function startLoop() {
  gameLoop(update, render);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
