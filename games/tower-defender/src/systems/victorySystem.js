// systems/victorySystem.js — 读 gameState 判 won/lost + 星级（M1）。
// lost 多由 pathSystem 即时设置；此处兜底 + 判 won。
export function victorySystem(state) {
  if (state.phase !== 'combat') return;          // [P0-3]
  if (state.castleHp <= 0) { state.phase = 'lost'; return; }
  if (state.allWavesEmitted && state.enemies.length === 0) {
    state.phase = 'won';
    state.stars = state.castleHp === state.castleMaxHp ? 3
      : state.castleHp >= state.castleMaxHp * 0.5 ? 2 : 1;
  }
}
