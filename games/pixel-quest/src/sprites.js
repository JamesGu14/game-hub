// Pixel art for 像素冒险 PIXEL QUEST.
// Every sprite is drawn once onto a small offscreen canvas (logical pixel size) and
// cached; the renderer blits it upscaled with nearest-neighbour (imageSmoothingEnabled=false).
// Drawing code ported/adapted from the finalized mockup (pixel-hd3.html):
// heroCute / goomba / koopa / princess / qblock / brick / pipe / castle / flagPole / emoji coin.

import { TILE } from './config.js';

// ---- tiny offscreen helpers (match the mockup's mk/r/E) -------------------
function mk(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return { cv, cx: cv.getContext('2d') };
}
function r(x, a, b, w, h) { x.fillRect(a, b, w, h); }
function E(x, cx, cy, rx, ry) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); }

// ---- hero (cute) ----------------------------------------------------------
// form: 'small' | 'big' | 'fire'; frame: 0/1 walk legs, 2 = jump pose.
// Palette swaps for the fire form (white cap/shirt, red overalls accent).
function drawHero(form) {
  const big = form !== 'small';
  const fire = form === 'fire';
  const w = 24, h = big ? 38 : 28;
  const o = mk(w, h), x = o.cx;

  const cap = fire ? '#f4f4f4' : '#e8362b';
  const capDark = fire ? '#c9c9c9' : '#c0241b';
  const capLite = fire ? '#ffffff' : '#ff6d5c';
  const overall = fire ? '#e8362b' : '#2f5fd0';
  const overallDk = fire ? '#b02018' : '#1b3a8f';

  // head / face
  x.fillStyle = '#fcc08a'; E(x, 12, 13, 8.5, 8);
  x.fillStyle = '#fcc08a'; E(x, 4, 14, 2, 2.5); E(x, 20, 14, 2, 2.5);
  // cap
  x.fillStyle = cap; x.beginPath(); x.ellipse(12, 9, 9.4, 7.6, 0, Math.PI, 0); x.fill();
  r(x, 3, 8, 18, 3);
  x.fillStyle = capDark; r(x, 2, 10, 20, 2);
  x.fillStyle = cap; r(x, 12, 9, 11, 3);
  x.fillStyle = capLite; E(x, 9, 6, 3, 1.6);
  x.fillStyle = '#fff'; E(x, 12, 6, 2.4, 2.4);
  x.fillStyle = cap; E(x, 12, 6, 1, 1);
  // sideburns
  x.fillStyle = '#5a3413'; r(x, 4, 12, 2, 5); r(x, 18, 12, 2, 5);
  // eyes
  x.fillStyle = '#fff'; E(x, 9, 14, 2.6, 3.4); E(x, 15, 14, 2.6, 3.4);
  x.fillStyle = '#23314a'; E(x, 9.6, 14.6, 1.6, 2.2); E(x, 14.4, 14.6, 1.6, 2.2);
  x.fillStyle = '#fff'; E(x, 9, 13.4, 0.8, 0.9); E(x, 15, 13.4, 0.8, 0.9);
  // nose / cheeks / moustache
  x.fillStyle = '#f3a86a'; E(x, 12, 17, 1.9, 1.7);
  x.fillStyle = '#ff9bb0'; x.globalAlpha = 0.7; E(x, 6.6, 17.4, 1.8, 1.3); E(x, 17.4, 17.4, 1.8, 1.3); x.globalAlpha = 1;
  x.fillStyle = '#5a3413'; E(x, 9.6, 18.7, 2.4, 1.4); E(x, 14.4, 18.7, 2.4, 1.4);
  x.fillStyle = '#a23b2b'; r(x, 11, 19.8, 2, 0.8);

  if (!big) {
    x.fillStyle = overall; x.beginPath(); x.moveTo(7, 21); x.lineTo(17, 21); x.lineTo(18, 27); x.lineTo(6, 27); x.closePath(); x.fill();
    x.fillStyle = cap; r(x, 7, 20, 10, 2); r(x, 4, 21, 3, 4); r(x, 17, 21, 3, 4);
    x.fillStyle = overall; r(x, 8, 20, 2, 3); r(x, 14, 20, 2, 3);
    x.fillStyle = '#fff'; E(x, 4.5, 25, 2.2, 2.2); E(x, 19.5, 25, 2.2, 2.2);
    x.fillStyle = '#ffd23f'; E(x, 9, 23, 1, 1); E(x, 15, 23, 1, 1);
    x.fillStyle = '#5a3413'; E(x, 8, 27, 3, 1.8); E(x, 16, 27, 3, 1.8);
  } else {
    x.fillStyle = cap; r(x, 7, 20, 10, 3); r(x, 3, 21, 3, 7); r(x, 18, 21, 3, 7);
    x.fillStyle = overall; r(x, 6, 22, 12, 12); r(x, 8, 20, 2, 4); r(x, 14, 20, 2, 4);
    x.fillStyle = overallDk; r(x, 11, 24, 2, 10);
    x.fillStyle = '#ffd23f'; E(x, 9, 25, 1.1, 1.1); E(x, 15, 25, 1.1, 1.1);
    x.fillStyle = '#fff'; E(x, 4, 29, 2.4, 2.4); E(x, 20, 29, 2.4, 2.4);
    x.fillStyle = overall; r(x, 7, 34, 4, 3); r(x, 13, 34, 4, 3);
    x.fillStyle = '#5a3413'; E(x, 8, 37, 3.2, 2); E(x, 16, 37, 3.2, 2);
  }
  return o;
}

