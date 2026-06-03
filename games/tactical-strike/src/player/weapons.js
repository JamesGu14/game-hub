// weapons.js — slot-based loadout with money/economy
import * as THREE from 'three';
import * as audio from '../audio/audio.js';

// Weapon icons — local SVG files (game-icons.net by Lorc, CC-BY 3.0).
// Files live in /assets/icons/*.svg and are served by the same dev server.
const ICON = {
  knife:    'assets/icons/bowie-knife.svg',
  pistol:   'assets/icons/pistol-gun.svg',
  revolver: 'assets/icons/revolver.svg',
  deagle:   'assets/icons/automatic-sas.svg',
  uzi:      'assets/icons/uzi.svg',
  rifle:    'assets/icons/rifle.svg',
  ak:       'assets/icons/winchester-rifle.svg',
  burst:    'assets/icons/machine-gun-magazine.svg',
  sniper:   'assets/icons/machine-gun.svg',
  scope:    'assets/icons/machine-gun.svg',
};

export const WEAPONS = {
  // === Slot 0 — Melee ===
  knife_default: {
    key:'knife_default', name:'Combat Knife', nameCn:'战术匕首',
    desc:'近战利刃，无声击杀，单击 55 点伤害',
    icon: ICON.knife,
    type:'knife', slot:0, damage:55, range:1.8, rpm:140, price:0,
  },

  // === Slot 1 — Pistols ===
  pistol_basic: {
    key:'pistol_basic', name:'Sidearm', nameCn:'制式手枪',
    desc:'标配副武器，弹容 15 发，免费装备',
    icon: ICON.pistol,
    type:'pistol', slot:1, damage:18, headshotMult:2, rpm:380, magSize:15, reserveMax:60, reloadMs:1500, price:0,
  },
  pistol_heavy: {
    key:'pistol_heavy', name:'Heavy Pistol', nameCn:'重型手枪',
    desc:'大口径手枪，单发 30 伤，弹容仅 7 发',
    icon: ICON.revolver,
    type:'pistol', slot:1, damage:30, headshotMult:2, rpm:300, magSize:7, reserveMax:35, reloadMs:2200, price:700,
  },
  pistol_deagle: {
    key:'pistol_deagle', name:'Desert Eagle', nameCn:'沙漠之鹰',
    desc:'.50 大口径手枪，单发 60 伤，慢但致命',
    icon: ICON.deagle,
    type:'pistol', slot:1, damage:60, headshotMult:2, rpm:240, magSize:7, reserveMax:35, reloadMs:2200, price:850,
  },

  // === Slot 2 — SMGs / Rifles / Snipers ===
  smg_basic: {
    key:'smg_basic', name:'Compact SMG', nameCn:'紧凑冲锋枪',
    desc:'高射速冲锋枪，850 RPM，30 发弹容',
    icon: ICON.uzi,
    type:'smg', slot:2, damage:14, headshotMult:2, rpm:850, magSize:30, reserveMax:120, reloadMs:2400, price:1400,
  },
  rifle_standard: {
    key:'rifle_standard', name:'Assault Rifle', nameCn:'突击步枪',
    desc:'全能主战步枪，30 发弹匣，单发 28 伤',
    icon: ICON.rifle,
    type:'rifle', slot:2, damage:28, headshotMult:2, rpm:600, magSize:30, reserveMax:90, reloadMs:2400, price:2700,
  },
  rifle_ak: {
    key:'rifle_ak', name:'AK47', nameCn:'AK47',
    desc:'经典步枪，单发 36 伤，后坐力大',
    icon: ICON.ak,
    type:'rifle', slot:2, damage:36, headshotMult:2, rpm:600, magSize:30, reserveMax:90, reloadMs:2400, price:2700,
  },
  rifle_burst: {
    key:'rifle_burst', name:'Burst Rifle', nameCn:'连发步枪',
    desc:'高威力步枪，单发 32 伤，后坐力可控',
    icon: ICON.burst,
    type:'rifle', slot:2, damage:32, headshotMult:2, rpm:520, magSize:25, reserveMax:75, reloadMs:2700, price:3000,
  },
  sniper_bolt: {
    key:'sniper_bolt', name:'Bolt Sniper', nameCn:'栓动狙击枪',
    desc:'栓动单发狙击枪，胸口命中即死',
    icon: ICON.sniper,
    type:'sniper', slot:2, damage:120, headshotMult:2, rpm:45, magSize:5, reserveMax:25, reloadMs:3000, price:4750, scopeFov:18,
  },
  sniper_auto: {
    key:'sniper_auto', name:'Auto Sniper', nameCn:'自动狙击枪',
    desc:'半自动狙击枪，射速快但伤害稍低',
    icon: ICON.scope,
    type:'sniper', slot:2, damage:75, headshotMult:2, rpm:90, magSize:10, reserveMax:30, reloadMs:3500, price:5000, scopeFov:25,
  },
};

let _loadout = { 0: null, 1: null, 2: null };
let _ammo = { 0: null, 1: null, 2: null };
let _activeSlot = 1;
let _money = 800;

function _makeAmmoState(w) {
  if (w.type === 'knife') {
    return { current: -1, reserve: -1, isReloading: false, lastShotAt: 0, reloadEndsAt: 0 };
  }
  return { current: w.magSize, reserve: w.reserveMax, isReloading: false, lastShotAt: 0, reloadEndsAt: 0 };
}

