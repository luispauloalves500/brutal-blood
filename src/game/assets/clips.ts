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
    columns: extra.columns ?? frames,
    src: extra.src,
  };
}

export function clipMap(list: AnimClip[]): Record<string, AnimClip> {
  return Object.fromEntries(list.map((c) => [c.name, c]));
}
