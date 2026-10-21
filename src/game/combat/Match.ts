import { Challenges } from "../modes/challenges";
import { GAME, type Difficulty } from "../core/config";
import { Fighter, intersects } from "./Fighter";
import { FighterAI, type TrainingCpu } from "../ai/FighterAI";
import { CommandBuffer, commandLabel } from "./commands";
import { TrainingRecorder } from "../input/TrainingRecorder";
import { Input, type AttackButtonHit } from "../input/Input";
import { Camera } from "../core/camera";
import { ParticlePool } from "../core/particles";
import { AudioManager } from "../audio/AudioManager";
import { drawStage, getStage, type StageDef } from "../graphics/stages";
import { drawFighter, drawHitboxes } from "../graphics/drawFighter";
import { SpriteAnimator } from "../graphics/SpriteAnimator";
import type { CharacterDef, MoveDef } from "../characters/types";
import type { GraphicsSettings } from "../core/config";
import { getSave, bumpStat } from "../core/save";
import { HitStop, computeHitstop, HITSTOP } from "./hitstop";
import type { FightAssetPack } from "../assets";
import { getCharacterAssets } from "../assets/manifests";
import { paletteAt } from "../assets/palettes";
import { availablePalettes } from "../progression/rewards";
import { comboScale, stunScale, COMBO_LIMIT, onHitAdv, onBlockAdv } from "./frameData";

export type MatchMode = "arcade" | "versus" | "training" | "survival" | "tournament" | "story" | "challenge";

export type HudSnap = {
  p1: FighterSnap;
  p2: FighterSnap;
  timer: number;
  round: number;
  roundLabel: string;
  message: string;
  combo: { owner: 1 | 2; hits: number; damage: number; max: number; bonus: number } | null;
  finish: boolean;
  finishHint: string;
  paused: boolean;
  mode: MatchMode;
  lowLife: { p1: boolean; p2: boolean };
  superReady: { p1: boolean; p2: boolean };
  lastRound: boolean;
  inputHistory: string[];
  trainingDamage: number;
  recording: string;
  challenge: string;
  hitstopFrames: number;
  lastHitstop: number;
  runLabel: string;
  winsNeeded: number;
  combatEvent: string;
  comboScale: number;
  frameAdv: number;
};

export type FighterSnap = {
  name: string;
  portrait?: string;
  health: number;
  maxHealth: number;
  meter: number;
  superMeter: number;
  roundWins: number;
};

export type TrainingOpts = {
  infiniteHp: boolean;
  infiniteMeter: boolean;
  showHitboxes: boolean;
  showFrameData: boolean;
  cpu: TrainingCpu;
  previewClip?: string;
  frameAdvance?: boolean;
  forceCounter?: boolean;
};

type Proj = {
  x: number; y: number; vx: number; w: number; h: number;
  owner: Fighter; damage: number; knock: number; life: number; kind: string; hit: boolean;
  hitstop: number;
  move: MoveDef;
  hitsLanded: number;
};

/** Highs whiff on a crouching body unless the move is an overhead. Lows whiff in the air. Mids hit both. */
function heightsConnect(att: Fighter, def: Fighter) {
  const h = att.attack?.height;
  if (!h || h === "mid") return true;
  if (h === "high" && def.grounded && (def.crouching || def.state === "crouch")) {
    return !!att.attack?.overhead;
  }
  if (h === "low" && !def.grounded) return false;
  return true;
}

export class Match {
  ctx: CanvasRenderingContext2D;
  input: Input;
  mode: MatchMode;
  p1: Fighter;
  p2: Fighter;
  ai: FighterAI | null;
  audio: AudioManager;
  camera = new Camera();
  particles = new ParticlePool();
  stage: StageDef;
  gfx: GraphicsSettings;
  sprites: [SpriteAnimator, SpriteAnimator];
  round = 1;
  timer: number;
  state: "intro" | "fight" | "roundend" | "finish" | "ended" = "intro";
  stateTime = 0;
  paused = false;
  roundOver = false;
  roundResetAt = 0;
  trainingReset = 0;
  recorder = new TrainingRecorder();
  challenges = new Challenges();
  activeTime = 0;

