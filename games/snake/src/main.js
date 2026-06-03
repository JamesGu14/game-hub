import { GameLoop } from './game/loop';
import { Snake } from './game/snake';
import { Camera } from './game/camera';
import { FoodManager } from './game/food';
import { AIBrain, PERSONALITIES } from './game/ai';
import { SpatialHash } from './game/collision';
import { BulletManager } from './game/bullet';
import { ItemManager } from './game/item';
import { Joystick } from './input/joystick';
import { HoldButton, CooldownButton } from './input/skillBtn';
import { drawWorld } from './render/world';
import { drawSnake } from './render/snake';
import { drawFoods, drawExpOrbs } from './render/food';
import { drawBullets } from './render/bullet';
import { drawItems } from './render/item';
import { drawJoystick } from './render/joystick';
import { drawHoldButton, drawCooldownButton } from './render/skillBtn';
import { drawDeathOverlay } from './render/overlay';
import { drawTopLeft, drawActiveEffects, drawMinimap } from './render/hud';
import { CONFIG, PLAYER_NAME_PLACEHOLDER } from './config';
import { TAU, randRange } from './util/math';
// ───── DOM ─────
const canvasEl = document.getElementById('game');
const fpsEl = document.getElementById('fps');
if (!(canvasEl instanceof HTMLCanvasElement))
    throw new Error('#game not a canvas');
if (!fpsEl)
    throw new Error('#fps not found');
const canvas = canvasEl;
const ctx2d = canvas.getContext('2d');
if (!ctx2d)
    throw new Error('2D context unavailable');
