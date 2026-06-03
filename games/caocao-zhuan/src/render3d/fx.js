// render3d/fx.js — 战场特效（行走 / 受击闪 / 飘字）
//
// 契约（plan §1.8）：
//   moveAlong(group, worldPath, onDone)   // 沿 [{x,y,z}...] 逐段行走，带踏步上下颠
//   hitFlash(group)                       // 短暂受击高光
//   floatText(ctx, worldPos, text, color) // 上浮的伤害/治疗数字（DOM 投影）
//
// moveAlong / hitFlash 纯三维动画（requestAnimationFrame 驱动，自结束）。
// floatText 走 DOM 覆盖层：把世界坐标用相机投影到屏幕，飘起一个数字后移除。

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

export default { moveAlong, hitFlash, floatText };
