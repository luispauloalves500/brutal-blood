export type AnimName =
  | "idle"
  | "walk"
  | "walkBack"
  | "dash"
  | "jumpStart"
  | "jump"
  | "fall"
  | "crouch"
  | "block"
  | "blockLow"
  | "light"
  | "medium"
  | "heavy"
  | "kickLight"
  | "kickHeavy"
  | "aerial"
  | "throw"
  | "special1"
  | "special2"
  | "special3"
  | "super"
  | "hit"
  | "hitHeavy"
  | "knockdown"
  | "wakeup"
  | "victory"
  | "finish1"
  | "finish2"
  | "intro"
  | "counter"
  | "taunt";

/** Visual clip. Combat hitboxes stay on Fighter — never derived from frame size. */
export type AnimClip = {
  name: AnimName;
  /** Set only when the WebP actually exists. Missing src → canvas placeholder. */
  src?: string;
  frames: number;
  fps: number;
  loop: boolean;
  /** Origin inside the frame, 0–1. Default feet-center (0.5, 1). */
  pivotX: number;
  pivotY: number;
  row?: number;
  rows?: number;
  columns?: number;
};

export type CharacterAssetManifest = {
  id: string;
  portrait?: string;
  effects: string[];
  audio: string[];
  clips: Record<string, AnimClip>;
};

export type StageAssetManifest = {
  id: string;
  name: string;
  backdrop?: string;
  music?: string;
};

export type AssetKind = "portrait" | "sheet" | "stage" | "effect" | "audio" | "ui";

export type AssetJob = {
  key: string;
  url: string;
  kind: AssetKind;
  critical: boolean;
};

export type LoadProgress = {
  loaded: number;
  total: number;
  percent: number;
  current: string;
  failed: { url: string; error: string }[];
};

export type CharacterSpritePack = {
  id: string;
  clips: Record<string, AnimClip>;
  images: Map<string, CanvasImageSource>;
};

export type FightAssetPack = {
  p1: CharacterSpritePack;
  p2: CharacterSpritePack;
  stageImages: Map<string, CanvasImageSource>;
  keys: string[];
  failed: { url: string; error: string }[];
};
