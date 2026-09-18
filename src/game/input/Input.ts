import {
  DEFAULT_BINDINGS,
  GAMEPAD_DEFAULT,
  type ActionName,
} from "../core/config";
import type { Bindings } from "../core/save";

const ALL_ACTIONS: ActionName[] = [
  "left", "right", "up", "down", "light", "medium", "heavy",
  "kickLight", "kickHeavy", "special", "super", "block", "throw", "taunt", "pause",
];

const ATTACK_ACTIONS: ActionName[] = [
  "light", "medium", "heavy", "kickLight", "kickHeavy", "special", "super", "throw", "taunt",
];

type PadMap = typeof GAMEPAD_DEFAULT;

export class Input {
  bindings: Bindings;
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private virtual = new Set<ActionName>();
  private virtualPressed = new Set<ActionName>();
  private injected = new Set<string>();
  private gamepadActions: [Set<ActionName>, Set<ActionName>] = [new Set(), new Set()];
  private gamepadPrev: [Set<ActionName>, Set<ActionName>] = [new Set(), new Set()];
  private pads: (Gamepad | null)[] = [null, null];
  rumble = true;
  private attached = false;
  private onKeyDown?: (e: KeyboardEvent) => void;
  private onKeyUp?: (e: KeyboardEvent) => void;
  private onBlur?: () => void;
  private remapTarget: { slot: "p1" | "p2"; action: ActionName } | null = null;
  onRemap?: (code: string) => void;
  lastDevice: "keyboard" | "gamepad" = "keyboard";
  history: { label: string; t: number }[] = [];
  frame = 0;

  constructor(bindings: Bindings = structuredClone(DEFAULT_BINDINGS)) {
    this.bindings = bindings;
  }

