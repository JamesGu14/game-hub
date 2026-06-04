// render3d/fx.js — 战场特效（行走 / 受击闪 / 飘字 / 计略特效）
//
// 契约（plan §1.8 / P2 UI）：
//   moveAlong(group, worldPath, onDone)   // 沿 [{x,y,z}...] 逐段行走，带踏步上下颠
//   hitFlash(group)                       // 短暂受击高光
//   floatText(ctx, worldPos, text, color) // 上浮的伤害/治疗数字（DOM 投影）
//   setFxScene(scene)                     // 注册放置三维特效的 scene（castFx 用）
//   castFx(kind, element, worldPos, aoeWorldCells) // 计略特效（火/雷/水/疗/增益/毒/乱/暗）
//
// moveAlong / hitFlash / castFx 纯三维动画（requestAnimationFrame 驱动，自结束）。
// floatText 走 DOM 覆盖层：把世界坐标用相机投影到屏幕，飘起一个数字后移除。
// castFx 需要先 setFxScene(scene)：把临时粒子/光环挂到该 scene，动画结束自动移除并释放。

import * as THREE from 'three';

const STEP_SPEED = 4.2; // 每秒走过的世界单位（tile≈1）
const BOB_AMP = 0.06; // 踏步颠簸幅度
const BOB_FREQ = 12; // 踏步频率

/**
 * 让 group 沿世界路径行走。
 * @param {THREE.Object3D} group
 * @param {Array<{x:number,y:number,z:number}>} worldPath  含起点或不含均可（自动从当前位置起）
 * @param {Function} [onDone]
 */
export function moveAlong(group, worldPath, onDone) {
  const pts = (worldPath || []).map((p) => new THREE.Vector3(p.x, p.y, p.z));
  if (!group || pts.length === 0) {
    if (onDone) onDone();
    return;
  }

  // 段列表：从当前位置依次走向每个路点。
  const segs = [];
  let from = group.position.clone();
  for (const p of pts) {
    const len = from.distanceTo(p);
    if (len > 1e-4) segs.push({ from: from.clone(), to: p.clone(), len });
    from = p;
  }
  if (segs.length === 0) {
    // 终点即当前点。
    if (pts.length) group.position.copy(pts[pts.length - 1]);
    if (onDone) onDone();
    return;
  }

  const baseY = group.position.y; // 颠簸围绕基准 y（路点 y 提供地形高度差）
  let segIdx = 0;
  let traveled = 0; // 当前段内已走距离
  let phase = 0; // 踏步相位
  let last = performance.now();

  function face(seg) {
    const dx = seg.to.x - seg.from.x;
    const dz = seg.to.z - seg.from.z;
    if (Math.abs(dx) > 1e-5 || Math.abs(dz) > 1e-5) {
      group.rotation.y = Math.atan2(dx, dz);
    }
  }
  face(segs[0]);

  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    phase += dt * BOB_FREQ;

    let dist = STEP_SPEED * dt;
    while (dist > 0 && segIdx < segs.length) {
      const seg = segs[segIdx];
      const remain = seg.len - traveled;
      if (dist >= remain) {
        dist -= remain;
        traveled = 0;
        segIdx++;
        if (segIdx < segs.length) face(segs[segIdx]);
      } else {
        traveled += dist;
        dist = 0;
      }
    }

    if (segIdx >= segs.length) {
      const end = segs[segs.length - 1].to;
      group.position.set(end.x, end.y, end.z);
      if (onDone) onDone();
      return;
    }

    const seg = segs[segIdx];
    const t = seg.len > 0 ? traveled / seg.len : 1;
    const x = seg.from.x + (seg.to.x - seg.from.x) * t;
    const z = seg.from.z + (seg.to.z - seg.from.z) * t;
    const lerpY = seg.from.y + (seg.to.y - seg.from.y) * t;
    const bob = Math.abs(Math.sin(phase)) * BOB_AMP;
    group.position.set(x, lerpY + bob, z);
    requestAnimationFrame(tick);
  }

  void baseY; // 基准 y 由路点提供，保留语义说明
  requestAnimationFrame(tick);
}

// 收集 group 内所有带 emissive 的标准材质，做闪光后恢复。
function collectMaterials(group) {
  const out = [];
  group.traverse((o) => {
    if (o.material && o.material.emissive) {
      const m = o.material;
      out.push({ m, color: m.emissive.getHex(), inten: m.emissiveIntensity });
    }
  });
  return out;
}

