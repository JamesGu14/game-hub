// tests/audio.test.mjs — [P6] 程序音效：注入假 AudioContext，验懒初始化一次 / muted 静默 / 无 AC 不崩 / BGM 起停。
// 运行：node games/tower-defender/tests/audio.test.mjs
import assert from 'node:assert';
import * as audio from '../src/core/audio.js';

// 假 AudioContext：计数 ctor / oscillator / gain；节点 connect 返回下游（支持链式）。
function makeFakeAC() {
  const counts = { ctor: 0, osc: 0, gain: 0 };
  function AC() {
    counts.ctor++;
    this.currentTime = 0; this.state = 'running'; this.destination = {};
    this.resume = () => {};
    this.createGain = () => { counts.gain++; return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(n) { return n; } }; };
    this.createOscillator = () => { counts.osc++; return { type: '', frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(n) { return n; }, start() {}, stop() {} }; };
  }
  return { AC, counts };
}

// 1) 懒初始化一次 + sfx 发声（创建 oscillator）
{
  audio._reset();
  const { AC, counts } = makeFakeAC();
  audio._setAudioContextFactory(AC);
  assert.equal(counts.ctor, 0, '未播放前不建 ctx');
  audio.sfx('kill');
  assert.equal(counts.ctor, 1, '首次 sfx 懒建 ctx');
  assert.ok(counts.osc >= 1, 'sfx 创建 oscillator');
  audio.sfx('build');
  assert.equal(counts.ctor, 1, 'ctx 仅建一次（懒初始化一次）');
}

// 2) muted → 静默：不建 osc、不建 ctx
{
  audio._reset();
  const { AC, counts } = makeFakeAC();
  audio._setAudioContextFactory(AC);
  audio.setMuted(true);
  assert.equal(audio.isMuted(), true, 'isMuted 反映状态');
  audio.sfx('kill');
  assert.equal(counts.osc, 0, 'muted 不发声（无 oscillator）');
  assert.equal(counts.ctor, 0, 'muted 早退，不建 ctx');
}

// 3) setMuted(false) 恢复发声
{
  audio._reset();
  const { AC, counts } = makeFakeAC();
  audio._setAudioContextFactory(AC);
  audio.setMuted(false);
  audio.sfx('build');
  assert.ok(counts.osc >= 1, '取消静音后发声');
}

// 4) 无 AudioContext 可用（factory=null，node 无 window）→ 静默不抛
{
  audio._reset();
  audio._setAudioContextFactory(null);
  assert.doesNotThrow(() => audio.sfx('kill'), '无 AC 时 sfx 不抛');
  assert.equal(audio.init(), null, 'init 无 AC 返回 null 不抛');
}

// 5) 未知音效名不抛
{
  audio._reset();
  const { AC } = makeFakeAC();
  audio._setAudioContextFactory(AC);
  assert.doesNotThrow(() => audio.sfx('does-not-exist'), '未知名不抛');
}

// 6) BGM 起停幂等不抛
{
  audio._reset();
  const { AC } = makeFakeAC();
  audio._setAudioContextFactory(AC);
  assert.doesNotThrow(() => audio.startBgm(), 'startBgm 不抛');
  assert.doesNotThrow(() => audio.startBgm(), 'startBgm 幂等');
  assert.doesNotThrow(() => audio.stopBgm(), 'stopBgm 不抛');
}

audio._reset();   // 清理：停 BGM 计时器，避免进程挂起
console.log('ok audio');
