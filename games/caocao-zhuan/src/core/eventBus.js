// core/eventBus.js — 极简发布/订阅事件总线（无依赖，不触碰 DOM/Three.js）
//
// 契约（plan §1.8）：
//   export const bus = { on(evt,fn), off(evt,fn), emit(evt,payload) }
//
// 跨模块约定的事件名（payload 形状由各发起方在实现期约定，这里仅登记名称）：
//   'unit:selected'   选中单位        payload: { unit }
//   'unit:moved'      单位移动完成    payload: { unit, from:{c,r}, to:{c,r}, path }
//   'unit:attacked'   发生一次攻击    payload: { attacker, defender, result }
//   'unit:died'       单位阵亡        payload: { unit }
//   'turn:changed'    相位/回合切换   payload: { phase, turn }
//   'battle:win'      战斗胜利        payload: { battleState }
//   'battle:lose'     战斗失败        payload: { battleState }
//   'scenario:done'   一段剧本播放完  payload: { scenarioId }
//   'camera:cinematic'运镜请求        payload: { focus, zoom }

function makeBus() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  function on(evt, fn) {
    if (typeof fn !== 'function') return;
    let set = listeners.get(evt);
    if (!set) {
      set = new Set();
      listeners.set(evt, set);
    }
    set.add(fn);
  }

  function off(evt, fn) {
    const set = listeners.get(evt);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) listeners.delete(evt);
  }

  function emit(evt, payload) {
    const set = listeners.get(evt);
    if (!set || set.size === 0) return;
    // 拷贝一份，避免回调内 on/off 修改集合导致迭代异常
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        // 单个监听器异常不影响其他监听器
        console.error(`[eventBus] listener for "${evt}" threw:`, err);
      }
    }
  }

  return { on, off, emit };
}

export const bus = makeBus();

// 同时导出工厂，便于测试/多战场实例隔离（非契约要求，附加便利）
export { makeBus };
