// Canvas 2D renderer for 打砖块 BREAKOUT — candy theme.
// Draws the play scene in field-space (config FIELD) and letterboxes it to the canvas.
// Start/pause/win/over screens are HTML overlays (index.html), not drawn here.

import { FIELD, TOP_WALL, PADDLE, POWERUPS, HARD_CANDY } from './config.js';

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.min(255, Math.round(r + (255 - r) * amt));
  g = Math.min(255, Math.round(g + (255 - g) * amt));
  b = Math.min(255, Math.round(b + (255 - b) * amt));
  return `rgb(${r},${g},${b})`;
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

  // Screen (CSS px) → field X, for mouse/touch paddle control.
  mapClientXToField(clientX) {
    return (clientX - this.offsetX) / this.scale;
  }

  render(game) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    // Letterbox background.
    ctx.fillStyle = '#241133';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Enter field-space.
    ctx.setTransform(
      this.scale * this.dpr,
      0,
      0,
      this.scale * this.dpr,
      this.offsetX * this.dpr,
      this.offsetY * this.dpr,
    );

    this._fieldBackground(ctx);
    this._bricks(ctx, game);
    this._powerups(ctx, game);
    this._paddle(ctx, game);
    this._balls(ctx, game);
    this._particles(ctx, game);
    this._floatTexts(ctx, game);
    if (game.state === 'ready') this._readyHint(ctx, game);
    this._hud(ctx, game);
  }

  _fieldBackground(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.H);
    g.addColorStop(0, '#fff0fb');
    g.addColorStop(1, '#ffe1f1');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.W, FIELD.H);

    // Soft polka dots for a candy feel.
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let y = 90; y < FIELD.H; y += 70) {
      for (let x = 40; x < FIELD.W; x += 70) {
        const ox = (Math.floor(y / 70) % 2) * 35;
        ctx.beginPath();
        ctx.arc(x + ox, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Side walls.
    ctx.fillStyle = 'rgba(120,60,120,0.12)';
    ctx.fillRect(0, TOP_WALL, 4, FIELD.H);
    ctx.fillRect(FIELD.W - 4, TOP_WALL, 4, FIELD.H);
  }

  _candyBrick(ctx, b) {
    const top = lighten(b.color, 0.35);
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, top);
    g.addColorStop(1, b.color);
    ctx.fillStyle = g;
    rr(ctx, b.x, b.y, b.w, b.h, 8);
    ctx.fill();

    // Glossy highlight band.
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    rr(ctx, b.x + 4, b.y + 3, b.w - 8, b.h * 0.32, 5);
    ctx.fill();

    // Hard candy: wrapper stripes.
    if (b.type === 'hard' && b.hits === HARD_CANDY.hits) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x + 6, b.y + b.h - 4);
      ctx.lineTo(b.x + b.w - 6, b.y + 4);
      ctx.moveTo(b.x + b.w * 0.5, b.y + b.h - 4);
      ctx.lineTo(b.x + b.w - 6, b.y + b.h * 0.5);
      ctx.stroke();
    }
  }

  _bricks(ctx, game) {
    ctx.save();
    ctx.shadowColor = 'rgba(120,40,90,0.25)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    for (const b of game.bricks) {
      if (!b.alive) continue;
      this._candyBrick(ctx, b);
    }
    ctx.restore();
  }

  _paddle(ctx, game) {
    const p = game.paddle;
    const x = p.x - p.w / 2;
    const y = PADDLE.y;
    ctx.save();
    ctx.shadowColor = 'rgba(180,40,110,0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 3;
    const g = ctx.createLinearGradient(0, y, 0, y + PADDLE.h);
    g.addColorStop(0, '#ff8fc6');
    g.addColorStop(1, '#ff4f9e');
    ctx.fillStyle = g;
    rr(ctx, x, y, p.w, PADDLE.h, PADDLE.h / 2);
    ctx.fill();
    ctx.restore();
    // gloss
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    rr(ctx, x + 6, y + 2, p.w - 12, PADDLE.h * 0.34, 4);
    ctx.fill();
  }

  _balls(ctx, game) {
    for (const b of game.balls) {
      ctx.save();
      ctx.shadowColor = 'rgba(120,40,90,0.4)';
      ctx.shadowBlur = 8;
      const g = ctx.createRadialGradient(
        b.x - b.r * 0.3,
        b.y - b.r * 0.3,
        b.r * 0.2,
        b.x,
        b.y,
        b.r,
      );
      g.addColorStop(0, '#ffffff');
      g.addColorStop(1, '#ffd6ec');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // sparkle
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(b.x - b.r * 0.32, b.y - b.r * 0.32, b.r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _powerups(ctx, game) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const pu of game.powerups) {
      const def = POWERUPS.types[pu.type];
      const x = pu.x - POWERUPS.w / 2;
      const y = pu.y - POWERUPS.h / 2;
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.2)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = lighten(def.color, 0.15);
      rr(ctx, x, y, POWERUPS.w, POWERUPS.h, 6);
      ctx.fill();
      ctx.restore();
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(def.emoji, pu.x, pu.y + 1);
    }
  }

  _particles(ctx, game) {
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  _floatTexts(ctx, game) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 18px system-ui, sans-serif';
    for (const t of game.floatTexts) {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = t.color;
      ctx.lineWidth = 4;
      ctx.strokeText('+' + t.text, t.x, t.y);
      ctx.fillText('+' + t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  _readyHint(ctx, game) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(180,40,110,0.85)';
    ctx.fillText('按 空格 / 手柄A / 点击 发球 🚀', FIELD.W / 2, PADDLE.y - 26);
  }

  _hud(ctx, game) {
    // top band
    ctx.fillStyle = 'rgba(70,20,80,0.55)';
    ctx.fillRect(0, 0, FIELD.W, TOP_WALL);

    ctx.textBaseline = 'middle';
    const cy = TOP_WALL / 2;

    // Level (left) — inset to clear the fixed "← HUB" button in the corner.
    ctx.textAlign = 'left';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(
      `第 ${game.levelIndex + 1}/${game.totalLevels()} 关 · ${game.currentLevelName()}`,
      96,
      cy,
    );

    // Score (center)
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(`⭐ ${game.score}`, FIELD.W / 2, cy);

    // Lives (right, hearts) + effect icons
    ctx.textAlign = 'right';
    ctx.font = '18px system-ui, sans-serif';
    let hearts = '';
    for (let i = 0; i < game.lives; i++) hearts += '❤️';
    const fx = game.effectsActive();
    let badge = '';
    if (fx.wide) badge += '🟦';
    if (fx.slow) badge += '🐢';
    ctx.fillStyle = '#fff';
    // Inset to clear the fixed mute button in the corner.
    ctx.fillText((badge ? badge + '  ' : '') + (hearts || '💔'), FIELD.W - 58, cy);
  }
}
