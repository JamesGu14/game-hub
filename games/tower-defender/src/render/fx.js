// render/fx.js — 飘字特效的产生（老化在 gameLoop.cleanup，绘制在 entityRenderer.drawFx）。
// fx 是 gameState 的一部分（cosmetic state）；本函数只 push，不绘制。
export function spawnFloat(state, x, y, text, color = '#ffe08a') {
  state.fx.push({ x, y, text, color, ttl: 0.8 });
}
