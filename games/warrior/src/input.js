// Unified input for 丛林勇士: keyboard + gamepad -> a single Intent each frame, plus
// the classic "hold a direction = aim that direction" resolver. Touch controls are
// added in M5. DOM access lives only inside init()/poll(), so this module imports
// cleanly in Node (resolveAim is pure and unit-tested there).
//
// Default keys (NES-style, spec §7): move/aim = arrows or WASD, Z = fire, X = jump,
// C = switch weapon, ↓ = (prone, from M2). Remappable from M3.

const D = Math.SQRT1_2;

// Classic aim model (spec §3.2). Hold a direction to shoot that direction; facing
// follows movement. There is no separate aim stick.
//   resolveAim(intent, onGround, faceRight) -> unit vector { x, y }
export function resolveAim(intent, onGround, faceRight) {
  const hx = intent.moveX !== 0 ? intent.moveX : (faceRight ? 1 : -1);
  // On the ground, down means prone — still a horizontal shot, never straight down.
  if (intent.aimDown && onGround) return { x: hx, y: 0 };
  if (intent.aimUp) {
    if (intent.moveX !== 0) return { x: hx * D, y: -D }; // diagonal up
    return { x: 0, y: -1 };                              // straight up
  }
  if (intent.aimDown) { // airborne
    if (intent.moveX !== 0) return { x: hx * D, y: D };  // diagonal down
    return { x: 0, y: 1 };                               // straight down
  }
  return { x: hx, y: 0 };                                // horizontal
}

export const Input = {
  // Continuous Intent (rebuilt each poll; entities read this object).
  intent: { moveX: 0, aimUp: false, aimDown: false, jumpHeld: false, fireHeld: false },

  _subs: [],
  _k: { left: false, right: false, up: false, down: false, jump: false, fire: false },
  _padPrev: {},

  init(canvas) {
    const set = (e, down) => {
      switch (e.key) {
        case 'ArrowLeft': case 'a': case 'A': this._k.left = down; e.preventDefault(); break;
        case 'ArrowRight': case 'd': case 'D': this._k.right = down; e.preventDefault(); break;
        case 'ArrowUp': case 'w': case 'W': this._k.up = down; e.preventDefault(); break;
        case 'ArrowDown': case 's': case 'S': this._k.down = down; e.preventDefault(); break;
        case 'x': case 'X': case 'k': case 'K': case ' ': // X / K / Space = jump
          this._k.jump = down; if (down && !e.repeat) this._emit('confirm'); e.preventDefault(); break;
        case 'z': case 'Z': // Z = fire
          this._k.fire = down; e.preventDefault(); break;
        case 'c': case 'C': case 'l': case 'L':
          if (down && !e.repeat) this._emit('switch'); e.preventDefault(); break;
        case 'Enter':
          if (down && !e.repeat) this._emit('confirm'); break;
        case 'Escape': case 'p': case 'P':
          if (down && !e.repeat) this._emit('pause'); break;
        case 'Backspace':
          if (down && !e.repeat) this._emit('back'); break;
        case 'm': case 'M':
          if (down && !e.repeat) this._emit('mute'); break;
        default: break;
      }
    };
    window.addEventListener('keydown', (e) => set(e, true));
    window.addEventListener('keyup', (e) => set(e, false));
    if (canvas) canvas.addEventListener('pointerdown', () => this._emit('confirm'));
  },

  on(fn) { this._subs.push(fn); },
  _emit(action) { this._subs.forEach((fn) => fn(action)); },

  poll() {
    let padX = 0, padUp = false, padDown = false, padJump = false, padFire = false;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = [...pads].find(Boolean);
    if (pad) {
      const ax = pad.axes[0] || 0, ay = pad.axes[1] || 0;
      if (Math.abs(ax) > 0.3) padX = ax > 0 ? 1 : -1;
      if (pad.buttons[14] && pad.buttons[14].pressed) padX = -1;
      if (pad.buttons[15] && pad.buttons[15].pressed) padX = 1;
      if ((pad.buttons[12] && pad.buttons[12].pressed) || ay < -0.5) padUp = true;
      if ((pad.buttons[13] && pad.buttons[13].pressed) || ay > 0.5) padDown = true;
      padJump = !!(pad.buttons[0] && pad.buttons[0].pressed); // ✕
      padFire = !!(pad.buttons[2] && pad.buttons[2].pressed); // □
      const edge = (i) => {
        const now = !!(pad.buttons[i] && pad.buttons[i].pressed);
        const was = this._padPrev[i]; this._padPrev[i] = now; return now && !was;
      };
      if (edge(0)) this._emit('confirm');
      if (edge(5) || edge(4)) this._emit('switch'); // shoulder
      if (edge(1)) this._emit('back');              // ○
      if (edge(9) || edge(8)) this._emit('pause');  // Start / Select
    }

    const left = this._k.left, right = this._k.right;
    let mx = (right ? 1 : 0) - (left ? 1 : 0);
    if (mx === 0 && padX !== 0) mx = padX;
    this.intent.moveX = Math.max(-1, Math.min(1, mx));
    this.intent.aimUp = this._k.up || padUp;
    this.intent.aimDown = this._k.down || padDown;
    this.intent.jumpHeld = this._k.jump || padJump;
    this.intent.fireHeld = this._k.fire || padFire;
  },
};
