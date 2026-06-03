import { CONFIG } from '../config';

/**
 * 持续按住型按钮（加速）。
 * `pressed` 在按住期间为 true。`locked` 时点按无效（用于长度不足锁定）。
 */
export class HoldButton {
  private centerX = 0;
  private centerY = 0;
  private touchId: number | null = null;

  pressed = false;
  locked = false;

  setCenter(cssX: number, cssY: number): void {
    this.centerX = cssX;
    this.centerY = cssY;
  }

  setLocked(locked: boolean): void {
    this.locked = locked;
    if (locked) {
      this.pressed = false;
      this.touchId = null;
    }
  }

  tryClaim(touch: Touch): boolean {
    if (this.locked) return false;
    if (this.touchId !== null) return false;
    const dx = touch.clientX - this.centerX;
    const dy = touch.clientY - this.centerY;
    if (Math.hypot(dx, dy) > CONFIG.SKILL_BTN_RADIUS * 1.4) return false;
    this.touchId = touch.identifier;
    this.pressed = true;
    return true;
  }

  release(touchId: number): void {
    if (this.touchId !== touchId) return;
    this.touchId = null;
    this.pressed = false;
  }

  getCenter(): { x: number; y: number } {
    return { x: this.centerX, y: this.centerY };
  }
}

/**
 * 冷却型按钮（子弹）—— 阶段 7 使用，这里先定义留好接口。
 */
export class CooldownButton {
  private centerX = 0;
  private centerY = 0;
  private touchId: number | null = null;
  cooldownLeft = 0;
  cooldownDuration: number;
  /** True for exactly one tick after a successful press; consumer must read & clear. */
  justFired = false;

  constructor(cooldownDuration: number) {
    this.cooldownDuration = cooldownDuration;
  }

  setCenter(cssX: number, cssY: number): void {
    this.centerX = cssX;
    this.centerY = cssY;
  }

  update(dt: number): void {
    if (this.cooldownLeft > 0) this.cooldownLeft -= dt;
    this.justFired = false;
  }

  tryClaim(touch: Touch): boolean {
    if (this.touchId !== null) return false;
    const dx = touch.clientX - this.centerX;
    const dy = touch.clientY - this.centerY;
    if (Math.hypot(dx, dy) > CONFIG.SKILL_BTN_RADIUS * 1.4) return false;
    this.touchId = touch.identifier;
    if (this.cooldownLeft <= 0) {
      this.justFired = true;
      this.cooldownLeft = this.cooldownDuration;
    }
    return true;
  }

  release(touchId: number): void {
    if (this.touchId !== touchId) return;
    this.touchId = null;
  }

  getCenter(): { x: number; y: number } {
    return { x: this.centerX, y: this.centerY };
  }

  getCooldownProgress(): number {
    if (this.cooldownDuration <= 0) return 1;
    return 1 - Math.max(0, this.cooldownLeft) / this.cooldownDuration;
  }
}