/**
 * 受击高光（约 0.32s 红闪后恢复）。
 * @param {THREE.Object3D} group
 * @param {number} [color=0xff4030]
 */
export function hitFlash(group, color = 0xff4030) {
  if (!group) return;
  const saved = collectMaterials(group);
  for (const s of saved) {
    s.m.emissive.setHex(color);
    s.m.emissiveIntensity = 0.9;
  }
  const dur = 320;
  const start = performance.now();
  function tick(now) {
    const k = Math.min(1, (now - start) / dur);
    for (const s of saved) {
      s.m.emissiveIntensity = 0.9 * (1 - k) + s.inten * k;
    }
    if (k < 1) {
      requestAnimationFrame(tick);
    } else {
      for (const s of saved) {
        s.m.emissive.setHex(s.color);
        s.m.emissiveIntensity = s.inten;
      }
    }
  }
  requestAnimationFrame(tick);
}

/**
 * 上浮飘字（DOM 覆盖层投影）。
 * @param {{camera:THREE.Camera, renderer?:THREE.WebGLRenderer, overlay?:HTMLElement}} ctx
 *        camera 必须；overlay 为承载 DOM 的容器（默认 document.body）；
 *        renderer 仅用于取画布尺寸（缺省取 window）。
 * @param {{x:number,y:number,z:number}|THREE.Vector3} worldPos
 * @param {string} text
 * @param {string} [color='#ffd95e']
 */
export function floatText(ctx, worldPos, text, color = '#ffd95e') {
  if (typeof document === 'undefined') return;
  const camera = ctx && ctx.camera;
  const overlay = (ctx && ctx.overlay) || document.body;
  if (!camera) return;

  // 画布尺寸（用于把 NDC 映射到像素）。
  let w = window.innerWidth;
  let h = window.innerHeight;
  if (ctx && ctx.renderer && ctx.renderer.domElement) {
    const r = ctx.renderer.domElement.getBoundingClientRect();
    w = r.width;
    h = r.height;
  }

  const v = worldPos instanceof THREE.Vector3
    ? worldPos.clone()
    : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
  v.project(camera);
  const sx = (v.x * 0.5 + 0.5) * w;
  const sy = (-v.y * 0.5 + 0.5) * h;

  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = [
    'position:absolute',
    `left:${sx}px`,
    `top:${sy}px`,
    'transform:translate(-50%,-50%)',
    `color:${color}`,
    'font:700 22px "Songti SC","STSong",serif',
    'text-shadow:0 2px 6px #000,0 0 10px rgba(0,0,0,.6)',
    'pointer-events:none',
    'z-index:9',
    'transition:transform .9s ease-out,opacity .9s ease-out',
    'opacity:1',
    'will-change:transform,opacity',
  ].join(';');
  overlay.appendChild(el);

  // 触发上浮 + 淡出。
  requestAnimationFrame(() => {
    el.style.transform = 'translate(-50%,-160%)';
    el.style.opacity = '0';
  });
  setTimeout(() => {
    if (el.parentNode) el.parentNode.removeChild(el);
  }, 1000);
}

// ---------------------------------------------------------------------------
// 计略特效（castFx）：程序化粒子 / 光环，无外部贴图，自结束并释放。
// ---------------------------------------------------------------------------

// 放置三维特效的 scene（由 main.js 在建场后 setFxScene 注册）。
let fxScene = null;

/** 注册放置三维计略特效的 scene。 */
export function setFxScene(scene) {
  fxScene = scene;
}

// 把一个临时三维对象加进 scene，duration 毫秒后移除并释放几何/材质。
// onTick(k) 每帧回调（k=0→1 进度），返回 false 可提前结束（罕用）。
function ephemeral(obj, duration, onTick) {
  if (!fxScene || !obj) {
    disposeObj(obj);
    return;
  }
  fxScene.add(obj);
  const start = performance.now();
  function tick(now) {
    const k = Math.min(1, (now - start) / duration);
    let keep = true;
    if (onTick) keep = onTick(k) !== false;
    if (k < 1 && keep) {
      requestAnimationFrame(tick);
    } else {
      fxScene.remove(obj);
      disposeObj(obj);
    }
  }
  requestAnimationFrame(tick);
}

// 递归释放几何/材质。
function disposeObj(obj) {
  if (!obj) return;
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m.dispose && m.dispose();
    }
  });
}

