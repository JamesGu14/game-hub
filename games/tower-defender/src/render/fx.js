// render/fx.js — 特效的产生（老化在 gameLoop.cleanup，绘制在 entityRenderer.drawFx）。
// fx 是 gameState 的一部分（cosmetic state）；本模块只 push 不绘制，故 systems 可安全引用（无 DOM）。
export function spawnFloat(state, x, y, text, color = '#ffe08a') {
  state.fx.push({ kind: 'float', x, y, text, color, ttl: 0.8 });
}

// [P2] AoE/溅射光圈（招牌技、溅射、水淹七军）。r=像素半径。
export function spawnRing(state, x, y, color, r, ttl = 0.4) {
  state.fx.push({ kind: 'ring', x, y, color, r, ttl, maxTtl: ttl });
}
