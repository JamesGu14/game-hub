// Validate ONE level object against the same physics rules as verify-levels.js.
// Usage: node tools/_validate_one.mjs /tmp/level-foo.mjs
//   where the file does `export default { id, name, theme, time, rows:[...] }`.
// Prints "PASS" or "FAIL" + the list of issues. Exit 0 = PASS.
import { parseLevel } from '../src/levels.js';
import { TILE, GRAVITY, PLAYER, BUMPABLE, SOLID } from '../src/config.js';

const apex = (PLAYER.jumpVel * PLAYER.jumpVel) / (2 * GRAVITY);
const airtime = (2 * PLAYER.jumpVel) / GRAVITY;
const walkDist = PLAYER.maxWalk * airtime;
const jumpUpTiles = Math.floor(apex / TILE);
const maxGap = Math.min(3, Math.floor(walkDist / TILE));
const maxStep = Math.max(1, jumpUpTiles - 1);
const WALK = new Set(['ground', 'block', 'platform', 'pipeL', 'pipeR']);

function check(world) {
  const { grid, cols, rows: numRows, spawn, checkpoint, flagX, castleX, id } = world;
  const floorTop = numRows - 4;
  const headApexY = floorTop * TILE - PLAYER.smallH - apex;
  const apexRow = Math.max(0, Math.floor(headApexY / TILE));
  const issues = [];
  const col = [], floorCol = [];
  for (let c = 0; c < cols; c++) {
    let top = null, floor = null;
    for (let r = 0; r < numRows; r++) {
      const t = grid[r] && grid[r][c];
      if (t && WALK.has(t)) { if (top === null) top = r; if (floor === null && r >= 1) floor = r; }
    }
    col.push(top); floorCol.push(floor);
  }
  const deadly = (c) => floorCol[c] === null;
  const sCol = Math.floor(spawn.x / TILE);
  const gCol = castleX != null ? Math.floor(castleX / TILE)
            : flagX != null ? Math.floor(flagX / TILE) : cols - 1;
  let run = 0, start = 0;
  for (let c = sCol; c <= gCol; c++) {
    if (deadly(c)) { if (run === 0) start = c; run++; }
    else { if (run > maxGap) issues.push(`pit cols ${start}-${start + run - 1} width ${run} > ${maxGap}`); run = 0; }
  }
  if (run > maxGap) issues.push(`pit cols ${start}-${start + run - 1} width ${run} > ${maxGap}`);
  for (let c = Math.max(1, sCol); c <= Math.min(gCol, cols - 2); c++) {
    if (!deadly(c)) continue;
    for (let cc = c - 1; cc <= c + 1; cc++)
      for (let r = apexRow; r < floorTop; r++) {
        const t = grid[r] && grid[r][cc];
        if (t && BUMPABLE.has(t)) issues.push(`block '${t}' at r${r} c${cc} blocks jump over pit c${c}`);
      }
  }
  for (let r = 0; r < apexRow; r++)
    for (let c = 0; c < cols; c++) {
      const t = grid[r] && grid[r][c];
      if (t && BUMPABLE.has(t)) issues.push(`block '${t}' at r${r} c${c} too high (need r>=${apexRow})`);
    }
  let prev = col[sCol];
  for (let c = sCol + 1; c <= gCol; c++) {
    const w = col[c];
    if (w == null) continue;
    if (prev != null && prev - w > maxStep) issues.push(`step at c${c}: rise ${prev - w} > ${maxStep}`);
    prev = w;
  }
  if (flagX == null && castleX == null) issues.push('no goal (flag/castle)');
  if (deadly(sCol)) issues.push('spawn over a pit');
  if (checkpoint) {
    const ccol = Math.round(checkpoint.x / TILE);
    const crow = Math.round(checkpoint.y / TILE);
    let grounded = false;
    for (let r = crow; r < numRows; r++) {
      const t = grid[r] && grid[r][ccol];
      if (t && SOLID.has(t)) { grounded = true; break; }
    }
    if (!grounded) issues.push(`checkpoint col ${ccol} over a pit (no ground below)`);
  }
  return { id, issues };
}

const arg = process.argv[2];
if (!arg) { console.error('usage: node tools/_validate_one.mjs <level-file.mjs>'); process.exit(2); }
const spec = arg.startsWith('/') ? 'file://' + arg : arg;
const mod = await import(spec);
const lvl = mod.default;
const rowLens = new Set((lvl.rows || []).map((r) => r.length));
const w = parseLevel(lvl);
const r = check(w);
console.log(`physics: apex=${apex.toFixed(0)} walkReachTiles=${(walkDist/TILE).toFixed(2)} maxGap=${maxGap} maxStep=${maxStep} apexRow=${Math.max(0,Math.floor((( (w.rows-4)*TILE)-PLAYER.smallH-apex)/TILE))}`);
console.log(`rows=${lvl.rows.length} rowLengths=${[...rowLens].join(',')} (should be a single value)`);
console.log(`flag=${w.flagX!=null?'Y':'-'} castle=${w.castleX!=null?'Y':'-'} checkpoint=${w.checkpoint?'Y':'-'} enemies=${w.enemies.length} coins=${w.coins.length}`);
if (r.issues.length) { console.log('FAIL:'); r.issues.forEach((i) => console.log('  - ' + i)); process.exit(1); }
console.log('PASS');
process.exit(0);
