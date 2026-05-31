import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { getStage } from './levels.js';
import { PLAYER, WEAPONS, ITEMS } from './config.js';
import { Player } from './player.js';
import { Bullets } from './bullets.js';
import { PowerUps } from './powerups.js';

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

function step(dt) {
  player.update(dt, Input, world);
  world.updateCamera(player.x);

  if (Input.fireHeld && player.fireCooldown <= 0) {
    bullets.fireWeapon(player.weapon, player.muzzle(), player.aim, 'player');
    player.fireCooldown = WEAPONS[player.weapon].interval / 1000;
  }
  player.fireCooldown -= dt;

  bullets.update(dt, world);

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
  const popped = powerups.popByBullet(bullets); // array — apply each
  popped.forEach(apply);
}

const game = { world, player, bullets, powerups };
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045); last = now;
  Input.poll(); step(dt); renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
