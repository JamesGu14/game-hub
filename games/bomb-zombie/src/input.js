// input.js — 键盘/触屏 → 动作回调。阶段1操作极简：放技能/暂停/静音/选卡靠 DOM 点击。
export const Input = {
  _cbs: [],
  on(fn) { this._cbs.push(fn); },
  _emit(a) { for (const fn of this._cbs) fn(a); },
  init() {
    window.addEventListener('keydown', (e) => {
      if (e.key === '1') this._emit({ type: 'skill', id: 'nuke' });
      else if (e.key === '2') this._emit({ type: 'skill', id: 'freeze' });
      else if (e.key === 'Escape') this._emit({ type: 'pause' });
      else if (e.key.toLowerCase() === 'm') this._emit({ type: 'mute' });
    });
  },
};
