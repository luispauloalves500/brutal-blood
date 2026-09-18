import type { Difficulty } from "../core/config";
import type { Fighter } from "../combat/Fighter";
import type { MoveDef } from "../characters/types";

type Profile = {
  reaction: number;
  aggression: number;
  block: number;
  combo: number;
  special: number;
  super: number;
  punish: number;
  readRange: number;
};

const PROFILES: Record<Difficulty, Profile> = {
  veryEasy: { reaction: 0.42, aggression: 0.22, block: 0.12, combo: 0.0, special: 0.04, super: 0.0, punish: 0.0, readRange: 140 },
  easy: { reaction: 0.3, aggression: 0.38, block: 0.28, combo: 0.18, special: 0.12, super: 0.0, punish: 0.1, readRange: 170 },
  normal: { reaction: 0.16, aggression: 0.55, block: 0.42, combo: 0.45, special: 0.28, super: 0.18, punish: 0.32, readRange: 210 },
  hard: { reaction: 0.09, aggression: 0.7, block: 0.6, combo: 0.72, special: 0.42, super: 0.42, punish: 0.58, readRange: 250 },
  brutal: { reaction: 0.055, aggression: 0.84, block: 0.74, combo: 0.88, special: 0.58, super: 0.68, punish: 0.8, readRange: 290 },
  nightmare: { reaction: 0.035, aggression: 0.92, block: 0.86, combo: 0.96, special: 0.72, super: 0.88, punish: 0.92, readRange: 330 },
};

export type TrainingCpu =
  | "stand"
  | "block"
  | "blockFirst"
  | "blockRandom"
  | "crouch"
  | "jump"
  | "attack"
  | "attackAfterBlock"
  | "normal";

export class FighterAI {
  f: Fighter;
  difficulty: Difficulty;
  think = 0;
  blockTime = 0;
  queue: string[] = [];
  queueDelay = 0;
  mode: TrainingCpu = "normal";
  private sawHit = false;

  constructor(fighter: Fighter, difficulty: Difficulty = "normal") {
    this.f = fighter;
    this.difficulty = difficulty;
  }

  setDifficulty(d: Difficulty) {
    this.difficulty = d;
  }

  update(dt: number, enemy: Fighter) {
    if (this.f.health <= 0 || this.f.state === "ko" || this.f.state === "finish") return;
    if (this.mode === "stand") {
      this.f.stop();
      this.f.block(false);
      return;
    }
    if (this.mode === "block") {
      this.f.block(true);
      this.f.stop();
      return;
    }
    if (this.mode === "blockFirst") {
      if (enemy.state === "attack" || this.sawHit) {
        this.sawHit = enemy.state === "attack" || this.sawHit;
        this.f.block(true);
        this.f.stop();
        return;
      }
      this.f.block(false);
      this.f.stop();
      return;
    }
    if (this.mode === "blockRandom") {
      if (Math.random() < 0.55) this.f.block(true);
      else this.f.block(false);
      this.f.stop();
      return;
    }
    if (this.mode === "crouch") {
      this.f.block(false);
      this.f.crouch(true);
      return;
    }
    if (this.mode === "attackAfterBlock") {
      if (this.f.state === "block" && enemy.state !== "attack") {
        this.f.block(false);
        this.tryMove("light");
        return;
      }
      if (enemy.state === "attack") {
        this.f.block(true);
        this.f.stop();
        return;
      }
      this.f.block(false);
      this.f.stop();
      return;
    }
    if (this.mode === "jump") {
      this.f.block(false);
      if (this.f.grounded) this.f.jump();
      return;
    }
    if (this.mode === "attack") {
      this.f.block(false);
      const dx = Math.sign(enemy.x - this.f.x);
      if (Math.abs(enemy.x - this.f.x) > 90) this.f.move(dx);
      else this.tryMove("light");
      return;
    }

    const p = PROFILES[this.difficulty];
    if (this.blockTime > 0) {
      this.blockTime -= dt;
      if (this.blockTime <= 0) this.f.block(false);
      return;
    }
    if (this.queue.length) {
      this.queueDelay -= dt;
      if (this.queueDelay <= 0) {
        const id = this.queue.shift()!;
        this.tryMove(id);
        this.queueDelay = 0.08 + Math.random() * 0.06;
      }
      return;
    }

    this.think -= dt;
    if (this.think > 0) return;
    this.think = p.reaction + Math.random() * p.reaction * 0.5;

    const dx = enemy.x - this.f.x;
    const dist = Math.abs(dx);
    this.f.facing = Math.sign(dx) || this.f.facing;

    const enemyAttacking = enemy.state === "attack" && enemy.attack;
    const danger = enemyAttacking && dist < (enemy.attack?.range ?? 90) + 40;

    if (danger && Math.random() < p.block) {
      this.f.block(true);
      this.blockTime = 0.1 + Math.random() * 0.18;
      return;
    }

    if (enemyAttacking && enemy.attack && dist < 200 && Math.random() < p.punish && this.isUnsafe(enemy)) {
      this.f.block(false);
      if (dist > 110) this.tryMove("special1");
      else this.tryMove("heavy");
      return;
    }

    this.f.block(false);
    this.f.crouch(false);

    if (this.f.superMeter >= 100 && Math.random() < p.super && dist < 180) {
      this.tryMove("super");
      return;
    }

    if (dist > p.readRange) {
      this.f.move(Math.sign(dx));
      if (Math.random() < 0.04) this.f.jump();
      return;
    }
    if (!enemy.grounded && dist < 160 && Math.random() < p.punish) {
      this.tryMove("special2");
      return;
    }
    if (dist < 70 && Math.random() < 0.28) {
      this.f.move(-Math.sign(dx));
      return;
    }
    this.f.stop();

    if (!this.f.canAct()) return;

    if (Math.random() > p.aggression) return;

    if (dist < 56 && Math.random() < 0.2) {
      this.tryMove("throw");
      return;
    }

    const r = Math.random();
    if (r < 0.42) {
      this.tryMove("light");
      if (Math.random() < p.combo) this.queueCombo();
    } else if (r < 0.62) this.tryMove("medium");
    else if (r < 0.78) this.tryMove("heavy");
    else if (r < 0.88) this.tryMove("kickHeavy");
    else if (this.f.meter >= 30 && Math.random() < p.special) {
      const spec = this.f.data.specials[Math.floor(Math.random() * this.f.data.specials.length)];
      this.tryMove(spec);
    }
  }

  private isUnsafe(enemy: Fighter) {
    const a = enemy.attack;
    if (!a) return false;
    const leftover = a.startup + a.active + a.recovery - enemy.attackFrame;
    return leftover >= 10 && enemy.hitDone;
  }

  private queueCombo() {
    const list = this.f.data.combos.filter((c) => c.level === "basic" || c.level === "intermediate");
    if (!list.length) return;
    const c = list[Math.floor(Math.random() * list.length)];
    this.queue = c.sequence.slice(1);
    this.queueDelay = 0.09;
  }

  private tryMove(id: string) {
    const m: MoveDef | undefined = this.f.data.moves[id];
    if (!m) return;
    if (this.f.state === "attack" && this.f.canCancel(id)) this.f.startAttack(m, true);
    else this.f.startAttack(m);
  }
}
