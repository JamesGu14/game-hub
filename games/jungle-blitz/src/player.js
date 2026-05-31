// Player entity for 丛林尖兵 JUNGLE BLITZ.
import { PHYSICS, PLAYER, DEFAULT_WEAPON } from './config.js';
import { clamp, aabb, resolveAim } from './util/math.js';

export class Player {
  constructor(spawnX, spawnY) {
    this.x = spawnX;
    this.y = spawnY;
    this.w = PLAYER.w;
    this.h = PLAYER.h;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.prone = false;
    this.hp = PLAYER.hpMax;
    this.lives = PLAYER.lives;
    this.invMs = 0;
    this.shieldMs = 0;
    this.knockMs = 0;
    this.weapon = DEFAULT_WEAPON;
    this.aim = { x: 1, y: 0 };
    this.fireCooldown = 0;
  }

  get height() {
    return this.prone ? PLAYER.proneH : PLAYER.h;
  }

  aabbBox() {
    return { x: this.x, y: this.y, w: this.w, h: this.height };
  }

  update(dt, input, world) {
    // 1. Horizontal movement + facing
    this.vx = input.moveX * PHYSICS.moveSpeed;
    if (input.moveX !== 0) this.facing = Math.sign(input.moveX);

    // 2. Crouch / prone — keep feet planted
    const wantProne = input.aimDown && this.onGround;
    if (wantProne !== this.prone) {
      if (wantProne) {
        // entering prone: feet stay, top rises
        this.y += (PLAYER.h - PLAYER.proneH);
      } else {
        // leaving prone: feet stay, top lowers
        this.y -= (PLAYER.h - PLAYER.proneH);
      }
      this.prone = wantProne;
    }

    // 3. Gravity
    this.vy = clamp(this.vy + PHYSICS.gravity * dt, PHYSICS.jumpVel, PHYSICS.maxFall);

    // 4. Move X + solid collision
    const prevX = this.x;
    this.x = clamp(this.x + this.vx * dt, 0, world.worldWidth - this.w);
    for (const s of world.solids()) {
      if (aabb(this.aabbBox(), s)) {
        // push back toward prevX side
        if (this.x > prevX) {
          this.x = s.x - this.w;
        } else {
          this.x = s.x + s.w;
        }
        this.vx = 0;
      }
    }

    // 5. Move Y + landing
    const prevBottom = this.y + this.height;
    this.y += this.vy * dt;

    // Gather landing candidates
    let candidateTop = world.floorTopAt(this.x + this.w / 2);

    for (const p of world.oneWayPlatforms()) {
      if (this.vy >= 0 &&
          this.x + this.w > p.x && this.x < p.x + p.w &&
          prevBottom <= p.y + 1 &&
          this.y + this.height >= p.y) {
        if (p.y < candidateTop) candidateTop = p.y;
      }
    }

    if (this.y + this.height >= candidateTop) {
      this.y = candidateTop - this.height;
      this.vy = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    // 6. Aim vector
    this.aim = resolveAim({
      facing: this.facing,
      moveX: input.moveX,
      aimUp: input.aimUp,
      aimDown: input.aimDown,
      onGround: this.onGround,
    });

    // 7. Timers (damage logic wired in later task)
    this.invMs    = Math.max(0, this.invMs    - dt * 1000);
    this.shieldMs = Math.max(0, this.shieldMs - dt * 1000);
    this.knockMs  = Math.max(0, this.knockMs  - dt * 1000);
  }

  jump() {
    if (this.onGround) {
      this.vy = PHYSICS.jumpVel;
      this.onGround = false;
    }
  }

  /** World-space gun muzzle tip. */
  muzzle() {
    const cx = this.x + this.w / 2;
    const gy = this.y + (this.prone ? this.height - 8 : this.height * 0.4);
    return { x: cx + this.aim.x * 20, y: gy + this.aim.y * 20 };
  }
}
