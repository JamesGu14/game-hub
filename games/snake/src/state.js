const KEY = 'snake-game-state';
const DEFAULT_STATE = {
    playerName: '',
    bgmEnabled: false,
    sfxVolume: 0.7,
    vibrationEnabled: true,
    bestLength: 0,
    totalKills: 0,
    totalDeaths: 0,
    achievements: [],
    hasSeenTutorial: false,
};
export function loadState() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw)
            return { ...DEFAULT_STATE };
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_STATE, ...parsed };
    }
    catch {
        return { ...DEFAULT_STATE };
    }
}
export function saveState(state) {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    }
    catch {
        // localStorage may be disabled; ignore.
    }
}
