import { CONFIG } from '../config';
import { angleDiff, randRange } from '../util/math';
export const PERSONALITIES = [
    {
        id: 'lvse',
        name: '小绿',
        color: '#22c55e',
        aggression: -0.4,
        boostFrequency: 0.05,
        initialLength: 15,
    },
    {
        id: 'lanse',
        name: '小蓝',
        color: '#3b82f6',
        aggression: 0,
        boostFrequency: 0.25,
        initialLength: 25,
    },
    {
        id: 'hongse',
        name: '小红',
        color: '#ef4444',
        aggression: 0.3,
        boostFrequency: 0.55,
        initialLength: 40,
    },
];
/**
 * AI 决策：以固定频率重算目标角度。
 *  1. 边界回避（高优先）
 *  2. 威胁回避（前方扇形内的其他蛇身）
 *  3. 觅食（视野内最近食物）
 *  4. 噪声扰动
 */
export class AIBrain {
    snake;
    personality;
    decisionTimer = 0;
    noise = 0;
    noiseTimer = 0;
    wanderTarget;
    boostTimer = 0;
    constructor(snake, personality) {
        this.snake = snake;
        this.personality = personality;
        this.wanderTarget = snake.angle;
    }
    think(dt, foods, hash) {
        // Boost timer countdown
        if (this.boostTimer > 0) {
            this.boostTimer -= dt;
            if (this.boostTimer <= 0)
                this.snake.isBoosting = false;
        }
        this.decisionTimer += dt;
        this.noiseTimer += dt;
        if (this.noiseTimer >= 1 / CONFIG.AI_NOISE_HZ) {
            this.noiseTimer = 0;
            this.noise = randRange(-CONFIG.AI_NOISE_AMPLITUDE, CONFIG.AI_NOISE_AMPLITUDE);
        }
        if (this.decisionTimer < 1 / CONFIG.AI_DECISION_HZ)
            return;
        this.decisionTimer = 0;
        // 1. Wall avoidance
        const headDist = Math.hypot(this.snake.pos.x, this.snake.pos.y);
        const wallMargin = CONFIG.WORLD_RADIUS - CONFIG.AI_WALL_AVOID_MARGIN;
        if (headDist > wallMargin) {
            const inward = Math.atan2(-this.snake.pos.y, -this.snake.pos.x);
            this.snake.setTargetAngle(inward + this.noise);
            this.wanderTarget = inward;
            return;
        }
        // 2. Threat avoidance (forward cone)
        const threatInfo = this.detectThreatWithDistance(hash);
        if (threatInfo !== null) {
            const away = threatInfo.angle + Math.PI;
            this.snake.setTargetAngle(away + this.noise);
            this.wanderTarget = away;
            // Trigger boost to flee
            this.maybeBoost(true);
            return;
        }
        // 3. Food seeking
        const foodInfo = this.findNearestFoodWithDistance(foods);
        if (foodInfo !== null) {
            this.snake.setTargetAngle(foodInfo.angle + this.noise);
            this.wanderTarget = foodInfo.angle;
            // Boost if food is moderately far
            if (foodInfo.distance > CONFIG.AI_BOOST_FOOD_DIST_THRESHOLD) {
                this.maybeBoost(false);
            }
            return;
        }
        // 4. Wander
        this.snake.setTargetAngle(this.wanderTarget + this.noise);
    }
    maybeBoost(fleeing) {
        if (this.snake.isBoosting)
            return;
        if (this.snake.length < CONFIG.AI_BOOST_MIN_LENGTH)
            return;
        const decisionsPerSec = CONFIG.AI_DECISION_HZ;
        // Convert freq (0..1 per sec) into per-decision probability
        const perDecisionProb = (this.personality.boostFrequency / decisionsPerSec) * (fleeing ? 2 : 1);
        if (Math.random() < perDecisionProb) {
            this.snake.isBoosting = true;
            this.boostTimer = randRange(CONFIG.AI_BOOST_DURATION_MIN, CONFIG.AI_BOOST_DURATION_MAX);
        }
    }
    detectThreatWithDistance(hash) {
        const head = this.snake.pos;
        let closestDistSq = Infinity;
        let closestAngle = 0;
        hash.forEachInRadius(head, CONFIG.AI_THREAT_RADIUS, (ref) => {
            if (ref.snake === this.snake)
                return;
            const dx = ref.pos.x - head.x;
            const dy = ref.pos.y - head.y;
            const dsq = dx * dx + dy * dy;
            const angleTo = Math.atan2(dy, dx);
            const angleDelta = Math.abs(angleDiff(this.snake.angle, angleTo));
            if (angleDelta < CONFIG.AI_THREAT_CONE_HALF && dsq < closestDistSq) {
                closestDistSq = dsq;
                closestAngle = angleTo;
            }
        });
        return closestDistSq === Infinity
            ? null
            : { angle: closestAngle, distance: Math.sqrt(closestDistSq) };
    }
    findNearestFoodWithDistance(foods) {
        const head = this.snake.pos;
        const maxR = CONFIG.AI_SIGHT_RADIUS;
        const maxRSq = maxR * maxR;
        let closestDistSq = Infinity;
        let closestAngle = 0;
        for (const f of foods) {
            const dx = f.pos.x - head.x;
            const dy = f.pos.y - head.y;
            const dsq = dx * dx + dy * dy;
            if (dsq < maxRSq && dsq < closestDistSq) {
                closestDistSq = dsq;
                closestAngle = Math.atan2(dy, dx);
            }
        }
        return closestDistSq === Infinity
            ? null
            : { angle: closestAngle, distance: Math.sqrt(closestDistSq) };
    }
}
