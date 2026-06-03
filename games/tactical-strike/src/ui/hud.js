/**
 * hud.js — HUD DOM update helpers
 * Manages health bar, ammo display, countdown timer, round counter, visibility.
 */

// ---- Module state --------------------------------------------------------
let timerSeconds = 0;
let timerInterval = null;
let timerCallback = null;

// Cache previous state to prevent redundant DOM updates
const _lastState = {
  hp: null,
  armor: null,
  currentAmmo: null,
  reserveAmmo: null,
  weaponName: null,
  isReloading: null,
};

// ---- DOM references (resolved lazily so module can load before DOM) ------
const el = (id) => document.getElementById(id);

// ---- Health fill color thresholds ----------------------------------------
function _healthColor(hp) {
  if (hp > 60) return '#4caf7d';
  if (hp > 30) return '#e8a838';
  return '#e84b4b';
}

// ---- Timer formatting ----------------------------------------------------
function _formatTime(secs) {
  const m = Math.floor(Math.max(0, secs) / 60).toString().padStart(2, '0');
  const s = (Math.max(0, secs) % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ==========================================================================
// Exports
// ==========================================================================

/**
 * Update HUD elements from current game state.
 * @param {{ hp: number, armor: number, currentAmmo: number, reserveAmmo: number, weaponName?: string }} state
 */
export function updateHUD({ hp = 100, armor = 0, currentAmmo = 0, reserveAmmo = 0, weaponName = '', isReloading = false } = {}) {
  // Health
  if (_lastState.hp !== hp) {
    _lastState.hp = hp;
    const fill = el('hud-health-fill');
    if (fill) {
      const clampedHp = Math.max(0, Math.min(100, hp));
      fill.style.width = `${clampedHp}%`;
      fill.style.background = _healthColor(clampedHp);
    }
    const healthNum = el('hud-health-num');
    if (healthNum) healthNum.textContent = Math.max(0, Math.round(hp));
  }

  // Armor
  if (_lastState.armor !== armor) {
    _lastState.armor = armor;
    const armorEl = el('hud-armor');
    if (armorEl) armorEl.textContent = Math.max(0, Math.round(armor));
  }

  // Weapon name
  if (_lastState.weaponName !== weaponName) {
    _lastState.weaponName = weaponName;
    const weaponIconEl = el('hud-weapon-icon');
    if (weaponIconEl && weaponName) weaponIconEl.textContent = weaponName;
  }

  // Current ammo (with reload indicator)
  if (_lastState.currentAmmo !== currentAmmo || _lastState.isReloading !== isReloading) {
    _lastState.currentAmmo = currentAmmo;
    _lastState.isReloading = isReloading;
    const currEl = el('hud-ammo-current');
    if (currEl) {
      if (isReloading) {
        currEl.textContent = '↻';
        currEl.classList.add('reloading');
        currEl.classList.remove('low');
      } else {
        currEl.textContent = currentAmmo;
        currEl.classList.remove('reloading');
        if (typeof currentAmmo === 'number' && currentAmmo <= 5) {
          currEl.classList.add('low');
        } else {
          currEl.classList.remove('low');
        }
      }
    }
  }

  // Reserve ammo
  if (_lastState.reserveAmmo !== reserveAmmo) {
    _lastState.reserveAmmo = reserveAmmo;
    const resEl = el('hud-ammo-reserve');
    if (resEl) resEl.textContent = reserveAmmo;
  }
}

/**
 * Start the countdown timer.
 * @param {number}   seconds   Initial seconds count.
 * @param {Function} onExpire  Called when the timer reaches 0.
 */
export function startTimer(seconds, onExpire) {
  stopTimer();
  timerSeconds = seconds;
  timerCallback = onExpire || null;

  const timerEl = el('hud-timer');
  if (timerEl) timerEl.textContent = _formatTime(timerSeconds);

  timerInterval = setInterval(() => {
    timerSeconds -= 1;
    if (timerEl) timerEl.textContent = _formatTime(timerSeconds);

    if (timerSeconds <= 0) {
      stopTimer();
      if (typeof timerCallback === 'function') timerCallback();
    }
  }, 1000);
}

/** Return seconds remaining on the current timer. */
export function getTimeRemaining() {
  return timerSeconds;
}

/** Stop the countdown without firing onExpire. */
export function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

/**
 * Update the round display.
 * @param {number} n  Round number.
 */
export function setRound(n) {
  const roundEl = el('hud-round');
  if (roundEl) roundEl.textContent = `Round ${n}`;
}

/** Make the HUD visible. */
export function showHUD() {
  const hud = el('hud');
  if (hud) hud.classList.remove('hidden');
}

/** Hide the HUD. */
export function hideHUD() {
  const hud = el('hud');
  if (hud) hud.classList.add('hidden');
}
