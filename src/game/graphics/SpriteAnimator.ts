import type { AnimClip, CharacterSpritePack } from "../assets/types";
import type { MoveDef } from "../characters/types";

export type DrawAnimOpts = {
  time: number;
  attack?: MoveDef | null;
  attackFrame?: number;
};

type Resolved = {
  clip: AnimClip;
  src: string;
  image: CanvasImageSource;
  frames: number;
  columns: number;
  rows: number;
  fps: number;
  fallback: boolean;
};

/**
 * Draws preloaded sheets. Combat boxes stay on Fighter.
 * Facing left uses ctx.scale(-1,1) — never duplicate art.
 * Missing clip/src → draw() returns false (placeholder).
 */
export class SpriteAnimator {
  ready = false;
  id: string;
  pack: CharacterSpritePack | null;
  lastAnim = "idle";
  lastFrame = 0;
  lastSrc = "";
  lastFallback = false;
  currentAnim = "";
  lastMoveId = "";
  animOrigin = 0;

  constructor(id: string, pack: CharacterSpritePack | null = null) {
    this.id = id;
    this.pack = pack;
    this.ready = !!pack && pack.images.size > 0;
  }

  clip(name: string): AnimClip | undefined {
    if (!this.pack) return undefined;
    return this.pack.clips[name] ?? this.pack.clips.idle;
  }

  resolve(name: string): Resolved | null {
    if (!this.pack) return null;
    const start = this.clip(name);
    if (!start) return null;
    const seen = new Set<string>();
    let cur: AnimClip | undefined = start;
    while (cur && !seen.has(cur.name)) {
      seen.add(cur.name);
      if (cur.src) {
        const img = this.pack.images.get(cur.src);
        if (img) {
          return {
            clip: cur,
            src: cur.src,
            image: img,
            frames: Math.max(1, cur.frames),
            columns: Math.max(1, cur.columns || cur.frames),
            rows: Math.max(1, cur.rows ?? 1),
            fps: cur.fps,
            fallback: cur !== start,
          };
        }
      }
      if (cur.fallbackSrc) {
        const img = this.pack.images.get(cur.fallbackSrc);
        if (img) {
          const frames = Math.max(1, cur.sheetFrames || cur.frames);
          return {
            clip: cur,
            src: cur.fallbackSrc,
            image: img,
            frames,
            columns: Math.max(1, cur.sheetColumns || cur.columns || frames),
            rows: Math.max(1, cur.sheetRows ?? cur.rows ?? 1),
            fps: cur.sheetFps || cur.fps,
            fallback: true,
          };
        }
      }
      cur = cur.fallback ? this.pack.clips[cur.fallback] : undefined;
    }
    return null;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    anim: string,
    x: number,
    y: number,
    w: number,
    h: number,
    facing: number,
    timeOrOpts: number | DrawAnimOpts,
  ): boolean {
    const opts: DrawAnimOpts = typeof timeOrOpts === "number" ? { time: timeOrOpts } : timeOrOpts;
    const resolved = this.resolve(anim);
    if (!resolved) return false;

    const moveId = opts.attack?.id ?? "";
    if (anim !== this.currentAnim || moveId !== this.lastMoveId) {
      this.currentAnim = anim;
      this.lastMoveId = moveId;
      this.animOrigin = opts.time;
    }
    const localTime = Math.max(0, opts.time - this.animOrigin);
    const clip = resolved.clip;
    const n = resolved.frames;
    const i = pickFrame(clip, n, localTime, resolved.fps, opts);

    this.lastAnim = anim;
    this.lastFrame = i;
    this.lastSrc = resolved.src;
    this.lastFallback = resolved.fallback;

    const cols = resolved.columns;
    const rows = resolved.rows;
    const iw = imageWidth(resolved.image);
    const ih = imageHeight(resolved.image);
    if (!iw || !ih) return false;
    const frameW = iw / cols;
    const frameH = ih / rows;
    const col = i % cols;
    const row = Math.min(rows - 1, clip.row ?? Math.floor(i / cols));
    const sx = col * frameW;
    const sy = row * frameH;

    const visScale = (clip.scale ?? 1) * (h / frameH);
    const px = clip.pivotX * frameW;
    const py = clip.pivotY * frameH;
    const ox = clip.offsetX ?? 0;
    const oy = clip.offsetY ?? 0;

    ctx.save();
    ctx.translate(x + w / 2 + ox * facing, y + h + oy);
    ctx.scale(facing, 1);
    ctx.drawImage(
      resolved.image,
      sx, sy, frameW, frameH,
      -px * visScale,
      -py * visScale,
      frameW * visScale,
      frameH * visScale,
    );
    ctx.restore();
    return true;
  }

