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
  private intensity = 0;
  private focused = true;

  setIntensity(value: number) { this.intensity = Math.max(0, Math.min(1, value)); }
  setFocus(focused: boolean) { this.focused = focused; this.apply(this.settings); }

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
    this.master.gain.setTargetAtTime(curve(s.master) * mute * (this.focused ? 1 : 0.15), this.ctx.currentTime, 0.02);
    this.buses.music?.gain.setTargetAtTime(curve(s.music), this.ctx.currentTime, 0.02);
    this.buses.sfx?.gain.setTargetAtTime(curve(s.sfx), this.ctx.currentTime, 0.02);
    this.buses.voice?.gain.setTargetAtTime(curve(s.voice), this.ctx.currentTime, 0.02);
    this.buses.ambient?.gain.setTargetAtTime(curve(s.ambient), this.ctx.currentTime, 0.02);
    this.buses.ui?.gain.setTargetAtTime(curve(s.ui), this.ctx.currentTime, 0.02);
  }

  resume() {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }

  context() {
    return this.ctx;
  }

  playBuffer(buffer: AudioBuffer, bus: Bus = "sfx", vol = 0.8) {
    if (!this.unlocked || !this.ctx || !this.bus(bus)) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    src.connect(g);
    g.connect(this.bus(bus)!);
    src.start(t);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
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
  private musicStep = 0;
  hit(heavy = false) {
    this.noise(heavy ? 0.09 : 0.04, heavy ? 0.22 : 0.11, "sfx", heavy ? 160 : 700);
    this.tone(heavy ? 62 : 128, heavy ? 0.13 : 0.06, "sine", heavy ? 0.2 : 0.09, "sfx", heavy ? -28 : -46);
    this.tone(heavy ? 210 : 420, 0.035, "triangle", heavy ? 0.07 : 0.04, "sfx", -70);
  }
  thump() {
    this.tone(42, 0.2, "sine", 0.18, "sfx", -6);
    this.noise(0.1, 0.07, "sfx", 80);
  }
  block() {
    this.tone(720, 0.045, "square", 0.035, "sfx", -260);
    this.tone(190, 0.07, "triangle", 0.05, "sfx", -50);
    this.noise(0.035, 0.045, "sfx", 1600);
  }
  whoosh() { this.noise(0.07, 0.045, "sfx", 900); this.tone(300, 0.05, "triangle", 0.02, "sfx", 80); }
  special() {
    this.tone(100, 0.2, "sawtooth", 0.07, "sfx", 70);
    this.tone(200, 0.16, "triangle", 0.045, "sfx", 110);
    this.noise(0.12, 0.07, "sfx", 420);
  }
  super() {
    this.tone(38, 0.5, "sine", 0.2, "sfx", -8);
    this.tone(76, 0.36, "sawtooth", 0.07, "sfx", 140);
    this.noise(0.26, 0.11, "sfx", 110);
  }
  ko() {
    this.tone(52, 0.7, "sine", 0.2, "voice", -24);
    this.tone(104, 0.4, "triangle", 0.05, "voice", -36);
    this.noise(0.32, 0.11, "sfx", 60);
  }
  finish() {
    this.tone(46, 0.85, "sine", 0.16, "voice", 16);
    this.tone(92, 0.55, "sawtooth", 0.05, "voice", 24);
    this.noise(0.4, 0.09, "sfx", 80);
  }
  jump() { this.tone(260, 0.07, "triangle", 0.045, "sfx", 90); }
  land() { this.noise(0.05, 0.05, "sfx", 180); this.tone(90, 0.05, "sine", 0.04, "sfx", -20); }

  startMusic() {
    if (this.musicOn) return;
    this.musicOn = true;
    this.tickMusic();
  }
  stopMusic() {
    this.musicOn = false;
    if (this.musicTimer) window.clearTimeout(this.musicTimer);
  }

  private tickMusic() {
    if (!this.musicOn || !this.ctx) return;
    const root = 46 + this.intensity * 8;
    const scale = [0, 3, 7, 10, 7, 3, 0, -2];
    const step = this.musicStep++;
    const semi = scale[step % scale.length];
    const beat = step % 4;
    const freq = root * Math.pow(2, semi / 12);
    this.tone(freq, beat === 0 ? 0.32 : 0.16, "triangle", beat === 0 ? 0.045 : 0.026, "music");
    if (beat === 0) this.tone(root / 2, 0.34, "sine", 0.055, "music");
    if (beat === 2) this.noise(0.04, 0.018, "music", 1800);
    this.musicTimer = window.setTimeout(() => this.tickMusic(), 440 - this.intensity * 170);
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
