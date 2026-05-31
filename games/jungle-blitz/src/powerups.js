// Supply pod / power-up system for 丛林尖兵 JUNGLE BLITZ.
import { POWERUP, POD_KIND_TO_WEAPON } from './config.js';
import { aabb } from './util/math.js';

export class PowerUps {
  list = [];

  spawnFromStage(stage) {
    for (const p of stage.pods) {
      this.list.push({ x: p.x, y: p.y, y0: p.y, kind: p.kind, w: POWERUP.w, h: POWERUP.h, t: 0, dead: false });
    }
  }

  spawnPod(x, y, kind) {
    this.list.push({ x, y, y0: y, kind, w: POWERUP.w, h: POWERUP.h, t: 0, dead: false });
  }

  update(dt) {
    for (const p of this.list) {
      p.t += dt;
      p.y = p.y0 + Math.sin(p.t * POWERUP.bobHz * Math.PI * 2) * POWERUP.bobAmp;
    }
  }

  box(p) {
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  }

  tryCollect(playerBox) {
    const pod = this.list.find(p => !p.dead && aabb(playerBox, this.box(p)));
    if (!pod) return null;
    pod.dead = true;
    this.list = this.list.filter(p => !p.dead);
    return pod.kind;
  }

  // Collect all pods overlapped by active player-faction bullets this frame.
  // Returns an array of collected pod kinds (may be empty).
  popByBullet(bullets) {
    const collected = [];
    for (const p of this.list) {
      if (p.dead) continue;
      let hit = false;
      bullets.forEachActive(b => {
        if (!hit && b.faction === 'player' && aabb({ x: b.x - 5, y: b.y - 5, w: 10, h: 10 }, this.box(p))) {
          hit = true;
        }
      });
      if (hit) {
        p.dead = true;
        collected.push(p.kind);
      }
    }
    if (collected.length > 0) {
      this.list = this.list.filter(p => !p.dead);
    }
    return collected;
  }

  effectFor(kind) {
    if (kind === 'weaponS' || kind === 'weaponM' || kind === 'weaponL') {
      return { type: 'weapon', weapon: POD_KIND_TO_WEAPON[kind] };
    }
    if (kind === 'shield') return { type: 'shield' };
    if (kind === 'heal')   return { type: 'heal' };
    return null;
  }
}
