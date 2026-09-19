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
import { roster, isPlayable, playable } from "@/game/characters/roster";
import type { CharacterDef, RosterEntry } from "@/game/characters/types";
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
  next?: "arcade" | "survival" | "continue" | "tournament" | "story" | null;
};

const MENU: { id: string; label: string; action: Screen | "arcade" | "versus" | "training" | "survival" | "tournament" | "story" | "soon"; soon?: boolean; icon: typeof Swords }[] = [
  { id: "story", label: "História", action: "story", icon: BookOpen },
  { id: "arcade", label: "Arcade", action: "arcade", icon: Swords },
  { id: "versus", label: "Versus", action: "versus", icon: Users },
  { id: "training", label: "Treino", action: "training", icon: Swords },
  { id: "survival", label: "Survival", action: "survival", icon: Swords },
  { id: "tourney", label: "Torneio", action: "tournament", icon: Trophy },
  { id: "chars", label: "Personagens", action: "characters", icon: Users },
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
  } | null>(null);
  const runRef = useRef({
    arcadeIndex: 0,
    continues: ARCADE_CONTINUES,
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
    runRef.current = { arcadeIndex: 0, continues: ARCADE_CONTINUES, wave: 1, storyIndex: 0, tourney: null };
    setBracket(null);
    setStoryCard(null);
    setResults(null);
    setScreen("select");
  };

  const selectFighter = (entry: RosterEntry) => {
    if (!isPlayable(entry)) return;
    if (mode === "story" && !hasStory(entry.id)) return;
    audioRef.current?.uiMove();
    if (mode === "versus") {
      if (pickSlot === 1) {
        setP1(entry);
        setPickSlot(2);
      } else {
        setP2(entry);
      }
    } else {
      setP1(entry);
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
    if (mode === "arcade") {
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
      p1, p2: foe, difficulty: diff, stageId: stage, winsNeeded, runLabel: label, carry: override?.carry,
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
    const snap = {
      maxCombo: combo,
      health: match.p1.health,
      meter: match.p1.meter,
      superMeter: match.p1.superMeter,
    };
    if (mode === "arcade") {
      const idx = runRef.current.arcadeIndex;
      const continues = runRef.current.continues;
      if (won) {
        const last = idx >= ARCADE_LADDER.length - 1;
        if (last) {
          patchSave({ arcadeCleared: true });
          setResults({ won: true, title: "ARCADE CLEAR", subtitle: "O chefe caiu. O sangue é seu.", ...snap, next: null });
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
        patchSave({ storyCleared: cleared });
        setResults({ won: true, title: camp.title, subtitle: camp.ending, ...snap, next: null });
      } else {
        setResults({ won: false, title: "FIM", subtitle: "A história acaba aqui. O sangue não reescreve o capítulo.", ...snap, next: null });
      }
      return;
    }
    setResults({
      won,
      title: won ? "VITÓRIA" : "DERROTA",
      subtitle: won ? "Mais um nome na lista." : "A sentença foi executada.",
      ...snap,
      next: null,
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
      setArcadeContinues(runRef.current.continues);
      startFight({ arcadeIndex: runRef.current.arcadeIndex });
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
            <Logo />
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
          onDiff={(d) => { setDifficulty(d); patchSave({ difficulty: d }); }}
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
        <SimpleBack title="Personagens" onBack={() => nav("menu")}>
          <div className="grid max-w-5xl gap-4 sm:grid-cols-2">
            {playable.map((f) => (
              <article key={f.id} className="bb-panel overflow-hidden">
                <div className="grid grid-cols-[8rem_1fr] gap-4 p-4">
                  <img src={f.portrait} alt={f.name} className="h-36 w-full object-cover object-top" crossOrigin="anonymous" />
                  <div>
                    <h3 className="font-display text-2xl tracking-widest">{f.name}</h3>
                    <p className="text-sm text-ember">{f.title}</p>
                    <p className="mt-2 text-sm text-pretty text-mute">{f.lore}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </SimpleBack>
      )}

      {screen === "gallery" && (
        <SimpleBack title="Galeria" onBack={() => nav("menu")}>
          <p className="bb-eyebrow">Em desenvolvimento</p>
          <p className="mt-4 max-w-md text-mute">Retratos, finais e arenas serão exibidos aqui conforme o elenco crescer.</p>
        </SimpleBack>
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

      {toast && (
        <Toast text={toast} onDone={() => setToast(null)} />
      )}
    </main>
  );
}

function Logo() {
  return (
    <div className="text-center">
      <div className="bb-eyebrow">Fighting game</div>
      <h1 className="bb-title text-[clamp(4rem,14vw,8rem)] text-bone" style={{ textShadow: "0 0 40px #b4152266" }}>BRUTAL</h1>
      <h2 className="font-display -mt-2 text-[clamp(1.6rem,5vw,3rem)] tracking-[0.42em] text-blood">BLOOD</h2>
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
        <Logo />
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
  onBack: () => void;
  onPick: (e: RosterEntry) => void;
  onSlot: (s: 1 | 2) => void;
  onDiff: (d: Difficulty) => void;
  onStage: (id: string) => void;
  onStart: () => void;
}) {
  const selected = props.pickSlot === 1 ? props.p1 : props.p2;
  const ready = props.mode === "versus" ? !!(props.p1 && props.p2) : !!props.p1;
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {roster.map((f) => {
            const locked = !isPlayable(f) || (props.mode === "story" && isPlayable(f) && !hasStory(f.id));
            const sel = (props.p1?.id === f.id) || (props.p2?.id === f.id);
            return (
              <button key={f.id} type="button" disabled={locked}
                onClick={() => props.onPick(f)}
                className={`bb-panel relative min-h-48 overflow-hidden p-3 text-left ${sel ? "ring-2 ring-blood" : ""} ${locked ? "opacity-30" : ""}`}>
                {isPlayable(f) && f.portrait ? (
                  <img src={f.portrait} alt="" className="absolute inset-0 h-full w-full object-cover object-top opacity-80" crossOrigin="anonymous" />
                ) : (
                  <div className="absolute inset-0 bg-panel-2" />
                )}
                <div className="relative">
                  <div className="text-[0.6rem] tracking-widest text-ember">
                    {locked ? (isPlayable(f) ? "SEM CAMPANHA" : "BLOQUEADO") : props.mode === "story" && props.storyCleared.includes(f.id) ? "COMPLETO" : f.title}
                  </div>
                  <h3 className="font-display text-xl tracking-widest">{f.name}</h3>
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
            </div>
          ) : (
            <p className="mt-6 text-sm text-mute">Selecione um lutador</p>
          )}
          {props.mode !== "versus" && props.mode !== "arcade" && props.mode !== "survival" && props.mode !== "tournament" && props.mode !== "story" && (
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
