import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { getStage } from './levels.js';
import { PHYSICS, PLAYER } from './config.js';
import { clamp } from './util/math.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const world = new World(getStage(0));
Input.init(canvas, (cx) => renderer.mapClientXToField(cx));

// Temporary player box (replaced by player.js in a later task).
const player = { x: 80, y: 300, w: PLAYER.w, h: PLAYER.h, vx: 0, vy: 0, onGround: false, facing: 1 };
let wantJump = false;
Input.on((a) => { if (a === 'jump') wantJump = true; });

function step(dt) {
  player.vx = Input.moveX * PHYSICS.moveSpeed;
  if (Input.moveX) player.facing = Math.sign(Input.moveX);
  if (wantJump && player.onGround) { player.vy = PHYSICS.jumpVel; player.onGround = false; }
  wantJump = false;
  player.vy = clamp(player.vy + PHYSICS.gravity * dt, PHYSICS.jumpVel, PHYSICS.maxFall);
  player.x = clamp(player.x + player.vx * dt, 0, world.worldWidth - player.w);
  player.y += player.vy * dt;
  const top = world.floorTopAt(player.x + player.w / 2);
  if (player.y + player.h >= top) { player.y = top - player.h; player.vy = 0; player.onGround = true; }
  else player.onGround = false;
  world.updateCamera(player.x);
}

const game = { world, player };
let last = performance.now();
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.045); last = now;
  Input.poll(); step(dt); renderer.render(game);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
