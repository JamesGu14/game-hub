// Tuning constants for 像素冒险 PIXEL QUEST.
// All gameplay runs in a fixed "world" pixel space; the renderer scales/letterboxes
// the visible viewport (FIELD) onto the canvas so logic stays resolution-independent.

export const TILE = 32; // world px per tile

export const VIEW = { tilesX: 16, tilesY: 14 };
export const FIELD = { W: VIEW.tilesX * TILE, H: VIEW.tilesY * TILE }; // 512 x 448

export const GRAVITY = 2300;
export const MAX_FALL = 980;

export const PLAYER = {
  smallW: 22, smallH: 28, bigW: 26, bigH: 50,
  accel: 1600, airAccel: 1100, maxWalk: 175, maxRun: 300, friction: 1300,
  jumpVel: 800, jumpCutoff: 0.45, bounceVel: 560,
  invulnTime: 1.6, starTime: 8.0, fireCooldown: 0.32,
};

export const FORGIVE = { coyote: 0.10, jumpBuffer: 0.12 };

export const ENEMY = { goombaSpeed: 46, koopaSpeed: 40, shellSpeed: 320, fireballSpeed: 320, fireballBounce: 360 };

export const MODES = {
  easy:    { id:'easy',    label:'简单', sub:'友好儿童版', lives:5, enemyMul:0.8, coyoteMul:1.6, powerupGenerous:true,  checkpoints:true },
  classic: { id:'classic', label:'经典', sub:'经典街机版', lives:3, enemyMul:1.0, coyoteMul:1.0, powerupGenerous:false, checkpoints:false },
};

export const TILES = {
  '#':'ground', X:'block', B:'brick', b:'brickCoin', '?':'qcoin', M:'qpower', '*':'qstar',
  '[':'pipeL', ']':'pipeR', '=':'platform', F:'flag', A:'castle',
};
export const SOLID = new Set(['ground','block','brick','brickCoin','qcoin','qpower','qstar','pipeL','pipeR','platform']);
export const BUMPABLE = new Set(['qcoin','qpower','qstar','brick','brickCoin']);

export const THEMES = {
  overworld:  { skyTop:'#5c94fc', skyBot:'#9ec3ff', ground:'#c4731f', groundDark:'#9c560f', grass:'#3fa845', hills:'#3fa845' },
  underground:{ skyTop:'#04122b', skyBot:'#0a2247', ground:'#2f6db0', groundDark:'#1d3f70', grass:'#2f6db0', hills:'#0a2247' },
  sky:        { skyTop:'#7ec0ff', skyBot:'#cdeeff', ground:'#c4731f', groundDark:'#9c560f', grass:'#3fa845', hills:'#bcd9ff' },
  castle:     { skyTop:'#1a1320', skyBot:'#2a1d33', ground:'#6b5b73', groundDark:'#473b4f', grass:'#6b5b73', hills:'#2a1d33' },
};

export const SCORE = { coin:100, stomp:100, shellHit:200, fireKill:200, powerup:1000, flagBase:500, timeBonus:20, levelClear:1000, oneUpAtCoins:100 };

export const STORAGE_KEY = 'pixel-quest-best';
