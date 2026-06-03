import { CONFIG } from '../config';
import { TAU } from '../util/math';
export const ITEM_EMOJI = {
    shield: '🛡️',
    magnet: '🧲',
    freeBoost: '⚡',
    foodRain: '💗',
};
const ALL_TYPES = ['shield', 'magnet', 'freeBoost', 'foodRain'];
/**
 * 道具管理器：地图常驻 ITEM_COUNT 个，拾取后立即随机补一个。
 * 类型在补充时均匀随机。
 */
export class ItemManager {
    items = [];
    fill(count = CONFIG.ITEM_COUNT) {
        while (this.items.length < count)
            this.items.push(this.spawnOne());
    }
    spawnOne() {
        const a = Math.random() * TAU;
        const r = Math.sqrt(Math.random()) * (CONFIG.WORLD_RADIUS - 100);
        const type = ALL_TYPES[Math.floor(Math.random() * ALL_TYPES.length)];
        return {
            pos: { x: Math.cos(a) * r, y: Math.sin(a) * r },
            type,
            rotation: Math.random() * TAU,
        };
    }
    update(dt) {
        for (const it of this.items)
            it.rotation += dt * 1.2;
    }
    /** Try pickup. Applies effect on hit and returns the type, or null. */
    tryPickup(snake) {
        const pickupR = CONFIG.HEAD_RADIUS + CONFIG.ITEM_PICKUP_RADIUS;
        const pickupRSq = pickupR * pickupR;
        for (let i = this.items.length - 1; i >= 0; i--) {
            const it = this.items[i];
            const dx = it.pos.x - snake.pos.x;
            const dy = it.pos.y - snake.pos.y;
            if (dx * dx + dy * dy <= pickupRSq) {
                applyEffect(snake, it.type);
                const last = this.items.pop();
                if (i < this.items.length)
                    this.items[i] = last;
                return it.type;
            }
        }
        return null;
    }
}
export function applyEffect(snake, type) {
    switch (type) {
        case 'shield':
            snake.shieldTimer = Math.max(snake.shieldTimer, CONFIG.ITEM_SHIELD_SEC);
            break;
        case 'magnet':
            snake.magnetTimer = Math.max(snake.magnetTimer, CONFIG.ITEM_MAGNET_SEC);
            break;
        case 'freeBoost':
            snake.freeBoostTimer = Math.max(snake.freeBoostTimer, CONFIG.ITEM_FREE_BOOST_SEC);
            break;
        case 'foodRain':
            snake.foodRainTimer = Math.max(snake.foodRainTimer, CONFIG.ITEM_FOOD_RAIN_SEC);
            break;
    }
}
/** Number of distinct active effects on a snake. */
export function countActiveEffects(snake) {
    let n = 0;
    if (snake.hasShield)
        n++;
    if (snake.hasMagnet)
        n++;
    if (snake.hasFreeBoost)
        n++;
    if (snake.hasFoodRain)
        n++;
    return n;
}
