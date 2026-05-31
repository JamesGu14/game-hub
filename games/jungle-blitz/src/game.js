// Game state machine for 丛林尖兵 JUNGLE BLITZ.
import { PLAYER, WEAPONS, ITEMS, SCORE, STORAGE_KEY, GRENADE, BOSSES, POD_KIND_TO_WEAPON, FIELD } from './config.js';
import { aabb, clamp } from './util/math.js';
import { createBoss } from './bosses.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Bullets } from './bullets.js';
import { Enemies } from './enemies.js';
import { PowerUps } from './powerups.js';
import { getStage, stageCount } from './levels.js';
import { Input } from './input.js';
import { Sound } from './audio.js';

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
    this.prevBossPhase = null;
    this.bannerMs = 1600;
  }

  update(dt) {
    // Countdown stage banner.
    if (this.bannerMs > 0) this.bannerMs -= dt * 1000;

    if (this.state !== 'playing') return;

    const { player, bullets, enemies, powerups, world } = this;

    // 1. Player movement (land SFX on air→ground transition).
    const wasAirborne = !player.onGround;
    player.update(dt, Input, world);
    if (wasAirborne && player.onGround) Sound.land();

    // 2. Firing.
    if (Input.fireHeld && player.fireCooldown <= 0) {
      bullets.fireWeapon(player.weapon, player.muzzle(), player.aim, 'player');
      player.fireCooldown = WEAPONS[player.weapon].interval / 1000;
      Sound.shoot(player.weapon);
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
        const scoreGained = enemies.damage(e, b.dmg);
        this.score += scoreGained;
        if (scoreGained > 0) Sound.enemyExplode(); else Sound.enemyHit();
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
      Sound.pickup();
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
        if (r === 'hurt' || r === 'died') Sound.playerHurt();
        if (r === 'died') this._onDeath();
      }
    });

    // Enemy contact.
    const ce = enemies.enemyContact(player.aabbBox());
    if (ce) {
      const r = player.hurt(1, ce.x);
      if (r === 'hurt' || r === 'died') Sound.playerHurt();
      if (r === 'died') this._onDeath();
    }

    // Grenade blasts.
    enemies.forEachBlast(bl => {
      const dx = (player.x + player.w / 2) - bl.x;
      const dy = (player.y + player.height / 2) - bl.y;
      if (Math.hypot(dx, dy) <= GRENADE.blastR) {
        const r = player.hurt(1, bl.x);
        if (r === 'hurt' || r === 'died') Sound.playerHurt();
        if (r === 'died') this._onDeath();
      }
    });

    // Pit / fall.
    if (player.y > world.pitBottomY) {
      const r = player.hurt(1, player.x);
      if (r === 'hurt' || r === 'died') Sound.playerHurt();
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
            if (r === 'hurt' || r === 'died') Sound.playerHurt();
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

    // 9. Camera + boss room lock.
    if (!this.boss) {
      world.updateCamera(player.x);
    } else {
      // Lock player inside boss room.
      player.x = clamp(player.x, world.camX, world.camX + FIELD.W - player.w);
    }

    // 10. Boss trigger.
    if (player.x >= this.stage.bossX && !this.boss) {
      const roomLeftX = clamp(this.stage.bossX - 120, 0, this.world.worldWidth - FIELD.W);
      world.camX = roomLeftX;
      this.boss = createBoss(this.stage.boss, roomLeftX, world);
    }

    // 11. Boss update + combat.
    if (this.boss && !this.boss.dead) {
      this.boss.update(dt, player, bullets, { addEnemy: (s) => enemies.spawnNow(s, world) });

      // Player bullets damage boss weak points.
      bullets.forEachActive(b => {
        if (b.faction !== 'player') return;
        const bb = { x: b.x - 4, y: b.y - 4, w: 8, h: 8 };
        const boxes = this.boss.boxes();
        for (let i = 0; i < boxes.length; i++) {
          if (aabb(bb, boxes[i])) {
            if (b.pierce) {
              if (b.hits.has(this.boss)) break;
              b.hits.add(this.boss);
            } else {
              b.dead = true;
            }
            Sound.bossHit();
            this.boss.hurt(b.dmg, i);
            break;
          }
        }
      });

      // Boss body contact damages player.
      for (const box of this.boss.boxes()) {
        if (aabb(player.aabbBox(), box)) {
          const r = player.hurt(1, box.x + box.w / 2);
          if (r === 'hurt' || r === 'died') Sound.playerHurt();
          if (r === 'died') this._onDeath();
          break;
        }
      }

      // Boss phase change (edge detection — fires once per transition).
      const curPhase = this.boss.phase ?? null;
      if (this.prevBossPhase !== null && curPhase !== this.prevBossPhase && !this.boss.transitioning) {
        Sound.bossPhase();
      }
      this.prevBossPhase = curPhase;

      if (this.boss.dead) this._onBossDefeated();
    }
  }

  _onBossDefeated() {
    Sound.bossExplode();
    this.score += BOSSES[this.stage.boss].score;
    const drop = BOSSES[this.stage.boss].dropWeapon;
    if (drop) {
      const kind = Object.keys(POD_KIND_TO_WEAPON).find(k => POD_KIND_TO_WEAPON[k] === drop);
      if (kind) this.powerups.spawnPod(this.player.x, this.player.y - 60, kind);
    }
    this.score += SCORE.stageClear;
    this.boss = null;
    if (this.stageIndex >= stageCount() - 1) {
      Sound.win();
      this.state = 'win';
      this.persistBest();
    } else {
      Sound.stageClear();
      this.state = 'stageclear';
      this.persistBest();
    }
  }

  _onDeath() {
    this.player.lives -= 1;
    if (this.player.lives >= 0) {
      this.player.respawn(this.respawnX, this.respawnY);
    } else {
      Sound.gameOver();
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
        if (this.state === 'playing') {
          if (this.player.onGround) Sound.jump();
          this.player.jump();
        } else this.confirm();
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
      // 'mute' is handled in main.js (owns the mute button + glyph).
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
