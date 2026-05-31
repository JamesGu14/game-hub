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
  _padPrev: {},

  /** @param {HTMLCanvasElement} canvas @param {(clientX:number) => number} mapClientXToField */
  init(canvas, mapClientXToField) {
    const held = new Set();
    const recompute = () => {
      this._keyDir = (held.has('R') ? 1 : 0) - (held.has('L') ? 1 : 0);
      this.moveX = clamp(this._keyDir, -1, 1);
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
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) held.delete('L');
      if (['ArrowRight', 'd', 'D'].includes(e.key)) held.delete('R');
      recompute();
    });
  },

  on(fn) {
    this._subs.push(fn);
  },

  _emit(action) {
    this._subs.forEach((fn) => fn(action));
  },

  // Read gamepad each frame; combines with keyboard direction.
  poll() {
    let padDir = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (pad) {
      const x = pad.axes[0] || 0;
      const dl = pad.buttons[14] && pad.buttons[14].pressed;
      const dr = pad.buttons[15] && pad.buttons[15].pressed;
      if (Math.abs(x) > 0.25) padDir = x;
      if (dl) padDir = -1;
      if (dr) padDir = 1;

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
    this.moveX = clamp(this._keyDir + padDir, -1, 1);
  },
};
