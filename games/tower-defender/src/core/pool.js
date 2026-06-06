// core/pool.js — [N3] 通用对象池，降 GC 抖动（弹道/飘字/敌人复用）。
// 用法: const p = makePool(()=>({}), (o,x,y)=>{o.x=x;o.y=y;return o});
//       const obj = p.acquire(1,2);  ...  p.release(obj);

export function makePool(factory, reset) {
  const free = [];
  return {
    acquire(...args) {
      const o = free.length ? free.pop() : factory();
      return reset ? reset(o, ...args) : o;
    },
    release(o) { free.push(o); },
    get size() { return free.length; },
  };
}