  debug(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    facing: number,
  ) {
    const clip = this.clip(this.currentAnim || this.lastAnim);
    ctx.save();
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    const feetX = x + w / 2;
    const feetY = y + h;
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(feetX, feetY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8f0";
    ctx.font = "10px monospace";
    const file = this.lastSrc.split("/").pop() ?? this.lastSrc;
    const fb = this.lastFallback ? ` fallback→${file}` : ` src:${file}`;
    const piv = clip ? ` pivot ${clip.pivotX.toFixed(2)}/${clip.pivotY.toFixed(2)}` : "";
    ctx.fillText(`${this.lastAnim} #${this.lastFrame}${fb}`, x, y - 18);
    ctx.fillText(`fps ${clip?.fps ?? "—"}  f${facing > 0 ? "+" : "-"}${piv}`, x, y - 6);
    ctx.restore();
  }
}

function pickFrame(clip: AnimClip, n: number, time: number, fps: number, opts: DrawAnimOpts) {
  const atk = opts.attack;
  if (atk && opts.attackFrame != null && isAttackClip(clip.name)) {
    if (clip.frameMap && clip.frameMap.length) {
      const total = Math.max(1, atk.startup + atk.active + atk.recovery);
      const idx = Math.min(clip.frameMap.length - 1, Math.floor((opts.attackFrame / total) * clip.frameMap.length));
      return ((clip.frameMap[idx] % n) + n) % n;
    }
    return attackMappedFrame(n, opts.attackFrame, atk.startup, atk.active, atk.recovery);
  }
  let i = clip.loop
    ? Math.floor(time * fps) % n
    : Math.min(n - 1, Math.floor(time * fps));
  if (clip.reverseFrames) i = n - 1 - i;
  return i;
}

function isAttackClip(name: string) {
  return [
    "light", "medium", "heavy", "kickLight", "kickHeavy", "aerial", "throw",
    "special1", "special2", "special3", "super", "finish1", "finish2", "counter",
  ].includes(name);
}

/** Spread sheet frames across startup / active / recovery. Hold last frame in recovery. */
function attackMappedFrame(n: number, attackFrame: number, startup: number, active: number, recovery: number) {
  const total = Math.max(1, startup + active + recovery);
  const f = Math.max(0, Math.min(total, attackFrame));
  const startN = Math.max(1, Math.round(n * 0.3));
  const activeN = Math.max(1, Math.round(n * 0.4));
  const recN = Math.max(1, n - startN - activeN);
  if (f < startup) {
    const t = startup <= 1 ? 0 : f / (startup - 1);
    return Math.min(startN - 1, Math.floor(t * startN));
  }
  if (f < startup + active) {
    const t = active <= 1 ? 1 : (f - startup) / Math.max(1, active - 1);
    return Math.min(startN + activeN - 1, startN + Math.floor(t * activeN));
  }
  const t = recovery <= 1 ? 1 : (f - startup - active) / Math.max(1, recovery);
  return Math.min(n - 1, startN + activeN + Math.floor(t * recN));
}

function imageWidth(img: CanvasImageSource) {
  if (img instanceof HTMLImageElement) return img.naturalWidth || img.width;
  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) return img.width;
  if ("width" in img) return Number((img as { width: number }).width);
  return 0;
}

function imageHeight(img: CanvasImageSource) {
  if (img instanceof HTMLImageElement) return img.naturalHeight || img.height;
  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) return img.height;
  if ("height" in img) return Number((img as { height: number }).height);
  return 0;
}
