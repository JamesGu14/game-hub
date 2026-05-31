// Bullet system for 丛林尖兵 JUNGLE BLITZ.
import { FIELD, WEAPONS, BULLET } from './config.js';
import { angleOf, spreadDirections } from './util/math.js';

// Note: bullets intentionally do NOT collide with terrain (kid-friendly readability).

export class Bullets {
  list = [];

  spawn({ x, y, dx, dy, speed, dmg, faction, kind, color, pierce }) {
    this.list.push({
      x, y,
      vx: dx * speed,
      vy: dy * speed,
      dmg, faction, kind, color,
      pierce: !!pierce,
      life: BULLET.lifeS,
      dead: false,
      hits: new Set(),
    });
  }

  fireWeapon(weaponKey, muzzle, aim, faction) {
    const w = WEAPONS[weaponKey];
    if (w.kind === 'normal') {
      this.spawn({ x: muzzle.x, y: muzzle.y, dx: aim.x, dy: aim.y, speed: w.speed, dmg: w.dmg, faction, kind: 'normal', color: w.color });
    } else if (w.kind === 'spread') {
      const base = angleOf(aim.x, aim.y);
      for (const d of spreadDirections(base, w.pellets, w.spreadDeg)) {
        this.spawn({ x: muzzle.x, y: muzzle.y, dx: d.x, dy: d.y, speed: w.speed, dmg: w.dmg, faction, kind: 'normal', color: w.color });
      }
    } else if (w.kind === 'laser') {
      this.spawn({ x: muzzle.x, y: muzzle.y, dx: aim.x, dy: aim.y, speed: w.speed, dmg: w.dmg, faction, kind: 'laser', color: w.color, pierce: true });
    }
  }

  update(dt, world) {
    for (const b of this.list) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (
        b.life <= 0 ||
        b.x < world.camX - 200 ||
        b.x > world.camX + FIELD.W + 200 ||
        b.y < -200 ||
        b.y > FIELD.H + 200
      ) {
        b.dead = true;
      }
    }
    this.list = this.list.filter(b => !b.dead);
  }

  forEachActive(cb) {
    for (const b of this.list) {
      if (!b.dead) cb(b);
    }
  }

  clear() {
    this.list = [];
  }
}
