import { kharon } from "../characters/kharon";
import { nyx } from "../characters/nyx";
import { draven } from "../characters/draven";
import { vespera } from "../characters/vespera";
import { gorr } from "../characters/gorr";
import { shai } from "../characters/shai";
import { kharonAssets } from "../assets/characters/kharon";
import { nyxAssets } from "../assets/characters/nyx";
import { dravenAssets } from "../assets/characters/draven";
import { vesperaAssets } from "../assets/characters/vespera";
import { gorrAssets } from "../assets/characters/gorr";
import { shaiAssets } from "../assets/characters/shai";
import type { CharacterDef } from "../characters/types";
import type { CharacterAssetManifest } from "../assets/types";

export type FighterContent = {
  id: string;
  def: CharacterDef;
  assets: CharacterAssetManifest;
};

function fighter(def: CharacterDef, assets: CharacterAssetManifest): FighterContent {
  if (def.id !== assets.id) {
    throw new Error(`Content registry mismatch: ${def.id} != ${assets.id}`);
  }
  return { id: def.id, def, assets };
}

/**
 * Single source of truth for fighters that are actually playable in this build.
 * Adding a playable fighter here makes it available to gameplay and asset loading.
 * Progression/visibility remains data-driven in progression/rosterSlots.ts.
 */
export const FIGHTER_CONTENT: readonly FighterContent[] = [
  fighter(kharon, kharonAssets),
  fighter(nyx, nyxAssets),
  fighter(draven, dravenAssets),
  fighter(vespera, vesperaAssets),
  fighter(gorr, gorrAssets),
  fighter(shai, shaiAssets),
];

export const PLAYABLE_FIGHTERS: CharacterDef[] = FIGHTER_CONTENT.map((x) => x.def);
export const PLAYABLE_FIGHTER_IDS = FIGHTER_CONTENT.map((x) => x.id);

const BY_ID = new Map(FIGHTER_CONTENT.map((entry) => [entry.id, entry] as const));

export function getFighterContent(id: string): FighterContent | undefined {
  return BY_ID.get(id);
}

export function requireFighterContent(id: string): FighterContent {
  const entry = getFighterContent(id);
  if (!entry) throw new Error(`Lutador indisponível nesta build: ${id}`);
  return entry;
}
