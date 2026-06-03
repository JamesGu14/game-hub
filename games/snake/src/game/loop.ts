import { CONFIG } from '../config';

export interface LoopCallbacks {
  update: (dt: number) => void;
  render: (alpha: number) => void;
}

/**
 * 固定步长游戏循环：逻辑 60Hz，渲染随显示器刷新率。
 * 慢帧时最多累积 MAX_FRAME_CATCHUP 步，避免恶性回追。
 */
export class GameLoop {
  private readonly stepMs: number;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  private frameCount = 0;
  private fpsLastUpdate = 0;
  private currentFps = 0;

  constructor(private readonly callbacks: LoopCallbacks) {
    this.stepMs = 1000 / CONFIG.TICK_HZ;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.fpsLastUpdate = this.lastTime;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  getFps(): number {
    return this.currentFps;
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    const frameMs = now - this.lastTime;
    this.lastTime = now;

    const maxAccumulated = this.stepMs * CONFIG.MAX_FRAME_CATCHUP;
    this.accumulator = Math.min(this.accumulator + frameMs, maxAccumulated);

    const dtSeconds = this.stepMs / 1000;
    while (this.accumulator >= this.stepMs) {
      this.callbacks.update(dtSeconds);
      this.accumulator -= this.stepMs;
    }

    const alpha = this.accumulator / this.stepMs;
    this.callbacks.render(alpha);

    this.frameCount++;
    if (now - this.fpsLastUpdate >= 1000) {
      this.currentFps = Math.round(
        (this.frameCount * 1000) / (now - this.fpsLastUpdate),
      );
      this.frameCount = 0;
      this.fpsLastUpdate = now;
    }

    this.rafId = requestAnimationFrame(this.tick);
  };
}