export function initLoadout() {
  _loadout = { 0: 'knife_default', 1: 'pistol_basic', 2: null };
  _ammo = {
    0: _makeAmmoState(WEAPONS.knife_default),
    1: _makeAmmoState(WEAPONS.pistol_basic),
    2: null,
  };
  _activeSlot = _loadout[2] ? 2 : 1;
  _money = 800;
}

export function setLoadoutSlot(slot, weaponKey) {
  const w = WEAPONS[weaponKey];
  if (!w) return false;
  if (w.slot !== slot) return false;
  _loadout[slot] = weaponKey;
  _ammo[slot] = _makeAmmoState(w);
  return true;
}

export function switchToSlot(slot) {
  if (_loadout[slot]) _activeSlot = slot;
}

export function getActiveWeapon() {
  const k = _loadout[_activeSlot];
  return k ? WEAPONS[k] : null;
}
export function getActiveSlot() { return _activeSlot; }
export function getLoadout()    { return { ..._loadout }; }
export function getMoney()      { return _money; }
export function addMoney(n)     { _money += n; }
export function spendMoney(n) {
  if (_money < n) return false;
  _money -= n;
  return true;
}

export function canShoot() {
  const w = getActiveWeapon();
  if (!w) return false;
  const a = _ammo[_activeSlot];
  if (!a) return false;
  if (a.isReloading) return false;
  if (w.type !== 'knife' && a.current <= 0) return false;
  const now = performance.now();
  if (now - a.lastShotAt < 60000 / w.rpm) return false;
  return true;
}

const _raycaster = new THREE.Raycaster();
const _screenCenter = new THREE.Vector2(0, 0);

export function shoot(camera, targetMeshes) {
  const noHit = { hit:false, hitPoint:null, hitObject:null, isHeadshot:false, weaponType:null };
  if (!canShoot()) return noHit;

  const w = getActiveWeapon();
  const a = _ammo[_activeSlot];
  a.lastShotAt = performance.now();

  _raycaster.setFromCamera(_screenCenter, camera);
  _raycaster.far = (w.type === 'knife') ? w.range : 500;

  const hits = _raycaster.intersectObjects(targetMeshes, true);
  if (w.type !== 'knife') a.current--;

  if (w.type === 'knife') {
    audio.playKnifeSwing && audio.playKnifeSwing();
  } else {
    audio.playGunshot && audio.playGunshot(w.type);
  }

  if (hits.length === 0) return { ...noHit, weaponType: w.type };

  const hit = hits[0];
  if (w.type === 'knife' && hit.distance > w.range) return { ...noHit, weaponType: 'knife' };

  let isHeadshot = false;
  if (hit.object.userData.isHead === true) {
    isHeadshot = true;
  } else {
    let root = hit.object;
    while (root.parent && root.userData.headThresholdY === undefined) root = root.parent;
    if (root.userData.headThresholdY !== undefined) {
      isHeadshot = hit.point.y >= root.userData.headThresholdY;
    }
  }
  if (w.type === 'knife') {
    audio.playKnifeHit && audio.playKnifeHit();
    isHeadshot = false;
  }
  return { hit: true, hitPoint: hit.point, hitObject: hit.object, isHeadshot, weaponType: w.type };
}

export function reload() {
  const w = getActiveWeapon();
  if (!w || w.type === 'knife') return;
  const a = _ammo[_activeSlot];
  if (!a || a.isReloading || a.current >= w.magSize || a.reserve <= 0) return;
  a.isReloading = true;
  a.reloadEndsAt = performance.now() + w.reloadMs;
  audio.playReload && audio.playReload();
}

export function updateWeapons(now) {
  let changed = false;
  for (const slot of [0, 1, 2]) {
    const w = _loadout[slot] ? WEAPONS[_loadout[slot]] : null;
    const a = _ammo[slot];
    if (!w || !a || w.type === 'knife') continue;
    if (a.isReloading && now >= a.reloadEndsAt) {
      const needed = w.magSize - a.current;
      const take = Math.min(needed, a.reserve);
      a.current += take;
      a.reserve -= take;
      a.isReloading = false;
      a.reloadEndsAt = 0;
      changed = true;
    }
  }
  return changed;
}


// Buy ammo for specific slots
export function buyAmmoForSlot(slot) {
  const weaponKey = _loadout[slot];
  if (!weaponKey) return false;
  const w = WEAPONS[weaponKey];
  if (!w || w.type === 'knife') return false;
  
  const a = _ammo[slot];
  if (!a) return false;
  
  // Can't buy if already at max
  if (a.reserve >= w.reserveMax) return false;
  
  const cost = 50;
  if (_money < cost) return false;
  
  _money -= cost;
  // Add 30 bullets, capped at reserveMax
  a.reserve = Math.min(a.reserve + 30, w.reserveMax);
  return true;
}


export function isAmmoFull(slot) {
  const weaponKey = _loadout[slot];
  if (!weaponKey) return true;
  const w = WEAPONS[weaponKey];
  const a = _ammo[slot];
  if (!a || !w) return true;
  if (w.type === 'knife') return true;
  return a.reserve >= w.reserveMax;
}

export function getWeaponState() {
  const w = getActiveWeapon();
  if (!w) return { name:'(empty)', type:'none', currentAmmo:0, reserveAmmo:0, isReloading:false, slot:_activeSlot };
  const a = _ammo[_activeSlot];
  return {
    name: w.name, type: w.type,
    currentAmmo: a.current, reserveAmmo: a.reserve,
    isReloading: a.isReloading, slot: _activeSlot,
  };
}
