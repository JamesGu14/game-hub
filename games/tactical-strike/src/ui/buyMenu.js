/* ============================================================
   BUY MENU — src/ui/buyMenu.js
   ============================================================ */

let _weapons = null;
let _onBuy = null;
let _activeTab = 'pistol';
let _built = false;

// DOM refs
let _overlay = null;
let _moneyEl = null;
let _cardsEl = null;

// Kept in sync with `.bm-tab[data-tab]` values in index.html.
const TABS = ['pistol', 'smg', 'rifle', 'sniper', 'ammo'];

/* ---- Public API ---- */

export function initBuyMenu(weaponsModule) {
  _weapons = weaponsModule;
  if (!_built) _buildDOM();
}

export function showBuyMenu() {
  if (!_built) return;
  _overlay.classList.remove('hidden');
  _refresh();
}

export function hideBuyMenu() {
  if (!_built) return;
  _overlay.classList.add('hidden');
}

export function isOpen() {
  return _built && !_overlay.classList.contains('hidden');
}

export function setOnBuy(cb) {
  _onBuy = cb;
}

/* ---- Internal ---- */

function _buildDOM() {
  _overlay  = document.getElementById('buy-menu');
  _moneyEl  = document.getElementById('buy-money');
  _cardsEl  = document.getElementById('buy-cards');

  if (!_overlay || !_moneyEl || !_cardsEl) {
    console.warn('[buyMenu] Required DOM elements not found.');
    return;
  }

  // Close button
  document.getElementById('buy-close')
    .addEventListener('click', hideBuyMenu);

  // Tab buttons
  _overlay.querySelectorAll('.bm-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      _activeTab = tab.dataset.tab;
      _overlay.querySelectorAll('.bm-tab').forEach(t => t.classList.toggle('active', t === tab));
      _renderCards();
    });
  });

  _built = true;
}

function _refresh() {
  // Update money display
  _moneyEl.textContent = _weapons.getMoney();
  _renderCards();
}

function _renderCards() {
  const { WEAPONS, getMoney, spendMoney, setLoadoutSlot, getLoadout, buyAmmoForSlot, isAmmoFull } = _weapons;
  const money   = getMoney();
  const loadout = getLoadout();

  _cardsEl.innerHTML = '';

  if (_activeTab === 'ammo') {
    // Special handling for Ammo tab
    [1, 2].forEach(slot => {
      const weaponKey = loadout[slot];
      if (!weaponKey) return;

      const w = WEAPONS[weaponKey];
      const card = document.createElement('div');
      card.className = 'bm-card';

      const price = 50;
      const canAfford = money >= price;
      const full = isAmmoFull(slot);
      const label = slot === 1 ? '手枪子弹 (30发)' : '主武器子弹 (30发)';
      
      const isDisabled = !canAfford || full;
      const btnText = full ? 'FULL' : 'BUY';

      card.innerHTML = `
        <div class="bm-card-icon"><img src="assets/icons/machine-gun-magazine.svg" style="filter:invert(1)"></div>
        <div class="bm-card-info">
          <div class="bm-card-namerow">
            <span class="bm-card-name-cn">${label}</span>
            <span class="bm-card-name-en">Ammo Refill</span>
          </div>
          <div class="bm-card-meta">${w.name}</div>
          <div class="bm-card-desc">补充 30 发后备弹药，直到达到上限为止。</div>
          <div class="bm-card-row">
            <span class="bm-card-price">$${price}</span>
            <button class="bm-card-btn" ${isDisabled ? 'disabled' : ''}>${btnText}</button>
          </div>
        </div>
      `;

      if (!isDisabled) {
        card.querySelector('.bm-card-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          if (buyAmmoForSlot(slot)) {
            _refresh();
            if (_onBuy) _onBuy(weaponKey, slot); 
            // Play reload sound
            import('../audio/audio.js').then(a => a.playReload && a.playReload());
          }
        });
      } else if (!canAfford) {
        card.style.opacity = '0.5';
      }

      _cardsEl.appendChild(card);
    });

    if (_cardsEl.children.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'grid-column:1/-1;color:rgba(255,255,255,0.3);font-size:0.85rem;padding:20px;';
      empty.textContent = 'Please buy a weapon first.';
      _cardsEl.appendChild(empty);
    }
    return;
  }

  // Filter weapons by active tab
  const keys = Object.keys(WEAPONS).filter(k => WEAPONS[k].type === _activeTab);

  if (keys.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column:1/-1;color:rgba(255,255,255,0.3);font-size:0.85rem;padding:20px;';
    empty.textContent = 'No weapons available.';
    _cardsEl.appendChild(empty);
    return;
  }

  keys.forEach(key => {
    const w = WEAPONS[key];
    const owned = loadout[w.slot] === key;
    const canAfford = money >= w.price;
    const slotLabel = w.slot === 0 ? '近战 [1]' : w.slot === 1 ? '副武器 [2]' : '主武器 [3]';

    const card = document.createElement('div');
    card.className = 'bm-card' + (owned ? ' owned' : '');

    const iconHtml = w.icon
      ? `<img src="${w.icon}" alt="${w.name}" loading="lazy"
              onerror="this.style.display='none'; this.parentNode.classList.add('no-icon');" />`
      : '';

    card.innerHTML = `
      <div class="bm-card-icon">${iconHtml}</div>
      <div class="bm-card-info">
        <div class="bm-card-namerow">
          <span class="bm-card-name-cn">${w.nameCn || w.name}</span>
          <span class="bm-card-name-en">${w.name}</span>
        </div>
        <div class="bm-card-meta">${slotLabel}</div>
        <div class="bm-card-desc">${w.desc || ''}</div>
        <div class="bm-card-row">
          <span class="bm-card-price">$${w.price}</span>
          <button class="bm-card-btn" ${owned || !canAfford ? 'disabled' : ''}>${owned ? 'OWNED' : 'BUY'}</button>
        </div>
      </div>
    `;

    if (!owned && !canAfford) card.style.opacity = '0.5';

    if (!owned && canAfford) {
      card.querySelector('.bm-card-btn').addEventListener('click', () => {
        // Re-verify affordability at click time: DOM state can drift from
        // money state (e.g. concurrent ammo purchases) between render and click.
        if (!spendMoney(w.price)) {
          _refresh();
          return;
        }
        setLoadoutSlot(w.slot, key);
        _refresh();
        if (_onBuy) _onBuy(key, w.slot);
      });
    }

    _cardsEl.appendChild(card);
  });
}
