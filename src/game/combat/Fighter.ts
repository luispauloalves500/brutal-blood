import { GAME } from "../core/config";
import type { CharacterDef, MoveDef } from "../characters/types";

export type FighterState =
  | "idle" | "walk" | "walkBack" | "dash" | "jump" | "crouch"
  | "block" | "attack" | "hit" | "knockdown" | "wakeup"
  | "ko" | "victory" | "intro" | "finish" | "throw" | "thrown"
  | "counter" | "taunt";

export class Fighter {
  data: CharacterDef;
  name: string;
  x: number;
  y: number;
  vx = 0;
  vy = 0;
  w = 76;
  h = 150;
  facing = 1;
  isAI = false;
  maxHealth: number;
  health: number;
  meter = 0;
  superMeter = 0;
  state: FighterState = "idle";
  stateTime = 0;
  attack: MoveDef | null = null;
  attackFrame = 0;
  hitDone = false;
  hitsLanded = 0;
  grounded = true;
  blocking = false;
  crouching = false;
  hitFlash = 0;
  stun = 0;
  roundWins = 0;
  invuln = 0;
  dashTime = 0;
  comboHits = 0;
  comboDamage = 0;
  maxCombo = 0;
  comboTimer = 0;
  lastHitWasCounter = false;
  cancelReady = false;
  introT = 0;
  finishVictim = false;
  scaleX = 1;
  scaleY = 1;
  /** 0–1 squash applied on top of scale during/after hitstop. */
  impactSquash = 0;

  constructor({ x, y, facing = 1, data, isAI = false }: { x: number; y: number; facing?: number; data: CharacterDef; isAI?: boolean }) {
    this.data = data;
    this.name = data.name;
    this.x = x;
    this.y = y;
    this.facing = facing;
    this.isAI = isAI;
    this.maxHealth = data.stats.maxHealth;
    this.health = this.maxHealth;
  }

  reset(x: number, facing: number, keepMeter = false) {
    this.x = x;
    this.y = GAME.FLOOR - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.health = this.maxHealth;
    if (!keepMeter) {
      this.meter = 0;
      this.superMeter = 0;
    }
    this.state = "idle";
    this.stateTime = 0;
    this.attack = null;
    this.attackFrame = 0;
    this.hitDone = false;
    this.hitsLanded = 0;
    this.grounded = true;
    this.blocking = false;
    this.crouching = false;
    this.stun = 0;
    this.hitFlash = 0;
    this.invuln = 0;
    this.dashTime = 0;
    this.comboHits = 0;
    this.comboDamage = 0;
    this.comboTimer = 0;
    this.cancelReady = false;
    this.finishVictim = false;
    this.scaleX = 1;
    this.scaleY = 1;
    this.impactSquash = 0;
  }

  canAct() {
    return this.stun <= 0 && !["attack", "hit", "ko", "knockdown", "wakeup", "throw", "thrown", "finish", "victory", "counter"].includes(this.state);
  }

  canCancel(into: string) {
    if (!this.cancelReady || this.state !== "attack" || !this.attack) return false;
    return this.attack.cancelInto?.includes(into) ?? false;
  }

  move(dir: number) {
    if (!this.canAct() || this.blocking || this.crouching || !this.grounded) return;
    const toward = Math.sign(dir) === this.facing;
    const spd = toward ? this.data.stats.speed : this.data.stats.backSpeed;
    this.vx = dir * spd;
    this.state = dir ? (toward ? "walk" : "walkBack") : "idle";
  }

  stop() {
    if (this.canAct() && this.grounded && !this.blocking && !this.crouching) {
      this.vx = 0;
      this.state = "idle";
    }
  }

  crouch(on: boolean) {
    if (!this.grounded || this.blocking) return;
    if (!this.canAct() && this.state !== "crouch") return;
    this.crouching = on;
    if (on) {
      this.vx = 0;
      this.state = "crouch";
    } else if (this.state === "crouch") this.state = "idle";
  }

