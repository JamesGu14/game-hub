// Unified input for keyboard + mouse + gamepad (PS/Xbox).
//
// Two flavours of input:
//   - Continuous paddle control: `pointerX` (absolute, from mouse) OR `dir` (-1..1 from
//     held keys / stick). `usingPointer` decides which one the game should follow.
//   - Discrete actions: subscribers get 'left','right','launch','pause','confirm','back','mute'.
//     Menus use left/right/confirm; gameplay uses launch/pause. 'launch' also confirms menus.
//
// `poll()` must be called once per frame to read the gamepad (it has no events).

export const Input = {
  pointerX: null, // field-space X of the mouse, or null until it moves
  usingPointer: false, // true after mouse move, false after a key / stick nudge
  dir: 0, // -1..1 continuous direction from keys + stick

  _subs: [],
  _keyDir: 0,
  _padPrev: {},
  _padDirEdge: 0,
  _getFieldX: () => null,

  /** @param {HTMLCanvasElement} canvas @param {(clientX:number) => number} mapClientXToField */
  init(canvas, mapClientXToField) {
    this._getFieldX = mapClientXToField;

    // ---- Mouse ----
    canvas.addEventListener('mousemove', (e) => {
      this.pointerX = this._getFieldX(e.clientX);
      this.usingPointer = true;
    });
    canvas.addEventListener('mousedown', () => this._emit('launch'));

    // ---- Touch (works for laptops/tablets too) ----
    canvas.addEventListener(
      'touchstart',
      (e) => {
        if (e.touches[0]) {
          this.pointerX = this._getFieldX(e.touches[0].clientX);
          this.usingPointer = true;
        }
        this._emit('launch');
        e.preventDefault();
      },
      { passive: false },
    );
    canvas.addEventListener(
      'touchmove',
      (e) => {
        if (e.touches[0]) {
          this.pointerX = this._getFieldX(e.touches[0].clientX);
          this.usingPointer = true;
        }
        e.preventDefault();
      },
      { passive: false },
    );

    // ---- Keyboard ----
    const held = new Set();
    const recomputeDir = () =>
      (this._keyDir = (held.has('R') ? 1 : 0) - (held.has('L') ? 1 : 0));

    window.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (!held.has('L')) this._emit('left');
          held.add('L');
          this.usingPointer = false;
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (!held.has('R')) this._emit('right');
          held.add('R');
          this.usingPointer = false;
          e.preventDefault();
          break;
        case ' ':
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (!e.repeat) this._emit('launch');
          e.preventDefault();
          break;
        case 'Enter':
          if (!e.repeat) this._emit('confirm');
          e.preventDefault();
          break;
        case 'Escape':
        case 'p':
        case 'P':
          if (!e.repeat) this._emit('pause');
          e.preventDefault();
          break;
        case 'Backspace':
          if (!e.repeat) this._emit('back');
          e.preventDefault();
          break;
        case 'm':
        case 'M':
          if (!e.repeat) this._emit('mute');
          break;
      }
      recomputeDir();
    });
    window.addEventListener('keyup', (e) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) held.delete('L');
      if (['ArrowRight', 'd', 'D'].includes(e.key)) held.delete('R');
      recomputeDir();
    });
  },

  on(fn) {
    this._subs.push(fn);
  },
  _emit(action) {
    this._subs.forEach((fn) => fn(action));
  },

  // Read the gamepad each frame: updates `dir` and fires edge actions.
  poll() {
    let padDir = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (pad) {
      const x = pad.axes[0] || 0;
      const dl = pad.buttons[14] && pad.buttons[14].pressed;
      const dr = pad.buttons[15] && pad.buttons[15].pressed;
      if (Math.abs(x) > 0.18) padDir = x; // analog stick
      if (dl) padDir = -1;
      if (dr) padDir = 1;
      if (padDir !== 0) this.usingPointer = false;

      const edge = (i) => {
        const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
        const was = this._padPrev[i];
        this._padPrev[i] = now;
        return now && !was;
      };

      // Menu left/right edges from stick / dpad.
      const dirEdge = padDir < -0.5 ? -1 : padDir > 0.5 ? 1 : 0;
      if (dirEdge !== 0 && this._padDirEdge === 0) {
        this._emit(dirEdge < 0 ? 'left' : 'right');
      }
      this._padDirEdge = dirEdge;

      if (edge(0)) this._emit('launch'); // A / ✕  → launch (also confirms menus)
      if (edge(1)) this._emit('back'); // B / ○
      if (edge(9) || edge(8)) this._emit('pause'); // Start / Options (or Select fallback)
    }
    this.dir = Math.max(-1, Math.min(1, this._keyDir + padDir));
  },
};
