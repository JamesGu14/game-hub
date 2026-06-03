// Deterministic playability verifier for 像素冒险 PIXEL QUEST levels.
// Run: node games/pixel-quest/tools/verify-levels.js   (exit 0 = all pass)
import { LEVELS, parseLevel } from '../src/levels.js';
import { TILE, GRAVITY, PLAYER, BUMPABLE } from '../src/config.js';

const apex = (PLAYER.jumpVel * PLAYER.jumpVel) / (2 * GRAVITY);
const airtime = (2 * PLAYER.jumpVel) / GRAVITY;
const walkDist = PLAYER.maxWalk * airtime;
const jumpUpTiles = Math.floor(apex / TILE);
const maxGap = Math.min(3, Math.floor(walkDist / TILE));
const maxStep = Math.max(1, jumpUpTiles - 1);
const WALK = new Set(['ground', 'block', 'platform', 'pipeL', 'pipeR']);

function check(world) {
  const { grid, cols, rows: numRows, spawn, flagX, castleX, id } = world;
  const floorTop = numRows - 4;
  const headApexY = floorTop * TILE - PLAYER.smallH - apex;
  const apexRow = Math.max(0, Math.floor(headApexY / TILE));
  const issues = [];
  const col = [];
  for (let c = 0; c < cols; c++) {
    let walkTop = null;
    for (let r = 0; r < numRows; r++) {
      const t = grid[r] && grid[r][c];
      if (t && WALK.has(t) && walkTop === null) walkTop = r;
    }
    col.push(walkTop);
  }
  const deadly = (c) => col[c] === null;
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
