import { GAME, type Difficulty } from "./core/config";
import { get2dContext } from "./core/graphics";
import { getSave } from "./core/save";
import { Input } from "./input/Input";
import { AudioManager } from "./audio/AudioManager";
import { Match, type HudSnap, type MatchMode, type TrainingOpts } from "./combat/Match";
import type { CharacterDef } from "./characters/types";
import type { FightAssetPack } from "./assets";

export type GameStart = {
  canvas: HTMLCanvasElement;
  p1: CharacterDef;
  p2: CharacterDef;
  mode: MatchMode;
  difficulty: Difficulty;
  stageId: string;
  input: Input;
  audio: AudioManager;
  onHUD: (h: HudSnap) => void;
  onMatchEnd: (won: boolean) => void;
  onPause: (v: boolean) => void;
  winsNeeded?: number;
  runLabel?: string;
  carry?: { health: number; meter: number; superMeter: number };
  assets?: FightAssetPack | null;
  p1Palette?: number | string;
  p2Palette?: number | string;
};

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  match: Match;
  private input: Input;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private lastDraw = 0;
  private running = false;
  private onVis?: () => void;

  constructor(opts: GameStart) {
    this.canvas = opts.canvas;
    const save = getSave();
    this.ctx = get2dContext(opts.canvas, save.graphics.accel);
    this.input = opts.input;
    this.match = new Match({
      ctx: this.ctx,
      input: opts.input,
      p1Data: opts.p1,
      p2Data: opts.p2,
      mode: opts.mode,
      difficulty: opts.difficulty,
      stageId: opts.stageId,
      gfx: save.graphics,
      audio: opts.audio,
      onHUD: opts.onHUD,
      onMatchEnd: opts.onMatchEnd,
      winsNeeded: opts.winsNeeded,
      runLabel: opts.runLabel,
      carry: opts.carry,
      assets: opts.assets ?? null,
      p1Palette: opts.p1Palette,
      p2Palette: opts.p2Palette,
    });
    this.match.onPause = opts.onPause;
    this.wireControlsTest();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(GAME.MAX_DT, (now - this.last) / 1000);
      this.last = now;
      this.acc += dt;
      this.input.poll();
      let steps = 0;
      while (this.acc >= GAME.FRAME && steps < 5) {
        this.match.step();
        this.input.endFrame();
        this.acc -= GAME.FRAME;
        steps++;
      }
      const maxFps = getSave().graphics.maxFps;
      const minDraw = 1000 / maxFps;
      if (now - this.lastDraw >= minDraw - 0.5) {
        this.match.draw();
        this.lastDraw = now;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    this.onVis = () => {
      if (!document.hidden) this.last = performance.now();
    };
    document.addEventListener("visibilitychange", this.onVis);
  }

  setTraining(t: TrainingOpts) {
    this.match.applyTraining(t);
  }

  destroy() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.onVis) document.removeEventListener("visibilitychange", this.onVis);
    if (typeof window !== "undefined") delete window.__controlsTest;
  }

  private wireControlsTest() {
    if (typeof window === "undefined") return;
    window.__controlsTest = {
      getYaw: () => this.match.p1.x,
      getSpeed: () => Math.abs(this.match.p1.vx),
      getX: () => this.match.p1.x,
      getHitstop: () => this.match.hitStop.remaining,
      getLastHitstop: () => this.match.hitStop.lastFrames,
      getHitstopKind: () => this.match.hitStop.kind,
      getSpriteReady: () => this.match.sprites[0]?.ready ?? false,
      getSpriteCount: () => this.match.sprites[0]?.pack?.images.size ?? 0,
      getSpriteAnim: () => this.match.sprites[0]?.lastAnim ?? "",
      getSpriteSrc: () => this.match.sprites[0]?.lastSrc ?? "",
      getSpriteFallback: () => this.match.sprites[0]?.lastFallback ?? false,
      getSpriteMode: () => this.match.sprites[0]?.lastMode ?? "",
      getPalette: () => `${this.match.p1.paletteId}/${this.match.p2.paletteId}`,
      killP2: () => { this.match.p2.health = 0; },
      setKeys: (codes: string[]) => this.input.injectCodes(codes),
      setSteer: (v: number) => {
        const codes: string[] = [];
        if (v > 0.2) codes.push("KeyA");
        if (v < -0.2) codes.push("KeyD");
        this.input.injectCodes(codes);
      },
    };
  }
}

declare global {
  interface Window {
    __controlsTest?: {
      getYaw: () => number;
      getSpeed: () => number;
      getX: () => number;
      getHitstop?: () => number;
      getLastHitstop?: () => number;
      getHitstopKind?: () => string;
      getSpriteReady?: () => boolean;
      getSpriteCount?: () => number;
      getSpriteAnim?: () => string;
      getSpriteSrc?: () => string;
      getSpriteFallback?: () => boolean;
      getSpriteMode?: () => string;
      getPalette?: () => string;
      killP2?: () => void;
      setKeys: (codes: string[]) => void;
      setSteer?: (v: number) => void;
    };
  }
}
