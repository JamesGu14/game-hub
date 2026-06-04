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
    this._clearCars();
    if (this._boxGroup) { this.scene.remove(this._boxGroup); this._boxGroup = null; this._boxMeshes = null; }
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
    const grassCol = new THREE.Color(track.theme.grass[0]);
    const hw = RENDER.roadW, rumbleW = hw * 1.12, grassW = hw * 9;
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
      const G = ring(i, grassW), H = ring(j, grassW);
      const rc = (Math.floor(i / RENDER.rumble) % 2 === 0) ? rumbleA : rumbleB;
      // 与路面同高的草坪裙边：避免上坡时路面悬浮在远处平地之上
      quad(G.l, H.l, B.l, A.l, grassCol); // 左草坪（grassW→rumbleW）
      quad(A.r, B.r, H.r, G.r, grassCol); // 右草坪
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

  // 路边景物：按 theme.deco 在中线两侧用 InstancedMesh 摆低多边树/灯/仙人掌/雪松。
  _buildDeco(track) {
    if (this.deco) {
      this.scene.remove(this.deco);
      this.deco.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
    const group = new THREE.Group();
    const pts = this.cl, n = pts.length;
    const STEP = 7, lateral = 1.45; // 每 7 段一组、放在路沿外侧
    const placements = [];
    for (let i = 0; i < n - 1; i += STEP) {
      const z = i * RENDER.segLen;
      placements.push(worldAt(pts, z, -lateral).pos, worldAt(pts, z, lateral).pos);
    }
    const parts = decoParts(track.theme);
    const m = new THREE.Matrix4(), sv = new THREE.Vector3();
    for (const part of parts) {
      const inst = new THREE.InstancedMesh(part.geometry, part.material, placements.length);
      let k = 0;
      for (const p of placements) {
        // 用索引派生的伪随机缩放/转角（可复现、避免 Math.random）
        const s = 0.8 + ((k * 37) % 50) / 100;
        m.makeRotationY((k * 1.3) % (Math.PI * 2));
        m.scale(sv.set(s, s, s));
        m.setPosition(p.x, p.y + part.oy * s, p.z);
        inst.setMatrixAt(k++, m);
      }
      inst.instanceMatrix.needsUpdate = true;
      group.add(inst);
    }
    this.deco = group;
    this.scene.add(group);
  }

  // 道具箱：旋转发光方块，放在 track.itemBoxes 段位置；被拾取(taken)后隐藏。
  updateBoxes(track, taken) {
    if (!this._boxGroup) {
      this._boxGroup = new THREE.Group(); this.scene.add(this._boxGroup); this._boxMeshes = new Map();
    }
    for (const segIdx of track.itemBoxes) {
      let mesh = this._boxMeshes.get(segIdx);
      if (!mesh) {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(700, 700, 700),
          new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0x6b5500 }));
        const w = worldAt(this.cl, segIdx * RENDER.segLen, 0);
        mesh.position.set(w.pos.x, w.pos.y + 520, w.pos.z);
        this._boxGroup.add(mesh); this._boxMeshes.set(segIdx, mesh);
      }
      mesh.visible = !taken.has(segIdx);
      mesh.rotation.y += 0.05; mesh.rotation.x += 0.02;
    }
  }

  _clearCars() {
    for (const g of this.cars.values()) this.scene.remove(g);
    this.cars.clear();
  }

  _makeCar(color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(900, 350, 1600),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }));
    body.position.y = 350; g.add(body);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(620, 250, 680),
      new THREE.MeshLambertMaterial({ color: 0xdfeefb }));
    cabin.position.set(0, 545, -70); g.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(220, 220, 200, 12); wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat); w.position.set(sx * 480, 220, sz * 560); g.add(w);
    }
    // 车底 blob 阴影：贴地半透明深色圆，提升地面落点可读性（spec §5）
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(1000, 20),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 8; g.add(shadow);
    return g;
  }

  // racers: [{id, z, x, color, steerAngle, spinTimer}]，第一个是玩家
  updateCars(racers) {
    for (const r of racers) {
      let g = this.cars.get(r.id);
      if (!g) { g = this._makeCar(r.color); this.scene.add(g); this.cars.set(r.id, g); }
      const w = worldAt(this.cl, r.z, r.x);
      g.position.set(w.pos.x, w.pos.y, w.pos.z);
      // 车头对齐赛道切向(+heading) + 可见转向(+steer) + 被击打转
      const spin = r.spinTimer > 0 ? (performance.now() * 0.012) : 0;
      g.rotation.y = w.heading + (r.steerAngle || 0) * 0.5 + spin;
    }
  }

  // 追尾相机：相机在车后上方、朝赛道切向看（前方弯道居中、纵深感、孩子不晕）。
  follow(player, len, dt) {
    const w = worldAt(this.cl, player.z, player.x);
    const h = w.heading;
    const fwd = new THREE.Vector3(Math.sin(h), 0, Math.cos(h));
    const back = fwd.clone().multiplyScalar(-3000);
    const target = new THREE.Vector3(w.pos.x, w.pos.y, w.pos.z).add(back);
    target.y += 1500;
    // 接缝护栏：过终点线时 worldAt 取模回绕，目标会瞬移整张图。
    // 一帧正常位移≈speed*dt≲300；位移>6000 必是回绕，直接切镜（不 lerp），避免剧烈扫动。
    if (this.camPos.lengthSq() === 0 || this.camPos.distanceTo(target) > 6000) {
      this.camPos.copy(target);
    } else {
      this.camPos.lerp(target, Math.min(1, 6 * dt));
    }
    this.camera.position.copy(this.camPos);
    // 注视前方一点，但高度锚定在“车身”而非远处路面，避免上/下坡时把自车甩出画面底部。
    const ahead = worldAt(this.cl, player.z + 1600, player.x * 0.5);
    this.camera.lookAt(ahead.pos.x, w.pos.y + 650, ahead.pos.z);
  }

  // 玩家车特效：氮气尾焰（亮蓝锥）、漂移烟（车尾灰球）。挂在车组下随车移动/旋转。
  updateEffects(state, dt) {
    const car = this.cars.get('player');
    if (!car) return;
    if (!car.userData.fx) car.userData.fx = this._makeCarFx(car);
    const fx = car.userData.fx;
    const t = performance.now() * 0.02;
    const nitro = state.nitroTimer > 0;
    fx.flame.visible = nitro;
    if (nitro) fx.flame.scale.set(1, 1 + 0.25 * Math.sin(t * 2), 1);
    const drifting = state.drift.active;
    for (const s of fx.smoke) {
      s.visible = drifting;
      if (drifting) s.scale.setScalar(0.7 + 0.4 * Math.abs(Math.sin(t + s.userData.ph)));
    }
  }

  _makeCarFx(car) {
    const flameGeo = new THREE.ConeGeometry(190, 1000, 8); flameGeo.rotateX(-Math.PI / 2);
    const flame = new THREE.Mesh(flameGeo, new THREE.MeshBasicMaterial({ color: 0x33e1ff, transparent: true, opacity: 0.82 }));
    flame.position.set(0, 330, -1350); flame.visible = false; car.add(flame); // 车尾后方(local -z)
    const smoke = [];
    for (const sx of [-380, 380]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(260, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.5 }));
      s.position.set(sx, 200, -820); s.visible = false; s.userData.ph = sx > 0 ? 1.7 : 0;
      car.add(s); smoke.push(s);
    }
    return { flame, smoke };
  }

  render() { this.renderer.render(this.scene, this.camera); }
}

