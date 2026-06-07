export const aliveTeams = (teams) => teams.filter((t) => t.worms.some((w) => w.alive));

// Switch to the other team and pick its next alive worm (cyclic, per-team rotation
// tracked via team._idx). Returns {team, wormIdx} or null if nobody is alive.
export function nextActive(teams, cur) {
  const other = cur.team === 0 ? 1 : 0;
  for (const team of [other, cur.team]) {
    const worms = teams[team].worms;
    const start = team === cur.team ? cur.wormIdx + 1 : (teams[team]._idx ?? -1) + 1;
    for (let k = 0; k < worms.length; k++) {
      const idx = (start + k) % worms.length;
      if (worms[idx].alive) { teams[team]._idx = idx; return { team, wormIdx: idx }; }
    }
  }
  return null;
}

// Decide a round's outcome: returns winning team id (0|1), -1 draw, or null = continue.
// M1 implements only the `eliminate` objective (= last team standing). The objective
// and state params are accepted now (forward-compatible signature, spec §11.7) so M3
// can add timed / capture / decapitate branches without touching call sites. They are
// intentionally unused in M1.
export function checkOutcome(teams, objective = { type: 'eliminate' }, state = {}) {
  const live = teams.filter((t) => t.worms.some((w) => w.alive));
  if (live.length === 1) return live[0].id;
  if (live.length === 0) return -1; // draw
  return null;
}
