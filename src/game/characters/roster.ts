import type { CharacterDef, RosterEntry } from "./types";
import { kharon } from "./kharon";
import { nyx } from "./nyx";
import { draven } from "./draven";

const locked = (
  id: string,
  name: string,
  title: string,
  style: string,
  color: string,
  accent: string,
  ratings: CharacterDef["ratings"],
): RosterEntry => ({
  id, name, title, style, color, accent, locked: true, ratings,
});

export const playable: CharacterDef[] = [kharon, nyx, draven];

export const roster: RosterEntry[] = [
  kharon,
  nyx,
  draven,
  locked("vespera", "VESPERA", "A Rainha Rubra", "Magia de sangue", "#7a1230", "#e35a7a", { power: 7, speed: 6, defense: 5, range: 9 }),
  locked("gorr", "GORR", "O Devorador", "Grappler", "#4a3a32", "#c45a32", { power: 10, speed: 3, defense: 9, range: 2 }),
  locked("shai", "SHAI", "Olho Carmesim", "Zoner", "#5a1a1a", "#ff5a5a", { power: 6, speed: 6, defense: 4, range: 10 }),
  locked("brakk", "BRAKK", "Quebra-Ossos", "Charge", "#3a4a3a", "#8aca6a", { power: 8, speed: 4, defense: 8, range: 6 }),
  locked("mora", "MORA", "Feiticeira Cinzenta", "Trap", "#6a6a78", "#c8c8e0", { power: 5, speed: 7, defense: 4, range: 8 }),
];

export function getFighter(id: string): CharacterDef {
  const f = playable.find((p) => p.id === id);
  if (!f) throw new Error(`Lutador indisponível: ${id}`);
  return f;
}

export function isPlayable(entry: RosterEntry): entry is CharacterDef {
  return !("locked" in entry && entry.locked);
}