  private get practice() { return this.mode === "training" || this.mode === "challenge"; }
  message = "";
  hitStop = new HitStop();
  comboOwner: 1 | 2 | 0 = 0;
  finishTimer = 0;
  finisher: Fighter | null = null;
  victim: Fighter | null = null;
  finishName = "";
  bloodFinishDone = false;
  perfectCount = 0;
  time = 0;
  buf1 = new CommandBuffer();
  buf2 = new CommandBuffer();
  projectiles: Proj[] = [];
  training: TrainingOpts = { infiniteHp: true, infiniteMeter: true, showHitboxes: false, showFrameData: true, cpu: "stand", frameAdvance: false, forceCounter: false };
  lastTrainingDmg = 0;
  private pendingCancel: { fighter: Fighter; move: MoveDef } | null = null;
  private buffered: { p1: { btn: AttackButtonHit; until: number } | null; p2: { btn: AttackButtonHit; until: number } | null } = { p1: null, p2: null };
  private lastEvent = "";
  private eventTime = 0;
  private lastScale = 1;
  private lastAdv = 0;
  private hudStamp = "";
  private pendingProjectiles = new Map<Fighter, MoveDef>();
  private resultDelay = -1;
  private resultWon = false;
  private disposed = false;
  private finishElapsed = 0;

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.activeTime > 0) bumpStat(this.p1.data.id, "timePlayed", this.activeTime);
    this.recorder.stop(this.input);
    this.audio.setIntensity(0);
    this.onMatchEnd = undefined;
    this.onHUD = undefined;
    this.pendingProjectiles.clear();
  }

  private scheduleResult(won: boolean, delay: number) {
    this.resultWon = won;
    this.resultDelay = delay;
  }

  private attackStarted(f: Fighter, move: MoveDef) {
    if (move.type === "special" || move.type === "super") this.audio.special();
    else this.audio.whoosh();
    if (move.type === "super") this.armSuperFreeze(f);
    if (move.projectile) this.pendingProjectiles.set(f, move);
  }

  private releaseProjectiles() {
    for (const [f, move] of this.pendingProjectiles) {
      if (f.attack !== move || f.state !== "attack") this.pendingProjectiles.delete(f);
      else if (f.attackFrame >= move.startup) {
        this.spawnProjectile(f, move);
        this.pendingProjectiles.delete(f);
      }
    }
  }
  onHUD?: (h: HudSnap) => void;
  onMatchEnd?: (won: boolean) => void;
  onPause?: (v: boolean) => void;
  winsNeeded: number;
  runLabel: string;

  constructor(opts: {
    ctx: CanvasRenderingContext2D;
    input: Input;
    p1Data: CharacterDef;
    p2Data: CharacterDef;
    mode: MatchMode;
    difficulty: Difficulty;
    stageId: string;
    gfx: GraphicsSettings;
    audio: AudioManager;
    onHUD?: (h: HudSnap) => void;
    onMatchEnd?: (won: boolean) => void;
    winsNeeded?: number;
    runLabel?: string;
    carry?: { health: number; meter: number; superMeter: number };
    assets?: FightAssetPack | null;
    p1Palette?: number | string;
    p2Palette?: number | string;
  }) {
    this.ctx = opts.ctx;
    this.input = opts.input;
    this.mode = opts.mode;
    this.gfx = opts.gfx;
    this.audio = opts.audio;
    this.stage = getStage(opts.stageId);
    this.p1 = new Fighter({ x: 240, y: 470, data: opts.p1Data, facing: 1 });
    this.p2 = new Fighter({ x: 960, y: 470, data: opts.p2Data, facing: -1, isAI: opts.mode !== "versus" });
    this.ai = this.p2.isAI ? new FighterAI(this.p2, opts.difficulty) : null;
    if (this.ai) this.ai.onAttack = (move) => this.attackStarted(this.p2, move);
    if (this.ai && (opts.mode === "training" || opts.mode === "challenge")) this.ai.mode = this.training.cpu;
    const man1 = getCharacterAssets(opts.p1Data.id);
    const man2 = getCharacterAssets(opts.p2Data.id);
    const mirror = opts.p1Data.id === opts.p2Data.id;
    const pal1 = resolvePalette(availablePalettes(opts.p1Data.id), opts.p1Palette, 0);
    const pal2 = resolvePalette(availablePalettes(opts.p2Data.id), opts.p2Palette, mirror ? 1 : 0);
    this.p1.paletteId = pal1.id;
    this.p2.paletteId = pal2.id;
    this.p1.skin = man1.skin ?? "default";
    this.p2.skin = man2.skin ?? "default";
    this.sprites = [
      new SpriteAnimator(opts.p1Data.id, opts.assets?.p1 ?? null, pal1, this.p1.skin),
      new SpriteAnimator(opts.p2Data.id, opts.assets?.p2 ?? null, pal2, this.p2.skin),
    ];
    this.audio.setIntensity(0);
    this.timer = (opts.mode === "training" || opts.mode === "challenge") ? 999 : GAME.ROUND_TIME;
    this.onHUD = opts.onHUD;
    this.onMatchEnd = opts.onMatchEnd;
    this.winsNeeded = opts.winsNeeded ?? GAME.WINS_NEEDED;
    this.runLabel = opts.runLabel ?? "";
    this.particles.enabled = opts.gfx.particles;
    this.camera.setShake(opts.gfx.screenShake);
    this.hitStop.configure(opts.gfx.hitstop !== false, opts.gfx.effects);
    this.message = (opts.mode === "training" || opts.mode === "challenge") ? "TREINO" : opts.runLabel || (opts.mode === "survival" ? "ONDA 1" : "ROUND 1");
    this.p1.state = "intro";
    this.p2.state = "intro";
    if (opts.carry) {
      this.p1.health = Math.min(this.p1.maxHealth, Math.max(1, opts.carry.health));
      this.p1.meter = opts.carry.meter;
      this.p1.superMeter = opts.carry.superMeter;
    }
  }

  applyTraining(t: TrainingOpts) {
    if (this.training.cpu !== t.cpu) this.ai?.reset();
    const enableAdvance = !!t.frameAdvance && !this.training.frameAdvance;
    this.training = t;
    if (this.ai) this.ai.mode = t.cpu;
    if (enableAdvance) this.togglePause(true);
  }

  togglePause(v?: boolean) {
    this.paused = v ?? !this.paused;
    this.onPause?.(this.paused);
  }

  restartRound() {
    this.timer = this.practice ? 999 : GAME.ROUND_TIME;
    this.resetTransient();
    if (this.mode === "challenge") this.challenges = new Challenges();
    this.togglePause(false);
    this.p1.reset(240, 1, true);
    this.p2.reset(960, -1, true);
    this.projectiles = [];
    this.state = "intro";
    this.stateTime = 0;
    this.roundOver = false;
    this.hitStop.reset();
    this.pendingCancel = null;
    this.message = this.mode === "training" ? "TREINO" : `ROUND ${this.round}`;
  }

  private resetTransient() {
    this.buf1.reset(); this.buf2.reset(); this.ai?.reset();
    this.pendingProjectiles.clear(); this.pendingCancel = null;
    this.resultDelay = -1; this.finishElapsed = 0;
    this.finishName = ""; this.finisher = null; this.victim = null;
    this.input.clearAll(); this.projectiles = []; this.hitStop.reset();
    this.comboOwner = 0; this.lastTrainingDmg = 0; this.lastEvent = "";
    this.trainingReset = 0;
    this.buffered.p1 = null;
    this.buffered.p2 = null;
  }

  resetPositions(kind: "mid" | "cornerP1" | "cornerP2" = "mid") {
    if (kind === "cornerP1") {
      this.p1.reset(40, 1, true);
      this.p2.reset(220, -1, true);
    } else if (kind === "cornerP2") {
      this.p1.reset(GAME.WIDTH - 300, 1, true);
      this.p2.reset(GAME.WIDTH - 120, -1, true);
    } else {
      this.p1.reset(440, 1, true);
      this.p2.reset(740, -1, true);
    }
    this.resetTransient();
    this.timer = this.practice ? 999 : GAME.ROUND_TIME;
  }

  resetHealth() {
    this.p1.health = this.p1.maxHealth;
    this.p2.health = this.p2.maxHealth;
    if (this.p1.state === "ko") this.p1.state = "idle";
    if (this.p2.state === "ko") this.p2.state = "idle";
  }

  resetMeter() {
    this.p1.meter = 0;
    this.p1.superMeter = 0;
    this.p2.meter = 0;
    this.p2.superMeter = 0;
  }

  advanceFrame() {
    if (this.disposed) return;
    const was = this.paused;
    this.paused = false;
    this.simulate();
    this.paused = was || !!this.training.frameAdvance;
    this.emitHud();
  }

  step() {
    if (this.disposed) return;
    if (this.state !== "ended" && (this.input.consume("p1", "pause") || this.input.consume("p2", "pause"))) {
      this.togglePause(); this.emitHud(); return;
    }
    if (this.paused) {
      this.emitHud();
      return;
    }
    if (this.mode === "training" && this.training.frameAdvance) {
      this.emitHud();
      return;
    }
    this.simulate();
  }

  private simulate() {
    const dt = GAME.FRAME;
    const gfx = getSave().graphics;
    this.gfx = gfx;
    this.hitStop.configure(gfx.hitstop !== false, gfx.effects);
    this.camera.setShake(gfx.screenShake);
    this.particles.enabled = gfx.particles;

    if (this.mode === "training" && this.state === "fight") this.recorder.tick(this.input);
    if (this.hitStop.frozen) {
      this.hitStop.tick();
      this.runFrozen(dt);
      if (!this.hitStop.frozen) this.flushCancel();
      this.emitHud();
      return;
    }

    this.flushCancel();
    this.hitStop.decayFlash();
    this.time += dt;
    this.stateTime += dt;
    this.buf1.tick(this.input, "p1", this.p1.facing);
    this.buf2.tick(this.input, "p2", this.p2.facing);

    if (this.state === "intro") {
      this.p1.update(dt);
      this.p2.update(dt);
      if (this.stateTime > 1.15 && this.p1.state === "intro") {
        this.p1.state = "idle";
        this.p2.state = "idle";
      }
      if (this.mode === "training") {
        if (this.stateTime > 0.4 && this.stateTime < 1.2) this.message = "PRATIQUE";
        if (this.stateTime > 1.25) { this.message = ""; this.state = "fight"; this.stateTime = 0; }
      } else {
        const last = this.p1.roundWins === this.winsNeeded - 1 && this.p2.roundWins === this.winsNeeded - 1;
        if (this.stateTime < 1.15) this.message = last ? "FINAL ROUND" : (this.runLabel || `ROUND ${this.round}`);
        else if (this.stateTime < 2.05) this.message = "LUTAR";
        else { this.message = ""; this.state = "fight"; this.stateTime = 0; }
      }
      this.camera.follow(this.p1.x, this.p2.x);
      this.camera.update(dt);
      this.emitHud();
      return;
    }

    if (this.state === "ended") {
      if (this.resultDelay >= 0) {
        this.resultDelay -= dt;
        if (this.resultDelay <= 0) { this.resultDelay = -1; this.onMatchEnd?.(this.resultWon); }
      }
      this.p1.update(dt);
      this.p2.update(dt);
      this.camera.update(dt);
      this.emitHud();
      return;
    }

    if (this.state === "finish") {
      this.updateFinish(dt);
      this.emitHud();
      return;
    }

    if (this.state === "roundend") {
      this.p1.update(dt);
      this.p2.update(dt);
      this.particles.update(dt);
      this.roundResetAt -= dt;
      if (this.roundResetAt <= 0) this.nextRound();
      this.camera.update(dt);
      this.emitHud();
      return;
    }

    this.activeTime += dt;
    if (!this.practice) this.timer = Math.max(0, this.timer - dt);
    if (this.mode === "challenge") {
      if (this.ai) this.ai.mode = this.challenges.task.cpu;
      const change = this.challenges.tick();
      if (change === "next") { this.resetPositions(); this.message = ""; }
      if (change === "complete") {
        this.state = "ended"; this.message = "DESAFIOS CONCLUÍDOS";
        this.scheduleResult(true, 1.4); this.emitHud(); return;
      }
    }

    this.handleHuman(this.p1, "p1", this.buf1);
    if (this.mode === "versus" || (this.mode === "training" && this.recorder.mode !== "idle")) this.handleHuman(this.p2, "p2", this.buf2);
    else {
      if (this.ai && this.mode === "training") this.ai.mode = this.training.cpu;
      this.ai?.update(dt, this.p1);
    }

    this.faceOpponent(this.p1, this.p2);
    this.faceOpponent(this.p2, this.p1);

    this.p1.update(dt);
    this.p2.update(dt);
    this.audio.setIntensity(Math.min(this.p1.health / this.p1.maxHealth, this.p2.health / this.p2.maxHealth) < 0.25 ? 1 : this.round >= 3 ? 0.65 : 0.15);
    this.releaseProjectiles();
    this.updateProjectiles(dt);
    this.resolveCombat();
    this.separate();
    this.particles.update(dt);
    this.eventTime = Math.max(0, this.eventTime - dt);
    if (this.eventTime <= 0) this.lastEvent = "";

    if (this.practice) this.updateTraining(dt);
    else if (this.p1.health <= 0 || this.p2.health <= 0 || this.timer <= 0) this.endRound();

    this.camera.follow(this.p1.x, this.p2.x, this.p1.attack?.type === "super" || this.p2.attack?.type === "super");
    this.camera.update(dt);
    this.emitHud();
  }

  private runFrozen(dt: number) {
    this.buf1.tick(this.input, "p1", this.p1.facing);
    this.buf2.tick(this.input, "p2", this.p2.facing);
    this.latchCancel(this.p1, "p1", this.buf1);
    if (this.mode === "versus" || this.recorder.mode !== "idle") this.latchCancel(this.p2, "p2", this.buf2);
    this.particles.update(dt * 0.22);
    this.camera.update(dt);
  }

  private latchCancel(f: Fighter, slot: "p1" | "p2", buf: CommandBuffer) {
    const btn = this.input.peekPressed(slot);
    if (!btn) return;
    const move = buf.resolveMove(f.data, btn, !f.grounded, false, getSave().graphics.simplifiedCommands);
    if (move && f.canCancel(move.id)) this.pendingCancel = { fighter: f, move };
    else this.storeAttack(slot, btn);
  }

  private flushCancel() {
    const pending = this.pendingCancel;
    this.pendingCancel = null;
    if (!pending) return;
    if (pending.fighter.startAttack(pending.move, true)) {
      this.attackStarted(pending.fighter, pending.move);
    }
  }

  private armSuperFreeze(f: Fighter) {
    this.audio.super();
    this.camera.punch(1.22);
    this.camera.addTrauma(0.45);
    this.particles.ember(f.x + f.w / 2, f.y + f.h * 0.35, 18);
    this.hitStop.trigger({
      frames: HITSTOP.superFreeze,
      kind: "superFreeze",
      x: f.x + f.w / 2,
      y: f.y + f.h * 0.4,
      dir: f.facing,
      color: f.data.accent,
      attacker: f,
      victim: f === this.p1 ? this.p2 : this.p1,
    });
  }

  private storeAttack(slot: "p1" | "p2", btn: AttackButtonHit) {
    this.buffered[slot] = { btn, until: this.time + GAME.INPUT_BUFFER };
  }

  private releaseBuffered(f: Fighter, slot: "p1" | "p2", buf: CommandBuffer) {
    const held = this.buffered[slot];
    if (!held) return;
    if (this.time > held.until) { this.buffered[slot] = null; return; }
    if (f.blocking || f.state === "block") return;
    const ready = f.canAct() || f.cancelReady || f.state === "wakeup";
    if (!ready) return;
    if (this.tryAttack(f, buf, held.btn)) this.buffered[slot] = null;
  }

  private handleHuman(f: Fighter, slot: "p1" | "p2", buf: CommandBuffer) {
    if (f.health <= 0) return;
    const fresh = this.input.peekPressed(slot);
    if (fresh) this.storeAttack(slot, fresh);
    if (f.state === "knockdown") {
      if (this.input.isDown(slot, "down")) f.wakeupKind = "delay";
      else if (this.input.isDown(slot, "up")) f.wakeupKind = "quick";
      else f.wakeupKind = "normal";
      return;
    }
    const dash = f.canAct() ? buf.consumeDash() : 0;
    if (dash && f.canAct()) {
      f.dash(dash * f.facing);
    }
    const block = this.input.isDown(slot, "block");
    f.crouch(this.input.isDown(slot, "down"));
    f.block(block);
    if (block) return;
    const crouch = this.input.isDown(slot, "down");
    f.crouch(crouch);
    if (!crouch) {
      const d = this.input.dir(slot);
      if (d) f.move(d);
      else if (f.state !== "dash") f.stop();
    }
    if (this.input.consume(slot, "up")) {
      f.jump();
      this.audio.jump();
    }
    this.releaseBuffered(f, slot, buf);
  }

  private tryAttack(f: Fighter, buf: CommandBuffer, btn: AttackButtonHit) {
    const move = buf.resolveMove(f.data, btn, !f.grounded, false, getSave().graphics.simplifiedCommands);
    if (!move) return false;
    const cancel = f.canCancel(move.id);
    const reversal = f.state === "wakeup";
    if (f.startAttack(move, cancel)) {
      if (reversal) this.noteEvent("REVERSAL");
      this.attackStarted(f, move);
      return true;
    }
    return false;
  }

  private spawnProjectile(f: Fighter, move: MoveDef) {
    const kind = move.projectile ?? "wave";
    const speed = kind === "needle" ? 620 : kind === "veil" ? 300 : kind === "altar" ? 70 : 480;
    this.projectiles.push({
      x: f.facing > 0 ? f.x + f.w : f.x - 40,
      y: kind === "altar" ? f.y + 92 : f.y + 48,
      vx: f.facing * speed,
      w: kind === "altar" ? 48 : kind === "veil" ? 44 : move.projectile === "needle" ? 36 : 56,
      h: kind === "altar" ? 40 : 22,
      owner: f,
      damage: move.damage,
      knock: move.knockback,
      life: kind === "altar" ? 2.4 : 1.4,
      kind,
      hit: false,
      hitstop: move.hitstop ?? HITSTOP.special,
      move,
      hitsLanded: 0,
    });
  }

  private updateProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter((p) => {
      p.x += p.vx * dt;
      p.life -= dt;
      if (p.hit || p.life <= 0 || p.x < -80 || p.x > 1400) return false;
      const def = p.owner === this.p1 ? this.p2 : this.p1;
      if (def.state === "ko" || def.invuln > 0) return true;
      const box = { x: p.x, y: p.y, w: p.w, h: p.h };
      if (intersects(box, def.getHurtBox())) {
        if (p.move.height === "low" && !def.grounded) return true;
        if (p.move.height === "high" && !p.move.overhead && def.grounded && (def.crouching || def.state === "crouch")) return true;
        const savedLanded = p.owner.hitsLanded;
        const savedDone = p.owner.hitDone;
        p.owner.hitsLanded = p.hitsLanded ?? 0;
        const connected = this.applyHit(p.owner, def, {
          ...p.move,
          damage: p.damage,
          knockback: p.knock,
          projectile: undefined,
          hitstop: p.hitstop,
        } as MoveDef);
        p.hitsLanded = p.owner.hitsLanded;
        p.owner.hitsLanded = savedLanded;
        p.owner.hitDone = savedDone;
        if (!connected) return false;
        const n = Math.max(1, p.move.hits ?? 1);
        if (n > 1 && def.health > 0 && !def.blocking && p.hitsLanded < n) return true;
        return false;
      }
      return true;
    });
  }

  private noteEvent(label: string) {
    this.lastEvent = label;
    this.eventTime = 1.1;
  }

  private resolveCombat() {
    if (this.state !== "fight") return;
    const a = this.p1.getAttackBox();
    const b = this.p2.getAttackBox();
    const g1 = !!this.p1.attack?.grab;
    const g2 = !!this.p2.attack?.grab;
    if (a && b && intersects(a, b) && !g1 && !g2) {
      const p = this.p1.attack?.priority ?? 0;
      const q = this.p2.attack?.priority ?? 0;
      if (Math.abs(p - q) <= 1) {
        this.doClash();
        return;
      }
      if (p > q) {
        this.p2.hitDone = true;
        this.resolveHit(this.p1, this.p2);
      } else {
        this.p1.hitDone = true;
        this.resolveHit(this.p2, this.p1);
      }
      return;
    }
    this.resolveHit(this.p1, this.p2);
    this.resolveHit(this.p2, this.p1);
  }

  private doClash() {
    const midX = (this.p1.x + this.p2.x + this.p1.w) / 2;
    const midY = (this.p1.y + this.p2.y) / 2 + 40;
    this.p1.hitDone = true;
    this.p2.hitDone = true;
    this.p1.vx = -this.p1.facing * 240;
    this.p2.vx = -this.p2.facing * 240;
    this.p1.cancelReady = true;
    this.p2.cancelReady = true;
    this.hitStop.trigger({
      frames: HITSTOP.clash,
      kind: "clash",
      x: midX,
      y: midY,
      dir: 1,
      color: "#f4e4c4",
      attacker: this.p1,
      victim: this.p2,
    });
    this.particles.spawn(midX, midY, 14, "#f4e4c4", true);
    this.camera.addTrauma(0.22);
    this.audio.block();
    this.noteEvent("CLASH");
  }

  private doTech(a: Fighter, b: Fighter) {
    a.hitDone = true;
    b.hitDone = true;
    a.tech(b.x);
    b.tech(a.x);
    const midX = (a.x + b.x) / 2 + 30;
    this.hitStop.trigger({
      frames: HITSTOP.tech,
      kind: "tech",
      x: midX,
      y: a.y + 50,
      dir: 1,
      color: "#8ec8ff",
      attacker: a,
      victim: b,
    });
    this.particles.spawn(midX, a.y + 50, 10, "#8ec8ff", true);
    this.audio.whoosh();
    this.noteEvent("TECH");
  }

  private throwTechs(def: Fighter) {
    if (def.state === "throw" || def.attack?.grab) return true;
    const slot: "p1" | "p2" = def === this.p1 ? "p1" : "p2";
    return this.input.isDown(slot, "throw");
  }

  private resolveHit(att: Fighter, def: Fighter) {
    if (this.state !== "fight") return;
    if (def.state === "ko" || att.state === "ko") return;
    const box = att.getAttackBox();
    if (!intersects(box, def.getHurtBox())) return;
    if (att.attack?.grab) {
      const commandGrab = !!att.attack.commandGrab;
      if (!commandGrab && this.throwTechs(def)) {
        this.doTech(att, def);
        att.throwLock = 0.75;
        def.throwLock = 0.75;
        return;
      }
      if (commandGrab && def.attack?.commandGrab) {
        this.doTech(att, def);
        return;
      }
      const activeStrike = def.state === "attack" && def.attack && !def.attack.grab &&
        def.attackFrame >= def.attack.startup && def.attackFrame < def.attack.startup + def.attack.active;
      if (!commandGrab && activeStrike) {
        att.hitDone = true;
        return;
      }
    }
    if (!att.attack?.grab && !heightsConnect(att, def)) return;
    att.hitDone = true;
    if (!att.attack) return;
    this.applyHit(att, def, att.attack);
  }

  private armorHolds(def: Fighter, move: MoveDef) {
    if (move.grab || move.type === "super") return false;
    const a = def.attack;
    if (!a?.armor) return false;
    if (def.state !== "attack" && def.state !== "counter") return false;
    return def.attackFrame < a.startup + a.active;
  }

  private applyHit(att: Fighter, def: Fighter, move: MoveDef): boolean {
    if (def.state === "ko" || def.invuln > 0) return false;
    if (this.armorHolds(def, move)) {
      const res = def.absorbArmor(move, att.x, att.data.stats.strength);
      const ko = def.health <= 0;
      const impactX = def.x + def.w / 2;
      const impactY = def.y + 50;
      const dir = Math.sign(def.x - att.x) || att.facing;
      this.hitStop.trigger({
        frames: ko ? HITSTOP.heavy : 4,
        kind: ko ? "ko" : "hit",
        x: impactX,
        y: impactY,
        dir,
        color: def.data.accent,
        attacker: att,
        victim: def,
      });
      this.lastTrainingDmg = res.dmg;
      this.noteEvent(ko ? "KO" : "ARMOR");
      att.gainOnHit(move, 1);
      att.cancelReady = true;
      att.hitDone = true;
      this.particles.spawn(impactX, impactY, ko ? 16 : 8, def.data.accent, true);
      this.audio.hit(false);
      this.camera.addTrauma(ko ? 0.4 : 0.1);
      if (this.mode === "challenge") this.challenges.hit({ player: att === this.p1, blocked: false, type: move.type, combo: def.comboHits });
      return true;
    }
    const blocked = !move.grab && def.isBlockingHeight(move.height);
    const hits = Math.max(1, move.hits ?? 1);
    const lastHit = att.hitsLanded >= hits - 1;
    const strike: MoveDef = blocked || hits <= 1 ? move : {
      ...move,
      damage: move.damage / hits,
      knockdown: !!lastHit && !!move.knockdown,
      launcher: !!lastHit && !!move.launcher,
      hitStun: lastHit ? move.hitStun : Math.max(6, Math.round(move.hitStun * 0.45)),
      knockback: lastHit ? move.knockback : Math.round(move.knockback * 0.28),
      hitstop: lastHit ? move.hitstop : 3,
    };
    const atk = def.attack;
    const inStartup = def.state === "attack" && atk && def.attackFrame < atk.startup + atk.active;
    const inRecovery = def.state === "attack" && atk && def.attackFrame >= atk.startup + atk.active;
    const counter = (this.training.forceCounter && this.mode === "training" && !blocked) || (!!inStartup && !blocked);
    const punish = !!inRecovery && !blocked;
    const hitsSoFar = (this.comboOwner === (att === this.p1 ? 1 : 2) ? def.comboHits : 0) + 1;
    const scale = comboScale(hitsSoFar);
    this.lastScale = scale;
    const res = def.takeHit(strike, att.x, scale * att.data.stats.strength, blocked, counter);
    if (!blocked && !res.blocked) def.stun *= stunScale(hitsSoFar);
    if (this.mode === "challenge") this.challenges.hit({ player: att === this.p1, blocked, type: move.type, combo: def.comboHits });
    this.lastTrainingDmg = res.dmg;
    this.lastAdv = blocked ? onBlockAdv(move) : onHitAdv(move);
    const impactX = def.x + def.w / 2;
    const impactY = def.y + (def.crouching ? 80 : 50);
    const dir = Math.sign(def.x - att.x) || att.facing;
    const ko = !blocked && def.health <= 0;
    const { frames, kind } = computeHitstop({ move: strike, blocked, counter, ko });
    this.hitStop.trigger({
      frames,
      kind,
      x: impactX,
      y: impactY,
      dir,
      color: blocked ? "#8ec8ff" : att.data.accent,
      attacker: att,
      victim: def,
    });
    this.camera.kick(-dir, 4 + frames * 0.7);
    if (!blocked) {
      att.gainOnHit(move, hitsSoFar);
      att.cancelReady = true;
      this.comboOwner = att === this.p1 ? 1 : 2;
      this.noteEvent(punish ? "PUNISH" : counter ? "COUNTER" : ko ? "KO" : "HIT");
      if (move.grab) {
        att.throwLock = 0.75;
        def.throwLock = 0.75;
      }
      if (def.comboHits >= COMBO_LIMIT && def.health > 0) {
        def.state = "knockdown";
        def.stun = Math.max(def.stun, 0.35);
      }
      this.tryWallSplat(def, strike);
      this.particles.spawn(impactX, impactY, kind === "ko" || move.type === "super" ? 22 : frames >= 7 ? 16 : 10, att.data.accent);
      if (!blocked) this.particles.blood(impactX, impactY, move.type === "super" || kind === "ko" ? 18 : frames >= 7 ? 12 : 6);
      this.camera.addTrauma(kind === "ko" ? 0.55 : move.type === "super" ? 0.42 : move.type === "special" || counter ? 0.24 : 0.12);
      if (frames >= 8) this.camera.punch(1.06 + frames * 0.012);
      this.audio.hit(move.button === "heavy" || move.button === "kickHeavy" || move.type === "special" || move.type === "super" || ko);
      if (frames >= 8) this.audio.thump();
      this.input.vibrate(att === this.p1 ? "p1" : "p2", 40 + frames * 6, 0.35 + frames * 0.03, 0.2);
      att.hitDone = true;
      if (hits > 1) {
        att.hitsLanded += 1;
        if (att.hitsLanded < hits && def.health > 0) att.hitDone = false;
      }
    } else {
      this.noteEvent("BLOCK");
      this.audio.block();
      this.particles.spawn(impactX, impactY, 6, "#8ec8ff", true);
      this.camera.addTrauma(0.08);
      att.hitDone = true;
    }
    return true;
  }

  private tryWallSplat(def: Fighter, move: MoveDef) {
    if (def.health <= 0 || def.state === "ko") return;
    const atWall = def.x <= 34 || def.x >= GAME.WIDTH - 34 - def.w;
    if (!atWall) return;
    if (move.knockback < 160 && def.comboHits < 2) return;
    const inward = def.x < GAME.WIDTH / 2 ? 1 : -1;
    def.vx = inward * 240;
    def.vy = -400;
    def.grounded = false;
    def.state = "hit";
    def.stun = Math.max(def.stun, 18 * GAME.FRAME);
    this.camera.addTrauma(0.3);
    this.camera.kick(inward, 8);
    this.audio.thump();
    this.noteEvent("WALL");
  }

  private separate() {
    const a = this.p1, b = this.p2;
    const dx = (a.x + a.w / 2) - (b.x + b.w / 2);
    const min = 82;
    if (Math.abs(dx) < min && a.grounded && b.grounded) {
      const push = (min - Math.abs(dx)) / 2;
      if (dx < 0) { a.x -= push; b.x += push; }
      else { a.x += push; b.x -= push; }
    }
    const minX = 30;
    const maxX = GAME.WIDTH - 30;
    a.x = Math.max(minX, Math.min(maxX - a.w, a.x));
    b.x = Math.max(minX, Math.min(maxX - b.w, b.x));
  }

  private faceOpponent(self: Fighter, other: Fighter) {
    const locked = ["attack", "throw", "counter", "hit", "knockdown", "wakeup", "ko", "finish", "thrown", "victory", "dash"];
    if (locked.includes(self.state)) return;
    self.facing = other.x >= self.x ? 1 : -1;
  }

  private updateTraining(dt: number) {
    this.timer = 999;
    if (this.training.infiniteMeter) {
      for (const f of [this.p1, this.p2]) { f.meter = 100; f.superMeter = 100; }
    }
    if ([this.p1, this.p2].some((f) => f.health <= 0 || f.state === "ko")) {
      this.trainingReset += dt;
      if (this.trainingReset > 0.8) this.resetPositions();
    } else {
      this.trainingReset = 0;
      if (this.training.infiniteHp) {
        for (const f of [this.p1, this.p2]) {
          if (f.comboTimer <= 0 && f.stun <= 0) f.health = f.maxHealth;
        }
      }
    }
  }

  private endRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    const p1h = this.p1.health, p2h = this.p2.health;
    const double = p1h <= 0 && p2h <= 0;
    const timeover = this.timer <= 0 && p1h > 0 && p2h > 0;
    const a = p1h / this.p1.maxHealth, b = p2h / this.p2.maxHealth;
    const winner = double || Math.abs(a - b) < 1e-9 ? null : a > b ? this.p1 : this.p2;
    const loser = winner === this.p1 ? this.p2 : winner === this.p2 ? this.p1 : null;
    if (winner) winner.roundWins++;
    const perfect = winner && winner.health >= winner.maxHealth && !timeover;
    if (perfect && winner === this.p1) this.perfectCount += 1;
    if (double) this.message = "DOUBLE KO";
    else if (timeover) this.message = "TIME OVER";
    else if (perfect) this.message = "PERFECT";
    else this.message = "KO";
    this.audio.ko();
    this.camera.addTrauma(0.5);
    if (winner && loser && winner.roundWins >= this.winsNeeded && loser.health <= 0 && !double && !timeover) {
      this.state = "finish";
      this.finishTimer = GAME.FINISH_WINDOW;
      this.finisher = winner;
      this.victim = loser;
      loser.finishVictim = true;
      loser.state = "ko";
      this.message = "DERRAMA O SANGUE";
      this.audio.finish();
      this.camera.punch(1.3);
      return;
    }
    this.state = "roundend";
    if (winner && winner.roundWins >= this.winsNeeded) {
      this.state = "ended";
      winner.state = "victory";
      this.scheduleResult(winner === this.p1, 1.4);
      return;
    }
    this.roundResetAt = 2.1;
  }

  private updateFinish(dt: number) {
    if (this.finishName) {
      this.finishElapsed += dt;
      if (this.finisher) {
        this.finisher.stateTime += dt;
        this.finisher.attackFrame += 1;
      }
      this.particles.update(dt); this.camera.update(dt);
      if (this.finishElapsed >= 1.6) this.concludeFinish();
      return;
    }
    this.finishTimer -= dt;
    this.p1.update(dt, true);
    this.p2.update(dt, true);
    this.particles.update(dt);
    this.camera.follow(this.p1.x, this.p2.x, true);
    this.camera.update(dt);
    const slot: "p1" | "p2" = this.finisher === this.p1 ? "p1" : "p2";
    const buf = slot === "p1" ? this.buf1 : this.buf2;
    const pressed = this.input.peekPressed(slot);
    if (this.finisher && pressed) {
      const btn = pressed;
      if (btn) {
        const move = buf.resolveMove(this.finisher.data, btn, false, true);
        if (move) {
          this.playFinish(move);
          return;
        }
      }
    }
    if (this.finishTimer <= 0) this.concludeFinish();
  }

  private lastButton(slot: "p1" | "p2"): AttackButtonHit | null {
    const order: AttackButtonHit[] = ["light", "medium", "heavy", "kickLight", "kickHeavy", "special", "super", "throw"];
    for (const a of order) {
      if (this.input.isDown(slot, a)) return a;
    }
    return null;
  }

  private playFinish(move: MoveDef) {
    if (this.bloodFinishDone || this.finishName) return;
    const name = move.name;
    if (this.finisher) this.finisher.attack = move;
    this.finishName = name;
    this.bloodFinishDone = true;
    this.message = name.toUpperCase();
    this.hitStop.trigger({
      frames: HITSTOP.finish,
      kind: "finish",
      x: (this.victim?.x ?? 640) + 30,
      y: (this.victim?.y ?? 400) + 40,
      dir: this.finisher?.facing ?? 1,
      color: "#c9202b",
      attacker: this.finisher,
      victim: this.victim,
    });
    this.camera.punch(1.4);
    this.camera.addTrauma(0.8);
    this.audio.super();
    if (this.victim) {
      this.particles.spawn(this.victim.x + 30, this.victim.y + 40, 40, "#c9202b", false);
      this.particles.blood(this.victim.x + 30, this.victim.y + 40, 28);
      this.victim.health = 0;
    }
    this.finishElapsed = 0;
    if (this.finisher) {
      this.finisher.attack = move;
      this.finisher.attackFrame = 0;
      this.finisher.state = "finish";
      this.finisher.stateTime = 0;
    }
  }

  private concludeFinish() {
    if (this.state === "ended") return;
    this.state = "ended";
    if (this.finisher) this.finisher.state = "victory";
    this.message = this.finishName ? this.finishName : "VITÓRIA";
    this.scheduleResult(this.finisher === this.p1, 1.2);
  }

  private nextRound() {
    this.resetTransient();
    this.round++;
    this.timer = GAME.ROUND_TIME;
    this.roundOver = false;
    this.state = "intro";
    this.stateTime = 0;
    this.projectiles = [];
    this.p1.reset(240, 1, true);
    this.p2.reset(960, -1, true);
    this.hitStop.reset();
    this.pendingCancel = null;
    const last = this.p1.roundWins === this.winsNeeded - 1 && this.p2.roundWins === this.winsNeeded - 1;
    this.message = last ? "FINAL ROUND" : `ROUND ${this.round}`;
  }

  private emitHud() {
    const attacker = this.comboOwner === 1 ? this.p2 : this.comboOwner === 2 ? this.p1 : null;
    const combo = attacker && attacker.comboHits > 1 ? {
      owner: this.comboOwner as 1 | 2,
      hits: attacker.comboHits,
      damage: Math.round(attacker.comboDamage),
      max: attacker.maxCombo,
      bonus: Math.round(Math.max(0, (attacker.comboHits - 2) * 4)),
    } : null;
    const last = this.p1.roundWins === this.winsNeeded - 1 && this.p2.roundWins === this.winsNeeded - 1;
    const stamp = `${Math.ceil(this.timer)}|${Math.round(this.p1.health)}|${Math.round(this.p2.health)}|${this.message}|${this.lastEvent}|${combo?.hits ?? 0}|${this.paused}|${this.hitStop.remaining}|${this.state}|${this.recorder.label}|${this.challenges.label}|${this.lastAdv}|${Math.floor(this.p1.meter)}|${Math.floor(this.p2.meter)}|${Math.floor(this.p1.superMeter)}|${Math.floor(this.p2.superMeter)}|${this.input.history.length ? this.input.history.at(-1)?.t : 0}`;
    if (stamp === this.hudStamp) return;
    this.hudStamp = stamp;
    this.onHUD?.({
      p1: snap(this.p1),
      p2: snap(this.p2),
      timer: this.practice ? 999 : Math.ceil(this.timer),
      round: this.round,
      roundLabel: this.mode === "training" ? "TRAINING" : this.runLabel || (last ? "FINAL" : `ROUND ${this.round}`),
      message: this.message,
      combo,
      finish: this.state === "finish",
      finishHint: this.state === "finish" ? this.finishCommands() : "",
      paused: this.paused,
      mode: this.mode,
      lowLife: { p1: this.p1.health / this.p1.maxHealth < 0.25, p2: this.p2.health / this.p2.maxHealth < 0.25 },
      superReady: { p1: this.p1.superMeter >= 100, p2: this.p2.superMeter >= 100 },
      lastRound: last && this.state === "intro",
      inputHistory: this.input.history.map((h) => h.label),
      trainingDamage: Math.round(this.lastTrainingDmg),
      recording: this.recorder.label,
      challenge: this.mode === "challenge" ? this.challenges.label : "",
      hitstopFrames: this.hitStop.remaining,
      lastHitstop: this.hitStop.lastFrames,
      runLabel: this.runLabel,
      winsNeeded: this.winsNeeded,
      combatEvent: this.lastEvent,
      comboScale: this.lastScale,
      frameAdv: this.lastAdv,
    });
  }

  private finishCommands() {
    const f = this.finisher;
    if (!f) return "";
    return f.data.finishes.map((x) => `${x.name}: ${commandLabel(x.command)}`).join("   ·   ");
  }

  draw() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#050407";
    c.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
    c.save();
    this.camera.apply(c);
    drawStage(c, this.stage, this.time, this.camera.x, this.gfx.stageFx);
    const preview = this.mode === "training" ? this.training.previewClip : undefined;
    const debug = this.gfx.debugSprites || !!preview;
    drawFighter(c, this.p1, this.sprites[0], this.gfx.shadows, debug, preview);
    drawFighter(c, this.p2, this.sprites[1], this.gfx.shadows, this.gfx.debugSprites);
    if (this.hitStop.frozen && this.hitStop.fx && this.hitStop.victim) {
      c.save();
      c.globalAlpha = 0.22 * this.hitStop.t;
      c.translate(-this.hitStop.dir * 12, 0);
      drawFighter(c, this.hitStop.victim, this.hitStop.victim === this.p1 ? this.sprites[0] : this.sprites[1], false);
      c.restore();
    }
    for (const p of this.projectiles) drawProjectile(c, p);
    this.hitStop.drawWorld(c);
    this.particles.draw(c);
    if (this.training.showHitboxes && this.mode === "training") {
      drawHitboxes(c, this.p1);
      drawHitboxes(c, this.p2);
    }
    if (this.gfx.bloom) {
      c.fillStyle = "rgba(80,10,14,0.08)";
      c.fillRect(-80, -40, 1440, 800);
    }
    if (this.state === "finish") {
      c.fillStyle = "rgba(20,0,0,0.35)";
      c.fillRect(-80, -40, 1440, 800);
    }
    c.restore();
    if (!this.gfx.reduceFlashes) this.hitStop.drawScreen(c);
  }
}

