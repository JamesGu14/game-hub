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

// 7) startBgm(trackIndex)：文件未就绪（假 AC 无 decodeAudioData）→ 程序兜底，不抛 + 幂等
{
  audio._reset();
  const { AC } = makeFakeAC();
  audio._setAudioContextFactory(AC);
  assert.doesNotThrow(() => audio.startBgm(2), 'startBgm(idx) 不抛');
  assert.doesNotThrow(() => audio.startBgm(2), 'startBgm(idx) 幂等');
  assert.doesNotThrow(() => audio.stopBgm(), 'stopBgm 不抛');
}

// 8) bgmTrackForLevel：轮播映射 (关号-1)%5；章内两轮 A→E、每章首关→A、终关 L50→E
{
  assert.equal(audio.bgmTrackForLevel(1), 0, 'L1→A');
  assert.equal(audio.bgmTrackForLevel(2), 1, 'L2→B');
  assert.equal(audio.bgmTrackForLevel(3), 2, 'L3→C');
  assert.equal(audio.bgmTrackForLevel(4), 3, 'L4→D');
  assert.equal(audio.bgmTrackForLevel(5), 4, 'L5→E');
  assert.equal(audio.bgmTrackForLevel(6), 0, 'L6→A（与 L1 同）');
  assert.equal(audio.bgmTrackForLevel(7), 1, 'L7→B（与 L2 同）');
  assert.equal(audio.bgmTrackForLevel(8), 2, 'L8→C');
  for (const opener of [1, 11, 21, 31, 41]) assert.equal(audio.bgmTrackForLevel(opener), 0, `章首 L${opener}→A`);
  assert.equal(audio.bgmTrackForLevel(50), 4, '终关 L50→E');
}

// —— [演绎段2] 剧情语音:playVoice/stopVoice/preloadVoice(stub Audio 工厂,零 DOM)——
{
  audio._reset();
  const made = [];
  function FakeAudio(src) {
    const a = { src, preload: '', paused: false, playCalls: 0, pauseCalls: 0,
      play() { this.playCalls++; return Promise.resolve(); },
      pause() { this.pauseCalls++; this.paused = true; } };
    made.push(a); return a;
  }
  audio._setAudioFactory(FakeAudio);

  audio.setMuted(false);
  audio.playVoice('assets/voice/aaa.mp3');
  assert.equal(made.length, 1, 'playVoice 建实例');
  assert.equal(audio.currentVoiceSrc(), 'assets/voice/aaa.mp3', 'currentVoiceSrc');
  assert.equal(made[0].playCalls, 1, '已 play');

  audio.playVoice('assets/voice/bbb.mp3');                  // 切句:停旧播新
  assert.equal(made[0].pauseCalls, 1, '旧句已停');
  assert.equal(audio.currentVoiceSrc(), 'assets/voice/bbb.mp3');

  audio.stopVoice();
  assert.equal(made[1].pauseCalls, 1, 'stopVoice 停当前');
  assert.equal(audio.currentVoiceSrc(), null, '停后无 src');
  audio.stopVoice();                                         // 幂等不抛

  audio.setMuted(true);
  audio.playVoice('assets/voice/ccc.mp3');                   // muted:不建不播,流程语义由调用方保证
  assert.equal(made.length, 2, 'muted 不建实例');
  assert.equal(audio.currentVoiceSrc(), null, 'muted 无 src');
  audio.setMuted(false);

  audio.preloadVoice('assets/voice/ddd.mp3');                // 预热:建实例置 preload,不播
  assert.equal(made.length, 3);
  assert.equal(made[2].preload, 'auto', 'preload=auto');
  assert.equal(made[2].playCalls, 0, '预热不播');
  audio.preloadVoice(null);                                  // null 容错
  assert.equal(made.length, 3);

  // play() 拒绝(autoplay 策略/缺文件)静默:不抛、src 保留(冒烟断言用)
  audio._setAudioFactory((src) => ({ src, preload: '', play() { return Promise.reject(new Error('autoplay')); }, pause() {} }));
  audio.playVoice('assets/voice/eee.mp3');
  assert.equal(audio.currentVoiceSrc(), 'assets/voice/eee.mp3', '拒绝后 src 仍可查');
}

audio._reset();   // 清理：停 BGM 计时器，避免进程挂起
console.log('ok audio');
