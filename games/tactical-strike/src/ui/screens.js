/**
 * screens.js — Menu, death/win overlays, and kill-feed management.
 */

// ---- Module state --------------------------------------------------------
let selectedFaction   = 'CT';
let selectedDifficulty = 'normal';

const MAX_KILLFEED_ENTRIES = 5;
const KILLFEED_LIFETIME_MS = 4000;

// ---- DOM helpers ---------------------------------------------------------
const el  = (id)  => document.getElementById(id);
const els = (sel) => document.querySelectorAll(sel);

// ---- Session-storage keys ------------------------------------------------
const SK_FACTION    = 'sg_faction';
const SK_DIFFICULTY = 'sg_difficulty';

// ==========================================================================
// Faction selection
// ==========================================================================

function _applyFactionHighlight() {
  const ctCard = el('faction-ct');
  const tCard  = el('faction-t');
  if (!ctCard || !tCard) return;

  ctCard.classList.remove('selected-ct');
  tCard.classList.remove('selected-t');

  if (selectedFaction === 'CT') {
    ctCard.classList.add('selected-ct');
  } else {
    tCard.classList.add('selected-t');
  }
}

function _restoreSelections() {
  const savedFaction = sessionStorage.getItem(SK_FACTION);
  const savedDiff    = sessionStorage.getItem(SK_DIFFICULTY);

  if (savedFaction) selectedFaction = savedFaction;
  if (savedDiff)    selectedDifficulty = savedDiff;

  _applyFactionHighlight();

  // Restore radio button
  const radios = els('input[name="difficulty"]');
  radios.forEach((r) => {
    r.checked = (r.value === selectedDifficulty);
  });
}

// ==========================================================================
// Exports
// ==========================================================================

/**
 * Show the main menu and wire up all interactivity.
 * @param {Function} onStart  Called with (faction, difficulty) when the player starts.
 */
export function showMainMenu(onStart) {
  const menu = el('main-menu');
  if (!menu) return;

  // Restore previous selections from sessionStorage
  _restoreSelections();

  // Faction card click - using direct IDs for reliability
  const ctBtn = el('faction-ct');
  const tBtn  = el('faction-t');
  
  if (ctBtn) {
    ctBtn.onclick = () => {
      selectedFaction = 'CT';
      _applyFactionHighlight();
    };
  }
  if (tBtn) {
    tBtn.onclick = () => {
      selectedFaction = 'T';
      _applyFactionHighlight();
    };
  }

  // Difficulty radio change
  const radios = els('input[name="difficulty"]');
  radios.forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) selectedDifficulty = radio.value;
    });
  });

  // Start button
  const btnStart = el('btn-start');
  if (btnStart) {
    // Clone to remove any previous listeners
    const fresh = btnStart.cloneNode(true);
    btnStart.parentNode.replaceChild(fresh, btnStart);

    fresh.addEventListener('click', () => {
      sessionStorage.setItem(SK_FACTION,    selectedFaction);
      sessionStorage.setItem(SK_DIFFICULTY, selectedDifficulty);
      hideMainMenu();
      if (typeof onStart === 'function') onStart(selectedFaction, selectedDifficulty);
    });
  }

  menu.classList.remove('hidden');
  menu.style.display = '';
}

/** Hide the main menu. */
export function hideMainMenu() {
  const menu = el('main-menu');
  if (menu) {
    menu.style.display = 'none';
  }
}

/** Show the death overlay. */
export function showDeathScreen() {
  const s = el('death-screen');
  if (s) s.classList.remove('hidden');
}

/** Hide the death overlay. */
export function hideDeathScreen() {
  const s = el('death-screen');
  if (s) s.classList.add('hidden');
}

/** Show the round-cleared overlay. */
export function showWinScreen() {
  const s = el('win-screen');
  if (s) s.classList.remove('hidden');
}

/** Hide the round-cleared overlay. */
export function hideWinScreen() {
  const s = el('win-screen');
  if (s) s.classList.add('hidden');
}

// ==========================================================================
// Kill Feed
// ==========================================================================

/**
 * Add an entry to the kill feed.
 * @param {string} killer         Killer's name.
 * @param {string} victim         Victim's name.
 * @param {'CT'|'T'} killerFaction
 * @param {'CT'|'T'} victimFaction
 */
export function updateKillFeed(killer, victim, killerFaction, victimFaction) {
  const feed = el('hud-killfeed');
  if (!feed) return;

  // Enforce max entries (remove oldest)
  while (feed.children.length >= MAX_KILLFEED_ENTRIES) {
    feed.removeChild(feed.firstChild);
  }

  // Build entry
  const entry = document.createElement('div');
  entry.className = 'killfeed-entry';

  const killerSpan = document.createElement('span');
  killerSpan.className = killerFaction === 'CT' ? 'kf-ct' : 'kf-t';
  killerSpan.textContent = killer;

  const sepSpan = document.createElement('span');
  sepSpan.className = 'kf-sep';
  sepSpan.textContent = '✕';

  const victimSpan = document.createElement('span');
  victimSpan.className = victimFaction === 'CT' ? 'kf-ct' : 'kf-t';
  victimSpan.textContent = victim;

  entry.appendChild(killerSpan);
  entry.appendChild(sepSpan);
  entry.appendChild(victimSpan);
  feed.appendChild(entry);

  // Auto-remove after KILLFEED_LIFETIME_MS
  const removeDelay = KILLFEED_LIFETIME_MS - 500;
  setTimeout(() => {
    entry.classList.add('fading');
  }, Math.max(0, removeDelay));

  setTimeout(() => {
    if (entry.parentNode === feed) {
      feed.removeChild(entry);
    }
  }, KILLFEED_LIFETIME_MS);
}

// ==========================================================================
// Simple accessors
// ==========================================================================

/** Get the currently selected difficulty. */
export function getDifficulty() {
  return selectedDifficulty;
}

/** Get the currently selected faction. */
export function getFaction() {
  return selectedFaction;
}
