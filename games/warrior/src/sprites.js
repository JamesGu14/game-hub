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
};
