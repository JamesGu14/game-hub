// Game state machine for 丛林尖兵 JUNGLE BLITZ.
import { PLAYER, WEAPONS, ITEMS, SCORE, STORAGE_KEY, GRENADE } from './config.js';
import { aabb } from './util/math.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Bullets } from './bullets.js';
import { Enemies } from './enemies.js';
import { PowerUps } from './powerups.js';
import { getStage, stageCount } from './levels.js';
import { Input } from './input.js';

function loadBest() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { score: 0, stage: 1 };
}

export class Game {
  constructor() {
    this.state = 'menu';
    this.stageIndex = 0;
    this.world = null;
    this.player = null;
    this.bullets = null;
    this.enemies = null;
    this.powerups = null;
    this.boss = null;
    this.stage = null;
    this.score = 0;
    this.respawnX = 0;
    this.respawnY = 0;
    this.takenCheckpoints = new Set();
    this.bannerMs = 0;
    this.best = loadBest();
  }

  startGame() {
    this.score = 0;
    this.stageIndex = 0;
    this.loadStage(0);
    this.state = 'playing';
  }

  loadStage(i) {
    const stage = getStage(i);
    this.stage = stage;
    this.world = new World(stage);
    const sx = 80;
    const sy = this.world.floorTopAt(sx) - PLAYER.h;
    this.player = new Player(sx, sy);
    this.bullets = new Bullets();
    this.enemies = new Enemies();
    this.enemies.loadStage(stage);
    this.powerups = new PowerUps();
    this.powerups.spawnFromStage(stage);
    this.respawnX = sx;
    this.respawnY = sy;
    this.takenCheckpoints.clear();
    this.boss = null;
    this.bannerMs = 1600;
  }

  update(dt) {
    // Countdown stage banner.
    if (this.bannerMs > 0) this.bannerMs -= dt * 1000;

    if (this.state !== 'playing') return;

    const { player, bullets, enemies, powerups, world } = this;

    // 1. Player movement.
    player.update(dt, Input, world);

    // 2. Firing.
    if (Input.fireHeld && player.fireCooldown <= 0) {
      bullets.fireWeapon(player.weapon, player.muzzle(), player.aim, 'player');
      player.fireCooldown = WEAPONS[player.weapon].interval / 1000;
    }
    player.fireCooldown -= dt;

    // 3. Update bullets.
    bullets.update(dt, world);

    // 4. Update enemies.
    enemies.update(dt, world, player, bullets);

    // 5. Player bullets hit enemies (score).
    bullets.forEachActive(b => {
      if (b.faction !== 'player') return;
      const box = { x: b.x - 4, y: b.y - 4, w: 8, h: 8 };
      const e = enemies.hitTest(box);
      if (e) {
        if (b.pierce) {
          if (b.hits.has(e)) return;
          b.hits.add(e);
        } else {
          b.dead = true;
        }
        this.score += enemies.damage(e, b.dmg);
      }
    });

    // 6. Power-ups.
    powerups.update(dt);
    const apply = (kind) => {
      if (!kind) return;
      const e = powerups.effectFor(kind);
      if (!e) return;
      if (e.type === 'weapon') player.weapon = e.weapon;
      else if (e.type === 'heal') player.hp = Math.min(PLAYER.hpMax, player.hp + ITEMS.healAmount);
      else if (e.type === 'shield') player.shieldMs = ITEMS.shieldMs;
      this.score += SCORE.pickup;
    };
    apply(powerups.tryCollect(player.aabbBox()));
    powerups.popByBullet(bullets).forEach(apply);

    // 7. Apply player damage.

    // Enemy bullets.
    bullets.forEachActive(b => {
      if (b.faction !== 'enemy') return;
      if (aabb(player.aabbBox(), { x: b.x - 4, y: b.y - 4, w: 8, h: 8 })) {
        const r = player.hurt(1, b.x);
        b.dead = true;
        if (r === 'died') this._onDeath();
      }
    });

    // Enemy contact.
    const ce = enemies.enemyContact(player.aabbBox());
    if (ce) {
      const r = player.hurt(1, ce.x);
      if (r === 'died') this._onDeath();
    }

    // Grenade blasts.
    enemies.forEachBlast(bl => {
      const dx = (player.x + player.w / 2) - bl.x;
      const dy = (player.y + player.height / 2) - bl.y;
      if (Math.hypot(dx, dy) <= GRENADE.blastR) {
        const r = player.hurt(1, bl.x);
        if (r === 'died') this._onDeath();
      }
    });

    // Pit / fall.
    if (player.y > world.pitBottomY) {
      const r = player.hurt(1, player.x);
      if (r === 'died') {
        this._onDeath();
      } else {
        player.respawn(this.respawnX, this.respawnY);
      }
    }

    // Stage hazards (water etc. — stage 1 has none but wired for future stages).
    if (this.stage.hazards) {
      for (const hz of this.stage.hazards) {
        if (hz.type === 'water') {
          const cx = player.x + player.w / 2;
          const cy = player.y + player.height / 2;
          if (cx >= hz.x && cx <= hz.x + hz.w && cy >= hz.y) {
            const r = player.hurt(1, player.x);
            if (r === 'died') {
              this._onDeath();
            } else {
              player.respawn(this.respawnX, this.respawnY);
            }
          }
        }
      }
    }

    // 8. Checkpoints.
    for (const cp of this.stage.checkpoints) {
      if (!this.takenCheckpoints.has(cp) && player.x >= cp) {
        this.takenCheckpoints.add(cp);
        this.respawnX = cp;
        this.respawnY = world.floorTopAt(cp) - PLAYER.h;
      }
    }

    // 9. Camera.
    if (!this.boss) world.updateCamera(player.x);

    // 10. Boss trigger placeholder (boss spawns in a later task).
    if (player.x >= this.stage.bossX && !this.boss) {
      // Boss logic wired in next task.
    }
  }

