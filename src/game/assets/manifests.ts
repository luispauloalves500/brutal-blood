import { kharonAssets } from "./characters/kharon";
import { nyxAssets } from "./characters/nyx";
import { dravenAssets } from "./characters/draven";
import { vesperaAssets } from "./characters/vespera";
import type { CharacterAssetManifest } from "./types";

const ALL: Record<string, CharacterAssetManifest> = {
  kharon: kharonAssets,
  nyx: nyxAssets,
  draven: dravenAssets,
  vespera: vesperaAssets,
};

export function getCharacterAssets(id: string): CharacterAssetManifest {
  return ALL[id] ?? kharonAssets;
}
