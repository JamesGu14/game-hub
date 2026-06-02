// Tunable constants for 丛林尖兵 JUNGLE BLITZ. Pure data — no DOM, importable by node:test.
export const FIELD = { W: 960, H: 540 };

export const PHYSICS = {
  gravity: 2200,     // px/s^2
  moveSpeed: 250,    // px/s horizontal
  jumpVel: -760,     // px/s initial jump velocity
  maxFall: 950,      // px/s terminal velocity
};

export const PLAYER = {
  w: 28, h: 44, proneH: 26,
  hpMax: 5,
  lives: 4,
  iframeMs: 1200,        // i-frames after a normal hit
  respawnIframeMs: 1500, // i-frames after respawning
  knockback: 140, knockbackMs: 140,
};

export const WEAPONS = {
  rifle:   { name: '步枪', dmg: 1, speed: 720,  interval: 180, kind: 'normal', color: '#ffe27a' },
  spread:  { name: '散弹', dmg: 1, speed: 680,  interval: 260, kind: 'spread', pellets: 5, spreadDeg: 26, color: '#ff9f43' },
  machine: { name: '机枪', dmg: 1, speed: 820,  interval: 90,  kind: 'normal', color: '#7af0ff' },
  laser:   { name: '激光', dmg: 2, speed: 1100, interval: 300, kind: 'laser', pierce: true, color: '#b983ff' },
};
export const DEFAULT_WEAPON = 'rifle';
export const POD_KIND_TO_WEAPON = { weaponS: 'spread', weaponM: 'machine', weaponL: 'laser' };

export const ITEMS = { shieldMs: 6000, healAmount: 2 };
export const POWERUP = { w: 30, h: 30, driftSpeed: 30, bobAmp: 8, bobHz: 1.2 };

export const BULLET = { r: 5, enemyR: 6, lifeS: 2.5, laserLen: 26, laserW: 6 };
export const ENEMY_BULLET = { speed: 220, color: '#ff5d5d' };
export const GRENADE = { gravity: 1400, vx: 160, vy: -420, color: '#ffd23f', fuseS: 1.4, blastR: 36 };

export const ENEMIES = {
  grunt:     { w: 26, h: 40, hp: 2, speed: 70,  fireMs: 1400, score: 100, color: '#d23b3b' },
  turret:    { w: 38, h: 30, hp: 4, fireMs: 1500, score: 150, color: '#9aa0a6' },
  drone:     { w: 34, h: 22, hp: 2, speed: 90, amp: 50, dropMs: 1600, score: 150, color: '#c060c0' },
  jumper:    { w: 28, h: 36, hp: 3, jumpMs: 1600, jumpVel: -700, speed: 120, score: 150, color: '#e08a2b' },
  grenadier: { w: 26, h: 40, hp: 3, throwMs: 1900, score: 200, color: '#8a6d3b' },
  nest:      { w: 46, h: 46, hp: 5, fireMs: 1200, score: 250, color: '#6b4f2a' },
};

export const BOSSES = {
  gate:       { hp: 30, score: 1500, dropWeapon: 'spread' },
  gunship:    { hp: 40, score: 2500, dropWeapon: 'machine' },
  mech:       { hp: 50, score: 3500, dropWeapon: 'laser' },
  twinCannon: { hp: 55, score: 4500, dropWeapon: 'spread' },
  core:       { phaseHp: [40, 40, 40], score: 8000 },
};

export const SCORE = { stageClear: 1000, pickup: 50, win: 5000 };
export const CAMERA = { followRatio: 0.38 };
export const STORAGE_KEY = 'jungle-blitz-best';
