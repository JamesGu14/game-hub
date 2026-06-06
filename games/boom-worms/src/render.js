// Canvas 2D renderer for 炮炮虫 BOOM WORMS.
// Draws in FIELD space (960x540) via a letterbox transform.
// Read-only over game — no logic here.

import { FIELD, WORM, WEAPONS, CRATE, AIM, STARTING_WEAPONS } from './config.js';
import { simulate } from './util/trajectory.js';
import { vecFromAngle } from './util/math.js';

// ---------------------------------------------------------------------------
// Theme palettes: sky gradient colors + deco emoji for parallax layers
// ---------------------------------------------------------------------------
const THEMES = {
  grass:   { skyTop: '#87ceeb', skyBot: '#d4f0a0', deco: ['🌳', '☁️', '🌿'] },
  candy:   { skyTop: '#ffccee', skyBot: '#ffe4f8', deco: ['🍭', '🍬', '☁️'] },
  beach:   { skyTop: '#87d7e8', skyBot: '#fce4a0', deco: ['🌊', '🌴', '☀️'] },
  jungle:  { skyTop: '#2d6a1e', skyBot: '#8bc34a', deco: ['🌿', '🌳', '🦋'] },
  sky:     { skyTop: '#1a2a6c', skyBot: '#b0c4de', deco: ['☁️', '⭐', '🌙'] },
  rainbow: { skyTop: '#ff9f43', skyBot: '#ffd700', deco: ['🌈', '⭐', '✨'] },
};

