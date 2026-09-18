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
  /** Dedicated sheet when the file exists and was loaded. */
  src?: string;
  /** Next clip name if dedicated src is missing. */
  fallback?: AnimName;
  /** Group sheet used when dedicated src is not in cache (idle/walk/attack/hurt/jump). */
  fallbackSrc?: string;
  frames: number;
  fps: number;
  loop: boolean;
  /** Origin inside the frame, 0–1. Default feet-center (0.5, 1). */
  pivotX: number;
  pivotY: number;
  row?: number;
  rows?: number;
  columns?: number;
  /** Visual-only. Never touches hitboxes. */
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  reverseFrames?: boolean;
  /** Optional remap of attackFrame → sheet frame. */
  frameMap?: number[];
  /** Layout of fallbackSrc (group sheet). Used only when drawing the fallback image. */
  sheetFrames?: number;
  sheetColumns?: number;
  sheetRows?: number;
  sheetFps?: number;
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
  effects?: string[];
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
  cached: number;
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
  audio: Map<string, AudioBuffer>;
  /** URLs this pack acquired (one ref each). Unique even if P1===P2. */
  keys: string[];
  failed: { url: string; error: string }[];
  criticalFailed: { url: string; error: string }[];
  released?: boolean;
};
