// Hit spark particle bursts at impact points.
import * as THREE from 'three';
import { getScene } from './scene.js';

const SPARK_COUNT     = 10;
const SPARK_LIFE_MS   = 220;
const SPARK_SPEED     = 4.5;   // world units / second
const GRAVITY         = -9;

const _sparkGeo = new THREE.SphereGeometry(0.04, 4, 4);
const _sparkMat = new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.95 });
const _sparkMatHead = new THREE.MeshBasicMaterial({ color: 0xffe060, transparent: true, opacity: 0.95 });

export function spawnHitSparks(point, isHeadshot) {
  const scene = getScene();
  if (!scene || !point) return;
  const mat = isHeadshot ? _sparkMatHead : _sparkMat;
  const sparks = [];
  for (let i = 0; i < SPARK_COUNT; i++) {
    const m = new THREE.Mesh(_sparkGeo, mat);
    m.position.copy(point);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = SPARK_SPEED * (0.6 + Math.random() * 0.6);
    const vx = Math.sin(phi) * Math.cos(theta) * speed;
    const vy = Math.abs(Math.cos(phi)) * speed; // bias upward
    const vz = Math.sin(phi) * Math.sin(theta) * speed;
    sparks.push({ mesh: m, vx, vy, vz });
    scene.add(m);
  }
  const start = performance.now();
  function tick() {
    const now = performance.now();
    const age = now - start;
    if (age >= SPARK_LIFE_MS) {
      for (const s of sparks) scene.remove(s.mesh);
      return;
    }
    const dt = 1 / 60;
    for (const s of sparks) {
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.vy += GRAVITY * dt;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
