// Pure progress / unlock logic for the level-select route map. No DOM, no storage.
// `best`  = highest cleared level (1-based; 0 = none cleared).
// `total` = number of levels (LEVELS.length).

// Clamp a possibly-stale / corrupt saved value into [0, total].
function _clampBest(best, total) {
  const b = Math.floor(Number(best) || 0);
  return Math.max(0, Math.min(b, total));
}

// Highest level (1-based) the player may currently enter: cleared ones + the next.
export function maxPlayableLevel(best, total) {
  return Math.min(_clampBest(best, total) + 1, total);
}

// Whether level `num` (1-based) is currently playable.
export function isPlayable(num, best, total) {
  return num >= 1 && num <= maxPlayableLevel(best, total);
}

// Node state for the route map: 'cleared' | 'next' | 'locked'.
export function levelNodeState(num, best, total) {
  const b = _clampBest(best, total);
  if (num <= b) return 'cleared';
  if (num === b + 1 && num <= total) return 'next';
  return 'locked';
}
