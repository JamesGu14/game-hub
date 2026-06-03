/**
 * 首次启动名字输入 + 教程页。返回最终玩家名字。
 * 如果 state 已有名字且已看过教程，直接跳过。
 */
export interface StartScreenResult {
  playerName: string;
  hasSeenTutorial: boolean;
}

export async function showStartFlow(opts: {
  existingName: string;
  hasSeenTutorial: boolean;
  forceShow?: boolean;
}): Promise<StartScreenResult> {
  let name = opts.existingName;
  let seen = opts.hasSeenTutorial;

  if (!name || opts.forceShow) {
    name = await askName(opts.existingName);
  }
  if (!seen) {
    await showTutorial();
    seen = true;
  }
  return { playerName: name, hasSeenTutorial: seen };
}

function askName(existing: string): Promise<string> {
  return new Promise((resolve) => {
    const overlay = document.getElementById('startScreen');
    const input = document.getElementById('nameInput');
    const btn = document.getElementById('startBtn');
    if (!overlay || !(input instanceof HTMLInputElement) || !(btn instanceof HTMLButtonElement)) {
      resolve(existing || '宝贝');
      return;
    }
    overlay.classList.remove('hidden');
    input.value = existing;
    input.focus();

    const submit = (): void => {
      const value = input.value.trim();
      if (!value) {
        input.focus();
        return;
      }
      overlay.classList.add('hidden');
      btn.removeEventListener('click', submit);
      input.removeEventListener('keydown', onKey);
      resolve(value);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Enter') submit();
    };
    btn.addEventListener('click', submit);
    input.addEventListener('keydown', onKey);
  });
}

function showTutorial(): Promise<void> {
  return new Promise((resolve) => {
    const overlay = document.getElementById('tutorial');
    const nextBtn = document.getElementById('tutNext');
    if (!overlay || !(nextBtn instanceof HTMLButtonElement)) {
      resolve();
      return;
    }
    const pages = overlay.querySelectorAll<HTMLElement>('.tutorial-page');
    const dots = overlay.querySelectorAll<HTMLElement>('.page-dot');
    let current = 0;

    const showPage = (idx: number): void => {
      pages.forEach((p, i) => p.classList.toggle('hidden', i !== idx));
      dots.forEach((d, i) => d.classList.toggle('active', i === idx));
      if (idx === pages.length - 1) {
        nextBtn.innerHTML = '开<ruby>始<rt>shǐ</rt></ruby><ruby>玩<rt>wán</rt></ruby>';
      } else {
        nextBtn.innerHTML = '下<ruby>一<rt>yī</rt></ruby><ruby>页<rt>yè</rt></ruby>';
      }
    };

    overlay.classList.remove('hidden');
    showPage(0);

    const click = (): void => {
      current++;
      if (current >= pages.length) {
        overlay.classList.add('hidden');
        nextBtn.removeEventListener('click', click);
        resolve();
        return;
      }
      showPage(current);
    };
    nextBtn.addEventListener('click', click);
  });
}
