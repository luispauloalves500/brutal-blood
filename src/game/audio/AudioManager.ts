import type { AudioSettings } from "../core/config";

type Bus = "music" | "sfx" | "voice" | "ambient" | "ui";

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<Bus, GainNode | null> = {
    music: null, sfx: null, voice: null, ambient: null, ui: null,
  };
  private settings: AudioSettings;
  private unlocked = false;
  private musicTimer: number | null = null;
  private ambientTimer: number | null = null;
  private musicOn = false;

  constructor(settings: AudioSettings) {
    this.settings = settings;
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      (Object.keys(this.buses) as Bus[]).forEach((k) => {
        const g = this.ctx!.createGain();
        g.connect(this.master!);
        this.buses[k] = g;
      });
      this.apply(this.settings);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.unlocked = true;
    this.startAmbient();
  }

  apply(s: AudioSettings) {
    this.settings = s;
    if (!this.master || !this.ctx) return;
    const mute = s.muted ? 0 : 1;
    const curve = (v: number) => v * v;
    this.master.gain.setTargetAtTime(curve(s.master) * mute, this.ctx.currentTime, 0.02);
    this.buses.music?.gain.setTargetAtTime(curve(s.music), this.ctx.currentTime, 0.02);
    this.buses.sfx?.gain.setTargetAtTime(curve(s.sfx), this.ctx.currentTime, 0.02);
    this.buses.voice?.gain.setTargetAtTime(curve(s.voice), this.ctx.currentTime, 0.02);
    this.buses.ambient?.gain.setTargetAtTime(curve(s.ambient), this.ctx.currentTime, 0.02);
    this.buses.ui?.gain.setTargetAtTime(curve(s.ui), this.ctx.currentTime, 0.02);
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  private bus(name: Bus): GainNode | null {
    return this.buses[name];
  }

  tone(freq: number, dur: number, type: OscillatorType, vol: number, bus: Bus, slide = 0) {
    if (!this.unlocked || !this.ctx || !this.bus(bus)) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.bus(bus)!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    osc.onended = () => {
      osc.disconnect();
      g.disconnect();
    };
  }

  noise(dur: number, vol: number, bus: Bus, hp = 400) {
    if (!this.unlocked || !this.ctx || !this.bus(bus)) return;
    const t = this.ctx.currentTime;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.bus(bus)!);
    src.start(t);
    src.stop(t + dur);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }

  uiMove() { this.tone(520, 0.06, "square", 0.04, "ui"); }
  uiConfirm() { this.tone(220, 0.12, "sawtooth", 0.06, "ui", 180); }
  uiBack() { this.tone(180, 0.1, "triangle", 0.05, "ui", -80); }
  hit(heavy = false) {
    this.noise(heavy ? 0.14 : 0.07, heavy ? 0.18 : 0.1, "sfx", heavy ? 200 : 600);
    this.tone(heavy ? 90 : 160, 0.09, "square", heavy ? 0.12 : 0.07, "sfx", -40);
  }
  thump() {
    this.tone(52, 0.18, "sine", 0.16, "sfx", -8);
    this.noise(0.12, 0.08, "sfx", 90);
  }
  block() { this.tone(420, 0.08, "square", 0.05, "sfx", -120); this.noise(0.05, 0.06, "sfx", 1200); }
  whoosh() { this.noise(0.08, 0.05, "sfx", 800); }
  special() { this.tone(140, 0.22, "sawtooth", 0.1, "sfx", 260); this.noise(0.18, 0.1, "sfx", 300); }
  super() {
    this.tone(60, 0.5, "sawtooth", 0.16, "sfx", 200);
    this.tone(180, 0.4, "square", 0.08, "sfx", 400);
    this.noise(0.3, 0.14, "sfx", 150);
  }
  ko() { this.tone(70, 0.6, "sine", 0.18, "voice", -30); this.noise(0.4, 0.16, "sfx", 80); }
  finish() { this.tone(90, 0.8, "sawtooth", 0.14, "voice", 80); this.noise(0.5, 0.12, "sfx", 100); }
  jump() { this.tone(240, 0.08, "triangle", 0.05, "sfx", 120); }
  land() { this.noise(0.05, 0.04, "sfx", 200); }

  startMusic() {
    this.musicOn = true;
    this.tickMusic();
  }
  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
  }

  private tickMusic() {
    if (!this.musicOn || !this.ctx) return;
    const root = 55;
    const notes = [0, 0, 3, 7, 10, 7, 3, 0];
    const i = Math.floor(Math.random() * notes.length);
    this.tone(root * Math.pow(2, notes[i] / 12), 0.35, "sawtooth", 0.035, "music", 0);
    if (Math.random() < 0.4) this.tone(root * 2 * Math.pow(2, notes[(i + 4) % notes.length] / 12), 0.2, "triangle", 0.02, "music");
    this.musicTimer = window.setTimeout(() => this.tickMusic(), 380);
  }

  private startAmbient() {
    if (this.ambientTimer) return;
    const loop = () => {
      this.noise(1.2, 0.025, "ambient", 80);
      this.ambientTimer = window.setTimeout(loop, 1100);
    };
    loop();
  }

  dispose() {
    this.stopMusic();
    if (this.ambientTimer) window.clearTimeout(this.ambientTimer);
    void this.ctx?.close();
    this.ctx = null;
  }
}
