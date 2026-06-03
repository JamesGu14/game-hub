// Central tuning constants — keeps gameplay balance values out of game logic.

export const MONEY = {
  KILL_BOUNTY:  300,   // awarded per bot kill
  ROUND_WIN:    3000,  // awarded when all bots defeated
  CONSOLATION:  1500,  // awarded on player death
  TIMER_LOSS:   1400,  // awarded when round timer expires with bots alive
};

export const COMBAT = {
  CROUCH_DAMAGE_MULT: 0.55, // multiplier applied to incoming damage while crouched
};
