// game.js — 状态机 + update 整合（无 canvas/DOM，可 headless 测）。
import { HERO, WALL, FIELD } from './config.js';
import { effectiveStats, tickDoT } from './combat.js';
import { makeWall, resolveGnaw, wallDamage, isDefeated } from './wall.js';
import { makeSpawner, tickSpawner, isLevelComplete } from './spawn.js';
import { stepEnemy } from './enemies.js';
import { fireTick } from './hero.js';
import { stepBullets } from './bullets.js';
import { buildRun, applyCard, draw3 } from './cards.js';
import { makeSkillState, tickCooldowns, activateSkill } from './skills.js';
import { LEVELS, expForLevel, levelParams } from './levels.js';

export class Game {
  constructor(rng = Math.random) {
    this.rng = rng;
    this.state = 'menu';
    this.feedback = { floaters: [], shake: 0 };
  }

  startLevel(index) {
    this.levelIndex = index;
    this.level = LEVELS[index];
    this.params = levelParams(this.level.id);
    this.wall = makeWall();
    this.enemies = [];
    this.bullets = [];
    this.hero = { x: FIELD.W / 2, y: WALL.heroY, fireTimer: 0 };
    this.run = buildRun();
    this.heroLevel = 1;
    this.xp = 0;
    this.xpNeed = expForLevel(1);
    this.pendingCards = [];
    this.skillState = makeSkillState(['nuke', 'freeze']);
    this.spawner = makeSpawner(this.level.waves, this.rng);
    this.state = 'playing';
  }

  effective() { return effectiveStats(HERO, this.run.inMods, {}); }

  useSkill(id) {
    if (this.state !== 'playing') return false;
    const stats = this.effective();
    return activateSkill(this.skillState, id, { enemies: this.enemies, nukeDmg: stats.damage * 20 });
  }

  chooseCard(cardId) {
    if (this.state !== 'cardpick') return;
    applyCard(this.run, cardId);
    // 加固城墙卡即时生效：按 wallHpPct 提高上限并回满差额
    const wallPct = this.run.inMods.wallHpPct || 0;
    const newMax = Math.round(WALL.maxHp * (1 + wallPct));
    const diff = newMax - this.wall.maxHp;
    this.wall.maxHp = newMax; if (diff > 0) this.wall.hp += diff;
    this.heroLevel += 1;
    this.xpNeed = expForLevel(this.heroLevel);
    this.pendingCards = [];
    this.state = 'playing';
  }

  _gainXp(amount) {
    const mult = 1 + (this.run.inMods.xpPct || 0);
    this.xp += amount * mult;
    if (this.state === 'playing' && this.xp >= this.xpNeed) {
      this.xp -= this.xpNeed;
      this.pendingCards = draw3(this.run, this.rng);
      this.state = 'cardpick';
    }
  }

  update(dt) {
    if (this.state !== 'playing') return;       // cardpick/paused/menu 全场冻结
    tickCooldowns(this.skillState, dt);         // 技能冷却照走（实时）

    // 1) 吐怪（应用 hpScale）
    for (const e of tickSpawner(this.spawner, dt)) {
      e.hp = Math.round(e.hp * this.params.hpScale);
      e.hpMax = e.hp;
      this.enemies.push(e);
    }
    // 2) 推进僵尸 + DoT + 特殊行为
    for (const e of this.enemies) {
      stepEnemy(e, dt);
      if (e.dots.length) tickDoT(e, dt);
      // spitter atWall: 按啃咬处理（空块已省略，无 ranged-spit 逻辑）
    }
    // 3) 城墙自动修复（wallRegen 卡）
    const regen = this.run.inMods.wallRegen || 0;
    if (regen) this.wall.hp = Math.min(this.wall.maxHp, this.wall.hp + regen * dt);
    // 4) 城墙啃咬
    resolveGnaw(this.wall, this.enemies, dt);
    // 5) 英雄开火 + 子弹推进
    const stats = this.effective();
    this.bullets = this.bullets.concat(fireTick(this.hero, stats, this.enemies, dt));
    this.bullets = stepBullets(this.bullets, this.enemies, stats, this.run, dt, this.rng,
      (enemy, res) => { this.feedback.floaters.push({ x: enemy.x, y: enemy.y, amount: Math.round(res.amount), crit: res.isCrit, life: 0.6 }); });
    // 6) 结算死亡 → 经验；exploder 到墙自爆
    const survivors = [];
    for (const e of this.enemies) {
      if (e.hp <= 0) {
        // exploder 被打死不炸墙（省略 wallDamage(wall, 0) 无操作行）
        this._gainXp(e.xp);
        this.feedback.shake = Math.min(8, this.feedback.shake + 0.6);
        continue;
      }
      if (e.type === 'exploder' && e.atWall) { wallDamage(this.wall, e.explodeDmg); continue; }
      survivors.push(e);
    }
    this.enemies = survivors;
    // 7) 飘字/震屏衰减
    for (const f of this.feedback.floaters) f.life -= dt;
    this.feedback.floaters = this.feedback.floaters.filter((f) => f.life > 0);
    this.feedback.shake = Math.max(0, this.feedback.shake - dt * 12);
    // 8) 胜负判定
    if (isDefeated(this.wall)) { this.state = 'gameover'; return; }
    if (this.state === 'playing' && isLevelComplete(this.spawner, this.enemies)) {
      this.state = (this.levelIndex >= LEVELS.length - 1) ? 'win' : 'levelclear';
    }
  }
}
