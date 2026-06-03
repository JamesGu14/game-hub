// 端到端无头比赛模拟：用真实纯模块跑完整 3 圈，验证圈数推进 / 完赛 / 名次 / 解锁。
// 复刻 main.js update() 的核心（省略道具/碰撞/渲染/音频），确保「圈数 blocker」已修复。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trackById } from '../src/track.js';
import { carById } from '../src/cars.js';
import { stepPlayer } from '../src/player.js';
import { stepAI } from '../src/ai.js';
import { progress, updateLap, place } from '../src/race.js';
import { RACE, RENDER } from '../src/config.js';
import { wrap } from '../src/util/math.js';
import { applyResult, defaultSave } from '../src/save.js';

function runRace(carId, trackId) {
  const track = trackById(trackId);
  const len = track.length;
  const car = carById(carId);
  let player = { id: 'player', z: 900, x: 0, speed: 0, spinTimer: 0, lap: 0, _prevZ: 900, car };
  let ai = ['blaze', 'gust', 'star'].filter(id => id !== carId).slice(0, 3).map((id, i) => {
    const z = (2 - i) * 300;
    return { id: 'ai' + i, z, x: (i - 1) * 0.4, speed: 0, spinTimer: 0, lap: 0, _prevZ: z, car: carById(id) };
  });

  const dt = 1 / 60;
  let simT = 0;
  // 玩家全油门、不打方向（靠辅助转向过弯），跑到完赛或超时 120s
  while (player.lap < RACE.laps && simT < 120) {
    const pseg = wrap(Math.floor(player.z / RENDER.segLen), track.segs.length);
    const curve = track.segs[pseg].curve;
    const onRoad = Math.abs(player.x) < 1.1;
    player = Object.assign({}, player, stepPlayer(player,
      { throttle: true, steer: 0, drifting: false, nitro: 0 },
      { car: player.car, curve, onRoad, assist: true }, dt));
    player = updateLap(player, len);

    const playerProg = progress(player, len);
    ai = ai.map(a => {
      const aseg = wrap(Math.floor(a.z / RENDER.segLen), track.segs.length);
      const acurve = track.segs[aseg].curve;
      let na = Object.assign({}, a, stepAI(a, { car: a.car, curve: acurve, onRoad: true,
        playerProgress: playerProg, aiProgress: progress(a, len) }, dt));
      return updateLap(na, len);
    });
    simT += dt;
  }
  return { player, ai, simT, len };
}

test('a full 3-lap race actually finishes (lap counting works end-to-end)', () => {
  const { player, simT } = runRace('lightning', 'track1');
  assert.equal(player.lap >= RACE.laps, true, `player completed ${RACE.laps} laps (got ${player.lap}) in ${simT.toFixed(1)}s`);
  assert.ok(simT < 120, 'finished within the time budget (did not stall forever)');
});

test('final placement is a valid 1..racers position', () => {
  const { player, ai, len } = runRace('lightning', 'track1');
  const p = place([player, ...ai], len, 'player');
  assert.ok(p >= 1 && p <= RACE.racers, `place ${p} within 1..${RACE.racers}`);
});

test('finishing track1 in the top 3 unlocks the blaze car', () => {
  const { player, ai, len } = runRace('lightning', 'track1');
  const p = place([player, ...ai], len, 'player');
  if (p <= 3) {
    const save = applyResult(defaultSave(), 'track1', p, 42000);
    assert.ok(save.unlocked.includes('blaze'), 'blaze unlocked after a top-3 finish');
  }
});

test('every track can be completed by a full-throttle player (no soft-lock)', () => {
  for (const t of ['track1', 'track2', 'track3', 'track4']) {
    const { player, simT } = runRace('lightning', t);
    assert.equal(player.lap >= RACE.laps, true, `${t} finished (lap ${player.lap}) in ${simT.toFixed(1)}s`);
  }
});
