import { CONFIG } from '../config';
/**
 * 固定步长游戏循环：逻辑 60Hz，渲染随显示器刷新率。
 * 慢帧时最多累积 MAX_FRAME_CATCHUP 步，避免恶性回追。
 */
export class GameLoop {
    callbacks;
    stepMs;
    accumulator = 0;
    lastTime = 0;
    rafId = 0;
    running = false;
    frameCount = 0;
    fpsLastUpdate = 0;
    currentFps = 0;
    constructor(callbacks) {
        this.callbacks = callbacks;
        this.stepMs = 1000 / CONFIG.TICK_HZ;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.lastTime = performance.now();
        this.fpsLastUpdate = this.lastTime;
        this.rafId = requestAnimationFrame(this.tick);
    }
    stop() {
        this.running = false;
        cancelAnimationFrame(this.rafId);
    }
    getFps() {
        return this.currentFps;
    }
    tick = (now) => {
        if (!this.running)
            return;
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
            this.currentFps = Math.round((this.frameCount * 1000) / (now - this.fpsLastUpdate));
            this.frameCount = 0;
            this.fpsLastUpdate = now;
        }
        this.rafId = requestAnimationFrame(this.tick);
    };
}
