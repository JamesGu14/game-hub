// 群雄逐鹿·孟德篇 — 引导入口 (Task A1 minimal bootstrap)
// 仅初始化 Three 渲染器、resize 处理、静音按钮与返回 HUB；
// 完整场景流（标题 → 剧情 → 战斗 → 战后）由后续 Task C4 在此扩展。
import * as THREE from 'three';

const canvas = document.getElementById('game');

// --- Renderer -------------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0x161d2e, 1);

// Placeholder scene + iso-ish camera so the canvas shows the theme backdrop
// without errors before the real battlefield is built.
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);
camera.position.set(8, 10, 8);
camera.lookAt(0, 0, 0);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- Render loop ----------------------------------------------------------
function frame() {
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- Mute toggle (hub convention) ----------------------------------------
let muted = false;
const btnMute = document.getElementById('btn-mute');
function applyMute() {
  btnMute.textContent = muted ? '🔇' : '🔊';
  btnMute.classList.toggle('muted', muted);
  // Real audio engine is wired in Task C4 (audio.js); expose state for it.
  window.__cczMuted = muted;
}
btnMute?.addEventListener('click', () => {
  muted = !muted;
  applyMute();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'm' || e.key === 'M') {
    muted = !muted;
    applyMute();
  }
});
applyMute();

// #back-to-hub is a plain <a href> — already functional, no JS needed.

console.log('caocao-zhuan boot ok');
