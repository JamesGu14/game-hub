// games/turbo-drift/src/input.js
const keys = new Set();

window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
  keys.add(e.key.toLowerCase());
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

export function readInput() {
  let steer = 0;
  if (keys.has('arrowleft') || keys.has('a')) steer -= 1;
  if (keys.has('arrowright') || keys.has('d')) steer += 1;
  let throttle = keys.has('arrowup') || keys.has('w');
  let drifting = keys.has(' ');
  let nitro = keys.has('shift');
  let item = keys.has('z') || keys.has('arrowdown');
  let pause = keys.has('escape') || keys.has('p');

  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = [...pads].find(Boolean);
  if (pad) {
    const ax = pad.axes[0] || 0;
    if (Math.abs(ax) > 0.2) steer += ax;
    if (pad.buttons[14]?.pressed) steer -= 1;
    if (pad.buttons[15]?.pressed) steer += 1;
    if (pad.buttons[7]?.pressed || pad.buttons[0]?.pressed) throttle = true; // RT / ✕
    if (pad.buttons[4]?.pressed) drifting = true; // L1
    if (pad.buttons[5]?.pressed) nitro = true;    // R1
    if (pad.buttons[2]?.pressed) item = true;     // □
    if (pad.buttons[9]?.pressed) pause = true;    // Start
  }

  steer = Math.max(-1, Math.min(1, steer));
  return { throttle, steer, drifting, nitro, item, pause };
}
