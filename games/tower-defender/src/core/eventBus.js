// core/eventBus.js — 延迟事件总线。copy-and-own 自 caocao-zhuan，emit 改为「入队」、新增 flush()。
// [N1/P0-2] 事件纯通知、延迟派发：emit() 只入队，gameLoop 每步末 flush() 统一派发，
//           杜绝「遍历实体表时监听器又改实体/再 emit」的重入与迭代器失效；派发顺序确定（利测）。
// 契约: bus.on(evt,fn) / off(evt,fn) / emit(evt,payload) / flush()

export function makeBus() {
  const listeners = new Map();
  const queue = [];

  function on(evt, fn) {
    if (typeof fn !== 'function') return () => {};  // 非法 fn：返回 no-op，调用方仍可安全 off()
    let set = listeners.get(evt);
    if (!set) { set = new Set(); listeners.set(evt, set); }
    set.add(fn);
    return () => off(evt, fn);                      // 退订函数
  }
  function off(evt, fn) {
    const set = listeners.get(evt);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) listeners.delete(evt);
  }
  function emit(evt, payload) {
    queue.push([evt, payload]);   // 仅入队，不同步派发
  }
  function flush() {
    // while：监听器内 emit 的新事件在同一 flush 内被处理（顺序确定）
    while (queue.length) {
      const [evt, payload] = queue.shift();
      const set = listeners.get(evt);
      if (!set || set.size === 0) continue;
      for (const fn of [...set]) {
        try { fn(payload); }
        catch (err) { console.error(`[eventBus] listener for "${evt}" threw:`, err); }
      }
    }
  }
  function clear() { listeners.clear(); queue.length = 0; }

  return { on, off, emit, flush, clear };
}

export const bus = makeBus();
