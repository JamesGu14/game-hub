// tests/assets.test.mjs — [P6] 预加载：注入 mock loader，验全成功/部分失败/全失败/reject 均不阻塞、不抛。
// 运行：node games/tower-defender/tests/assets.test.mjs
import assert from 'node:assert';
import { preload, assets, MANIFEST, generalSprite } from '../src/core/assets.js';

const fakeImg = (src) => ({ src, width: 100, height: 130 });

// 1) 全成功 → ready=true，所有 id 入库且 src 对应路径
{
  const loaded = await preload((src) => Promise.resolve(fakeImg(src)));
  assert.strictEqual(loaded, assets, 'preload 返回 assets 单例');
  assert.equal(assets.ready, true, 'ready=true');
  for (const id of Object.keys(MANIFEST)) {
    assert.ok(assets.images[id], `应加载 ${id}`);
    assert.equal(assets.images[id].src, MANIFEST[id], `${id} src=manifest 路径`);
  }
}

// 2) 部分失败（onerror→null）→ 命中者在库、缺者 undefined、不抛、ready=true
{
  await preload((src) => Promise.resolve(src.includes('huang') ? fakeImg(src) : null));
  assert.equal(assets.ready, true);
  assert.ok(assets.images.gen_huang, 'huang 在库');
  assert.equal(assets.images.gen_zhang, undefined, '缺图 → undefined');
  assert.equal(assets.images.boss_mulu, undefined, '缺图 → undefined');
}

// 3) 全失败 → images 空、ready=true、不抛（管线先行：无 assets/ 也可玩）
{
  await preload(() => Promise.resolve(null));
  assert.equal(assets.ready, true);
  assert.equal(Object.keys(assets.images).length, 0, '全缺 → images 空');
}

// 4) loader reject 也不致命（allSettled 兜底）
{
  await assert.doesNotReject(preload(() => Promise.reject(new Error('boom'))), 'reject 不应使 preload 抛');
  assert.equal(assets.ready, true);
  assert.equal(Object.keys(assets.images).length, 0, 'reject → 无图');
}

// 5) [形象演进 spec §6.1+L4/L5] 12 将 × 5 阶全部注册,路径规范
{
  const IDS = ['huang', 'zhang', 'guan', 'zhao', 'ma', 'zhuge', 'liao', 'zhou', 'madai', 'guanping', 'zhangbao', 'yueying'];
  for (const id of IDS) for (const s of [1, 2, 3, 4, 5]) {
    assert.equal(MANIFEST[`gen_${id}_${s}`], `assets/sprites/generals/${id}_${s}.png`, `gen_${id}_${s} 注册`);
  }
}

// 6) onProgress 回调：进度递增到 100，且阶段标签存在
{
  const stages = [];
  const progress = [];
  await preload(
    (src) => Promise.resolve(fakeImg(src)),
    MANIFEST,
    ({ loaded, total, stage, percent, failed }) => {
      progress.push({ loaded, total, percent, failed });
      if (!stages.includes(stage)) stages.push(stage);
    }
  );
  assert.equal(progress.length, Object.keys(MANIFEST).length, '每张图完成都触发回调');
  assert.equal(progress.at(-1).percent, 100, '最终 percent=100');
  assert.equal(progress.at(-1).failed, 0, '全成功时 failed=0');
  assert.ok(stages.length >= 1, '至少有一个阶段标签');
}

// 7) generalSprite 封顶 5 + 逐级回退（注入假图，不依赖真加载）
{
  const saved = assets.images;
  assets.images = {};
  assets.images['gen_huang_3'] = { _tag: 'L3' };
  assert.equal(generalSprite('huang', 5)._tag, 'L3', '封顶仍能落到已有的 L3（L5/L4 缺）');
  assets.images['gen_huang_5'] = { _tag: 'L5' };
  assert.equal(generalSprite('huang', 5)._tag, 'L5', 'L5 在 → 取 L5（证明封顶已升到 5）');
  assets.images['gen_huang_4'] = { _tag: 'L4' };
  assert.equal(generalSprite('huang', 4)._tag, 'L4', 'L4 在 → 取 L4');
  assert.equal(generalSprite('huang', 5)._tag, 'L5', 'L5 仍优先');
  delete assets.images['gen_huang_4'];
  assert.equal(generalSprite('huang', 4)._tag, 'L3', 'L4 缺 → 向下回退 L3');
  assets.images = saved;
}

console.log('ok assets');
