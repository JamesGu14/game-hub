// entities/projectile.js — 纯表现弹道（hitscan 视觉轨迹）；配合对象池复用。
export function newProjectile() {
  return { fromX: 0, fromY: 0, toX: 0, toY: 0, color: '#fff', ttl: 0 };
}
export function resetProjectile(p, fromX, fromY, toX, toY, color, ttl = 0.12) {
  p.fromX = fromX; p.fromY = fromY; p.toX = toX; p.toY = toY; p.color = color; p.ttl = ttl;
  return p;
}
