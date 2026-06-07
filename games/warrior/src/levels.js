// Level data for 丛林勇士. Rows are TOP-DOWN strings using the TILES legend (config.js)
// plus entity markers: '@' player start, 'r' runner, 'j' jumper, 'G' goal flag.
// parseLevel() turns a level into a NAME grid + spawn + goalX + enemy list.

import { TILE, TILES } from './config.js';

const ENTITY_CHARS = new Set(['@', 'r', 'j', 'u', 't', 'y', 'G']);

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
  falcons: [
    { drop: 'S', atX: 18 * 32, path: [[40, 3], [30, 4], [22, 3]] },
    { drop: 'B', atX: 52 * 32, path: [[72, 3], [60, 5], [50, 3]] },
  ],
  boss: { type: 'ironGate' },
};

// ---- L2–L5 built with an exact column placer (no hand-counting) ----
const W = 84;
function rr(runs) { // runs: [[startCol, str], ...] -> a W-wide row
  const a = new Array(W).fill(' ');
  for (const [start, str] of runs) for (let i = 0; i < str.length; i++) if (start + i >= 0 && start + i < W) a[start + i] = str[i];
  return a.join('');
}
const SKY = ' '.repeat(W);
const floorFull = '#'.repeat(W);
const floorPits = (...pits) => { // pits: [startCol, width]; width<=3
  const a = '#'.repeat(W).split('');
  for (const [c, w] of pits) for (let i = 0; i < w; i++) a[c + i] = ' ';
  return a.join('');
};

// L2 基地 (steel) — turrets + jumpers, vertical pillars, one short pit. BOSS 加尔玛.
const f2 = floorPits([28, 3]);
const lvl2 = {
  id: 'L2', name: '基地', theme: 'steel',
  difficulty: { enemyMul: 1.05, fireRateMul: 1.05, bossHpMul: 1.0 },
  rows: [
    SKY, SKY, SKY, SKY,
    rr([[16, '====='], [40, '====='], [62, '=====']]),
    rr([[18, 'X'], [42, 'X'], [64, 'X']]),
    rr([[36, 't'], [60, 't']]),
    rr([[5, '@'], [14, 'r'], [22, 'j'], [44, 'r'], [52, 'j'], [68, 'r'], [80, 'G']]),
    f2, f2, f2, f2,
  ],
  falcons: [{ drop: 'L', atX: 22 * 32, path: [[46, 3], [36, 4], [28, 3]] }],
  boss: { type: 'cyclops' },
};

// L3 瀑布 (beach变体) — flyers + platforms, two pits. BOSS 瓦尔基里.
const f3 = floorPits([20, 3], [51, 3]);
const lvl3 = {
  id: 'L3', name: '瀑布', theme: 'beach',
  difficulty: { enemyMul: 1.15, fireRateMul: 1.1, bossHpMul: 1.05 },
  rows: [
    SKY, SKY, SKY,
    rr([[26, 'y'], [46, 'y'], [66, 'y']]),
    rr([[24, '====='], [44, '====='], [64, '=====']]),
    SKY,
    rr([[5, '@'], [12, 'r'], [30, 'j'], [40, 'r'], [60, 'j'], [70, 'r'], [80, 'G']]),
    f3, f3, f3, f3,
  ],
  falcons: [{ drop: 'F', atX: 24 * 32, path: [[48, 3], [38, 4], [30, 3]] }],
  boss: { type: 'valkyrie' },
};

// L4 雪原 (snow) — dense gunners + turrets, flat slippery floor. BOSS 克隆.
const lvl4 = {
  id: 'L4', name: '雪原', theme: 'snow',
  difficulty: { enemyMul: 1.3, fireRateMul: 1.2, bossHpMul: 1.15 },
  rows: [
    SKY, SKY, SKY, SKY,
    rr([[20, '===='], [48, '===='], [66, '====']]),
    SKY,
    rr([[5, '@'], [14, 'u'], [22, 't'], [30, 'u'], [38, 'j'], [46, 't'], [54, 'u'], [62, 't'], [70, 'u'], [80, 'G']]),
    floorFull, floorFull, floorFull, floorFull,
  ],
  falcons: [{ drop: 'R', atX: 22 * 32, path: [[46, 3], [36, 4], [28, 3]] }],
  boss: { type: 'frost' },
};

// L5 敌巢 (abyss) — everything combined, one pit. BOSS 戈梅拉 (multi-phase).
const f5 = floorPits([30, 3]);
const lvl5 = {
  id: 'L5', name: '敌巢', theme: 'abyss',
  difficulty: { enemyMul: 1.5, fireRateMul: 1.4, bossHpMul: 1.3 },
  rows: [
    SKY, SKY, SKY,
    rr([[26, 'y'], [50, 'y'], [70, 'y']]),
    rr([[24, '===='], [52, '===='], [66, '====']]),
    SKY,
    rr([[5, '@'], [12, 'r'], [20, 'u'], [38, 't'], [46, 'j'], [54, 'u'], [62, 't'], [80, 'G']]),
    f5, f5, f5, f5,
  ],
  falcons: [{ drop: 'B', atX: 20 * 32, path: [[44, 3], [34, 4], [26, 3]] }],
  boss: { type: 'gomera' },
};

export const LEVELS = [lvl1, lvl2, lvl3, lvl4, lvl5];

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
        else if (ch === 'u') enemies.push({ type: 'gunner', x: px, y: py });
        else if (ch === 't') enemies.push({ type: 'turret', x: px, y: py });
        else if (ch === 'y') enemies.push({ type: 'flyer', x: px, y: py });
        else if (ch === 'G') goalX = px;
        continue;
      }

      const type = TILES[ch];
      if (!type) continue;
      gridRow[cIdx] = type;
    }
    grid.push(gridRow);
  }

  const falcons = (lvl.falcons || []).map((f) => ({
    drop: f.drop, atX: f.atX, path: (f.path || []).map(([x, y]) => ({ x, y })),
  }));
  const bossType = lvl.boss ? lvl.boss.type : null;
  const bossX = lvl.boss ? goalX - 5 * TILE : null; // trigger the fight just before the flag
  const difficulty = lvl.difficulty || { enemyMul: 1, fireRateMul: 1, bossHpMul: 1 };

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
    falcons,
    bossX,
    bossType,
    difficulty,
  };
}
