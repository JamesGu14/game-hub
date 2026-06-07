// Code-drawn pixel sprites for 丛林勇士, cached on offscreen canvases and blitted with
// nearest-neighbour upscaling. M1 art is simple but readable; M5 polishes it. All
// sprites are authored in a small logical pixel grid and scaled up at blit time.

let THEMES = {};

const cache = new Map();
function make(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const c = cv.getContext('2d');
  c.imageSmoothingEnabled = false;
  draw(c);
  cache.set(key, cv);
  return cv;
}

function px(c, x, y, w, h, color) { c.fillStyle = color; c.fillRect(x, y, w, h); }

export const Sprites = {
  setThemes(t) { THEMES = t; },
  clearCache() { cache.clear(); },

  // Draw an offscreen canvas at world (x,y) scaled by `scale`, pixel-snapped.
  blit(ctx, cv, x, y, scale = 1) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(cv, Math.round(x), Math.round(y), cv.width * scale, cv.height * scale);
  },

  // ---- terrain ----
  tile(name, themeKey) {
    const th = THEMES[themeKey] || Object.values(THEMES)[0] || { ground: '#7a5a2f', groundDark: '#543d1f', grass: '#3fa845' };
    return make(`tile:${name}:${themeKey}`, 16, 16, (c) => {
      if (name === 'ground') {
        px(c, 0, 0, 16, 16, th.ground);
        px(c, 0, 0, 16, 4, th.grass);
        px(c, 0, 12, 16, 4, th.groundDark);
      } else if (name === 'platform') {
        px(c, 0, 0, 16, 6, th.grass);
        px(c, 0, 6, 16, 10, th.groundDark);
      } else if (name === 'block') {
        px(c, 0, 0, 16, 16, '#9a7a3a'); px(c, 2, 2, 12, 12, '#b8924a');
      } else if (name === 'cover') {
        px(c, 0, 0, 16, 16, '#5a6b3a'); px(c, 1, 1, 14, 14, '#6f8a47');
      }
    });
  },

  // ---- hero: soldier holding the gun along the aim direction ----
  // poseKey is derived from aim by render.js: 'side' | 'up' | 'upDiag' | 'down' | 'downDiag'
  hero(poseKey, faceRight, frame) {
    return make(`hero:${poseKey}:${faceRight ? 'R' : 'L'}:${frame}`, 16, 18, (c) => {
      if (!faceRight) { c.translate(16, 0); c.scale(-1, 1); }
      const skin = '#f1c27d', suit = '#3f6b2f', suitD = '#2f5022', gun = '#2b2b2b';
      // legs (tiny walk bob)
      const bob = frame === 1 ? 1 : 0;
      px(c, 4, 14 - bob, 3, 4, suitD);
      px(c, 9, 14 + bob, 3, 4, suitD);
      // torso
      px(c, 4, 6, 8, 8, suit);
      px(c, 4, 6, 8, 2, suitD);
      // head
      px(c, 5, 1, 6, 5, skin);
      px(c, 5, 1, 6, 2, '#5a3b1a'); // hair/helmet brim
      // gun along the aim direction
      if (poseKey === 'up') { px(c, 8, -3, 3, 9, gun); }
      else if (poseKey === 'upDiag') { px(c, 11, 1, 6, 3, gun); c.save(); c.translate(11, 4); c.rotate(-0.6); px(c, 0, 0, 7, 3, gun); c.restore(); }
      else if (poseKey === 'down') { px(c, 7, 12, 3, 8, gun); }
      else if (poseKey === 'downDiag') { c.save(); c.translate(11, 9); c.rotate(0.6); px(c, 0, 0, 7, 3, gun); c.restore(); }
      else { px(c, 11, 8, 7, 3, gun); } // side
    });
  },

  runner(frame) {
    return make(`runner:${frame}`, 16, 16, (c) => {
      const body = '#b5483a', bodyD = '#7d2b22', skin = '#f1c27d';
      const bob = frame === 1 ? 1 : 0;
      px(c, 3, 12 - bob, 3, 4, bodyD);
      px(c, 9, 12 + bob, 3, 4, bodyD);
      px(c, 3, 5, 9, 8, body);
      px(c, 5, 1, 6, 5, skin);
      px(c, 3, 5, 9, 2, bodyD);
    });
  },

  jumper(frame) {
    return make(`jumper:${frame}`, 16, 16, (c) => {
      const body = '#3a6fb5', bodyD = '#22467d', skin = '#f1c27d';
      px(c, 3, 12, 4, 4, bodyD);
      px(c, 9, 12, 4, 4, bodyD);
      px(c, 3, 4, 9, 9, body);
      px(c, 5, 1, 6, 4, skin);
      px(c, 3, 4, 9, 2, bodyD);
    });
  },

  bullet() {
    return make('bullet', 6, 3, (c) => { px(c, 0, 0, 6, 3, '#fff36b'); px(c, 0, 1, 5, 1, '#ffae2b'); });
  },

  goal() {
    return make('goal', 12, 40, (c) => {
      px(c, 5, 0, 2, 40, '#cfcfcf');       // pole
      px(c, 7, 2, 5, 8, '#ff5a3c');        // flag
    });
  },

  // ---- M2 art ----
  heroProne(faceRight) {
    return make(`heroProne:${faceRight ? 'R' : 'L'}`, 18, 10, (c) => {
      if (!faceRight) { c.translate(18, 0); c.scale(-1, 1); }
      const skin = '#f1c27d', suit = '#3f6b2f', suitD = '#2f5022', gun = '#2b2b2b';
      px(c, 2, 4, 11, 5, suit); px(c, 2, 4, 11, 2, suitD); // prone body
      px(c, 1, 1, 5, 4, skin);                              // head forward
      px(c, 12, 5, 6, 3, gun);                              // gun forward
    });
  },

  boss(typeId, frame) {
    const skin = {
      ironGate: { body: '#5a5f6b', dark: '#3a3f4a', core: '#ff5a3c' },
      cyclops:  { body: '#6b4a7a', dark: '#46314f', core: '#ff3ca0' },
      valkyrie: { body: '#4a5a6b', dark: '#31404f', core: '#3cd0ff' },
      frost:    { body: '#7a93a8', dark: '#4f6678', core: '#aef0ff' },
      gomera:   { body: '#7a2a3a', dark: '#4f1422', core: '#ff5a3c' },
    }[typeId] || { body: '#5a5f6b', dark: '#3a3f4a', core: '#ff5a3c' };
    return make(`boss:${typeId}:${frame}`, 48, 56, (c) => {
      px(c, 2, 6, 44, 50, skin.body);
      px(c, 2, 6, 44, 6, skin.dark);
      for (let i = 0; i < 4; i++) { px(c, 6 + i * 11, 12, 3, 3, '#2a2e36'); px(c, 6 + i * 11, 48, 3, 3, '#2a2e36'); }
      px(c, 14, 22, 20, 14, '#1a1d24');         // brow socket
      px(c, 18, 25, 12, 8, frame % 2 ? skin.core : '#ffd23f'); // glowing core (weakpoint)
      px(c, 21, 27, 6, 4, '#fff3b0');
      px(c, 6, 52, 8, 4, skin.dark); px(c, 34, 52, 8, 4, skin.dark); // feet
    });
  },

  falcon(frame) {
    return make(`falcon:${frame}`, 20, 12, (c) => {
      const body = '#d83a2a', wing = frame % 2 ? '#b52b1e' : '#f04a36';
      px(c, 6, 4, 9, 5, body);
      px(c, 14, 5, 4, 3, '#ffcc33');          // beak
      px(c, 2, frame % 2 ? 2 : 6, 7, 3, wing); // flapping wing
      px(c, 8, 9, 4, 2, '#7d2b22');           // talons
    });
  },

  pickupLetter(letter) {
    const colors = { M: '#ffd23f', S: '#5fd97a', L: '#4f9bff', F: '#ff7a1a', B: '#c46bff', R: '#ff5a8a' };
    return make(`pk:${letter}`, 20, 20, (c) => {
      px(c, 1, 1, 18, 18, '#10140c');
      px(c, 2, 2, 16, 16, colors[letter] || '#ffffff');
      c.fillStyle = '#10140c';
      c.font = 'bold 14px monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(letter, 10, 11);
    });
  },

  gunner(frame) {
    return make(`gunner:${frame}`, 16, 16, (c) => {
      const body = '#6a4f8a', d = '#473563', skin = '#f1c27d', gun = '#2b2b2b';
      px(c, 3, 12 - (frame ? 1 : 0), 3, 4, d); px(c, 9, 12, 3, 4, d);
      px(c, 3, 5, 9, 8, body); px(c, 3, 5, 9, 2, d);
      px(c, 5, 1, 6, 5, skin);
      px(c, 11, 8, 6, 3, gun);
    });
  },
  turret(frame) {
    return make(`turret:${frame}`, 18, 14, (c) => {
      px(c, 1, 8, 16, 6, '#4a4f57');
      px(c, 5, 3, 8, 6, frame ? '#8a929c' : '#6b7280');
      px(c, 12, 5, 6, 3, '#2b2b2b');
      px(c, 7, 5, 3, 2, '#ff5a3c');
    });
  },
  flyer(frame) {
    return make(`flyer:${frame}`, 18, 12, (c) => {
      const body = '#3a8a6f', wing = frame ? '#2f6e59' : '#4fae8d';
      px(c, 6, 4, 7, 5, body);
      px(c, 2, frame ? 2 : 6, 6, 3, wing);
      px(c, 13, 5, 4, 2, '#ffcc33');
      px(c, 8, 3, 3, 2, '#ff5a3c');
    });
  },
  enemyBullet() {
    return make('ebullet', 7, 7, (c) => { px(c, 1, 1, 5, 5, '#ff5a3c'); px(c, 2, 2, 3, 3, '#ffd23f'); });
  },
  fireball(frame) {
    return make(`fireball:${frame}`, 10, 10, (c) => {
      px(c, 1, 1, 8, 8, frame ? '#ff7a1a' : '#ff5a10'); px(c, 3, 3, 4, 4, '#ffe066');
    });
  },
};
