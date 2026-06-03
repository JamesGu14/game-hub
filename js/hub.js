// Switch-style game hub: builds the card rail and wires up
// keyboard, mouse, and gamepad navigation, then launches games full-page.
import { GAMES } from './games.js';

const rail = document.getElementById('rail');
const detailTitle = document.getElementById('detail-title');
const detailSub = document.getElementById('detail-sub');
const detailDesc = document.getElementById('detail-desc');
const detailTags = document.getElementById('detail-tags');

let selected = 0;
const cards = [];

// ---- Build cards ---------------------------------------------------------
GAMES.forEach((game, i) => {
  const card = document.createElement('button');
  card.className = 'card';
  card.type = 'button';
  card.style.setProperty('--accent', game.accent);
  card.style.setProperty('--accent2', game.accent2);
  card.innerHTML = `
    <div class="card-cover">
      <span class="card-icon">${game.icon}</span>
    </div>
    <div class="card-label">${game.title}</div>
  `;
  card.addEventListener('mouseenter', () => select(i));
  card.addEventListener('click', () => {
    select(i);
    launch();
  });
  card.addEventListener('focus', () => select(i));
  rail.appendChild(card);
  cards.push(card);
});

// ---- Selection -----------------------------------------------------------
function select(i, { sound = true } = {}) {
  i = Math.max(0, Math.min(GAMES.length - 1, i));
  if (i === selected && cards[i].classList.contains('selected')) return;
  if (i !== selected && sound) blip();
  selected = i;

  cards.forEach((c, idx) => c.classList.toggle('selected', idx === selected));

  const g = GAMES[selected];
  detailTitle.textContent = g.title;
  detailSub.textContent = g.subtitle;
  detailDesc.textContent = g.desc;
  detailTags.innerHTML = g.tags.map((t) => `<span class="tag">${t}</span>`).join('');
  document.documentElement.style.setProperty('--bg-accent', g.accent);

  // Center the selected card in the rail.
  cards[selected].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

function move(delta) {
  select(selected + delta);
}

function launch() {
  blip(660, 0.12);
  const g = GAMES[selected];
  // Brief flash so the transition feels deliberate, then navigate.
  document.body.classList.add('launching');
  setTimeout(() => {
    window.location.href = g.path;
  }, 220);
}

// ---- Keyboard ------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowRight':
    case 'd':
      e.preventDefault();
      move(1);
      break;
    case 'ArrowLeft':
    case 'a':
      e.preventDefault();
      move(-1);
      break;
    case 'Enter':
    case ' ':
      e.preventDefault();
      launch();
      break;
  }
});

// ---- Gamepad -------------------------------------------------------------
let padAxisCooldown = 0;
let prevAButton = false;
function pollGamepads() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = [...pads].find(Boolean);
  if (pad) {
    const now = performance.now();
    const x = pad.axes[0] || 0;
    const dpadLeft = pad.buttons[14] && pad.buttons[14].pressed;
    const dpadRight = pad.buttons[15] && pad.buttons[15].pressed;

    if (now > padAxisCooldown) {
      if (x > 0.5 || dpadRight) {
        move(1);
        padAxisCooldown = now + 280;
      } else if (x < -0.5 || dpadLeft) {
        move(-1);
        padAxisCooldown = now + 280;
      }
    }

    // A button (index 0) — launch on press edge.
    const aDown = pad.buttons[0] && pad.buttons[0].pressed;
    if (aDown && !prevAButton) launch();
    prevAButton = aDown;
  }
  requestAnimationFrame(pollGamepads);
}
requestAnimationFrame(pollGamepads);

// ---- Top-bar clock -------------------------------------------------------
const clock = document.getElementById('clock');
function tickClock() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  clock.textContent = `${hh}:${mm}`;
}
tickClock();
setInterval(tickClock, 1000 * 15);

// ---- Tiny UI blip (Web Audio, no asset files) ----------------------------
let audioCtx = null;
function blip(freq = 440, dur = 0.06) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + dur);
  } catch {
    /* audio is optional */
  }
}

// ---- Init ----------------------------------------------------------------
select(0, { sound: false });
