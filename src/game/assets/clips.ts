import type { AnimClip, AnimName } from "./types";

const NO_LOOP = new Set<AnimName>([
  "jumpStart", "hit", "hitHeavy", "knockdown", "wakeup", "victory",
  "super", "finish1", "finish2", "intro", "throw",
]);

/** Filename per clip under /fighters/<id>/. Dedicated files are optional. */
export const CLIP_FILES: Record<AnimName, string> = {
  idle: "idle.webp",
  walk: "walk.webp",
  walkBack: "walk-back.webp",
  dash: "dash.webp",
  jumpStart: "jump-start.webp",
  jump: "jump.webp",
  fall: "fall.webp",
  crouch: "crouch.webp",
  block: "block.webp",
  blockLow: "block-low.webp",
  light: "light.webp",
  medium: "medium.webp",
  heavy: "heavy.webp",
  kickLight: "kick-light.webp",
  kickHeavy: "kick-heavy.webp",
  aerial: "aerial.webp",
  throw: "throw.webp",
  special1: "special-1.webp",
  special2: "special-2.webp",
  special3: "special-3.webp",
  super: "super.webp",
  hit: "hit.webp",
  hitHeavy: "hit-heavy.webp",
  knockdown: "knockdown.webp",
  wakeup: "wakeup.webp",
  victory: "victory.webp",
  finish1: "finish-1.webp",
  finish2: "finish-2.webp",
  intro: "intro.webp",
  counter: "counter.webp",
  taunt: "taunt.webp",
};

export const FALLBACK_OF: Partial<Record<AnimName, AnimName>> = {
  walkBack: "walk",
  dash: "walk",
  jumpStart: "jump",
  fall: "jump",
  crouch: "idle",
  block: "idle",
  blockLow: "block",
  intro: "idle",
  taunt: "idle",
  victory: "idle",
  hitHeavy: "hit",
  knockdown: "hit",
  wakeup: "hit",
  medium: "light",
  heavy: "light",
  kickLight: "light",
  kickHeavy: "light",
  aerial: "light",
  throw: "light",
  special1: "light",
  special2: "light",
  special3: "light",
  super: "light",
  finish1: "super",
  finish2: "super",
  counter: "light",
};

export function clip(name: AnimName, frames: number, fps: number, extra: Partial<AnimClip> = {}): AnimClip {
  return {
    name,
    frames,
    fps,
    loop: extra.loop ?? !NO_LOOP.has(name),
    pivotX: extra.pivotX ?? 0.5,
    pivotY: extra.pivotY ?? 1,
    row: extra.row,
    rows: extra.rows,
    columns: extra.columns,
    src: extra.src,
    fallback: extra.fallback ?? FALLBACK_OF[name],
    fallbackSrc: extra.fallbackSrc,
    scale: extra.scale,
    offsetX: extra.offsetX,
    offsetY: extra.offsetY,
    reverseFrames: extra.reverseFrames ?? (name === "walkBack" ? true : undefined),
    frameMap: extra.frameMap,
    sheetFrames: extra.sheetFrames,
    sheetColumns: extra.sheetColumns,
    sheetRows: extra.sheetRows,
    sheetFps: extra.sheetFps,
  };
}

export function clipMap(list: AnimClip[]): Record<string, AnimClip> {
  return Object.fromEntries(list.map((c) => [c.name, c]));
}

export type SheetBind = {
  src: string;
  frames: number;
  columns: number;
  rows: number;
  fps?: number;
};

const GROUPS: Record<string, AnimName[]> = {
  idle: ["idle", "intro", "taunt", "victory", "block", "blockLow", "crouch"],
  walk: ["walk", "walkBack", "dash"],
  attack: ["light", "medium", "heavy", "kickLight", "kickHeavy", "aerial", "throw", "special1", "special2", "special3", "super", "finish1", "finish2", "counter"],
  hurt: ["hit", "hitHeavy", "knockdown", "wakeup"],
  jump: ["jump", "jumpStart", "fall"],
};

/**
 * Attach group WebP sheets as fallbackSrc.
 * Does not overwrite a dedicated clip.src — that is loaded separately when set.
 */
export function bindSheets(clips: Record<string, AnimClip>, sheets: Partial<Record<string, SheetBind>>) {
  for (const [group, names] of Object.entries(GROUPS)) {
    const sh = sheets[group];
    if (!sh) continue;
    for (const n of names) {
      const c = clips[n];
      if (!c) continue;
      c.fallbackSrc = sh.src;
      c.sheetFrames = sh.frames;
      c.sheetColumns = sh.columns;
      c.sheetRows = sh.rows;
      c.sheetFps = sh.fps;
      if (!c.fallback) c.fallback = FALLBACK_OF[n];
    }
  }
  return clips;
}

export function fighterSheets(id: string): Partial<Record<string, SheetBind>> {
  const p = `/fighters/${id}`;
  return {
    idle: { src: `${p}/idle.webp`, frames: 4, columns: 2, rows: 2, fps: 8 },
    walk: { src: `${p}/walk.webp`, frames: 6, columns: 3, rows: 2, fps: 10 },
    attack: { src: `${p}/attack.webp`, frames: 6, columns: 3, rows: 2, fps: 12 },
    hurt: { src: `${p}/hurt.webp`, frames: 4, columns: 2, rows: 2, fps: 10 },
    jump: { src: `${p}/jump.webp`, frames: 4, columns: 2, rows: 2, fps: 10 },
  };
}

export function dedicatedPath(id: string, name: AnimName) {
  return `/fighters/${id}/${CLIP_FILES[name]}`;
}
