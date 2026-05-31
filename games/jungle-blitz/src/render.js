// Canvas 2D renderer for 丛林尖兵 JUNGLE BLITZ.
// Draws in FIELD space (960×540) via a letterbox transform; world layer is offset by -camX.

import { FIELD } from './config.js';

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
    const { world, player } = game;
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

  // --- Player placeholder ---
  _player(ctx, player, camX) {
    const px = player.x - camX;
    const py = player.y;

    // Body.
    ctx.fillStyle = '#cfe8a0';
    ctx.fillRect(px, py, player.w, player.h);

    // Facing indicator: small darker nub on the facing side.
    ctx.fillStyle = '#5a7a20';
    const nubW = 5;
    const nubH = 8;
    const nubY = py + player.h * 0.3;
    if (player.facing >= 0) {
      ctx.fillRect(px + player.w, nubY, nubW, nubH);
    } else {
      ctx.fillRect(px - nubW, nubY, nubW, nubH);
    }

    // Simple eye dot.
    ctx.fillStyle = '#1a2a05';
    const eyeX = player.facing >= 0 ? px + player.w - 7 : px + 4;
    ctx.beginPath();
    ctx.arc(eyeX, py + 10, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}
