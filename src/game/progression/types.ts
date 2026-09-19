import type { CharacterRatings } from "../characters/types";
import type { Difficulty } from "../core/config";
import type { PaletteDef } from "../assets/types";

export type UnlockKind =
  | "arcadeClearWith"
  | "arcadeClearCount"
  | "arcadeClearAllInitials"
  | "arcadeNoContinue"
  | "arcadeDifficulty"
  | "bloodFinishes"
  | "secretFightWin"
  | "compound";

export type UnlockReq = {
  kind: UnlockKind;
  target?: string;
  value?: number;
  minDifficulty?: Difficulty;
  allOf?: UnlockReq[];
  anyOf?: UnlockReq[];
  description: string;
  hiddenDescription?: string;
};

export type SecretVisibility = "locked_visible" | "secret" | "hidden";

export type RewardKind = "fighter" | "palette" | "skin" | "stage" | "music" | "gallery" | "ending" | "title";

export type RewardDef = {
  id: string;
  kind: RewardKind;
  name: string;
  subtitle: string;
  description: string;
  hiddenDescription?: string;
  fighterId?: string;
  palette?: PaletteDef;
  color?: string;
  initiallyGranted?: boolean;
  comingSoon?: boolean;
  unlock?: UnlockReq;
};

/** @deprecated use RewardDef */
export type Reward = { kind: RewardKind; id: string };

export type SecretFightDef = {
  id: string;
  unlockId: string;
  standInId: string;
  displayName: string;
  displayTitle: string;
  intro: string;
  winLine: string;
  loseLine: string;
  difficulty: Difficulty;
  stageId: string;
  trigger: UnlockReq;
};

export type RosterSlot = {
  slot: number;
  id: string;
  name: string;
  title: string;
  style: string;
  color: string;
  accent: string;
  ratings: CharacterRatings;
  initiallyUnlocked: boolean;
  playable: boolean;
  comingSoon?: boolean;
  visibility: SecretVisibility;
  unlock?: UnlockReq;
  reveal?: UnlockReq;
  secretFight?: SecretFightDef;
  rewards?: Reward[];
};

export type CharacterProgress = {
  arcadeCleared: boolean;
  storyCleared: boolean;
  highestDifficulty: Difficulty | null;
  wins: number;
  losses: number;
  kos: number;
  maxCombo: number;
  timePlayed: number;
  bloodFinishes: number;
  perfects: number;
  clears: number;
};

export type ProgressSnapshot = {
  unlocked: number;
  total: number;
  arcadeClears: number;
  bloodFinishes: number;
  secretWins: number;
  highestDifficulty: Difficulty | null;
  rewards: number;
  rewardTotal: number;
  percent: number;
};

export type FlushResult = {
  unlocks: string[];
  rewards: string[];
  reveals: string[];
  secretFight: SecretFightDef | null;
};
