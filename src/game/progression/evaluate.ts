import { difficultyAtLeast, type Difficulty } from "../core/config";
import type { SaveData } from "../core/save";
import { INITIAL_IDS, ROSTER_SLOTS, slotById } from "./rosterSlots";
import type { UnlockReq, SecretVisibility } from "./types";

export function reqMet(req: UnlockReq, save: SaveData): boolean {
  const clears = save.arcadeClears ?? [];
  switch (req.kind) {
    case "arcadeClearWith":
      return !!req.target && clears.includes(req.target);
    case "arcadeClearCount":
      return clears.length >= (req.value ?? 1);
    case "arcadeClearAllInitials":
      return INITIAL_IDS.every((id) => clears.includes(id));
    case "arcadeNoContinue":
      return (save.noContinueClears ?? []).length > 0;
    case "arcadeDifficulty":
      return difficultyAtLeast(save.highestDifficultyClear, req.minDifficulty ?? "hard")
        || Object.values(save.characterProgress ?? {}).some((p) => difficultyAtLeast(p.highestDifficulty, req.minDifficulty ?? "hard"));
    case "bloodFinishes":
      return (save.bloodFinishCount ?? 0) >= (req.value ?? 1);
    case "secretFightWin":
      return (save.secretFightsWon ?? []).includes(req.target ?? "");
    case "compound": {
      const all = req.allOf?.every((r) => reqMet(r, save)) ?? true;
      const any = req.anyOf ? req.anyOf.some((r) => reqMet(r, save)) : true;
      return all && any;
    }
    default:
      return false;
  }
}

export function reqProgress(req: UnlockReq, save: SaveData): { current: number; needed: number } | null {
  const clears = save.arcadeClears ?? [];
  switch (req.kind) {
    case "arcadeClearCount":
      return { current: clears.length, needed: req.value ?? 1 };
    case "arcadeClearAllInitials":
      return { current: INITIAL_IDS.filter((id) => clears.includes(id)).length, needed: INITIAL_IDS.length };
    case "bloodFinishes":
      return { current: save.bloodFinishCount ?? 0, needed: req.value ?? 1 };
    case "arcadeNoContinue":
      return { current: (save.noContinueClears ?? []).length > 0 ? 1 : 0, needed: 1 };
    default:
      return null;
  }
}

export function isUnlocked(id: string, save: SaveData) {
  return (save.unlockedCharacters ?? save.unlocked ?? []).includes(id);
}

export function isRevealed(id: string, save: SaveData) {
  const slot = slotById(id);
  if (!slot) return false;
  if (slot.visibility !== "hidden") return true;
  if ((save.revealedCharacters ?? []).includes(id)) return true;
  if (slot.reveal && reqMet(slot.reveal, save)) return true;
  if (isUnlocked(id, save)) return true;
  return false;
}

export function slotVisibility(id: string, save: SaveData): SecretVisibility | "unlocked" | "hidden_now" {
  const slot = slotById(id);
  if (!slot) return "hidden_now";
  if (isUnlocked(id, save)) return "unlocked";
  if (slot.visibility === "hidden" && !isRevealed(id, save)) return "hidden_now";
  return slot.visibility;
}

export function visibleSlots(save: SaveData) {
  return ROSTER_SLOTS.filter((s) => slotVisibility(s.id, save) !== "hidden_now");
}

export function canSelect(id: string, save: SaveData) {
  const slot = slotById(id);
  if (!slot) return false;
  if (!slot.playable) return false;
  return isUnlocked(id, save);
}

export function pendingSecretFights(save: SaveData) {
  return ROSTER_SLOTS
    .filter((s) => s.secretFight && !isUnlocked(s.id, save) && !(save.secretFightsWon ?? []).includes(s.secretFight.id))
    .filter((s) => s.secretFight && reqMet(s.secretFight.trigger, save))
    .map((s) => s.secretFight!);
}

export function hintFor(id: string, save: SaveData): string {
  const slot = slotById(id);
  if (!slot) return "";
  if (isUnlocked(id, save)) return slot.comingSoon ? "DESBLOQUEADO · EM BREVE" : "DESBLOQUEADO";
  const vis = slotVisibility(id, save);
  if (vis === "hidden_now") return "";
  const req = slot.unlock;
  if (!req) return "BLOQUEADO";
  if (vis === "secret" || req.hiddenDescription) return req.hiddenDescription ?? "???";
  const p = reqProgress(req, save);
  if (p) return `${req.description}  (${Math.min(p.current, p.needed)}/${p.needed})`;
  return req.description;
}

export function highestClear(save: SaveData): Difficulty | null {
  return save.highestDifficultyClear ?? null;
}
