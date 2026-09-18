import type { AttackButtonHit, Input } from "../input/Input";
import type { CharacterDef, MoveDef } from "../characters/types";

const BUTTON_LETTER: Record<AttackButtonHit, string> = {
  light: "L",
  medium: "M",
  heavy: "H",
  kickLight: "K",
  kickHeavy: "U",
  special: "S",
  super: "O",
  throw: "T",
  taunt: "P",
};

export class CommandBuffer {
  private dirs: { n: number; f: number }[] = [];
  frame = 0;
  private lastForwardTap = -99;
  private lastBackTap = -99;
  private forwardHeld = false;
  private backHeld = false;

  tick(input: Input, slot: "p1" | "p2", facing: number) {
    this.frame++;
    const n = input.numpad(slot, facing);
    const last = this.dirs[this.dirs.length - 1];
    if (!last || last.n !== n) this.dirs.push({ n, f: this.frame });
    while (this.dirs.length && this.frame - this.dirs[0].f > 48) this.dirs.shift();

    const fwd = n === 6 || n === 9 || n === 3;
    const back = n === 4 || n === 7 || n === 1;
    if (fwd && !this.forwardHeld) this.lastForwardTap = this.frame;
    if (back && !this.backHeld) this.lastBackTap = this.frame;
    this.forwardHeld = fwd;
    this.backHeld = back;
  }

  dashDir(): 0 | 1 | -1 {
    if (this.frame - this.lastForwardTap <= 16 && this.forwardHeld && this.countTap(6) >= 2) return 1;
    if (this.frame - this.lastBackTap <= 16 && this.backHeld && this.countTap(4) >= 2) return -1;
    return 0;
  }

  private countTap(dir: number) {
    return this.dirs.filter((d) => (d.n === dir || d.n === dir + 3 || d.n === dir - 3) && this.frame - d.f < 14).length;
  }

  matchMotion(motion: string): boolean {
    if (!motion) return true;
    if (motion === "66") return this.dashDir() === 1;
    if (motion === "44") return this.dashDir() === -1;
    const seq = motion.split("").map(Number);
    let idx = seq.length - 1;
    for (let i = this.dirs.length - 1; i >= 0 && idx >= 0; i--) {
      const d = this.dirs[i];
      if (this.frame - d.f > 28) break;
      if (this.motionEq(d.n, seq[idx])) idx--;
    }
    return idx < 0;
  }

  private motionEq(got: number, want: number) {
    if (got === want) return true;
    if (want === 2) return got === 1 || got === 2 || got === 3;
    if (want === 6) return got === 3 || got === 6 || got === 9;
    if (want === 4) return got === 1 || got === 4 || got === 7;
    if (want === 8) return got === 7 || got === 8 || got === 9;
    if (want === 3) return got === 3 || got === 2 || got === 6;
    return false;
  }

  resolveMove(data: CharacterDef, button: AttackButtonHit, airborne: boolean, finish = false): MoveDef | null {
    if (finish) {
      for (const fin of data.finishes) {
        const parsed = parseCommand(fin.command);
        if (this.buttonOk(parsed.button, button) && this.matchMotion(parsed.motion)) {
          return data.moves[fin.id] ?? dummyFinish(fin.id, fin.name);
        }
      }
      return null;
    }
    if (airborne && (button === "light" || button === "medium" || button === "heavy" || button === "kickLight" || button === "kickHeavy")) {
      return data.moves.aerial ?? data.moves.light;
    }
    const candidates = Object.values(data.moves)
      .filter((m) => m.command && this.buttonOk(parseCommand(m.command).button, button))
      .sort((a, b) => (b.command?.length ?? 0) - (a.command?.length ?? 0));
    for (const m of candidates) {
      const { motion } = parseCommand(m.command!);
      if (this.matchMotion(motion)) return m;
    }
    if (button === "special") {
      const def = data.moves[data.specials[0]];
      if (def) return def;
    }
    if (button === "super") return data.moves[data.super] ?? null;
    return data.moves[button] ?? null;
  }

  private buttonOk(want: string, got: AttackButtonHit) {
    const letter = BUTTON_LETTER[got];
    if (!want) return true;
    if (want === letter) return true;
    if (want === "S" && (got === "special" || got === "light" || got === "heavy")) return true;
    if (want === "O" && (got === "super" || got === "heavy" || got === "special")) return true;
    if (want === "P" && (got === "light" || got === "medium" || got === "heavy")) return true;
    if (want === "K" && (got === "kickLight" || got === "kickHeavy" || got === "special")) return true;
    if (want === "U" && (got === "kickHeavy" || got === "heavy")) return true;
    return false;
  }

  reset() {
    this.dirs = [];
    this.frame = 0;
    this.lastForwardTap = -99;
    this.lastBackTap = -99;
  }
}

export function parseCommand(cmd: string): { motion: string; button: string } {
  const m = cmd.match(/^([0-9]*)([A-Z])?$/);
  return { motion: m?.[1] ?? "", button: m?.[2] ?? "" };
}

export function commandLabel(cmd: string): string {
  const { motion, button } = parseCommand(cmd);
  const dir: Record<string, string> = {
    "2": "Baixo",
    "4": "Trás",
    "6": "Frente",
    "8": "Cima",
    "22": "Baixo, baixo",
    "66": "Frente, frente",
    "44": "Trás, trás",
    "236": "Baixo, frente",
    "214": "Baixo, trás",
    "623": "Frente, baixo, frente",
    "236236": "QCF x2",
  };
  const btn: Record<string, string> = {
    L: "Leve",
    M: "Médio",
    H: "Pesado",
    K: "Chute",
    U: "Chute pesado",
    S: "Especial",
    O: "Super",
    T: "Agarrão",
    P: "Soco",
  };
  const d = dir[motion] ?? (motion ? motion : "—");
  return button ? `${d} + ${btn[button] ?? button}` : d;
}

function dummyFinish(id: string, name: string): MoveDef {
  return {
    id, name, type: "finish", damage: 0, range: 0, startup: 8, active: 20, recovery: 10,
    hitStun: 0, blockStun: 0, knockback: 0, priority: 10, meterGain: 0,
  };
}