const ctx = ctx2d;
// ───── Entities ─────
const camera = new Camera();
const joystick = new Joystick();
const boostBtn = new HoldButton();
const bulletBtn = new CooldownButton(CONFIG.BULLET_COOLDOWN_SEC);
const foods = new FoodManager();
foods.fill();
const items = new ItemManager();
items.fill();
const hash = new SpatialHash();
const bullets = new BulletManager();
const foodRainAccumulator = new Map();
const player = new Snake({
    pos: { x: 0, y: 0 },
    angle: 0,
    length: CONFIG.PLAYER_INITIAL_LENGTH,
    color: '#fbbf24',
    name: PLAYER_NAME_PLACEHOLDER,
    isPlayer: true,
});
function randomDiskPos(maxRadius) {
    const a = Math.random() * TAU;
    const r = Math.sqrt(Math.random()) * maxRadius;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
}
function findSafeSpawn(others) {
    const minDist = CONFIG.SAFE_SPAWN_MIN_DIST_FROM_SNAKES;
    const maxR = CONFIG.WORLD_RADIUS - 200;
    for (let attempt = 0; attempt < 30; attempt++) {
        const pos = randomDiskPos(maxR);
        let ok = true;
        for (const s of others) {
            if (!s.alive)
                continue;
            const dx = s.pos.x - pos.x;
            const dy = s.pos.y - pos.y;
            if (dx * dx + dy * dy < minDist * minDist) {
                ok = false;
                break;
            }
        }
        if (ok)
            return { pos, angle: randRange(0, TAU) };
    }
    return { pos: randomDiskPos(maxR), angle: randRange(0, TAU) };
}
const aiSnakes = [];
const aiBrains = [];
const aiRespawnTimers = new Map();
for (const personality of PERSONALITIES) {
    const spawn = findSafeSpawn([player]);
    const snake = new Snake({
        pos: spawn.pos,
        angle: spawn.angle,
        length: personality.initialLength,
        color: personality.color,
        name: personality.name,
    });
    aiSnakes.push(snake);
    aiBrains.push(new AIBrain(snake, personality));
}
const allSnakes = () => [player, ...aiSnakes];
// ───── Player state ─────
let playerKills = 0;
let deathScreen = null;
// ───── Sizing ─────
function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    camera.setViewport(w, h);
    joystick.setCenter(CONFIG.JOYSTICK_OFFSET_X, h - CONFIG.JOYSTICK_OFFSET_Y);
    boostBtn.setCenter(w - CONFIG.BOOST_BTN_OFFSET_RIGHT, h - CONFIG.BOOST_BTN_OFFSET_BOTTOM);
    bulletBtn.setCenter(w - CONFIG.BULLET_BTN_OFFSET_RIGHT, h - CONFIG.BULLET_BTN_OFFSET_BOTTOM);
}
resize();
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', resize);
// ───── Touch ─────
function routeTouchStart(touch) {
    if (joystick.tryClaim(touch))
        return;
    if (bulletBtn.tryClaim(touch))
        return;
    if (boostBtn.tryClaim(touch))
        return;
}
function handleTouchStart(e) {
    for (let i = 0; i < e.changedTouches.length; i++)
        routeTouchStart(e.changedTouches[i]);
    e.preventDefault();
}
function handleTouchMove(e) {
    for (let i = 0; i < e.changedTouches.length; i++)
        joystick.update(e.changedTouches[i]);
    e.preventDefault();
}
function handleTouchEnd(e) {
    for (let i = 0; i < e.changedTouches.length; i++) {
        const id = e.changedTouches[i].identifier;
        joystick.release(id);
        boostBtn.release(id);
        bulletBtn.release(id);
    }
    e.preventDefault();
}
window.addEventListener('touchstart', handleTouchStart, { passive: false });
window.addEventListener('touchmove', handleTouchMove, { passive: false });
window.addEventListener('touchend', handleTouchEnd, { passive: false });
window.addEventListener('touchcancel', handleTouchEnd, { passive: false });
// Desktop mouse fallback
let mouseDown = false;
canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    const t = mouseToTouch(e);
    if (joystick.tryClaim(t))
        return;
    if (bulletBtn.tryClaim(t))
        return;
    boostBtn.tryClaim(t);
});
canvas.addEventListener('mousemove', (e) => {
    if (mouseDown)
        joystick.update(mouseToTouch(e));
});
function releaseAllMouse() {
    joystick.release(-1);
    boostBtn.release(-1);
    bulletBtn.release(-1);
}
canvas.addEventListener('mouseup', () => {
    if (mouseDown)
        releaseAllMouse();
    mouseDown = false;
});
canvas.addEventListener('mouseleave', () => {
    if (mouseDown)
        releaseAllMouse();
    mouseDown = false;
});
function mouseToTouch(e) {
    return { identifier: -1, clientX: e.clientX, clientY: e.clientY };
}
// ───── Kill / Respawn ─────
function killSnake(victim, killer) {
    if (!victim.alive)
        return;
    victim.alive = false;
    foods.dropOrbsFromSnake(victim);
    bullets.clearOwner(victim);
    if (killer && killer !== victim && killer.alive) {
        killer.length += Math.floor(victim.length / 2);
        if (killer === player)
            playerKills++;
    }
    if (victim === player) {
        deathScreen = {
            timer: CONFIG.PLAYER_DEATH_SCREEN_SEC,
            killerName: killer ? killer.name : '边界',
            lengthAtDeath: victim.length,
        };
    }
    else {
        aiRespawnTimers.set(victim, CONFIG.AI_RESPAWN_DELAY_SEC);
    }
}
function respawnPlayer() {
    const spawn = findSafeSpawn(aiSnakes);
    player.respawn(spawn.pos, spawn.angle, CONFIG.RESPAWN_LENGTH);
}
function respawnAI(snake) {
    const spawn = findSafeSpawn([player, ...aiSnakes.filter((s) => s !== snake)]);
    snake.respawn(spawn.pos, spawn.angle, CONFIG.RESPAWN_LENGTH);
}
// ───── Collision ─────
function checkCollisions() {
    for (const s of allSnakes()) {
        if (!s.alive)
            continue;
        if (s.invincibleTimer > 0)
            continue;
        // Wall
        const distFromCenter = Math.hypot(s.pos.x, s.pos.y);
        if (distFromCenter > CONFIG.WORLD_RADIUS - CONFIG.HEAD_RADIUS) {
            killSnake(s, null);
            continue;
        }
        // Shielded snakes can't be killed by collision
        if (s.hasShield)
            continue;
        // Body of others
        const hitRadius = CONFIG.HEAD_RADIUS + CONFIG.SEGMENT_RADIUS;
        let killer = null;
        hash.forEachInRadius(s.pos, hitRadius, (ref) => {
            if (ref.snake === s)
                return false;
            if (!ref.snake.alive)
                return false;
            if (ref.index === 0)
                return false;
            killer = ref.snake;
            return true;
        });
        if (killer)
            killSnake(s, killer);
    }
}
// ───── Loop ─────
const loop = new GameLoop({
    update: (dt) => {
        // Death screen countdown
        if (deathScreen) {
            deathScreen.timer -= dt;
            if (deathScreen.timer <= 0) {
                respawnPlayer();
                deathScreen = null;
            }
        }
        // AI respawn timers
        for (const [snake, t] of aiRespawnTimers) {
            const nt = t - dt;
            if (nt <= 0) {
                respawnAI(snake);
                aiRespawnTimers.delete(snake);
            }
            else {
                aiRespawnTimers.set(snake, nt);
            }
        }
        // Spatial hash rebuild
        hash.clear();
        for (const s of allSnakes())
            if (s.alive)
                hash.indexSnake(s);
        // AI think
        for (const brain of aiBrains) {
            if (brain.snake.alive)
                brain.think(dt, foods.foods, hash);
        }
        // Player input
        if (player.alive && joystick.isActive) {
            player.setTargetAngle(joystick.angle);
        }
        // Boost: lock button when length too low
        boostBtn.setLocked(player.length <= CONFIG.BOOST_MIN_LENGTH);
        player.isBoosting = player.alive && (boostBtn.pressed || player.hasFreeBoost);
        // Bullet button update + fire
        bulletBtn.update(dt);
        if (bulletBtn.justFired && player.alive) {
            bullets.spawn(player, player.pos, player.angle);
        }
        // Movement
        for (const s of allSnakes())
            s.update(dt);
        // Bullets
        bullets.update(dt, hash, killSnake);
        // Items
        items.update(dt);
        for (const s of allSnakes()) {
            if (!s.alive)
                continue;
            items.tryPickup(s);
        }
        items.fill();
        // Magnet effect: pull food toward snake heads
        for (const s of allSnakes()) {
            if (!s.alive || !s.hasMagnet)
                continue;
            const r = CONFIG.MAGNET_RADIUS;
            const rSq = r * r;
            const pullSpeed = CONFIG.MAGNET_PULL_SPEED;
            for (const f of foods.foods) {
                const dx = s.pos.x - f.pos.x;
                const dy = s.pos.y - f.pos.y;
                const dsq = dx * dx + dy * dy;
                if (dsq < rSq && dsq > 0.01) {
                    const d = Math.sqrt(dsq);
                    f.pos.x += (dx / d) * pullSpeed * dt;
                    f.pos.y += (dy / d) * pullSpeed * dt;
                }
            }
        }
        // Food rain effect: spawn foods around head
        for (const s of allSnakes()) {
            if (!s.alive)
                continue;
            if (!s.hasFoodRain) {
                foodRainAccumulator.delete(s);
                continue;
            }
            const interval = 1 / CONFIG.FOOD_RAIN_HZ;
            let acc = (foodRainAccumulator.get(s) ?? 0) + dt;
            while (acc >= interval) {
                const a = Math.random() * TAU;
                const r = Math.sqrt(Math.random()) * CONFIG.FOOD_RAIN_RADIUS;
                foods.addFoodAt({
                    x: s.pos.x + Math.cos(a) * r,
                    y: s.pos.y + Math.sin(a) * r,
                });
                acc -= interval;
            }
            foodRainAccumulator.set(s, acc);
        }
        // Collect dropped food from boost length-drain
        for (const s of allSnakes()) {
            if (s.pendingFoodDrops.length > 0) {
                for (const p of s.pendingFoodDrops)
                    foods.addFoodAt(p);
                s.pendingFoodDrops.length = 0;
            }
        }
        // Collisions
        checkCollisions();
        // Food
        for (const s of allSnakes()) {
            if (!s.alive)
                continue;
            const gain = foods.tryEat(s);
            if (gain > 0)
                s.length += gain;
        }
        foods.fill();
        foods.decay(dt);
        camera.follow(player.pos, player.angle, player.length, player.isBoosting);
    },
    render: () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.fillStyle = '#0a1a2e';
        ctx.fillRect(0, 0, w, h);
        ctx.save();
        camera.applyTransform(ctx);
        drawWorld(ctx);
        drawFoods(ctx, foods.foods, camera);
        drawExpOrbs(ctx, foods.orbs, camera);
        drawItems(ctx, items.items, camera);
        for (const s of aiSnakes)
            drawSnake(ctx, s);
        drawSnake(ctx, player);
        drawBullets(ctx, bullets.bullets, camera);
        ctx.restore();
        drawTopLeft(ctx, player.length, playerKills);
        drawActiveEffects(ctx, w, player);
        drawMinimap(ctx, w, player, aiSnakes);
        drawJoystick(ctx, joystick);
        drawHoldButton(ctx, boostBtn, '🚀', '加速');
        drawCooldownButton(ctx, bulletBtn, '🔫', '子弹');
        if (deathScreen) {
            drawDeathOverlay(ctx, w, h, {
                timer: deathScreen.timer,
                killerName: deathScreen.killerName,
                lengthAtDeath: deathScreen.lengthAtDeath,
                kills: playerKills,
            });
        }
    },
});
loop.start();
window.setInterval(() => {
    if (fpsEl) {
        fpsEl.textContent = `FPS: ${loop.getFps()} · len ${player.length} · K ${playerKills}`;
    }
}, 250);
