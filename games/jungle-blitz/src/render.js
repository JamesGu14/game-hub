// Canvas 2D renderer for 丛林尖兵 JUNGLE BLITZ.
// Draws in FIELD space (960×540) via a letterbox transform; world layer is offset by -camX.

import { FIELD, BULLET } from './config.js';

const POD_COLOR = {
  weaponS: '#ff9f43',
  weaponM: '#7af0ff',
  weaponL: '#b983ff',
  shield:  '#7af0ff',
  heal:    '#ff5d8f',
};
const POD_LABEL = {
  weaponS: 'S',
  weaponM: 'M',
  weaponL: 'L',
  shield:  '🛡',
  heal:    '❤️',
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.scale = Math.min(w / FIELD.W, h / FIELD.H);
    this.offsetX = (w - FIELD.W * this.scale) / 2;
    this.offsetY = (h - FIELD.H * this.scale) / 2;
  }

  // Screen (CSS px) → field X, for pointer input.
  mapClientXToField(clientX) {
    return (clientX - this.offsetX) / this.scale;
  }

  render(game) {
    const { world, player, bullets, powerups } = game;
    const ctx = this.ctx;

    // Reset transform; clear and fill letterbox bars.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Enter field-space (0..960 × 0..540).
    ctx.setTransform(
      this.scale * this.dpr, 0,
      0, this.scale * this.dpr,
      this.offsetX * this.dpr,
      this.offsetY * this.dpr,
    );

    this._background(ctx, world);
    this._worldLayer(ctx, world);
    if (powerups) this._powerups(ctx, powerups, world.camX);
    if (bullets)  this._bullets(ctx, bullets, world.camX);
    this._player(ctx, player, world.camX);
  }

  // --- Background / parallax ---
  _background(ctx, world) {
    const { palette } = world;
    const W = FIELD.W;
    const H = FIELD.H;

    // Sky fill.
    ctx.fillStyle = palette.sky;
    ctx.fillRect(0, 0, W, H);

    // Far layer: rolling hills at 30% parallax scroll.
    ctx.fillStyle = palette.far;
    const farOff = (world.camX * 0.3) % W;
    for (let tx = -farOff - W; tx < W + W; tx += W) {
      ctx.beginPath();
      ctx.moveTo(tx, H);
      // Simple wavy hills via arcs.
      for (let i = 0; i <= 6; i++) {
        const cx = tx + (i + 0.5) * (W / 6);
        const cy = H - 100 - Math.sin(i * 1.3) * 40;
        ctx.arc(cx, cy, W / 9, Math.PI, 0);
      }
      ctx.lineTo(tx + W, H);
      ctx.closePath();
      ctx.fill();
    }

    // Mid layer: denser jungle silhouette at 60% parallax.
    ctx.fillStyle = palette.mid;
    const midOff = (world.camX * 0.6) % W;
    for (let tx = -midOff - W; tx < W + W; tx += W) {
      ctx.beginPath();
      ctx.moveTo(tx, H);
      for (let i = 0; i <= 8; i++) {
        const cx = tx + (i + 0.5) * (W / 8);
        const cy = H - 60 - Math.sin(i * 2.1 + 1) * 30;
        ctx.arc(cx, cy, W / 14, Math.PI, 0);
      }
      ctx.lineTo(tx + W, H);
      ctx.closePath();
      ctx.fill();
    }
  }

  // --- World layer (floors, platforms, decor) offset by -camX ---
  _worldLayer(ctx, world) {
    const { palette, camX } = world;
    const H = FIELD.H;
    const cullL = camX - 100;
    const cullR = camX + FIELD.W + 100;

    ctx.save();
    ctx.translate(-camX, 0);

    // Floors: filled rect from floor.y to bottom; lighter top edge.
    for (const f of world.floors) {
      if (f.x + f.w < cullL || f.x > cullR) continue;
      ctx.fillStyle = palette.ground;
      ctx.fillRect(f.x, f.y, f.w, H - f.y);
      // Top accent line.
      ctx.fillStyle = palette.accent;
      ctx.fillRect(f.x, f.y, f.w, 3);
    }

    // One-way platforms: thin bar in accent colour.
    for (const p of world.oneWayPlatforms()) {
      if (p.x + p.w < cullL || p.x > cullR) continue;
      ctx.fillStyle = palette.accent;
      ctx.globalAlpha = 0.9;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.globalAlpha = 1;
    }

    // Solid platforms (none in stage 1).
    for (const p of world.solids()) {
      if (p.x + p.w < cullL || p.x > cullR) continue;
      ctx.fillStyle = palette.ground;
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = palette.accent;
      ctx.fillRect(p.x, p.y, p.w, 3);
    }

    // Decor.
    for (const d of world.decor) {
      if (d.x + 80 < cullL || d.x - 80 > cullR) continue;
      if (d.type === 'tree') this._drawTree(ctx, d.x, d.y, palette);
      else if (d.type === 'tent') this._drawTent(ctx, d.x, d.y, palette);
    }

    ctx.restore();
  }

  _drawTree(ctx, x, groundY, palette) {
    // Trunk.
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(x - 5, groundY - 60, 10, 60);
    // Canopy (two triangles).
    ctx.fillStyle = palette.mid;
    ctx.beginPath();
    ctx.moveTo(x, groundY - 130);
    ctx.lineTo(x - 34, groundY - 60);
    ctx.lineTo(x + 34, groundY - 60);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = palette.far;
    ctx.beginPath();
    ctx.moveTo(x, groundY - 160);
    ctx.lineTo(x - 22, groundY - 100);
    ctx.lineTo(x + 22, groundY - 100);
    ctx.closePath();
    ctx.fill();
  }

  _drawTent(ctx, x, groundY, palette) {
    // Simple army tent triangle.
    ctx.fillStyle = '#6b7c4a';
    ctx.beginPath();
    ctx.moveTo(x, groundY - 70);
    ctx.lineTo(x - 55, groundY);
    ctx.lineTo(x + 55, groundY);
    ctx.closePath();
    ctx.fill();
    // Door opening.
    ctx.fillStyle = '#2a3010';
    ctx.beginPath();
    ctx.moveTo(x, groundY - 38);
    ctx.lineTo(x - 16, groundY);
    ctx.lineTo(x + 16, groundY);
    ctx.closePath();
    ctx.fill();
  }

  // --- Bullets ---
  _bullets(ctx, bullets, camX) {
    bullets.forEachActive(b => {
      const bx = b.x - camX;
      const by = b.y;
      if (b.kind === 'laser') {
        const angle = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(angle);
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = b.color;
        const hw = BULLET.laserLen / 2;
        const hh = BULLET.laserW / 2;
        const r  = hh;
        ctx.beginPath();
        ctx.moveTo(-hw + r, -hh);
        ctx.lineTo( hw - r, -hh);
        ctx.arcTo(  hw, -hh,  hw,  hh, r);
        ctx.lineTo( hw - r,  hh);
        ctx.lineTo(-hw + r,  hh);
        ctx.arcTo( -hw,  hh, -hw, -hh, r);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      } else {
        // normal bullet: filled circle with subtle glow + lighter inner dot
        ctx.save();
        ctx.shadowColor = b.color;
        ctx.shadowBlur = 6;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.arc(bx, by, BULLET.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        // inner highlight
        ctx.fillStyle = '#ffffff88';
        ctx.beginPath();
        ctx.arc(bx - 1, by - 1, BULLET.r * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });
  }

  // --- Power-up pods ---
  _powerups(ctx, powerups, camX) {
    for (const p of powerups.list) {
      if (p.dead) continue;
      const px = p.x - camX - p.w / 2;
      const py = p.y - p.h / 2;
      const color = POD_COLOR[p.kind] || '#ffffff';
      const label = POD_LABEL[p.kind] || '?';

      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = color + 'cc';
      const r = 6;
      const x = px, y = py, w = p.w, h = p.h;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y,     x + w, y + r,     r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x,     y + h, x,     y + h - r, r);
      ctx.lineTo(x,     y + r);
      ctx.arcTo(x,     y,     x + r, y,         r);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px + p.w / 2, py + p.h / 2);
      ctx.restore();
    }
  }

  // --- Player ---
  _player(ctx, player, camX) {
    // Use aabbBox() so crouch shows a shorter box.
    const box = typeof player.aabbBox === 'function'
      ? player.aabbBox()
      : { x: player.x, y: player.y, w: player.w, h: player.h };

    const px = box.x - camX;
    const py = box.y;
    const pw = box.w;
    const ph = box.h;

    // Body.
    ctx.fillStyle = '#cfe8a0';
    ctx.fillRect(px, py, pw, ph);

    // Facing indicator: small darker nub on the facing side.
    ctx.fillStyle = '#5a7a20';
    const nubW = 5;
    const nubH = 8;
    const nubY = py + ph * 0.3;
    const facing = player.facing !== undefined ? player.facing : 1;
    if (facing >= 0) {
      ctx.fillRect(px + pw, nubY, nubW, nubH);
    } else {
      ctx.fillRect(px - nubW, nubY, nubW, nubH);
    }

    // Simple eye dot.
    ctx.fillStyle = '#1a2a05';
    const eyeX = facing >= 0 ? px + pw - 7 : px + 4;
    ctx.beginPath();
    ctx.arc(eyeX, py + 10, 3, 0, Math.PI * 2);
    ctx.fill();

    // Gun muzzle nub — shows aim direction (real gameplay feature).
    if (player.aim && typeof player.muzzle === 'function') {
      const m = player.muzzle();
      const mx = m.x - camX;
      const my = m.y;
      const prone = player.prone || false;
      const gy = box.y + (prone ? ph - 8 : ph * 0.4);
      const gx = box.x + pw / 2 - camX;

      ctx.strokeStyle = '#ffe27a';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + player.aim.x * 14, gy + player.aim.y * 14);
      ctx.stroke();
    }
  }
}
