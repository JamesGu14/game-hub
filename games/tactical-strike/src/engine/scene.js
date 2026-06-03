import * as THREE from 'three';

// --- Module-level state ---
let _scene, _camera, _renderer;
let _mapBoundingBoxes = [];

const FIXED_STEP = 1 / 60;

// ─────────────────────────────────────────────
// initScene
// ─────────────────────────────────────────────
export function initScene() {
  // Scene
  _scene = new THREE.Scene();
  _scene.fog = new THREE.Fog(0x202028, 20, 200);
  _scene.background = new THREE.Color(0x202028);

  // Camera
  const aspect = window.innerWidth / window.innerHeight;
  _camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 500);
  _camera.position.set(0, 1.7, 0);

  // Renderer
  const canvas = document.getElementById('game-canvas');
  _renderer = new THREE.WebGLRenderer({
    antialias: true,
    canvas: canvas || undefined,
  });
  _renderer.setSize(window.innerWidth, window.innerHeight);
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.shadowMap.enabled = true;
  _renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  if (!canvas) {
    document.body.appendChild(_renderer.domElement);
  }

  // Lights
  _addLights();

  // Resize handler
  window.addEventListener('resize', _onResize);

  return { scene: _scene, camera: _camera, renderer: _renderer };
}

function _addLights() {
  // Ambient
  const ambient = new THREE.AmbientLight(0xffffff, 0.35);
  _scene.add(ambient);

  // Primary directional (sun-like, casts shadows)
  const dirLight = new THREE.DirectionalLight(0xfff5e0, 1.0);
  dirLight.position.set(15, 30, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.camera.left = -40;
  dirLight.shadow.camera.right = 40;
  dirLight.shadow.camera.top = 40;
  dirLight.shadow.camera.bottom = -40;
  dirLight.shadow.bias = -0.001;
  _scene.add(dirLight);

  // Point light 1 — central room warm fill
  const point1 = new THREE.PointLight(0xffa060, 0.8, 30);
  point1.position.set(0, 2.8, 0);
  point1.castShadow = false;
  _scene.add(point1);

  // Point light 2 — left corridor
  const point2 = new THREE.PointLight(0x6080ff, 0.6, 20);
  point2.position.set(-14, 2.5, 0);
  point2.castShadow = false;
  _scene.add(point2);

  // Point light 3 — right corridor
  const point3 = new THREE.PointLight(0x6080ff, 0.6, 20);
  point3.position.set(14, 2.5, 0);
  point3.castShadow = false;
  _scene.add(point3);
}

function _onResize() {
  if (!_camera || !_renderer) return;
  _camera.aspect = window.innerWidth / window.innerHeight;
  _camera.updateProjectionMatrix();
  _renderer.setSize(window.innerWidth, window.innerHeight);
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

// ─────────────────────────────────────────────
// Getters
// ─────────────────────────────────────────────
export function getScene()    { return _scene; }
export function getCamera()   { return _camera; }
export function getRenderer() { return _renderer; }

// ─────────────────────────────────────────────
// Bounding box registry (populated by buildMap)
// ─────────────────────────────────────────────
export function getMapBoundingBoxes() { return _mapBoundingBoxes; }
export function setMapBoundingBoxes(boxes) { _mapBoundingBoxes = boxes; }

// ─────────────────────────────────────────────
// Game loop  — fixed timestep 1/60 s, accumulator pattern
// updateFn(dt) is called at fixed intervals
// renderFn(alpha) is called every frame with interpolation alpha
// ─────────────────────────────────────────────
export function gameLoop(updateFn, renderFn) {
  let lastTime = performance.now() / 1000;
  let accumulator = 0;

  function tick() {
    requestAnimationFrame(tick);

    const now = performance.now() / 1000;
    let frameTime = now - lastTime;
    lastTime = now;

    // Clamp to prevent spiral-of-death on very slow frames
    if (frameTime > 0.1) frameTime = 0.1;

    accumulator += frameTime;

    while (accumulator >= FIXED_STEP) {
      updateFn(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }

    const alpha = accumulator / FIXED_STEP;
    renderFn(alpha);

    _renderer.render(_scene, _camera);
  }

  requestAnimationFrame(tick);
}
