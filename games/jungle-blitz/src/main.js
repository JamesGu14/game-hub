import { World } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { getStage } from './levels.js';
import { PLAYER } from './config.js';
import { Player } from './player.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const world = new World(getStage(0));
Input.init(canvas, (cx) => renderer.mapClientXToField(cx));

const spawnY = world.floorTopAt(80) - PLAYER.h;
const player = new Player(80, spawnY);
Input.on((a) => { if (a === 'jump') player.jump(); });

function step(dt) {
  player.update(dt, Input, world);
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
