import { getCamera } from '../engine/scene.js';

// --- Module-level state ---
let _locked = false;
let _yaw = 0;
let _pitch = 0;
let _sensScale = 1;

const PITCH_LIMIT = (85 * Math.PI) / 180;

export function setSensitivityScale(s) {
  _sensScale = Math.max(0.05, Math.min(2, s || 1));
}

// ─────────────────────────────────────────────
// initCamera
// ─────────────────────────────────────────────
export function initCamera(domElement) {
  // Request pointer lock on click
  domElement.addEventListener('click', () => {
    domElement.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    _locked = document.pointerLockElement === domElement;
  });

  document.addEventListener('mousemove', (e) => {
    if (!_locked) return;

    const sensitivity = 0.002 * _sensScale;
    _yaw   -= e.movementX * sensitivity;
    _pitch -= e.movementY * sensitivity;

    // Clamp pitch to ±85°
    _pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, _pitch));

    // Apply to the engine camera using Euler YXZ order (standard FPS)
    const cam = getCamera();
    if (cam) {
      cam.rotation.order = 'YXZ';
      cam.rotation.y = _yaw;
      cam.rotation.x = _pitch;
    }
  });
}

// ─────────────────────────────────────────────
// Getters
// ─────────────────────────────────────────────
// Returns the engine camera instance (not a new one)
export { getCamera };

export function isLocked() {
  return _locked;
}

export function getYawPitch() {
  return { yaw: _yaw, pitch: _pitch };
}
