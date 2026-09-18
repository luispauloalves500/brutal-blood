export type MoveType =
  | "normal"
  | "special"
  | "super"
  | "throw"
  | "finish"
  | "counter"
  | "taunt"
  | "aerial";

export type AttackButton =
  | "light"
  | "medium"
  | "heavy"
  | "kickLight"
  | "kickHeavy"
  | "special"
  | "super"
  | "throw"
  | "taunt";

export type HitHeight = "mid" | "low" | "high";

export type ComboLevel = "basic" | "intermediate" | "advanced" | "air" | "wall" | "counter" | "punish" | "meter";

export type MoveDef = {
  id: string;
  name: string;
  type: MoveType;
  /** Motion + button, e.g. "236L", "66H", "22S". Relative to facing. */
  command?: string;
  button?: AttackButton;
  damage: number;
  range: number;
  /** Frame data at 60fps. Timing is never tied to display refresh. */
  startup: number;
  active: number;
  recovery: number;
  hitStun: number;
  blockStun: number;
  knockback: number;
  priority: number;
  invuln?: number;
  meterGain: number;
  superGain?: number;
  cost?: number;
  superCost?: number;
  cancelInto?: string[];
  height?: HitHeight;
  knockdown?: boolean;
  launcher?: boolean;
  projectile?: string;
  advance?: number;
  antiAir?: boolean;
  hits?: number;
  hitstop?: number;
  airOk?: boolean;
  grab?: boolean;
};

export type ComboDef = {
  id: string;
  name: string;
  level: ComboLevel;
  sequence: string[];
  description: string;
};

export type FinishDef = {
  id: string;
  name: string;
  command: string;
  description: string;
};

export type CharacterStats = {
  speed: number;
  backSpeed: number;
  jump: number;
  maxHealth: number;
  defense: number;
  strength: number;
  range: number;
  weight: number;
  dashSpeed: number;
};

export type CharacterRatings = {
  power: number;
  speed: number;
  defense: number;
  range: number;
};

export type CharacterDef = {
  id: string;
  name: string;
  title: string;
  style: string;
  color: string;
  accent: string;
  portrait?: string;
  locked?: boolean;
  stats: CharacterStats;
  ratings: CharacterRatings;
  lore: string;
  moves: Record<string, MoveDef>;
  combos: ComboDef[];
  specials: string[];
  super: string;
  finishes: FinishDef[];
  introLine: string;
  winLine: string;
};

export type RosterEntry = CharacterDef | {
  id: string;
  name: string;
  title: string;
  style: string;
  color: string;
  accent: string;
  locked: true;
  ratings: CharacterRatings;
};