// Add little leg offsets / jump pose by re-stamping shoe positions on a copy.
function heroFrame(form, frame, faceRight) {
  const big = form !== 'small';
  const base = drawHero(form);
  const w = base.cv.width, h = base.cv.height;
  const o = mk(w, h), x = o.cx;
  x.drawImage(base.cv, 0, 0);
  const shoeY = h - (big ? 2 : 1);
  // re-paint feet area to fake walk/jump frames
  if (frame === 2) {
    // jump: tuck legs (clear & redraw shoes higher together)
    x.clearRect(big ? 5 : 6, h - 4, w - (big ? 10 : 12), 4);
    x.fillStyle = '#5a3413';
    E(x, big ? 9 : 7.5, shoeY - 2, big ? 3.2 : 3, 2);
    E(x, big ? 15 : 16.5, shoeY - 2, big ? 3.2 : 3, 2);
  } else if (frame === 1) {
    // alternate stride: shift one shoe forward
    x.clearRect(big ? 5 : 5, h - 4, w - (big ? 10 : 10), 4);
    x.fillStyle = '#5a3413';
    E(x, big ? 7 : 6, shoeY, big ? 3.2 : 3, 2);
    E(x, big ? 16 : 17, shoeY - 1, big ? 3.2 : 3, 2);
  }
  if (faceRight) return o;
  // mirror horizontally
  const m = mk(w, h), mx = m.cx;
  mx.translate(w, 0); mx.scale(-1, 1);
  mx.drawImage(o.cv, 0, 0);
  return m;
}

// ---- enemies --------------------------------------------------------------
function drawGoomba(frame) {
  const o = mk(20, 17), x = o.cx;
  x.fillStyle = '#a4602e'; x.beginPath(); x.ellipse(10, 9, 9, 7, 0, Math.PI, 0); x.fill();
  r(x, 2, 9, 16, 5);
  x.fillStyle = '#6e3c18'; r(x, 2, 13, 16, 1.5);
  x.fillStyle = '#caa06a'; E(x, 10, 11, 6, 3.2);
  x.fillStyle = '#4a2810'; r(x, 3, 7, 6, 1.6); r(x, 11, 7, 6, 1.6);
  x.fillStyle = '#fff'; E(x, 7, 9.6, 2, 2.4); E(x, 13, 9.6, 2, 2.4);
  x.fillStyle = '#1b1e26'; E(x, 7.4, 10, 1.1, 1.5); E(x, 12.6, 10, 1.1, 1.5);
  x.fillStyle = '#3a2410'; r(x, 7, 13.6, 6, 1.2);
  // feet waddle
  x.fillStyle = '#2a1808';
  if (frame === 1) { E(x, 5, 16, 3, 1.8); E(x, 15, 16, 3, 1.8); }
  else { E(x, 7, 16, 3, 1.8); E(x, 13, 16, 3, 1.8); }
  return o;
}

