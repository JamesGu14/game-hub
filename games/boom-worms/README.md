# 炮炮虫 BOOM WORMS

Kid-friendly turn-based artillery game in the style of Worms (百战天虫). Two teams of round little worms take turns lobbing weapons at each other across destructible terrain. Knock all enemy worms into the water to win. Features a 6-level single-player campaign vs AI plus a 2-player hotseat mode. Designed for ages 7+.

## How to Run

From the repo root, start any static server:

```bash
./start.sh
# or
python3 -m http.server 8080
```

Open `http://localhost:8080` (the hub) and click the **炮炮虫 BOOM WORMS** card. Or navigate directly to `http://localhost:8080/games/boom-worms/index.html`.

Use `?level=N` (0-based) to jump straight to a level for testing:

```
http://localhost:8080/games/boom-worms/index.html?level=4
```

## Controls

| Action | Keyboard | Gamepad (PS-style) |
|---|---|---|
| Move | Arrow Left / Right | Left stick / D-pad L/R |
| Jump | Z | Cross (btn 0) |
| Aim | Mouse move (point-and-shoot) or Arrow Up / Down | Right stick / D-pad U/D |
| Charge & Fire | Hold Space or Left Mouse Button, release to fire | Hold Square (btn 2) or R2, release |
| Next / Prev weapon | E / Q | R1 / L1 |
| Pause | Esc | Options (btn 9) |
| Mute | M | — |

Aim mode switches automatically: move the mouse to aim by cursor; use keyboard/gamepad to switch to angle-step mode. Both modes can be mixed mid-turn.

## Module Map

| File | Role | Tested? |
|---|---|---|
| `src/config.js` | Pure constants (physics, weapons, worm stats, levels) | imported by tests |
| `src/util/math.js` | clamp, lerp, dist, angleOf, toRad, toDeg, vecFromAngle | node:test |
| `src/util/trajectory.js` | stepBallistic, simulate | node:test |
| `src/combat.js` | explosionDamage, applyExplosion, drowned | node:test |
| `src/terrain.js` | Destructible terrain mask + offscreen canvas carve/draw | mask: node:test |
| `src/worm.js` | makeWorm, makeTeam factories | node:test |
| `src/physics.js` | stepWorm: gravity, mask collision, drowning | node:test |
| `src/turns.js` | nextActive, aliveTeams, checkOutcome | node:test |
| `src/ai.js` | solveAim, jitterAim + AIController | solver: node:test |
| `src/levels.js` | LEVELS data + buildLevel | node:test |
| `src/weapons.js` | fire() dispatch: projectile/hitscan/melee/airstrike | manual |
| `src/projectile.js` | Live projectile integration, bounce, fuse, explode | manual |
| `src/aim.js` | Aim angle + charge state, device-adaptive | manual |
| `src/input.js` | Keyboard / mouse(pointer) / gamepad unified input | manual |
| `src/game.js` | Game state machine, level flow, win/lose, localStorage | manual |
| `src/render.js` | Renderer: terrain/worms/projectiles/effects/HUD | manual |
| `src/audio.js` | Sound singleton, WebAudio SFX | manual |
| `src/main.js` | Bootstrap, RAF loop, overlay sync, button wiring | manual |

## Run Tests

```bash
cd games/boom-worms && node --test
```

Expected: 23 tests, all green. Tests cover pure logic only (math, trajectory, combat, terrain mask, physics, turns, AI solver, levels). Canvas/DOM/audio layers are verified manually.

## Design Spec

`docs/superpowers/specs/2026-06-03-boom-worms-design.md`
