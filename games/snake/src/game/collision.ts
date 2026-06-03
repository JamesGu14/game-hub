import { CONFIG } from '../config';
import type { Vec2 } from '../util/math';
import type { Snake } from './snake';

export interface SegmentRef {
  snake: Snake;
  pos: Vec2;
  /** 0 = head, larger = closer to tail. */
  index: number;
}

/**
 * 蛇身段空间哈希。每帧重建（蛇身全动）。
 * 用 cell key 数字化 (cx * P + cy) 比字符串 key 快很多。
 */
const P = 100003;

export class SpatialHash {
  private cells = new Map<number, SegmentRef[]>();

  clear(): void {
    this.cells.clear();
  }

  indexSnake(snake: Snake): void {
    const segs = snake.getSegments();
    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const cx = Math.floor(seg.x / CONFIG.COLLISION_CELL_SIZE);
      const cy = Math.floor(seg.y / CONFIG.COLLISION_CELL_SIZE);
      const k = cx * P + cy;
      let arr = this.cells.get(k);
      if (!arr) {
        arr = [];
        this.cells.set(k, arr);
      }
      arr.push({ snake, pos: seg, index: i });
    }
  }

  /**
   * 遍历半径内所有段。cb 返回 true 提前终止。
   */
  forEachInRadius(
    pos: Vec2,
    radius: number,
    cb: (ref: SegmentRef) => boolean | void,
  ): void {
    const size = CONFIG.COLLISION_CELL_SIZE;
    const minCx = Math.floor((pos.x - radius) / size);
    const maxCx = Math.floor((pos.x + radius) / size);
    const minCy = Math.floor((pos.y - radius) / size);
    const maxCy = Math.floor((pos.y + radius) / size);
    const rSq = radius * radius;
    for (let cx = minCx; cx <= maxCx; cx++) {
      for (let cy = minCy; cy <= maxCy; cy++) {
        const arr = this.cells.get(cx * P + cy);
        if (!arr) continue;
        for (const ref of arr) {
          const dx = ref.pos.x - pos.x;
          const dy = ref.pos.y - pos.y;
          if (dx * dx + dy * dy <= rSq) {
            if (cb(ref) === true) return;
          }
        }
      }
    }
  }
}
