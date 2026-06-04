// games/turbo-drift/src/render3d.js
// three.js 真 3D 渲染层（浏览器）。消费 sim 输出 {z,x,steerAngle,spinTimer,...}，
// 用 geometry.worldAt 换算到世界坐标。无单测（WebGL），靠 agent-browser 冒烟。
import * as THREE from 'three';
import { RENDER } from './config.js';
import { buildCenterline, worldAt } from './geometry.js';

export class Renderer3D {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 1, 300000);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445566, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(0.5, 1, 0.3).multiplyScalar(10000);
    this.scene.add(sun);
    this.cl = null; this.trackMesh = null; this.ground = null;
    this.cars = new Map(); this.deco = null;
    this.camPos = new THREE.Vector3();
    this._lastZ = null;
    this.resize();
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth || window.innerWidth;
    const h = c.clientHeight || window.innerHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  // 切赛道：重建中线、天空/雾、地面、赛道带、景物
  setTrack(track) {
    this.cl = buildCenterline(track);
    this._lastZ = null; this.camPos.set(0, 0, 0);
    this._buildSky(track.theme);
    this._buildGround(track.theme);
    this._buildRoad(track);
    this._buildDeco(track);
  }

  _buildSky(theme) {
    const top = new THREE.Color(theme.sky[0]), bot = new THREE.Color(theme.sky[1]);
    const horizon = bot.clone().lerp(top, 0.5);
    this.scene.background = horizon;
    // 主题雾：增强纵深、柔化并隐藏远端开放路径的端点。夜间赛道雾更近一点。
    const near = theme.night ? 14000 : 22000;
    const far = theme.night ? 70000 : 95000;
    this.scene.fog = new THREE.Fog(horizon.getHex(), near, far);
  }

  _buildGround(theme) {
    if (this.ground) this.scene.remove(this.ground);
    const geo = new THREE.PlaneGeometry(600000, 600000);
    geo.rotateX(-Math.PI / 2); // XY 平面 → 水平 XZ 平面，法向朝上 +y
    this.ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: new THREE.Color(theme.grass[1]) }));
    this.ground.position.y = -2;
    this.scene.add(this.ground);
  }

  _buildRoad(track) {
    if (this.trackMesh) { this.scene.remove(this.trackMesh); this.trackMesh.geometry.dispose(); }
    const pts = this.cl, n = pts.length;
    const positions = [], colors = [];
    const roadCol = new THREE.Color(track.theme.road[0]);
    const rumbleA = new THREE.Color(track.theme.rumble[0]);
    const rumbleB = new THREE.Color(track.theme.rumble[1]);
    const hw = RENDER.roadW, rumbleW = hw * 1.12;
    function ring(i, width) {
      const p = pts[i]; const h = p.heading;
      const rx = Math.cos(h), rz = -Math.sin(h); // 朝向的右法向
      return { l: [p.x - rx * width, p.y, p.z - rz * width], r: [p.x + rx * width, p.y, p.z + rz * width] };
    }
    function quad(a, b, c, d, col) {
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
      for (let k = 0; k < 6; k++) colors.push(col.r, col.g, col.b);
    }
    // 注意：跳过 wrap 段 (i=n-1 → 0)，避免把整张图横跨的退化四边形（终点线接缝）。
    for (let i = 0; i < n - 1; i++) {
      const j = i + 1;
      const A = ring(i, rumbleW), B = ring(j, rumbleW);
      const a = ring(i, hw), b = ring(j, hw);
      const rc = (Math.floor(i / RENDER.rumble) % 2 === 0) ? rumbleA : rumbleB;
      quad(A.l, B.l, b.l, a.l, rc);   // 左路肩（红/白交替）
      quad(a.r, b.r, B.r, A.r, rc);   // 右路肩
      quad(a.l, b.l, b.r, a.r, roadCol); // 路面
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    this.trackMesh = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    this.scene.add(this.trackMesh);
  }

  _buildDeco(track) { /* Task 6 填充：InstancedMesh 路边景物 */ }

  render() { this.renderer.render(this.scene, this.camera); }
}