  _onDeath() {
    this.player.lives -= 1;
    if (this.player.lives >= 0) {
      this.player.respawn(this.respawnX, this.respawnY);
    } else {
      this.state = 'gameover';
      this.persistBest();
    }
  }

  togglePause() {
    if (this.state === 'playing') this.state = 'paused';
    else if (this.state === 'paused') this.state = 'playing';
  }

  restartStage() {
    this.loadStage(this.stageIndex);
    this.state = 'playing';
  }

  continueFromCheckpoint() {
    this.player.lives = PLAYER.lives;
    this.player.respawn(this.respawnX, this.respawnY);
    this.state = 'playing';
  }

  nextStage() {
    if (this.stageIndex + 1 >= stageCount()) {
      this.state = 'win';
      this.persistBest();
    } else {
      this.stageIndex++;
      this.loadStage(this.stageIndex);
      this.state = 'playing';
    }
  }

  toMenu() {
    this.state = 'menu';
  }

  confirm() {
    switch (this.state) {
      case 'menu':       this.startGame(); break;
      case 'paused':     this.togglePause(); break;
      case 'stageclear': this.nextStage(); break;
      case 'gameover':   this.continueFromCheckpoint(); break;
      case 'win':        this.startGame(); break;
    }
  }

  handleAction(action) {
    switch (action) {
      case 'jump':
        if (this.state === 'playing') this.player.jump();
        else this.confirm();
        break;
      case 'confirm':
        if (this.state !== 'playing') this.confirm();
        break;
      case 'pause':
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
        break;
      case 'back':
        if (this.state === 'paused') this.togglePause();
        break;
      case 'mute':
        // Audio wired in a later task.
        break;
    }
  }

  persistBest() {
    this.best.score = Math.max(this.best.score, this.score);
    this.best.stage = Math.max(this.best.stage, this.stageIndex + 1);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.best));
    } catch { /* ignore */ }
  }
}