function drawKoopaWalk(frame) {
  const o = mk(18, 24), x = o.cx;
  x.fillStyle = '#8fe08f'; E(x, 6, 6, 4, 4); r(x, 3, 6, 6, 4);
  x.fillStyle = '#fff'; E(x, 5, 5, 1.4, 1.6);
  x.fillStyle = '#1b1e26'; r(x, 4.6, 4.6, 1.3, 1.7);
  x.fillStyle = '#f0b53a'; r(x, 1, 7, 3, 1.6);
  // feet (waddle)
  x.fillStyle = '#f0b53a';
  if (frame === 1) { E(x, 5, 23, 2.5, 1.6); E(x, 14, 23, 2.5, 1.6); }
  else { E(x, 6, 23, 2.5, 1.6); E(x, 13, 23, 2.5, 1.6); }
  // shell
  x.fillStyle = '#237a2a'; E(x, 10, 15, 8, 8.5);
  x.fillStyle = '#46b14d'; E(x, 10, 15, 5.5, 6);
  x.fillStyle = '#237a2a'; r(x, 9, 9, 2, 2); r(x, 6, 14, 2, 2); r(x, 13, 14, 2, 2); r(x, 9, 19, 2, 2);
  x.lineWidth = 2; x.strokeStyle = '#ffd23f'; x.beginPath(); x.ellipse(10, 15, 8, 8.5, 0, 0, 7); x.stroke();
  return o;
}

function drawKoopaShell() {
  const o = mk(18, 16), x = o.cx;
  x.fillStyle = '#237a2a'; E(x, 9, 8, 8.5, 7.5);
  x.fillStyle = '#46b14d'; E(x, 9, 8, 5.5, 5);
  x.fillStyle = '#237a2a'; r(x, 8, 2, 2, 2); r(x, 4, 7, 2, 2); r(x, 12, 7, 2, 2); r(x, 8, 12, 2, 2);
  x.lineWidth = 2; x.strokeStyle = '#ffd23f'; x.beginPath(); x.ellipse(9, 8, 8.5, 7.5, 0, 0, 7); x.stroke();
  return o;
}

// ---- princess / castle / flag --------------------------------------------
function drawPrincess() {
  const o = mk(26, 34), x = o.cx;
  x.fillStyle = '#ffd23f';
  [6, 11, 16].forEach((px) => { x.beginPath(); x.moveTo(px, 4); x.lineTo(px + 2.5, 0); x.lineTo(px + 5, 4); x.fill(); });
  r(x, 5, 4, 16, 3);
  x.fillStyle = '#ff5d8f'; r(x, 12, 1, 2, 2);
  x.fillStyle = '#caa05a'; E(x, 13, 13, 9, 8); r(x, 4, 11, 18, 10);
  x.fillStyle = '#fcc08a'; E(x, 13, 14, 6, 6);
  x.fillStyle = '#23314a'; E(x, 10.5, 13.5, 1.3, 1.6); E(x, 15.5, 13.5, 1.3, 1.6);
  x.fillStyle = '#ff9bb0'; x.globalAlpha = 0.7; E(x, 9, 16, 1.4, 1); E(x, 17, 16, 1.4, 1); x.globalAlpha = 1;
  x.fillStyle = '#d4548c'; r(x, 11.5, 16.5, 3, 1);
  x.fillStyle = '#ff8fc0'; x.beginPath(); x.moveTo(8, 20); x.lineTo(18, 20); x.lineTo(24, 34); x.lineTo(2, 34); x.fill();
  x.fillStyle = '#d4548c'; x.beginPath(); x.moveTo(12, 20); x.lineTo(14, 20); x.lineTo(16, 34); x.lineTo(10, 34); x.fill();
  x.fillStyle = '#7fd0ff'; r(x, 12, 22, 3, 3);
  x.fillStyle = '#fcc08a'; r(x, 5, 21, 3, 7); r(x, 18, 21, 3, 7);
  return o;
}