function drawProjectile(c: CanvasRenderingContext2D, p: Proj) {
  const color = p.kind === "needle" ? "#e6d4ff"
    : p.kind === "veil" ? "#d46bff"
    : p.kind === "altar" ? "#ff3358"
    : p.kind === "scythe-wave" ? "#ff4d3a"
    : "#ff6a3c";
  c.save();
  c.translate(p.x + p.w / 2, p.y + p.h / 2);
  c.fillStyle = color;
  c.strokeStyle = color;
  c.shadowColor = color;
  c.shadowBlur = 10;
  if (p.kind === "needle") {
    if (p.vx < 0) c.scale(-1, 1);
    c.beginPath();
    c.moveTo(p.w * 0.55, 0);
    c.lineTo(-p.w * 0.4, -4);
    c.lineTo(-p.w * 0.15, 0);
    c.lineTo(-p.w * 0.4, 4);
    c.closePath();
    c.fill();
  } else if (p.kind === "veil") {
    c.lineWidth = 5;
    c.beginPath();
    const a0 = p.vx >= 0 ? -1.05 : Math.PI - 1.05;
    const a1 = p.vx >= 0 ? 1.05 : Math.PI + 1.05;
    c.arc(0, 0, Math.max(10, p.h * 0.85), a0, a1);
    c.stroke();
  } else if (p.kind === "altar") {
    c.lineWidth = 3;
    c.strokeRect(-p.w / 2, -p.h / 2, p.w, p.h);
    c.beginPath();
    c.moveTo(-10, 0); c.lineTo(10, 0); c.moveTo(0, -10); c.lineTo(0, 10);
    c.stroke();
  } else {
    c.beginPath();
    c.ellipse(0, 0, p.w / 2, Math.max(6, p.h / 2), 0, 0, Math.PI * 2);
    c.globalAlpha = 0.85;
    c.fill();
    if (p.kind === "scythe-wave") {
      c.globalAlpha = 1;
      c.strokeStyle = "#f4e4c4";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, 2, p.w * 0.32, Math.PI * 1.05, Math.PI * 1.95);
      c.stroke();
    }
  }
  c.restore();
}

function snap(f: Fighter): FighterSnap {
  return {
    name: f.name,
    portrait: f.data.portrait,
    health: f.health,
    maxHealth: f.maxHealth,
    meter: f.meter,
    superMeter: f.superMeter,
    roundWins: f.roundWins,
  };
}

function resolvePalette(
  list: import("../assets/types").PaletteDef[] | undefined,
  pick: number | string | undefined,
  fallbackIndex: number,
) {
  if (typeof pick === "string") {
    const found = list?.find((p) => p.id === pick);
    if (found) return found;
  }
  const idx = typeof pick === "number" ? pick : fallbackIndex;
  return paletteAt(list, idx);
}

