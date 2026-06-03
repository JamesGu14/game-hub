// Aim state: angle + charge power, device-adaptive.
// mode 'mouse' = aim follows pointer direction from worm.
// mode 'angle' = angle adjusted by key/gamepad increments.

import { AIM } from './config.js';
import { angleOf, clamp } from './util/math.js';

export const Aim = {
  angle: -Math.PI / 4,  // radians; 0=right, -PI/2=up
  charging: false,
  power: AIM.minSpeed,
  mode: 'angle',        // 'mouse' | 'angle'
  _dir: 1,              // charge direction: +1 rising / -1 falling (ping-pong)

  // --- Aiming ---

  /** Point toward the mouse/pointer position in field coords. */
  setFromMouse(worm, mx, my) {
    this.angle = angleOf(mx - worm.x, my - worm.y);
    this.mode = 'mouse';
  },

  /**
   * Nudge angle by key/gamepad. dir: -1 (up/ccw) or +1 (down/cw).
   * Clamps to [-PI+0.05, 0.05] so you can't aim straight back or below ground.
   */
  nudgeAngle(dir, dt) {
    this.angle = clamp(
      this.angle + dir * AIM.angleStepRad * dt,
      -Math.PI + 0.05,
      0.05,
    );
    this.mode = 'angle';
  },

  // --- Charging ---

  /** Begin charge hold. */
  startCharge() {
    this.charging = true;
    this.power = AIM.minSpeed;
    this._dir = 1;
  },

  /** Advance charge each frame while held — ping-pongs between min and max. */
  stepCharge(dt) {
    if (!this.charging) return;
    const rampRate = (AIM.maxSpeed - AIM.minSpeed) / AIM.chargeSeconds;
    this.power += this._dir * rampRate * dt;
    if (this.power >= AIM.maxSpeed) { this.power = AIM.maxSpeed; this._dir = -1; }      // hit top → fall back
    else if (this.power <= AIM.minSpeed) { this.power = AIM.minSpeed; this._dir = 1; }  // hit bottom → rise again
  },

  /**
   * Release charge — returns the launch params and resets state.
   * @returns {{ angle: number, speed: number }}
   */
  release() {
    this.charging = false;
    const speed = this.power;
    this.power = AIM.minSpeed;
    return { angle: this.angle, speed };
  },

  /** Reset to defaults (call at turn start). */
  reset(facing = 1) {
    this.angle = facing >= 0 ? -Math.PI / 4 : -Math.PI * 3 / 4;
    this.charging = false;
    this.power = AIM.minSpeed;
    this.mode = 'angle';
    this._dir = 1;
  },
};
