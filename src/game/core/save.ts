import {
  DEFAULT_AUDIO,
  DEFAULT_BINDINGS,
  DEFAULT_GRAPHICS,
  GAME,
  QUALITY_PRESETS,
  type ActionName,
  type AudioSettings,
  type Difficulty,
  type GraphicsSettings,
  type QualityPreset,
} from "./config";

export type Bindings = Record<"p1" | "p2", Record<ActionName, string[]>>;

export type Stats = {
  wins: number;
  losses: number;
  kos: number;
  maxCombo: number;
  timePlayed: number;
};

export type SaveData = {
  version: number;
  graphics: GraphicsSettings;
  audio: AudioSettings;
  bindings: Bindings;
  difficulty: Difficulty;
  unlocked: string[];
  lastStage: string;
  rumble: boolean;
  stats: Record<string, Stats>;
  survivalBest: number;
  arcadeCleared: boolean;
  tournamentWon: boolean;
};

function emptyStats(): Stats {
  return { wins: 0, losses: 0, kos: 0, maxCombo: 0, timePlayed: 0 };
}

export function defaultSave(): SaveData {
  return {
    version: GAME.SAVE_VERSION,
    graphics: { ...DEFAULT_GRAPHICS },
    audio: { ...DEFAULT_AUDIO },
    bindings: structuredClone(DEFAULT_BINDINGS),
    difficulty: "normal",
    unlocked: ["kharon", "nyx", "draven"],
    lastStage: "abandoned",
    rumble: true,
    stats: { kharon: emptyStats(), nyx: emptyStats(), draven: emptyStats() },
    survivalBest: 0,
    arcadeCleared: false,
    tournamentWon: false,
  };
}

function migrate(raw: SaveData): SaveData {
  const base = defaultSave();
  const s = { ...base, ...raw };
  s.graphics = { ...base.graphics, ...(raw.graphics ?? {}) };
  s.audio = { ...base.audio, ...(raw.audio ?? {}) };
  s.bindings = {
    p1: { ...base.bindings.p1, ...(raw.bindings?.p1 ?? {}) },
    p2: { ...base.bindings.p2, ...(raw.bindings?.p2 ?? {}) },
  };
  s.stats = { ...base.stats, ...(raw.stats ?? {}) };
  s.version = GAME.SAVE_VERSION;
  return s;
}

export function loadSave(): SaveData {
  if (typeof window === "undefined") return defaultSave();
  try {
    const raw = localStorage.getItem(GAME.SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as SaveData;
    return migrate(parsed);
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData) {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ ...data, version: GAME.SAVE_VERSION });
    localStorage.setItem(GAME.SAVE_KEY, payload);
  } catch {
    /* private mode / quota */
  }
}

let cache: SaveData | null = null;

export function getSave(): SaveData {
  if (!cache) cache = loadSave();
  return cache;
}

export function patchSave(partial: Partial<SaveData>): SaveData {
  cache = { ...getSave(), ...partial, version: GAME.SAVE_VERSION };
  writeSave(cache);
  return cache;
}

export function applyPreset(preset: QualityPreset): GraphicsSettings {
  const next = { ...getSave().graphics, ...QUALITY_PRESETS[preset], preset };
  patchSave({ graphics: next });
  return next;
}

export function bumpStat(id: string, field: keyof Stats, amount = 1) {
  const save = getSave();
  const cur = save.stats[id] ?? emptyStats();
  const next = { ...cur, [field]: (cur[field] as number) + amount };
  patchSave({ stats: { ...save.stats, [id]: next } });
}

export function recordMaxCombo(id: string, combo: number) {
  const save = getSave();
  const cur = save.stats[id] ?? emptyStats();
  if (combo <= cur.maxCombo) return;
  patchSave({ stats: { ...save.stats, [id]: { ...cur, maxCombo: combo } } });
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && cache) writeSave(cache);
  });
}
