// minimap.js — CS-style radar minimap
let _canvas = null;
let _ctx = null;
let _mapBoxes = [];
let _worldBounds = { minX: -20, maxX: 20, minZ: -12, maxZ: 12, span: 1 };
let _staticLayer = null; // pre-rendered grid + walls (rebuilt only on init)
const PAD = 12;          // canvas padding inside circle
const VIEW_RANGE = 25;   // world units visible on the radar

export function initMinimap(mapBoxes) {
  _canvas = document.getElementById('minimap');
  if (!_canvas) return;
  _ctx = _canvas.getContext('2d');
  _mapBoxes = mapBoxes || [];

  if (_mapBoxes.length > 0) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const b of _mapBoxes) {
      minX = Math.min(minX, b.min.x);
      maxX = Math.max(maxX, b.max.x);
      minZ = Math.min(minZ, b.min.z);
      maxZ = Math.max(maxZ, b.max.z);
    }
    const span = Math.max(maxX - minX, maxZ - minZ);
    const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
    _worldBounds = {
      minX: cx - span / 2,
      maxX: cx + span / 2,
      minZ: cz - span / 2,
      maxZ: cz + span / 2,
      span,
    };
  }

  _buildStaticLayer();
}

function _buildStaticLayer() {
  const w = _canvas.width, h = _canvas.height;
  _staticLayer = document.createElement('canvas');
  _staticLayer.width = w;
  _staticLayer.height = h;
  const ctx = _staticLayer.getContext('2d');

  // Grid lines (every 5 world units)
  ctx.strokeStyle = 'rgba(94,152,217,0.10)';
  ctx.lineWidth = 1;
  const { minX, maxX, minZ, maxZ } = _worldBounds;
  for (let gx = Math.ceil(minX / 5) * 5; gx <= maxX; gx += 5) {
    const [x1] = _worldToCanvas(gx, minZ);
    ctx.beginPath();
    ctx.moveTo(x1, 0); ctx.lineTo(x1, h);
    ctx.stroke();
  }
  for (let gz = Math.ceil(minZ / 5) * 5; gz <= maxZ; gz += 5) {
    const [, y1] = _worldToCanvas(minX, gz);
    ctx.beginPath();
    ctx.moveTo(0, y1); ctx.lineTo(w, y1);
    ctx.stroke();
  }

  // Walls
  ctx.fillStyle = 'rgba(94,152,217,0.18)';
  ctx.strokeStyle = 'rgba(140,200,255,0.65)';
  ctx.lineWidth = 1;
  for (const b of _mapBoxes) {
    const [x1, y1] = _worldToCanvas(b.min.x, b.min.z);
    const [x2, y2] = _worldToCanvas(b.max.x, b.max.z);
    const rw = Math.max(1, x2 - x1);
    const rh = Math.max(1, y2 - y1);
    ctx.fillRect(x1, y1, rw, rh);
    ctx.strokeRect(x1, y1, rw, rh);
  }
}

function _worldToCanvas(wx, wz) {
  const w = _canvas.width - PAD * 2;
  const h = _canvas.height - PAD * 2;
  const { minX, maxX, minZ, maxZ } = _worldBounds;
  const x = PAD + ((wx - minX) / (maxX - minX)) * w;
  const y = PAD + ((wz - minZ) / (maxZ - minZ)) * h;
  return [x, y];
}

export function renderMinimap(playerPos, playerYaw, playerFaction, botMeshes, opposingFaction) {
  if (!_ctx) return;
  const w = _canvas.width, h = _canvas.height;
  const cx = w / 2, cy = h / 2;
  const radius = Math.min(w, h) / 2 - 4;

  _ctx.clearRect(0, 0, w, h);

  // ── Circular clip + dark background ────────────────────────────────────
  _ctx.save();
  _ctx.beginPath();
  _ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  _ctx.clip();

  _ctx.fillStyle = 'rgba(8,16,22,0.92)';
  _ctx.fillRect(0, 0, w, h);

  // Static grid + walls (pre-rendered once in initMinimap)
  if (_staticLayer) _ctx.drawImage(_staticLayer, 0, 0);

  // Player position
  const [px, py] = _worldToCanvas(playerPos.x, playerPos.z);

  // View cone (FOV ~75°, range scaled to radar)
  const fovHalf = 37.5 * Math.PI / 180;
  const coneRange = 50; // canvas pixels
  _ctx.save();
  _ctx.translate(px, py);
  _ctx.rotate(-playerYaw + Math.PI);
  _ctx.fillStyle = 'rgba(255,255,255,0.10)';
  _ctx.beginPath();
  _ctx.moveTo(0, 0);
  _ctx.arc(0, 0, coneRange, -Math.PI / 2 - fovHalf, -Math.PI / 2 + fovHalf);
  _ctx.closePath();
  _ctx.fill();
  _ctx.restore();

  // Bots (enemy faction color dots, with red ring)
  const enemyColor = opposingFaction === 'CT' ? '#5e98d9' : '#e84b4b';
  for (const m of botMeshes) {
    const dist = Math.hypot(m.position.x - playerPos.x, m.position.z - playerPos.z);
    if (dist > VIEW_RANGE * 1.2) continue;
    const [bx, by] = _worldToCanvas(m.position.x, m.position.z);
    // Outer pulse
    _ctx.fillStyle = 'rgba(232,75,75,0.25)';
    _ctx.beginPath();
    _ctx.arc(bx, by, 6, 0, Math.PI * 2);
    _ctx.fill();
    // Inner dot
    _ctx.fillStyle = enemyColor;
    _ctx.beginPath();
    _ctx.arc(bx, by, 3, 0, Math.PI * 2);
    _ctx.fill();
  }

  // Player triangle (own faction color)
  const myColor = playerFaction === 'CT' ? '#5e98d9' : '#c79b6b';
  _ctx.save();
  _ctx.translate(px, py);
  _ctx.rotate(-playerYaw + Math.PI);
  _ctx.fillStyle = myColor;
  _ctx.strokeStyle = '#ffffff';
  _ctx.lineWidth = 1;
  _ctx.beginPath();
  _ctx.moveTo(0, -7);
  _ctx.lineTo(-5, 5);
  _ctx.lineTo(0, 2);
  _ctx.lineTo(5, 5);
  _ctx.closePath();
  _ctx.fill();
  _ctx.stroke();
  _ctx.restore();

  _ctx.restore(); // end circular clip

  // ── Radar ring (outside clip) ─────────────────────────────────────────
  _ctx.strokeStyle = 'rgba(140,200,255,0.55)';
  _ctx.lineWidth = 1.5;
  _ctx.beginPath();
  _ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  _ctx.stroke();

  // Inner ring (mid-range)
  _ctx.strokeStyle = 'rgba(140,200,255,0.18)';
  _ctx.lineWidth = 1;
  _ctx.beginPath();
  _ctx.arc(cx, cy, radius * 0.5, 0, Math.PI * 2);
  _ctx.stroke();

  // Compass marks (N/E/S/W)
  _ctx.fillStyle = 'rgba(180,220,255,0.65)';
  _ctx.font = 'bold 9px "Roboto Mono", monospace';
  _ctx.textAlign = 'center';
  _ctx.textBaseline = 'middle';
  _ctx.fillText('N', cx, cy - radius + 8);
  _ctx.fillText('S', cx, cy + radius - 8);
  _ctx.fillText('W', cx - radius + 8, cy);
  _ctx.fillText('E', cx + radius - 8, cy);
}
