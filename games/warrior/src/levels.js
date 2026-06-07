// Level data for 丛林勇士. Rows are TOP-DOWN strings using the TILES legend (config.js)
// plus entity markers: '@' player start, 'r' runner, 'j' jumper, 'G' goal flag.
// parseLevel() turns a level into a NAME grid + spawn + goalX + enemy list.

import { TILE, TILES } from './config.js';

const ENTITY_CHARS = new Set(['@', 'r', 'j', 'G']);

// L1 丛林 — tutorial: gentle jogging grunts, basic platforms, a couple of <=3-tile
// pits, ending at the goal flag (no BOSS in M1).
const lvl1 = {
  id: 'L1', name: '丛林', theme: 'forest',
  rows: [
    '                                                                                                            ',
    '                                                                                                            ',
    '                                                                                                            ',
    '                                                                                                            ',
    '                                    =====                              ====                                 ',
    '                      ===                            r        j                          =====             ',
    '              r                              X X              X X                                    G      ',
    '        @           r            j                 r              j          r        j         r          ',
    '###########   ##############   ###########   ##############   #############   #####################   ######',
    '###########   ##############   ###########   ##############   #############   #####################   ######',
    '###########   ##############   ###########   ##############   #############   #####################   ######',
    '###########   ##############   ###########   ##############   #############   #####################   ######',
  ],
};

export const LEVELS = [lvl1];

export function parseLevel(lvl) {
  const rows = lvl.rows;
  const numRows = rows.length;
  let cols = 0;
  for (const row of rows) cols = Math.max(cols, row.length);

  const grid = [];
  const enemies = [];
  let spawn = { x: 2 * TILE, y: 2 * TILE };
  let goalX = (cols - 2) * TILE;

  for (let rIdx = 0; rIdx < numRows; rIdx++) {
    const row = rows[rIdx];
    const gridRow = new Array(cols).fill(null);
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const ch = row[cIdx] || ' ';
      if (ch === ' ') continue;
      const px = cIdx * TILE, py = rIdx * TILE;

      if (ENTITY_CHARS.has(ch)) {
        if (ch === '@') spawn = { x: px, y: py };
        else if (ch === 'r') enemies.push({ type: 'runner', x: px, y: py });
        else if (ch === 'j') enemies.push({ type: 'jumper', x: px, y: py });
        else if (ch === 'G') goalX = px;
        continue;
      }

      const type = TILES[ch];
      if (!type) continue;
      gridRow[cIdx] = type;
    }
    grid.push(gridRow);
  }

  return {
    id: lvl.id,
    name: lvl.name,
    theme: lvl.theme,
    grid,
    cols,
    rows: numRows,
    width: cols * TILE,
    height: numRows * TILE,
    spawn,
    goalX,
    enemies,
  };
}
