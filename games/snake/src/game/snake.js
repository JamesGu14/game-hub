import { CONFIG } from '../config';
import { angleDiff, clamp } from '../util/math';
/**
 * 蛇实体（玩家 + AI 共用）。
 * 头部按角度运动；身体段通过沿头部轨迹按固定距离采样得到。
 */
export class Snake {
    pos;
    angle;
    targetAngle;
    length;
    speed;
    color;
    name;
    isPlayer;
    alive = true;
    invincibleTimer = 0;
    isBoosting = false;
    shieldTimer = 0;
    magnetTimer = 0;
    freeBoostTimer = 0;
    foodRainTimer = 0;
    get hasShield() { return this.shieldTimer > 0; }
    get hasMagnet() { return this.magnetTimer > 0; }
    get hasFreeBoost() { return this.freeBoostTimer > 0; }
    get hasFoodRain() { return this.foodRainTimer > 0; }
    /** Positions of food dropped this tick by boost length-drain. Consumed externally. */
    pendingFoodDrops = [];
    boostLossAccumulator = 0;
    /** Head position history, index 0 = newest (current head). */
    trail = [];
    constructor(opts) {
        this.pos = { ...opts.pos };
        this.angle = opts.angle;
        this.targetAngle = opts.angle;
        this.length = opts.length;
        this.color = opts.color;
        this.name = opts.name;
        this.isPlayer = opts.isPlayer ?? false;
        this.speed = CONFIG.SNAKE_BASE_SPEED;
        // Pre-fill trail so initial body is visible.
        const initialSpan = (opts.length + 2) * CONFIG.SEGMENT_SPACING;
        const step = 2; // small step in world units
        const cosA = Math.cos(opts.angle);
        const sinA = Math.sin(opts.angle);
        for (let d = 0; d <= initialSpan; d += step) {
            this.trail.push({ x: opts.pos.x - cosA * d, y: opts.pos.y - sinA * d });
        }
    }
    setTargetAngle(angle) {
        this.targetAngle = angle;
    }
    update(dt) {
        if (!this.alive)
            return;
        if (this.invincibleTimer > 0)
            this.invincibleTimer -= dt;
        if (this.shieldTimer > 0)
            this.shieldTimer = Math.max(0, this.shieldTimer - dt);
        if (this.magnetTimer > 0)
            this.magnetTimer = Math.max(0, this.magnetTimer - dt);
        if (this.freeBoostTimer > 0)
            this.freeBoostTimer = Math.max(0, this.freeBoostTimer - dt);
        if (this.foodRainTimer > 0)
            this.foodRainTimer = Math.max(0, this.foodRainTimer - dt);
        // Effective boost: only when commanded AND length above minimum
        const boost = this.isBoosting && this.length > CONFIG.BOOST_MIN_LENGTH;
        this.speed = boost
            ? CONFIG.SNAKE_BASE_SPEED * CONFIG.BOOST_SPEED_MULTIPLIER
            : CONFIG.SNAKE_BASE_SPEED;
        const maxTurn = CONFIG.MAX_TURN_RATE_RAD * dt;
        const diff = angleDiff(this.angle, this.targetAngle);
        this.angle += clamp(diff, -maxTurn, maxTurn);
        this.pos.x += Math.cos(this.angle) * this.speed * dt;
        this.pos.y += Math.sin(this.angle) * this.speed * dt;
        this.trail.unshift({ x: this.pos.x, y: this.pos.y });
        if (this.trail.length > CONFIG.TRAIL_MAX_ENTRIES) {
            this.trail.length = CONFIG.TRAIL_MAX_ENTRIES;
        }
        // Boost length drain → drop food at tail positions
        if (boost) {
            this.boostLossAccumulator += dt * CONFIG.BOOST_LENGTH_DRAIN_PER_SEC;
            if (this.boostLossAccumulator >= 1) {
                const whole = Math.floor(this.boostLossAccumulator);
                const drainable = Math.min(whole, this.length - CONFIG.BOOST_MIN_LENGTH);
                if (drainable > 0) {
                    const segs = this.getSegments();
                    for (let i = 0; i < drainable; i++) {
                        const idx = segs.length - 1 - i;
                        if (idx > 0) {
                            this.pendingFoodDrops.push({ x: segs[idx].x, y: segs[idx].y });
                        }
                    }
                    this.length -= drainable;
                }
                this.boostLossAccumulator -= whole;
            }
        }
        else {
            this.boostLossAccumulator = 0;
        }
    }
    respawn(pos, angle, length) {
        this.pos = { x: pos.x, y: pos.y };
        this.angle = angle;
        this.targetAngle = angle;
        this.length = length;
        this.alive = true;
        this.invincibleTimer = CONFIG.RESPAWN_INVINCIBLE_SEC;
        this.shieldTimer = 0;
        this.magnetTimer = 0;
        this.freeBoostTimer = 0;
        this.foodRainTimer = 0;
        this.isBoosting = false;
        this.boostLossAccumulator = 0;
        this.speed = CONFIG.SNAKE_BASE_SPEED;
        this.trail.length = 0;
        const initialSpan = (length + 2) * CONFIG.SEGMENT_SPACING;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        for (let d = 0; d <= initialSpan; d += 2) {
            this.trail.push({ x: pos.x - cosA * d, y: pos.y - sinA * d });
        }
    }
    /**
     * 沿轨迹按 SEGMENT_SPACING 采样得到所有身体段（含头部）。
     * 返回顺序：头 → 尾。
     */
    getSegments() {
        const spacing = CONFIG.SEGMENT_SPACING;
        const segments = [{ x: this.pos.x, y: this.pos.y }];
        let accumulated = 0;
        let nextTargetDist = spacing;
        for (let i = 1; i < this.trail.length && segments.length < this.length; i++) {
            const prev = this.trail[i - 1];
            const curr = this.trail[i];
            const segLen = Math.hypot(curr.x - prev.x, curr.y - prev.y);
            while (accumulated + segLen >= nextTargetDist &&
                segments.length < this.length) {
                const t = (nextTargetDist - accumulated) / segLen;
                segments.push({
                    x: prev.x + (curr.x - prev.x) * t,
                    y: prev.y + (curr.y - prev.y) * t,
                });
                nextTargetDist += spacing;
            }
            accumulated += segLen;
        }
        return segments;
    }
}
