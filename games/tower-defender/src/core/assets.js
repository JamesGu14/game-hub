// core/assets.js — 资源索引。M1 占位（无外部图，渲染用色块），M6 换真 sprite。
// preload() 立即完成，便于装配流程统一（未来加载 PNG 时改这里）。

export const assets = { ready: false, images: {} };

export async function preload() {
  // M1: 无外部资源；直接就绪。
  assets.ready = true;
  return assets;
}
