// tests/victory.test.mjs — 城防 0→lost；末波清空→won + 星级按剩余城防
// 运行：node games/tower-defender/tests/victory.test.mjs
import assert from 'node:assert';
import { victorySystem } from '../src/systems/victorySystem.js';

function base(o) { return { phase: 'combat', castleHp: 20, castleMaxHp: 20, enemies: [], allWavesEmitted: false, stars: 0, ...o }; }

// 城防 0 → lost
{ const s = base({ castleHp: 0 }); victorySystem(s); assert.equal(s.phase, 'lost'); }

// 末波清空 → won + 星
{ const s = base({ allWavesEmitted: true }); victorySystem(s); assert.equal(s.phase, 'won'); assert.equal(s.stars, 3, '满血 3★'); }
{ const s = base({ allWavesEmitted: true, castleHp: 10 }); victorySystem(s); assert.equal(s.stars, 2, '≥50% 2★'); }
{ const s = base({ allWavesEmitted: true, castleHp: 5 }); victorySystem(s); assert.equal(s.stars, 1, '<50% 1★'); }

// 还有敌 → 不算 won
{ const s = base({ allWavesEmitted: true, enemies: [{ alive: true }] }); victorySystem(s); assert.equal(s.phase, 'combat'); }

console.log('ok victory');