// 按主题返回 1~2 个低多边景物部件 {geometry, material, oy(中心离地高)}。
function decoParts(theme) {
  const lam = (c, emissive) => new THREE.MeshLambertMaterial({ color: c, emissive: emissive || 0x000000 });
  switch (theme.deco) {
    case 'neon': // 夜城：暗杆 + 发光球
      return [
        { geometry: new THREE.CylinderGeometry(40, 40, 1400, 6), material: lam(0x1b2233), oy: 700 },
        { geometry: new THREE.SphereGeometry(260, 10, 8), material: new THREE.MeshBasicMaterial({ color: new THREE.Color(theme.rumble[0]) }), oy: 1500 },
      ];
    case 'cactus': // 沙漠：绿柱 + 花苞
      return [
        { geometry: new THREE.CylinderGeometry(160, 200, 1300, 7), material: lam(0x3f7d3a), oy: 650 },
        { geometry: new THREE.SphereGeometry(150, 8, 6), material: lam(0xff6b81), oy: 1350 },
      ];
    case 'pine': // 雪地：棕干 + 雪松冠
      return [
        { geometry: new THREE.CylinderGeometry(70, 90, 360, 6), material: lam(0x6b4a2b), oy: 180 },
        { geometry: new THREE.ConeGeometry(560, 1500, 7), material: lam(0xdfeaf7), oy: 1000 },
      ];
    case 'tree':
    default: // 草原：棕干 + 绿冠
      return [
        { geometry: new THREE.CylinderGeometry(70, 90, 420, 6), material: lam(0x6b4a2b), oy: 210 },
        { geometry: new THREE.ConeGeometry(560, 1200, 7), material: lam(0x2e8b3d), oy: 1000 },
      ];
  }
}
