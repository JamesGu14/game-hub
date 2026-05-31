// Enemy system for 丛林尖兵 JUNGLE BLITZ.
import { ENEMIES, ENEMY_BULLET, GRENADE, PHYSICS, FIELD } from './config.js';
import { aabb, clamp } from './util/math.js';

export class Enemies {
  list     = [];
  pending  = [];
  grenades = [];

  loadStage(stage) {
    this.pending  = [...stage.spawns].sort((a, b) => a.x - b.x);
    this.list     = [];
    this.grenades = [];
  }

  _make(spawn, world) {
    const base = ENEMIES[spawn.type];
    const floorY = world.floorTopAt(spawn.x);

    const common = {
      type:        spawn.type,
      x:           spawn.x,
      w:           base.w,
      h:           base.h,
      hp:          base.hp,
      hpMax:       base.hp,
      color:       base.color,
      score:       base.score,
      vx:          0,
      vy:          0,
      onGround:    false,
      dead:        false,
      hitFlashMs:  0,
      facing:      -1,
      t:           0,
    };

    switch (spawn.type) {
      case 'grunt':
        return { ...common, y: floorY - base.h, timer: base.fireMs };
      case 'turret':
        return { ...common, y: floorY - base.h, timer: base.fireMs };
      case 'drone': {
        const baseY = floorY - 150;
        return { ...common, y: baseY, baseY, timer: base.dropMs };
      }
      case 'jumper':
        return { ...common, y: floorY - base.h, timer: base.jumpMs };
      case 'grenadier':
        return { ...common, y: floorY - base.h, timer: base.throwMs };
      case 'nest':
        return { ...common, y: floorY - base.h, timer: base.fireMs };
      default:
        return { ...common, y: floorY - base.h, timer: 1000 };
    }
  }

  spawnNow(spawn, world) {
    this.list.push(this._make(spawn, world));
  }

  update(dt, world, player, bullets) {
    // Activate enemies as camera approaches.
    while (this.pending.length && this.pending[0].x < world.camX + FIELD.W + 80) {
      this.list.push(this._make(this.pending.shift(), world));
    }

    const px = player.x + player.w / 2;
    const py = player.y + player.height / 2;

    for (const e of this.list) {
      if (e.dead) continue;

      e.hitFlashMs = Math.max(0, e.hitFlashMs - dt * 1000);
      e.t += dt;

      // Face the player.
      e.facing = Math.sign(px - (e.x + e.w / 2)) || e.facing;

      switch (e.type) {
        case 'grunt':   this._updateGrunt(e, dt, world, player, px, py, bullets);     break;
        case 'turret':  this._updateTurret(e, dt, px, py, bullets);                   break;
        case 'drone':   this._updateDrone(e, dt, world, px, py, bullets);             break;
        case 'jumper':  this._updateJumper(e, dt, world, player, px, py, bullets);    break;
        case 'grenadier': this._updateGrenadier(e, dt, player, px);                   break;
        case 'nest':    this._updateNest(e, dt, bullets);                             break;
      }
    }

    // Update grenades.
    for (const g of this.grenades) {
      if (g.dead) continue;
      if (g.exploded) {
        g.blastT += dt;
        if (g.blastT >= 0.25) g.dead = true;
        continue;
      }
      g.vy += GRENADE.gravity * dt;
      g.x  += g.vx * dt;
      g.y  += g.vy * dt;
      g.t  += dt;
      const floorY = world.floorTopAt(g.x);
      if (g.t >= GRENADE.fuseS || g.y >= floorY) {
        g.exploded = true;
        g.blastT   = 0;
        // Clamp to floor so it doesn't render underground.
        if (g.y > floorY) g.y = floorY;
      }
    }

    // Cull off-screen and dead enemies.
    this.list     = this.list.filter(e => !e.dead && e.x >= world.camX - 220);
    this.grenades = this.grenades.filter(g => !g.dead);
  }

  // --- Per-type AI ---

  _updateGrunt(e, dt, world, player, px, py, bullets) {
    const ex = e.x + e.w / 2;
    const dist = px - ex;

    // Walk toward player if more than 40 px away.
    if (Math.abs(dist) > 40) {
      e.vx = Math.sign(dist) * ENEMIES.grunt.speed;
    } else {
      e.vx = 0;
    }
    e.x += e.vx * dt;

    // Gravity + landing.
    e.vy = clamp(e.vy + PHYSICS.gravity * dt, -2000, PHYSICS.maxFall);
    e.y += e.vy * dt;
    const floorY = world.floorTopAt(e.x + e.w / 2);
    if (e.y + e.h >= floorY) {
      e.y = floorY - e.h;
      e.vy = 0;
      e.onGround = true;
    } else {
      e.onGround = false;
    }

    // Fire timer.
    e.timer -= dt * 1000;
    if (e.timer <= 0) {
      bullets.spawn({
        x: e.x + e.w / 2, y: e.y + e.h * 0.4,
        dx: e.facing, dy: 0,
        speed: ENEMY_BULLET.speed, dmg: 1,
        faction: 'enemy', kind: 'normal', color: ENEMY_BULLET.color,
      });
      e.timer = ENEMIES.grunt.fireMs;
    }
  }

