const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
function resize() { canvas.width = innerWidth; canvas.height = innerHeight; }
addEventListener('resize', resize); resize();
ctx.fillStyle = '#0c1408'; ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.fillStyle = '#8bc34a'; ctx.font = '28px system-ui'; ctx.fillText('丛林尖兵 — scaffold OK', 40, 80);
