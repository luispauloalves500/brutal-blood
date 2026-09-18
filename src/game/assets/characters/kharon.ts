import { clip, clipMap, bindSheets, fighterSheets, bindAvailableClips, SHIPPED_CLIPS } from "../clips";
import { KHARON_PALETTES } from "../palettes";
import type { CharacterAssetManifest } from "../types";

/**
 * Kharon pilot. To enable a dedicated sheet: drop the WebP in
 * public/fighters/kharon/ and add the clip name to availableClips.
 * Future names: walkBack dash jumpStart fall crouch block blockLow
 * light medium heavy kickLight kickHeavy aerial throw
 * special1 special2 special3 super hit hitHeavy knockdown wakeup
 * intro taunt victory finish1 finish2 counter
 */
export const kharonAssets: CharacterAssetManifest = bindAvailableClips({
  id: "kharon",
  portrait: "/fighters/kharon.webp",
  skin: "default",
  availableClips: [...SHIPPED_CLIPS],
  palettes: KHARON_PALETTES,
  effects: [],
  audio: [],
  clips: bindSheets(clipMap([
    clip("idle", 8, 8),
    clip("walk", 8, 10),
    clip("walkBack", 8, 8),
    clip("dash", 6, 14),
    clip("jumpStart", 3, 12),
    clip("jump", 4, 8),
    clip("fall", 3, 8),
    clip("crouch", 3, 8),
    clip("block", 3, 10),
    clip("blockLow", 3, 10),
    clip("light", 5, 14),
    clip("medium", 6, 12),
    clip("heavy", 8, 11),
    clip("kickLight", 6, 12),
    clip("kickHeavy", 6, 11),
    clip("aerial", 6, 12),
    clip("throw", 8, 10),
    clip("special1", 10, 12),
    clip("special2", 10, 12),
    clip("special3", 12, 11),
    clip("super", 20, 12),
    clip("hit", 3, 10),
    clip("hitHeavy", 5, 8),
    clip("knockdown", 7, 8),
    clip("wakeup", 6, 8),
    clip("victory", 10, 8),
    clip("finish1", 20, 10),
    clip("finish2", 20, 10),
    clip("intro", 8, 8),
    clip("counter", 6, 12),
    clip("taunt", 8, 6),
  ]), fighterSheets("kharon")),
});
