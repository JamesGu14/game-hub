import * as THREE from 'three';

const POLYHAVEN_BASE = 'https://cdn.polyhaven.com/asset_files/textures';

function makeFallbackWall()  { return new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, metalness: 0.05 }); }
function makeFallbackFloor() { return new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.95, metalness: 0.0 }); }

function tryLoadTexture(loader, url, onLoad, onError) { loader.load(url, onLoad, undefined, onError); }

function buildPBRMaterial(loader, baseColorUrl, normalUrl, roughUrl, isFallbackFn, repeat = 4) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.05 });
  let failed = false;
  function checkFail() {
    if (!failed) {
      failed = true;
      const fb = isFallbackFn();
      mat.color.copy(fb.color);
      mat.roughness = fb.roughness;
      mat.metalness = fb.metalness;
      mat.map = null; mat.normalMap = null; mat.roughnessMap = null;
      mat.needsUpdate = true;
    }
  }
  tryLoadTexture(loader, baseColorUrl,
    (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat); mat.map = tex; mat.needsUpdate = true; },
    checkFail);
  tryLoadTexture(loader, normalUrl,
    (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat); mat.normalMap = tex; mat.needsUpdate = true; },
    checkFail);
  tryLoadTexture(loader, roughUrl,
    (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat); mat.roughnessMap = tex; mat.needsUpdate = true; },
    checkFail);
  return mat;
}

// Reusable unit geometry for all box-shaped objects
const _unitBoxGeo = new THREE.BoxGeometry(1, 1, 1);

