import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { getStage } from './levels.js';
import { PLAYER, WEAPONS, ITEMS } from './config.js';
import { Player } from './player.js';
import { Bullets } from './bullets.js';
import { PowerUps } from './powerups.js';
import { Enemies } from './enemies.js';
import { aabb } from './util/math.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const world = new World(getStage(0));
Input.init(canvas, (cx) => renderer.mapClientXToField(cx));

const spawnY = world.floorTopAt(80) - PLAYER.h;
const player = new Player(80, spawnY);
Input.on((a) => { if (a === 'jump') player.jump(); });

const bullets = new Bullets();
const powerups = new PowerUps();
powerups.spawnFromStage(getStage(0));

const enemies = new Enemies();
enemies.loadStage(getStage(0));

const game = { world, player, bullets, powerups, enemies, score: 0 };

function step(dt) {
  player.update(dt, Input, world);
  world.updateCamera(player.x);

  if (Input.fireHeld && player.fireCooldown <= 0) {
    bullets.fireWeapon(player.weapon, player.muzzle(), player.aim, 'player');
    player.fireCooldown = WEAPONS[player.weapon].interval / 1000;
  }
  player.fireCooldown -= dt;

  bullets.update(dt, world);

  enemies.update(dt, world, player, bullets);

  // Player bullets hit enemies.
  bullets.forEachActive(b => {
    if (b.faction !== 'player') return;
    const box = { x: b.x - 4, y: b.y - 4, w: 8, h: 8 };
    const e = enemies.hitTest(box);
    if (e) {
      if (b.pierce && b.hits.has(e)) return;
      game.score += enemies.damage(e, b.dmg);
      if (b.pierce) b.hits.add(e); else b.dead = true;
    }
  });

  // Store (do NOT apply yet) player damage flags for the next task.
  player._enemyContact = enemies.enemyContact(player.aabbBox());
  player._enemyHitBullet = null;
  bullets.forEachActive(b => {
    if (b.faction === 'enemy' && !player._enemyHitBullet &&
        aabb(player.aabbBox(), { x: b.x - 4, y: b.y - 4, w: 8, h: 8 })) {
      player._enemyHitBullet = b;
    }
  });

  powerups.update(dt);

  const apply = (kind) => {
    if (!kind) return;
    const e = powerups.effectFor(kind);
    if (!e) return;
    if (e.type === 'weapon') player.weapon = e.weapon;
    else if (e.type === 'heal') player.hp = Math.min(PLAYER.hpMax, player.hp + ITEMS.healAmount);
    else if (e.type === 'shield') player.shieldMs = ITEMS.shieldMs;
  };

  apply(powerups.tryCollect(player.aabbBox()));
  const popped = powerups.popByBullet(bullets);
  popped.forEach(apply);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045); last = now;
  Input.poll(); step(dt); renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
