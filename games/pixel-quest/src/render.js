// Canvas 2D renderer for 像素冒险 PIXEL QUEST.
// Draws the scene in FIELD space (camera-offset world), then scales + letterboxes
// onto the canvas. Menus/story/pause/etc. are HTML overlays (index.html).

import { FIELD, TILE, THEMES } from './config.js';
import { Sprites } from './sprites.js';
import { Goomba, Koopa, Flyer, Dasher, Piranha, Spiked, Flamer } from './entities.js';

const SC = TILE / 16; // sprite logical px -> world px (tiles are drawn at 16px)

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    Sprites.setThemes(THEMES);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    // Cap DPR at 1.5: pixel art is nearest-neighbour upscaled, so 1.5 looks crisp
    // while cutting the canvas backing store ~44% vs 2.0 — less fillrate (smoother)
    // and less canvas memory (a likely factor in the iPad black-screen).
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.scale = Math.min(w / FIELD.W, h / FIELD.H);
    this.offsetX = (w - FIELD.W * this.scale) / 2;
    this.offsetY = (h - FIELD.H * this.scale) / 2;
    this._skyKey = null; // force the cached sky gradient to rebuild at the new size
  }

  render(game) {
    const ctx = this.ctx;
    try {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Enter field-space.
      ctx.setTransform(
        this.scale * this.dpr, 0, 0, this.scale * this.dpr,
        this.offsetX * this.dpr, this.offsetY * this.dpr,
      );
      ctx.imageSmoothingEnabled = false;

      // Fall back to a known theme if a level ever names one we don't have, so a bad
      // theme key can't make `theme` undefined and throw inside _sky/_parallax.
      const theme = (game.level && THEMES[game.level.theme]) || THEMES.overworld;

      // Letterbox "bleed": how far the field extends past 0..FIELD in field units, so
      // the sky/clouds/hills can fill the whole window instead of leaving black bars.
      const bleedX = this.offsetX / (this.scale || 1);
      const bleedY = this.offsetY / (this.scale || 1);

      if (!game.level) {
        this._sky(ctx, theme, bleedX, bleedY);
        return;
      }

      const cam = game.camera;
      this._sky(ctx, theme, bleedX, bleedY);
      this._parallax(ctx, theme, cam.x, bleedX, bleedY);

      // Clip gameplay to the field. The try/finally GUARANTEES the matching
      // restore() even if a draw throws — otherwise one bad frame leaks the clip +
      // translate onto every following frame, which is exactly the "screen goes
      // black, only clouds/buttons remain" bug (HUD draws after restore, so it
      // vanished too). Now the stack is always balanced.
      ctx.save();
      try {
        ctx.beginPath();
        ctx.rect(0, 0, FIELD.W, FIELD.H);
        ctx.clip();
        ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
        this._tiles(ctx, game, theme, cam);
        this._flagAndCastle(ctx, game);
        this._coins(ctx, game);
        this._powerups(ctx, game);
        this._enemies(ctx, game);
        this._fireballs(ctx, game);
        this._enemyShots(ctx, game);
        this._player(ctx, game);
        if (game.state === 'ending') this._ending(ctx, game);
        this._particles(ctx, game);
        this._floatTexts(ctx, game);
      } finally {
        ctx.restore();
      }

      this._hud(ctx, game);
      if (game.state === 'ready') this._readyBanner(ctx, game);
    } catch (err) {
      // Self-heal: under iOS Safari memory pressure an offscreen sprite canvas can
      // be evicted/blanked, or getContext can fail, throwing mid-frame. Reset the
      // transform and drop the sprite + sky caches so the next frame rebuilds them
      // cleanly instead of the screen staying black until reload. Bounded logging
      // surfaces the real cause if it keeps happening.
      if ((this._renderErrs = (this._renderErrs || 0) + 1) <= 8) {
        console.error('[render] frame error — clearing caches to recover:', err);
      }
      try { ctx.setTransform(1, 0, 0, 1, 0, 0); } catch (_) { /* ignore */ }
      this._skyKey = null;
      Sprites.clearCache();
    }
  }

  _sky(ctx, theme, bleedX, bleedY) {
    const top = -bleedY;
    const bot = FIELD.H + bleedY;
    // Cache the gradient — rebuilding it every frame allocated a new object 60×/s,
    // which showed up as periodic GC stutter. Only rebuild when theme/size changes.
    const key = `${theme.skyTop}|${theme.skyBot}|${top}|${bot}`;
    if (this._skyKey !== key) {
      const g = ctx.createLinearGradient(0, top, 0, bot);
      g.addColorStop(0, theme.skyTop);
      g.addColorStop(1, theme.skyBot);
      this._skyGrad = g;
      this._skyKey = key;
    }
    ctx.fillStyle = this._skyGrad;
    ctx.fillRect(-bleedX, top, FIELD.W + 2 * bleedX, bot - top);
  }

  _parallax(ctx, theme, camX, bleedX, bleedY) {
    const left = -bleedX;
    const spanW = FIELD.W + 2 * bleedX;
    const top = -bleedY;

    // clouds (slow) — tiled across the full visible width incl. letterbox margins
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    const cg = 220;
    const cDrift = (((-camX * 0.3) % cg) + cg) % cg;
    const nC = Math.ceil(spanW / cg) + 2;
    for (let i = 0; i < nC; i++) {
      const x = left - cg + cDrift + i * cg;
      const y = top + 30 + (i % 3) * 36;
      this._cloud(ctx, x, y);
    }

    // hills (medium) — tiled across the full visible width
    ctx.fillStyle = theme.hills;
    const hg = 260;
    const hDrift = (((-camX * 0.5) % hg) + hg) % hg;
    const nH = Math.ceil(spanW / hg) + 2;
    for (let i = 0; i < nH; i++) {
      const x = left - hg + hDrift + i * hg;
      ctx.beginPath();
      ctx.arc(x, FIELD.H - 40, 70, Math.PI, 0);
      ctx.fill();
    }
  }

  _cloud(ctx, x, y) {
    [[0, 8, 28, 12], [12, 0, 26, 14], [28, 6, 26, 12]].forEach((b) =>
      ctx.fillRect(x + b[0], y + b[1], b[2], b[3]));
  }

  _tiles(ctx, game, theme, cam) {
    const grid = game.level.grid;
    const themeKey = game.level.theme;
    const c0 = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const c1 = Math.min(game.level.cols - 1, Math.floor((cam.x + FIELD.W) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const r1 = Math.min(game.level.rows - 1, Math.floor((cam.y + FIELD.H) / TILE) + 1);

    for (let r = r0; r <= r1; r++) {
      const row = grid[r];
      if (!row) continue;
      for (let c = c0; c <= c1; c++) {
        const t = row[c];
        if (!t || t === 'flag' || t === 'castle') continue;
        const cv = Sprites.tile(t, themeKey);
        Sprites.blit(ctx, cv, c * TILE, r * TILE, TILE / cv.width);
      }
    }
    // moving platforms
    for (const m of game.movers) {
      const cv = Sprites.tile('platform', themeKey);
      const tiles = Math.round(m.w / TILE);
      for (let i = 0; i < tiles; i++) {
        Sprites.blit(ctx, cv, m.x + i * TILE, m.y, TILE / cv.width);
      }
    }
  }

  _flagAndCastle(ctx, game) {
    const lv = game.level;
    if (lv.flagX != null) {
      const groundY = lv.height - 2 * TILE;
      const poleH = groundY - 1 * TILE;
      const cv = Sprites.flag(poleH / SC);
      Sprites.blit(ctx, cv, lv.flagX + 8, TILE, SC);
    }
    if (lv.castleX != null) {
      const cv = Sprites.castle();
      const bottom = lv.height - 2 * TILE;
      Sprites.blitBottom(ctx, cv, lv.castleX + TILE, bottom, SC);
      // princess waiting near the castle door (stand on the floor top, not the
      // castle's sunken base, so she lines up with the hero in the ending scene)
      const pri = Sprites.princess();
      Sprites.blitBottom(ctx, pri, lv.castleX + TILE, lv.height - 4 * TILE, SC * 0.7);
    }
  }

  _coins(ctx, game) {
    const cam = game.camera;
    const cv = Sprites.coinCv();
    for (const c of game.coinsArr) {
      if (c.dead) continue;
      if (c.x + c.w < cam.x || c.x > cam.x + FIELD.W) continue; // cull off-screen
      Sprites.blit(ctx, cv, c.x + c.w / 2 - cv.width / 2, c.y + c.h / 2 - cv.height / 2, 1);
    }
  }

  _powerups(ctx, game) {
    const cam = game.camera;
    for (const pu of game.powerups) {
      if (pu.dead) continue;
      if (pu.x + pu.w < cam.x || pu.x > cam.x + FIELD.W) continue; // cull off-screen
      const cv = Sprites.powerupCv(pu.kind);
      Sprites.blit(ctx, cv, pu.x + pu.w / 2 - cv.width / 2, pu.y + pu.h / 2 - cv.height / 2, 1);
    }
  }

  _enemies(ctx, game) {
    for (const e of game.enemies) {
      if (e.dead) continue;
      let cv;
      if (e instanceof Goomba) {
        if (e.squish > 0) {
          // squished: draw flat
          cv = Sprites.goomba(0);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cv, Math.round(e.x), Math.round(e.y + e.h * 0.6),
            e.w, e.h * 0.4);
          ctx.restore();
          continue;
        }
        cv = Sprites.goomba(e.frame());
      } else if (e instanceof Koopa) {
        if (e.state === 'walk') cv = Sprites.koopa('walk', e.frame());
        else cv = Sprites.koopa('shell', 0);
      } else if (e instanceof Flyer) {
        if (e.squish > 0) {
          cv = Sprites.flyer('walk', 0);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cv, Math.round(e.x), Math.round(e.y + e.h * 0.6), e.w, e.h * 0.4);
          ctx.restore();
          continue;
        }
        cv = Sprites.flyer(e.winged ? 'fly' : 'walk', e.frame());
      } else if (e instanceof Dasher) {
        if (e.squish > 0) {
          cv = Sprites.dasher('patrol', 0);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cv, Math.round(e.x), Math.round(e.y + e.h * 0.6), e.w, e.h * 0.4);
          ctx.restore();
          continue;
        }
        cv = Sprites.dasher(e.state, e.frame());
      } else if (e instanceof Piranha) {
        if (!e.hittable) continue; // 藏起来不画(管口内)
        cv = Sprites.piranha(e.frame());
      } else if (e instanceof Spiked) {
        cv = Sprites.spiked(e.frame());
      } else if (e instanceof Flamer) {
        if (e.squish > 0) {
          cv = Sprites.flamer(0);
          ctx.save();
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(cv, Math.round(e.x), Math.round(e.y + e.h * 0.6), e.w, e.h * 0.4);
          ctx.restore();
          continue;
        }
        cv = Sprites.flamer(e.frame());
      }
      if (cv) {
        const sc = e.w / cv.width;
        Sprites.blit(ctx, cv, e.x, e.y + e.h - cv.height * sc, sc);
      }
    }
  }

  _fireballs(ctx, game) {
    for (const f of game.fireballs) {
      if (f.dead) continue;
      ctx.save();
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(f.x + f.w / 2, f.y + f.h / 2, f.w / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _enemyShots(ctx, game) {
    const cam = game.camera;
    for (const s of game.enemyShots) {
      if (s.dead) continue;
      if (s.x + s.w < cam.x || s.x > cam.x + FIELD.W) continue; // cull off-screen
      ctx.save();
      ctx.fillStyle = '#c46bff';
      ctx.beginPath();
      ctx.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e9c6ff';
      ctx.beginPath();
      ctx.arc(s.x + s.w / 2, s.y + s.h / 2, s.w / 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  _player(ctx, game) {
    const p = game.player;
    if (!p) return;
    // flicker during i-frames / rainbow-ish during star
    let alpha = 1;
    const ending = game.state === 'ending';
    if (!ending && p.invuln > 0 && Math.floor(p.invuln * 16) % 2 === 0) alpha = 0.35;
    if (!ending && p.star > 0 && Math.floor(p.star * 12) % 2 === 0) alpha = 0.55;
    // dip down a touch while kneeling before the princess
    const dyKneel = (ending && game.ending && game.ending.phase === 'kneel') ? 7 : 0;
    const cv = Sprites.hero(p.form, p.frame(), p.faceRight);
    const sc = p.w / cv.width;
    ctx.save();
    ctx.globalAlpha = alpha;
    Sprites.blit(ctx, cv, p.x, p.y + p.h - cv.height * sc + dyKneel, sc);
    ctx.restore();
  }

  _ending(ctx, game) {
    const e = game.ending;
    const p = game.player;
    if (!e || !p) return;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // kiss-the-hand hearts rising toward the princess during the kneel
    if (e.phase === 'kneel') {
      ctx.font = '18px "Apple Color Emoji","Segoe UI Emoji",serif';
      for (let i = 0; i < 3; i++) {
        const ph = (e.t * 1.4 + i * 0.45) % 1.4;
        ctx.globalAlpha = Math.max(0, 1 - ph / 1.4);
        ctx.fillText('❤️', p.x + p.w + 8, p.y + 4 - ph * 26);
      }
      ctx.globalAlpha = 1;
    }
    // crown descending onto — then resting on — the hero's head
    if ((e.phase === 'crown' || e.phase === 'celebrate') && e.crownY != null) {
      ctx.font = '22px "Apple Color Emoji","Segoe UI Emoji",serif';
      ctx.fillText('👑', p.x + p.w / 2, p.y + e.crownY - 12);
    }
  }

  _particles(ctx, game) {
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  _floatTexts(ctx, game) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px system-ui, sans-serif';
    for (const t of game.floatTexts) {
      ctx.globalAlpha = Math.max(0, t.life);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = t.color || '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  _hud(ctx, game) {
    const bandH = 36;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 0, FIELD.W, bandH);
    const cy = bandH / 2;
    ctx.textBaseline = 'middle';

    const LEFT = 92;            // clear of the ← HUB button
    const RIGHT = FIELD.W - 56; // clear of the mute button

    // ---- left cluster: score + coins ----
    ctx.textAlign = 'left';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.fillText(`⭐ ${game.score}`, LEFT, cy);
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`🪙 ${game.coins}`, LEFT + 88, cy);

    // ---- right cluster: lives at the far right, timer measured clear to its left ----
    ctx.textAlign = 'right';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillStyle = '#fff';
    const hearts = `❤️ ${game.lives}`;
    ctx.fillText(hearts, RIGHT, cy);
    const heartsW = ctx.measureText(hearts).width;

    ctx.fillStyle = game.timeLeft < 60 ? '#ff6b6b' : '#fff';
    ctx.fillText(`⏱ ${Math.ceil(game.timeLeft)}`, RIGHT - heartsW - 18, cy);

    // ---- center: level id ----
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(`关卡 ${game.currentLevelId()}`, FIELD.W / 2, cy);
  }

  _readyBanner(ctx, game) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, FIELD.H / 2 - 40, FIELD.W, 80);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.fillText(`关卡 ${game.currentLevelId()} · ${game.currentLevelName()}`, FIELD.W / 2, FIELD.H / 2 - 6);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#ffe066';
    ctx.fillText('准备出发！按 跳 / 手柄✕ 开始', FIELD.W / 2, FIELD.H / 2 + 24);
  }
}
