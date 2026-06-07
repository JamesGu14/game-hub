// Static level validation for 丛林勇士. Run: node tools/verify-levels.mjs
// Asserts each level parses and is playable: spawn over ground, goal right of spawn,
// valid falcon drops, boss arena solid, and no un-crossable pit (>3 tiles) on the floor.

import { TILE, SOLID } from '../src/config.js';
import { LEVELS, parseLevel } from '../src/levels.js';

const PICKUP_LETTERS = new Set(['M', 'S', 'L', 'F', 'B', 'R']);
let failures = 0;
const fail = (id, msg) => { failures++; console.error(`✖ [${id}] ${msg}`); };

function surfaceRow(grid, col) {
  for (let r = 0; r < grid.length; r++) if (grid[r] && grid[r][col] && SOLID.has(grid[r][col])) return r;
  return null;
}

for (const def of LEVELS) {
  let lv;
  try { lv = parseLevel(def); } catch (e) { fail(def.id || '?', 'parseLevel threw: ' + e.message); continue; }
  const before = failures;

  if (!lv.grid.length || !lv.cols) fail(lv.id, 'empty grid');
  if (surfaceRow(lv.grid, Math.floor(lv.spawn.x / TILE)) == null) fail(lv.id, 'spawn over a pit');
  if (!(lv.goalX > lv.spawn.x)) fail(lv.id, 'goalX not right of spawn');
  for (const f of (lv.falcons || [])) if (!PICKUP_LETTERS.has(f.drop)) fail(lv.id, `bad falcon drop "${f.drop}"`);
  if (lv.bossX != null && surfaceRow(lv.grid, Math.floor((lv.bossX + 2 * TILE) / TILE)) == null) fail(lv.id, 'boss over a pit');

  // No pit wider than 3 tiles on the lowest floor row (must be crossable with one jump).
  const floor = lv.grid[lv.rows - 1] || [];
  let gap = 0;
  for (let c = 0; c < lv.cols; c++) {
    if (floor[c] && SOLID.has(floor[c])) gap = 0;
    else if (++gap > 3) { fail(lv.id, `pit > 3 tiles near col ${c}`); break; }
  }

  if (failures === before) console.log(`✔ [${lv.id}] ${lv.name} (${lv.theme}) — ${lv.enemies.length} enemies, boss=${lv.bossType || 'none'}, diff×${lv.difficulty.enemyMul}`);
}

if (failures) { console.error(`\n${failures} problem(s) found.`); process.exit(1); }
console.log(`\nAll ${LEVELS.length} level(s) OK.`);