function drawCastle() {
  const o = mk(62, 58), x = o.cx;
  const stone = '#b6907a', dk = '#8a6a55', lt = '#cdab95', mt = '#5f4636';
  x.fillStyle = stone; r(x, 5, 18, 52, 40);
  for (let i = 5; i < 57; i += 8) { r(x, i, 14, 5, 4); }
  r(x, 21, 8, 20, 12);
  for (let i = 22; i < 40; i += 6) { r(x, i, 4, 4, 4); }
  x.fillStyle = lt; r(x, 5, 18, 2, 40); r(x, 21, 8, 2, 12);
  x.fillStyle = dk; r(x, 55, 18, 2, 40); r(x, 39, 8, 2, 12);
  x.fillStyle = mt;
  for (let yy = 22; yy < 58; yy += 6) { r(x, 5, yy, 52, 1); }
  for (let xx = 5; xx <= 57; xx += 8) { r(x, xx, 18, 1, 40); }
  x.fillStyle = '#23262e'; r(x, 25, 44, 12, 14); r(x, 27, 42, 8, 2); r(x, 29, 40, 4, 2);
  x.fillStyle = '#3a2f55'; r(x, 30, 42, 2, 16);
  x.fillStyle = '#23262e'; r(x, 12, 26, 5, 7); r(x, 45, 26, 5, 7); r(x, 28, 11, 6, 7);
  x.fillStyle = '#888'; r(x, 31, 0, 1, 8);
  x.fillStyle = '#e23b2e'; x.beginPath(); x.moveTo(32, 1); x.lineTo(40, 2.5); x.lineTo(32, 4); x.fill();
  return o;
}

function drawFlag(hPx) {
  const h = Math.max(16, Math.round(hPx));
  const o = mk(16, h), x = o.cx;
  x.fillStyle = '#cfd6dd'; r(x, 7, 4, 2, h - 4);
  x.fillStyle = '#2fbf4f'; E(x, 8, 4, 3, 3);
  x.fillStyle = '#2fbf4f'; x.beginPath(); x.moveTo(7, 7); x.lineTo(0, 10); x.lineTo(7, 13); x.fill();
  x.fillStyle = '#fff'; r(x, 2.5, 9, 2, 2);
  return o;
}

// ---- world tiles (each rendered at TILE x TILE) ---------------------------
function drawQBlock(active) {
  const o = mk(16, 16), x = o.cx;
  if (!active) {
    // emptied block (brown bumped)
    x.fillStyle = '#9c6a22'; r(x, 0, 0, 16, 16);
    x.fillStyle = '#6b3d09'; r(x, 0, 0, 16, 1.5); r(x, 0, 14.5, 16, 1.5); r(x, 0, 0, 1.5, 16); r(x, 14.5, 0, 1.5, 16);
    r(x, 2.5, 2.5, 1.6, 1.6); r(x, 11.9, 2.5, 1.6, 1.6); r(x, 2.5, 11.9, 1.6, 1.6); r(x, 11.9, 11.9, 1.6, 1.6);
    return o;
  }
  x.fillStyle = '#e8a426'; r(x, 0, 0, 16, 16);
  x.fillStyle = '#ffd76b'; r(x, 1, 1, 14, 2);
  x.fillStyle = '#c9881f'; r(x, 1, 12, 14, 3);
  x.fillStyle = '#6b3d09'; r(x, 0, 0, 16, 1.5); r(x, 0, 14.5, 16, 1.5); r(x, 0, 0, 1.5, 16); r(x, 14.5, 0, 1.5, 16);
  r(x, 2.5, 2.5, 1.6, 1.6); r(x, 11.9, 2.5, 1.6, 1.6); r(x, 2.5, 11.9, 1.6, 1.6); r(x, 11.9, 11.9, 1.6, 1.6);
  const Q = ['..####.', '.#....#', '......#', '.....#.', '....#..', '...#...', '...#...', '.......', '...#...'];
  x.fillStyle = '#6b3d09';
  Q.forEach((row, yy) => { [...row].forEach((ch, xx) => { if (ch === '#') r(x, 4.5 + xx, 3 + yy, 1, 1); }); });
  return o;
}

function drawQPower() {
  const o = drawQBlock(true);
  // subtle pink tint to hint a power item (vs coin)
  const x = o.cx;
  x.globalAlpha = 0.22; x.fillStyle = '#ff5d8f'; r(x, 1.5, 1.5, 13, 13); x.globalAlpha = 1;
  return o;
}
function drawQStar() {
  const o = drawQBlock(true);
  const x = o.cx;
  x.globalAlpha = 0.22; x.fillStyle = '#ffe066'; r(x, 1.5, 1.5, 13, 13); x.globalAlpha = 1;
  return o;
}

