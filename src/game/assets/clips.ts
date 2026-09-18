import type { AnimClip, AnimName } from "./types";

const NO_LOOP = new Set<AnimName>([
  "jumpStart", "hit", "hitHeavy", "knockdown", "wakeup", "victory",
  "super", "finish1", "finish2", "intro", "throw",
]);

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

/** Attach real WebP sheets to clips. Missing groups stay as canvas fallback. */
export function bindSheets(clips: Record<string, AnimClip>, sheets: Partial<Record<string, SheetBind>>) {
  for (const [group, names] of Object.entries(GROUPS)) {
    const sh = sheets[group];
    if (!sh) continue;
    for (const n of names) {
      const c = clips[n];
      if (!c) continue;
      c.src = sh.src;
      c.frames = sh.frames;
      c.columns = sh.columns;
      c.rows = sh.rows;
      if (sh.fps) c.fps = sh.fps;
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