  jump() {
    if (this.grounded && this.canAct() && !this.blocking && !this.crouching) {
      this.vy = -this.data.stats.jump;
      this.grounded = false;
      this.state = "jump";
    }
  }

  dash(dir: number) {
    if (!this.canAct() || !this.grounded || this.blocking) return;
    this.dashTime = 0.18;
    this.vx = dir * this.data.stats.dashSpeed;
    this.state = "dash";
    this.crouching = false;
  }

  block(on: boolean) {
    if (this.state === "ko" || this.state === "finish") return;
    if (!this.canAct() && this.state !== "block") return;
    this.blocking = on;
    if (on && this.grounded) {
      this.vx = 0;
      this.state = "block";
    } else if (this.state === "block") this.state = "idle";
  }

  startAttack(move: MoveDef, cancel = false): boolean {
    if (!move) return false;
    if (!cancel && !this.canAct() && this.state !== "taunt") return false;
    if (this.blocking) return false;
    if (move.cost && this.meter < move.cost) return false;
    if (move.superCost && this.superMeter < move.superCost) return false;
    if (move.cost) this.meter -= move.cost;
    if (move.superCost) this.superMeter -= move.superCost;
    this.crouching = false;
    this.attack = move;
    this.state = move.type === "throw" ? "throw" : move.type === "counter" ? "counter" : move.type === "taunt" ? "taunt" : "attack";
    this.stateTime = 0;
    this.attackFrame = 0;
    this.hitDone = false;
    this.hitsLanded = 0;
    this.cancelReady = false;
    this.vx = move.advance ? this.facing * move.advance * 0.25 : 0;
    if (move.invuln) this.invuln = move.invuln * GAME.FRAME;
    return true;
  }

  takeHit(move: MoveDef, fromX: number, scaled: number, blocked: boolean, counter = false) {
    if (this.state === "ko" || this.state === "finish" || this.invuln > 0) return { dmg: 0, blocked: true };
    const def = this.data.stats.defense;
    let dmg = (move.damage * scaled) / def;
    let kb = move.knockback;
    this.lastHitWasCounter = counter;
    if (blocked) {
      dmg *= 0.18;
      kb *= 0.22;
      this.meter = Math.min(100, this.meter + 8);
      this.superMeter = Math.min(100, this.superMeter + 4);
      this.hitFlash = 0.05;
      this.stun = move.blockStun * GAME.FRAME;
    } else {
      this.state = move.knockdown ? "knockdown" : "hit";
      this.stun = (move.hitStun + (counter ? 4 : 0)) * GAME.FRAME;
      this.hitFlash = 0.12;
      this.crouching = false;
      this.blocking = false;
      this.attack = null;
      this.comboHits += 1;
      this.comboDamage += dmg;
      this.maxCombo = Math.max(this.maxCombo, this.comboHits);
      this.comboTimer = GAME.COMBO_DROP + this.stun;
      if (move.launcher && this.grounded) {
        this.vy = -520;
        this.grounded = false;
      }
    }
    this.health = Math.max(0, this.health - dmg);
    this.vx = Math.sign(this.x - fromX) * kb;
    this.superMeter = Math.min(100, this.superMeter + (blocked ? 3 : 6) + (counter ? 4 : 0));
    this.meter = Math.min(100, this.meter + (blocked ? 2 : 5));
    if (this.health <= 0) {
      this.state = "ko";
      this.blocking = false;
      this.attack = null;
      this.vx = Math.sign(this.x - fromX) * 520;
      this.vy = -520;
      this.grounded = false;
    }
    return { dmg, blocked };
  }

  gainOnHit(move: MoveDef, hits: number) {
    this.meter = Math.min(100, this.meter + (move.meterGain || 0));
    this.superMeter = Math.min(100, this.superMeter + (move.superGain || 8) + hits * 2);
  }

