// Physics helpers for 像素冒险 PIXEL QUEST: AABB overlap + swept tile collision.
// Entities have { x, y, w, h, vx, vy, onGround }. The grid is a 2D array of tile-type
// strings (or null) indexed grid[row][col], TILE px per cell. We move X then Y and
// resolve against SOLID tiles, reporting any tile bumped from below (for block bumps).

import { TILE, GRAVITY, MAX_FALL, SOLID } from './config.js';

export function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function solidAt(grid, col, row) {
  if (row < 0 || row >= grid.length) return false;
  const r = grid[row];
  if (!r) return false;
  if (col < 0 || col >= r.length) return false;
  const t = r[col];
  return !!t && SOLID.has(t);
}

// Integrate gravity + velocity and resolve against the solid grid.
// Returns { onGround, hitCeiling, bumped:[{col,row,type}], hitWall }.
export function collideTiles(ent, grid, dt, opts = {}) {
  const gravity = opts.gravity != null ? opts.gravity : GRAVITY;
  const info = { onGround: false, hitCeiling: false, bumped: [], hitWall: false };

  // Gravity
  ent.vy += gravity * dt;
  if (ent.vy > MAX_FALL) ent.vy = MAX_FALL;

  // ---- Move X ----
  ent.x += ent.vx * dt;
  let c0 = Math.floor(ent.x / TILE);
  let c1 = Math.floor((ent.x + ent.w - 0.001) / TILE);
  let row0 = Math.floor(ent.y / TILE);
  let row1 = Math.floor((ent.y + ent.h - 0.001) / TILE);

  if (ent.vx > 0) {
    for (let row = row0; row <= row1; row++) {
      if (solidAt(grid, c1, row)) {
        ent.x = c1 * TILE - ent.w;
        ent.vx = 0;
        info.hitWall = true;
        break;
      }
    }
  } else if (ent.vx < 0) {
    for (let row = row0; row <= row1; row++) {
      if (solidAt(grid, c0, row)) {
        ent.x = (c0 + 1) * TILE;
        ent.vx = 0;
        info.hitWall = true;
        break;
      }
    }
  }

  // ---- Move Y ----
  ent.y += ent.vy * dt;
  c0 = Math.floor(ent.x / TILE);
  c1 = Math.floor((ent.x + ent.w - 0.001) / TILE);
  row0 = Math.floor(ent.y / TILE);
  row1 = Math.floor((ent.y + ent.h - 0.001) / TILE);

  if (ent.vy > 0) {
    for (let col = c0; col <= c1; col++) {
      if (solidAt(grid, col, row1)) {
        ent.y = row1 * TILE - ent.h;
        ent.vy = 0;
        info.onGround = true;
        break;
      }
    }
  } else if (ent.vy < 0) {
    for (let col = c0; col <= c1; col++) {
      if (solidAt(grid, col, row0)) {
        ent.y = (row0 + 1) * TILE;
        ent.vy = 0;
        info.hitCeiling = true;
        info.bumped.push({ col, row: row0, type: grid[row0][col] });
      }
    }
  }

  ent.onGround = info.onGround;
  return info;
}

// Is the tile column under an entity's feet solid? Used by walking enemies to turn
// at ledges so they don't walk off platforms.
export function groundAhead(grid, x, footY) {
  const col = Math.floor(x / TILE);
  const row = Math.floor((footY + 2) / TILE);
  return solidAt(grid, col, row);
}