function drawBrick() {
  const o = mk(16, 16), x = o.cx;
  x.fillStyle = '#c4731f'; r(x, 0, 0, 16, 16);
  x.fillStyle = '#e08b2a'; r(x, 0, 0, 16, 2);
  x.fillStyle = '#7a3f0c'; r(x, 0, 7, 16, 1.4); r(x, 0, 15, 16, 1);
  r(x, 7, 1, 1.4, 6); r(x, 3, 8.5, 1.4, 6); r(x, 11, 8.5, 1.4, 6);
  x.fillStyle = '#3f2109'; r(x, 0, 0, 1, 16);
  return o;
}

function drawGround(theme) {
  const o = mk(16, 16), x = o.cx;
  const top = theme.grass, body = theme.ground, dark = theme.groundDark;
  x.fillStyle = body; r(x, 0, 0, 16, 16);
  x.fillStyle = top; r(x, 0, 0, 16, 4);
  x.fillStyle = dark; for (let i = 0; i < 16; i += 4) r(x, i, 5, 1, 11);
  x.fillStyle = '#00000022'; r(x, 0, 8, 16, 1);
  x.fillStyle = '#ffffff18'; r(x, 0, 4, 16, 1);
  return o;
}

function drawBlock(theme) {
  const o = mk(16, 16), x = o.cx;
  x.fillStyle = theme.ground; r(x, 0, 0, 16, 16);
  x.fillStyle = '#ffffff22'; r(x, 1, 1, 14, 2);
  x.fillStyle = theme.groundDark; r(x, 0, 13, 16, 3); r(x, 13, 0, 3, 16);
  x.fillStyle = '#00000033'; r(x, 0, 0, 16, 1); r(x, 0, 0, 1, 16);
  return o;
}

function drawPlatform(theme) {
  const o = mk(16, 16), x = o.cx;
  x.fillStyle = '#caa05a'; r(x, 0, 0, 16, 6);
  x.fillStyle = '#8a6a3a'; r(x, 0, 6, 16, 10);
  x.fillStyle = '#ffe6b0'; r(x, 0, 0, 16, 1.5);
  x.fillStyle = '#5f4a26'; r(x, 0, 5, 16, 1);
  return o;
}

// Pipe spans 2 tiles wide; we slice a full pipe into left/right TILE columns.
function drawPipeColumn(side) {
  const bodyH = 32, rimH = 8;
  const full = mk(28, bodyH), x = full.cx;
  x.fillStyle = '#2c9b34'; r(x, 4, rimH, 20, bodyH - rimH);
  x.fillStyle = '#5fd06a'; r(x, 6, rimH, 4, bodyH - rimH);
  x.fillStyle = '#1d6a24'; r(x, 20, rimH, 4, bodyH - rimH);
  x.fillStyle = '#16401a'; r(x, 4, rimH, 1, bodyH - rimH); r(x, 23, rimH, 1, bodyH - rimH);
  x.fillStyle = '#2c9b34'; r(x, 0, 0, 28, rimH);
  x.fillStyle = '#5fd06a'; r(x, 2, 1, 5, rimH - 2);
  x.fillStyle = '#1d6a24'; r(x, 23, 1, 3, rimH - 2);
  x.fillStyle = '#16401a'; r(x, 0, 0, 28, 1); r(x, 0, rimH - 1, 28, 1); r(x, 0, 0, 1, rimH); r(x, 27, 0, 1, rimH);
  x.fillStyle = '#0f2f12'; r(x, 5, 1, 18, 2);
  // slice 14px wide column (pipe is 28 wide ~ 2 tiles)
  const o = mk(14, bodyH), ox = o.cx;
  ox.drawImage(full.cv, side === 'L' ? 0 : 14, 0, 14, bodyH, 0, 0, 14, bodyH);
  return o;
}