// 把 {x,y,z} / Vector3 归一为 Vector3。
function vec3(p) {
  if (!p) return new THREE.Vector3();
  return p instanceof THREE.Vector3 ? p.clone() : new THREE.Vector3(p.x, p.y, p.z);
}

// 一群粒子（小方块）从中心爆开/上升。color hex；count 数量；spread 半径；rise 上升幅度。
function burst(center, { color, count = 14, spread = 0.5, rise = 0.9, size = 0.1, duration = 520, gravity = 0 } = {}) {
  const c = vec3(center);
  const group = new THREE.Group();
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false }),
    );
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * spread;
    seeds.push({
      mesh: m,
      vx: Math.cos(ang) * rad,
      vz: Math.sin(ang) * rad,
      vy: rise * (0.5 + Math.random() * 0.8),
      spin: (Math.random() - 0.5) * 6,
    });
    m.position.copy(c);
    group.add(m);
  }
  ephemeral(group, duration, (k) => {
    for (const s of seeds) {
      s.mesh.position.set(
        c.x + s.vx * k,
        c.y + s.vy * k - gravity * k * k,
        c.z + s.vz * k,
      );
      s.mesh.rotation.x += s.spin * 0.05;
      s.mesh.rotation.y += s.spin * 0.05;
      s.mesh.material.opacity = 1 - k;
    }
  });
}

// 地面光环（扩散的圆环），标示 AOE 范围。color hex；radius 最终半径。
function ring(center, { color, radius = 1.0, duration = 480, opacity = 0.7 } = {}) {
  const c = vec3(center);
  const geo = new THREE.RingGeometry(radius * 0.2, radius * 0.32, 28);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(c.x, c.y + 0.05, c.z);
  ephemeral(mesh, duration, (k) => {
    const s = 0.4 + k * 2.4;
    mesh.scale.set(s, s, s);
    mat.opacity = opacity * (1 - k);
  });
}

// 在每个 AOE 格上落一个半透明面片标记（短暂），强化范围感。
function aoeTint(cells, color, duration = 460) {
  for (const cell of cells || []) {
    const c = vec3(cell);
    const geo = new THREE.PlaneGeometry(0.85, 0.85);
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.4, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(c.x, c.y + 0.04, c.z);
    ephemeral(m, duration, (k) => {
      mat.opacity = 0.42 * (1 - k);
    });
  }
}

// 竖直光柱（落雷 / 妖术）。color hex；从高空打到中心。
function bolt(center, { color, duration = 360, height = 4.2, width = 0.16 } = {}) {
  const c = vec3(center);
  const geo = new THREE.CylinderGeometry(width, width * 1.6, height, 6, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(c.x, c.y + height / 2, c.z);
  ephemeral(mesh, duration, (k) => {
    mat.opacity = 0.95 * (1 - k);
    mesh.scale.x = mesh.scale.z = 1 + k * 0.4;
  });
}

// 上升的旋涡（混乱）：几个绕中心螺旋上升的粒子。
function swirl(center, { color, duration = 620, count = 10, radius = 0.45 } = {}) {
  const c = vec3(center);
  const group = new THREE.Group();
  const seeds = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 0.09),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false }),
    );
    seeds.push({ mesh: m, phase: (i / count) * Math.PI * 2, rise: 0.7 + Math.random() * 0.5 });
    group.add(m);
  }
  ephemeral(group, duration, (k) => {
    for (const s of seeds) {
      const ang = s.phase + k * Math.PI * 4;
      const rad = radius * (1 - k * 0.4);
      s.mesh.position.set(c.x + Math.cos(ang) * rad, c.y + s.rise * k + 0.2, c.z + Math.sin(ang) * rad);
      s.mesh.material.opacity = 1 - k;
    }
  });
}

// 按元素/类别取主色。
const ELEMENT_COLOR = {
  fire: 0xff7a2a,
  thunder: 0xfff04a,
  water: 0x49b6ff,
  dark: 0x9a4fd0,
};
const KIND_COLOR = {
  heal: 0x6fe39a,
  buff: 0xf2d35a,
  debuff: 0xb07ad0,
  control: 0xc56bff,
  poison: 0x8fd14f,
};

