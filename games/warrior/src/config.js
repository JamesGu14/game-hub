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
  accel: 1700, airAccel: 1200, maxSpeed: 205, friction: 1500,
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

// Weapon table. M1 ships the default rifle (no letter). M2/M4 add M/S/L/F + R/B.
export const WEAPONS = {
  rifle: { id: 'rifle', letter: '', cooldown: 0.18, dmg: 1, speed: 560, pierce: false, spread: 0 },
};
export const DEFAULT_WEAPON = 'rifle';
export const RAPID_COOLDOWN_MUL = 0.6; // used from M4
export const RAPID_SPEED_MUL = 1.3;    // used from M4

export const THEMES = {
  forest: { skyTop: '#7ec85a', skyBot: '#cdeeae', ground: '#7a5a2f', groundDark: '#543d1f', grass: '#3fa845', hills: '#2f7d3a' },
};

export const SCORE = { kill: 100, levelClear: 1000 };

export const STORAGE_KEY = 'jungle-warrior-save'; // used from M3
