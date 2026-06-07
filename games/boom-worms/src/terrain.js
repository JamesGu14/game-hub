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

    // --- Floors: stacked solid terraces creating real multi-tier (多个楼层) play.
    //     Late levels only. Wide, walkable, staggered, and kept clear of spawn
    //     columns so worms (which fall from the sky) never spawn inside solid. ---
    this._buildFloors(level, rng, heights, waterY);

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
    this._paintTopping(palette, level.theme);
  }

  // Build stacked solid terraces ("floors") for late, complex levels.
  // Deterministic (driven by the passed seeded rng). Each floor is a wide solid
  // slab a worm can stand and walk on; floors sit at 2-3 distinct tier heights and
  // are horizontally staggered to form genuine vertical structures with cover,
  // chokepoints, and interesting trajectories.
  //
  // Spawn safety: worms are released ABOVE the field and FALL onto the first solid
  // surface, so a floating slab over a spawn is a *valid landing*, never traps a
  // worm inside solid. Two guarantees keep it fair regardless:
  //   (1) every slab is a true FLOATING floor — its underside stays clearly above
  //       the ridgeline at the columns it covers, so it never seals a column shut;
  //   (2) the two OUTER corner spawns (leftmost player / rightmost enemy) get an
  //       open-sky guard so players can never be walled into a corner.
  _buildFloors(level, rng, heights, waterY) {
    const { ctx, W, H } = this;
    const floors = level.terrainParams.floors ?? 0;
    if (floors <= 0) return;

    const land = level.palette.land;
    const land2 = level.palette.land2;

    const spawnXs = this._spawnXs(level);
    // Only the extreme corner spawns get a keep-clear guard; inner spawns may have
    // a floating floor overhead (the worm just lands on it — that's the point).
    const cornerXs = spawnXs.length
      ? [Math.min(...spawnXs), Math.max(...spawnXs)]
      : [];
    const cornerGuard = 70;

    // Distinct walkable tiers (top y of each slab). Higher tier index = higher up.
    // Reachable: lowest tier sits a hop above the ~baseY (H*0.60) ground; highest
    // stays well below the peak ceiling (H*0.16).
    const tierTops = [
      Math.round(H * 0.50),  // low mezzanine  (~270)
      Math.round(H * 0.38),  // mid floor      (~205)
      Math.round(H * 0.27),  // upper floor    (~146)
    ];
    const thickness = 18;    // solid enough to stand on, thin enough to blast through
    const minW = 88;         // wide enough to stand & walk on
    // Keep an air gap between a slab's underside and the ground it floats over.
    const minAirGap = 26;

    // Candidate slabs. Concentrated in the field interior and staggered across
    // tiers so they overlap vertically (cover / line-of-sight blockers).
    const lanes = [
      { t: 0, frac: 0.50, w: 176 }, // central low platform (the hub)
      { t: 1, frac: 0.37, w: 134 }, // mid, left-of-center
      { t: 1, frac: 0.63, w: 134 }, // mid, right-of-center
      { t: 2, frac: 0.50, w: 120 }, // upper crow's nest, centered
      { t: 0, frac: 0.28, w: 112 }, // low ledge, left
      { t: 0, frac: 0.72, w: 112 }, // low ledge, right
      { t: 2, frac: 0.34, w: 100 }, // upper, left
      { t: 2, frac: 0.66, w: 100 }, // upper, right
    ];

    const candidates = lanes.map((lane) => {
      // Small deterministic jitter so themes differ but placement stays sensible.
      const jitter = (rng() - 0.5) * 36;
      const wj = Math.max(minW, Math.round(lane.w + (rng() - 0.5) * 24));
      let xc = Math.round(W * lane.frac + jitter);
      xc = Math.max(Math.round(wj / 2) + 8, Math.min(W - Math.round(wj / 2) - 8, xc));
      const pierRoll = rng();  // draw here so rng stream is stable regardless of placement
      return { tierTop: tierTops[lane.t], xc, w: wj, pierRoll };
    });

    let placed = 0;
    const placedRects = [];
    for (const c of candidates) {
      if (placed >= floors) break;
      const x0 = Math.round(c.xc - c.w / 2);
      const x1 = Math.round(c.xc + c.w / 2);

      // Guard ONLY the corner spawns — keep their sky open.
      let blocksCorner = false;
      for (const sx of cornerXs) {
        if (x1 + cornerGuard >= sx && sx >= x0 - cornerGuard) { blocksCorner = true; break; }
      }
      if (blocksCorner) continue;

      // Guarantee (1): underside must clear the ridgeline across the whole slab so
      // it stays a floating floor (never seals a column). Find the highest ground
      // (smallest y) under the footprint and require an air gap below the slab.
      let minGroundY = H;
      for (let x = Math.max(0, x0); x <= Math.min(W - 1, x1); x++) {
        if (heights[x] < minGroundY) minGroundY = heights[x];
      }
      if (c.tierTop + thickness + minAirGap > minGroundY) continue;

      // Avoid fusing two slabs on the SAME tier into one wide shelf.
      let dup = false;
      for (const r of placedRects) {
        if (r.tierTop === c.tierTop && x1 > r.x0 - 16 && x0 < r.x1 + 16) { dup = true; break; }
      }
      if (dup) continue;

      // Solid slab (painted onto the canvas -> becomes solid mask via _syncMask).
      ctx.fillStyle = land;
      ctx.fillRect(x0, c.tierTop, c.w, thickness);

      // Optional support pier: a narrow leg under the slab center for visual weight
      // and a chokepoint. It must STOP short of the ground (never seal a column) and
      // never plant onto a corner-spawn column.
      const pierX = c.xc | 0;
      const overCorner = cornerXs.some((sx) => Math.abs(sx - pierX) <= cornerGuard);
      if (c.pierRoll < 0.55 && !overCorner) {
        const pierW = 24;
        const groundHere = heights[Math.min(W - 1, Math.max(0, pierX))];
        const pierBottom = groundHere - minAirGap; // leave the air gap intact
        if (pierBottom > c.tierTop + thickness + 12) {
          ctx.fillStyle = land2;
          ctx.fillRect(Math.round(pierX - pierW / 2), c.tierTop + thickness, pierW, pierBottom - (c.tierTop + thickness));
        }
      }

      placedRects.push({ tierTop: c.tierTop, x0, x1 });
      placed++;
    }
  }

  // Recompute spawn x-positions for a level the same way buildLevel() does, so the
  // floor placer can keep those drop corridors open. Falls back to defaults if the
  // level was passed without counts.
  _spawnXs(level) {
    const W = this.W;
    const pc = level.playerCount ?? 3;
    const ec = level.enemyCount ?? 3;
    const spread = (count, lo, hi) => {
      if (count <= 1) return [Math.round((lo + hi) / 2)];
      const step = (hi - lo) / (count - 1);
      return Array.from({ length: count }, (_, k) => Math.round(lo + k * step));
    };
    return [
      ...spread(pc, 60, Math.round(W * 0.4)),
      ...spread(ec, Math.round(W * 0.6), W - 60),
    ];
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
  _paintTopping(palette, theme) {
    const { ctx, W, H } = this;
    // Save, set composite to source-atop so paint only covers existing solid pixels
    // but we want to draw ABOVE solid and leave alpha unchanged.
    // Strategy: draw a 1-px wide top-stripe per column in a contrasting color.
    const topColor = _toppingColor(palette, theme);
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

function _toppingColor(palette, theme) {
  // Bright accent stripe painted on solid tops — one entry per level theme (spec §4).
  const map = {
    grass: '#7ec850', candy: '#ff9fce', beach: '#f5d479', jungle: '#39b54a',
    sky: '#e8f4ff', rainbow: '#c678dd',
    cave: '#8a78a0', volcano: '#ff7a3c', ice: '#dff2fb', desert: '#f0c878',
    swamp: '#9ada4a', factory: '#aab0c0', ruins: '#c9a878', night: '#7a7ac0',
    finale: '#ff5a6a',
  };
  if (theme && map[theme]) return map[theme];
  // Legacy fallback: detect by land color (kept so a theme-less call still works).
  if (palette.land === '#ffffff') return '#d0eaff';
  if (palette.land === '#e8c97a') return '#f5d479';
  if (palette.land === '#ff69b4') return '#ffb3d9';
  if (palette.land === '#1a7a1a') return '#39b54a';
  if (palette.land === '#9b59b6') return '#c678dd';
  return '#7ec850';
}

function _hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}
