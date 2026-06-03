// Game tuning constants for 打砖块 BREAKOUT.
// All gameplay happens in a fixed "field" coordinate space (FIELD.W x FIELD.H);
// the renderer scales/letterboxes this to the actual canvas so logic stays resolution-independent.

export const FIELD = { W: 800, H: 600 };

// Top band reserved for the HUD (score / lives). The ball ceiling sits at TOP_WALL.
export const TOP_WALL = 50;

// Paddle geometry (width comes from the mode).
export const PADDLE = {
  h: 16,
  y: FIELD.H - 38, // top edge of the paddle
  keySpeed: 640, // px/s when moved by keyboard / gamepad
};

// Brick grid: levels are 13-column ASCII pictures parsed in levels.js.
export const GRID = {
  cols: 13,
  marginX: 30, // left/right padding inside the field
  top: 72, // y of the first brick row
  gap: 4,
  rowH: 28, // vertical step between rows (brick height = rowH - gap)
};

// Derived brick cell size.
export const BRICK_W =
  (FIELD.W - GRID.marginX * 2 - (GRID.cols - 1) * GRID.gap) / GRID.cols;
export const BRICK_H = GRID.rowH - GRID.gap;

// Candy palette — each ASCII char in a level maps to one bright candy color.
export const CANDY = {
  R: '#ff5d8f', // 草莓 strawberry
  P: '#ff9ff3', // 蜜桃 peach
  Y: '#ffd23f', // 柠檬 lemon
  O: '#ff9f43', // 橙子 orange
  G: '#5fd97a', // 青苹果 green apple
  B: '#4ea8ff', // 蓝莓 blueberry
  V: '#b983ff', // 葡萄 grape
  C: '#34e0c8', // 薄荷 mint
  W: '#fff1c1', // 奶油 cream
};

// 'S' = hard candy: takes 2 hits, shown wrapped, lightens after the first hit.
export const HARD_CANDY = {
  char: 'S',
  base: '#ff7eb3',
  cracked: '#ffd0e4',
  hits: 2,
};

// Two difficulty modes chosen on the start screen.
export const MODES = {
  easy: {
    id: 'easy',
    label: '简单',
    sub: '友好儿童版',
    lives: 5,
    ballSpeed: 250, // initial speed (px/s)
    ballSpeedMax: 360,
    speedup: 3.5, // px/s added per brick destroyed
    paddleW: 145,
    ballRadius: 9,
    powerupChance: 0.24,
  },
  normal: {
    id: 'normal',
    label: '普通',
    sub: '经典街机版',
    lives: 3,
    ballSpeed: 330,
    ballSpeedMax: 540,
    speedup: 6.5,
    paddleW: 100,
    ballRadius: 8,
    powerupChance: 0.12,
  },
};

// Falling power-ups dropped by broken bricks.
export const POWERUPS = {
  fallSpeed: 190, // px/s
  w: 30,
  h: 22,
  // type: emoji + color + how long the effect lasts (ms; 0 = instant/permanent-for-level)
  types: {
    wide: { emoji: '🟦', color: '#4ea8ff', label: '宽板', duration: 12000 },
    multi: { emoji: '⚪', color: '#fff1c1', label: '多球', duration: 0 },
    slow: { emoji: '🐢', color: '#5fd97a', label: '慢球', duration: 9000 },
    life: { emoji: '❤️', color: '#ff5d8f', label: '加命', duration: 0 },
  },
  // Relative weights for which power-up drops (kid-friendly: lots of wide & life).
  weights: { wide: 4, multi: 2, slow: 2, life: 1 },
};

export const SCORE = {
  brick: 10,
  hardCandy: 25,
  levelClear: 100,
};

export const STORAGE_KEY = 'breakout-best';
