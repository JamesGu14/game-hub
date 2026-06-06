// Destructible terrain. Pure mask helpers + Terrain class (canvas layer).
import { FIELD } from './config.js';

export function createMask(w, h) {
  return { w, h, cells: new Uint8Array(w * h) };
}
// Out-of-bounds: left/right/bottom are solid walls; above-top is air.
export function solidAt(m, x, y) {
  x = x | 0; y = y | 0;
  if (y < 0) return 0;
  if (x < 0 || x >= m.w || y >= m.h) return 1;
  return m.cells[y * m.w + x];
}
export function setCell(m, x, y, v) {
  if (x < 0 || x >= m.w || y < 0 || y >= m.h) return;
  m.cells[y * m.w + x] = v;
}
export function fillRect(m, x, y, w, h) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) setCell(m, i, j, 1);
}
export function carve(m, cx, cy, r) {
  const r2 = r * r;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (i * i + j * j <= r2) setCell(m, (cx + i) | 0, (cy + j) | 0, 0);
  }
}
// First solid y at/under (x, fromY). null if none.
export function groundY(m, x, fromY) {
  for (let y = Math.max(0, fromY | 0); y < m.h; y++) if (solidAt(m, x, y)) return y;
  return null;
}

// ---------------------------------------------------------------------------
// Terrain class — wraps the pure mask + an offscreen canvas (DOM layer).
// The canvas alpha channel IS the solid mask: alpha>128 = solid.
// generate() fills both; carveAt() clears both in lock-step.
// ---------------------------------------------------------------------------
export class Terrain {
  constructor() {
    this.W = FIELD.W;
    this.H = FIELD.H;
    this.mask = createMask(this.W, this.H);

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
  }

