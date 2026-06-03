import type { Snake } from './snake';

export interface AchievementCtx {
  player: Snake;
  totalFoodEaten: number;
  totalKills: number;
  itemsPickedUp: number;
  bulletHits: number;
  activeEffectsCount: number;
}

export interface Achievement {
  id: string;
  label: string;
  pinyin: string;
  emoji: string;
  check: (ctx: AchievementCtx) => boolean;
}

export const ACHIEVEMENTS: readonly Achievement[] = [
  {
    id: 'first_10_food',
    label: '吃 10 个食物',
    pinyin: 'chī shí gè shí wù',
    emoji: '🍎',
    check: (c) => c.totalFoodEaten >= 10,
  },
  {
    id: 'length_30',
    label: '长度达到 30',
    pinyin: 'cháng dù dá dào sān shí',
    emoji: '🐍',
    check: (c) => c.player.length >= 30,
  },
  {
    id: 'length_50',
    label: '长度达到 50',
    pinyin: 'cháng dù dá dào wǔ shí',
    emoji: '🐲',
    check: (c) => c.player.length >= 50,
  },
  {
    id: 'length_100',
    label: '长度达到 100',
    pinyin: 'cháng dù dá dào yī bǎi',
    emoji: '🏆',
    check: (c) => c.player.length >= 100,
  },
  {
    id: 'first_kill',
    label: '首次击杀',
    pinyin: 'shǒu cì jī shā',
    emoji: '⚔️',
    check: (c) => c.totalKills >= 1,
  },
  {
    id: 'first_item',
    label: '首次拾取道具',
    pinyin: 'shǒu cì shí qǔ dào jù',
    emoji: '🎁',
    check: (c) => c.itemsPickedUp >= 1,
  },
  {
    id: 'first_bullet_hit',
    label: '首次子弹击杀',
    pinyin: 'shǒu cì zǐ dàn jī shā',
    emoji: '🎯',
    check: (c) => c.bulletHits >= 1,
  },
  {
    id: 'stack_3',
    label: '同时叠 3 个道具',
    pinyin: 'tóng shí dié sān gè dào jù',
    emoji: '✨',
    check: (c) => c.activeEffectsCount >= 3,
  },
];

export class AchievementTracker {
  unlocked = new Set<string>();
  private toastQueue: Achievement[] = [];
  currentToast: { ach: Achievement; t: number } | null = null;
  /** Called when a new achievement unlocks (for save + sfx). */
  onUnlock: (ach: Achievement) => void = () => {};

  constructor(initial: readonly string[]) {
    for (const id of initial) this.unlocked.add(id);
  }

  check(ctx: AchievementCtx): void {
    for (const ach of ACHIEVEMENTS) {
      if (this.unlocked.has(ach.id)) continue;
      if (ach.check(ctx)) {
        this.unlocked.add(ach.id);
        this.toastQueue.push(ach);
        this.onUnlock(ach);
      }
    }
  }

  update(dt: number): void {
    if (!this.currentToast && this.toastQueue.length > 0) {
      const next = this.toastQueue.shift();
      if (next) this.currentToast = { ach: next, t: 0 };
    }
    if (this.currentToast) {
      this.currentToast.t += dt;
      if (this.currentToast.t > 2.5) this.currentToast = null;
    }
  }
}
