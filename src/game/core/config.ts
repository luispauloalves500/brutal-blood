/** Single global config. Never redeclare DEBUG or these constants in other files. */
export const GAME = {
  VERSION: "0.8",
  WIDTH: 1280,
  HEIGHT: 720,
  FPS: 60,
  FRAME: 1 / 60,
  MAX_DT: 0.1,
  FLOOR: 620,
  GRAVITY: 2200,
  ROUND_TIME: 99,
  WINS_NEEDED: 2,
  FINISH_WINDOW: 5,
  COMBO_DROP: 0.35,
  INPUT_BUFFER: 0.14,
  WAKEUP_INVULN: 12,
  CLASH_FRAMES: 8,
  TECH_FRAMES: 7,
  SAVE_KEY: "brutal-blood-save",
  SAVE_VERSION: 5,
} as const;

export const DEBUG = {
  enabled: false,
  hitboxes: false,
  frameData: false,
  sprites: false,
};

export type Difficulty =
  | "veryEasy"
  | "easy"
  | "normal"
  | "hard"
  | "brutal"
  | "nightmare";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  veryEasy: "Muito Fácil",
  easy: "Fácil",
  normal: "Normal",
  hard: "Difícil",
  brutal: "Brutal",
  nightmare: "Pesadelo",
};

export type QualityPreset = "low" | "medium" | "high" | "ultra";
export type AccelMode = "auto" | "on" | "off";
export type RendererKind = "webgpu" | "webgl" | "canvas2d";

export type GraphicsSettings = {
  preset: QualityPreset;
  accel: AccelMode;
  fullscreen: boolean;
  maxFps: 30 | 60 | 120 | 144;
  vsync: boolean;
  particles: boolean;
  effects: boolean;
  shadows: boolean;
  screenShake: boolean;
  hitstop: boolean;
  bloom: boolean;
  stageFx: boolean;
  debugSprites: boolean;
};

export type AudioSettings = {
  master: number;
  music: number;
  sfx: number;
  voice: number;
  ambient: number;
  ui: number;
  muted: boolean;
};

export const DEFAULT_GRAPHICS: GraphicsSettings = {
  preset: "high",
  accel: "auto",
  fullscreen: false,
  maxFps: 60,
  vsync: true,
  particles: true,
  effects: true,
  shadows: true,
  screenShake: true,
  hitstop: true,
  bloom: true,
  stageFx: true,
  debugSprites: false,
};

export const QUALITY_PRESETS: Record<QualityPreset, Partial<GraphicsSettings>> = {
  low: {
    preset: "low",
    particles: false,
    effects: false,
    shadows: false,
    screenShake: false,
    bloom: false,
    stageFx: false,
    maxFps: 30,
  },
  medium: {
    preset: "medium",
    particles: true,
    effects: true,
    shadows: false,
    screenShake: true,
    bloom: false,
    stageFx: true,
    maxFps: 60,
  },
  high: {
    preset: "high",
    particles: true,
    effects: true,
    shadows: true,
    screenShake: true,
    bloom: true,
    stageFx: true,
    maxFps: 60,
  },
  ultra: {
    preset: "ultra",
    particles: true,
    effects: true,
    shadows: true,
    screenShake: true,
    bloom: true,
    stageFx: true,
    maxFps: 120,
  },
};

export const DEFAULT_AUDIO: AudioSettings = {
  master: 0.8,
  music: 0.55,
  sfx: 0.8,
  voice: 0.7,
  ambient: 0.4,
  ui: 0.6,
  muted: false,
};

export type ActionName =
  | "left"
  | "right"
  | "up"
  | "down"
  | "light"
  | "medium"
  | "heavy"
  | "kickLight"
  | "kickHeavy"
  | "special"
  | "super"
  | "block"
  | "throw"
  | "taunt"
  | "pause";

export const ACTION_LABELS: Record<ActionName, string> = {
  left: "Esquerda",
  right: "Direita",
  up: "Pular",
  down: "Agachar",
  light: "Soco leve",
  medium: "Soco médio",
  heavy: "Soco pesado",
  kickLight: "Chute leve",
  kickHeavy: "Chute pesado",
  special: "Especial",
  super: "Super",
  block: "Defesa",
  throw: "Agarrão",
  taunt: "Provocação",
  pause: "Pausa",
};

export const DEFAULT_BINDINGS: Record<"p1" | "p2", Record<ActionName, string[]>> = {
  p1: {
    left: ["KeyA"],
    right: ["KeyD"],
    up: ["KeyW"],
    down: ["KeyS"],
    light: ["KeyJ"],
    medium: ["KeyU"],
    heavy: ["KeyK"],
    kickLight: ["KeyN"],
    kickHeavy: ["KeyM"],
    special: ["KeyL"],
    super: ["KeyO"],
    block: ["KeyI"],
    throw: ["Space"],
    taunt: ["KeyP"],
    pause: ["Escape"],
  },
  p2: {
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    light: ["Digit1", "Numpad1"],
    medium: ["Digit4", "Numpad4"],
    heavy: ["Digit2", "Numpad2"],
    kickLight: ["Digit5", "Numpad5"],
    kickHeavy: ["Digit6", "Numpad6"],
    special: ["Digit3", "Numpad3"],
    super: ["Digit9", "Numpad9"],
    block: ["Digit0", "Numpad0"],
    throw: ["Digit7", "Numpad7"],
    taunt: ["Digit8", "Numpad8"],
    pause: [],
  },
};

export const GAMEPAD_DEFAULT: Record<ActionName, { buttons?: number[]; axes?: "lx-" | "lx+" | "ly-" | "ly+" | "dx" | "dy" } > = {
  left: { buttons: [14], axes: "lx-" },
  right: { buttons: [15], axes: "lx+" },
  up: { buttons: [12], axes: "ly-" },
  down: { buttons: [13], axes: "ly+" },
  light: { buttons: [2] },
  medium: { buttons: [3] },
  heavy: { buttons: [1] },
  kickLight: { buttons: [0] },
  kickHeavy: { buttons: [5] },
  special: { buttons: [4] },
  super: { buttons: [7] },
  block: { buttons: [6] },
  throw: { buttons: [10] },
  taunt: { buttons: [11] },
  pause: { buttons: [9] },
};
