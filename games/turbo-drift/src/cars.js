// games/turbo-drift/src/cars.js
export const CARS = [
  { id: 'lightning', name: '闪电', color: '#3aa0ff', top: 1.00, accel: 1.00, grip: 1.00, unlock: null },
  { id: 'blaze',     name: '烈焰', color: '#ff3b30', top: 1.15, accel: 1.00, grip: 0.85, unlock: 'track1' },
  { id: 'gust',      name: '疾风', color: '#3cd070', top: 1.00, accel: 1.20, grip: 1.15, unlock: 'track2' },
  { id: 'star',      name: '星耀', color: '#b388ff', top: 1.15, accel: 1.20, grip: 1.00, unlock: 'track3' },
];

export const carById = id => CARS.find(c => c.id === id);

export const isUnlocked = (car, save) => car.unlock === null || (save.unlocked || []).includes(car.id);

// 完成某赛道时解锁的车（赛道3解锁星耀；赛道4为终极挑战不再发车）
export const TRACK_UNLOCKS = { track1: 'blaze', track2: 'gust', track3: 'star' };

// place 为名次（1 最好）。前 3 名解锁该赛道对应车。
export function unlockFor(trackId, place) {
  if (place <= 3 && TRACK_UNLOCKS[trackId]) return TRACK_UNLOCKS[trackId];
  return null;
}
