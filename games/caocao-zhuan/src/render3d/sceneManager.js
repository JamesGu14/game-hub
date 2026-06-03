// render3d/sceneManager.js — 场景总管（渲染器/光照/战场装配/拾取/帧循环）
//
// 契约（plan §1.8）：
//   init(canvas)                         // 建 renderer/scene/lights/camera
//   buildBattle(map, units)              // 用 terrainFactory + unitFactory 装配战场
//   frame()                              // 单帧渲染（idle bob + 旗飘 + camera.update）
//   start() / stop()                     // 启停 requestAnimationFrame 循环
//   pick(clientX,clientY) -> {kind:'unit',id}|{kind:'tile',c,r}|null
//   unitGroup(id) / removeUnit(id)
//   highlight(cells,color) / clearHighlight()
//   dispose()
//
// 设计：sceneManager 只按状态作画与播动画，不做战斗逻辑。
// units 由调用方（main.js/battleController）提供运行态 Unit（含 id / pos:{c,r} /
// faction / appearance）。每个 unit.id -> 一个 THREE.Group，放在对应 tile 顶面。

import * as THREE from 'three';
import { buildGrid } from './terrainFactory.js';
import { makeGeneral } from './unitFactory.js';
import { makeCamera } from './camera.js';

export function createSceneManager() {
  let renderer = null;
  let scene = null;
  let cam = null; // makeCamera() 返回的封装
  let canvasEl = null;

  let grid = null; // buildGrid 结果
  let battleMap = null;
  const unitGroups = new Map(); // id -> THREE.Group

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let running = false;
  let rafId = 0;
  let lastT = performance.now();
  let clock = 0;

  function init(canvas) {
    canvasEl = canvas;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;

    scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x121826, 24, 48);

    // 光照：半球环境 + 主光(投影) + 冷调补光。
    scene.add(new THREE.HemisphereLight(0xbcd0ff, 0x4a3b2a, 0.65));
    const key = new THREE.DirectionalLight(0xffe7c0, 1.25);
    key.position.set(8, 15, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const sc = key.shadow.camera;
    sc.left = -14;
    sc.right = 14;
    sc.top = 14;
    sc.bottom = -14;
    sc.near = 1;
    sc.far = 50;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x6a8cff, 0.35);
    fill.position.set(-6, 8, -7);
    scene.add(fill);

    cam = makeCamera(aspect());
    cam.setIso();

    resize();
    window.addEventListener('resize', resize);
    return { renderer, scene, camera: cam.camera };
  }

  function aspect() {
    const w = (canvasEl && canvasEl.clientWidth) || window.innerWidth;
    const h = (canvasEl && canvasEl.clientHeight) || window.innerHeight;
    return w / Math.max(1, h);
  }

  function resize() {
    if (!renderer) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    if (cam) cam.setAspect(w / Math.max(1, h));
  }

  // 把一个运行态 unit 放到它的 tile 顶面。
  function placeUnit(unit) {
    const group = makeGeneral(unit.appearance || {}, unit.faction || 'wei');
    group.userData.unitId = unit.id;
    const { x, y, z } = grid.tileWorld(unit.pos.c, unit.pos.r);
    group.position.set(x, y, z);
    // 默认面向场地中心（我方朝北、敌方朝南的简单约定）。
    group.rotation.y = unit.faction === 'wei' ? 0 : Math.PI;
    scene.add(group);
    unitGroups.set(unit.id, group);
    return group;
  }

  /**
   * 装配战场。
   * @param {object} map  battle map（含 tiles）
   * @param {Array} units 运行态 Unit 数组（含 id/pos/faction/appearance）
   */
  function buildBattle(map, units) {
    // 清旧。
    if (grid) {
      scene.remove(grid.group);
      grid.clearHighlights();
    }
    for (const g of unitGroups.values()) scene.remove(g);
    unitGroups.clear();

    battleMap = map;
    grid = buildGrid(map);
    scene.add(grid.group);

    for (const u of units || []) placeUnit(u);

    // 视角对准战场中心。
    cam.setIso();
    return { grid, unitGroups };
  }

  function unitGroup(id) {
    return unitGroups.get(id) || null;
  }

  function removeUnit(id) {
    const g = unitGroups.get(id);
    if (g) {
      scene.remove(g);
      unitGroups.delete(id);
    }
  }

  // 拾取：先命中 unit，再命中 tile。
  function pick(clientX, clientY) {
    if (!renderer || !cam) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, cam.camera);

    const unitMeshes = [];
    for (const g of unitGroups.values()) unitMeshes.push(g);
    const unitHit = raycaster.intersectObjects(unitMeshes, true)[0];
    if (unitHit) {
      let o = unitHit.object;
      while (o && !o.userData.isUnit) o = o.parent;
      if (o && o.userData.unitId != null) {
        return { kind: 'unit', id: o.userData.unitId };
      }
    }

    if (grid) {
      const tileHit = raycaster.intersectObject(grid.group, true)[0];
      if (tileHit) {
        let o = tileHit.object;
        while (o && (!o.userData || o.userData.kind == null)) o = o.parent;
        if (o && o.userData.kind === 'tile') {
          return { kind: 'tile', c: o.userData.c, r: o.userData.r };
        }
        if (o && o.userData.kind === 'highlight') {
          return { kind: 'tile', c: o.userData.c, r: o.userData.r };
        }
      }
    }
    return null;
  }

  // 高亮透传。
  function highlight(cells, color) {
    if (grid) grid.highlightTiles(cells, color);
  }
  function clearHighlight() {
    if (grid) grid.clearHighlights();
  }

  // 单帧：idle 上下浮 + 旗飘 + 相机趋近 + 渲染。
  function frame() {
    if (!renderer || !scene || !cam) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    clock += dt;

    cam.update(dt);

    for (const g of unitGroups.values()) {
      // 行走中（fx.moveAlong 直接改 position）不叠加 idle 浮动，避免抖动。
      if (g.userData.bannerFlag) {
        g.userData.bannerFlag.rotation.y = Math.sin(clock * 2.5 + g.position.z) * 0.22;
      }
      if (!g.userData.moving) {
        const id = g.userData.unitId;
        const base = restingY(id);
        if (base != null) {
          g.position.y = base + Math.sin(clock * 2 + g.position.x) * 0.015;
        }
      }
    }

    renderer.render(scene, cam.camera);
  }

  // 单位静止时所站 tile 的顶面 y（按当前 group 的 x/z 反查不可靠，故用最近 placeUnit 记录）。
  function restingY(id) {
    const g = unitGroups.get(id);
    if (!g || !grid) return null;
    // 用 group 当前 x/z 找最近 tile 的 top。
    let best = null;
    let bestD = Infinity;
    const tm = grid.tileMeshes;
    for (let r = 0; r < tm.length; r++) {
      for (let c = 0; c < tm[r].length; c++) {
        const t = tm[r][c];
        const d = (t.x - g.position.x) ** 2 + (t.z - g.position.z) ** 2;
        if (d < bestD) {
          bestD = d;
          best = t.top;
        }
      }
    }
    return best;
  }

  function loop() {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    frame();
  }
  function start() {
    if (running) return;
    running = true;
    lastT = performance.now();
    rafId = requestAnimationFrame(loop);
  }
  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function dispose() {
    stop();
    window.removeEventListener('resize', resize);
    if (grid) {
      grid.clearHighlights();
      scene.remove(grid.group);
    }
    for (const g of unitGroups.values()) scene.remove(g);
    unitGroups.clear();
    if (scene) {
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (m.map) m.map.dispose();
            m.dispose();
          }
        }
      });
    }
    if (renderer) renderer.dispose();
    grid = null;
    battleMap = null;
  }

  return {
    init,
    buildBattle,
    frame,
    start,
    stop,
    pick,
    unitGroup,
    removeUnit,
    highlight,
    clearHighlight,
    dispose,
    // 暴露内部供 fx/camera 协作。
    get scene() { return scene; },
    get renderer() { return renderer; },
    get camera() { return cam ? cam.camera : null; },
    get cameraRig() { return cam; },
    get grid() { return grid; },
    get map() { return battleMap; },
  };
}

export default { createSceneManager };
