// Unified input for 炮炮虫 BOOM WORMS.
// Keyboard + pointer (mouse/touch) + Gamepad API → semantic action events + aim signals.
// Mirrors the jungle-blitz Input singleton shape.
// poll() must be called once per RAF frame to handle gamepad state.

import { clamp } from './util/math.js';

export const Input = {
  // Continuous held-state (read each frame by game loop)
  moveX: 0,       // -1..1 walk direction
  aimDir: 0,      // -1 (aim up/ccw) | 0 | +1 (aim down/cw) — key/pad angle-nudge
  chargeHeld: false,

  _subs: [],
  _keyDir: 0,
  _keyAimDir: 0,
  _keyCharge: false,
  _padPrev: {},
  _mapToField: null,

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {(clientX: number, clientY: number) => {x: number, y: number}} mapClientToField
   */
  init(canvas, mapClientToField) {
    this._mapToField = mapClientToField;

    const held = new Set();

    const recompute = () => {
      this._keyDir    = (held.has('R') ? 1 : 0) - (held.has('L') ? 1 : 0);
      this._keyAimDir = (held.has('AIM_DOWN') ? 1 : 0) - (held.has('AIM_UP') ? 1 : 0);
      this._keyCharge = held.has('CHARGE');
      this.moveX      = clamp(this._keyDir, -1, 1);
      this.aimDir     = clamp(this._keyAimDir, -1, 1);
      this.chargeHeld = this._keyCharge;
    };

    // --- Keyboard ---
    window.addEventListener('keydown', (e) => {
      if (e.repeat) {
        // Prevent browser scroll for arrow keys even on repeat
        if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
          e.preventDefault();
        }
        recompute();
        return;
      }

      switch (e.key) {
        // Move
        case 'ArrowLeft':
          held.add('L'); e.preventDefault(); break;
        case 'ArrowRight':
          held.add('R'); e.preventDefault(); break;

        // Aim angle
        case 'ArrowUp':
          held.add('AIM_UP'); e.preventDefault(); break;
        case 'ArrowDown':
          held.add('AIM_DOWN'); e.preventDefault(); break;

        // Jump
        case 'z':
        case 'Z':
          this._emit({ type: 'jump' }); e.preventDefault(); break;

        // Charge (Space = charge)
        case ' ':
          held.add('CHARGE');
          this._emit({ type: 'chargeStart' });
          e.preventDefault();
          break;

        // Weapon cycle
        case 'q':
        case 'Q':
          this._emit({ type: 'weaponPrev' }); break;
        case 'e':
        case 'E':
          this._emit({ type: 'weaponNext' }); break;

        // Pause
        case 'Escape':
          this._emit({ type: 'pause' }); break;

        // Mute
        case 'm':
        case 'M':
          this._emit({ type: 'mute' }); break;
      }
      recompute();
    });

    window.addEventListener('keyup', (e) => {
      if (['ArrowLeft'].includes(e.key))  held.delete('L');
      if (['ArrowRight'].includes(e.key)) held.delete('R');
      if (['ArrowUp'].includes(e.key))    held.delete('AIM_UP');
      if (['ArrowDown'].includes(e.key))  held.delete('AIM_DOWN');
      if (e.key === ' ') {
        if (held.has('CHARGE')) {
          held.delete('CHARGE');
          this._emit({ type: 'chargeRelease' });
        }
      }
      recompute();
    });

    // --- Pointer (mouse/touch) ---
    canvas.addEventListener('pointermove', (e) => {
      if (this._mapToField) {
        const field = this._mapToField(e.clientX, e.clientY);
        this._emit({ type: 'mouseAim', x: field.x, y: field.y });
      }
    });

    canvas.addEventListener('pointerdown', (e) => {
      if (e.button === 0) {
        if (this._mapToField) {
          const field = this._mapToField(e.clientX, e.clientY);
          this._emit({ type: 'mouseAim', x: field.x, y: field.y });
        }
        this._emit({ type: 'mouseCharge', down: true });
        this._emit({ type: 'chargeStart' });
        canvas.setPointerCapture(e.pointerId);
      }
    });

    canvas.addEventListener('pointerup', (e) => {
      if (e.button === 0) {
        this._emit({ type: 'mouseCharge', down: false });
        this._emit({ type: 'chargeRelease' });
      }
    });

    canvas.addEventListener('pointercancel', (e) => {
      this._emit({ type: 'mouseCharge', down: false });
      this._emit({ type: 'chargeRelease' });
    });
  },

  on(fn) {
    this._subs.push(fn);
  },

  _emit(action) {
    this._subs.forEach((fn) => fn(action));
  },

  /**
   * Poll gamepad each frame. Combines with held keyboard state.
   * Must be called once per RAF tick.
   */
  poll() {
    let padDir = 0;
    let padAimDir = 0;
    let padCharge = false;

    const pads = typeof navigator !== 'undefined' && navigator.getGamepads
      ? navigator.getGamepads()
      : [];
    const pad = [...pads].find(Boolean);

    if (pad) {
      // Left stick X / D-pad L-R → move
      const stickX = pad.axes[0] || 0;
      const dLeft  = pad.buttons[14] && pad.buttons[14].pressed;
      const dRight = pad.buttons[15] && pad.buttons[15].pressed;
      if (Math.abs(stickX) > 0.25) padDir = stickX;
      if (dLeft)  padDir = -1;
      if (dRight) padDir =  1;

      // Right stick Y / D-pad U-D → aim angle
      const stickRY = pad.axes[3] || 0;
      const dUp     = pad.buttons[12] && pad.buttons[12].pressed;
      const dDown   = pad.buttons[13] && pad.buttons[13].pressed;
      if (Math.abs(stickRY) > 0.25) padAimDir = stickRY > 0 ? 1 : -1;
      if (dUp)   padAimDir = -1;
      if (dDown) padAimDir =  1;

      // Charge: □ (btn 2) or R2 (btn 7)
      padCharge = !!(pad.buttons[2] && pad.buttons[2].pressed) ||
                  !!(pad.buttons[7] && pad.buttons[7].pressed);

      // Edge-detect buttons for one-shot events
      const edge = (i) => {
        const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
        const was = !!this._padPrev[i];
        this._padPrev[i] = now;
        return now && !was;
      };
      const fall = (i) => {
        const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
        const was = !!this._padPrev[i];
        this._padPrev[i] = now;
        return !now && was;
      };

      if (edge(0))  this._emit({ type: 'jump' });        // ✕ / A
      if (edge(4))  this._emit({ type: 'weaponPrev' });  // L1
      if (edge(5))  this._emit({ type: 'weaponNext' });  // R1
      if (edge(9))  this._emit({ type: 'pause' });       // Options / Start

      // Charge start/release for □(2) and R2(7)
      const chargeBtn2 = !!(pad.buttons[2] && pad.buttons[2].pressed);
      const chargeBtn7 = !!(pad.buttons[7] && pad.buttons[7].pressed);
      const wasCharge2 = !!this._padPrev['c2'];
      const wasCharge7 = !!this._padPrev['c7'];
      if (chargeBtn2 && !wasCharge2) this._emit({ type: 'chargeStart' });
      if (!chargeBtn2 && wasCharge2) this._emit({ type: 'chargeRelease' });
      if (chargeBtn7 && !wasCharge7) this._emit({ type: 'chargeStart' });
      if (!chargeBtn7 && wasCharge7) this._emit({ type: 'chargeRelease' });
      this._padPrev['c2'] = chargeBtn2;
      this._padPrev['c7'] = chargeBtn7;
    } else {
      // Clear prev when no pad connected
      this._padPrev = {};
    }

    // Merge keyboard + gamepad
    this.moveX      = clamp(this._keyDir + padDir, -1, 1);
    this.aimDir     = clamp(this._keyAimDir + padAimDir, -1, 1);
    this.chargeHeld = this._keyCharge || padCharge;
  },
};