  update(dt: number, frozen = false) {
    if (frozen && this.state !== "attack") {
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.impactSquash *= Math.exp(-10 * dt);
      return;
    }
    this.stateTime += dt;
    this.attackFrame += 1;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.stun = Math.max(0, this.stun - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.comboTimer = Math.max(0, this.comboTimer - dt);
    this.impactSquash *= Math.exp(-14 * dt);
    if (this.impactSquash < 0.02) this.impactSquash = 0;
    if (this.comboTimer <= 0 && this.state !== "hit" && this.state !== "knockdown") {
      this.comboHits = 0;
      this.comboDamage = 0;
    }
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      if (this.dashTime <= 0 && this.state === "dash") this.state = "idle";
    }

    if (!this.grounded) this.vy += GAME.GRAVITY * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.x = Math.max(30, Math.min(GAME.WIDTH - 30 - this.w, this.x));
    if (this.y + this.h >= GAME.FLOOR) {
      const wasAir = !this.grounded;
      this.y = GAME.FLOOR - this.h;
      this.vy = 0;
      this.grounded = true;
      if (this.state === "jump") this.state = "idle";
      if (this.state === "knockdown" && this.stun <= 0) {
        this.state = "wakeup";
        this.stateTime = 0;
      }
      if (wasAir && this.state === "ko") this.vx *= 0.4;
    }

    if (this.state === "wakeup" && this.stateTime > 0.35) this.state = "idle";

    const a = this.attack;
    if ((this.state === "attack" || this.state === "throw" || this.state === "counter" || this.state === "taunt") && a) {
      const total = a.startup + a.active + a.recovery;
      if (this.attackFrame > total) {
        this.state = "idle";
        this.attack = null;
        this.attackFrame = 0;
        this.cancelReady = false;
      }
      if (a.advance && this.attackFrame >= a.startup && this.attackFrame < a.startup + a.active) {
        this.x += this.facing * a.advance * dt;
      }
    }
    if (this.state === "hit" && this.stun <= 0) this.state = "idle";
    if (["ko", "hit", "knockdown", "thrown"].includes(this.state)) this.vx *= 0.96;
    else if (!["walk", "walkBack", "dash"].includes(this.state)) this.vx *= 0.72;

    const breath = 1 + Math.sin(this.stateTime * 6) * 0.015;
    this.scaleY = this.state === "crouch" ? 0.82 : this.state === "jump" ? 1.08 : breath;
    this.scaleX = this.state === "crouch" ? 1.12 : this.state === "jump" ? 0.92 : 1;
  }

  /** Presentation-only tick while the match is in hitstop. */
  presentFrozen(dt: number) {
    this.hitFlash = Math.max(this.hitFlash, this.state === "hit" || this.state === "knockdown" || this.state === "ko" ? 0.14 : 0.05);
    this.impactSquash = Math.max(this.impactSquash * Math.exp(-3 * dt), 0.32);
  }

  getAttackBox(): { x: number; y: number; w: number; h: number } | null {
    if (!this.attack || this.hitDone) return null;
    if (!["attack", "throw", "counter"].includes(this.state)) return null;
    const a = this.attack;
    if (this.attackFrame < a.startup || this.attackFrame >= a.startup + a.active) return null;
    if (a.projectile) return null;
    const range = a.range * this.data.stats.range;
    const crouch = this.state === "crouch" || a.height === "low";
    const y = this.y + (crouch ? 70 : a.antiAir ? -10 : 22);
    const h = a.antiAir ? this.h + 20 : this.h - (crouch ? 70 : 46);
    return {
      x: this.facing > 0 ? this.x + this.w - 8 : this.x - range,
      y,
      w: range,
      h,
    };
  }

  getHurtBox() {
    const crouch = this.state === "crouch";
    return {
      x: this.x + 8,
      y: this.y + (crouch ? 48 : 0),
      w: this.w - 16,
      h: this.h - (crouch ? 48 : 0),
    };
  }

  isBlockingHeight(height: MoveDef["height"]) {
    if (!this.blocking || !this.grounded) return false;
    if (height === "low" && !this.crouching) return false;
    if (height === "high" && this.crouching) return false;
    return true;
  }
}

export function intersects(
  a: { x: number; y: number; w: number; h: number } | null,
  b: { x: number; y: number; w: number; h: number } | null,
) {
  return !!(a && b && a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
}
