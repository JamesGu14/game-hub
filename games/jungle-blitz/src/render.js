// Canvas 2D renderer for 丛林尖兵 JUNGLE BLITZ.
// Draws in FIELD space (960×540) via a letterbox transform; world layer is offset by -camX.

import { FIELD, BULLET, GRENADE, PLAYER, WEAPONS } from './config.js';
const GRENADE_BLAST_R = GRENADE.blastR;

const POD_COLOR = {
  weaponS: '#ff9f43',
  weaponM: '#7af0ff',
  weaponL: '#b983ff',
  shield:  '#ffd86b',
  heal:    '#ff5d8f',
};
const POD_LABEL = {
  weaponS: 'S',
  weaponM: 'M',
  weaponL: 'L',
  shield:  '🛡',
  heal:    '❤️',
};

// Helper: draw a shield generator rect (phase 1 weak point).
// Called in world-space (ctx already translated by -camX).
function _drawGenerator(ctx, gx, gy, gw, gh, alive, flash, pulse) {
  const color = alive
    ? (flash ? '#ffffff' : '#4a8a60')
    : '#2a2a2a';   // destroyed/dim
  ctx.fillStyle = color;
  ctx.fillRect(gx, gy, gw, gh);

  if (alive) {
    // Glowing emitter on the face of the generator.
    ctx.save();
    ctx.shadowColor = flash ? '#ffffff' : '#44ff88';
    ctx.shadowBlur  = flash ? 25 : 14 * pulse;
    ctx.fillStyle   = flash ? '#ffffff' : `rgba(60,${Math.floor(200 + 50 * pulse)},100,0.9)`;
    const emitX = gx + gw * 0.55;
    const emitY = gy + gh * 0.2;
    ctx.fillRect(emitX, emitY, gw * 0.36, gh * 0.6);
    ctx.restore();

    // Connector line to body.
    ctx.strokeStyle = flash ? '#ffffff' : '#3a7a50';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(gx + gw, gy + gh / 2);
    ctx.lineTo(gx + gw + 6, gy + gh / 2);
    ctx.stroke();
  } else {
    // Broken X on destroyed generator.
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx + 4, gy + 4); ctx.lineTo(gx + gw - 4, gy + gh - 4);
    ctx.moveTo(gx + gw - 4, gy + 4); ctx.lineTo(gx + 4, gy + gh - 4);
    ctx.stroke();
  }
}

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

    // Menu state: draw jungle background only (HTML overlay covers it).
    if (game.state === 'menu' || !game.world) {
      this._menuBackground(ctx);
      return;
    }

    const { world, player, bullets, powerups, enemies } = game;

    this._background(ctx, world);
    this._worldLayer(ctx, world);
    if (powerups) this._powerups(ctx, powerups, world.camX);
    if (enemies)  this._enemies(ctx, enemies, world.camX);
    if (game.boss) this._boss(ctx, game.boss, world.camX);
    if (bullets)  this._bullets(ctx, bullets, world.camX);

    // Player blink during i-frames.
    const showPlayer = player.invMs <= 0 || (Math.floor(player.invMs / 80) % 2 === 0);
    if (showPlayer) this._player(ctx, player, world.camX);

    // Shield ring.
    if (player.shieldMs > 0) this._shieldRing(ctx, player, world.camX);

    // HUD (screen-space, drawn last on top).
    this._hud(ctx, game);
  }

  // Simple jungle gradient for the menu background.
  _menuBackground(ctx) {
    const W = FIELD.W;
    const H = FIELD.H;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#274b1a');
    grad.addColorStop(1, '#0c1408');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }

  // HUD drawn in field-space screen coordinates (not camera-offset).
  _hud(ctx, game) {
    const { player, score, stageIndex, stage } = game;
    const W = FIELD.W;
    const barH = 36;
    const pad = 10;

    // Translucent background strip.
    ctx.save();
    ctx.fillStyle = 'rgba(10,20,6,0.55)';
    ctx.fillRect(0, 0, W, barH + pad * 2);

    // -- Left: HP bar --
    const segW = 18;
    const segH = 12;
    const segGap = 3;
    const hpX = pad + 6;
    const hpY = pad + (barH - segH) / 2;
    for (let i = 0; i < PLAYER.hpMax; i++) {
      ctx.fillStyle = i < player.hp ? '#8bc34a' : '#2a3a18';
      ctx.fillRect(hpX + i * (segW + segGap), hpY, segW, segH);
    }
    // Lives.
    const livesX = hpX + PLAYER.hpMax * (segW + segGap) + 10;
    ctx.fillStyle = '#cfe8a0';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('\uD83E\uDAAB \xD7 ' + Math.max(0, player.lives), livesX, pad + barH / 2);

    // -- Center: boss HP bar (when boss active) or stage label --
    if (game.boss) {
      const boss = game.boss;
      const barW = 260;
      const bBarH = 14;
      const bBarX = W / 2 - barW / 2;
      const bBarY = pad + (barH - bBarH) / 2 - 2;
      const fillW = Math.max(0, (boss.hp / boss.hpMax) * barW);

      // Track (dark).
      ctx.fillStyle = '#1a0a0a';
      ctx.fillRect(bBarX, bBarY, barW, bBarH);

      // Fill: red → orange gradient.
      const hpGrad = ctx.createLinearGradient(bBarX, 0, bBarX + barW, 0);
      hpGrad.addColorStop(0, '#c0392b');
      hpGrad.addColorStop(1, '#e67e22');
      ctx.fillStyle = hpGrad;
      ctx.fillRect(bBarX, bBarY, fillW, bBarH);

      // Border.
      ctx.strokeStyle = '#7a3a00';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bBarX, bBarY, barW, bBarH);

      // Boss name label above bar.
      ctx.fillStyle = '#ffe0b0';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(boss.name, W / 2, bBarY);
    } else {
      ctx.fillStyle = '#cfe8a0';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('第 ' + (stageIndex + 1) + ' 关 · ' + (stage ? stage.name : ''), W / 2, pad + barH / 2);
    }

    // -- Right: weapon name + score --
    const weaponName = WEAPONS[player.weapon] ? WEAPONS[player.weapon].name : player.weapon;
    ctx.fillStyle = '#ffe27a';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(weaponName + '   ' + score, W - pad - 6, pad + barH / 2);

    ctx.restore();
  }

  // Translucent shield ring around player.
  _shieldRing(ctx, player, camX) {
    const cx = player.x + player.w / 2 - camX;
    const cy = player.y + player.height / 2;
    const r = Math.max(player.w, player.height) * 0.75;
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = '#7af0ff';
    ctx.lineWidth = 4;
    ctx.shadowColor = '#7af0ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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

  // --- Enemies + grenades ---
  _enemies(ctx, enemies, camX) {
    enemies.forEachActive(e => this._drawEnemy(ctx, e, camX));
    enemies.forEachBlast(g => this._drawBlast(ctx, g, camX));
    // Draw in-flight grenades.
    for (const g of enemies.grenades) {
      if (g.dead || g.exploded) continue;
      const gx = g.x - camX;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.arc(gx, g.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawEnemy(ctx, e, camX) {
    const ex = e.x - camX;
    const ey = e.y;
    const color = e.hitFlashMs > 0 ? '#ffffff' : e.color;

    ctx.save();
    ctx.fillStyle = color;

    switch (e.type) {
      case 'grunt': {
        // Body rect.
        ctx.fillRect(ex + 4, ey + 12, e.w - 8, e.h - 12);
        // Head.
        ctx.beginPath();
        ctx.arc(ex + e.w / 2, ey + 8, 8, 0, Math.PI * 2);
        ctx.fill();
        // Gun nub.
        ctx.fillStyle = e.hitFlashMs > 0 ? '#ffffff' : '#7a1a1a';
        const nubX = e.facing >= 0 ? ex + e.w : ex - 6;
        ctx.fillRect(nubX, ey + 16, 6, 3);
        break;
      }
      case 'turret': {
        // Trapezoid base.
        ctx.beginPath();
        ctx.moveTo(ex + 4, ey + e.h);
        ctx.lineTo(ex + e.w - 4, ey + e.h);
        ctx.lineTo(ex + e.w, ey + e.h * 0.5);
        ctx.lineTo(ex, ey + e.h * 0.5);
        ctx.closePath();
        ctx.fill();
        // Barrel toward facing.
        ctx.fillStyle = e.hitFlashMs > 0 ? '#ffffff' : '#5a6066';
        const barrelX = e.facing >= 0 ? ex + e.w * 0.6 : ex;
        ctx.fillRect(barrelX, ey + e.h * 0.3, e.w * 0.5 * e.facing, 6);
        break;
      }
      case 'drone': {
        // Horizontal diamond/ellipse body.
        ctx.beginPath();
        ctx.ellipse(ex + e.w / 2, ey + e.h / 2, e.w / 2, e.h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Blinking light.
        if (Math.floor(e.t * 4) % 2 === 0) {
          ctx.fillStyle = '#ff4444';
          ctx.beginPath();
          ctx.arc(ex + e.w / 2, ey + e.h / 2, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'jumper': {
        // Body.
        ctx.fillRect(ex + 2, ey + 10, e.w - 4, e.h - 14);
        // Head.
        ctx.beginPath();
        ctx.arc(ex + e.w / 2, ey + 7, 7, 0, Math.PI * 2);
        ctx.fill();
        // Legs (two small rects).
        ctx.fillStyle = e.hitFlashMs > 0 ? '#ffffff' : '#a06018';
        ctx.fillRect(ex + 3,      ey + e.h - 4, 6, 4);
        ctx.fillRect(ex + e.w - 9, ey + e.h - 4, 6, 4);
        break;
      }
      case 'grenadier': {
        // Body.
        ctx.fillRect(ex + 4, ey + 12, e.w - 8, e.h - 12);
        // Head.
        ctx.beginPath();
        ctx.arc(ex + e.w / 2, ey + 8, 8, 0, Math.PI * 2);
        ctx.fill();
        // Pack on back.
        ctx.fillStyle = e.hitFlashMs > 0 ? '#ffffff' : '#5a4020';
        const packX = e.facing >= 0 ? ex : ex + e.w - 8;
        ctx.fillRect(packX, ey + 14, 8, 14);
        break;
      }
      case 'nest': {
        // Bunker dome.
        ctx.beginPath();
        ctx.arc(ex + e.w / 2, ey + e.h, e.w / 2, Math.PI, 0);
        ctx.closePath();
        ctx.fill();
        // Darker slit.
        ctx.fillStyle = e.hitFlashMs > 0 ? '#ffffff' : '#3a2a10';
        ctx.fillRect(ex + 6, ey + e.h - 14, e.w - 12, 6);
        break;
      }
    }

    // HP pip strip above enemy.
    if (e.hpMax > 1) {
      const pipW = 4;
      const gap  = 2;
      const totalW = e.hpMax * (pipW + gap) - gap;
      const startX = ex + (e.w - totalW) / 2;
      for (let i = 0; i < e.hpMax; i++) {
        ctx.fillStyle = i < e.hp ? '#44ff44' : '#333';
        ctx.fillRect(startX + i * (pipW + gap), ey - 7, pipW, 3);
      }
    }

    ctx.restore();
  }

  _drawBlast(ctx, g, camX) {
    const progress = g.blastT / 0.25;
    const r = GRENADE_BLAST_R * progress;
    const gx = g.x - camX;
    ctx.save();
    ctx.globalAlpha = 0.55 * (1 - progress);
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(gx, g.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // --- Boss ---
  _boss(ctx, boss, camX) {
    if (!boss) return;
    if (boss.type === 'gunship')    { this._bossGunship(ctx, boss, camX);    return; }
    if (boss.type === 'mech')       { this._bossMech(ctx, boss, camX);       return; }
    if (boss.type === 'twinCannon') { this._bossTwinCannon(ctx, boss, camX); return; }
    if (boss.type === 'core')       { this._bossCore(ctx, boss, camX);       return; }

    // --- Default: gate ---
    const flash = boss.hitFlashMs > 0;
    const bx = boss.x - camX;
    const by = boss.y;
    const bw = boss.w;
    const bh = boss.h;

    ctx.save();

    // Gate body — armored steel pillar.
    ctx.fillStyle = flash ? '#ffffff' : '#5a6270';
    ctx.fillRect(bx, by, bw, bh);

    // Riveted panel lines (horizontal stripes for armored look).
    if (!flash) {
      ctx.strokeStyle = '#3a4250';
      ctx.lineWidth = 2;
      const stripes = 6;
      for (let i = 1; i < stripes; i++) {
        const sy = by + (bh / stripes) * i;
        ctx.beginPath();
        ctx.moveTo(bx, sy);
        ctx.lineTo(bx + bw, sy);
        ctx.stroke();
      }
      // Vertical center seam.
      ctx.beginPath();
      ctx.moveTo(bx + bw / 2, by);
      ctx.lineTo(bx + bw / 2, by + bh);
      ctx.stroke();
    }

    // Left-face accent border.
    ctx.fillStyle = flash ? '#ffffff' : '#3a4250';
    ctx.fillRect(bx, by, 6, bh);

    // Cannon port — upper.
    const portX = bx;
    const portUpperY = boss.portUpperY;
    const portLowerY = boss.portLowerY;
    const portR = 10;
    ctx.fillStyle = flash ? '#ffffff' : '#1a1a2a';
    ctx.beginPath();
    ctx.arc(portX, portUpperY, portR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#888fa0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cannon port — lower.
    ctx.fillStyle = flash ? '#ffffff' : '#1a1a2a';
    ctx.beginPath();
    ctx.arc(portX, portLowerY, portR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#888fa0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Central glowing core (the weak point).
    const cx = boss.coreX - camX;
    const cy = boss.coreY;
    const cw = boss.coreW;
    const ch = boss.coreH;
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 180);

    ctx.save();
    ctx.shadowColor = flash ? '#ffffff' : '#ff6600';
    ctx.shadowBlur = flash ? 30 : 18 * pulse;

    // Core backing rect.
    ctx.fillStyle = flash ? '#ffffff' : '#2a1000';
    ctx.fillRect(cx, cy, cw, ch);

    // Core fill — glowing orange/yellow.
    const coreColor = flash ? '#ffffff' : `rgba(255,${Math.floor(100 + 80 * pulse)},0,1)`;
    ctx.fillStyle = coreColor;
    const inset = 5;
    ctx.fillRect(cx + inset, cy + inset, cw - inset * 2, ch - inset * 2);

    // Core crosshair lines.
    if (!flash) {
      ctx.strokeStyle = '#ffdd88';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx + cw / 2, cy + inset);
      ctx.lineTo(cx + cw / 2, cy + ch - inset);
      ctx.moveTo(cx + inset, cy + ch / 2);
      ctx.lineTo(cx + cw - inset, cy + ch / 2);
      ctx.stroke();
    }

    ctx.restore();
    ctx.restore();
  }

  // --- Gunship boss (stage 2) ---
  _bossGunship(ctx, boss, camX) {
    const flash = boss.hitFlashMs > 0;
    const cx = boss.x + boss.w / 2 - camX;
    const cy = boss.y + boss.h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(boss.tilt || 0);

    const hw = boss.w / 2;
    const hh = boss.h / 2;

    // Fuselage (the hittable body).
    ctx.fillStyle = flash ? '#ffffff' : '#4a7a3a';
    ctx.beginPath();
    ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
    ctx.fill();

    // Nose cone (front, pointing right).
    ctx.fillStyle = flash ? '#ffffff' : '#3a6030';
    ctx.beginPath();
    ctx.moveTo(hw, -hh * 0.4);
    ctx.lineTo(hw + 22, 0);
    ctx.lineTo(hw, hh * 0.4);
    ctx.closePath();
    ctx.fill();

    // Tail boom.
    ctx.fillStyle = flash ? '#ffffff' : '#3a6030';
    ctx.fillRect(-hw - 28, -5, 28, 10);

    // Tail fin.
    ctx.fillStyle = flash ? '#ffffff' : '#2a4a20';
    ctx.beginPath();
    ctx.moveTo(-hw - 28, -5);
    ctx.lineTo(-hw - 28, -20);
    ctx.lineTo(-hw - 8, -5);
    ctx.closePath();
    ctx.fill();

    // Main rotor (spinning line on top).
    ctx.save();
    ctx.rotate(boss.rotorAngle || 0);
    ctx.strokeStyle = flash ? '#ffffff' : '#cfe8a0';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.shadowColor = '#cfe8a0';
    ctx.shadowBlur = flash ? 0 : 5;
    ctx.beginPath();
    ctx.moveTo(-46, -hh - 4);
    ctx.lineTo( 46, -hh - 4);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Cockpit window.
    if (!flash) {
      ctx.fillStyle = '#88ddff88';
      ctx.beginPath();
      ctx.ellipse(hw * 0.25, -hh * 0.1, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Gun pod (underside).
    ctx.fillStyle = flash ? '#ffffff' : '#1a2a10';
    ctx.fillRect(-10, hh - 2, 20, 12);

    ctx.restore();
  }

  // --- Heavy Mech boss (stage 3) ---
  _bossMech(ctx, boss, camX) {
    const flash = boss.hitFlashMs > 0;
    const bx = boss.x - camX;
    const by = boss.y;
    const W  = boss.w;
    const H  = boss.h;
    const step = boss.step || 0;

    ctx.save();

    // Legs (two rects, offset by step phase for walk animation).
    const legW = W * 0.22;
    const legH = H * 0.38;
    const legY  = by + H - legH;
    const lLegX = bx + W * 0.12;
    const rLegX = bx + W * 0.62;
    // Left leg bobs up, right leg bobs down when step > 0.5.
    const lOff = step < 0.5 ? -step * 10 : -(1 - step) * 10;
    const rOff = -lOff;

    ctx.fillStyle = flash ? '#ffffff' : '#6a7060';
    ctx.fillRect(lLegX, legY + lOff, legW, legH - lOff);
    ctx.fillRect(rLegX, legY + rOff, legW, legH - rOff);

    // Foot pads.
    ctx.fillStyle = flash ? '#ffffff' : '#3a4030';
    ctx.fillRect(lLegX - 3, by + H - 8, legW + 6, 8);
    ctx.fillRect(rLegX - 3, by + H - 8, legW + 6, 8);

    // Torso — main body.
    ctx.fillStyle = flash ? '#ffffff' : '#5a6050';
    ctx.fillRect(bx + W * 0.06, by + H * 0.38, W * 0.88, H * 0.50);

    // Shoulders.
    ctx.fillStyle = flash ? '#ffffff' : '#4a5040';
    ctx.fillRect(bx - 8,     by + H * 0.36, W * 0.22, H * 0.22);
    ctx.fillRect(bx + W - 14, by + H * 0.36, W * 0.22, H * 0.22);

    // Cannon barrels on shoulders.
    ctx.fillStyle = flash ? '#ffffff' : '#2a3020';
    ctx.fillRect(bx - 20, by + H * 0.40, 14, 8);
    ctx.fillRect(bx + W + 6, by + H * 0.40, 14, 8);

    // Head / upper hull.
    ctx.fillStyle = flash ? '#ffffff' : '#4a5040';
    ctx.fillRect(bx + W * 0.15, by + H * 0.08, W * 0.70, H * 0.32);

    // Cockpit (the weak point) — glowing viewport on the upper-front.
    const cRelX = W * 0.20;
    const cRelY = H * 0.12;
    const cW    = W * 0.38;
    const cH    = H * 0.25;
    const pulse  = 0.6 + 0.4 * Math.sin(Date.now() / 200);

    ctx.save();
    ctx.shadowColor = flash ? '#ffffff' : '#7af0ff';
    ctx.shadowBlur  = flash ? 30 : 14 * pulse;
    ctx.fillStyle   = flash ? '#ffffff' : `rgba(80,200,255,${0.7 + 0.3 * pulse})`;
    ctx.fillRect(bx + cRelX, by + cRelY, cW, cH);

    // Cockpit crosshair.
    if (!flash) {
      ctx.strokeStyle = '#ffffff88';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(bx + cRelX + cW / 2, by + cRelY + 3);
      ctx.lineTo(bx + cRelX + cW / 2, by + cRelY + cH - 3);
      ctx.moveTo(bx + cRelX + 3, by + cRelY + cH / 2);
      ctx.lineTo(bx + cRelX + cW - 3, by + cRelY + cH / 2);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  // --- Twin Cannon boss (stage 4) ---
  _bossTwinCannon(ctx, boss, camX) {
    const flash  = boss.hitFlashMs > 0;
    const bx     = boss.x - camX;
    const by     = boss.y;
    const bw     = boss.w;
    const bh     = boss.h;
    const aliveL = boss.hpLeft > 0;
    const aliveR = boss.hpRight > 0;
    const pulse  = 0.6 + 0.4 * Math.sin(Date.now() / 180);

    const tLX = boss.turretLX - camX;
    const tRX = boss.turretRX - camX;
    const tLY = boss.turretLY;
    const tRY = boss.turretRY;
    const tW  = boss.turretW;
    const tH  = boss.turretH;

    ctx.save();

    // Central hub — armored box.
    ctx.fillStyle = flash ? '#ffffff' : '#7a5a30';
    ctx.fillRect(bx, by, bw, bh);

    // Hub panel lines.
    if (!flash) {
      ctx.strokeStyle = '#5a4020';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bx, by + bh / 2);
      ctx.lineTo(bx + bw, by + bh / 2);
      ctx.stroke();
    }

    // Hub cog detail (circle on face).
    ctx.fillStyle = flash ? '#ffffff' : '#5a4020';
    ctx.beginPath();
    ctx.arc(bx + bw * 0.5, by + bh * 0.5, bh * 0.28, 0, Math.PI * 2);
    ctx.fill();

    // Left turret.
    const lColor = aliveL
      ? (flash ? '#ffffff' : '#8a6a3a')
      : '#3a2a15';   // darkened/broken
    ctx.fillStyle = lColor;
    ctx.fillRect(tLX, tLY, tW, tH);

    // Left barrel tip.
    ctx.fillStyle = aliveL ? (flash ? '#ffffff' : '#4a3a18') : '#1a1008';
    ctx.fillRect(tLX - 18, tLY + tH * 0.3, 18, tH * 0.4);

    // Left turret glowing weak point (only when alive).
    if (aliveL) {
      ctx.save();
      ctx.shadowColor = flash ? '#ffffff' : '#ff9f43';
      ctx.shadowBlur  = flash ? 30 : 12 * pulse;
      ctx.fillStyle   = flash ? '#ffffff' : `rgba(255,${Math.floor(120 + 60 * pulse)},20,0.9)`;
      const lGlowX = tLX + tW * 0.6;
      const lGlowY = tLY + tH * 0.2;
      ctx.fillRect(lGlowX, lGlowY, tW * 0.32, tH * 0.6);
      ctx.restore();
    } else {
      // Broken X on destroyed turret.
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tLX + 4, tLY + 4); ctx.lineTo(tLX + tW - 4, tLY + tH - 4);
      ctx.moveTo(tLX + tW - 4, tLY + 4); ctx.lineTo(tLX + 4, tLY + tH - 4);
      ctx.stroke();
    }

    // Right turret.
    const rColor = aliveR
      ? (flash ? '#ffffff' : '#8a6a3a')
      : '#3a2a15';
    ctx.fillStyle = rColor;
    ctx.fillRect(tRX, tRY, tW, tH);

    // Right barrel tip.
    ctx.fillStyle = aliveR ? (flash ? '#ffffff' : '#4a3a18') : '#1a1008';
    ctx.fillRect(tRX - 18, tRY + tH * 0.3, 18, tH * 0.4);

    // Right turret glowing weak point (only when alive).
    if (aliveR) {
      ctx.save();
      ctx.shadowColor = flash ? '#ffffff' : '#ff9f43';
      ctx.shadowBlur  = flash ? 30 : 12 * pulse;
      ctx.fillStyle   = flash ? '#ffffff' : `rgba(255,${Math.floor(120 + 60 * pulse)},20,0.9)`;
      const rGlowX = tRX + tW * 0.6;
      const rGlowY = tRY + tH * 0.2;
      ctx.fillRect(rGlowX, rGlowY, tW * 0.32, tH * 0.6);
      ctx.restore();
    } else {
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tRX + 4, tRY + 4); ctx.lineTo(tRX + tW - 4, tRY + tH - 4);
      ctx.moveTo(tRX + tW - 4, tRY + 4); ctx.lineTo(tRX + 4, tRY + tH - 4);
      ctx.stroke();
    }

    ctx.restore();
  }

  // --- Core boss (stage 5) ---
  _bossCore(ctx, boss, camX) {
    const flash  = boss.hitFlashMs > 0;
    const now    = Date.now();
    const pulse  = 0.6 + 0.4 * Math.sin(now / 180);
    const bx     = boss.x - camX;
    const by     = boss.y;
    const bw     = boss.w;
    const bh     = boss.h;

    // ── Explosion effect ─────────────────────────────────────────────────
    if (boss.exploding) {
      const t = boss.explodeT || 0;
      ctx.save();
      const cx = bx + bw / 2;
      const cy = by + bh / 2;
      // Draw three expanding concentric rings.
      for (let i = 0; i < 3; i++) {
        const rp = Math.min(1, t * 1.4 - i * 0.22);
        if (rp <= 0) continue;
        const r = rp * (80 + i * 30);
        ctx.globalAlpha = (1 - rp) * 0.7;
        ctx.strokeStyle = i === 0 ? '#ff6600' : i === 1 ? '#ffcc00' : '#ffffff';
        ctx.lineWidth = 6 - i * 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.5 * (1 - t);
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(cx, cy, t * 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.translate(-camX, 0);  // switch to world-space for all draws

    const wx = boss.x;   // world-space x
    const wy = boss.y;

    // ── Main body shell ───────────────────────────────────────────────────
    // Color varies by phase; flash overrides to white.
    const bodyColor = flash ? '#ffffff'
      : boss.phase === 3 ? '#6a1a1a'
      : boss.phase === 2 ? '#2a3a5a'
      : '#3a4a3a';
    ctx.fillStyle = bodyColor;
    ctx.fillRect(wx, wy, bw, bh);

    // Armored panel lines on body (horizontal).
    if (!flash) {
      ctx.strokeStyle = boss.phase === 3 ? '#4a0a0a' : '#1e2e2e';
      ctx.lineWidth = 2;
      const stripes = 5;
      for (let i = 1; i < stripes; i++) {
        const sy = wy + (bh / stripes) * i;
        ctx.beginPath();
        ctx.moveTo(wx, sy);
        ctx.lineTo(wx + bw, sy);
        ctx.stroke();
      }
      // Vertical center seam.
      ctx.beginPath();
      ctx.moveTo(wx + bw / 2, wy);
      ctx.lineTo(wx + bw / 2, wy + bh);
      ctx.stroke();
    }

    // Left-face accent.
    ctx.fillStyle = flash ? '#ffffff' : '#1a2a1a';
    ctx.fillRect(wx, wy, 6, bh);

    // ── Phase 1: shield generators (weak points) ─────────────────────────
    const { genLX, genLY, genRX, genRY, genW, genH } = boss;
    const aliveL = boss.genLAlive;
    const aliveR = boss.genRAlive;

    if (boss.phase === 1 || (boss.transitioning && boss.phase === 2)) {
      // Upper generator (L).
      _drawGenerator(ctx, genLX, genLY, genW, genH, aliveL, flash, pulse);
      // Lower generator (R).
      _drawGenerator(ctx, genRX, genRY, genW, genH, aliveR, flash, pulse);

      // Shield flicker during transition.
      if (boss.transitioning) {
        const flicker = Math.sin(Date.now() / 40) > 0;
        if (flicker) {
          ctx.save();
          ctx.globalAlpha = 0.25;
          ctx.fillStyle = '#7af0ff';
          ctx.fillRect(wx - genW, wy, bw + genW, bh);
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      }
    }

    // ── Phases 2 & 3: exposed glowing core ───────────────────────────────
    const { coreX, coreY, coreW, coreH } = boss;
    if (boss.phase >= 2 && !boss.transitioning) {
      // Phase 3 = red/enraged; phase 2 = cyan/blue.
      const coreGlow  = boss.phase === 3 ? '#ff3300' : '#00ccff';
      const coreInner = boss.phase === 3
        ? `rgba(255,${Math.floor(40 + 60 * pulse)},0,1)`
        : `rgba(0,${Math.floor(160 + 80 * pulse)},255,1)`;

      ctx.save();
      ctx.shadowColor = flash ? '#ffffff' : coreGlow;
      ctx.shadowBlur  = flash ? 35 : 22 * pulse;

      // Core backing.
      ctx.fillStyle = flash ? '#ffffff' : '#0a0a1a';
      ctx.fillRect(coreX, coreY, coreW, coreH);

      // Core fill — glowing.
      ctx.fillStyle = flash ? '#ffffff' : coreInner;
      const inset = 5;
      ctx.fillRect(coreX + inset, coreY + inset, coreW - inset * 2, coreH - inset * 2);

      // Crosshair.
      if (!flash) {
        ctx.strokeStyle = boss.phase === 3 ? '#ffaa8888' : '#88ddff88';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(coreX + coreW / 2, coreY + inset);
        ctx.lineTo(coreX + coreW / 2, coreY + coreH - inset);
        ctx.moveTo(coreX + inset,     coreY + coreH / 2);
        ctx.lineTo(coreX + coreW - inset, coreY + coreH / 2);
        ctx.stroke();
      }

      // Phase 3 crack lines on the body shell.
      if (boss.phase === 3 && !flash) {
        ctx.strokeStyle = '#ff330055';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(wx + bw * 0.3, wy + bh * 0.1);
        ctx.lineTo(wx + bw * 0.5, wy + bh * 0.35);
        ctx.lineTo(wx + bw * 0.4, wy + bh * 0.55);
        ctx.moveTo(wx + bw * 0.7, wy + bh * 0.15);
        ctx.lineTo(wx + bw * 0.55, wy + bh * 0.4);
        ctx.stroke();
      }

      ctx.restore();
    } else if (boss.phase === 1) {
      // Core is shielded in phase 1 — draw dim/locked center.
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#334455';
      ctx.fillRect(coreX, coreY, coreW, coreH);
      ctx.globalAlpha = 1;
      // Lock icon suggestion: small circle.
      ctx.fillStyle = '#556677';
      ctx.beginPath();
      ctx.arc(coreX + coreW / 2, coreY + coreH / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();

    // ── Phase pips on HUD boss bar (drawn in field-space, after world restore) ──
    // The shared HUD bar already shows boss.name. Draw small phase pips below it.
    const barW   = 260;
    const barCX  = 480;   // FIELD.W / 2
    const pipY   = 22;    // below boss name label area
    const pipR   = 5;
    const pipGap = 14;
    const phaseCount = 3;
    for (let i = 0; i < phaseCount; i++) {
      const px2 = barCX - (phaseCount - 1) * pipGap / 2 + i * pipGap;
      const active = i < boss.phase || (i === boss.phase - 1);
      ctx.save();
      ctx.fillStyle = i < boss.phase - 1 ? '#555'      // destroyed
        : i === boss.phase - 1 ? '#ff4400'              // current
        : '#334';                                        // future
      ctx.shadowColor = i === boss.phase - 1 ? '#ff8800' : 'transparent';
      ctx.shadowBlur  = i === boss.phase - 1 ? 8 : 0;
      ctx.beginPath();
      ctx.arc(px2, pipY, pipR, 0, Math.PI * 2);
      ctx.fill();
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
