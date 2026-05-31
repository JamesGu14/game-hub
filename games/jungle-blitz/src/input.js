// Keyboard + gamepad input for 丛林尖兵 JUNGLE BLITZ.
// poll() must be called once per frame to read the gamepad.

import { clamp } from './util/math.js';

export const Input = {
  moveX: 0,       // -1..1 combined from keys + stick
  aimUp: false,   // placeholder for later task
  aimDown: false, // placeholder for later task
  fireHeld: false,// placeholder for later task

  _subs: [],
  _keyDir: 0,
  _keyAimUp: false,
  _keyAimDown: false,
  _keyFire: false,
  _padPrev: {},

  /** @param {HTMLCanvasElement} canvas @param {(clientX:number) => number} mapClientXToField */
  init(canvas, mapClientXToField) {
    const held = new Set();
    const recompute = () => {
      this._keyDir     = (held.has('R') ? 1 : 0) - (held.has('L') ? 1 : 0);
      this._keyAimUp   = held.has('UP');
      this._keyAimDown = held.has('DOWN');
      this._keyFire    = held.has('FIRE');
      this.moveX   = clamp(this._keyDir, -1, 1);
      this.aimUp   = this._keyAimUp;
      this.aimDown = this._keyAimDown;
      this.fireHeld= this._keyFire;
    };

    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          held.add('L');
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          held.add('R');
          e.preventDefault();
          break;
        case 'ArrowUp':
        case 'w':
        case 'W':
          held.add('UP');
          e.preventDefault();
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          held.add('DOWN');
          e.preventDefault();
          break;
        case 'j':
        case 'J':
        case 'x':
        case 'X':
          held.add('FIRE');
          break;
        case 'k':
        case 'K':
        case ' ':
        case 'z':
        case 'Z':
          if (!e.repeat) this._emit('jump');
          e.preventDefault();
          break;
        case 'Enter':
          if (!e.repeat) this._emit('confirm');
          break;
        case 'Escape':
        case 'p':
        case 'P':
          if (!e.repeat) this._emit('pause');
          break;
        case 'Backspace':
          if (!e.repeat) this._emit('back');
          break;
        case 'm':
        case 'M':
          if (!e.repeat) this._emit('mute');
          break;
      }
      recompute();
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowLeft',  'a', 'A'].includes(e.key)) held.delete('L');
      if (['ArrowRight', 'd', 'D'].includes(e.key)) held.delete('R');
      if (['ArrowUp',    'w', 'W'].includes(e.key)) held.delete('UP');
      if (['ArrowDown',  's', 'S'].includes(e.key)) held.delete('DOWN');
      if (['j', 'J', 'x', 'X'].includes(e.key))    held.delete('FIRE');
      recompute();
    });
  },

  on(fn) {
    this._subs.push(fn);
  },

  _emit(action) {
    this._subs.forEach((fn) => fn(action));
  },

  // Read gamepad each frame; combines with keyboard state.
  poll() {
    let padDir = 0;
    let padAimUp = false;
    let padAimDown = false;
    let padFire = false;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (pad) {
      const x = pad.axes[0] || 0;
      const y = pad.axes[1] || 0;
      const dl = pad.buttons[14] && pad.buttons[14].pressed;
      const dr = pad.buttons[15] && pad.buttons[15].pressed;
      if (Math.abs(x) > 0.25) padDir = x;
      if (dl) padDir = -1;
      if (dr) padDir = 1;

      // Dpad up (btn12) or left-stick up
      padAimUp   = (y < -0.45) || !!(pad.buttons[12] && pad.buttons[12].pressed);
      // Dpad down (btn13) or left-stick down
      padAimDown = (y >  0.45) || !!(pad.buttons[13] && pad.buttons[13].pressed);
      // Fire: button 2 (X/□) or button 5 (RB/R1)
      padFire    = !!(pad.buttons[2] && pad.buttons[2].pressed) ||
                   !!(pad.buttons[5] && pad.buttons[5].pressed);

      const edge = (i) => {
        const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
        const was = !!this._padPrev[i];
        this._padPrev[i] = now;
        return now && !was;
      };

      if (edge(0)) this._emit('jump');   // A / ✕
      if (edge(9)) this._emit('pause');  // Start
      if (edge(1)) this._emit('back');   // B / ○
    }

    this.moveX    = clamp(this._keyDir + padDir, -1, 1);
    this.aimUp    = this._keyAimUp   || padAimUp;
    this.aimDown  = this._keyAimDown || padAimDown;
    this.fireHeld = this._keyFire    || padFire;
  },
};
