// Unified input for 像素冒险 PIXEL QUEST: keyboard + PS/Xbox gamepad + touch buttons.
//
//   - Continuous: Input.moveX (-1..1), Input.held.jump, Input.held.run.
//   - Discrete actions emitted to subscribers: 'jump','pause','confirm','back','mute','fire'.
//
// `poll()` reads the gamepad each frame (no events). Touch buttons in index.html
// (ids tc-left,tc-right,tc-jump,tc-run) are bound to pointer events.

export const Input = {
  moveX: 0,
  held: { jump: false, run: false },

  _subs: [],
  _keyLeft: false,
  _keyRight: false,
  _keyJump: false,
  _keyRun: false,
  _touchLeft: false,
  _touchRight: false,
  _touchJump: false,
  _touchRun: false,
  _padPrev: {},

  init(canvas) {
    // ---- Keyboard ----
    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A':
          this._keyLeft = true; e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D':
          this._keyRight = true; e.preventDefault(); break;
        case ' ': case 'ArrowUp': case 'w': case 'W':
          if (!e.repeat) { this._emit('jump'); this._emit('confirm'); }
          this._keyJump = true; e.preventDefault(); break;
        case 'Shift':
          this._keyRun = true; e.preventDefault(); break;
        case 'j': case 'J':
          this._keyRun = true;
          if (!e.repeat) this._emit('fire');
          e.preventDefault(); break;
        case 'Enter':
          if (!e.repeat) this._emit('confirm'); e.preventDefault(); break;
        case 'Escape': case 'p': case 'P':
          if (!e.repeat) this._emit('pause'); e.preventDefault(); break;
        case 'Backspace':
          if (!e.repeat) this._emit('back'); e.preventDefault(); break;
        case 'm': case 'M':
          if (!e.repeat) this._emit('mute'); break;
      }
    });
    window.addEventListener('keyup', (e) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': this._keyLeft = false; break;
        case 'ArrowRight': case 'd': case 'D': this._keyRight = false; break;
        case ' ': case 'ArrowUp': case 'w': case 'W': this._keyJump = false; break;
        case 'Shift': this._keyRun = false; break;
        case 'j': case 'J': this._keyRun = false; break;
      }
    });

    // ---- Touch buttons (provided by index.html) ----
    this._bindTouch('tc-left', (down) => { this._touchLeft = down; });
    this._bindTouch('tc-right', (down) => { this._touchRight = down; });
    this._bindTouch('tc-jump', (down) => {
      this._touchJump = down;
      if (down) { this._emit('jump'); this._emit('confirm'); }
    });
    this._bindTouch('tc-run', (down) => {
      this._touchRun = down;
      if (down) this._emit('fire');
    });

    // A tap anywhere on the canvas also confirms menus / story.
    canvas.addEventListener('pointerdown', () => this._emit('confirm'));
  },

  _bindTouch(id, setter) {
    const elt = document.getElementById(id);
    if (!elt) return;
    const down = (e) => { e.preventDefault(); setter(true); };
    const up = (e) => { e.preventDefault(); setter(false); };
    elt.addEventListener('pointerdown', down);
    elt.addEventListener('pointerup', up);
    elt.addEventListener('pointercancel', up);
    elt.addEventListener('pointerleave', up);
  },

  on(fn) { this._subs.push(fn); },
  _emit(action) { this._subs.forEach((fn) => fn(action)); },

  poll() {
    let padX = 0;
    let padJump = false;
    let padRun = false;

    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (pad) {
      const ax = pad.axes[0] || 0;
      if (Math.abs(ax) > 0.22) padX = ax;
      if (pad.buttons[14] && pad.buttons[14].pressed) padX = -1;
      if (pad.buttons[15] && pad.buttons[15].pressed) padX = 1;

      padJump = !!(pad.buttons[0] && pad.buttons[0].pressed);
      padRun = !!(pad.buttons[2] && pad.buttons[2].pressed);

      const edge = (i) => {
        const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
        const was = this._padPrev[i];
        this._padPrev[i] = now;
        return now && !was;
      };
      if (edge(0)) { this._emit('jump'); this._emit('confirm'); } // ✕
      if (edge(2)) this._emit('fire'); // □
      if (edge(1)) this._emit('back'); // ○
      if (edge(9) || edge(8)) this._emit('pause'); // Start / Select
    }

    const left = this._keyLeft || this._touchLeft;
    const right = this._keyRight || this._touchRight;
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    if (mx === 0 && padX !== 0) mx = padX;
    this.moveX = Math.max(-1, Math.min(1, mx));

    this.held.jump = this._keyJump || this._touchJump || padJump;
    this.held.run = this._keyRun || this._touchRun || padRun;
  },
};
