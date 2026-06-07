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
export const SOLID = new Set(['ground','block','brick','brickCoin','qcoin','qpower','qstar','qempty','pipeL','pipeR','platform']);
export const BUMPABLE = new Set(['qcoin','qpower','qstar','brick','brickCoin']);

export const THEMES = {
  overworld:  { skyTop:'#5c94fc', skyBot:'#9ec3ff', ground:'#c4731f', groundDark:'#9c560f', grass:'#3fa845', hills:'#3fa845' },
  underground:{ skyTop:'#04122b', skyBot:'#0a2247', ground:'#2f6db0', groundDark:'#1d3f70', grass:'#2f6db0', hills:'#0a2247' },
  sky:        { skyTop:'#7ec0ff', skyBot:'#cdeeff', ground:'#c4731f', groundDark:'#9c560f', grass:'#3fa845', hills:'#bcd9ff' },
  castle:     { skyTop:'#1a1320', skyBot:'#2a1d33', ground:'#6b5b73', groundDark:'#473b4f', grass:'#6b5b73', hills:'#2a1d33' },
  lava:       { skyTop:'#2a0d0d', skyBot:'#5a1c0a', ground:'#7a3b1f', groundDark:'#4f2410', grass:'#c2451c', hills:'#3a0f0a' },
  snow:       { skyTop:'#a8d8ff', skyBot:'#eaf5ff', ground:'#cfd8e3', groundDark:'#9aa7b5', grass:'#ffffff', hills:'#d6e6f5' },
  desert:     { skyTop:'#f3c98b', skyBot:'#ffe9c2', ground:'#e0b46a', groundDark:'#b3863f', grass:'#e8c27a', hills:'#e6b97a' },
  forest:     { skyTop:'#7ec85a', skyBot:'#cdeeae', ground:'#7a5a2f', groundDark:'#543d1f', grass:'#3fa845', hills:'#2f7d3a' },
  beach:      { skyTop:'#5fd0e6', skyBot:'#d8f6ff', ground:'#e9d8a6', groundDark:'#c2a86a', grass:'#ffe9a8', hills:'#7fd6c0' },
  night:      { skyTop:'#0a0a2a', skyBot:'#1e1b3a', ground:'#3a3550', groundDark:'#262238', grass:'#3a3550', hills:'#15132a' },
  swamp:      { skyTop:'#2e3b22', skyBot:'#54663a', ground:'#5a4a2a', groundDark:'#3a3018', grass:'#6b8f3a', hills:'#3a4a26' },
  crystal:    { skyTop:'#1a0f2e', skyBot:'#2e1a47', ground:'#4a3a6b', groundDark:'#2f2547', grass:'#7a5fb0', hills:'#231640' },
  storm:      { skyTop:'#2a3340', skyBot:'#566677', ground:'#5a6b7a', groundDark:'#3a4754', grass:'#7a8a99', hills:'#34404d' },
  steel:      { skyTop:'#2b2f36', skyBot:'#454c56', ground:'#6b7280', groundDark:'#454b54', grass:'#8a929c', hills:'#363b42' },
  abyss:      { skyTop:'#1a0608', skyBot:'#3a0c10', ground:'#4a2326', groundDark:'#2a1214', grass:'#7a2530', hills:'#250a0c' },
  sakura:     { skyTop:'#ffb7d5', skyBot:'#ffe3ef', ground:'#b5826a', groundDark:'#8a5f4a', grass:'#ff9ec4', hills:'#f7c6dc' },
  temple:     { skyTop:'#e8c878', skyBot:'#f7e6b8', ground:'#c9a05a', groundDark:'#9a7338', grass:'#d9b86a', hills:'#cdaa6a' },
  mushroom:   { skyTop:'#3a2a6b', skyBot:'#6b5aa8', ground:'#7a5a9a', groundDark:'#523c6b', grass:'#ff7ac4', hills:'#4a3a7a' },
  cosmic:     { skyTop:'#0c0a28', skyBot:'#241a52', ground:'#34305c', groundDark:'#201d3e', grass:'#7c6cff', hills:'#171238' },
  celestial:  { skyTop:'#8fd0ff', skyBot:'#fff3cf', ground:'#e8d98f', groundDark:'#bfa85f', grass:'#ffe9a0', hills:'#cfe6ff' },
};

export const SCORE = { coin:100, stomp:100, shellHit:200, fireKill:200, powerup:1000, flagBase:500, timeBonus:20, levelClear:1000, oneUpAtCoins:100 };

export const STORAGE_KEY = 'pixel-quest-best';
