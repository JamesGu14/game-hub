export interface SavedState {
  playerName: string;
  bgmEnabled: boolean;
  sfxVolume: number;
  vibrationEnabled: boolean;
  bestLength: number;
  totalKills: number;
  totalDeaths: number;
  achievements: string[];
  hasSeenTutorial: boolean;
}

const KEY = 'snake-game-state';

const DEFAULT_STATE: SavedState = {
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

export function loadState(): SavedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<SavedState>;
    return { ...DEFAULT_STATE, ...parsed };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

export function saveState(state: SavedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage may be disabled; ignore.
  }
}
