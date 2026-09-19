import { clip, clipMap, bindSheets, fighterSheets, bindAvailableClips } from "../clips";
import { KHARON_PALETTES } from "../palettes";
import type { CharacterAssetManifest } from "../types";

const g2 = { columns: 2, rows: 2 } as const;
const atk = { columns: 2, rows: 2, frameMap: [0, 0, 1, 1, 2, 3] };

/**
 * Kharon dedicated clips. Group fallback remains for any clip not listed:
 * attack.webp / hurt.webp / jump.webp still ship as safety nets.
 * walkBack uses walk.webp reversed. blockLow falls back to block.
 */
export const kharonAssets: CharacterAssetManifest = bindAvailableClips({
  id: "kharon",
  portrait: "/fighters/kharon.webp",
  skin: "default",
  availableClips: [
    "idle", "walk", "dash", "crouch", "block",
    "light", "medium", "heavy", "kickLight", "kickHeavy", "aerial",
    "jumpStart", "jump", "fall",
    "hit", "hitHeavy", "knockdown", "wakeup",
    "throw", "special1", "special2", "special3", "super",
    "victory", "finish1", "finish2",
  ],
  palettes: KHARON_PALETTES,
  effects: [],
  audio: [],
  clips: bindSheets(clipMap([
    clip("idle", 4, 8, g2),
    clip("walk", 4, 10, g2),
    clip("walkBack", 4, 8, g2),
    clip("dash", 4, 14, g2),
    clip("jumpStart", 4, 12, g2),
    clip("jump", 4, 8, g2),
    clip("fall", 4, 8, g2),
    clip("crouch", 4, 8, { ...g2, loop: true }),
    clip("block", 4, 10, { ...g2, loop: true }),
    clip("blockLow", 4, 10),
    clip("light", 4, 14, atk),
    clip("medium", 4, 12, atk),
    clip("heavy", 4, 11, atk),
    clip("kickLight", 4, 12, atk),
    clip("kickHeavy", 4, 11, atk),
    clip("aerial", 4, 12, atk),
    clip("throw", 4, 10, atk),
    clip("special1", 4, 12, atk),
    clip("special2", 4, 12, atk),
    clip("special3", 4, 11, atk),
    clip("super", 4, 12, atk),
    clip("hit", 4, 10, g2),
    clip("hitHeavy", 4, 8, g2),
    clip("knockdown", 4, 8, g2),
    clip("wakeup", 4, 8, g2),
    clip("victory", 4, 8, g2),
    clip("finish1", 4, 10, atk),
    clip("finish2", 4, 10, atk),
    clip("intro", 4, 8),
    clip("counter", 4, 12),
    clip("taunt", 4, 6),
  ]), fighterSheets("kharon")),
});
