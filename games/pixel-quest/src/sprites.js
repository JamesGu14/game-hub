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

// 飞翼怪:紫红身体(区别 Goomba 棕),fly 态画上下扇动的白翅膀两帧;walk(退化)态无翅。
function drawFlyer(state, frame) {
  const o = mk(20, 17), x = o.cx;
  if (state === 'fly') {
    x.fillStyle = '#f2eaff';
    if (frame === 1) {
      x.beginPath(); x.moveTo(3, 8); x.lineTo(-1, 2); x.lineTo(5, 6); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(17, 8); x.lineTo(21, 2); x.lineTo(15, 6); x.closePath(); x.fill();
    } else {
      x.beginPath(); x.moveTo(3, 8); x.lineTo(-1, 13); x.lineTo(5, 10); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(17, 8); x.lineTo(21, 13); x.lineTo(15, 10); x.closePath(); x.fill();
    }
    x.fillStyle = '#d9c8f0';
    x.fillRect(2, 7, 2, 2); x.fillRect(16, 7, 2, 2);
  }
  x.fillStyle = '#b03a6e'; x.beginPath(); x.ellipse(10, 9, 9, 7, 0, Math.PI, 0); x.fill();
  r(x, 2, 9, 16, 5);
  x.fillStyle = '#7a2548'; r(x, 2, 13, 16, 1.5);
  x.fillStyle = '#d96b9a'; E(x, 10, 11, 6, 3.2);
  x.fillStyle = '#4a1530'; r(x, 3, 7, 6, 1.6); r(x, 11, 7, 6, 1.6);
  x.fillStyle = '#fff'; E(x, 7, 9.6, 2, 2.4); E(x, 13, 9.6, 2, 2.4);
  x.fillStyle = '#1b1e26'; E(x, 7.4, 10, 1.1, 1.5); E(x, 12.6, 10, 1.1, 1.5);
  x.fillStyle = '#5a1838'; r(x, 7, 13.6, 6, 1.2);
  x.fillStyle = '#3a1024';
  if (frame === 1) { E(x, 5, 16, 3, 1.8); E(x, 15, 16, 3, 1.8); }
  else { E(x, 7, 16, 3, 1.8); E(x, 13, 16, 3, 1.8); }
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

// ---- portraits (对话头像,逻辑尺寸 ~32px,blit 时放大;卡通不吓人) -------------
function drawKingHead() {
  const o = mk(128, 128), x = o.cx; x.scale(4, 4);
  // 耳朵
  x.fillStyle = '#fcc08a'; E(x, 6.5, 19, 1.8, 2.2); E(x, 25.5, 19, 1.8, 2.2);
  x.fillStyle = '#e8a06a'; E(x, 6.5, 19, 0.8, 1.1); E(x, 25.5, 19, 0.8, 1.1);
  // 脸 + 下巴阴影
  x.fillStyle = '#fcc08a'; E(x, 16, 18.5, 9, 8.8);
  x.fillStyle = '#f7b07a'; E(x, 16, 24, 7, 3);
  // 皇冠底座 + 高光
  x.fillStyle = '#f0b800'; r(x, 5.5, 8.2, 21, 3.2);
  x.fillStyle = '#ffe066'; r(x, 5.5, 8.2, 21, 1);
  // 皇冠尖
  x.fillStyle = '#ffd23f';
  x.beginPath();
  x.moveTo(5.5, 9); x.lineTo(7.5, 2.5); x.lineTo(10.5, 8); x.lineTo(13.5, 1.5);
  x.lineTo(16, 7); x.lineTo(18.5, 1.5); x.lineTo(21.5, 8); x.lineTo(24.5, 2.5);
  x.lineTo(26.5, 9); x.closePath(); x.fill();
  // 尖上宝石
  x.fillStyle = '#e8362b'; E(x, 7.5, 4.2, 1, 1.1);
  x.fillStyle = '#2f8fe0'; E(x, 13.5, 3.4, 1, 1.1);
  x.fillStyle = '#3fa845'; E(x, 18.5, 3.4, 1, 1.1);
  x.fillStyle = '#e8362b'; E(x, 24.5, 4.2, 1, 1.1);
  // 底座中央宝石 + 高光
  x.fillStyle = '#e8362b'; E(x, 16, 9.8, 1.6, 1.6);
  x.fillStyle = '#ff9b8a'; E(x, 15.5, 9.4, 0.5, 0.5);
  // 白眉
  x.fillStyle = '#eeeeee'; r(x, 9.5, 14.2, 4, 1.1); r(x, 18.5, 14.2, 4, 1.1);
  // 眼
  x.fillStyle = '#fff'; E(x, 12, 16.2, 2, 2.3); E(x, 20, 16.2, 2, 2.3);
  x.fillStyle = '#3a5a8a'; E(x, 12.3, 16.5, 1, 1.3); E(x, 19.7, 16.5, 1, 1.3);
  x.fillStyle = '#1b1e26'; E(x, 12.3, 16.6, 0.5, 0.7); E(x, 19.7, 16.6, 0.5, 0.7);
  x.fillStyle = '#fff'; E(x, 11.8, 15.8, 0.5, 0.5); E(x, 19.2, 15.8, 0.5, 0.5);
  // 鼻
  x.fillStyle = '#f3a86a'; E(x, 16, 19.5, 1.7, 1.5);
  // 腮红
  x.fillStyle = '#ff9bb0'; x.globalAlpha = 0.5; E(x, 9.5, 20.5, 1.8, 1.2); E(x, 22.5, 20.5, 1.8, 1.2); x.globalAlpha = 1;
  // 大胡子(白)
  x.fillStyle = '#f7f7f7';
  x.beginPath(); x.moveTo(8, 21.5);
  x.quadraticCurveTo(8.5, 31, 16, 31.5); x.quadraticCurveTo(23.5, 31, 24, 21.5);
  x.quadraticCurveTo(20, 25, 16, 24.3); x.quadraticCurveTo(12, 25, 8, 21.5); x.fill();
  // 八字胡
  x.fillStyle = '#ffffff'; E(x, 13, 21.3, 3, 1.5); E(x, 19, 21.3, 3, 1.5);
  // 胡须纹理
  x.strokeStyle = '#d8d8d8'; x.lineWidth = 0.35;
  x.beginPath(); x.moveTo(12, 25.5); x.lineTo(12.5, 30.5); x.moveTo(16, 25.5); x.lineTo(16, 31);
  x.moveTo(20, 25.5); x.lineTo(19.5, 30.5); x.stroke();
  return o;
}
function drawMarioHead() {
  const o = mk(128, 128), x = o.cx; x.scale(4, 4);
  // 耳朵
  x.fillStyle = '#fcc08a'; E(x, 6, 19.5, 1.9, 2.3); E(x, 26, 19.5, 1.9, 2.3);
  x.fillStyle = '#e8a06a'; E(x, 6, 19.5, 0.8, 1.1); E(x, 26, 19.5, 0.8, 1.1);
  // 脸 + 下巴阴影
  x.fillStyle = '#fcc08a'; E(x, 16, 19.5, 9, 8.6);
  x.fillStyle = '#f7b07a'; E(x, 16, 24.5, 6.5, 2.6);
  // 鬓角
  x.fillStyle = '#5a3413'; E(x, 7.6, 19, 1.6, 3.2); E(x, 24.4, 19, 1.6, 3.2);
  // 帽顶 + 阴影带
  x.fillStyle = '#e8362b'; x.beginPath(); x.ellipse(16, 12, 11, 8.5, 0, Math.PI, 0); x.fill();
  x.fillStyle = '#c0241b'; r(x, 5, 11.4, 22, 1.6);
  // 帽檐
  x.fillStyle = '#d42b20'; x.beginPath(); x.ellipse(15.5, 13.4, 12.5, 2.6, 0, Math.PI, 0); x.fill();
  x.fillStyle = '#ff6d5c'; E(x, 11, 8, 3, 1.6);
  // 帽徽 M
  x.fillStyle = '#fff'; E(x, 16, 8.8, 3, 3);
  x.fillStyle = '#e8362b'; x.font = 'bold 5px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('M', 16, 9);
  // 眉
  x.fillStyle = '#5a3413'; r(x, 10, 14.4, 3.4, 1); r(x, 18.6, 14.4, 3.4, 1);
  // 眼
  x.fillStyle = '#fff'; E(x, 12.2, 16.6, 1.9, 2.4); E(x, 19.8, 16.6, 1.9, 2.4);
  x.fillStyle = '#3a5a8a'; E(x, 12.6, 16.9, 0.95, 1.4); E(x, 19.4, 16.9, 0.95, 1.4);
  x.fillStyle = '#1b1e26'; E(x, 12.6, 17, 0.5, 0.8); E(x, 19.4, 17, 0.5, 0.8);
  x.fillStyle = '#fff'; E(x, 12.1, 16.1, 0.5, 0.5); E(x, 18.9, 16.1, 0.5, 0.5);
  // 鼻
  x.fillStyle = '#f3a86a'; E(x, 16, 19.8, 2.4, 2.1);
  x.fillStyle = '#ffb380'; E(x, 15.2, 19.3, 0.7, 0.6);
  // 腮红
  x.fillStyle = '#ff9bb0'; x.globalAlpha = 0.55; E(x, 10, 21, 1.7, 1.2); E(x, 22, 21, 1.7, 1.2); x.globalAlpha = 1;
  // 八字胡
  x.fillStyle = '#5a3413';
  x.beginPath(); x.moveTo(11, 21.6);
  x.quadraticCurveTo(13, 20.9, 16, 21.6); x.quadraticCurveTo(19, 20.9, 21, 21.6);
  x.quadraticCurveTo(19.5, 24, 16, 23); x.quadraticCurveTo(12.5, 24, 11, 21.6); x.fill();
  // 嘴
  x.strokeStyle = '#a23b2b'; x.lineWidth = 0.5; x.beginPath(); x.arc(16, 23.6, 1.6, 0.2, Math.PI - 0.2); x.stroke();
  return o;
}
function drawBowserHead() {
  const o = mk(128, 128), x = o.cx; x.scale(4, 4);
  // 橙色鬃毛
  x.fillStyle = '#e87a1a';
  E(x, 8, 8.5, 2.4, 2.4); E(x, 12, 6.5, 2.6, 2.6); E(x, 16, 5.6, 2.8, 2.8); E(x, 20, 6.5, 2.6, 2.6); E(x, 24, 8.5, 2.4, 2.4);
  x.fillStyle = '#c75e0e'; E(x, 10, 7.5, 1.3, 1.3); E(x, 16, 6.4, 1.4, 1.4); E(x, 22, 7.5, 1.3, 1.3);
  // 角(带阴影)
  x.fillStyle = '#f4f0e0';
  x.beginPath(); x.moveTo(6.5, 11.5); x.lineTo(8.5, 3.5); x.lineTo(11, 11.5); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(25.5, 11.5); x.lineTo(23.5, 3.5); x.lineTo(21, 11.5); x.closePath(); x.fill();
  x.fillStyle = '#d8d2bc'; x.beginPath(); x.moveTo(8.5, 3.5); x.lineTo(9.7, 7.5); x.lineTo(11, 11.5); x.lineTo(9.6, 11.5); x.closePath(); x.fill();
  // 头 + 下半阴影
  x.fillStyle = '#6abf45'; E(x, 16, 18, 11, 9.5);
  x.fillStyle = '#5aa83f'; E(x, 16, 22.5, 9.5, 5.5);
  // 眉骨
  x.fillStyle = '#4f9636'; r(x, 8, 13.5, 16, 2.2);
  // 眉(凶萌)
  x.fillStyle = '#3f7a2c';
  x.beginPath(); x.moveTo(9, 13.8); x.lineTo(14, 15.4); x.lineTo(14, 16.4); x.lineTo(9, 15.4); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(23, 13.8); x.lineTo(18, 15.4); x.lineTo(18, 16.4); x.lineTo(23, 15.4); x.closePath(); x.fill();
  // 口鼻 + 鼻孔
  x.fillStyle = '#e8cf86'; E(x, 16, 23, 7.5, 4.5);
  x.fillStyle = '#d8bc6e'; E(x, 16, 25, 6, 2.4);
  x.fillStyle = '#7a5a2a'; E(x, 13.5, 22, 0.7, 0.5); E(x, 18.5, 22, 0.7, 0.5);
  // 眼
  x.fillStyle = '#fff'; E(x, 12.5, 17, 2.4, 2.7); E(x, 19.5, 17, 2.4, 2.7);
  x.fillStyle = '#e8a020'; E(x, 12.8, 17.2, 1.3, 1.7); E(x, 19.2, 17.2, 1.3, 1.7);
  x.fillStyle = '#1b1e26'; E(x, 12.9, 17.4, 0.7, 1.1); E(x, 19.1, 17.4, 0.7, 1.1);
  x.fillStyle = '#fff'; E(x, 12.3, 16.5, 0.5, 0.5); E(x, 18.9, 16.5, 0.5, 0.5);
  // 嘴 + 獠牙
  x.fillStyle = '#7a3b16'; x.beginPath(); x.ellipse(16, 26, 4.5, 1.7, 0, 0, Math.PI); x.fill();
  x.fillStyle = '#fff';
  x.beginPath(); x.moveTo(12.6, 25.6); x.lineTo(13.8, 25.6); x.lineTo(13.1, 27.8); x.closePath(); x.fill();
  x.beginPath(); x.moveTo(19.4, 25.6); x.lineTo(18.2, 25.6); x.lineTo(18.9, 27.8); x.closePath(); x.fill();
  return o;
}
function drawHeraldHead() {
  const o = mk(128, 128), x = o.cx; x.scale(4, 4);
  // 耳朵
  x.fillStyle = '#fcc08a'; E(x, 7, 20, 1.7, 2.1); E(x, 25, 20, 1.7, 2.1);
  // 脸 + 下巴阴影
  x.fillStyle = '#fcc08a'; E(x, 16, 20, 8.5, 8.2);
  x.fillStyle = '#f7b07a'; E(x, 16, 25, 6, 2.4);
  // 头发(棕)
  x.fillStyle = '#7a4a22'; x.beginPath(); x.ellipse(16, 13.5, 9.3, 5, 0, Math.PI, 0); x.fill();
  r(x, 7.2, 13, 3.5, 3); r(x, 21.3, 13, 3.5, 3);
  // 帽(绿)+ 帽带 + 高光
  x.fillStyle = '#2fa85a'; x.beginPath(); x.ellipse(16, 11.5, 9.5, 6, 0, Math.PI, 0); x.fill();
  x.fillStyle = '#237a42'; r(x, 6.5, 11, 19, 1.7);
  x.fillStyle = '#3fce72'; E(x, 12, 8, 2.6, 1.4);
  // 羽毛
  x.fillStyle = '#ffd23f'; x.beginPath(); x.moveTo(23, 9.5); x.quadraticCurveTo(30, 3.5, 31, 8.5); x.quadraticCurveTo(27, 8.5, 24, 11.5); x.fill();
  x.strokeStyle = '#e0a800'; x.lineWidth = 0.35; x.beginPath(); x.moveTo(24.5, 10.5); x.lineTo(29.5, 6.5); x.stroke();
  // 眉
  x.fillStyle = '#7a4a22'; r(x, 10.5, 16, 3, 0.9); r(x, 18.5, 16, 3, 0.9);
  // 眼
  x.fillStyle = '#fff'; E(x, 12.5, 18, 1.7, 2.1); E(x, 19.5, 18, 1.7, 2.1);
  x.fillStyle = '#5a7a3a'; E(x, 12.7, 18.2, 0.9, 1.2); E(x, 19.3, 18.2, 0.9, 1.2);
  x.fillStyle = '#1b1e26'; E(x, 12.7, 18.3, 0.5, 0.7); E(x, 19.3, 18.3, 0.5, 0.7);
  x.fillStyle = '#fff'; E(x, 12.2, 17.6, 0.4, 0.4); E(x, 18.9, 17.6, 0.4, 0.4);
  // 鼻
  x.fillStyle = '#f3a86a'; E(x, 16, 20.6, 1.4, 1.3);
  // 腮红
  x.fillStyle = '#ff9bb0'; x.globalAlpha = 0.5; E(x, 10.5, 21.8, 1.5, 1); E(x, 21.5, 21.8, 1.5, 1); x.globalAlpha = 1;
  // 笑
  x.strokeStyle = '#a23b2b'; x.lineWidth = 0.6; x.beginPath(); x.arc(16, 22.4, 3, 0.25, Math.PI - 0.25); x.stroke();
  return o;
}

function drawPrincessHead() {
  const o = mk(128, 128), x = o.cx; x.scale(4, 4);
  // 头发(金,带侧发与高光)
  x.fillStyle = '#f0c44e'; E(x, 16, 17.5, 11.5, 11);
  x.fillStyle = '#e0b03a'; E(x, 6.8, 22, 2.6, 4.2); E(x, 25.2, 22, 2.6, 4.2);
  x.fillStyle = '#ffe07a'; E(x, 11.5, 11, 4, 2.2);
  // 脸
  x.fillStyle = '#fcc08a'; E(x, 16, 19.8, 7.8, 7.6);
  // 皇冠
  x.fillStyle = '#ffd23f';
  x.beginPath(); x.moveTo(9.5, 8.5); x.lineTo(11.5, 3.5); x.lineTo(13.5, 8); x.lineTo(16, 2.5);
  x.lineTo(18.5, 8); x.lineTo(20.5, 3.5); x.lineTo(22.5, 8.5); x.closePath(); x.fill();
  x.fillStyle = '#f0b800'; r(x, 9.5, 8, 13, 1.6);
  x.fillStyle = '#ff5d8f'; E(x, 16, 4.5, 1.1, 1.1);
  x.fillStyle = '#5fb8e0'; E(x, 11.5, 5.5, 0.8, 0.8); E(x, 20.5, 5.5, 0.8, 0.8);
  // 眉
  x.fillStyle = '#caa03a'; r(x, 10.8, 15.8, 2.8, 0.7); r(x, 18.4, 15.8, 2.8, 0.7);
  // 眼(大,带睫毛与高光)
  x.fillStyle = '#fff'; E(x, 12.5, 18.2, 1.9, 2.4); E(x, 19.5, 18.2, 1.9, 2.4);
  x.fillStyle = '#4a86c0'; E(x, 12.7, 18.4, 1.1, 1.5); E(x, 19.3, 18.4, 1.1, 1.5);
  x.fillStyle = '#1b1e26'; E(x, 12.7, 18.6, 0.6, 0.9); E(x, 19.3, 18.6, 0.6, 0.9);
  x.fillStyle = '#fff'; E(x, 12.2, 17.6, 0.5, 0.5); E(x, 18.9, 17.6, 0.5, 0.5);
  x.strokeStyle = '#5a3a1a'; x.lineWidth = 0.4;
  x.beginPath(); x.moveTo(10.6, 16.8); x.lineTo(11.4, 17.4); x.moveTo(21.4, 16.8); x.lineTo(20.6, 17.4); x.stroke();
  // 鼻
  x.fillStyle = '#f3a86a'; E(x, 16, 20.6, 0.8, 0.7);
  // 腮红
  x.fillStyle = '#ff9bb0'; x.globalAlpha = 0.6; E(x, 11, 21.8, 1.7, 1.2); E(x, 21, 21.8, 1.7, 1.2); x.globalAlpha = 1;
  // 嘴唇
  x.fillStyle = '#e85d8f'; x.beginPath(); x.moveTo(14.5, 22.8); x.quadraticCurveTo(16, 24, 17.5, 22.8); x.quadraticCurveTo(16, 23.2, 14.5, 22.8); x.fill();
  // 耳环
  x.fillStyle = '#5fb8e0'; E(x, 8.4, 23, 0.7, 0.9); E(x, 23.6, 23, 0.7, 0.9);
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
  flyer(state, frame) {
    return cached(`fly:${state}:${frame & 1}`, () => drawFlyer(state, frame & 1)).cv;
  },
  princess() { return cached('princess', () => drawPrincess()).cv; },
  portrait(key) {
    switch (key) {
      case 'princess': return cached('portrait:princess', () => drawPrincessHead()).cv;
      case 'king':     return cached('portrait:king',   () => drawKingHead()).cv;
      case 'mario':    return cached('portrait:mario',  () => drawMarioHead()).cv;
      case 'bowser':   return cached('portrait:bowser', () => drawBowserHead()).cv;
      case 'herald':   return cached('portrait:herald', () => drawHeraldHead()).cv;
      default:         return cached('portrait:herald', () => drawHeraldHead()).cv;
    }
  },
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
