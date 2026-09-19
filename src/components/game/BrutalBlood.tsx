import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ImageIcon,
  Keyboard,
  Pause,
  Settings,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { GAME, DIFFICULTY_LABELS, ACTION_LABELS, DEFAULT_BINDINGS, DEFAULT_AUDIO, DEFAULT_GRAPHICS, QUALITY_PRESETS, type ActionName, type Difficulty, type QualityPreset } from "@/game/core/config";
import { detectRenderer, recommendQuality } from "@/game/core/graphics";
import { getSave, patchSave, bumpStat, recordMaxCombo, type Bindings } from "@/game/core/save";
import { isPlayable, playable, standInFighter } from "@/game/characters/roster";
import type { CharacterDef, RosterEntry } from "@/game/characters/types";
import {
  canSelect,
  visibleSlots,
  slotVisibility,
  hintFor,
  slotById,
  progressSnapshot,
  recordArcadeClear,
  recordStoryClear,
  recordBloodFinish,
  recordPerfect,
  recordSecretFight,
  consumeUnlockCinematic,
  consumeRewardCinematic,
  rewardById,
  REWARD_KIND_LABELS,
  grantedOfKind,
  availablePalettes,
  equipTitle,
  equippedTitleName,
  equipPalette,
  equippedPalette,
  flushRewards,
  catalogByKind,
  rewardHint,
  hasReward,
  debugUnlockAll,
  debugLockAll,
  debugSimulateArcade,
  type SecretFightDef,
} from "@/game/progression";
import { Input } from "@/game/input/Input";
import { AudioManager } from "@/game/audio/AudioManager";
import { Game } from "@/game/Game";
import { loadFightAssets, collectFightJobs, releaseFightAssets, type FightAssetPack, type LoadProgress } from "@/game/assets";
import { commandLabel } from "@/game/combat/commands";
import { defaultHitstopFrames } from "@/game/combat/hitstop";
import { moveTags, onBlockAdv, onHitAdv, signed } from "@/game/combat/frameData";
import type { HudSnap, MatchMode, TrainingOpts } from "@/game/combat/Match";
import { STAGES } from "@/game/graphics/stages";
import { ARCADE_CONTINUES, ARCADE_LADDER, arcadeOpponent, buildBracket, healCarry, survivalDifficulty, survivalOpponent, survivalStage, type TourneyBracket } from "@/game/modes/runs";
import { getStory, hasStory, storyOpponent, type StoryCampaign } from "@/game/modes/story";
import { HUD } from "./HUD";
import { TouchControls } from "./TouchControls";

type Screen =
  | "boot"
  | "menu"
  | "select"
  | "settings"
  | "controls"
  | "credits"
  | "characters"
  | "gallery"
  | "progress"
  | "rewards"
  | "fight"
  | "loading";

type FightResults = {
  won: boolean;
  title: string;
  subtitle: string;
  maxCombo: number;
  health: number;
  meter: number;
  superMeter: number;
  next?: "arcade" | "survival" | "continue" | "tournament" | "story" | "progress" | null;
};

const MENU: { id: string; label: string; action: Screen | "arcade" | "versus" | "training" | "survival" | "tournament" | "story" | "soon"; soon?: boolean; icon: typeof Swords }[] = [
  { id: "story", label: "História", action: "story", icon: BookOpen },
  { id: "arcade", label: "Arcade", action: "arcade", icon: Swords },
  { id: "versus", label: "Versus", action: "versus", icon: Users },
  { id: "training", label: "Treino", action: "training", icon: Swords },
  { id: "survival", label: "Survival", action: "survival", icon: Swords },
  { id: "tourney", label: "Torneio", action: "tournament", icon: Trophy },
  { id: "chars", label: "Personagens", action: "characters", icon: Users },
  { id: "progress", label: "Progresso", action: "progress", icon: Trophy },
  { id: "rewards", label: "Recompensas", action: "rewards", icon: Trophy },
  { id: "gallery", label: "Galeria", action: "gallery", icon: ImageIcon },
  { id: "settings", label: "Configurações", action: "settings", icon: Settings },
  { id: "credits", label: "Créditos", action: "credits", icon: BookOpen },
];