/**
 * 计略特效：按 kind/element 在中心 worldPos + AOE 世界格上播放程序化特效。
 *   fire    火爆（橙红粒子上扬）+ 地面火环 + AOE 染色
 *   thunder 竖直雷柱 + 中心电火花
 *   water   蓝色水花 AOE（每格水柱）+ 扩散水环
 *   dark    紫色暗能爆 + 下沉粒子
 *   heal    绿色治疗光环上浮
 *   buff    金色增益火花
 *   debuff  紫晕（弱体/降攻）
 *   control immobilize=蓝定身环 / confuse=紫色旋涡
 *   poison  绿色毒云（缓慢上浮粒子）
 * 需先 setFxScene(scene)。无 scene 时静默跳过（不报错）。
 *
 * @param {string} kind     'damage'|'heal'|'buff'|'debuff'|'control'（或细分 'poison'）
 * @param {string|null} element 'fire'|'thunder'|'water'|'dark'|null
 * @param {{x,y,z}|THREE.Vector3} worldPos 施法中心（AOE 心，单位顶面附近）
 * @param {Array<{x,y,z}>} aoeWorldCells AOE 覆盖格的世界坐标（地面高度）
 */
export function castFx(kind, element, worldPos, aoeWorldCells = []) {
  if (!fxScene) return;
  const center = vec3(worldPos);
  const cells = (aoeWorldCells || []).map(vec3);
  const isAoe = cells.length > 1;

  // 元素优先决定伤害系特效；非伤害系按 kind 走。
  if (kind === 'damage') {
    if (element === 'fire') {
      aoeTint(cells, 0xff7a2a);
      ring(center, { color: 0xffae3a, radius: isAoe ? 1.6 : 1.0 });
      for (const cell of cells) burst(cell, { color: 0xff7a2a, count: 12, spread: 0.4, rise: 1.0, gravity: 0.2, size: 0.12 });
      return;
    }
    if (element === 'thunder') {
      bolt(center, { color: 0xfff04a });
      burst(center, { color: 0xfff9b0, count: 16, spread: 0.5, rise: 0.4, gravity: 0.6, size: 0.08, duration: 380 });
      return;
    }
    if (element === 'water') {
      aoeTint(cells, 0x49b6ff);
      ring(center, { color: 0x9fe0ff, radius: isAoe ? 2.0 : 1.0 });
      for (const cell of cells) bolt(cell, { color: 0x49b6ff, height: 1.4, width: 0.18, duration: 420 });
      return;
    }
    if (element === 'dark') {
      aoeTint(cells, 0x9a4fd0);
      for (const cell of cells) burst(cell, { color: 0x9a4fd0, count: 12, spread: 0.45, rise: 0.5, gravity: -0.6, size: 0.11, duration: 560 });
      ring(center, { color: 0xb87aff, radius: isAoe ? 1.6 : 1.0 });
      return;
    }
    // 无元素的伤害（毒雾直伤）：当作毒云处理。
    aoeTint(cells, KIND_COLOR.poison);
    for (const cell of cells) burst(cell, { color: KIND_COLOR.poison, count: 10, spread: 0.4, rise: 0.7, gravity: -0.3, size: 0.1, duration: 640 });
    return;
  }

  if (kind === 'heal') {
    for (const cell of cells) {
      ring(cell, { color: KIND_COLOR.heal, radius: 0.9, opacity: 0.8 });
      burst(cell, { color: 0xbfffd6, count: 10, spread: 0.3, rise: 1.0, size: 0.09, duration: 560 });
    }
    return;
  }

  if (kind === 'buff') {
    for (const cell of cells) {
      ring(cell, { color: KIND_COLOR.buff, radius: 0.9, opacity: 0.85 });
      burst(cell, { color: 0xffe98a, count: 12, spread: 0.28, rise: 1.1, size: 0.085, duration: 600 });
    }
    return;
  }

  if (kind === 'debuff') {
    aoeTint(cells, KIND_COLOR.debuff);
    for (const cell of cells) burst(cell, { color: KIND_COLOR.debuff, count: 9, spread: 0.4, rise: 0.3, gravity: 0.5, size: 0.1, duration: 560 });
    return;
  }

  if (kind === 'control') {
    // poison-like or immobilize/confuse — 按 element/center 区分由调用方传 kind 已足够；
    // 这里再细分：confuse=旋涡（紫），immobilize=蓝定身环。用 element 字段无意义时统一旋涡。
    for (const cell of cells) {
      swirl(cell, { color: KIND_COLOR.control });
      ring(cell, { color: 0x7a9cff, radius: 0.9, opacity: 0.7 });
    }
    return;
  }

  // 兜底：中心一束金色火花。
  burst(center, { color: 0xf2d35a, count: 10, spread: 0.4, rise: 0.9 });
}

export default { moveAlong, hitFlash, floatText, setFxScene, castFx };
