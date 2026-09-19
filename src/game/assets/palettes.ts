import type { PaletteDef } from "./types";

export type { PaletteDef };
export const DEFAULT_PALETTES: PaletteDef[] = [
  { id: "default", hue: 0, saturate: 1, brightness: 1 },
  { id: "alternate", hue: 200, saturate: 0.9, brightness: 1.08 },
];

/** Base palettes only. Extra colors come from the rewards catalog when granted. */
export const KHARON_PALETTES: PaletteDef[] = [
  { id: "default", hue: 0, saturate: 1, brightness: 1 },
  { id: "alternate", hue: 205, saturate: 0.82, brightness: 1.12 },
];

export const NYX_PALETTES: PaletteDef[] = [
  { id: "default", hue: 0, saturate: 1, brightness: 1 },
  { id: "alternate", hue: 150, saturate: 0.95, brightness: 1.06 },
];

export const DRAVEN_PALETTES: PaletteDef[] = [
  { id: "default", hue: 0, saturate: 1, brightness: 1 },
  { id: "alternate", hue: 95, saturate: 0.85, brightness: 1.1 },
];

export const VESPERA_PALETTES: PaletteDef[] = [
  { id: "default", hue: 0, saturate: 1, brightness: 1 },
  { id: "alternate", hue: 42, saturate: 1.05, brightness: 1.12 },
];

export function paletteAt(list: PaletteDef[] | undefined, index: number): PaletteDef {
  const l = list && list.length ? list : DEFAULT_PALETTES;
  const i = ((index % l.length) + l.length) % l.length;
  return l[i]!;
}

export function isIdentityPalette(p: PaletteDef) {
  return p.hue === 0 && p.saturate === 1 && p.brightness === 1;
}

export function paletteFilter(p: PaletteDef) {
  if (isIdentityPalette(p)) return "none";
  return `hue-rotate(${p.hue}deg) saturate(${p.saturate}) brightness(${p.brightness})`;
}