// ===========================================================================
// 回-SHAPE WAREHOUSE MAP
// World extents: X ∈ [-30, 30], Z ∈ [-22, 22]
// Wall height: 4.0
// Floor y=0, ceiling y=4
// ===========================================================================
export function buildMap(scene) {
  const loader = new THREE.TextureLoader();
  const meshes = [];
  const boundingBoxes = [];

  const wallMat = makeFallbackWall();

  const floorMat = makeFallbackFloor();

  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.95 });

  function addWall(w, h, d, px, py, pz, mat = wallMat) {
    const mesh = new THREE.Mesh(_unitBoxGeo, mat);
    mesh.scale.set(w, h, d);
    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
    boundingBoxes.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  }

  function _registerObstacle(mesh) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    meshes.push(mesh);
    boundingBoxes.push(new THREE.Box3().setFromObject(mesh));
  }

  const OX = 30, OZ = 22, WT = 0.4, WH = 4.0, WY = WH / 2;

  // Floor
  {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(OX * 2, OZ * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0);
    floor.receiveShadow = true;
    scene.add(floor); meshes.push(floor);
  }
  // Ceiling
  {
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(OX * 2, OZ * 2), ceilingMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.set(0, WH, 0);
    scene.add(ceil); meshes.push(ceil);
  }

  // Outer perimeter
  addWall(OX * 2, WH, WT, 0, WY, -OZ);
  addWall(OX * 2, WH, WT, 0, WY,  OZ);
  addWall(WT, WH, OZ * 2, -OX, WY, 0);
  addWall(WT, WH, OZ * 2,  OX, WY, 0);

  // Inner building: X ∈ [-12,12], Z ∈ [-8,8], 4 doorways (3 wide each)
  const IZ = 8;
  // Inner N (z=-8), doorway x∈[-1.5,1.5]
  addWall(10.5, WH, WT, -6.75, WY, -IZ);
  addWall(10.5, WH, WT,  6.75, WY, -IZ);
  // Inner S (z=+8)
  addWall(10.5, WH, WT, -6.75, WY,  IZ);
  addWall(10.5, WH, WT,  6.75, WY,  IZ);
  // Inner W (x=-12), doorway z∈[-1.5,1.5]
  addWall(WT, WH, 6.5, -12, WY, -4.75);
  addWall(WT, WH, 6.5, -12, WY,  4.75);
  // Inner E (x=+12)
  addWall(WT, WH, 6.5,  12, WY, -4.75);
  addWall(WT, WH, 6.5,  12, WY,  4.75);

  // Interior divider — partial wall along z=0 with central gap
  addWall(9, WH * 0.85, WT, -7.5, WY * 0.85, 0);
  addWall(9, WH * 0.85, WT,  7.5, WY * 0.85, 0);

  // ── Corner storage rooms (4) ──
  function makeCornerRoom(cx, cz, doorSide) {
    const RW = 6, RD = 5, wh = RW / 2, dh = RD / 2;
    function fullH(edge) { addWall(RW, WH, WT, cx, WY, cz + edge * dh); }
    function fullV(edge) { addWall(WT, WH, RD, cx + edge * wh, WY, cz); }
    function splitH(edge) {
      const seg = (RW - 2) / 2;
      addWall(seg, WH, WT, cx - (seg / 2 + 1), WY, cz + edge * dh);
      addWall(seg, WH, WT, cx + (seg / 2 + 1), WY, cz + edge * dh);
    }
    function splitV(edge) {
      const seg = (RD - 2) / 2;
      addWall(WT, WH, seg, cx + edge * wh, WY, cz - (seg / 2 + 1));
      addWall(WT, WH, seg, cx + edge * wh, WY, cz + (seg / 2 + 1));
    }
    if (doorSide === 'inner-S') { fullH(-1); splitH(1);  fullV(-1); fullV(1); }
    else if (doorSide === 'inner-N') { splitH(-1); fullH(1); fullV(-1); fullV(1); }
    else if (doorSide === 'inner-E') { fullH(-1); fullH(1); fullV(-1); splitV(1); }
    else if (doorSide === 'inner-W') { fullH(-1); fullH(1); splitV(-1); fullV(1); }
  }
  makeCornerRoom(-25, -17, 'inner-S');
  makeCornerRoom( 25, -17, 'inner-S');
  makeCornerRoom(-25,  17, 'inner-N');
  makeCornerRoom( 25,  17, 'inner-N');

  // ── Materials for obstacles ──
  const crateMat    = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.85 });
  const crateDark   = new THREE.MeshStandardMaterial({ color: 0x3a2818, roughness: 0.85 });
  const barrelMat   = new THREE.MeshStandardMaterial({ color: 0x9a3a28, roughness: 0.55, metalness: 0.45 });
  const barrelTop   = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.6 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.95 });
  const pillarMat   = new THREE.MeshStandardMaterial({ color: 0xa8a8a8, roughness: 0.92 });
  const sandbagMat  = new THREE.MeshStandardMaterial({ color: 0x7a6a4a, roughness: 0.95 });
  const metalMat    = new THREE.MeshStandardMaterial({ color: 0x4a5060, roughness: 0.5, metalness: 0.8 });

  function addCrate(x, y, z, mat = crateMat, size = 1.4) {
    const m = new THREE.Mesh(_unitBoxGeo, mat);
    m.scale.set(size, size, size);
    m.position.set(x, y, z);
    m.rotation.y = (Math.random() - 0.5) * 0.4;
    _registerObstacle(m);
  }
  function addBarrel(x, z) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 1.1, 16), barrelMat);
    body.position.set(x, 0.55, z);
    _registerObstacle(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.40, 0.40, 0.06, 16), barrelTop);
    cap.position.set(x, 1.13, z);
    cap.castShadow = true; scene.add(cap); meshes.push(cap);
  }
  function addBarrier(x, z, rotY = 0) {
    const m = new THREE.Mesh(_unitBoxGeo, concreteMat);
    m.scale.set(2.5, 1.0, 0.5);
    m.position.set(x, 0.5, z);
    m.rotation.y = rotY;
    _registerObstacle(m);
  }
  function addPillar(x, z, size = 0.8) {
    const m = new THREE.Mesh(_unitBoxGeo, pillarMat);
    m.scale.set(size, WH, size);
    m.position.set(x, WY, z);
    _registerObstacle(m);
  }
  function addSandbagStack(x, z, rotY = 0) {
    for (let row = 0; row < 3; row++) {
      for (let i = -1; i <= 1; i++) {
        const sb = new THREE.Mesh(_unitBoxGeo, sandbagMat);
        sb.scale.set(0.45, 0.22, 0.30);
        const ox = (row % 2 === 0) ? 0 : 0.22;
        sb.position.set(x + i * 0.46 + ox, 0.11 + row * 0.22, z);
        sb.rotation.y = rotY;
        sb.castShadow = true; sb.receiveShadow = true;
        scene.add(sb); meshes.push(sb);
        boundingBoxes.push(new THREE.Box3().setFromObject(sb));
      }
    }
  }
  function addMetalContainer(x, z, rotY = 0) {
    const c = new THREE.Mesh(_unitBoxGeo, metalMat);
    c.scale.set(4.5, 2.4, 2.2);
    c.position.set(x, 1.2, z);
    c.rotation.y = rotY;
    _registerObstacle(c);
  }

  // Inner building obstacles
  addPillar(-3, -3.5); addPillar( 3, -3.5);
  addPillar(-3,  3.5); addPillar( 3,  3.5);
  addCrate(-9, 0.7, -5.5); addCrate( 9, 0.7, -5.5);
  addCrate(-9, 0.7,  5.5); addCrate( 9, 0.7,  5.5);
  addCrate(-9, 2.1, -5.5, crateDark);
  addCrate( 9, 2.1,  5.5, crateDark);
  addBarrel(-2, 1.2); addBarrel( 2, -1.2);
  addBarrier(0, -6, 0);
  addBarrier(0,  6, 0);

  // North corridor obstacles
  addMetalContainer(-15, -14, 0);
  addMetalContainer( 15, -14, 0);
  addSandbagStack(-3, -10, 0);
  addSandbagStack( 3, -10, Math.PI);
  addBarrel(-8, -18); addBarrel(-7, -18); addBarrel(-7.5, -18.7);
  addBarrel( 8, -18); addBarrel( 7, -18); addBarrel( 7.5, -18.7);
  addCrate(-20, 0.7, -11); addCrate(-20, 2.1, -11, crateDark);
  addCrate( 20, 0.7, -11); addCrate( 20, 2.1, -11, crateDark);
  addBarrier(-10, -16,  Math.PI / 4);
  addBarrier( 10, -16, -Math.PI / 4);

  // South corridor obstacles
  addMetalContainer(-15, 14, 0);
  addMetalContainer( 15, 14, 0);
  addSandbagStack(-3, 10, Math.PI);
  addSandbagStack( 3, 10, 0);
  addBarrel(-8, 18); addBarrel(-7, 18); addBarrel(-7.5, 18.7);
  addBarrel( 8, 18); addBarrel( 7, 18); addBarrel( 7.5, 18.7);
  addCrate(-20, 0.7, 11); addCrate(-20, 2.1, 11, crateDark);
  addCrate( 20, 0.7, 11); addCrate( 20, 2.1, 11, crateDark);
  addBarrier(-10, 16, -Math.PI / 4);
  addBarrier( 10, 16,  Math.PI / 4);

  // West corridor obstacles
  addPillar(-18, -4); addPillar(-18, 4);
  addCrate(-25, 0.7, 0);
  addCrate(-25, 2.1, 0, crateDark);
  addBarrel(-20, 2); addBarrel(-20, -2);
  addBarrier(-15, 0, Math.PI / 2);

  // East corridor obstacles
  addPillar( 18, -4); addPillar( 18, 4);
  addCrate( 25, 0.7, 0);
  addCrate( 25, 2.1, 0, crateDark);
  addBarrel( 20, 2); addBarrel( 20, -2);
  addBarrier( 15, 0, Math.PI / 2);

  // Spawn points: CT west end, T east end
  const spawnPoints = {
    ct: [
      new THREE.Vector3(-27, 0, -3),
      new THREE.Vector3(-27, 0,  0),
      new THREE.Vector3(-27, 0,  3),
      new THREE.Vector3(-23, 0, -5),
      new THREE.Vector3(-23, 0,  5),
    ],
    t: [
      new THREE.Vector3( 27, 0, -3),
      new THREE.Vector3( 27, 0,  0),
      new THREE.Vector3( 27, 0,  3),
      new THREE.Vector3( 23, 0, -5),
      new THREE.Vector3( 23, 0,  5),
    ],
  };

  return { meshes, boundingBoxes, spawnPoints };
}
