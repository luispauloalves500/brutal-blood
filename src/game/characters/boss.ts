/**
 * Dedicated boss architecture — not wired in v0.7.
 * Arcade CHEFE still uses a playable fighter at nightmare difficulty.
 * Later: phases, unique AI, extra health.
 */
export type BossPhase = {
  untilHealth: number;
  armor: boolean;
  specialRate: number;
  label: string;
};

export type BossDef = {
  id: string;
  fighterId: string;
  maxHealth: number;
  phases: BossPhase[];
};
