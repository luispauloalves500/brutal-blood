import type { Difficulty } from "../core/config";
import type { CharacterDef } from "../characters/types";
import { playable } from "../characters/roster";
import { STAGES } from "../graphics/stages";

export type ArcadeFight = {
  label: string;
  difficulty: Difficulty;
  stageId: string;
  mirror: boolean;
};

export const ARCADE_LADDER: ArcadeFight[] = [
  { label: "RUA 1", difficulty: "easy", stageId: "abandoned", mirror: false },
  { label: "RUA 2", difficulty: "normal", stageId: "temple", mirror: false },
  { label: "RUA 3", difficulty: "hard", stageId: "industrial", mirror: true },
  { label: "RUA 4", difficulty: "brutal", stageId: "cathedral", mirror: false },
  { label: "CHEFE", difficulty: "nightmare", stageId: "fortress", mirror: false },
];

export const ARCADE_CONTINUES = 1;
export const SURVIVAL_HEAL = 0.18;

export function otherFighter(id: string): CharacterDef {
  return playable.find((p) => p.id !== id) ?? playable[0];
}

export function othersOf(id: string): CharacterDef[] {
  const list = playable.filter((p) => p.id !== id);
  return list.length ? list : [...playable];
}

export function arcadeOpponent(p1: CharacterDef, fight: ArcadeFight, index = 0): CharacterDef {
  if (fight.mirror) return p1;
  const others = othersOf(p1.id);
  return others[index % others.length];
}

export function survivalOpponent(p1: CharacterDef, wave: number): CharacterDef {
  const cycle = [...othersOf(p1.id), p1];
  return cycle[(wave - 1) % cycle.length];
}

export type TourneyBracket = {
  semiOpp: CharacterDef;
  otherA: CharacterDef;
  otherB: CharacterDef;
  finalOpp: CharacterDef;
};

export function buildBracket(p1: CharacterDef): TourneyBracket {
  const others = othersOf(p1.id);
  const pool: CharacterDef[] = [];
  for (let i = 0; i < 3; i++) pool.push(others[i % others.length]);
  const [semiOpp, otherA, otherB] = pool;
  const score = (c: CharacterDef) => c.ratings.power + c.ratings.defense + c.ratings.speed;
  const finalOpp = score(otherA) >= score(otherB) ? otherA : otherB;
  return { semiOpp, otherA, otherB, finalOpp };
}

export function survivalDifficulty(wave: number): Difficulty {
  if (wave <= 2) return "easy";
  if (wave <= 4) return "normal";
  if (wave <= 6) return "hard";
  if (wave <= 8) return "brutal";
  return "nightmare";
}

export function survivalStage(wave: number): string {
  return STAGES[(wave - 1) % STAGES.length]?.id ?? "abandoned";
}

export function healCarry(health: number, max: number) {
  return Math.min(max, Math.max(1, health + max * SURVIVAL_HEAL));
}