  _updateTurret(e, dt, px, py, bullets) {
    e.timer -= dt * 1000;
    if (e.timer <= 0) {
      const mx = e.x + e.w / 2;
      const my = e.y + e.h * 0.3;
      const dx = px - mx;
      const dy = py - my;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.spawn({
        x: mx, y: my,
        dx: dx / len, dy: dy / len,
        speed: ENEMY_BULLET.speed, dmg: 1,
        faction: 'enemy', kind: 'normal', color: ENEMY_BULLET.color,
      });
      e.timer = ENEMIES.turret.fireMs;
    }
  }

  _updateDrone(e, dt, world, px, py, bullets) {
    // Sinusoidal vertical hover.
    e.y = e.baseY + ENEMIES.drone.amp * Math.sin(e.t * 2);

    // Drift horizontally toward player, but keep altitude.
    const ex = e.x + e.w / 2;
    const dist = px - ex;
    if (Math.abs(dist) > 60) {
      e.x += Math.sign(dist) * ENEMIES.drone.speed * dt;
    }

    e.timer -= dt * 1000;
    if (e.timer <= 0) {
      // Drop bullet aimed toward player (slightly downward).
      const mx = e.x + e.w / 2;
      const my = e.y + e.h;
      const dx = px - mx;
      const dy = py - my;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      bullets.spawn({
        x: mx, y: my,
        dx: dx / len, dy: dy / len,
        speed: ENEMY_BULLET.speed, dmg: 1,
        faction: 'enemy', kind: 'normal', color: ENEMY_BULLET.color,
      });
      e.timer = ENEMIES.drone.dropMs;
    }
  }

  _updateJumper(e, dt, world, player, px, py, bullets) {
    // Gravity.
    e.vy = clamp(e.vy + PHYSICS.gravity * dt, -2000, PHYSICS.maxFall);
    e.y += e.vy * dt;
    e.x += e.vx * dt;

    // Land.
    const floorY = world.floorTopAt(e.x + e.w / 2);
    if (e.y + e.h >= floorY) {
      e.y = floorY - e.h;
      e.vy = 0;
      e.vx = 0;
      e.onGround = true;
    } else {
      e.onGround = false;
    }

    // Jump timer (only counts down on ground).
    if (e.onGround) {
      e.timer -= dt * 1000;
      if (e.timer <= 0) {
        e.vy = ENEMIES.jumper.jumpVel;
        e.vx = Math.sign(px - (e.x + e.w / 2)) * ENEMIES.jumper.speed;
        e.onGround = false;
        e.timer = ENEMIES.jumper.jumpMs;
      }
    }
  }

  _updateGrenadier(e, dt, player, px) {
    e.timer -= dt * 1000;
    if (e.timer <= 0) {
      this.grenades.push({
        x:        e.x + e.w / 2,
        y:        e.y,
        vx:       Math.sign(px - (e.x + e.w / 2)) * GRENADE.vx,
        vy:       GRENADE.vy,
        t:        0,
        dead:     false,
        exploded: false,
        blastT:   0,
      });
      e.timer = ENEMIES.grenadier.throwMs;
    }
  }

  _updateNest(e, dt, bullets) {
    e.timer -= dt * 1000;
    if (e.timer <= 0) {
      // Fan of 3 upward bullets.
      const dirs = [
        { dx: -0.3, dy: -1 },
        { dx:  0,   dy: -1 },
        { dx:  0.3, dy: -1 },
      ];
      for (const d of dirs) {
        const len = Math.sqrt(d.dx * d.dx + d.dy * d.dy);
        bullets.spawn({
          x: e.x + e.w / 2, y: e.y,
          dx: d.dx / len, dy: d.dy / len,
          speed: ENEMY_BULLET.speed, dmg: 1,
          faction: 'enemy', kind: 'normal', color: ENEMY_BULLET.color,
        });
      }
      e.timer = ENEMIES.nest.fireMs;
    }
  }

  // --- Queries ---

  aabbBox(e) {
    return { x: e.x, y: e.y, w: e.w, h: e.h };
  }

  hitTest(box) {
    for (const e of this.list) {
      if (!e.dead && aabb(box, this.aabbBox(e))) return e;
    }
    return null;
  }

  enemyContact(playerBox) {
    for (const e of this.list) {
      if (!e.dead && aabb(playerBox, this.aabbBox(e))) return e;
    }
    return null;
  }

  damage(e, dmg) {
    e.hp -= dmg;
    e.hitFlashMs = 80;
    if (e.hp <= 0) {
      e.dead = true;
      return e.score;
    }
    return 0;
  }

  forEachActive(cb) {
    for (const e of this.list) {
      if (!e.dead) cb(e);
    }
  }

  forEachBlast(cb) {
    for (const g of this.grenades) {
      if (g.exploded && !g.dead) cb(g);
    }
  }
}