export function BrutalBlood() {
  const [screen, setScreen] = useState<Screen>("boot");
  const [mode, setMode] = useState<MatchMode>("arcade");
  const [p1, setP1] = useState<CharacterDef | null>(null);
  const [p2, setP2] = useState<CharacterDef | null>(null);
  const [pickSlot, setPickSlot] = useState<1 | 2>(1);
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [stageId, setStageId] = useState("abandoned");
  const [soon, setSoon] = useState<string | null>(null);
  const [hud, setHud] = useState<HudSnap | null>(null);
  const [paused, setPaused] = useState(false);
  const [pauseView, setPauseView] = useState<"root" | "moves" | "settings">("root");
  const [gfx, setGfx] = useState(DEFAULT_GRAPHICS);
  const [audioS, setAudioS] = useState(DEFAULT_AUDIO);
  const [bindings, setBindings] = useState<Bindings>(DEFAULT_BINDINGS);
  const [rumble, setRumble] = useState(true);
  const [remap, setRemap] = useState<{ slot: "p1" | "p2"; action: ActionName } | null>(null);
  const [training, setTraining] = useState<TrainingOpts>({ infiniteHp: true, infiniteMeter: true, showHitboxes: false, showFrameData: true, cpu: "stand", previewClip: "" });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const inputRef = useRef<Input | null>(null);
  const audioRef = useRef<AudioManager | null>(null);
  const [renderer, setRenderer] = useState("canvas2d");
  const [rec, setRec] = useState<QualityPreset>("high");
  const [toast, setToast] = useState<string | null>(null);
  const [arcadeIndex, setArcadeIndex] = useState(0);
  const [arcadeContinues, setArcadeContinues] = useState(ARCADE_CONTINUES);
  const [wave, setWave] = useState(1);
  const [survivalBest, setSurvivalBest] = useState(0);
  const [results, setResults] = useState<FightResults | null>(null);
  const [bracket, setBracket] = useState<TourneyBracket | null>(null);
  const [storyCard, setStoryCard] = useState<{ campaign: StoryCampaign; index: number } | null>(null);
  const [storyCleared, setStoryCleared] = useState<string[]>([]);
  const [unlockQueue, setUnlockQueue] = useState<string[]>([]);
  const [rewardQueue, setRewardQueue] = useState<string[]>([]);
  const [p1Palette, setP1Palette] = useState("default");
  const [secretOffer, setSecretOffer] = useState<SecretFightDef | null>(null);
  const [secretActive, setSecretActive] = useState<SecretFightDef | null>(null);
  const secretRef = useRef<SecretFightDef | null>(null);
  const [saveTick, setSaveTick] = useState(0);
  const bumpSave = () => setSaveTick((n) => n + 1);
  const [loadProg, setLoadProg] = useState<LoadProgress>({ loaded: 0, total: 1, percent: 0, current: "", failed: [], cached: 0 });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadHint, setLoadHint] = useState("");
  const packRef = useRef<FightAssetPack | null>(null);
  const loadAbort = useRef<AbortController | null>(null);
  const pendingFight = useRef<{
    p1: CharacterDef;
    p2: CharacterDef;
    difficulty: Difficulty;
    stageId: string;
    winsNeeded: number;
    runLabel: string;
    carry?: { health: number; meter: number; superMeter: number };
    p1Palette?: string;
  } | null>(null);
  const runRef = useRef({
    arcadeIndex: 0,
    continues: ARCADE_CONTINUES,
    continuesUsed: 0,
    campaignDifficulty: "normal" as Difficulty,
    wave: 1,
    storyIndex: 0,
    tourney: null as { round: "semi" | "final"; bracket: TourneyBracket } | null,
  });

  useEffect(() => {
    const saved = getSave();
    setGfx(saved.graphics);
    setAudioS(saved.audio);
    setBindings(saved.bindings);
    setDifficulty(saved.difficulty);
    setStageId(saved.lastStage);
    setRumble(saved.rumble);
    setSurvivalBest(saved.survivalBest);
    setStoryCleared(saved.storyCleared ?? []);
    flushRewards();
    const after = getSave();
    setUnlockQueue(after.pendingUnlocks ?? []);
    setRewardQueue(after.pendingRewards ?? []);
    const input = new Input(structuredClone(saved.bindings));
    input.rumble = saved.rumble;
    input.attach();
    input.onRemap = (code) => {
      setRemap(null);
      const b = input.bindings;
      setBindings(structuredClone(b));
      patchSave({ bindings: structuredClone(b) });
      setToast(`Remapeado: ${code}`);
    };
    inputRef.current = input;
    const audio = new AudioManager(saved.audio);
    audioRef.current = audio;
    setRenderer(detectRenderer(saved.graphics.accel));
    setRec(recommendQuality());
    const vis = () => audio.resume();
    document.addEventListener("visibilitychange", vis);
    return () => {
      input.detach();
      audio.dispose();
      document.removeEventListener("visibilitychange", vis);
      gameRef.current?.destroy();
    };
  }, []);

  const unlock = () => {
    audioRef.current?.unlock();
    audioRef.current?.startMusic();
    audioRef.current?.uiConfirm();
    setScreen("menu");
  };

  const openMode = (m: MatchMode) => {
    audioRef.current?.uiConfirm();
    setMode(m);
    setP1(null);
    setP2(null);
    setPickSlot(1);
    setArcadeIndex(0);
    setArcadeContinues(ARCADE_CONTINUES);
    setWave(1);
    runRef.current = { arcadeIndex: 0, continues: ARCADE_CONTINUES, continuesUsed: 0, campaignDifficulty: difficulty, wave: 1, storyIndex: 0, tourney: null };
    setSecretOffer(null);
    setSecretActive(null);
    setUnlockQueue([]);
    setRewardQueue([]);
    setBracket(null);
    setStoryCard(null);
    setResults(null);
    setScreen("select");
  };

  const selectFighter = (entry: RosterEntry) => {
    if (!isPlayable(entry) || !canSelect(entry.id, getSave())) return;
    if (mode === "story" && !hasStory(entry.id)) return;
    audioRef.current?.uiMove();
    if (mode === "versus") {
      if (pickSlot === 1) {
        setP1(entry);
        setP1Palette(equippedPalette(entry.id));
        setPickSlot(2);
      } else {
        setP2(entry);
      }
    } else {
      setP1(entry);
      setP1Palette(equippedPalette(entry.id));
      const other = playable.find((f) => f.id !== entry.id) ?? playable[0];
      setP2(other);
      if (mode === "tournament") {
        const b = buildBracket(entry);
        setBracket(b);
        runRef.current.tourney = { round: "semi", bracket: b };
        setP2(b.semiOpp);
      }
      if (mode === "story") {
        runRef.current.storyIndex = 0;
        const beat = getStory(entry.id).beats[0];
        setP2(beat ? storyOpponent(entry, beat.opponentId) : other);
      }
    }
  };

  const startFight = (override?: { arcadeIndex?: number; wave?: number; carry?: { health: number; meter: number; superMeter: number } }) => {
    if (!p1 || !canvasRef.current || !inputRef.current || !audioRef.current) return;
    const idx = override?.arcadeIndex ?? runRef.current.arcadeIndex;
    const wv = override?.wave ?? runRef.current.wave;
    runRef.current.arcadeIndex = idx;
    runRef.current.wave = wv;
    let foe = p2;
    let diff = difficulty;
    let stage = stageId;
    let label = "";
    let winsNeeded = 2;
    const secret = secretRef.current ?? secretActive;
    if (secret) {
      foe = standInFighter(secret.standInId, secret.displayName, secret.displayTitle, "#a07040");
      diff = secret.difficulty;
      stage = secret.stageId;
      label = secret.intro;
    } else if (mode === "arcade") {
      const fight = ARCADE_LADDER[idx] ?? ARCADE_LADDER[0];
      foe = arcadeOpponent(p1, fight, idx);
      diff = fight.difficulty;
      stage = fight.stageId;
      label = `${fight.label}  ${idx + 1}/${ARCADE_LADDER.length}`;
    } else if (mode === "survival") {
      foe = survivalOpponent(p1, wv);
      diff = survivalDifficulty(wv);
      stage = survivalStage(wv);
      label = `ONDA ${wv}`;
      winsNeeded = 1;
    } else if (mode === "tournament") {
      const t = runRef.current.tourney ?? (p1 ? { round: "semi" as const, bracket: buildBracket(p1) } : null);
      if (t) runRef.current.tourney = t;
      foe = t ? (t.round === "final" ? t.bracket.finalOpp : t.bracket.semiOpp) : foe;
      diff = t?.round === "final" ? "brutal" : "hard";
      stage = t?.round === "final" ? "fortress" : "cathedral";
      label = t?.round === "final" ? "FINAL" : "SEMI";
    } else if (mode === "story") {
      const camp = getStory(p1.id);
      const i = runRef.current.storyIndex;
      const beat = camp.beats[i] ?? camp.beats[0];
      foe = storyOpponent(p1, beat.opponentId);
      diff = beat.difficulty;
      stage = beat.stageId;
      label = `${beat.chapter}  ${i + 1}/${camp.beats.length}`;
    }
    setStoryCard(null);
    if (!foe) return;
    setP2(foe);
    setDifficulty(diff);
    setStageId(stage);
    audioRef.current.stopMusic();
    audioRef.current.uiConfirm();
    gameRef.current?.destroy();
    gameRef.current = null;
    patchSave({ difficulty: diff, lastStage: stage });
    setResults(null);
    pendingFight.current = {
      p1, p2: foe, difficulty: diff, stageId: stage, winsNeeded, runLabel: label, carry: override?.carry, p1Palette,
    };
    setLoadHint(p1.introLine || foe.introLine || "O sangue espera.");
    setLoadError(null);
    setLoadProg({ loaded: 0, total: Math.max(1, collectFightJobs({ p1: p1.id, p2: foe.id, stage }).length), percent: 0, current: "", failed: [], cached: 0 });
    setScreen("loading");
    void runLoad();
  };

  const runLoad = async () => {
    const pending = pendingFight.current;
    if (!pending) return;
    loadAbort.current?.abort();
    const ac = new AbortController();
    loadAbort.current = ac;
    try {
      const pack = await loadFightAssets(
        { p1: pending.p1.id, p2: pending.p2.id, stage: pending.stageId },
        {
          signal: ac.signal,
          onProgress: setLoadProg,
          audioContext: audioRef.current?.context() ?? null,
        },
      );
      if (ac.signal.aborted) {
        releaseFightAssets(pack);
        return;
      }
      if (packRef.current && packRef.current !== pack) {
        releaseFightAssets(packRef.current);
      }
      packRef.current = pack;
      launchMatch(pending, pack);
    } catch (e) {
      if (ac.signal.aborted) return;
      setLoadError(e instanceof Error ? e.message : "Falha ao carregar");
    }
  };

  const launchMatch = (pending: NonNullable<typeof pendingFight.current>, pack: FightAssetPack) => {
    if (!canvasRef.current || !inputRef.current || !audioRef.current) return;
    const game = new Game({
      canvas: canvasRef.current,
      p1: pending.p1,
      p2: pending.p2,
      mode,
      difficulty: pending.difficulty,
      stageId: pending.stageId,
      input: inputRef.current,
      audio: audioRef.current,
      winsNeeded: pending.winsNeeded,
      runLabel: pending.runLabel,
      carry: pending.carry,
      assets: pack,
      p1Palette: pending.p1Palette,
      onHUD: setHud,
      onMatchEnd: (won) => finishMatch(won),
      onPause: (v) => {
        setPaused(v);
        setPauseView("root");
      },
    });
    if (mode === "training") game.setTraining(training);
    gameRef.current = game;
    game.start();
    setScreen("fight");
    setPaused(false);
  };

  const finishMatch = (won: boolean) => {
    const match = gameRef.current?.match;
    if (!p1 || !match) {
      quitTo("menu");
      return;
    }
    const combo = Math.max(match.p1.maxCombo, match.p2.maxCombo);
    bumpStat(p1.id, won ? "wins" : "losses");
    if (p2) bumpStat(p2.id, won ? "losses" : "wins");
    recordMaxCombo(p1.id, combo);
    if (match.bloodFinishDone) recordBloodFinish(p1.id);
    for (let i = 0; i < match.perfectCount; i++) recordPerfect(p1.id);
    bumpSave();
    const pull = () => {
      const s = getSave();
      setUnlockQueue(s.pendingUnlocks ?? []);
      setRewardQueue(s.pendingRewards ?? []);
      return (s.pendingUnlocks?.length ?? 0) + (s.pendingRewards?.length ?? 0);
    };
    const snap = {
      maxCombo: combo,
      health: match.p1.health,
      meter: match.p1.meter,
      superMeter: match.p1.superMeter,
    };
    const secret = secretRef.current ?? secretActive;
    if (secret) {
      const out = recordSecretFight(secret.id, won);
      bumpSave();
      secretRef.current = null;
      setSecretActive(null);
      setSecretOffer(null);
      setUnlockQueue(out.unlocks);
      setRewardQueue(out.rewards);
      setResults({
        won,
        title: won ? secret.displayName : "DERROTA",
        subtitle: won ? secret.winLine : secret.loseLine,
        ...snap,
        next: (out.unlocks.length + out.rewards.length) ? "progress" : null,
      });
      return;
    }
    if (mode === "arcade") {
      const idx = runRef.current.arcadeIndex;
      const continues = runRef.current.continues;
      if (won) {
        const last = idx >= ARCADE_LADDER.length - 1;
        if (last) {
          const out = recordArcadeClear(p1.id, {
            difficulty: runRef.current.campaignDifficulty,
            noContinue: runRef.current.continuesUsed === 0,
          });
          bumpSave();
          pull();
          setSecretOffer(out.secretFight);
          setResults({ won: true, title: "ARCADE CLEAR", subtitle: "O chefe caiu. O sangue é seu.", ...snap, next: "progress" });
        } else {
          const nxt = ARCADE_LADDER[idx + 1];
          setResults({ won: true, title: "VITÓRIA", subtitle: `Próximo: ${nxt.label} — ${DIFFICULTY_LABELS[nxt.difficulty]}`, ...snap, next: "arcade" });
        }
      } else if (continues > 0) {
        setResults({ won: false, title: "DERROTA", subtitle: `Continues: ${continues}`, ...snap, next: "continue" });
      } else {
        setResults({ won: false, title: "FIM DE JOGO", subtitle: "A arena cobra o saldo.", ...snap, next: null });
      }
      return;
    }
    if (mode === "survival") {
      const wv = runRef.current.wave;
      if (won) {
        if (wv > survivalBest) {
          setSurvivalBest(wv);
          patchSave({ survivalBest: wv });
        }
        setResults({ won: true, title: `ONDA ${wv}`, subtitle: "A próxima onda já vem.", ...snap, next: "survival" });
      } else {
        const reached = Math.max(0, wv - 1);
        if (reached > survivalBest) {
          setSurvivalBest(reached);
          patchSave({ survivalBest: reached });
        }
        setResults({ won: false, title: "FIM DE JOGO", subtitle: `Ondas sobrevividas: ${reached}  ·  Recorde: ${Math.max(survivalBest, reached)}`, ...snap, next: null });
      }
      return;
    }
    if (mode === "tournament") {
      const t = runRef.current.tourney;
      if (won && t?.round === "semi") {
        setResults({
          won: true,
          title: "SEMI",
          subtitle: `Final contra ${t.bracket.finalOpp.name}`,
          ...snap,
          next: "tournament",
        });
      } else if (won) {
        patchSave({ tournamentWon: true });
        setResults({ won: true, title: "CAMPEÃO", subtitle: "O torneio é seu. O sangue secou no ferro.", ...snap, next: null });
      } else {
        setResults({ won: false, title: "ELIMINADO", subtitle: "A chave não perdoa.", ...snap, next: null });
      }
      return;
    }
    if (mode === "story") {
      const camp = getStory(p1.id);
      const i = runRef.current.storyIndex;
      const beat = camp.beats[i];
      if (won && beat && i < camp.beats.length - 1) {
        setResults({ won: true, title: beat.title, subtitle: beat.winLine, ...snap, next: "story" });
      } else if (won) {
        const cleared = Array.from(new Set([...storyCleared, p1.id]));
        setStoryCleared(cleared);
        const out = recordStoryClear(p1.id);
        bumpSave();
        pull();
        setResults({ won: true, title: camp.title, subtitle: camp.ending, ...snap, next: (out.unlocks.length + out.rewards.length) ? "progress" : null });
      } else {
        setResults({ won: false, title: "FIM", subtitle: "A história acaba aqui. O sangue não reescreve o capítulo.", ...snap, next: null });
      }
      return;
    }
    const pending = pull();
    setResults({
      won,
      title: won ? "VITÓRIA" : "DERROTA",
      subtitle: won ? "Mais um nome na lista." : "A sentença foi executada.",
      ...snap,
      next: pending ? "progress" : null,
    });
  };

  const advanceRun = () => {
    if (!results) return;
    if (results.next === "arcade") {
      const next = runRef.current.arcadeIndex + 1;
      runRef.current.arcadeIndex = next;
      setArcadeIndex(next);
      startFight({ arcadeIndex: next });
      return;
    }
    if (results.next === "continue") {
      runRef.current.continues -= 1;
      runRef.current.continuesUsed += 1;
      setArcadeContinues(runRef.current.continues);
      startFight({ arcadeIndex: runRef.current.arcadeIndex });
      return;
    }
    if (results.next === "progress") {
      quitTo("menu");
      return;
    }
    if (results.next === "survival") {
      const next = runRef.current.wave + 1;
      runRef.current.wave = next;
      setWave(next);
      startFight({
        wave: next,
        carry: {
          health: healCarry(results.health, p1?.stats.maxHealth ?? results.health),
          meter: results.meter,
          superMeter: results.superMeter,
        },
      });
      return;
    }
    if (results.next === "story" && p1) {
      const next = runRef.current.storyIndex + 1;
      runRef.current.storyIndex = next;
      gameRef.current?.destroy();
      gameRef.current = null;
      setHud(null);
      setResults(null);
      setPaused(false);
      const camp = getStory(p1.id);
      setStoryCard({ campaign: camp, index: next });
      audioRef.current?.startMusic();
      return;
    }
    quitTo("menu");
  };

  const quitTo = (s: Screen) => {
    loadAbort.current?.abort();
    gameRef.current?.destroy();
    gameRef.current = null;
    if (packRef.current) {
      releaseFightAssets(packRef.current);
      packRef.current = null;
    }
    setHud(null);
    setPaused(false);
    setResults(null);
    setStoryCard(null);
    setScreen(s);
    audioRef.current?.startMusic();
  };

  useEffect(() => {
    if (screen === "fight" && p1 && p2 && canvasRef.current && !gameRef.current) {
      startFight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const nav = (s: Screen) => {
    audioRef.current?.uiMove();
    setScreen(s);
  };

  const applyGfx = (partial: Partial<typeof gfx>) => {
    const next = { ...gfx, ...partial };
    setGfx(next);
    patchSave({ graphics: next });
  };

  const applyAudio = (partial: Partial<typeof audioS>) => {
    const next = { ...audioS, ...partial };
    setAudioS(next);
    patchSave({ audio: next });
    audioRef.current?.apply(next);
  };

  return (
    <main className="bb-root relative font-body">
      {screen !== "fight" && screen !== "loading" && <Backdrop />}

      {screen === "loading" && pendingFight.current && (
        <LoadingView
          p1={pendingFight.current.p1}
          p2={pendingFight.current.p2}
          stageName={STAGES.find((s) => s.id === pendingFight.current?.stageId)?.name ?? pendingFight.current.stageId}
          progress={loadProg}
          hint={loadHint}
          error={loadError}
          onRetry={() => { setLoadError(null); void runLoad(); }}
          onBack={() => quitTo("select")}
        />
      )}

      {screen === "boot" && (
        <section className="bb-screen items-center justify-center">
          <button type="button" className="flex h-full w-full flex-col items-center justify-center gap-6" onClick={unlock}>
            <Logo title={equippedTitleName()} />
            <p className="bb-eyebrow">Toque para entrar na arena</p>
          </button>
        </section>
      )}

      {screen === "menu" && (
        <MenuView
          onAction={(a, label) => {
            if (a === "soon") { setSoon(label); audioRef.current?.uiBack(); return; }
            if (a === "arcade" || a === "versus" || a === "training" || a === "survival" || a === "tournament" || a === "story") openMode(a);
            else nav(a);
          }}
        />
      )}

      {screen === "select" && (
        <SelectView
          mode={mode}
          p1={p1}
          p2={p2}
          pickSlot={pickSlot}
          difficulty={difficulty}
          stageId={stageId}
          onBack={() => nav("menu")}
          onPick={selectFighter}
          onSlot={setPickSlot}
          onDiff={(d) => { setDifficulty(d); runRef.current.campaignDifficulty = d; patchSave({ difficulty: d }); }}
          onStage={setStageId}
          onStart={mode === "story" ? () => {
            if (!p1) return;
            const camp = getStory(p1.id);
            setStoryCard({ campaign: camp, index: runRef.current.storyIndex });
            audioRef.current?.uiConfirm();
          } : startFight}
          survivalBest={survivalBest}
          bracket={bracket}
          storyCleared={storyCleared}
          saveTick={saveTick}
          p1Palette={p1Palette}
          onPalette={(id) => { setP1Palette(id); if (p1) equipPalette(p1.id, id); }}
        />
      )}

      {screen === "settings" && (
        <SettingsView
          gfx={gfx}
          audio={audioS}
          renderer={renderer}
          rec={rec}
          rumble={rumble}
          onBack={() => nav("menu")}
          onGfx={applyGfx}
          onAudio={applyAudio}
          onRumble={(v) => { setRumble(v); patchSave({ rumble: v }); if (inputRef.current) inputRef.current.rumble = v; }}
          onPreset={(p) => {
            const next = { ...gfx, ...QUALITY_PRESETS[p], preset: p };
            setGfx(next);
            patchSave({ graphics: next });
          }}
          onControls={() => nav("controls")}
        />
      )}

      {screen === "controls" && (
        <ControlsView
          bindings={bindings}
          remap={remap}
          onBack={() => nav("menu")}
          onRemap={(slot, action) => {
            setRemap({ slot, action });
            inputRef.current?.beginRemap(slot, action);
          }}
          onReset={() => {
            const b = structuredClone(DEFAULT_BINDINGS);
            setBindings(b);
            if (inputRef.current) inputRef.current.bindings = structuredClone(b);
            patchSave({ bindings: b });
          }}
        />
      )}

      {screen === "credits" && (
        <SimpleBack title="Créditos" onBack={() => nav("menu")}>
          <p className="max-w-md text-pretty text-mute">
            BRUTAL BLOOD v{GAME.VERSION}. Motor de luta modular com Kharon, Nyx, Draven e Vespera.
            Combos, Counter, Punish, Throw Tech, Wake-up, Arcade, Survival, Torneio e História.
          </p>
        </SimpleBack>
      )}

      {screen === "characters" && (
        <CharactersView onBack={() => nav("menu")} saveTick={saveTick} />
      )}

      {screen === "progress" && (
        <ProgressView onBack={() => nav("menu")} saveTick={saveTick} />
      )}

      {screen === "rewards" && (
        <RewardsView onBack={() => nav("menu")} saveTick={saveTick} />
      )}

      {screen === "gallery" && (
        <GalleryView onBack={() => nav("menu")} saveTick={saveTick} />
      )}

      <section
        className="absolute inset-0 items-center justify-center bg-ink"
        style={{ display: screen === "fight" ? "block" : "none" }}
      >
        <canvas
          ref={canvasRef}
          width={1280}
          height={720}
          className="absolute inset-0 h-full w-full object-contain"
        />
        <HUD hud={hud} />
        {screen === "fight" && inputRef.current && <TouchControls input={inputRef.current} />}
        {screen === "fight" && hud?.mode === "training" && (
          <TrainingDock
            training={training}
            damage={hud.trainingDamage}
            history={hud.inputHistory}
            hitstopFrames={hud.hitstopFrames}
            lastHitstop={hud.lastHitstop}
            combatEvent={hud.combatEvent}
            comboScale={hud.comboScale}
            frameAdv={hud.frameAdv}
            onChange={(t) => { setTraining(t); gameRef.current?.setTraining(t); }}
            onReset={() => gameRef.current?.match.resetPositions()}
          />
        )}
        {paused && !results && (
          <PauseMenu
            view={pauseView}
            setView={setPauseView}
            fighter={p1}
            gfx={gfx}
            audio={audioS}
            onGfx={applyGfx}
            onAudio={applyAudio}
            onResume={() => gameRef.current?.match.togglePause(false)}
            onRestart={() => { gameRef.current?.match.restartRound(); setPaused(false); }}
            onSelect={() => quitTo("select")}
            onMenu={() => quitTo("menu")}
          />
        )}
        {results && (
          <ResultsOverlay
            results={results}
            onNext={advanceRun}
            onMenu={() => quitTo("menu")}
          />
        )}
      </section>

      {soon && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/70" onClick={() => setSoon(null)}>
          <div className="bb-panel w-min max-w-[90vw] px-10 py-8 text-center">
            <p className="bb-eyebrow">Brutal Blood</p>
            <h2 className="font-display mt-2 text-3xl tracking-widest">{soon}</h2>
            <p className="mt-3 text-sm tracking-[0.2em] text-ember">EM DESENVOLVIMENTO</p>
          </div>
        </div>
      )}

      {storyCard && p1 && (
        <StoryCard
          campaign={storyCard.campaign}
          index={storyCard.index}
          fighter={p1}
          onFight={startFight}
          onBack={() => {
            setStoryCard(null);
            if (screen === "fight") quitTo("menu");
          }}
        />
      )}

      {secretOffer && (
        <SecretOfferView
          fight={secretOffer}
          onAccept={() => {
            secretRef.current = secretOffer;
            setSecretActive(secretOffer);
            setSecretOffer(null);
            startFight();
          }}
          onSkip={() => setSecretOffer(null)}
        />
      )}

      {!secretOffer && unlockQueue[0] && screen !== "boot" && (
        <UnlockView
          id={unlockQueue[0]}
          onNext={() => {
            consumeUnlockCinematic(unlockQueue[0]);
            setUnlockQueue((q) => q.slice(1));
            bumpSave();
          }}
        />
      )}

      {!secretOffer && !unlockQueue[0] && rewardQueue[0] && screen !== "boot" && (
        <RewardUnlockView
          id={rewardQueue[0]}
          onNext={() => {
            consumeRewardCinematic(rewardQueue[0]);
            setRewardQueue((q) => q.slice(1));
            bumpSave();
          }}
        />
      )}

      {toast && (
        <Toast text={toast} onDone={() => setToast(null)} />
      )}
    </main>
  );
}

function Logo({ title }: { title?: string | null }) {
  return (
    <div className="text-center">
      <div className="bb-eyebrow">Fighting game</div>
      <h1 className="bb-title text-[clamp(4rem,14vw,8rem)] text-bone" style={{ textShadow: "0 0 40px #b4152266" }}>BRUTAL</h1>
      <h2 className="font-display -mt-2 text-[clamp(1.6rem,5vw,3rem)] tracking-[0.42em] text-blood">BLOOD</h2>
      {title && <p className="mt-2 text-xs tracking-[0.28em] text-ember">{title}</p>}
    </div>
  );
}

function Backdrop() {
  return (
    <>
      <img src="/ui/menu-bg.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-50" crossOrigin="anonymous" />
      <div className="absolute inset-0 bg-gradient-to-b from-ink/40 via-ink/70 to-ink" />
      <Embers />
    </>
  );
}

function Embers() {
  const bits = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 53) % 100}%`,
    delay: `${(i * 0.37) % 4}s`,
    dur: `${3 + (i % 5)}s`,
    size: 2 + (i % 4),
  })), []);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b, i) => (
        <span key={i} className="ember absolute bottom-8 rounded-full bg-ember"
          style={{ left: b.left, width: b.size, height: b.size, animation: `ember-rise ${b.dur} linear ${b.delay} infinite` }} />
      ))}
    </div>
  );
}

function MenuView({ onAction }: { onAction: (a: (typeof MENU)[number]["action"], label: string) => void }) {
  return (
    <section className="bb-screen items-center justify-center px-4 py-8">
      <div className="bb-panel relative z-10 w-full max-w-md px-8 py-10">
        <Logo title={equippedTitleName()} />
        <p className="mx-auto mt-4 max-w-sm text-pretty text-center text-sm text-mute">
          Entre na arena. Domine seu estilo. Sobreviva ao combate.
        </p>
        <div className="mt-8 grid gap-2">
          {MENU.map((m) => {
            const Icon = m.icon;
            return (
              <button key={m.id} type="button" className={`bb-btn flex items-center justify-between ${m.action === "arcade" ? "bb-btn-primary" : ""}`}
                onClick={() => onAction(m.action, m.label)}>
                <span className="flex items-center gap-3">
                  <Icon className="size-4" />
                  {m.label}
                </span>
                {m.soon && <span className="text-[0.6rem] tracking-widest text-mute">EM BREVE</span>}
              </button>
            );
          })}
        </div>
        <p className="mt-6 text-center text-[0.7rem] tracking-[0.18em] text-mute">v{GAME.VERSION} — História</p>
      </div>
    </section>
  );
}

function SelectView(props: {
  mode: MatchMode;
  p1: CharacterDef | null;
  p2: CharacterDef | null;
  pickSlot: 1 | 2;
  difficulty: Difficulty;
  stageId: string;
  survivalBest: number;
  bracket: TourneyBracket | null;
  storyCleared: string[];
  saveTick: number;
  p1Palette: string;
  onPalette: (id: string) => void;
  onBack: () => void;
  onPick: (e: RosterEntry) => void;
  onSlot: (s: 1 | 2) => void;
  onDiff: (d: Difficulty) => void;
  onStage: (id: string) => void;
  onStart: () => void;
}) {
  const selected = props.pickSlot === 1 ? props.p1 : props.p2;
  const ready = props.mode === "versus" ? !!(props.p1 && props.p2) : !!props.p1;
  const save = getSave();
  const slots = visibleSlots(save);
  void props.saveTick;
  return (
    <section className="bb-screen overflow-auto px-4 py-6">
      <header className="mx-auto flex w-full max-w-6xl items-center gap-4">
        <button type="button" className="bb-btn px-3" onClick={props.onBack} aria-label="Voltar"><ChevronLeft className="size-5" /></button>
        <div>
          <div className="bb-eyebrow">Escolha seu lutador</div>
          <h2 className="font-display text-3xl tracking-widest">SELECT FIGHTER</h2>
          {props.mode === "arcade" && <p className="mt-1 text-xs tracking-widest text-ember">5 lutas até o chefe. 1 continue.</p>}
          {props.mode === "survival" && <p className="mt-1 text-xs tracking-widest text-ember">Ondas infinitas. Recorde: {props.survivalBest}</p>}
          {props.mode === "tournament" && <p className="mt-1 text-xs tracking-widest text-ember">Chave de 4. Semi e final.</p>}
          {props.mode === "story" && <p className="mt-1 text-xs tracking-widest text-ember">Campanha de 4 capítulos. Sem continue.</p>}
        </div>
      </header>
      <div className="mx-auto mt-6 grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {slots.map((slot) => {
            const vis = slotVisibility(slot.id, save);
            const selectable = canSelect(slot.id, save) && !(props.mode === "story" && !hasStory(slot.id));
            const live = playable.find((p) => p.id === slot.id);
            const sel = (props.p1?.id === slot.id) || (props.p2?.id === slot.id);
            const secret = vis === "secret";
            const label = vis === "unlocked" || slot.initiallyUnlocked ? slot.name : secret ? "???" : slot.name;
            const status = !selectable
              ? (vis === "unlocked" && slot.comingSoon ? "EM BREVE" : secret ? "???" : "BLOQUEADO")
              : props.mode === "story" && props.storyCleared.includes(slot.id) ? "COMPLETO" : slot.title;
            return (
              <button key={slot.id} type="button" disabled={!selectable}
                onClick={() => { if (live) props.onPick(live); }}
                className={`bb-panel relative min-h-28 overflow-hidden p-2 text-left sm:min-h-36 ${sel ? "ring-2 ring-blood" : ""} ${!selectable ? "opacity-40" : ""}`}>
                {selectable && live?.portrait ? (
                  <img src={live.portrait} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-80" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 bg-panel-2" style={{ background: `radial-gradient(circle at 40% 30%, ${slot.color}66, #0a0708)` }} />
                )}
                {!selectable && (
                  <div className="absolute right-2 top-2 text-[0.65rem] tracking-widest text-ember">🔒</div>
                )}
                <div className="relative">
                  <div className="text-[0.55rem] tracking-widest text-ember">{status}</div>
                  <h3 className="font-display text-lg tracking-widest">{label}</h3>
                </div>
              </button>
            );
          })}
        </div>
        <aside className="bb-panel p-4">
          <div className="flex gap-2">
            <button type="button" className={`bb-btn flex-1 ${props.pickSlot === 1 ? "bb-btn-primary" : ""}`} onClick={() => props.onSlot(1)}>PLAYER 1</button>
            {props.mode === "versus" ? (
              <button type="button" className={`bb-btn flex-1 ${props.pickSlot === 2 ? "bb-btn-primary" : ""}`} onClick={() => props.onSlot(2)}>PLAYER 2</button>
            ) : (
              <div className="bb-btn flex-1 opacity-80">CPU</div>
            )}
          </div>
          {selected ? (
            <div className="mt-4">
              <h3 className="font-display text-2xl">{selected.name}</h3>
              <p className="text-sm text-ember">{selected.style}</p>
              <Stat label="Força" v={selected.ratings.power} />
              <Stat label="Velocidade" v={selected.ratings.speed} />
              <Stat label="Defesa" v={selected.ratings.defense} />
              <Stat label="Alcance" v={selected.ratings.range} />
              <Stat label="Uso" v={(selected.difficulty ?? 3) * 2} />
              {props.pickSlot === 1 && availablePalettes(selected.id).length > 1 && (
                <div className="mt-3">
                  <p className="text-[0.65rem] tracking-widest text-mute">Paleta</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {availablePalettes(selected.id).map((p) => (
                      <button key={p.id} type="button"
                        className={`border px-2 py-1 text-[0.65rem] tracking-widest ${props.p1Palette === p.id ? "border-blood text-ember" : "border-line text-mute"}`}
                        onClick={() => props.onPalette(p.id)}>{p.id}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="mt-6 text-sm text-mute">Selecione um lutador</p>
          )}
          {(props.mode === "versus" || props.mode === "training" || props.mode === "arcade") && (
            <label className="mt-4 block text-xs tracking-widest text-mute">
              Dificuldade
              <select className="mt-1 w-full border border-line bg-ink p-2 text-bone" value={props.difficulty}
                onChange={(e) => props.onDiff(e.target.value as Difficulty)}>
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
                ))}
              </select>
            </label>
          )}
          {props.mode === "versus" || props.mode === "training" ? (
          <label className="mt-3 block text-xs tracking-widest text-mute">
            Arena
            <select className="mt-1 w-full border border-line bg-ink p-2 text-bone" value={props.stageId}
              onChange={(e) => props.onStage(e.target.value)}>
              {STAGES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          ) : (
            <p className="mt-4 text-xs leading-relaxed text-mute">
              {props.mode === "arcade"
                ? "As arenas e a dificuldade avançam a cada rua."
                : props.mode === "tournament"
                  ? "Semi na Catedral. Final na Fortaleza. O outro lado da chave é resolvido fora do ringue."
                  : props.mode === "story"
                    ? (props.p1 ? `${getStory(props.p1.id).title} — ${getStory(props.p1.id).blurb}` : "Cada lutador tem uma campanha própria de quatro capítulos.")
                    : "Cada onda muda de arena. A vida e a energia carregam; um recuo de 18% de vida entre ondas."}
            </p>
          )}
          {props.mode === "tournament" && props.bracket && (
            <div className="mt-4 border border-line p-3 text-xs tracking-widest text-mute">
              <p className="text-ember">CHAVE</p>
              <p className="mt-2 text-bone">{props.p1?.name ?? "VOCÊ"} vs {props.bracket.semiOpp.name}</p>
              <p className="mt-1">{props.bracket.otherA.name} vs {props.bracket.otherB.name}</p>
              <p className="mt-2 text-ember">Final: {props.bracket.finalOpp.name}</p>
            </div>
          )}
          <button type="button" className="bb-btn bb-btn-primary mt-5 w-full" disabled={!ready} onClick={props.onStart}>
            INICIAR LUTA
          </button>
        </aside>
      </div>
    </section>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div className="mt-2">
      <div className="flex justify-between text-[0.7rem] tracking-widest text-mute">
        <span>{label}</span><span className="tabular-nums">{v}</span>
      </div>
      <div className="mt-1 h-1.5 bg-ink">
        <div className="h-full bg-blood" style={{ width: `${v * 10}%` }} />
      </div>
    </div>
  );
}

function SettingsView(props: {
  gfx: typeof DEFAULT_GRAPHICS;
  audio: typeof DEFAULT_AUDIO;
  renderer: string;
  rec: QualityPreset;
  rumble: boolean;
  onBack: () => void;
  onGfx: (p: Partial<typeof DEFAULT_GRAPHICS>) => void;
  onAudio: (p: Partial<typeof DEFAULT_AUDIO>) => void;
  onRumble: (v: boolean) => void;
  onPreset: (p: QualityPreset) => void;
  onControls: () => void;
}) {
  return (
    <SimpleBack title="Configurações" onBack={props.onBack}>
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-2">
        <section className="bb-panel p-5">
          <h3 className="font-display tracking-widest">Gráfico</h3>
          <p className="mt-1 text-xs text-mute">Motor: {props.renderer.toUpperCase()} · Recomendado: {props.rec.toUpperCase()}</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {(["low", "medium", "high", "ultra"] as QualityPreset[]).map((p) => (
              <button key={p} type="button" className={`bb-btn ${props.gfx.preset === p ? "bb-btn-primary" : ""}`} onClick={() => props.onPreset(p)}>
                {p === "low" ? "Baixo" : p === "medium" ? "Médio" : p === "high" ? "Alto" : "Ultra"}
              </button>
            ))}
          </div>
          <label className="mt-4 block text-xs tracking-widest text-mute">
            Aceleração
            <select className="mt-1 w-full border border-line bg-ink p-2 text-bone" value={props.gfx.accel}
              onChange={(e) => props.onGfx({ accel: e.target.value as typeof props.gfx.accel })}>
              <option value="auto">Automático</option>
              <option value="on">Ativado</option>
              <option value="off">Desativado</option>
            </select>
          </label>
          <label className="mt-3 block text-xs tracking-widest text-mute">
            FPS máximo
            <select className="mt-1 w-full border border-line bg-ink p-2 text-bone" value={props.gfx.maxFps}
              onChange={(e) => props.onGfx({ maxFps: Number(e.target.value) as typeof props.gfx.maxFps })}>
              <option value={30}>30</option>
              <option value={60}>60</option>
              <option value={120}>120</option>
              <option value={144}>144</option>
            </select>
          </label>
          {([
            ["fullscreen", "Tela cheia"],
            ["vsync", "VSync"],
            ["particles", "Partículas"],
            ["effects", "Efeitos"],
            ["shadows", "Sombras"],
            ["screenShake", "Screen shake"],
            ["hitstop", "Hitstop"],
            ["bloom", "Bloom"],
            ["stageFx", "Efeitos de cenário"],
            ["debugSprites", "Debug sprites"],
          ] as const).map(([k, lab]) => (
            <label key={k} className="mt-2 flex items-center justify-between text-sm">
              {lab}
              <input type="checkbox" checked={Boolean(props.gfx[k])} onChange={(e) => {
                const on = e.target.checked;
                props.onGfx({ [k]: on });
                if (k === "fullscreen") {
                  if (on) void document.documentElement.requestFullscreen?.();
                  else if (document.fullscreenElement) void document.exitFullscreen();
                }
              }} />
            </label>
          ))}
        </section>
        <section className="bb-panel p-5">
          <h3 className="font-display tracking-widest">Áudio</h3>
          <label className="mt-3 flex items-center justify-between text-sm">
            Mudo
            <input type="checkbox" checked={props.audio.muted} onChange={(e) => props.onAudio({ muted: e.target.checked })} />
          </label>
          {([
            ["master", "Volume geral"],
            ["music", "Música"],
            ["sfx", "Efeitos"],
            ["voice", "Vozes"],
            ["ambient", "Ambiente"],
            ["ui", "Interface"],
          ] as const).map(([k, lab]) => (
            <label key={k} className="mt-3 block text-xs tracking-widest text-mute">
              {lab}
              <input type="range" min={0} max={1} step={0.01} className="w-full" value={props.audio[k]}
                onChange={(e) => props.onAudio({ [k]: Number(e.target.value) })} />
            </label>
          ))}
          <label className="mt-4 flex items-center justify-between text-sm">
            Vibração
            <input type="checkbox" checked={props.rumble} onChange={(e) => props.onRumble(e.target.checked)} />
          </label>
          <button type="button" className="bb-btn mt-4 w-full" onClick={props.onControls}>
            <Keyboard className="mr-2 inline size-4" /> Remapear controles
          </button>
          <button type="button" className="bb-btn mt-2 w-full" onClick={() => { props.onAudio({ ...DEFAULT_AUDIO }); }}>
            Restaurar áudio
          </button>
        </section>
      </div>
    </SimpleBack>
  );
}

function ControlsView(props: {
  bindings: Bindings;
  remap: { slot: "p1" | "p2"; action: ActionName } | null;
  onBack: () => void;
  onRemap: (slot: "p1" | "p2", action: ActionName) => void;
  onReset: () => void;
}) {
  const actions = Object.keys(ACTION_LABELS) as ActionName[];
  return (
    <SimpleBack title="Controles" onBack={props.onBack}>
      <p className="mb-4 text-sm text-mute">Clique uma ação e pressione a nova tecla. Gamepads Xbox, PlayStation e genéricos são detectados automaticamente.</p>
      {props.remap && <p className="mb-3 text-ember">Aguardando tecla para {ACTION_LABELS[props.remap.action]} ({props.remap.slot.toUpperCase()})…</p>}
      <div className="grid w-full max-w-5xl gap-4 md:grid-cols-2">
        {(["p1", "p2"] as const).map((slot) => (
          <div key={slot} className="bb-panel p-4">
            <h3 className="font-display tracking-widest">{slot === "p1" ? "PLAYER 1" : "PLAYER 2"}</h3>
            <div className="mt-3 grid gap-1">
              {actions.map((a) => (
                <button key={a} type="button" className="flex items-center justify-between border border-line bg-ink px-3 py-2 text-left text-sm"
                  onClick={() => props.onRemap(slot, a)}>
                  <span>{ACTION_LABELS[a]}</span>
                  <span className="font-display tracking-widest text-ember">{props.bindings[slot][a]?.join(" / ") || "—"}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="bb-btn mt-4" onClick={props.onReset}>Restaurar padrão</button>
    </SimpleBack>
  );
}

function ResultsOverlay(props: {
  results: FightResults;
  onNext: () => void;
  onMenu: () => void;
}) {
  const r = props.results;
  const nextLabel =
    r.next === "arcade" ? "Próxima luta" :
    r.next === "survival" ? "Próxima onda" :
    r.next === "continue" ? "Continuar" :
    r.next === "tournament" ? "Ir à final" :
    r.next === "story" ? "Próximo capítulo" :
    r.next === "progress" ? "Continuar" :
    null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/75">
      <div className="bb-panel w-[min(420px,92vw)] p-6 text-center">
        <p className="bb-eyebrow">{r.won ? "Vitória" : "Derrota"}</p>
        <h2 className="font-display mt-2 text-3xl tracking-widest">{r.title}</h2>
        <p className="mt-3 text-sm text-pretty text-mute">{r.subtitle}</p>
        <p className="mt-4 font-display tracking-widest text-ember">MAX COMBO {r.maxCombo}</p>
        <div className="mt-6 grid gap-2">
          {nextLabel && (
            <button type="button" className="bb-btn bb-btn-primary" onClick={props.onNext}>{nextLabel}</button>
          )}
          <button type="button" className="bb-btn" onClick={props.onMenu}>Menu principal</button>
        </div>
      </div>
    </div>
  );
}

function StoryCard(props: {
  campaign: StoryCampaign;
  index: number;
  fighter: CharacterDef;
  onFight: () => void;
  onBack: () => void;
}) {
  const beat = props.campaign.beats[props.index];
  if (!beat) return null;
  const foe = storyOpponent(props.fighter, beat.opponentId);
  const stage = STAGES.find((s) => s.id === beat.stageId);
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-ink/80">
      <div className="bb-panel w-[min(480px,92vw)] p-6 text-center">
        <p className="bb-eyebrow">{props.campaign.title} · CAPÍTULO {beat.chapter}</p>
        <h2 className="font-display mt-2 text-3xl tracking-widest">{beat.title}</h2>
        <p className="mt-4 text-sm text-pretty text-mute">{beat.intro}</p>
        <div className="mt-5 flex items-center justify-center gap-4 text-xs tracking-widest text-ember">
          <span>{props.fighter.name}</span>
          <span className="text-mute">VS</span>
          <span>{foe.name}</span>
        </div>
        <p className="mt-2 text-xs tracking-widest text-mute">
          {stage?.name ?? beat.stageId} · {DIFFICULTY_LABELS[beat.difficulty]} · {props.index + 1}/{props.campaign.beats.length}
        </p>
        <div className="mt-6 grid gap-2">
          <button type="button" className="bb-btn bb-btn-primary" onClick={props.onFight}>LUTAR</button>
          <button type="button" className="bb-btn" onClick={props.onBack}>Voltar</button>
        </div>
      </div>
    </div>
  );
}

function RewardUnlockView(props: { id: string; onNext: () => void }) {
  const reward = rewardById(props.id);
  if (!reward) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/85">
      <div className="bb-panel w-[min(440px,92vw)] p-6 text-center">
        <p className="bb-eyebrow">{REWARD_KIND_LABELS[reward.kind]}</p>
        <h2 className="font-display mt-2 text-3xl tracking-widest">RECOMPENSA</h2>
        <div className="mx-auto mt-5 h-28 w-28" style={{ background: `radial-gradient(circle, ${reward.color ?? "#c9202b"}, #14080a)` }} />
        <h3 className="font-display mt-4 text-2xl tracking-widest">{reward.name}</h3>
        <p className="text-sm text-ember">{reward.subtitle}</p>
        <p className="mt-2 text-sm text-pretty text-mute">{reward.description}</p>
        {reward.comingSoon && <p className="mt-2 text-xs tracking-widest text-mute">EM BREVE</p>}
        {reward.kind === "title" && (
          <button type="button" className="bb-btn mt-4 w-full" onClick={() => equipTitle(reward.id)}>Equipar título</button>
        )}
        <button type="button" className="bb-btn bb-btn-primary mt-3 w-full" onClick={props.onNext}>Continuar</button>
      </div>
    </div>
  );
}

function UnlockView(props: { id: string; onNext: () => void }) {
  const slot = slotById(props.id);
  if (!slot) return null;
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/85">
      <div className="bb-panel w-[min(440px,92vw)] p-6 text-center">
        <p className="bb-eyebrow">Novo lutador</p>
        <h2 className="font-display mt-2 text-3xl tracking-widest">DESBLOQUEADO</h2>
        <div className="mx-auto mt-5 h-36 w-36" style={{ background: `radial-gradient(circle, ${slot.color}, #14080a)` }} />
        <h3 className="font-display mt-4 text-2xl tracking-widest">{slot.name}</h3>
        <p className="text-sm text-ember">{slot.title}</p>
        {slot.comingSoon && <p className="mt-2 text-xs tracking-widest text-mute">EM BREVE NA ARENA</p>}
        <button type="button" className="bb-btn bb-btn-primary mt-6 w-full" onClick={props.onNext}>Continuar</button>
      </div>
    </div>
  );
}

function SecretOfferView(props: { fight: SecretFightDef; onAccept: () => void; onSkip: () => void }) {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-ink/90">
      <div className="bb-panel w-[min(480px,92vw)] p-6 text-center">
        <p className="bb-eyebrow">Encontro secreto</p>
        <h2 className="font-display mt-3 text-3xl tracking-widest">{props.fight.intro}</h2>
        <p className="mt-4 text-sm text-ember">{props.fight.displayName} — {props.fight.displayTitle}</p>
        <div className="mt-6 grid gap-2">
          <button type="button" className="bb-btn bb-btn-primary" onClick={props.onAccept}>Aceitar o desafio</button>
          <button type="button" className="bb-btn" onClick={props.onSkip}>Recusar</button>
        </div>
      </div>
    </div>
  );
}

function ProgressView(props: { onBack: () => void; saveTick: number }) {
  void props.saveTick;
  const snap = progressSnapshot();
  const dev = import.meta.env.DEV;
  return (
    <SimpleBack title="Progresso" onBack={props.onBack}>
      <div className="w-full max-w-xl">
        <p className="font-display text-4xl tracking-widest text-blood">{snap.percent}%</p>
        <p className="mt-1 text-sm text-mute">PROGRESSO TOTAL</p>
        <div className="mt-6 grid gap-3 text-sm">
          <p>Lutadores: {snap.unlocked} / {snap.total}</p>
          <p>Arcade concluído: {snap.arcadeClears}</p>
          <p>Blood Finishes: {snap.bloodFinishes} / 20</p>
          <p>Desafiantes secretos: {snap.secretWins}</p>
          <p>Maior dificuldade: {snap.highestDifficulty ? DIFFICULTY_LABELS[snap.highestDifficulty] : "—"}</p>
          <p>Recompensas: {snap.rewards} / {snap.rewardTotal}</p>
        </div>
        <div className="mt-6">
          <p className="bb-eyebrow">Títulos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {grantedOfKind("title").map((t) => (
              <button key={t.id} type="button"
                className={`border px-2 py-1 text-xs tracking-widest ${getSave().equippedTitle === t.id ? "border-blood text-ember" : "border-line text-mute"}`}
                onClick={() => equipTitle(getSave().equippedTitle === t.id ? null : t.id)}>{t.name}</button>
            ))}
            {grantedOfKind("title").length === 0 && <p className="text-xs text-mute">Nenhum título ainda.</p>}
          </div>
        </div>
        {dev && (
          <div className="mt-8 border border-line p-4">
            <p className="bb-eyebrow">Debug</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button type="button" className="bb-btn" onClick={() => { debugUnlockAll(); location.reload(); }}>Desbloquear todos</button>
              <button type="button" className="bb-btn" onClick={() => { debugLockAll(); location.reload(); }}>Resetar progressão</button>
              <button type="button" className="bb-btn" onClick={() => { debugSimulateArcade("kharon", "hard", true); location.reload(); }}>Simular Arcade Kharon</button>
              <button type="button" className="bb-btn" onClick={() => { const s = getSave(); patchSave({ bloodFinishCount: (s.bloodFinishCount ?? 0) + 5 }); flushRewards(); location.reload(); }}>+5 Blood Finishes</button>
            </div>
          </div>
        )}
      </div>
    </SimpleBack>
  );
}

function CharactersView(props: { onBack: () => void; saveTick: number }) {
  void props.saveTick;
  const save = getSave();
  return (
    <SimpleBack title="Personagens" onBack={props.onBack}>
      <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-2">
        {visibleSlots(save).map((slot) => {
          const vis = slotVisibility(slot.id, save);
          const live = playable.find((p) => p.id === slot.id);
          const prog = save.characterProgress[slot.id];
          const unlocked = vis === "unlocked" || slot.initiallyUnlocked && (save.unlockedCharacters ?? []).includes(slot.id);
          const name = vis === "secret" && !unlocked ? "???" : slot.name;
          return (
            <article key={slot.id} className="bb-panel overflow-hidden p-4">
              <div className="flex gap-4">
                {live?.portrait && unlocked ? (
                  <img src={live.portrait} alt="" className="h-28 w-24 object-cover object-top" crossOrigin="anonymous" />
                ) : (
                  <div className="h-28 w-24" style={{ background: slot.color }} />
                )}
                <div className="min-w-0">
                  <h3 className="font-display text-2xl tracking-widest">{name}</h3>
                  <p className="text-sm text-ember">{unlocked ? slot.title : hintFor(slot.id, save)}</p>
                  {unlocked && live && (
                    <p className="mt-2 text-sm text-pretty text-mute">{live.lore}</p>
                  )}
                  {unlocked && (
                    <p className="mt-2 text-xs tracking-widest text-mute">
                      Arcade: {prog?.arcadeCleared ? "CONCLUÍDO" : "—"} · História: {prog?.storyCleared ? "CONCLUÍDA" : "—"}
                      <br />
                      Vitórias: {prog?.wins ?? 0} · Derrotas: {prog?.losses ?? 0} · Combo: {prog?.maxCombo ?? 0}
                      <br />
                      Blood Finishes: {prog?.bloodFinishes ?? 0} · Perfects: {prog?.perfects ?? 0}
                      {prog?.highestDifficulty ? ` · ${DIFFICULTY_LABELS[prog.highestDifficulty]}` : ""}
                    </p>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SimpleBack>
  );
}

function GalleryView(props: { onBack: () => void; saveTick: number }) {
  void props.saveTick;
  const save = getSave();
  const unlocked = visibleSlots(save).filter((s) => (save.unlockedCharacters ?? []).includes(s.id));
  return (
    <SimpleBack title="Galeria" onBack={props.onBack}>
      <p className="bb-eyebrow">Elenco revelado</p>
      <div className="mt-4 grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-4">
        {unlocked.map((slot) => {
          const live = playable.find((p) => p.id === slot.id);
          return (
            <figure key={slot.id} className="bb-panel overflow-hidden">
              {live?.portrait ? (
                <img src={live.portrait} alt={slot.name} className="h-40 w-full object-cover object-top" crossOrigin="anonymous" />
              ) : (
                <div className="h-40" style={{ background: slot.color }} />
              )}
              <figcaption className="p-2 font-display tracking-widest">{slot.name}</figcaption>
            </figure>
          );
        })}
      </div>
      <p className="bb-eyebrow mt-8">Recompensas</p>
      <div className="mt-4 grid w-full max-w-5xl gap-3 sm:grid-cols-2">
        {(["ending", "gallery", "music", "palette", "skin", "stage"] as const).flatMap((kind) => grantedOfKind(kind)).map((r) => (
          <article key={r.id} className="bb-panel p-3">
            <p className="text-[0.65rem] tracking-widest text-ember">{REWARD_KIND_LABELS[r.kind]}</p>
            <h3 className="font-display tracking-widest">{r.name}</h3>
            <p className="text-sm text-mute">{r.description}</p>
          </article>
        ))}
      </div>
    </SimpleBack>
  );
}

function RewardsView(props: { onBack: () => void; saveTick: number }) {
  void props.saveTick;
  const save = getSave();
  const groups = catalogByKind();
  const kinds = (["title", "palette", "ending", "gallery", "music", "skin", "stage"] as const);
  return (
    <SimpleBack title="Recompensas" onBack={props.onBack}>
      <p className="max-w-xl text-sm text-mute">Paletas, títulos, finais e colecionáveis. Conquistado não significa jogável — skins e arenas novas entram quando o asset existir.</p>
      <div className="mt-6 grid w-full max-w-5xl gap-6">
        {kinds.map((kind) => (
          <section key={kind}>
            <p className="bb-eyebrow">{REWARD_KIND_LABELS[kind]}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {groups[kind].map((r) => {
                const owned = hasReward(r.id, save);
                return (
                  <article key={r.id} className={`bb-panel p-3 ${owned ? "" : "opacity-50"}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-display tracking-widest">{owned || !r.unlock?.hiddenDescription ? r.name : "???"}</h3>
                        <p className="text-xs text-ember">{r.subtitle}</p>
                      </div>
                      <span className="text-[0.6rem] tracking-widest text-mute">{owned ? (r.comingSoon ? "EM BREVE" : "OK") : "🔒"}</span>
                    </div>
                    <p className="mt-2 text-sm text-mute">{owned ? r.description : rewardHint(r, save)}</p>
                    {owned && r.kind === "title" && (
                      <button type="button" className="bb-btn mt-2 py-1 text-xs"
                        onClick={() => equipTitle(save.equippedTitle === r.id ? null : r.id)}>{save.equippedTitle === r.id ? "Equipado" : "Equipar"}</button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </SimpleBack>
  );
}

function PauseMenu(props: {
  view: "root" | "moves" | "settings";
  setView: (v: "root" | "moves" | "settings") => void;
  fighter: CharacterDef | null;
  gfx: typeof DEFAULT_GRAPHICS;
  audio: typeof DEFAULT_AUDIO;
  onGfx: (p: Partial<typeof DEFAULT_GRAPHICS>) => void;
  onAudio: (p: Partial<typeof DEFAULT_AUDIO>) => void;
  onResume: () => void;
  onRestart: () => void;
  onSelect: () => void;
  onMenu: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/70">
      <div className="bb-panel max-h-[85dvh] w-[min(420px,92vw)] overflow-auto p-6">
        <h2 className="font-display mb-4 flex items-center justify-center gap-2 text-2xl tracking-widest">
          <Pause className="size-5" /> PAUSADO
        </h2>
        {props.view === "root" && (
          <div className="grid gap-2">
            <button type="button" className="bb-btn bb-btn-primary" onClick={props.onResume}>Continuar</button>
            <button type="button" className="bb-btn" onClick={() => props.setView("moves")}>Lista de golpes</button>
            <button type="button" className="bb-btn" onClick={() => props.setView("settings")}>Configurações</button>
            <button type="button" className="bb-btn" onClick={props.onRestart}>Reiniciar</button>
            <button type="button" className="bb-btn" onClick={props.onSelect}>Seleção de personagem</button>
            <button type="button" className="bb-btn" onClick={props.onMenu}>Menu principal</button>
          </div>
        )}
        {props.view === "moves" && props.fighter && (
          <MoveList fighter={props.fighter} onBack={() => props.setView("root")} />
        )}
        {props.view === "settings" && (
          <div>
            <button type="button" className="bb-btn mb-3" onClick={() => props.setView("root")}>Voltar</button>
            {(["master", "sfx", "music"] as const).map((k) => (
              <label key={k} className="mt-2 block text-xs tracking-widest text-mute">
                {k}
                <input type="range" min={0} max={1} step={0.01} className="w-full" value={props.audio[k]}
                  onChange={(e) => props.onAudio({ [k]: Number(e.target.value) })} />
              </label>
            ))}
            <label className="mt-3 flex justify-between text-sm">
              Screen shake
              <input type="checkbox" checked={props.gfx.screenShake} onChange={(e) => props.onGfx({ screenShake: e.target.checked })} />
            </label>
            <label className="mt-3 flex justify-between text-sm">
              Hitstop
              <input type="checkbox" checked={props.gfx.hitstop !== false} onChange={(e) => props.onGfx({ hitstop: e.target.checked })} />
            </label>
            <label className="mt-3 flex justify-between text-sm">
              Debug sprites
              <input type="checkbox" checked={!!props.gfx.debugSprites} onChange={(e) => props.onGfx({ debugSprites: e.target.checked })} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function MoveList({ fighter, onBack }: { fighter: CharacterDef; onBack: () => void }) {
  const moves = Object.values(fighter.moves).filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
  return (
    <div>
      <button type="button" className="bb-btn mb-3" onClick={onBack}>Voltar</button>
      <h3 className="font-display tracking-widest">{fighter.name}</h3>
      <p className="mt-1 text-[0.65rem] tracking-widest text-mute">S/A/R · on-hit · on-block · dados do motor</p>
      <div className="mt-3 grid gap-2">
        {moves.map((m) => (
          <div key={m.id + m.name} className="border border-line bg-ink p-2 text-sm">
            <div className="flex justify-between font-display tracking-widest">
              <span>{m.name}</span>
              <span className="text-ember">{m.damage}</span>
            </div>
            <div className="text-[0.7rem] text-mute">
              {m.command ? commandLabel(m.command) : ACTION_LABELS[m.button ?? "light"]}
              {" · "}{m.startup}/{m.active}/{m.recovery}
              {" · "}{signed(onHitAdv(m))}/{signed(onBlockAdv(m))}
              {m.cost ? ` · EN ${m.cost}` : ""}
              {m.superCost ? ` · SUPER ${m.superCost}` : ""}
              {" · HS "}{defaultHitstopFrames(m)}F
            </div>
            <div className="mt-1 text-[0.6rem] tracking-widest text-ember">{moveTags(m).join(" · ")}</div>
          </div>
        ))}
        {fighter.finishes.map((f) => (
          <div key={f.id} className="border border-line bg-ink p-2 text-sm">
            <div className="font-display tracking-widest">{f.name}</div>
            <div className="text-[0.7rem] text-mute">{commandLabel(f.command)} · Blood Finish</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const CLIP_PREVIEW = [
  "idle", "walk", "walkBack", "dash", "jumpStart", "jump", "fall", "crouch",
  "block", "blockLow", "light", "medium", "heavy", "kickLight", "kickHeavy",
  "aerial", "throw", "special1", "special2", "special3", "super",
  "hit", "hitHeavy", "knockdown", "wakeup", "victory", "intro", "counter", "taunt",
  "finish1", "finish2",
];

function TrainingDock(props: {
  training: TrainingOpts;
  damage: number;
  history: string[];
  hitstopFrames: number;
  lastHitstop: number;
  combatEvent: string;
  comboScale: number;
  frameAdv: number;
  onChange: (t: TrainingOpts) => void;
  onReset: () => void;
}) {
  const t = props.training;
  return (
    <aside className="pointer-events-auto absolute right-3 top-28 z-20 hidden w-52 bb-panel p-3 text-xs sm:block">
      <div className="font-display tracking-widest">TREINO</div>
      <p className="mt-1 tabular-nums text-mute">Dano último hit: {props.damage}</p>
      <p className="tabular-nums text-mute">
        Hitstop: {props.hitstopFrames > 0 ? `${props.hitstopFrames}F` : "—"} · último {props.lastHitstop}F
      </p>
      <p className="tabular-nums text-ember">{props.combatEvent || "—"} · scale {Math.round(props.comboScale * 100)}%</p>
      <p className="tabular-nums text-mute">Frame adv: {props.frameAdv > 0 ? `+${props.frameAdv}` : props.frameAdv}</p>
      <p className="truncate text-mute">Inputs: {props.history.slice(-8).join(" ")}</p>
      <label className="mt-2 flex justify-between">HP infinito <input type="checkbox" checked={t.infiniteHp} onChange={(e) => props.onChange({ ...t, infiniteHp: e.target.checked })} /></label>
      <label className="mt-1 flex justify-between">Energia infinita <input type="checkbox" checked={t.infiniteMeter} onChange={(e) => props.onChange({ ...t, infiniteMeter: e.target.checked })} /></label>
      <label className="mt-1 flex justify-between">Hitboxes <input type="checkbox" checked={t.showHitboxes} onChange={(e) => props.onChange({ ...t, showHitboxes: e.target.checked })} /></label>
      <label className="mt-1 flex justify-between">Frame data <input type="checkbox" checked={t.showFrameData !== false} onChange={(e) => props.onChange({ ...t, showFrameData: e.target.checked })} /></label>
      <label className="mt-2 block text-mute">
        Clip P1
        <select className="mt-1 w-full border border-line bg-ink p-1 text-bone" value={t.previewClip || ""}
          onChange={(e) => props.onChange({ ...t, previewClip: e.target.value })}>
          <option value="">(gameplay)</option>
          {CLIP_PREVIEW.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
      </label>
      <label className="mt-2 block text-mute">
        CPU
        <select className="mt-1 w-full border border-line bg-ink p-1 text-bone" value={t.cpu}
          onChange={(e) => props.onChange({ ...t, cpu: e.target.value as TrainingOpts["cpu"] })}>
          <option value="stand">Parada</option>
          <option value="block">Defesa sempre</option>
          <option value="blockFirst">Defesa após hit</option>
          <option value="blockRandom">Defesa aleatória</option>
          <option value="crouch">Agachar</option>
          <option value="jump">Pulando</option>
          <option value="attack">Atacando</option>
          <option value="attackAfterBlock">Ataque após defesa</option>
          <option value="normal">Normal</option>
        </select>
      </label>
      <button type="button" className="bb-btn mt-2 w-full py-2" onClick={props.onReset}>Reset posição</button>
    </aside>
  );
}

function LoadingView(props: {
  p1: CharacterDef;
  p2: CharacterDef;
  stageName: string;
  progress: LoadProgress;
  hint: string;
  error: string | null;
  onRetry: () => void;
  onBack: () => void;
}) {
  const pct = props.progress.percent;
  return (
    <section className="bb-screen items-center justify-center bg-ink px-6">
      <p className="bb-eyebrow">BRUTAL BLOOD</p>
      <div className="mt-8 flex w-full max-w-3xl items-center justify-center gap-6">
        {props.p1.portrait && (
          <img src={props.p1.portrait} alt="" className="h-40 w-28 object-cover object-top" crossOrigin="anonymous" />
        )}
        <div className="text-center">
          <h2 className="font-display text-4xl tracking-[0.18em]">{props.p1.name}</h2>
          <div className="my-3 font-display text-xl tracking-[0.4em] text-blood">VS</div>
          <h2 className="font-display text-4xl tracking-[0.18em]">{props.p2.name}</h2>
        </div>
        {props.p2.portrait && (
          <img src={props.p2.portrait} alt="" className="h-40 w-28 object-cover object-top" style={{ transform: "scaleX(-1)" }} crossOrigin="anonymous" />
        )}
      </div>
      <p className="mt-8 font-display tracking-[0.28em] text-ember">{props.stageName}</p>
      <div className="mt-6 h-3 w-full max-w-md border border-bone bg-ink p-0.5">
        <div className="h-full bg-blood" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 font-display tracking-[0.2em]">CARREGANDO {pct}%</p>
      <p className="mt-2 max-w-md text-center text-sm text-mute">{props.hint}</p>
      {props.progress.current && !props.error && (
        <p className="mt-1 truncate text-[0.65rem] text-mute">{props.progress.current}</p>
      )}
      {props.progress.cached > 0 && !props.error && (
        <p className="mt-1 text-[0.65rem] text-mute">cache {props.progress.cached}/{props.progress.total}</p>
      )}
      <div className="mt-6 flex gap-3">
        {props.error && (
          <button type="button" className="bb-btn bb-btn-primary" onClick={props.onRetry}>Tentar novamente</button>
        )}
        <button type="button" className="bb-btn" onClick={props.onBack}>Voltar</button>
      </div>
      {props.error && (
        <p className="mt-3 max-w-md text-center text-sm text-blood">{props.error}</p>
      )}
    </section>
  );
}

function SimpleBack({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <section className="bb-screen overflow-auto px-4 py-6">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-4">
        <button type="button" className="bb-btn px-3" onClick={onBack} aria-label="Voltar"><ChevronLeft className="size-5" /></button>
        <h2 className="font-display text-3xl tracking-widest">{title}</h2>
      </header>
      <div className="mx-auto mt-6 w-full max-w-5xl">{children}</div>
    </section>
  );
}

function Toast({ text, onDone }: { text: string; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 1600);
    return () => window.clearTimeout(t);
  }, [onDone]);
  return (
    <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 border border-line bg-panel px-4 py-2 text-sm">{text}</div>
  );
}
