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
import type { CharacterProgress } from "../progression/types";
import { INITIAL_IDS } from "../progression/rosterSlots";

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
  storyCleared: string[];
  unlockedCharacters: string[];
  revealedCharacters: string[];
  arcadeClears: string[];
  noContinueClears: string[];
  highestDifficultyClear: Difficulty | null;
  bloodFinishCount: number;
  secretFightsWon: string[];
  secretFightsLost: string[];
  perfectWins: number;
  characterProgress: Record<string, CharacterProgress>;
  pendingUnlocks: string[];
  seenUnlockCinematics: string[];
  grantedRewards: string[];
  pendingRewards: string[];
  seenRewardCinematics: string[];
  equippedTitle: string | null;
  equippedPalettes: Record<string, string>;
};

function emptyStats(): Stats {
  return { wins: 0, losses: 0, kos: 0, maxCombo: 0, timePlayed: 0 };
}

export function emptyCharacterProgress(): CharacterProgress {
  return {
    arcadeCleared: false,
    storyCleared: false,
    highestDifficulty: null,
    wins: 0,
    losses: 0,
    kos: 0,
    maxCombo: 0,
    timePlayed: 0,
    bloodFinishes: 0,
    perfects: 0,
    clears: 0,
  };
}

export function defaultSave(): SaveData {
  const initials = [...INITIAL_IDS];
  return {
    version: GAME.SAVE_VERSION,
    graphics: { ...DEFAULT_GRAPHICS },
    audio: { ...DEFAULT_AUDIO },
    bindings: structuredClone(DEFAULT_BINDINGS),
    difficulty: "normal",
    unlocked: initials,
    lastStage: "abandoned",
    rumble: true,
    stats: { kharon: emptyStats(), nyx: emptyStats(), draven: emptyStats(), vespera: emptyStats() },
    survivalBest: 0,
    arcadeCleared: false,
    tournamentWon: false,
    storyCleared: [],
    unlockedCharacters: initials,
    revealedCharacters: [],
    arcadeClears: [],
    noContinueClears: [],
    highestDifficultyClear: null,
    bloodFinishCount: 0,
    secretFightsWon: [],
    secretFightsLost: [],
    perfectWins: 0,
    characterProgress: {},
    pendingUnlocks: [],
    seenUnlockCinematics: [],
    grantedRewards: [],
    pendingRewards: [],
    seenRewardCinematics: [],
    equippedTitle: null,
    equippedPalettes: {},
  };
}

function migrate(raw: SaveData): SaveData {
  const base = defaultSave();
  const s: SaveData = { ...base, ...raw };
  s.graphics = { ...base.graphics, ...(raw.graphics ?? {}) };
  s.audio = { ...base.audio, ...(raw.audio ?? {}) };
  s.bindings = {
    p1: { ...base.bindings.p1, ...(raw.bindings?.p1 ?? {}) },
    p2: { ...base.bindings.p2, ...(raw.bindings?.p2 ?? {}) },
  };
  s.stats = { ...base.stats, ...(raw.stats ?? {}) };
  const unlocked = Array.from(new Set([
    ...INITIAL_IDS,
    ...(raw.unlocked ?? []),
    ...(raw.unlockedCharacters ?? []),
  ]));
  s.unlocked = unlocked;
  s.unlockedCharacters = unlocked;
  s.revealedCharacters = Array.from(new Set(raw.revealedCharacters ?? []));
  s.arcadeClears = Array.from(new Set(raw.arcadeClears ?? []));
  s.noContinueClears = Array.from(new Set(raw.noContinueClears ?? []));
  s.highestDifficultyClear = raw.highestDifficultyClear ?? null;
  s.bloodFinishCount = raw.bloodFinishCount ?? 0;
  s.secretFightsWon = Array.from(new Set(raw.secretFightsWon ?? []));
  s.secretFightsLost = Array.from(new Set(raw.secretFightsLost ?? []));
  s.perfectWins = raw.perfectWins ?? 0;
  s.characterProgress = { ...(raw.characterProgress ?? {}) };
  for (const [id, st] of Object.entries(s.stats)) {
    const cur = s.characterProgress[id] ?? emptyCharacterProgress();
    s.characterProgress[id] = {
      ...cur,
      wins: Math.max(cur.wins, st.wins ?? 0),
      losses: Math.max(cur.losses, st.losses ?? 0),
      kos: Math.max(cur.kos, st.kos ?? 0),
      maxCombo: Math.max(cur.maxCombo, st.maxCombo ?? 0),
      timePlayed: Math.max(cur.timePlayed, st.timePlayed ?? 0),
      storyCleared: cur.storyCleared || (raw.storyCleared ?? []).includes(id),
    };
  }
  s.pendingUnlocks = raw.pendingUnlocks ?? [];
  s.seenUnlockCinematics = raw.seenUnlockCinematics ?? [];
  s.grantedRewards = raw.grantedRewards ?? [];
  s.pendingRewards = raw.pendingRewards ?? [];
  s.seenRewardCinematics = raw.seenRewardCinematics ?? [];
  s.equippedTitle = raw.equippedTitle ?? null;
  s.equippedPalettes = { ...(raw.equippedPalettes ?? {}) };
  s.storyCleared = Array.from(new Set(raw.storyCleared ?? []));
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
  const prog = save.characterProgress[id] ?? emptyCharacterProgress();
  const mapped = field === "wins" || field === "losses" || field === "kos" || field === "maxCombo" || field === "timePlayed" ? field : null;
  patchSave({
    stats: { ...save.stats, [id]: next },
    characterProgress: mapped ? { ...save.characterProgress, [id]: { ...prog, [mapped]: (prog[mapped] as number) + amount } } : save.characterProgress,
  });
}

export function recordMaxCombo(id: string, combo: number) {
  const save = getSave();
  const cur = save.stats[id] ?? emptyStats();
  if (combo <= cur.maxCombo) return;
  const prog = save.characterProgress[id] ?? emptyCharacterProgress();
  patchSave({
    stats: { ...save.stats, [id]: { ...cur, maxCombo: combo } },
    characterProgress: { ...save.characterProgress, [id]: { ...prog, maxCombo: Math.max(prog.maxCombo, combo) } },
  });
}

if (typeof window !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && cache) writeSave(cache);
  });
}
