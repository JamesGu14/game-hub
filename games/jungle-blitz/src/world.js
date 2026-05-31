// Terrain and camera logic for 丛林尖兵 JUNGLE BLITZ.
// Pure logic — no canvas drawing. Renderer reads world.palette/floors/platforms/decor/camX.

import { FIELD } from './config.js';
import { cameraTarget } from './util/math.js';

export class World {
  constructor(stage) {
    this.stage = stage;
    this.worldWidth = stage.worldWidth;
    this.floors = stage.floors;
    this.platforms = stage.platforms;
    this.decor = stage.decor || [];
    this.palette = stage.palette;
    this.camX = 0;
    // Fall-death threshold (used in later tasks for respawn detection).
    this.pitBottomY = FIELD.H + 80;
  }

  // Return the highest floor top-Y covering world-x `x`.
  // Returns Infinity when x is over a pit (no floor covers it).
  floorTopAt(x) {
    let best = Infinity;
    for (const f of this.floors) {
      if (x >= f.x && x <= f.x + f.w) {
        if (f.y < best) best = f.y;
      }
    }
    return best;
  }

  // One-way (drop-through) platforms.
  oneWayPlatforms() {
    return this.platforms.filter((p) => p.oneWay);
  }

  // Solid (blocking) platforms — none in stage 1 but implemented for later tasks.
  solids() {
    return this.platforms.filter((p) => !p.oneWay);
  }

  // Forward-only horizontal camera scroll.
  updateCamera(playerX) {
    this.camX = cameraTarget(playerX, this.worldWidth, this.camX);
  }
}