// ---- powerups -------------------------------------------------------------
// Powerups are drawn via emoji at render time for crispness, but we still expose
// a small cached canvas so the renderer can blit consistently if desired.
function drawPowerup(kind) {
  const o = mk(16, 16), x = o.cx;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = '14px "Apple Color Emoji","Segoe UI Emoji",serif';
  const ch = kind === 'mushroom' ? '🍄' : kind === 'flower' ? '🌻' : '⭐';
  x.fillText(ch, 8, 9);
  return o;
}

// ---- public API -----------------------------------------------------------
// Render an emoji glyph to an offscreen canvas ONCE, so it can be blitted cheaply
// each frame. Per-frame fillText of a colour emoji is a real cost (glyph layout +
// rasterization) and churns garbage — caching removes it from the hot path.
function drawEmoji(ch, px) {
  const o = mk(px, px), x = o.cx;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `${px}px "Apple Color Emoji","Segoe UI Emoji",serif`;
  x.fillText(ch, px / 2, px / 2);
  return o;
}

const cache = new Map();
function cached(key, make) {
  let v = cache.get(key);
  if (!v) { v = make(); cache.set(key, v); }
  return v;
}

export const Sprites = {
  hero(form, frame, faceRight) {
    return cached(`hero:${form}:${frame}:${faceRight ? 'R' : 'L'}`, () =>
      heroFrame(form, frame, faceRight)).cv;
  },
  goomba(frame) {
    return cached(`gmb:${frame & 1}`, () => drawGoomba(frame & 1)).cv;
  },
  koopa(state, frame) {
    if (state === 'shell') return cached('kp:shell', () => drawKoopaShell()).cv;
    return cached(`kp:walk:${frame & 1}`, () => drawKoopaWalk(frame & 1)).cv;
  },
  princess() { return cached('princess', () => drawPrincess()).cv; },
  castle() { return cached('castle', () => drawCastle()).cv; },
  flag(heightPx) {
    const h = Math.max(16, Math.round(heightPx));
    return cached(`flag:${h}`, () => drawFlag(h)).cv;
  },
  tile(type, themeKey) {
    const key = `tile:${type}:${themeKey}`;
    return cached(key, () => {
      // theme object is passed indirectly: we resolve via THEMES-like color carrier
      const theme = Sprites._themes[themeKey] || Sprites._themes.overworld;
      switch (type) {
        case 'ground': return drawGround(theme);
        case 'block': return drawBlock(theme);
        case 'brick': case 'brickCoin': return drawBrick();
        case 'qcoin': return drawQBlock(true);
        case 'qpower': return drawQPower();
        case 'qstar': return drawQStar();
        case 'qempty': return drawQBlock(false);
        case 'platform': return drawPlatform(theme);
        case 'pipeL': return drawPipeColumn('L');
        case 'pipeR': return drawPipeColumn('R');
        default: return drawBlock(theme);
      }
    }).cv;
  },
  powerup(kind) { return cached(`pu:${kind}`, () => drawPowerup(kind)).cv; },

  // coin drawn directly with emoji
  coinCv() { return cached('coinE', () => drawEmoji('🪙', 24)).cv; },
  powerupCv(kind) {
    const ch = kind === 'mushroom' ? '🍄' : kind === 'flower' ? '🌻' : '⭐';
    return cached(`puE:${kind}`, () => drawEmoji(ch, 26)).cv;
  },
  coin(ctx, cx, cy, size) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size}px "Apple Color Emoji","Segoe UI Emoji",serif`;
    ctx.fillText('🪙', cx, cy);
    ctx.restore();
  },

  // crisp blits
  blit(ctx, cv, x, y, scale) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, Math.round(x), Math.round(y), cv.width * scale, cv.height * scale);
  },
  blitBottom(ctx, cv, cx, bottom, scale) {
    Sprites.blit(ctx, cv, cx - (cv.width * scale) / 2, bottom - cv.height * scale, scale);
  },

  // theme colors are injected by render.js so tile() can stay pure
  _themes: {},
  setThemes(themes) { Sprites._themes = themes; cache.clear(); },
  // Drop every cached sprite canvas so they rebuild on next use. Called by the
  // renderer to self-heal after a draw error (e.g. an offscreen canvas blanked /
  // evicted under iOS Safari memory pressure) and when returning to a backgrounded tab.
  clearCache() { cache.clear(); },
};