  attach() {
    if (this.attached || typeof window === "undefined") return;
    this.attached = true;
    this.onKeyDown = (e) => {
      if (this.remapTarget) {
        e.preventDefault();
        this.finishRemap(e.code);
        return;
      }
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (this.isGameCode(e.code)) e.preventDefault();
    };
    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
      this.injected.delete(e.code);
    };
    this.onBlur = () => this.clearAll();
    addEventListener("keydown", this.onKeyDown);
    addEventListener("keyup", this.onKeyUp);
    addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
    addEventListener("gamepadconnected", this.onPad);
    addEventListener("gamepaddisconnected", this.onPad);
  }

  detach() {
    if (!this.attached) return;
    this.attached = false;
    if (this.onKeyDown) removeEventListener("keydown", this.onKeyDown);
    if (this.onKeyUp) removeEventListener("keyup", this.onKeyUp);
    if (this.onBlur) {
      removeEventListener("blur", this.onBlur);
      document.removeEventListener("visibilitychange", this.onBlur);
    }
    removeEventListener("gamepadconnected", this.onPad);
    removeEventListener("gamepaddisconnected", this.onPad);
  }

  private onPad = () => {
    this.lastDevice = "gamepad";
  };

  beginRemap(slot: "p1" | "p2", action: ActionName) {
    this.remapTarget = { slot, action };
  }

  private finishRemap(code: string) {
    if (!this.remapTarget) return;
    const { slot, action } = this.remapTarget;
    this.bindings[slot][action] = [code];
    this.remapTarget = null;
    this.onRemap?.(code);
  }

  cancelRemap() {
    this.remapTarget = null;
  }

  setVirtual(action: ActionName, down: boolean) {
    if (down) {
      if (!this.virtual.has(action)) this.virtualPressed.add(action);
      this.virtual.add(action);
    } else {
      this.virtual.delete(action);
    }
  }

  injectCodes(codes: string[]) {
    const next = new Set(codes);
    for (const c of next) {
      if (!this.injected.has(c) && !this.keys.has(c)) this.pressed.add(c);
    }
    this.injected = next;
  }

  private isGameCode(code: string) {
    const all = [...Object.values(this.bindings.p1).flat(), ...Object.values(this.bindings.p2).flat()];
    return all.includes(code) || code.startsWith("Arrow") || code === "Space";
  }

  poll() {
    this.frame++;
    this.pollGamepads();
  }

  private pollGamepads() {
    if (typeof navigator === "undefined" || !navigator.getGamepads) return;
    const list = navigator.getGamepads();
    this.gamepadPrev = [new Set(this.gamepadActions[0]), new Set(this.gamepadActions[1])];
    this.gamepadActions = [new Set(), new Set()];
    this.pads = [list[0] ?? null, list[1] ?? null];
    for (let i = 0; i < 2; i++) {
      const gp = this.pads[i];
      if (!gp) continue;
      this.lastDevice = "gamepad";
      const dest = this.gamepadActions[i];
      for (const action of ALL_ACTIONS) {
        if (this.readPad(gp, action)) dest.add(action);
      }
    }
  }

  private readPad(gp: Gamepad, action: ActionName): boolean {
    const map = GAMEPAD_DEFAULT[action] as PadMap[ActionName];
    if (map.buttons) {
      for (const b of map.buttons) {
        const btn = gp.buttons[b];
        if (btn && (btn.pressed || btn.value > 0.45)) return true;
      }
    }
    const ax = map.axes;
    const dz = 0.38;
    if (ax === "lx-") return this.stick(gp, 0, 1).x < -dz || gp.buttons[14]?.pressed;
    if (ax === "lx+") return this.stick(gp, 0, 1).x > dz || gp.buttons[15]?.pressed;
    if (ax === "ly-") return this.stick(gp, 0, 1).y < -dz || gp.buttons[12]?.pressed;
    if (ax === "ly+") return this.stick(gp, 0, 1).y > dz || gp.buttons[13]?.pressed;
    return false;
  }

  private stick(gp: Gamepad, xAxis: number, yAxis: number) {
    const x = gp.axes[xAxis] ?? 0;
    const y = gp.axes[yAxis] ?? 0;
    const m = Math.hypot(x, y);
    const dz = 0.18;
    if (m < dz) return { x: 0, y: 0 };
    const scale = ((m - dz) / (1 - dz)) / m;
    return { x: x * scale, y: y * scale };
  }

  isDown(slot: "p1" | "p2", action: ActionName): boolean {
    if (this.virtual.has(action) && slot === "p1") return true;
    const codes = this.bindings[slot][action] ?? [];
    for (const c of codes) {
      if (this.keys.has(c) || this.injected.has(c)) return true;
    }
    const padIndex = slot === "p1" ? 0 : 1;
    return this.gamepadActions[padIndex].has(action);
  }

  consume(slot: "p1" | "p2", action: ActionName): boolean {
    if (this.virtualPressed.has(action) && slot === "p1") {
      this.virtualPressed.delete(action);
      this.pushHistory(action);
      return true;
    }
    const codes = this.bindings[slot][action] ?? [];
    for (const c of codes) {
      if (this.pressed.has(c)) {
        this.pressed.delete(c);
        this.pushHistory(action);
        return true;
      }
    }
    const padIndex = slot === "p1" ? 0 : 1;
    if (this.gamepadActions[padIndex].has(action) && !this.gamepadPrev[padIndex].has(action)) {
      this.pushHistory(action);
      return true;
    }
    return false;
  }

  peekPressed(slot: "p1" | "p2"): AttackButtonHit | null {
    for (const a of ATTACK_ACTIONS) {
      if (this.consume(slot, a)) return a as AttackButtonHit;
    }
    return null;
  }

  dir(slot: "p1" | "p2"): number {
    let d = 0;
    if (this.isDown(slot, "left")) d -= 1;
    if (this.isDown(slot, "right")) d += 1;
    return d;
  }

  numpad(slot: "p1" | "p2", facing: number): number {
    const x = this.dir(slot) * (facing >= 0 ? 1 : -1);
    const y = this.isDown(slot, "up") ? 1 : this.isDown(slot, "down") ? -1 : 0;
    const col = x < 0 ? 0 : x > 0 ? 2 : 1;
    const row = y > 0 ? 2 : y < 0 ? 0 : 1;
    return row * 3 + col + 1;
  }

  endFrame() {
    this.pressed.clear();
    this.virtualPressed.clear();
  }

  clearAll() {
    this.keys.clear();
    this.pressed.clear();
    this.virtual.clear();
    this.virtualPressed.clear();
    this.injected.clear();
  }

  vibrate(slot: "p1" | "p2", duration = 70, strong = 0.5, weak = 0.25) {
    if (!this.rumble) return;
    const gp = this.pads[slot === "p1" ? 0 : 1];
    const actuator = gp?.vibrationActuator as { playEffect?: (t: string, o: object) => Promise<unknown> } | undefined;
    actuator?.playEffect?.("dual-rumble", {
      duration,
      strongMagnitude: strong,
      weakMagnitude: weak,
      startDelay: 0,
    });
  }

  padConnected(slot: "p1" | "p2") {
    return !!this.pads[slot === "p1" ? 0 : 1];
  }

  private pushHistory(action: ActionName) {
    this.history.push({ label: action, t: this.frame });
    if (this.history.length > 16) this.history.shift();
  }
}

export type AttackButtonHit = Extract<
  ActionName,
  "light" | "medium" | "heavy" | "kickLight" | "kickHeavy" | "special" | "super" | "throw" | "taunt"
>;
