// core/pool.js — [N3] 通用对象池，降 GC 抖动（弹道/飘字/敌人复用）。
// 用法: const p = makePool(()=>({}), (o,x,y)=>{o.x=x;o.y=y;return o});
//       const obj = p.acquire(1,2);  ...  p.release(obj);

export function makePool(factory, reset) {
  const free = [];
  const freeSet = new Set();   // [H10] 在池成员表：防 double-release（同引用入池两次 → 两次 acquire 拿到同一对象 → 状态污染）
  return {
    acquire(...args) {
      const o = free.length ? free.pop() : factory();
      freeSet.delete(o);       // 取出即离池（factory 新建对象不在表中，delete 无副作用）
      return reset ? reset(o, ...args) : o;
    },
    release(o) {
      if (!o || freeSet.has(o)) return;   // [H10] 空值/已在池 → no-op（幂等释放，绝不重复入池）
      freeSet.add(o);
      free.push(o);
    },
    get size() { return free.length; },
  };
}
