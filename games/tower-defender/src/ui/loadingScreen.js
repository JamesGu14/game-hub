// src/ui/loadingScreen.js — 启动加载屏与失败提示

export function createLoadingScreen() {
  const el = document.createElement('div');
  el.id = 'loading';
  el.className = 'loading-screen';
  el.innerHTML = `
    <div class="loading-scroll">
      <div class="loading-title">成都保卫战</div>
      <div class="loading-bar">
        <div class="loading-fill" style="width:0%"></div>
      </div>
      <div class="loading-meta">
        <span class="loading-stage">准备军资…</span>
        <span class="loading-percent">0%</span>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

export function updateLoadingScreen(el, { percent, stage }) {
  const fill = el.querySelector('.loading-fill');
  const stageEl = el.querySelector('.loading-stage');
  const percentEl = el.querySelector('.loading-percent');
  if (fill) fill.style.width = `${percent}%`;
  if (stageEl) stageEl.textContent = stage || '加载中…';
  if (percentEl) percentEl.textContent = `${percent}%`;
}

export function fadeOutLoadingScreen(el) {
  return new Promise((resolve) => {
    if (!el || !el.parentNode) { resolve(); return; }
    el.classList.add('loading-fade-out');
    const cleanup = () => {
      if (el.parentNode) el.remove();
      resolve();
    };
    el.addEventListener('transitionend', cleanup, { once: true });
    setTimeout(cleanup, 600);
  });
}

export function showRetryDialog({ onContinue }) {
  const dialog = document.createElement('div');
  dialog.className = 'loading-retry-dialog';
  dialog.innerHTML = `
    <div class="loading-retry-box">
      <div class="loading-retry-title">军情未达</div>
      <p>部分军情图卷未能送达，是否继续出征？</p>
      <div class="loading-retry-actions">
        <button class="loading-retry-continue">继续出征</button>
        <button class="loading-retry-retry">重新整备</button>
      </div>
    </div>
  `;
  dialog.querySelector('.loading-retry-continue').addEventListener('click', () => {
    dialog.remove();
    onContinue();
  });
  dialog.querySelector('.loading-retry-retry').addEventListener('click', () => {
    location.reload();
  });
  document.body.appendChild(dialog);
}
