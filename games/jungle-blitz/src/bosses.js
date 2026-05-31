// Boss definitions for 丛林尖兵 JUNGLE BLITZ. Logic-only — no canvas drawing.
import { BOSSES, ENEMY_BULLET, FIELD } from './config.js';

// Factory: returns a boss object by type. roomLeftX is the world-x of the left edge
// of the locked camera room. world is the World instance (for floorTopAt).
export function createBoss(type, roomLeftX, world) {
  switch (type) {
    case 'gate': return _createGate(roomLeftX, world);
    default: throw new Error('Unknown boss type: ' + type);
  }
}

function _createGate(roomLeftX, world) {
  const cfg = BOSSES.gate;

  // Gate body: tall pillar anchored to the right wall of the boss room.
  const gateX = roomLeftX + FIELD.W - 120;
  const gateW = 120;
  const gateTopY = 80;
  const gateBottomY = world.floorTopAt(gateX + gateW / 2);
  const gateH = gateBottomY - gateTopY;

  // Two cannon ports on the left face.
  const portX = gateX;           // left face of gate
  const portUpperY = gateTopY + gateH * 0.28;
  const portLowerY = gateTopY + gateH * 0.68;

  // Central glowing core — the only weak point.
  const coreW = 46;
  const coreH = 46;
  const coreX = gateX + (gateW - coreW) / 2;
  const coreY = gateTopY + (gateH - coreH) / 2;

  let fireTimer = 0.6;   // first shot after half a second
  let portToggle = 0;    // alternates 0/1 between upper/lower port

  return {
    type: 'gate',
    name: '装甲炮门',

    // Overall bounds (for renderer).
    x: gateX,
    y: gateTopY,
    w: gateW,
    h: gateH,

    // Cached port positions (renderer may read these).
    portUpperY,
    portLowerY,
    portX,

    // Core rect (renderer may read this).
    coreX,
    coreY,
    coreW,
    coreH,

    hp: cfg.hp,
    hpMax: cfg.hp,
    phase: 1,
    dead: false,
    hitFlashMs: 0,

    update(dt, player, bullets /*, ctx */) {
      if (this.hitFlashMs > 0) this.hitFlashMs -= dt * 1000;

      fireTimer -= dt;
      if (fireTimer <= 0) {
        fireTimer = 1.1;

        // Compute aiming direction from the firing port to the player centre.
        const px = player.x + player.w / 2;
        const py = player.y + player.height / 2;
        const py_port = portToggle === 0 ? portUpperY : portLowerY;
        portToggle ^= 1;

        const ddx = px - portX;
        const ddy = py - py_port;
        const len = Math.hypot(ddx, ddy) || 1;

        bullets.spawn({
          x: portX,
          y: py_port,
          dx: ddx / len,
          dy: ddy / len,
          speed: ENEMY_BULLET.speed,
          dmg: 1,
          faction: 'enemy',
          kind: 'normal',
          color: ENEMY_BULLET.color,
        });
      }
    },

    boxes() {
      return [{ x: coreX, y: coreY, w: coreW, h: coreH }];
    },

    hurt(dmg /*, which */) {
      this.hp -= dmg;
      this.hitFlashMs = 90;
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
      }
    },
  };
}
