import { GAME, type Difficulty } from "../core/config";
import { Fighter, intersects } from "./Fighter";
import { FighterAI, type TrainingCpu } from "../ai/FighterAI";
import { CommandBuffer } from "./commands";
import { Input, type AttackButtonHit } from "../input/Input";
import { Camera } from "../core/camera";
import { ParticlePool } from "../core/particles";
import { AudioManager } from "../audio/AudioManager";
import { drawStage, getStage, type StageDef } from "../graphics/stages";
import { drawFighter, drawHitboxes } from "../graphics/drawFighter";
import { SpriteAnimator } from "../graphics/SpriteAnimator";
import type { CharacterDef, MoveDef } from "../characters/types";
import type { GraphicsSettings } from "../core/config";
import { getSave } from "../core/save";
import { HitStop, computeHitstop, HITSTOP } from "./hitstop";
import type { FightAssetPack } from "../assets";
import { comboScale, stunScale, COMBO_LIMIT, onHitAdv, onBlockAdv } from "./frameData";

export type MatchMode = "arcade" | "versus" | "training" | "survival" | "tournament" | "story";

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
};

type Proj = {
  x: number; y: number; vx: number; w: number; h: number;
  owner: Fighter; damage: number; knock: number; life: number; kind: string; hit: boolean;
  hitstop: number;
};

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
  message = "";
  hitStop = new HitStop();
  comboOwner: 1 | 2 | 0 = 0;
  finishTimer = 0;
  finisher: Fighter | null = null;
  victim: Fighter | null = null;
  finishName = "";
  time = 0;
  buf1 = new CommandBuffer();
  buf2 = new CommandBuffer();
  projectiles: Proj[] = [];
  training: TrainingOpts = { infiniteHp: true, infiniteMeter: true, showHitboxes: false, showFrameData: true, cpu: "stand" };
  lastTrainingDmg = 0;
  private pendingCancel: { fighter: Fighter; move: MoveDef } | null = null;
  private lastEvent = "";
  private eventTime = 0;
  private lastScale = 1;
  private lastAdv = 0;
  private hudStamp = "";
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
    if (this.ai && opts.mode === "training") this.ai.mode = this.training.cpu;
    this.sprites = [
      new SpriteAnimator(opts.p1Data.id, opts.assets?.p1 ?? null),
      new SpriteAnimator(opts.p2Data.id, opts.assets?.p2 ?? null),
    ];
    this.timer = opts.mode === "training" ? 999 : GAME.ROUND_TIME;
    this.onHUD = opts.onHUD;
    this.onMatchEnd = opts.onMatchEnd;
    this.winsNeeded = opts.winsNeeded ?? GAME.WINS_NEEDED;
    this.runLabel = opts.runLabel ?? "";
    this.particles.enabled = opts.gfx.particles;
    this.camera.setShake(opts.gfx.screenShake);
    this.hitStop.configure(opts.gfx.hitstop !== false, opts.gfx.effects);
    this.message = opts.mode === "training" ? "TREINO" : opts.runLabel || (opts.mode === "survival" ? "ONDA 1" : "ROUND 1");
    this.p1.state = "intro";
    this.p2.state = "intro";
    if (opts.carry) {
      this.p1.health = Math.min(this.p1.maxHealth, Math.max(1, opts.carry.health));
      this.p1.meter = opts.carry.meter;
      this.p1.superMeter = opts.carry.superMeter;
    }
  }

  applyTraining(t: TrainingOpts) {
    this.training = t;
    if (this.ai) this.ai.mode = t.cpu;
  }

  togglePause(v?: boolean) {
    this.paused = v ?? !this.paused;
    this.onPause?.(this.paused);
  }

  restartRound() {
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

  resetPositions() {
    this.p1.x = 240;
    this.p2.x = 960;
    this.p1.y = GAME.FLOOR - this.p1.h;
    this.p2.y = GAME.FLOOR - this.p2.h;
    this.p1.vx = this.p2.vx = 0;
  }

  step() {
    const dt = GAME.FRAME;
    if (this.paused) {
      this.emitHud();
      return;
    }
    if (this.state !== "ended" && this.input.consume("p1", "pause")) this.togglePause();

    const gfx = getSave().graphics;
    this.hitStop.configure(gfx.hitstop !== false, gfx.effects);
    this.camera.setShake(gfx.screenShake);
    this.particles.enabled = gfx.particles;

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
      if (this.stateTime > 0.15 && this.p1.state === "intro") {
        this.p1.state = "idle";
        this.p2.state = "idle";
      }
      if (this.stateTime > 1 && this.stateTime < 1.8) {
        this.message = this.mode === "training" ? "PRATIQUE" : "FIGHT";
      }
      if (this.stateTime > 1.85) {
        this.message = "";
        this.state = "fight";
        this.stateTime = 0;
      }
      this.camera.follow(this.p1.x, this.p2.x);
      this.camera.update(dt);
      this.emitHud();
      return;
    }

    if (this.state === "ended") {
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

    if (this.mode !== "training") this.timer = Math.max(0, this.timer - dt);

    this.handleHuman(this.p1, "p1", this.buf1);
    if (this.mode === "versus") this.handleHuman(this.p2, "p2", this.buf2);
    else {
      if (this.ai && this.mode === "training") this.ai.mode = this.training.cpu;
      this.ai?.update(dt, this.p1);
    }

    this.p1.facing = this.p2.x >= this.p1.x ? 1 : -1;
    this.p2.facing = this.p1.x >= this.p2.x ? 1 : -1;

    this.p1.update(dt);
    this.p2.update(dt);
    this.updateProjectiles(dt);
    this.resolveCombat();
    this.separate();
    this.particles.update(dt);
    this.eventTime = Math.max(0, this.eventTime - dt);
    if (this.eventTime <= 0) this.lastEvent = "";

    if (this.mode === "training") this.updateTraining(dt);
    else if (this.p1.health <= 0 || this.p2.health <= 0 || this.timer <= 0) this.endRound();

    this.camera.follow(this.p1.x, this.p2.x);
    this.camera.update(dt);
    this.emitHud();
  }

  private runFrozen(dt: number) {
    this.buf1.tick(this.input, "p1", this.p1.facing);
    this.buf2.tick(this.input, "p2", this.p2.facing);
    this.latchCancel(this.p1, "p1", this.buf1);
    if (this.mode === "versus") this.latchCancel(this.p2, "p2", this.buf2);
    this.particles.update(dt * 0.22);
    this.camera.update(dt);
  }

  private latchCancel(f: Fighter, slot: "p1" | "p2", buf: CommandBuffer) {
    const btn = this.input.peekPressed(slot);
    if (!btn) return;
    const move = buf.resolveMove(f.data, btn, !f.grounded, false);
    if (move && f.canCancel(move.id)) this.pendingCancel = { fighter: f, move };
  }

  private flushCancel() {
    const pending = this.pendingCancel;
    this.pendingCancel = null;
    if (!pending) return;
    if (pending.fighter.startAttack(pending.move, true)) {
      const move = pending.move;
      if (move.type === "special" || move.type === "super") this.audio.special();
      else this.audio.whoosh();
      if (move.type === "super") this.armSuperFreeze(pending.fighter);
      if (move.projectile) this.spawnProjectile(pending.fighter, move);
    }
  }

  private armSuperFreeze(f: Fighter) {
    this.audio.super();
    this.camera.punch(1.22);
    this.camera.addTrauma(0.45);
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

  private handleHuman(f: Fighter, slot: "p1" | "p2", buf: CommandBuffer) {
    if (f.health <= 0) return;
    if (f.state === "knockdown") {
      if (this.input.isDown(slot, "down")) f.wakeupKind = "delay";
      else if (this.input.isDown(slot, "up")) f.wakeupKind = "quick";
      else f.wakeupKind = "normal";
      return;
    }
    const dash = buf.dashDir();
    if (dash && f.canAct()) {
      f.dash(dash * f.facing);
    }
    const block = this.input.isDown(slot, "block");
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
    const btn = this.input.peekPressed(slot);
    if (btn) this.tryAttack(f, buf, btn);
  }

  private tryAttack(f: Fighter, buf: CommandBuffer, btn: AttackButtonHit) {
    const move = buf.resolveMove(f.data, btn, !f.grounded, false);
    if (!move) return;
    const cancel = f.canCancel(move.id);
    const reversal = f.state === "wakeup";
    if (f.startAttack(move, cancel)) {
      if (reversal) this.noteEvent("REVERSAL");
      if (move.type === "special" || move.type === "super") this.audio.special();
      else this.audio.whoosh();
      if (move.type === "super") this.armSuperFreeze(f);
      if (move.projectile) this.spawnProjectile(f, move);
    }
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
    });
  }

  private updateProjectiles(dt: number) {
    this.projectiles = this.projectiles.filter((p) => {
      p.x += p.vx * dt;
      p.life -= dt;
      if (p.hit || p.life <= 0 || p.x < -80 || p.x > 1400) return false;
      const def = p.owner === this.p1 ? this.p2 : this.p1;
      if (def.state === "ko") return true;
      const box = { x: p.x, y: p.y, w: p.w, h: p.h };
      if (intersects(box, def.getHurtBox())) {
        p.hit = true;
        this.applyHit(p.owner, def, {
          ...p.owner.attack,
          damage: p.damage,
          knockback: p.knock,
          height: "mid",
          hitStun: 12,
          blockStun: 8,
          startup: 0, active: 1, recovery: 0, range: 40, priority: 3, meterGain: 4, id: "proj", name: "proj", type: "special",
          hitstop: p.hitstop,
        } as MoveDef);
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
      const commandGrab = !!att.attack.commandGrab || att.attack.type === "special";
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
      if (def.blocking || def.state === "attack") {
        att.hitDone = true;
        return;
      }
    }
    att.hitDone = true;
    if (!att.attack) return;
    this.applyHit(att, def, att.attack);
  }

  private applyHit(att: Fighter, def: Fighter, move: MoveDef) {
    if (def.state === "ko") return;
    const blocked = def.isBlockingHeight(move.height);
    const atk = def.attack;
    const inStartup = def.state === "attack" && atk && def.attackFrame < atk.startup + atk.active;
    const inRecovery = def.state === "attack" && atk && def.attackFrame >= atk.startup + atk.active;
    const counter = !!inStartup && !blocked;
    const punish = !!inRecovery && !blocked;
    const hits = (this.comboOwner === (att === this.p1 ? 1 : 2) ? def.comboHits : 0) + 1;
    const scale = comboScale(hits);
    this.lastScale = scale;
    const res = def.takeHit(move, att.x, scale * att.data.stats.strength, blocked, counter);
    if (!blocked && !res.blocked) def.stun *= stunScale(hits);
    this.lastTrainingDmg = res.dmg;
    this.lastAdv = blocked ? onBlockAdv(move) : onHitAdv(move);
    const impactX = def.x + def.w / 2;
    const impactY = def.y + (def.crouching ? 80 : 50);
    const dir = Math.sign(def.x - att.x) || att.facing;
    const ko = !blocked && def.health <= 0;
    const { frames, kind } = computeHitstop({ move, blocked, counter, ko });
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
      att.gainOnHit(move, hits);
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
      this.tryWallSplat(def, move);
      this.particles.spawn(impactX, impactY, kind === "ko" || move.type === "super" ? 22 : frames >= 7 ? 16 : 10, att.data.accent);
      this.camera.addTrauma(kind === "ko" ? 0.7 : move.type === "super" ? 0.55 : move.type === "special" || counter ? 0.32 : 0.16);
      if (frames >= 8) this.camera.punch(1.06 + frames * 0.012);
      this.audio.hit(move.button === "heavy" || move.button === "kickHeavy" || move.type === "special" || move.type === "super" || ko);
      if (frames >= 8) this.audio.thump();
      this.input.vibrate(att === this.p1 ? "p1" : "p2", 40 + frames * 6, 0.35 + frames * 0.03, 0.2);
      if (move.hits && att.hitsLanded < (move.hits - 1)) {
        att.hitDone = false;
        att.hitsLanded += 1;
      }
    } else {
      this.noteEvent("BLOCK");
      this.audio.block();
      this.particles.spawn(impactX, impactY, 6, "#8ec8ff", true);
      this.camera.addTrauma(0.08);
    }
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
  }

  private updateTraining(dt: number) {
    this.timer = 999;
    if (this.training.infiniteHp) {
      this.p1.health = this.p1.maxHealth;
      if (this.training.cpu !== "attack") this.p2.health = Math.max(this.p2.health, this.p2.maxHealth * 0.35);
    } else {
      this.p1.health = Math.max(1, this.p1.health);
    }
    if (this.training.infiniteMeter) {
      this.p1.meter = 100;
      this.p1.superMeter = 100;
    }
    if (this.p2.health <= 0) {
      this.trainingReset += dt;
      if (this.trainingReset > 0.8) {
        this.p2.reset(960, -1, true);
        this.trainingReset = 0;
      }
    } else this.trainingReset = 0;
  }

  private endRound() {
    if (this.roundOver) return;
    this.roundOver = true;
    const p1h = this.p1.health, p2h = this.p2.health;
    const double = p1h <= 0 && p2h <= 0;
    const timeover = this.timer <= 0 && p1h > 0 && p2h > 0;
    const winner = double ? null : p1h === p2h ? null : p1h > p2h ? this.p1 : this.p2;
    const loser = winner === this.p1 ? this.p2 : winner === this.p2 ? this.p1 : null;
    if (winner) winner.roundWins++;
    const perfect = winner && winner.health >= winner.maxHealth && !timeover;
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
      window.setTimeout(() => this.onMatchEnd?.(winner === this.p1), 1400);
      return;
    }
    this.roundResetAt = 2.1;
  }

  private updateFinish(dt: number) {
    this.finishTimer -= dt;
    this.p1.update(dt, true);
    this.p2.update(dt, true);
    this.particles.update(dt);
    this.camera.follow(this.p1.x, this.p2.x, true);
    this.camera.update(dt);
    const slot: "p1" | "p2" = this.finisher === this.p1 ? "p1" : "p2";
    const buf = slot === "p1" ? this.buf1 : this.buf2;
    if (this.finisher && this.input.peekPressed(slot)) {
      const btn = this.lastButton(slot);
      if (btn) {
        const move = buf.resolveMove(this.finisher.data, btn, false, true);
        if (move) {
          this.playFinish(move.name);
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

  private playFinish(name: string) {
    this.finishName = name;
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
      this.victim.health = 0;
    }
    window.setTimeout(() => this.concludeFinish(), 1600);
  }

  private concludeFinish() {
    if (this.state === "ended") return;
    this.state = "ended";
    if (this.finisher) this.finisher.state = "victory";
    this.message = this.finishName ? this.finishName : "VITÓRIA";
    window.setTimeout(() => this.onMatchEnd?.(this.finisher === this.p1), 1200);
  }

  private nextRound() {
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
    const stamp = `${Math.ceil(this.timer)}|${Math.round(this.p1.health)}|${Math.round(this.p2.health)}|${this.message}|${this.lastEvent}|${combo?.hits ?? 0}|${this.paused}|${this.hitStop.remaining}|${this.state}|${this.lastAdv}`;
    if (stamp === this.hudStamp) return;
    this.hudStamp = stamp;
    this.onHUD?.({
      p1: snap(this.p1),
      p2: snap(this.p2),
      timer: this.mode === "training" ? 999 : Math.ceil(this.timer),
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
    return f.data.finishes.map((x) => `${x.name}`).join("   ·   ");
  }

  draw() {
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = "#050407";
    c.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);
    c.save();
    this.camera.apply(c);
    drawStage(c, this.stage, this.time, this.camera.x, this.gfx.stageFx);
    drawFighter(c, this.p1, this.sprites[0], this.gfx.shadows, this.gfx.debugSprites);
    drawFighter(c, this.p2, this.sprites[1], this.gfx.shadows, this.gfx.debugSprites);
    if (this.hitStop.frozen && this.hitStop.fx && this.hitStop.victim) {
      c.save();
      c.globalAlpha = 0.22 * this.hitStop.t;
      c.translate(-this.hitStop.dir * 12, 0);
      drawFighter(c, this.hitStop.victim, this.hitStop.victim === this.p1 ? this.sprites[0] : this.sprites[1], false);
      c.restore();
    }
    for (const p of this.projectiles) {
      c.fillStyle = p.kind === "needle" ? "#d697ff" : "#ff6b4a";
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 12;
      c.fillRect(p.x, p.y, p.w, p.h);
      c.shadowBlur = 0;
    }
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
    this.hitStop.drawScreen(c);
  }
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