  // Draw the terrain silhouette onto the offscreen canvas, then sync mask.
  generate(level) {
    const { ctx, W, H } = this;
    const { palette, terrainParams } = level;
    const waterY = level.waterY ?? 512;

    ctx.clearRect(0, 0, W, H);

    const land = palette.land;
    const land2 = palette.land2;

    // --- Seeded RNG: terrain is deterministic per level (reproducible + testable) ---
    const rng = mulberry32((((level.index ?? 0) + 1) * 0x9e3779b1) >>> 0);

    // --- Mountain heightmap: layered cosine-interpolated value noise -> a rolling
    //     ridgeline. heights[x] is the topmost solid y of column x. ---
    const rugged = terrainParams.ruggedness ?? 0.5;        // 0 (gentle) .. 1 (jagged)
    const peaks  = terrainParams.peaks ?? 4;               // major peaks across the field
    const baseY  = Math.round(H * 0.60);                   // average ground line
    const amp    = (H * 0.30) * (0.45 + 0.55 * rugged);    // peak-to-valley swing
    const ceilY  = Math.round(H * 0.16);                   // highest a peak may reach
    const floorY = waterY - 22;                            // lowest a valley may dip

    const octaves = [
      noise1D(rng, W / Math.max(1, peaks)),
      noise1D(rng, W / Math.max(1, peaks * 2)),
      noise1D(rng, W / Math.max(1, peaks * 4)),
    ];
    const weights = [1.0, 0.5, 0.25];
    const wsum = weights[0] + weights[1] + weights[2];

    const heights = new Int16Array(W);
    for (let x = 0; x < W; x++) {
      let n = 0;
      for (let o = 0; o < octaves.length; o++) n += (octaves[o](x) - 0.5) * weights[o];
      n /= wsum;                                           // n in ~[-0.5, 0.5]
      let h = baseY - n * 2 * amp;
      if (h < ceilY) h = ceilY;
      if (h > floorY) h = floorY;
      heights[x] = h | 0;
    }
    this._heights = heights;                               // exposed for tests/debug

    // --- Fill the mountain silhouette column-by-column down to the water line ---
    ctx.fillStyle = land;
    for (let x = 0; x < W; x++) ctx.fillRect(x, heights[x], 1, waterY - heights[x]);

    // --- Platforms: floating ledges above the ridgeline ---
    const platCount = terrainParams.platforms ?? 0;
    ctx.fillStyle = land2;
    for (let p = 0; p < platCount; p++) {
      const px = Math.round(W * (0.15 + (p / Math.max(platCount, 1)) * 0.7));
      const groundHere = heights[Math.min(W - 1, Math.max(0, px))];
      const py = Math.round(groundHere - 70 - (p % 2) * 46);
      const pw = 104, ph = 20;
      ctx.beginPath();
      ctx.roundRect(px - pw / 2, py, pw, ph, 8);
      ctx.fill();
    }

    // --- Caves: carve elliptical holes into the mountain body ---
    const caveCount = terrainParams.caves ?? 0;
    if (caveCount > 0) {
      ctx.globalCompositeOperation = 'destination-out';
      for (let c = 0; c < caveCount; c++) {
        const cvx = Math.round(W * (0.2 + (c / Math.max(caveCount, 1)) * 0.6));
        const cvy = heights[Math.min(W - 1, Math.max(0, cvx))] + 46 + c * 18;
        ctx.beginPath();
        ctx.ellipse(cvx, cvy, 52, 26, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // --- Sync mask from canvas alpha ---
    this._syncMask();

    // --- Visual topping: grass / candy-frost stripe on solid tops (visual only) ---
    this._paintTopping(palette);
  }

  // Read canvas alpha into mask.cells.
  _syncMask() {
    const { ctx, W, H } = this;
    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    const cells = this.mask.cells;
    for (let i = 0; i < W * H; i++) {
      cells[i] = d[i * 4 + 3] > 128 ? 1 : 0;
    }
  }

  // Paint a decorative stripe along solid tops (visual only, does not change alpha mask).
  _paintTopping(palette) {
    const { ctx, W, H } = this;
    // Save, set composite to source-atop so paint only covers existing solid pixels
    // but we want to draw ABOVE solid and leave alpha unchanged.
    // Strategy: draw a 1-px wide top-stripe per column in a contrasting color.
    const topColor = _toppingColor(palette);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = topColor;
    // Scan each column, find topmost solid row, paint a thin stripe there
    const imgData = ctx.getImageData(0, 0, W, H);
    const d = imgData.data;
    const overlay = ctx.createImageData(W, H);
    const od = overlay.data;

    for (let x = 0; x < W; x++) {
      for (let y = 0; y < H; y++) {
        if (d[(y * W + x) * 4 + 3] > 128) {
          // topmost solid: paint a stripe of toppingColor (height 5px)
          const [r, g, b] = _hexToRgb(topColor);
          for (let dy = 0; dy < 5 && y + dy < H; dy++) {
            const idx = ((y + dy) * W + x) * 4;
            if (d[idx + 3] > 128) {
              od[idx] = r; od[idx + 1] = g; od[idx + 2] = b; od[idx + 3] = 255;
            }
          }
          break;
        }
      }
    }
    ctx.restore();
    // Composite the overlay on top
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = W; tmpCanvas.height = H;
    const tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.putImageData(overlay, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.drawImage(tmpCanvas, 0, 0);
    ctx.restore();
  }

  // Carve a circular explosion hole from both mask and canvas, in lock-step.
  carveAt(cx, cy, r) {
    // Update mask
    carve(this.mask, cx, cy, r);

    // Update canvas: erase circle + draw scorched rim
    const { ctx } = this;
    ctx.save();

    // Erase the solid circle
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Scorched rim: draw a semi-transparent dark ring (source-over, below normal alpha)
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const rimGrad = ctx.createRadialGradient(cx, cy, r * 0.75, cx, cy, r + 4);
    rimGrad.addColorStop(0, 'rgba(30,10,0,0.0)');
    rimGrad.addColorStop(0.7, 'rgba(30,10,0,0.6)');
    rimGrad.addColorStop(1, 'rgba(30,10,0,0.0)');
    ctx.fillStyle = rimGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Blit the offscreen terrain canvas onto targetCtx.
  draw(targetCtx, camX = 0) {
    targetCtx.drawImage(this.canvas, -camX, 0);
  }

  // Convenience wrappers matching the plan API
  solid(x, y) { return solidAt(this.mask, x, y); }
  ground(x, fromY) { return groundY(this.mask, x, fromY); }
}

// --- Helpers ---

// Small fast seeded PRNG (mulberry32). Deterministic per seed.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1-D cosine-interpolated value noise with the given lattice period (px).
// Returns f(x) -> [0,1], smooth between random lattice points.
function noise1D(rng, period) {
  period = Math.max(2, period);
  const count = Math.ceil(FIELD.W / period) + 2;
  const lattice = new Float64Array(count);
  for (let i = 0; i < count; i++) lattice[i] = rng();
  return (x) => {
    const t = x / period;
    const i = Math.floor(t);
    const f = t - i;
    const a = lattice[i % count];
    const b = lattice[(i + 1) % count];
    const u = (1 - Math.cos(f * Math.PI)) * 0.5;
    return a * (1 - u) + b * u;
  };
}

function _toppingColor(palette) {
  // Pick a bright accent for the terrain top stripe based on theme
  const map = {
    grass: '#7ec850',
    candy: '#ff9fce',
    beach: '#f5d479',
    jungle: '#39b54a',
    sky: '#e8f4ff',
    rainbow: '#c678dd',
  };
  // Try to detect theme from palette sky color heuristic, fall back to land
  if (palette.land === '#ffffff') return '#d0eaff';      // sky theme
  if (palette.land === '#e8c97a') return '#f5d479';      // beach
  if (palette.land === '#ff69b4') return '#ffb3d9';      // candy
  if (palette.land === '#1a7a1a') return '#39b54a';      // jungle
  if (palette.land === '#9b59b6') return '#c678dd';      // rainbow
  return '#7ec850';                                       // grass default
}

function _hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
