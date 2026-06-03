import { CONFIG } from '../config';
/**
 * 持续按住型按钮（加速）。
 * `pressed` 在按住期间为 true。`locked` 时点按无效（用于长度不足锁定）。
 */
export class HoldButton {
    centerX = 0;
    centerY = 0;
    touchId = null;
    pressed = false;
    locked = false;
    setCenter(cssX, cssY) {
        this.centerX = cssX;
        this.centerY = cssY;
    }
    setLocked(locked) {
        this.locked = locked;
        if (locked) {
            this.pressed = false;
            this.touchId = null;
        }
    }
    tryClaim(touch) {
        if (this.locked)
            return false;
        if (this.touchId !== null)
            return false;
        const dx = touch.clientX - this.centerX;
        const dy = touch.clientY - this.centerY;
        if (Math.hypot(dx, dy) > CONFIG.SKILL_BTN_RADIUS * 1.4)
            return false;
        this.touchId = touch.identifier;
        this.pressed = true;
        return true;
    }
    release(touchId) {
        if (this.touchId !== touchId)
            return;
        this.touchId = null;
        this.pressed = false;
    }
    getCenter() {
        return { x: this.centerX, y: this.centerY };
    }
}
/**
 * 冷却型按钮（子弹）—— 阶段 7 使用，这里先定义留好接口。
 */
export class CooldownButton {
    centerX = 0;
    centerY = 0;
    touchId = null;
    cooldownLeft = 0;
    cooldownDuration;
    /** True for exactly one tick after a successful press; consumer must read & clear. */
    justFired = false;
    constructor(cooldownDuration) {
        this.cooldownDuration = cooldownDuration;
    }
    setCenter(cssX, cssY) {
        this.centerX = cssX;
        this.centerY = cssY;
    }
    update(dt) {
        if (this.cooldownLeft > 0)
            this.cooldownLeft -= dt;
        this.justFired = false;
    }
    tryClaim(touch) {
        if (this.touchId !== null)
            return false;
        const dx = touch.clientX - this.centerX;
        const dy = touch.clientY - this.centerY;
        if (Math.hypot(dx, dy) > CONFIG.SKILL_BTN_RADIUS * 1.4)
            return false;
        this.touchId = touch.identifier;
        if (this.cooldownLeft <= 0) {
            this.justFired = true;
            this.cooldownLeft = this.cooldownDuration;
        }
        return true;
    }
    release(touchId) {
        if (this.touchId !== touchId)
            return;
        this.touchId = null;
    }
    getCenter() {
        return { x: this.centerX, y: this.centerY };
    }
    getCooldownProgress() {
        if (this.cooldownDuration <= 0)
            return 1;
        return 1 - Math.max(0, this.cooldownLeft) / this.cooldownDuration;
    }
}
