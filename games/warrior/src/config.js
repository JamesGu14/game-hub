// Tuning constants for 丛林勇士 JUNGLE WARRIOR (M1 subset, extensible to full spec).
// Gameplay runs in a fixed "world" pixel space; the renderer scales/letterboxes the
// visible FIELD viewport onto the canvas so logic stays resolution-independent.
// Baselines follow pixel-quest + spec §13 reviewer defaults; tune via playtest.

export const TILE = 32; // world px per tile

export const VIEW = { tilesX: 16, tilesY: 14 };
export const FIELD = { W: VIEW.tilesX * TILE, H: VIEW.tilesY * TILE }; // 512 x 448

export const GRAVITY = 2300;
export const MAX_FALL = 980;

// Single movement speed (no walk/run split — fewer keys, more faithful, kid-friendly).
export const PLAYER = {
  w: 22, h: 30, proneH: 18, // proneH used from M2
  accel: 1700, airAccel: 1200, maxSpeed: 143, friction: 1500,
  jumpVel: 760, jumpCutoff: 0.45,
};

export const FORGIVE = { coyote: 0.10, jumpBuffer: 0.12 };

// Difficulty modes. M1 starts in casual; classic fields are present so later
// milestones (M3) can switch without reshaping data.
export const MODES = {
  casual:  { id: 'casual',  label: '休闲', sub: '无限复活·儿童友好', lives: Infinity, enemyMul: 0.85, invuln: 2.0, loseWeaponOnDeath: false },
  classic: { id: 'classic', label: '经典', sub: '3 命·经典还原',     lives: 3,        enemyMul: 1.0,  invuln: 1.5, loseWeaponOnDeath: true  },
};

// Tile legend: char -> tile-type NAME. parseLevel converts the char grid to a NAME
// grid so physics can test SOLID.has(name).
export const TILES = { '#': 'ground', '=': 'platform', X: 'block', '|': 'cover' };
export const SOLID = new Set(['ground', 'platform', 'block', 'cover']);

export const ENEMY = {
  runner: { w: 24, h: 28, speed: 70, hp: 1, score: 100 },
  jumper: { w: 24, h: 26, speed: 55, hp: 1, score: 150, jumpVel: 560, triggerDist: 170, retrigger: 0.9 },
};

export const BULLET = { w: 12, h: 6, life: 1.4 };

// Weapon table. M1 ships the default rifle (no letter). M2 adds M/S/L; M4 adds F + R/B.
export const WEAPONS = {
  rifle:   { id: 'rifle',   letter: '',  cooldown: 0.18, dmg: 1,   speed: 560, pierce: false, spread: 0 },
  machine: { id: 'machine', letter: 'M', cooldown: 0.08, dmg: 0.5, speed: 600, pierce: false, spread: 0 },
  spread:  { id: 'spread',  letter: 'S', cooldown: 0.34, dmg: 1,   speed: 520, pierce: false, spread: 5, spreadAngle: 0.314 },
  laser:   { id: 'laser',   letter: 'L', cooldown: 0.40, dmg: 2,   speed: 720, pierce: true,  spread: 0 },
  fire:    { id: 'fire',    letter: 'F', cooldown: 0.5,  dmg: 2,   speed: 420, pierce: false, spread: 0, gravity: 900 },
};
export const DEFAULT_WEAPON = 'rifle';
export const RAPID_COOLDOWN_MUL = 0.6; // used from M4
export const RAPID_SPEED_MUL = 1.3;    // used from M4

export const THEMES = {
  forest: { skyTop: '#7ec85a', skyBot: '#cdeeae', ground: '#7a5a2f', groundDark: '#543d1f', grass: '#3fa845', hills: '#2f7d3a' },
  steel:  { skyTop: '#2b2f36', skyBot: '#454c56', ground: '#6b7280', groundDark: '#454b54', grass: '#8a929c', hills: '#363b42' },
  beach:  { skyTop: '#5fd0e6', skyBot: '#d8f6ff', ground: '#e9d8a6', groundDark: '#c2a86a', grass: '#ffe9a8', hills: '#7fd6c0' },
  snow:   { skyTop: '#a8d8ff', skyBot: '#eaf5ff', ground: '#cfd8e3', groundDark: '#9aa7b5', grass: '#ffffff', hills: '#d6e6f5' },
  abyss:  { skyTop: '#1a0608', skyBot: '#3a0c10', ground: '#4a2326', groundDark: '#2a1214', grass: '#7a2530', hills: '#250a0c' },
};

