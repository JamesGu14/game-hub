// render.js — Canvas 2D 绘制。离屏烘焙背景 + 实体/墙/子弹/HUD/飘字/震屏。
import { FIELD, WALL, LANES } from './config.js';
import { laneX } from './enemies.js';
import { floaterColor, floaterSize, formatAmount } from './feedback.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.bg = null;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / FIELD.W, vh / FIELD.H);
    this.canvas.width = FIELD.W; this.canvas.height = FIELD.H;
    this.canvas.style.width = FIELD.W * scale + 'px';
    this.canvas.style.height = FIELD.H * scale + 'px';
    this._bakeBg();
  }

  _bakeBg() {
    const c = document.createElement('canvas'); c.width = FIELD.W; c.height = FIELD.H;
    const x = c.getContext('2d');
    const grd = x.createLinearGradient(0, 0, 0, FIELD.H);
    grd.addColorStop(0, '#2a2218'); grd.addColorStop(1, '#15110c');
    x.fillStyle = grd; x.fillRect(0, 0, FIELD.W, FIELD.H);
    x.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 1; i < LANES; i++) { const lx = (FIELD.W / LANES) * i; x.beginPath(); x.moveTo(lx, 0); x.lineTo(lx, WALL.y); x.stroke(); }
    this.bg = c;
  }

  mapClientToField(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (cx - r.left) / r.width * FIELD.W, y: (cy - r.top) / r.height * FIELD.H };
  }

  render(game) {
    const ctx = this.ctx;
    const sx = (Math.random() - 0.5) * (game.feedback ? game.feedback.shake : 0);
    const sy = (Math.random() - 0.5) * (game.feedback ? game.feedback.shake : 0);
    ctx.save(); ctx.translate(sx, sy);
    ctx.drawImage(this.bg, 0, 0);
    if (game.state === 'menu') { ctx.restore(); return; }

    // 城墙
    if (game.wall) {
      ctx.fillStyle = '#6b5b3a'; ctx.fillRect(0, WALL.y, FIELD.W, 16);
      const pct = game.wall.hp / game.wall.maxHp;
      ctx.fillStyle = '#8bbf6a'; ctx.fillRect(0, WALL.y - 6, FIELD.W * pct, 5);
    }
    // 僵尸
    for (const e of (game.enemies || [])) {
      ctx.fillStyle = e.frozen > 0 ? '#7fd0ff' : (e.color || '#8bbf6a');
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      if (e.hp < e.hpMax) {
        ctx.fillStyle = '#000'; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2, 3);
        ctx.fillStyle = '#e44'; ctx.fillRect(e.x - e.r, e.y - e.r - 6, e.r * 2 * (e.hp / e.hpMax), 3);
      }
    }
    // 子弹
    ctx.fillStyle = '#ffd23f';
    for (const b of (game.bullets || [])) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); }
    // 英雄
    if (game.hero) { ctx.fillStyle = '#cfd8dc'; ctx.fillRect(game.hero.x - 16, game.hero.y - 16, 32, 32); }
    // 飘字
    for (const f of (game.feedback ? game.feedback.floaters : [])) {
      ctx.fillStyle = floaterColor(f.crit); ctx.font = `bold ${floaterSize(f.crit)}px sans-serif`;
      ctx.fillText(formatAmount(f.amount), f.x, f.y - (0.6 - f.life) * 40);
    }
    ctx.restore();
  }
}
