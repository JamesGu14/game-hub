// Deterministic playability verifier for 像素冒险 PIXEL QUEST levels.
// Run: node games/pixel-quest/tools/verify-levels.js   (exit 0 = all pass)
import { LEVELS, parseLevel } from '../src/levels.js';
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
  // Two surface profiles per column:
  //  - col[]  : topmost walkable INCLUDING row 0 — used for the step check, exactly
  //             as originally. On a castle/underground level the row-0 'X' ceiling
  //             makes this a no-op (every column reads row 0), which is the prior
  //             behaviour — we don't regress or add false step warnings there.
  //  - floorCol[] : topmost walkable EXCLUDING the row-0 ceiling — used for pit/gap
  //             and block-over-pit checks. Without this, the ceiling made every
  //             column look standable and hid every floor pit (the blind spot that
  //             let 4-wide, un-walk-jumpable gaps ship in 1-2 and 1-4).
  const col = [];
  const floorCol = [];
  for (let c = 0; c < cols; c++) {
    let top = null, floor = null;
    for (let r = 0; r < numRows; r++) {
      const t = grid[r] && grid[r][c];
      if (t && WALK.has(t)) {
        if (top === null) top = r;
        if (floor === null && r >= 1) floor = r;
      }
    }
    col.push(top);
    floorCol.push(floor);
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
  // A checkpoint must have solid ground directly below it, or respawning there
  // drops the player straight into a pit.
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

let fail = false;
console.log(`physics apex=${apex.toFixed(0)} airtime=${airtime.toFixed(2)} walkDist=${walkDist.toFixed(0)} jumpUpTiles=${jumpUpTiles} maxGap=${maxGap} maxStep=${maxStep}`);
for (const lvl of LEVELS) {
  const r = check(parseLevel(lvl));
  if (r.issues.length) { fail = true; console.log(`FAIL ${r.id}`); r.issues.forEach((i) => console.log('  - ' + i)); }
  else console.log(`PASS ${r.id}`);
}
process.exit(fail ? 1 : 0);
