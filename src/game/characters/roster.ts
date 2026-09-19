import type { CharacterDef, RosterEntry } from "./types";
import { kharon } from "./kharon";
import { nyx } from "./nyx";
import { draven } from "./draven";
import { vespera } from "./vespera";
import { ROSTER_SLOTS } from "../progression/rosterSlots";

export const playable: CharacterDef[] = [kharon, nyx, draven, vespera];

/** Legacy 8-entry list kept for AI ladders. UI uses ROSTER_SLOTS. */
export const roster: RosterEntry[] = ROSTER_SLOTS.map((s) => {
  const live = playable.find((p) => p.id === s.id);
  if (live) return live;
  return {
    id: s.id,
    name: s.name,
    title: s.title,
    style: s.style,
    color: s.color,
    accent: s.accent,
    locked: true as const,
    ratings: s.ratings,
  };
});

export function getFighter(id: string): CharacterDef {
  const f = playable.find((p) => p.id === id);
  if (!f) throw new Error(`Lutador indisponível: ${id}`);
  return f;
}

export function isPlayable(entry: RosterEntry): entry is CharacterDef {
  return !("locked" in entry && entry.locked) && playable.some((p) => p.id === entry.id);
}

export function standInFighter(standInId: string, name: string, title: string, color: string): CharacterDef {
  const base = getFighter(standInId);
  return { ...base, name, title, color };
}
