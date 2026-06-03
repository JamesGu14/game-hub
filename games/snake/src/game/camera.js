import { CONFIG } from '../config';
/**
 * 相机：跟随玩家、两段式缩放、轻微前瞻。
 * viewScale = 屏幕像素 / 世界单位。viewScale 越小，看到的世界越大。
 */
export class Camera {
    pos = { x: 0, y: 0 };
    viewScale = 1;
    cssWidth = 0;
    cssHeight = 0;
    setViewport(cssW, cssH) {
        this.cssWidth = cssW;
        this.cssHeight = cssH;
    }
    follow(target, targetAngle, snakeLength, boosting = false) {
        const segmentsOver = Math.max(0, snakeLength - CONFIG.CAMERA_ZOOM_THRESHOLD_LENGTH);
        let zoomFactor = 1 + Math.floor(segmentsOver / 10) * CONFIG.CAMERA_ZOOM_PER_10_SEGMENTS;
        if (boosting)
            zoomFactor *= CONFIG.BOOST_ZOOM_OUT_FACTOR;
        zoomFactor = Math.min(CONFIG.CAMERA_ZOOM_MAX, zoomFactor);
        this.viewScale = 1 / zoomFactor;
        const viewportWidthWorld = this.cssWidth / this.viewScale;
        const lookahead = viewportWidthWorld * CONFIG.CAMERA_LOOKAHEAD_RATIO;
        this.pos.x = target.x + Math.cos(targetAngle) * lookahead;
        this.pos.y = target.y + Math.sin(targetAngle) * lookahead;
    }
    /** Apply transform. Caller must ctx.save() before and ctx.restore() after. */
    applyTransform(ctx) {
        ctx.translate(this.cssWidth / 2, this.cssHeight / 2);
        ctx.scale(this.viewScale, this.viewScale);
        ctx.translate(-this.pos.x, -this.pos.y);
    }
}
