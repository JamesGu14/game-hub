import { CONFIG } from '../config';

/**
 * 左下虚拟摇杆：绝对方向模式。
 * - 触摸响应区比可视外圈大（容错）
 * - 死区内不响应
 * - 松手不重置 angle —— 由调用方决定是否继续用最后的 angle
 */
export class Joystick {
  private centerX = 0;
  private centerY = 0;
  private touchId: number | null = null;

  isActive = false;
  /** Touch position relative to joystick center, normalized [-1, 1]. */
  stickX = 0;
  stickY = 0;
  /** Last valid direction angle (radians). Updated only while active and outside dead zone. */
  angle = 0;
  /** Magnitude 0..1 of stick deflection (clamped). */
  magnitude = 0;

  setCenter(cssX: number, cssY: number): void {
    this.centerX = cssX;
    this.centerY = cssY;
  }

  /** Try to claim a touch as this joystick's. Returns true if claimed. */
  tryClaim(touch: Touch): boolean {
    if (this.touchId !== null) return false;
    const dx = touch.clientX - this.centerX;
    const dy = touch.clientY - this.centerY;
    if (Math.hypot(dx, dy) > CONFIG.JOYSTICK_RESPONSE_RADIUS) return false;
    this.touchId = touch.identifier;
    this.update(touch);
    return true;
  }

  update(touch: Touch): void {
    if (this.touchId !== touch.identifier) return;
    const dx = touch.clientX - this.centerX;
    const dy = touch.clientY - this.centerY;
    const mag = Math.hypot(dx, dy);
    if (mag < CONFIG.JOYSTICK_DEAD_ZONE) {
      this.isActive = false;
      this.stickX = 0;
      this.stickY = 0;
      this.magnitude = 0;
      return;
    }
    this.isActive = true;
    this.angle = Math.atan2(dy, dx);
    this.magnitude = Math.min(1, mag / CONFIG.JOYSTICK_OUTER_RADIUS);
    this.stickX = (dx / mag) * this.magnitude;
    this.stickY = (dy / mag) * this.magnitude;
  }

  release(touchId: number): void {
    if (this.touchId !== touchId) return;
    this.touchId = null;
    this.isActive = false;
    this.stickX = 0;
    this.stickY = 0;
    this.magnitude = 0;
  }

  getCenter(): { x: number; y: number } {
    return { x: this.centerX, y: this.centerY };
  }
}
