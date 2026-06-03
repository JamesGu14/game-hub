export async function showStartFlow(opts) {
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
function askName(existing) {
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
        const submit = () => {
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
        const onKey = (e) => {
            if (e.key === 'Enter')
                submit();
        };
        btn.addEventListener('click', submit);
        input.addEventListener('keydown', onKey);
    });
}
function showTutorial() {
    return new Promise((resolve) => {
        const overlay = document.getElementById('tutorial');
        const nextBtn = document.getElementById('tutNext');
        if (!overlay || !(nextBtn instanceof HTMLButtonElement)) {
            resolve();
            return;
        }
        const pages = overlay.querySelectorAll('.tutorial-page');
        const dots = overlay.querySelectorAll('.page-dot');
        let current = 0;
        const showPage = (idx) => {
            pages.forEach((p, i) => p.classList.toggle('hidden', i !== idx));
            dots.forEach((d, i) => d.classList.toggle('active', i === idx));
            if (idx === pages.length - 1) {
                nextBtn.innerHTML = '开<ruby>始<rt>shǐ</rt></ruby><ruby>玩<rt>wán</rt></ruby>';
            }
            else {
                nextBtn.innerHTML = '下<ruby>一<rt>yī</rt></ruby><ruby>页<rt>yè</rt></ruby>';
            }
        };
        overlay.classList.remove('hidden');
        showPage(0);
        const click = () => {
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