export const SCORE = { kill: 100, levelClear: 1000 };

export const STORAGE_KEY = 'jungle-warrior-save'; // used from M3

// ---- M2 additions ----
// Letter -> what a pickup does. Main weapons switch player.weapon; items grant state.
export const PICKUPS = {
  M: { kind: 'weapon', weapon: 'machine' },
  S: { kind: 'weapon', weapon: 'spread' },
  L: { kind: 'weapon', weapon: 'laser' },
  F: { kind: 'weapon', weapon: 'fire' },
  B: { kind: 'item', item: 'barrier' },
  R: { kind: 'item', item: 'rapid' },
};
export const BARRIER = { time: 5.0 }; // seconds of invuln + instakill-on-touch
export const BLINK = 0.12;            // i-frame / barrier blink period
export const PRONE = { h: 18 };       // crouched hitbox height

export const FALCON = { w: 40, h: 22, speed: 150, dropBlink: 0.2 };
export const PICKUP = { w: 20, h: 20, life: 8.0, blink: 0.2 };

export const COMBO = { window: 2.5, maxMult: 5 };
export const SHAKE = { kill: 3, bigKill: 5, bossDie: 8 };

// ---- M4 additions ----
export const RAPID = { maxStacks: 3 };  // R cap (spec §13 H4)
export const FIRE = { gravity: 900 };   // fireball parabola
export const ENEMY_RANGED = {
  gunner: { w: 24, h: 28, hp: 2, score: 150, fireCd: 1.6, bulletSpeed: 280, bulletDmg: 1 },
  turret: { w: 30, h: 26, hp: 3, score: 200, fireCd: 2.0, burst: 3, spreadAngle: 0.35, bulletSpeed: 260, bulletDmg: 1 },
  flyer:  { w: 26, h: 20, hp: 1, score: 180, speed: 90, amp: 60, freq: 2.2, fireCd: 2.4, bulletSpeed: 240, bulletDmg: 1 },
};

// L1 BOSS 震地要塞·铁壁 Iron Gate Destroyer — the §13 H9 template for all bosses.
export const BOSSES = {
  ironGate: {
    name: '震地要塞·铁壁', enName: 'Iron Gate Destroyer',
    w: 96, h: 110, maxHp: 40, touchDamage: true,
    phases: [
      { upTo: 1.01, slamCd: 2.2, spawnGrunts: 0 }, // >50% hp
      { upTo: 0.5,  slamCd: 1.5, spawnGrunts: 2 }, // <=50% hp: faster + summons
    ],
    score: 2000,
  },
  cyclops:  { name: '独眼核心·加尔玛', enName: 'Cyclops Core',     w: 90,  h: 100, maxHp: 55,  touchDamage: true, fires: true,        phases: [{ upTo: 1.01, slamCd: 2.0, spawnGrunts: 0, fireCd: 1.4 }, { upTo: 0.5, slamCd: 1.4, spawnGrunts: 2, fireCd: 0.9 }], score: 2600 },
  valkyrie: { name: '旋翼死神·瓦尔基里', enName: 'Valkyrie Gunship', w: 100, h: 70,  maxHp: 60,  touchDamage: true, fires: true, fly: true, phases: [{ upTo: 1.01, slamCd: 1.8, spawnGrunts: 0, fireCd: 1.1 }, { upTo: 0.5, slamCd: 1.4, spawnGrunts: 1, fireCd: 0.8 }], score: 2800 },
  frost:    { name: '寒霜重坦·克隆', enName: 'Frost Crawler',     w: 110, h: 90,  maxHp: 70,  touchDamage: true, fires: true,        phases: [{ upTo: 1.01, slamCd: 1.8, spawnGrunts: 1, fireCd: 1.2 }, { upTo: 0.5, slamCd: 1.2, spawnGrunts: 2, fireCd: 0.8 }], score: 3200 },
  gomera:   { name: '创魔之心·戈梅拉', enName: 'Heart of Gomera',  w: 120, h: 120, maxHp: 100, touchDamage: true, fires: true,        phases: [{ upTo: 1.01, slamCd: 1.8, spawnGrunts: 1, fireCd: 1.2 }, { upTo: 0.66, slamCd: 1.4, spawnGrunts: 2, fireCd: 0.9 }, { upTo: 0.33, slamCd: 1.0, spawnGrunts: 3, fireCd: 0.6 }], score: 5000 },
};

export const STARS = { timeThreshold: 75, timeMul2: 1.6 }; // 3⭐ <=75s, 2⭐ <=120s, else 1⭐
