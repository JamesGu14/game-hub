// Destructible terrain. Pure mask helpers here; canvas generate/draw added in Task 9.
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
