import type { StageAssetManifest } from "./types";

/** Backdrop/music src only when files exist under /stages/. */
export const STAGE_ASSETS: Record<string, StageAssetManifest> = {
  abandoned: { id: "abandoned", name: "Arena Abandonada" },
  temple: { id: "temple", name: "Templo Sangrento" },
  industrial: { id: "industrial", name: "Distrito Industrial" },
  forest: { id: "forest", name: "Floresta Profana" },
  cathedral: { id: "cathedral", name: "Catedral Negra" },
  fortress: { id: "fortress", name: "Fortaleza Final" },
};

export function getStageAssets(id: string): StageAssetManifest {
  return STAGE_ASSETS[id] ?? STAGE_ASSETS.abandoned;
}
