// games/turbo-drift/src/render.js
import { RENDER, VIEW } from './config.js';
import { project } from './util/math.js';

function trap(ctx, x1, y1, w1, x2, y2, w2, color) {
  ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x1 - w1, y1); ctx.lineTo(x1 + w1, y1);
  ctx.lineTo(x2 + w2, y2); ctx.lineTo(x2 - w2, y2); ctx.closePath(); ctx.fill();
}
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill();
}

function drawCar(ctx, x, y, w, color, tilt = 0, glow = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(tilt * 0.15);
  const h = w * 0.62;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath();
  ctx.ellipse(0, h * 0.2, w * 0.55, h * 0.18, 0, 0, 7); ctx.fill();
  if (glow) { ctx.shadowColor = color; ctx.shadowBlur = 12; }
  ctx.fillStyle = color; rr(ctx, -w / 2, -h * 0.5, w, h * 0.7, 8); ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; rr(ctx, -w * 0.3, -h * 0.4, w * 0.6, h * 0.32, 5);
  ctx.fillStyle = '#111'; rr(ctx, -w / 2 - 4, -h * 0.1, 8, h * 0.4, 3); rr(ctx, w / 2 - 4, -h * 0.1, 8, h * 0.4, 3);
  ctx.fillStyle = '#ffd54f'; ctx.fillRect(-w * 0.4, h * 0.1, w * 0.18, 5); ctx.fillRect(w * 0.22, h * 0.1, w * 0.18, 5);
  ctx.restore();
}

// world = { track, cam:{x,y,z}, player:{color,tilt,nitro}, ai:[{n,x,color}], boxes:[{n,x}], hud }
export function render(ctx, world) {
  const W = VIEW.W, H = VIEW.H;
  const track = world.track, segs = track.segs, N = segs.length, theme = track.theme;
  const cam = world.cam;
  const baseSeg = Math.floor(cam.z / RENDER.segLen) % N;

  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.6);
  sky.addColorStop(0, theme.sky[0]); sky.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

  // 赛道：从远到近，记录每段投影供精灵使用
  let x = 0, dx = 0, maxy = H;
  const proj = [];
  for (let n = 0; n < RENDER.drawDist; n++) {
    const idx = ((baseSeg + n) % N + N) % N;
    const s = segs[idx];
    const worldZ = (Math.floor(cam.z / RENDER.segLen) + n) * RENDER.segLen;
    dx += s.curve * 0.06; x += dx;
    const p = project({ x: cam.x - x * RENDER.roadW, y: cam.y, z: cam.z }, { x: 0, y: s.worldY, z: worldZ });
    proj[n] = { p };
    if (n === 0) continue;
    const prev = proj[n - 1].p;
    if (prev.y >= maxy || prev.scale <= 0) continue;
    maxy = prev.y;
    const dark = Math.floor(n / RENDER.rumble) % 2 === 0;
    const grass = dark ? theme.grass[0] : theme.grass[1];
    const road = dark ? theme.road[0] : theme.road[1];
    const rumble = dark ? theme.rumble[0] : theme.rumble[1];
    ctx.fillStyle = grass; ctx.fillRect(0, p.y, W, prev.y - p.y + 1);
    trap(ctx, prev.x, prev.y, prev.w, p.x, p.y, p.w, road);
    trap(ctx, prev.x, prev.y, prev.w * 1.12, p.x, p.y, p.w * 1.12, rumble);
    if (dark) trap(ctx, prev.x, prev.y, prev.w * 0.04, p.x, p.y, p.w * 0.04, '#f5f5f5');
  }

  // 道具箱（先画，远）
  ctx.textAlign = 'center';
  for (const b of world.boxes || []) {
    const pr = proj[b.n]; if (!pr || pr.p.scale <= 0) continue;
    ctx.font = `${Math.max(10, pr.p.w * 0.5)}px system-ui`;
    ctx.fillText('❓', pr.p.x + b.x * pr.p.w, pr.p.y);
  }
  // AI 车
  for (const a of world.ai || []) {
    const pr = proj[a.n]; if (!pr || pr.p.scale <= 0 || pr.p.y < H * 0.45) continue;
    drawCar(ctx, pr.p.x + a.x * pr.p.w, pr.p.y, pr.p.w * 0.9, a.color, 0, theme.night);
  }
  ctx.textAlign = 'left';

  // 玩家车 + 氮气尾焰
  const pl = world.player;
  if (pl.nitro) {
    ctx.fillStyle = 'rgba(0,229,255,0.7)';
    ctx.beginPath(); ctx.moveTo(W / 2 - 14, H - 14); ctx.lineTo(W / 2 + 14, H - 14);
    ctx.lineTo(W / 2, H - 14 + 22); ctx.fill();
  }
  drawCar(ctx, W / 2 + (pl.tilt || 0) * 40, H - 46, 150, pl.color, pl.tilt, pl.nitro);

  drawHud(ctx, world.hud);
}

function drawHud(ctx, hud) {
  if (!hud) return;
  const W = VIEW.W;
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(12, 12, 160, 64);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui';
  ctx.fillText(`🏁 第 ${hud.place}/${hud.total} 名`, 22, 32);
  ctx.fillText(`圈 ${hud.lap}/${hud.laps}`, 22, 52);
  ctx.fillText(`⏱ ${hud.time}`, 100, 32);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(W - 172, 14, 160, 10);
  ctx.fillStyle = '#ffd54f'; ctx.fillRect(W - 172, 14, 160 * (hud.driftPct || 0), 10);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(W - 172, 28, 160, 10);
  ctx.fillStyle = '#00e5ff'; ctx.fillRect(W - 172, 28, 160 * (hud.nitroPct || 0), 10);
  if (hud.item) { ctx.font = '20px system-ui'; ctx.fillText(hud.item, W - 40, 66); }
}
