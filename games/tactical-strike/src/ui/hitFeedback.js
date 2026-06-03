// Hit feedback: crosshair hit-marker flash + floating damage numbers.
import * as THREE from 'three';

let _markerEl = null;
let _overlayEl = null;
let _markerTimer = 0;

const _floating = []; // { el, worldPos, spawnAt, lifeMs }
const _projection = new THREE.Vector3();

const DAMAGE_LIFE_MS = 700;
const MARKER_LIFE_MS = 140;

export function initHitFeedback() {
  _markerEl = document.getElementById('hit-marker');
  _overlayEl = document.getElementById('damage-overlay');
}

export function showHitMarker(isHeadshot) {
  if (!_markerEl) return;
  _markerEl.classList.remove('flash', 'flash-head');
  // Force reflow so the same class re-triggers the CSS animation.
  void _markerEl.offsetWidth;
  _markerEl.classList.add(isHeadshot ? 'flash-head' : 'flash');
  clearTimeout(_markerTimer);
  _markerTimer = setTimeout(() => {
    _markerEl.classList.remove('flash', 'flash-head');
  }, MARKER_LIFE_MS);
}

export function spawnDamageNumber(worldPos, amount, isHeadshot) {
  if (!_overlayEl || !worldPos) return;
  const el = document.createElement('div');
  el.className = 'dmg-num' + (isHeadshot ? ' dmg-head' : '');
  el.textContent = isHeadshot ? `${amount} HEAD` : String(amount);
  _overlayEl.appendChild(el);
  _floating.push({
    el,
    worldPos: worldPos.clone(),
    spawnAt: performance.now(),
    lifeMs: DAMAGE_LIFE_MS,
  });
}

export function updateHitFeedback(camera) {
  if (_floating.length === 0 || !camera) return;
  const now = performance.now();
  const w = window.innerWidth;
  const h = window.innerHeight;
  for (let i = _floating.length - 1; i >= 0; i--) {
    const f = _floating[i];
    const age = now - f.spawnAt;
    if (age >= f.lifeMs) {
      f.el.remove();
      _floating.splice(i, 1);
      continue;
    }
    _projection.copy(f.worldPos);
    _projection.project(camera);
    if (_projection.z > 1) {
      f.el.style.display = 'none';
      continue;
    }
    f.el.style.display = '';
    const t = age / f.lifeMs;
    const sx = (_projection.x * 0.5 + 0.5) * w;
    const sy = (1 - (_projection.y * 0.5 + 0.5)) * h - t * 40;
    f.el.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -50%)`;
    f.el.style.opacity = String(1 - t);
  }
}
