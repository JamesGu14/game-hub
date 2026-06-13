// entities/projectile.js — 纯表现弹道(hitscan 视觉轨迹);配合对象池复用。
// kind=攻击类型(single/splash/slow/charge/burn)→ drawProjectile 据此分类型渲染(箭矢/刀光/水弹/突进/火弹)。
export function newProjectile() {
  return { fromX: 0, fromY: 0, toX: 0, toY: 0, color: '#fff', ttl: 0, kind: 'single' };
}
export function resetProjectile(p, fromX, fromY, toX, toY, color, ttl = 0.12, kind = 'single') {
  p.fromX = fromX; p.fromY = fromY; p.toX = toX; p.toY = toY; p.color = color; p.ttl = ttl; p.kind = kind;
  return p;
}
