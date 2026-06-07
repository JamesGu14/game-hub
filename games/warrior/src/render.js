// Canvas 2D renderer for 丛林勇士. Draws the scene in FIELD space (camera-offset world),
// then scales + letterboxes onto the canvas. Menus/banners are HTML overlays + a couple
// of in-canvas banners. The try/finally around the clipped scene GUARANTEES a balanced
// transform so one bad frame can't leak the clip onto every following frame.

import { FIELD, TILE, THEMES } from './config.js';
import { Sprites } from './sprites.js';
import { Runner, Jumper } from './entities.js';

function poseKeyFromAim(aim) {
  if (aim.y < -0.3 && Math.abs(aim.x) < 0.3) return 'up';
  if (aim.y < -0.3) return 'upDiag';
  if (aim.y > 0.3 && Math.abs(aim.x) < 0.3) return 'down';
  if (aim.y > 0.3) return 'downDiag';
  return 'side';
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.scale = 1; this.offsetX = 0; this.offsetY = 0;
    Sprites.setThemes(THEMES);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.scale = Math.min(w / FIELD.W, h / FIELD.H);
    this.offsetX = (w - FIELD.W * this.scale) / 2;
    this.offsetY = (h - FIELD.H * this.scale) / 2;
    this._skyKey = null;
  }

  render(game) {
    const ctx = this.ctx;
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, this.offsetX * this.dpr, this.offsetY * this.dpr);
      ctx.imageSmoothingEnabled = false;

      const theme = (game.level && THEMES[game.level.theme]) || THEMES.forest;
      const bleedX = this.offsetX / (this.scale || 1);
      const bleedY = this.offsetY / (this.scale || 1);
      this._sky(ctx, theme, bleedX, bleedY);
      if (!game.level) return;

      const cam = game.camera;
      this._hills(ctx, theme, cam.x, bleedX);

      ctx.save();
      try {
        ctx.beginPath(); ctx.rect(0, 0, FIELD.W, FIELD.H); ctx.clip();
        const shake = game.shake > 0 ? game.shake : 0;
        const sx = shake ? (Math.sin(game._t * 90) * shake) : 0;
        ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y));
        this._tiles(ctx, game);
        this._goal(ctx, game);
        this._enemies(ctx, game);
        this._bullets(ctx, game);
        this._player(ctx, game);
        this._particles(ctx, game);
        this._floatTexts(ctx, game);
      } finally {
        ctx.restore();
      }

      this._hud(ctx, game);
      if (game.state === 'ready') this._banner(ctx, `${game.level.name}`, '准备出发！按 跳 / ✕ 开始');
      if (game.state === 'clear') this._banner(ctx, '关卡通关！🎉', '按 跳 / ✕ 返回');
    } catch (err) {
      if ((this._errs = (this._errs || 0) + 1) <= 8) console.error('[render] frame error — clearing caches:', err);
      try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch (_) { /* ignore */ }
      this._skyKey = null;
      Sprites.clearCache();
    }
  }

  _sky(ctx, theme, bleedX, bleedY) {
    const top = -bleedY, bot = FIELD.H + bleedY;
    const key = `${theme.skyTop}|${theme.skyBot}|${top}|${bot}`;
    if (this._skyKey !== key) {
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, theme.skyTop); g.addColorStop(1, theme.skyBot);
      this._skyGrad = g; this._skyKey = key;
    }
    ctx.fillStyle = this._skyGrad;
    ctx.fillRect(-bleedX, top, FIELD.W + 2 * bleedX, bot - top);
  }

  _hills(ctx, theme, camX, bleedX) {
    ctx.fillStyle = theme.hills;
    const hg = 240;
    const drift = (((-camX * 0.4) % hg) + hg) % hg;
    const n = Math.ceil((FIELD.W + 2 * bleedX) / hg) + 2;
    for (let i = 0; i < n; i++) {
      const x = -bleedX - hg + drift + i * hg;
      ctx.beginPath(); ctx.arc(x, FIELD.H - 36, 80, Math.PI, 0); ctx.fill();
    }
  }

  _tiles(ctx, game) {
    const grid = game.level.grid, themeKey = game.level.theme, cam = game.camera;
    const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const c1 = Math.min(game.level.cols - 1, Math.floor((cam.x + FIELD.W) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const r1 = Math.min(game.level.rows - 1, Math.floor((cam.y + FIELD.H) / TILE) + 1);
    for (let r = r0; r <= r1; r++) {
      const row = grid[r]; if (!row) continue;
      for (let c = c0; c <= c1; c++) {
        const t = row[c]; if (!t) continue;
        const cv = Sprites.tile(t, themeKey);
        Sprites.blit(ctx, cv, c * TILE, r * TILE, TILE / cv.width);
      }
    }
  }

  _goal(ctx, game) {
    const lv = game.level;
    if (lv.goalX == null) return;
    const cv = Sprites.goal();
    const bottom = lv.height - 4 * TILE;
    Sprites.blit(ctx, cv, lv.goalX, bottom, TILE / cv.width);
  }

  _enemies(ctx, game) {
    for (const e of game.enemies) {
      if (e.dead) continue;
      let cv = null;
      if (e instanceof Runner) cv = Sprites.runner(e.frame());
      else if (e instanceof Jumper) cv = Sprites.jumper(e.frame());
      if (cv) { const sc = e.w / cv.width; Sprites.blit(ctx, cv, e.x, e.y + e.h - cv.height * sc, sc); }
    }
  }

  _bullets(ctx, game) {
    const cv = Sprites.bullet();
    for (const b of game.bullets) {
      if (b.dead) continue;
      Sprites.blit(ctx, cv, b.x, b.y, b.w / cv.width);
    }
  }

  _player(ctx, game) {
    const p = game.player; if (!p) return;
    let alpha = 1;
    if (p.invuln > 0 && Math.floor(p.invuln * 16) % 2 === 0) alpha = 0.35;
    const cv = Sprites.hero(poseKeyFromAim(p.aim), p.faceRight, p.frame());
    const sc = p.w / cv.width;
    ctx.save(); ctx.globalAlpha = alpha;
    Sprites.blit(ctx, cv, p.x, p.y + p.h - cv.height * sc, sc);
    ctx.restore();
  }

  _particles(ctx, game) {
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color; ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  _floatTexts(ctx, game) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px system-ui, sans-serif';
    for (const t of game.floatTexts) {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = t.color || '#000'; ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y); ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  _hud(ctx, game) {
    const bandH = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, FIELD.W, bandH);
    const cy = bandH / 2;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffe066'; ctx.fillText(`⭐ ${game.score}`, 92, cy);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff';
    const livesTxt = game.mode.lives === Infinity ? '复活 ∞' : `❤️ ${game.lives}`;
    ctx.fillText(livesTxt, FIELD.W - 56, cy);
    ctx.textAlign = 'center';
    ctx.fillText(`${game.level ? game.level.name : ''}`, FIELD.W / 2, cy);
  }

  _banner(ctx, title, sub) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, FIELD.H / 2 - 44, FIELD.W, 88);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(title, FIELD.W / 2, FIELD.H / 2 - 8);
    ctx.font = '16px system-ui, sans-serif'; ctx.fillStyle = '#ffe066';
    ctx.fillText(sub, FIELD.W / 2, FIELD.H / 2 + 22);
  }
}