// Team colors: team0 = warm, team1 = blue/cool
const TEAM_COLORS = ['#ff7043', '#42a5f5'];
const TEAM_HAT_COLORS = ['#b71c1c', '#0d47a1'];

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this._time = 0; // accumulated time for animations
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

  /** Screen (CSS px) -> field coords, for pointer input. */
  mapClientXToField(clientX) {
    return (clientX - this.offsetX) / this.scale;
  }

  mapClientToField(clientX, clientY) {
    return {
      x: (clientX - this.offsetX) / this.scale,
      y: (clientY - this.offsetY) / this.scale,
    };
  }

  // -------------------------------------------------------------------------
  // Main render entry point
  // -------------------------------------------------------------------------
  render(game, dt = 0) {
    this._time += dt;
    const ctx = this.ctx;

    // Reset transform; fill letterbox bars
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Enter field-space (0..960 x 0..540)
    ctx.setTransform(
      this.scale * this.dpr, 0,
      0, this.scale * this.dpr,
      this.offsetX * this.dpr,
      this.offsetY * this.dpr,
    );

    if (game.state === 'menu' || !game.terrain) {
      this._menuBackground(ctx, game.level);
      return;
    }

    const camX = game.camX || 0;

    // 1. Sky gradient + parallax deco
    this._sky(ctx, game);

    // 2. Animated water band
    this._water(ctx, game.level ? game.level.waterY : 512, camX);

    // 3. Terrain (offscreen canvas blit)
    game.terrain.draw(ctx, camX);

    // 4. Crates
    if (game.crates) this._crates(ctx, game.crates, camX);

    // 5. Worms
    const allTeams = game.teams || [];
    for (const team of allTeams) {
      for (const worm of team.worms) {
        if (!worm.alive) continue;
        const isActive = game.active &&
          game.active.team === worm.team &&
          game.active.wormIdx === team.worms.indexOf(worm);
        this._worm(ctx, worm, team, isActive, camX);
      }
    }

    // 6. Projectiles + particle effects
    if (game.projectiles) this._projectiles(ctx, game.projectiles, camX);
    if (game.effects) this._effects(ctx, game.effects, camX);

    // 7. Aim indicator + power bar (only during aim/firing states)
    const inAimState = game.state === 'aim' || game.state === 'firing';
    if (inAimState && game.aim && game.active) {
      const activeTeam = allTeams[game.active.team];
      if (activeTeam) {
        const activeWorm = activeTeam.worms[game.active.wormIdx];
        if (activeWorm && activeWorm.alive && (!activeTeam.isAI || game._aiAiming)) {
          this._aimIndicator(ctx, activeWorm, game.aim, game, camX);
          if (game.aim.charging) {
            this._powerBar(ctx, game.aim);
          }
        }
      }
    }

    // 8. HUD (screen-space, drawn last)
    this._hud(ctx, game, camX);

    // Turn banner
    if (game.bannerMs > 0 && game.bannerText) {
      this._turnBanner(ctx, game.bannerText, game.bannerMs);
    }
  }

  // -------------------------------------------------------------------------
  // Menu background
  // -------------------------------------------------------------------------
  _menuBackground(ctx) {
    const W = FIELD.W;
    const H = FIELD.H;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a2a6c');
    grad.addColorStop(0.5, '#5b6fa3');
    grad.addColorStop(1, '#8bc34a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Decorative clouds
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 5; i++) {
      const cx = 80 + i * 200;
      const cy = 60 + (i % 2) * 30;
      ctx.beginPath();
      ctx.arc(cx, cy, 35, 0, Math.PI * 2);
      ctx.arc(cx + 40, cy - 10, 28, 0, Math.PI * 2);
      ctx.arc(cx + 70, cy + 5, 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Title hint
    ctx.save();
    ctx.fillStyle = '#ffe082';
    ctx.font = 'bold 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff9f43';
    ctx.shadowBlur = 20;
    ctx.fillText('炮炮虫 BOOM WORMS', W / 2, H / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px sans-serif';
    ctx.fillText('回合制炮战 · 打飞小虫', W / 2, H / 2 + 10);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Sky + parallax decorations
  // -------------------------------------------------------------------------
  _sky(ctx, game) {
    const W = FIELD.W;
    const H = FIELD.H;
    const theme = (game.level && game.level.theme) ? game.level.theme : 'grass';
    const t = THEMES[theme] || THEMES.grass;

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, t.skyTop);
    grad.addColorStop(0.7, t.skyBot);
    grad.addColorStop(1, t.skyBot);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Parallax emoji deco at 20% scroll speed
    const camX = game.camX || 0;
    const decos = t.deco;
    ctx.save();
    ctx.font = '28px sans-serif';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < 8; i++) {
      const emoji = decos[i % decos.length];
      const baseX = 60 + i * 130;
      const px = ((baseX - camX * 0.2) % (W + 60) + W + 60) % (W + 60) - 30;
      const py = 40 + (i % 3) * 30;
      ctx.fillText(emoji, px, py);
    }
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Animated water band
  // -------------------------------------------------------------------------
  _water(ctx, waterY, camX) {
    const W = FIELD.W;
    const H = FIELD.H;
    const t = this._time;

    ctx.save();
    // Semi-transparent water fill
    ctx.fillStyle = 'rgba(30, 120, 220, 0.55)';
    ctx.fillRect(0, waterY, W, H - waterY);

    // Animated wave crests
    ctx.strokeStyle = 'rgba(150, 210, 255, 0.6)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    const step = 30;
    for (let x = 0; x <= W + step; x += step) {
      const wx = x - (camX * 0.1 + t * 40) % step;
      const wy = waterY + Math.sin((wx + camX * 0.1) * 0.06 + t * 2) * 4;
      if (x === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
    }
    ctx.stroke();

    // Lighter surface highlight
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#aef';
    ctx.fillRect(0, waterY, W, 8);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Crate (weapon/health box)
  // -------------------------------------------------------------------------
  _crates(ctx, crates, camX) {
    for (const c of crates) {
      if (c.dead) continue;
      const x = c.x - camX - CRATE.w / 2;
      const y = c.y - CRATE.h / 2;
      const w = CRATE.w;
      const h = CRATE.h;

      ctx.save();
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 2, y + 2, w, h);

      // Box body
      const isHeal = c.kind === 'heal';
      ctx.fillStyle = isHeal ? '#f48fb1' : '#ffd54f';
      ctx.fillRect(x, y, w, h);

      // Cross/star decoration
      ctx.fillStyle = isHeal ? '#e91e63' : '#e65100';
      if (isHeal) {
        // Red cross
        ctx.fillRect(x + w / 2 - 3, y + 4, 6, h - 8);
        ctx.fillRect(x + 4, y + h / 2 - 3, w - 8, 6);
      } else {
        // Star on weapon crate
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⭐', x + w / 2, y + h / 2);
      }

      // Parachute line (floating crate)
      if (!c.landed) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + w / 2, y);
        ctx.lineTo(x + w / 2, y - 30);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x + w / 2, y - 30, 12, Math.PI, 0);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // Worm
  // -------------------------------------------------------------------------
  _worm(ctx, worm, team, isActive, camX) {
    const wx = worm.x - camX;
    const wy = worm.y;
    const hh = WORM.h / 2;
    const f = worm.facing >= 0 ? 1 : -1;
    const groundY = wy + hh;                 // feet line

    const teamColor = TEAM_COLORS[team.id] || '#aaa';
    const accent = TEAM_HAT_COLORS[team.id] || '#444';
    const flash = worm.hitFlashMs > 0;
    const body = flash ? '#ffffff' : teamColor;
    const seam = flash ? '#ffcc00' : 'rgba(0,0,0,0.22)';

    ctx.save();

    // Soft shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(wx, groundY + 1, 15, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // --- Caterpillar body: tail -> mid -> shoulder segments resting on ground ---
    const segs = [
      { dx: -11, r: 6 },   // tail (small)
      { dx: -3,  r: 8 },   // mid
      { dx: 6,   r: 9 },   // shoulder
    ];
    for (const s of segs) {
      const cx = wx + f * s.dx;
      const cy = groundY - s.r;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(cx, cy, s.r, 0, Math.PI * 2);
      ctx.fill();
      // belly highlight
      ctx.fillStyle = flash ? '#ffffff' : 'rgba(255,255,255,0.20)';
      ctx.beginPath();
      ctx.arc(cx - f * 2, cy - 2, s.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      // segment seam (little ridge on top)
      ctx.strokeStyle = seam;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, s.r, -Math.PI * 0.7, -Math.PI * 0.3);
      ctx.stroke();
    }

    // --- Head (largest, at the front) ---
    const hx = wx + f * 12;
    const headR = 11;
    const hy = groundY - headR - 2;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(hx, hy, headR, 0, Math.PI * 2);
    ctx.fill();

    // Antennae (two springy feelers with team-color tips)
    ctx.strokeStyle = flash ? '#ffcc00' : '#3a2a18';
    ctx.lineWidth = 1.6;
    for (const ax of [-4, 4]) {
      const bx = hx + ax;
      const tipX = bx + ax * 0.4, tipY = hy - headR - 6;
      ctx.beginPath();
      ctx.moveTo(bx, hy - headR + 2);
      ctx.lineTo(tipX, tipY);
      ctx.stroke();
      ctx.fillStyle = accent;
      ctx.beginPath();
      ctx.arc(tipX, tipY - 1, 2.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Rosy cheeks
    ctx.fillStyle = flash ? '#ffe082' : 'rgba(255,120,150,0.55)';
    ctx.beginPath();
    ctx.arc(hx + f * 6, hy + 3, 2.6, 0, Math.PI * 2);
    ctx.arc(hx - f * 6, hy + 3, 2.6, 0, Math.PI * 2);
    ctx.fill();

    // Big eyes (pupils toward facing)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(hx - f * 3, hy - 2, 3.5, 0, Math.PI * 2);
    ctx.arc(hx + f * 4, hy - 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = flash ? '#ffcc00' : '#1a1a1a';
    ctx.beginPath();
    ctx.arc(hx - f * 3 + f, hy - 1.5, 1.8, 0, Math.PI * 2);
    ctx.arc(hx + f * 4 + f, hy - 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = flash ? '#ffcc00' : '#1a1a1a';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(hx + f, hy + 3, 3.2, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();

    // HP bar above
    this._hpBar(ctx, wx, groundY - WORM.h - 16, WORM.w + 12, worm.hp, 100, teamColor);

    // Active-worm: bouncing arrow + name
    if (isActive) {
      const ay = groundY - WORM.h - 24;
      ctx.fillStyle = '#ffe082';
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(wx, ay + 8);
      ctx.lineTo(wx - 6, ay);
      ctx.lineTo(wx + 6, ay);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.fillStyle = '#ffe082';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(team.name, wx, ay - 2);
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // HP bar helper
  // -------------------------------------------------------------------------
  _hpBar(ctx, cx, y, barW, hp, maxHp, color) {
    const x = cx - barW / 2;
    const h = 5;
    const fill = Math.max(0, hp / maxHp);

    // Track
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(x, y, barW, h);

    // Fill
    ctx.fillStyle = fill > 0.5 ? '#66bb6a' : fill > 0.25 ? '#ffa726' : '#ef5350';
    ctx.fillRect(x, y, barW * fill, h);

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x, y, barW, h);
  }

  // -------------------------------------------------------------------------
  // Projectiles
  // -------------------------------------------------------------------------
  _projectiles(ctx, projectiles, camX) {
    for (const p of projectiles) {
      if (p.dead) continue;
      const px = p.x - camX;
      const py = p.y;

      ctx.save();
      const wdef = WEAPONS[p.kind] || {};
      const color = wdef.color || '#ffd23f';

      switch (p.kind) {
        case 'bazooka':
        case 'projectile': {
          // Rocket: elongated oval pointing in direction of travel
          const angle = Math.atan2(p.vy, p.vx);
          ctx.translate(px, py);
          ctx.rotate(angle);
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 8;
          ctx.beginPath();
          ctx.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2);
          ctx.fill();
          // Flame tail
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ff6600';
          ctx.beginPath();
          ctx.ellipse(-8, 0, 6, 3, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'grenade':
        case 'holy': {
          // Grenade: circle with fuse timer arc
          ctx.fillStyle = color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(px, py, p.r || 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          // Fuse arc (shows remaining time)
          const maxFuse = (WEAPONS[p.kind] && WEAPONS[p.kind].fuse) || 3;
          const ratio = Math.max(0, p.fuse / maxFuse);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(px, py, (p.r || 6) + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ratio);
          ctx.stroke();
          break;
        }
        case 'dynamite': {
          ctx.fillStyle = color;
          ctx.fillRect(px - 5, py - 12, 10, 20);
          ctx.fillStyle = '#ffcc00';
          ctx.font = '10px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('💣', px, py);
          break;
        }
        case 'airstrike': {
          // Falling bomb
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(px, py, 5, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          // Tail fin
          ctx.fillStyle = '#9aa0a6';
          ctx.fillRect(px - 4, py - 8, 3, 5);
          ctx.fillRect(px + 1, py - 8, 3, 5);
          break;
        }
        default: {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(px, py, p.r || 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // Particle effects (explosions, splashes, sparkles)
  // -------------------------------------------------------------------------
  _effects(ctx, effects, camX) {
    for (const e of effects) {
      if (e.dead) continue;
      const ex = e.x - camX;
      const ey = e.y;
      const t = e.t || 0;     // 0..1 lifetime progress
      const alpha = Math.max(0, 1 - t);

      ctx.save();
      ctx.globalAlpha = alpha;

      switch (e.type) {
        case 'explosion': {
          const r = e.r * t;
          // Outer blast circle
          ctx.fillStyle = '#ff8800';
          ctx.shadowColor = '#ff4400';
          ctx.shadowBlur = 20 * (1 - t);
          ctx.beginPath();
          ctx.arc(ex, ey, r, 0, Math.PI * 2);
          ctx.fill();
          // Inner bright core
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#ffe082';
          ctx.beginPath();
          ctx.arc(ex, ey, r * 0.5, 0, Math.PI * 2);
          ctx.fill();
          // Smoke ring
          ctx.globalAlpha = alpha * 0.4;
          ctx.fillStyle = '#555';
          ctx.beginPath();
          ctx.arc(ex, ey, r * 1.3, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'splash': {
          // Water splash particles
          ctx.strokeStyle = '#42a5f5';
          ctx.lineWidth = 2;
          const drops = 6;
          for (let i = 0; i < drops; i++) {
            const a = (i / drops) * Math.PI * 2;
            const len = e.r * 0.5 * (1 - t);
            const dx = Math.cos(a) * e.r * 0.6 * t;
            const dy = Math.sin(a) * e.r * 0.6 * t - e.r * 0.3 * t;
            ctx.beginPath();
            ctx.moveTo(ex + dx, ey + dy);
            ctx.lineTo(ex + dx + Math.cos(a) * len, ey + dy + Math.sin(a) * len);
            ctx.stroke();
          }
          break;
        }
        case 'sparkle': {
          // Charge sparkle for power bar
          ctx.fillStyle = '#ffe082';
          ctx.shadowColor = '#ffcc00';
          ctx.shadowBlur = 8;
          const sr = (e.r || 3) * (1 - t * 0.5);
          ctx.beginPath();
          ctx.arc(ex, ey, sr, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'debris': {
          // Small flying debris chunk
          ctx.fillStyle = e.color || '#8d6e63';
          const dr = (e.r || 4) * (1 - t * 0.5);
          ctx.beginPath();
          ctx.arc(ex, ey, dr, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
      }
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------------
  // Aim indicator: dotted predicted arc
  // -------------------------------------------------------------------------
  _aimIndicator(ctx, worm, aim, game, camX) {
    const level = game.level;
    const terrain = game.terrain;
    const def = WEAPONS[game.weaponKey] || {};
    const wx = worm.x - camX;
    const wy = worm.y;
    const f = worm.facing >= 0 ? 1 : -1;
    const waterY = level ? level.waterY : 512;
    const color = def.color || '#ffe27a';
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 140);

    ctx.save();

    // Short aim direction line (always shown)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.lineTo(wx + Math.cos(aim.angle) * 34, wy + Math.sin(aim.angle) * 34);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hit tests for the preview
    const solid = (x, y) => (x < 0 || x > FIELD.W || y > waterY + 30)
      || (terrain ? !!terrain.solid(x | 0, y | 0) : false);
    const enemyHit = (x, y) => {
      for (const t of game.teams || []) {
        for (const w of t.worms) {
          if (w.alive && w !== worm && Math.hypot(w.x - x, w.y - y) < 12) return true;
        }
      }
      return false;
    };

    // Pulsing reticle at the predicted impact point
    const drawReticle = (x, y) => {
      const px = x - camX;
      const r = 7 + pulse * 3;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6 + pulse * 0.4;
      ctx.beginPath(); ctx.arc(px, y, r, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px - r - 3, y); ctx.lineTo(px - r + 3, y);
      ctx.moveTo(px + r - 3, y); ctx.lineTo(px + r + 3, y);
      ctx.moveTo(px, y - r - 3); ctx.lineTo(px, y - r + 3);
      ctx.moveTo(px, y + r - 3); ctx.lineTo(px, y + r + 3);
      ctx.stroke();
      ctx.globalAlpha = 1;
    };

    if (def.kind === 'projectile' || def.kind === 'grenade' || def.kind === 'holy') {
      // Ballistic preview from the muzzle; stops at terrain / worm / water.
      // Uses aim.power, so the arc + landing reticle update live while charging.
      const mx = worm.x + f * 18, my = worm.y;
      const speed = aim.power || AIM.minSpeed;
      const vel = vecFromAngle(aim.angle, speed);
      const wind = def.windAffected ? ((level && level.wind) || 0) : 0;
      try {
        const res = simulate(
          { x: mx, y: my }, vel,
          { gravity: 480, wind, dt: 1 / 60, maxSteps: 300 },
          (x, y) => solid(x, y) || enemyHit(x, y),
        );
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([2, 7]);
        ctx.beginPath();
        for (let i = 0; i < res.points.length; i += 2) {
          const p = res.points[i];
          if (i === 0) ctx.moveTo(p.x - camX, p.y); else ctx.lineTo(p.x - camX, p.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        drawReticle(res.last.x, res.last.y);
      } catch (_) { /* skip arc on edge cases */ }
    } else if (def.kind === 'hitscan') {
      const mx = worm.x + f * 18, my = worm.y;
      const range = def.range || 260;
      const dx = Math.cos(aim.angle), dy = Math.sin(aim.angle);
      let hx = mx + dx * range, hy = my + dy * range;
      for (let i = 4; i <= range; i += 4) {
        const rx = mx + dx * i, ry = my + dy * i;
        if (solid(rx, ry) || enemyHit(rx, ry)) { hx = rx; hy = ry; break; }
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2; ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.moveTo(mx - camX, my); ctx.lineTo(hx - camX, hy);
      ctx.stroke();
      ctx.setLineDash([]);
      drawReticle(hx, hy);
    } else if (def.kind === 'dynamite') {
      drawReticle(worm.x + f * 6, worm.y + 14);
    } else if (def.kind === 'airstrike') {
      let tx = (aim.mode === 'mouse' && game._lastAimPoint)
        ? game._lastAimPoint.x
        : worm.x + Math.cos(aim.angle) * ((aim.power || AIM.minSpeed) * 0.9);
      tx = Math.max(20, Math.min(FIELD.W - 20, tx));
      const px = tx - camX;
      ctx.strokeStyle = color; ctx.globalAlpha = 0.5 + pulse * 0.4;
      ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
      ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, FIELD.H); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      for (let yy = 18; yy < 80; yy += 22) {
        ctx.beginPath();
        ctx.moveTo(px, yy + 8); ctx.lineTo(px - 5, yy); ctx.lineTo(px + 5, yy);
        ctx.closePath(); ctx.fill();
      }
    } else if (def.kind === 'melee') {
      const range = def.range || 40;
      ctx.strokeStyle = color; ctx.globalAlpha = 0.5 + pulse * 0.4;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, range, f > 0 ? -0.8 : Math.PI - 0.8, f > 0 ? 0.8 : Math.PI + 0.8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Power bar (shown while charging)
  // -------------------------------------------------------------------------
  // Vertical power gauge pinned to the LEFT edge (fills bottom-up), so it never
  // overlaps the weapon bar along the bottom of the screen.
  _powerBar(ctx, aim) {
    const barW = 20;
    const barH = 190;
    const x = 18;
    const y = FIELD.H / 2 - barH / 2;
    const fill = (aim.power - AIM.minSpeed) / (AIM.maxSpeed - AIM.minSpeed);

    ctx.save();

    // Background track
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, barW + 4, barH + 4, 6);
    ctx.fill();

    // Gradient fill (green at bottom → red at top), growing upward
    const fh = barH * Math.max(0, Math.min(1, fill));
    const grad = ctx.createLinearGradient(0, y + barH, 0, y);
    grad.addColorStop(0, '#66bb6a');
    grad.addColorStop(0.6, '#ffa726');
    grad.addColorStop(1, '#ef5350');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y + barH - fh, barW, fh, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, 4);
    ctx.stroke();

    // Label below the gauge
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('🔥', x + barW / 2, y + barH + 6);

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // HUD: team label, weapon bar, wind arrow, turn banner
  // -------------------------------------------------------------------------
  _hud(ctx, game, camX) {
    const W = FIELD.W;
    const barH = 44;
    const pad = 8;

    ctx.save();

    // Top HUD strip
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, W, barH);

    if (!game.teams) { ctx.restore(); return; }

    const allTeams = game.teams;

    // -- Left side: active team + worm info --
    if (game.active) {
      const activeTeam = allTeams[game.active.team];
      if (activeTeam) {
        const activeWorm = activeTeam.worms[game.active.wormIdx];
        const teamColor = TEAM_COLORS[activeTeam.id] || '#aaa';

        ctx.fillStyle = teamColor;
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeTeam.name, pad + 6, barH / 2);

        if (activeWorm) {
          ctx.fillStyle = '#ffffff';
          ctx.font = '12px sans-serif';
          ctx.fillText(`HP: ${Math.max(0, activeWorm.hp)}`, pad + 6 + 100, barH / 2);
        }
      }
    }

    // -- Center: level name --
    if (game.level) {
      ctx.fillStyle = '#ffe082';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const modeLabel = game.mode === 'duo' ? '双人对战' : '第 ' + (game.levelIndex + 1) + ' 关';
      ctx.fillText(modeLabel + ' · ' + game.level.name, W / 2, barH / 2);
    }

    // -- Right: weapon name + ammo --
    if (game.active && game.weaponKey) {
      const wdef = WEAPONS[game.weaponKey];
      const activeTeam = allTeams[game.active.team];
      const ammoVal = activeTeam && activeTeam.ammo ? activeTeam.ammo[game.weaponKey] : 0;
      const ammoStr = ammoVal === Infinity ? '∞' : String(Math.max(0, ammoVal));

      ctx.fillStyle = '#ffe082';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const icon = wdef ? wdef.icon : '';
      const name = wdef ? wdef.name : game.weaponKey;
      ctx.fillText(`${icon} ${name}  ×${ammoStr}`, W - pad - 6, barH / 2);
    }

    // -- Wind indicator (bottom center, if wind != 0) --
    if (game.level && game.level.wind !== 0 && game.windEnabled) {
      this._windArrow(ctx, game.level.wind);
    }

    // -- Weapon bar (bottom strip) --
    this._weaponBar(ctx, game);

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Weapon bar (bottom of screen)
  // -------------------------------------------------------------------------
  _weaponBar(ctx, game) {
    if (!game.teams || !game.active) return;
    const activeTeam = game.teams[game.active.team];
    if (!activeTeam) return;

    const weapons = Object.keys(WEAPONS).filter(k => {
      const a = activeTeam.ammo ? activeTeam.ammo[k] : 0;
      return a === Infinity || a > 0;
    });
    if (weapons.length === 0) return;

    const slotW = 52;
    const slotH = 44;
    const pad = 6;
    const totalW = weapons.length * (slotW + pad) - pad;
    const startX = FIELD.W / 2 - totalW / 2;
    const startY = FIELD.H - slotH - 10;

    ctx.save();

    // Bar background
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.roundRect(startX - 6, startY - 4, totalW + 12, slotH + 8, 8);
    ctx.fill();

    for (let i = 0; i < weapons.length; i++) {
      const key = weapons[i];
      const wdef = WEAPONS[key];
      const isSelected = key === game.weaponKey;
      const sx = startX + i * (slotW + pad);

      // Slot background
      ctx.fillStyle = isSelected ? 'rgba(255,224,100,0.3)' : 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = isSelected ? '#ffe082' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.beginPath();
      ctx.roundRect(sx, startY, slotW, slotH, 6);
      ctx.fill();
      ctx.stroke();

      // Weapon icon
      ctx.font = '22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(wdef.icon, sx + slotW / 2, startY + slotH / 2 - 6);

      // Ammo count
      const ammoVal = activeTeam.ammo ? activeTeam.ammo[key] : 0;
      const ammoStr = ammoVal === Infinity ? '∞' : String(Math.max(0, ammoVal));
      ctx.fillStyle = isSelected ? '#ffe082' : '#cccccc';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText(ammoStr, sx + slotW / 2, startY + slotH - 7);

      // Number badge (1-5) for the fixed starting-weapon hotkeys.
      const slotNum = STARTING_WEAPONS.indexOf(key);
      if (slotNum >= 0) {
        ctx.fillStyle = isSelected ? '#ffe082' : 'rgba(255,255,255,0.55)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(String(slotNum + 1), sx + 5, startY + 4);
      }
    }

    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Wind arrow
  // -------------------------------------------------------------------------
  _windArrow(ctx, wind) {
    const W = FIELD.W;
    const y = FIELD.H - 110;
    const strength = Math.abs(wind);
    const dir = wind > 0 ? 1 : -1;
    const label = '💨 ' + (wind > 0 ? '→' : '←') + ' ' + Math.round(strength);

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.roundRect(W / 2 - 50, y - 14, 100, 24, 6);
    ctx.fill();

    ctx.fillStyle = '#b0c4de';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, y);
    ctx.restore();
  }

  // -------------------------------------------------------------------------
  // Turn banner (flash text in center)
  // -------------------------------------------------------------------------
  _turnBanner(ctx, text, bannerMs) {
    const W = FIELD.W;
    const H = FIELD.H;
    // Fade in/out over ~400ms each end
    const alpha = Math.min(1, bannerMs / 400);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, H / 2 - 35, W, 60);

    ctx.fillStyle = '#ffe082';
    ctx.font = 'bold 32px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff9f43';
    ctx.shadowBlur = 12;
    ctx.fillText(text, W / 2, H / 2 - 5);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}
