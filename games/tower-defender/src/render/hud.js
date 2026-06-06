// render/hud.js — 顶部 HUD（屏幕坐标）：城防 / 金钱 / 波次 / 备战倒计时 / 速度暂停。只读 state。
export function drawHud(ctx, state, view) {
  ctx.fillStyle = 'rgba(12,15,23,.55)';
  ctx.fillRect(0, 0, view.w, 36);
  ctx.fillStyle = '#fff'; ctx.font = '600 16px system-ui'; ctx.textBaseline = 'middle';

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ff8a8a'; ctx.fillText(`❤ ${state.castleHp}/${state.castleMaxHp}`, 64, 18);
  ctx.fillStyle = '#ffe08a'; ctx.fillText(`💰 ${state.gold}`, 178, 18);
  ctx.fillStyle = '#cfe0ff';
  ctx.fillText(`🌊 ${Math.min(state.waveIndex + 1, state.level.waves.length)}/${state.level.waves.length}`, 282, 18);
  ctx.fillStyle = '#fff';
  if (state.phase === 'prep') ctx.fillText(`⏱ 备战 ${Math.max(0, Math.ceil(state.prepTimer))}s`, 384, 18);
  else if (state.phase === 'combat') ctx.fillText('⚔ 交战', 384, 18);

  ctx.textAlign = 'right'; ctx.fillStyle = '#bdbdbd';
  ctx.fillText(`${state.paused ? '▶ 已暂停(空格)' : '⏸ 空格'}   ${state.speed}× (F)`, view.w - 12, 18);
}
