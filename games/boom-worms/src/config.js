// Tunable constants for 炮炮虫 BOOM WORMS. Pure data — importable by node:test.
export const FIELD = { W: 960, H: 540 };

export const PHYSICS = {
  wormGravity: 1300,   // px/s^2 on worms
  moveSpeed: 85,       // px/s walk
  jumpVel: -360,       // px/s
  maxFall: 820,
  projGravity: 480,    // px/s^2 on projectiles
};

export const WORM = { w: 24, h: 30, r: 14, hpMax: 100 };

export const WATER = { defaultY: 512 };  // worm center below this => drowned

// power (hold) maps linearly to projectile launch speed
export const AIM = {
  minSpeed: 180, maxSpeed: 720, // px/s
  chargeSeconds: 1.7,           // hold time from min->max (ping-pong: up then back down)
  angleStepRad: 1.4,            // radians/sec when adjusting angle by key/pad
};

export const WEAPONS = {
  bazooka:   { name: '火箭筒', icon: '🚀', kind: 'projectile', dmg: 45, radius: 46, windAffected: true,  ammo: Infinity, color: '#ffd23f' },
  grenade:   { name: '手雷',   icon: '💣', kind: 'grenade',    dmg: 40, radius: 42, fuse: 3, bounce: 0.5, windAffected: false, ammo: Infinity, color: '#6bbf59' },
  dynamite:  { name: '炸药',   icon: '🧨', kind: 'dynamite',   dmg: 60, radius: 60, fuse: 3.5, ammo: 3, color: '#e8453c' },
  shotgun:   { name: '霰弹枪', icon: '🔫', kind: 'hitscan',    dmg: 25, radius: 16, shots: 2, range: 260, ammo: 3, color: '#cfd8dc' },
  firepunch: { name: '飞拳',   icon: '👊', kind: 'melee',      dmg: 30, range: 40, knockUp: -360, knockX: 220, safe: true, ammo: 3, color: '#ff8a3c' },
  airstrike: { name: '空袭',   icon: '✈️', kind: 'airstrike',  dmg: 25, radius: 30, bombs: 5, ammo: 0, color: '#9aa0a6' },
  holy:      { name: '圣手雷', icon: '🐑', kind: 'grenade',    dmg: 90, radius: 82, fuse: 3, bounce: 0.4, windAffected: false, ammo: 0, color: '#ffffff' },
};
// Weapons selectable from the bar (others arrive only via crates).
export const STARTING_WEAPONS = ['bazooka', 'grenade', 'dynamite', 'shotgun', 'firepunch'];
export const CRATE_WEAPONS = ['airstrike', 'holy', 'dynamite', 'shotgun'];

export const CRATE = { dropChance: 0.45, healAmount: 30, w: 26, h: 26 };
export const SCORE = { levelClear: 1000, win: 5000 };
export const STORAGE_KEY = 'boom-worms-progress-v2'; // bumped for the 15-level reset (spec §11.1)
