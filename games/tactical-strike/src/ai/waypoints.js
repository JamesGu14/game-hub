import * as THREE from 'three';

// Waypoints for the 回-shape warehouse map.
// World: X ∈ [-30, 30], Z ∈ [-22, 22]
const _waypoints = [
  // North corridor
  new THREE.Vector3(-20, 0, -15),
  new THREE.Vector3(-10, 0, -12),
  new THREE.Vector3(  0, 0, -12),
  new THREE.Vector3( 10, 0, -12),
  new THREE.Vector3( 20, 0, -15),
  // South corridor
  new THREE.Vector3(-20, 0, 15),
  new THREE.Vector3(-10, 0, 12),
  new THREE.Vector3(  0, 0, 12),
  new THREE.Vector3( 10, 0, 12),
  new THREE.Vector3( 20, 0, 15),
  // West corridor
  new THREE.Vector3(-20, 0, -5),
  new THREE.Vector3(-20, 0,  5),
  // East corridor
  new THREE.Vector3( 20, 0, -5),
  new THREE.Vector3( 20, 0,  5),
  // Inner building
  new THREE.Vector3(-7, 0, -4),
  new THREE.Vector3( 7, 0, -4),
  new THREE.Vector3(-7, 0,  4),
  new THREE.Vector3( 7, 0,  4),
  // Corner storage rooms
  new THREE.Vector3(-25, 0, -17),
  new THREE.Vector3( 25, 0, -17),
  new THREE.Vector3(-25, 0,  17),
  new THREE.Vector3( 25, 0,  17),
];

export function getWaypoints() {
  return _waypoints;
}
