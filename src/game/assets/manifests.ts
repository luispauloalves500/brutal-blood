import { getFighterContent } from "../content/registry";
import type { CharacterAssetManifest } from "./types";

export function getCharacterAssets(id: string): CharacterAssetManifest {
  const found = getFighterContent(id);
  if (found) return found.assets;
  const fallback = getFighterContent("kharon");
  if (!fallback) throw new Error("Kharon asset fallback missing from content registry");
  return fallback.assets;
}
