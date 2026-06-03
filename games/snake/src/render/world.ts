import { CONFIG } from '../config';

const TAU = Math.PI * 2;

/**
 * 绘制世界：浅色背景 + 圆形地图边界 + 边缘红色危险区。
 * 已应用相机变换 —— 坐标系是世界坐标。
 */
export function drawWorld(ctx: CanvasRenderingContext2D): void {
  // 世界内的浅蓝背景圆
  ctx.beginPath();
  ctx.arc(0, 0, CONFIG.WORLD_RADIUS, 0, TAU);
  ctx.fillStyle = '#cfe9ff';
  ctx.fill();

  // 危险区：环形红色渐变（接近边界越红）
  const dangerInner = CONFIG.WORLD_RADIUS - CONFIG.DANGER_ZONE_WIDTH;
  const grad = ctx.createRadialGradient(0, 0, dangerInner, 0, 0, CONFIG.WORLD_RADIUS);
  grad.addColorStop(0, 'rgba(239,68,68,0)');
  grad.addColorStop(1, 'rgba(239,68,68,0.55)');
  ctx.beginPath();
  ctx.arc(0, 0, CONFIG.WORLD_RADIUS, 0, TAU);
  ctx.fillStyle = grad;
  ctx.fill();

  // 边界粗线
  ctx.beginPath();
  ctx.arc(0, 0, CONFIG.WORLD_RADIUS, 0, TAU);
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#1e3a5f';
  ctx.stroke();

  // 装饰：淡淡的圆点点缀（每 200 px 一个）
  ctx.fillStyle = 'rgba(120,150,200,0.15)';
  const r = CONFIG.WORLD_RADIUS;
  for (let x = -r; x <= r; x += 200) {
    for (let y = -r; y <= r; y += 200) {
      if (x * x + y * y > r * r * 0.9) continue;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, TAU);
      ctx.fill();
    }
  }
}
