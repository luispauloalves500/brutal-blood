import type { AnimClip, CharacterSpritePack, PaletteDef } from "../assets/types";
import type { MoveDef } from "../characters/types";
import { DEFAULT_PALETTES, isIdentityPalette, paletteFilter } from "../assets/palettes";

export type DrawAnimOpts = {
  time: number;
  attack?: MoveDef | null;
  attackFrame?: number;
  squash?: number;
};

export type SourceMode = "DEDICATED" | "GROUP_FALLBACK" | "CLIP_FALLBACK" | "CANVAS";

type Resolved = {
  clip: AnimClip;
  src: string;
  image: CanvasImageSource;
  frames: number;
  columns: number;
  rows: number;
  fps: number;
  mode: SourceMode;
  mask?: CanvasImageSource;
};

const layoutWarned = new Set<string>();
const tintCache = new Map<string, HTMLCanvasElement>();

/**
 * Draws preloaded sheets. Combat boxes stay on Fighter.
 * Facing left uses ctx.scale(-1,1) — never duplicate art.
 * Missing clip/src → draw() returns false (placeholder).
 */
export class SpriteAnimator {
  ready = false;
  id: string;
  pack: CharacterSpritePack | null;
  palette: PaletteDef;
  lastAnim = "idle";
  lastFrame = 0;
  lastSrc = "";
  lastFallback = false;
  lastMode: SourceMode = "CANVAS";
  lastType: "DEDICATED" | "GROUP" | "CLIP" | "CANVAS" = "CANVAS";
  currentAnim = "";
  lastMoveId = "";
  animOrigin = 0;
  skin = "default";

  constructor(id: string, pack: CharacterSpritePack | null = null, palette?: PaletteDef, skin = "default") {
    this.id = id;
    this.pack = pack;
    this.palette = palette ?? DEFAULT_PALETTES[0]!;
    this.skin = skin;
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
    const dedicated = this.tryDedicated(start, "DEDICATED");
    if (dedicated) return dedicated;

    const seen = new Set<string>([start.name]);
    let cur: AnimClip | undefined = start.fallback ? this.pack.clips[start.fallback] : undefined;
    while (cur && !seen.has(cur.name)) {
      seen.add(cur.name);
      const fromClip = this.tryDedicated(cur, "CLIP_FALLBACK");
      if (fromClip) return fromClip;
      cur = cur.fallback ? this.pack.clips[cur.fallback] : undefined;
    }

    const group = this.tryGroup(start, "GROUP_FALLBACK");
    if (group) return group;

    cur = start.fallback ? this.pack.clips[start.fallback] : undefined;
    seen.clear();
    seen.add(start.name);
    while (cur && !seen.has(cur.name)) {
      seen.add(cur.name);
      const fromGroup = this.tryGroup(cur, "GROUP_FALLBACK");
      if (fromGroup) return fromGroup;
      cur = cur.fallback ? this.pack.clips[cur.fallback] : undefined;
    }
    return null;
  }

  private tryDedicated(clip: AnimClip, mode: SourceMode): Resolved | null {
    if (!clip.src || !this.pack) return null;
    const img = this.pack.images.get(clip.src);
    if (!img) return null;
    const cols = Math.max(1, clip.columns || clip.frames);
    const rows = Math.max(1, clip.rows ?? 1);
    const layout = clampLayout(clip.src, clip.frames, cols, rows, "DEDICATED");
    return {
      clip,
      src: clip.src,
      image: img,
      ...layout,
      fps: clip.fps,
      mode,
      mask: clip.maskSrc ? this.pack.images.get(clip.maskSrc) : undefined,
    };
  }

  private tryGroup(clip: AnimClip, mode: SourceMode): Resolved | null {
    if (!clip.fallbackSrc || !this.pack) return null;
    const img = this.pack.images.get(clip.fallbackSrc);
    if (!img) return null;
    const frames = Math.max(1, clip.sheetFrames || 1);
    const cols = Math.max(1, clip.sheetColumns || frames);
    const rows = Math.max(1, clip.sheetRows ?? 1);
    const layout = clampLayout(clip.fallbackSrc, frames, cols, rows, "GROUP");
    return {
      clip,
      src: clip.fallbackSrc,
      image: img,
      ...layout,
      fps: clip.sheetFps || clip.fps,
      mode,
    };
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
    if (!resolved) {
      this.lastAnim = anim;
      this.lastMode = "CANVAS";
      this.lastType = "CANVAS";
      this.lastFallback = true;
      return false;
    }

    const moveId = opts.attack?.id ?? "";
    if (anim !== this.currentAnim || moveId !== this.lastMoveId) {
      this.currentAnim = anim;
      this.lastMoveId = moveId;
      this.animOrigin = opts.time;
    }
    const localTime = Math.max(0, opts.time - this.animOrigin);
    // Timing belongs to the move that was requested. Pixels may come from a borrowed sheet.
    const driver = this.clip(anim) ?? resolved.clip;
    const n = resolved.frames;
    const sample = sampleFrame(driver, n, localTime, driver.fps || resolved.fps, opts);

    this.lastAnim = anim;
    this.lastFrame = sample.frame;
    this.lastSrc = resolved.src;
    this.lastMode = resolved.mode;
    this.lastFallback = resolved.mode !== "DEDICATED";
    this.lastType = resolved.mode === "DEDICATED" ? "DEDICATED" : resolved.mode === "CLIP_FALLBACK" ? "CLIP" : "GROUP";

    const cols = resolved.columns;
    const rows = resolved.rows;
    const pixels = this.sheetForDraw(resolved);
    const iw = imageWidth(pixels);
    const ih = imageHeight(pixels);
    if (!iw || !ih) return false;
    const frameW = iw / cols;
    const frameH = ih / rows;

    const visScale = (driver.scale ?? resolved.clip.scale ?? 1) * (h / frameH);
    const squash = opts.squash ?? 0;
    const sxScale = visScale * (1 + squash * 0.16);
    const syScale = visScale * (1 - squash * 0.18);
    const px = driver.pivotX * frameW;
    const py = driver.pivotY * frameH;
    const ox = driver.offsetX ?? resolved.clip.offsetX ?? 0;
    const oy = driver.offsetY ?? resolved.clip.offsetY ?? 0;

    ctx.save();
    ctx.translate(x + w / 2 + ox * facing, y + h + oy);
    ctx.scale(facing, 1);
    if (!resolved.mask && !isIdentityPalette(this.palette)) {
      // Full-image palette fallback when no maskSrc is loaded.
      ctx.filter = paletteFilter(this.palette);
    }
    // Crossfade between adjacent sheet cells. Does not invent art — only softens low frame counts.
    drawBlendedFrame(ctx, pixels, cols, rows, frameW, frameH, sample.frame, sample.next, sample.blend, driver.row ?? resolved.clip.row, -px * sxScale, -py * syScale, frameW * sxScale, frameH * syScale);
    ctx.filter = "none";
    ctx.restore();
    return true;
  }

  private sheetForDraw(resolved: Resolved): CanvasImageSource {
    if (!resolved.mask || isIdentityPalette(this.palette)) return resolved.image;
    return tintWithMask(this.skin, resolved.src, resolved.clip.maskSrc ?? "", this.palette, resolved.image, resolved.mask);
  }

  debug(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    facing: number,
  ) {
    ctx.save();
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff8f0";
    ctx.font = "10px monospace";
    const file = this.lastSrc.split("/").pop() ?? this.lastSrc;
    ctx.fillText(`ANIM: ${this.lastAnim}  FRAME: ${this.lastFrame}`, x, y - 42);
    ctx.fillText(`SOURCE: ${file || "canvas"}`, x, y - 30);
    ctx.fillText(`MODE: ${this.lastMode}`, x, y - 18);
    ctx.fillText(`TYPE: ${this.lastType}  PAL: ${this.palette.id}  FACING: ${facing > 0 ? "+" : "-"}`, x, y - 6);
    ctx.restore();
  }
}

function clampLayout(src: string, frames: number, columns: number, rows: number, kind: string) {
  const cells = Math.max(1, columns * rows);
  let n = Math.max(1, frames);
  if (n > cells) {
    if (!layoutWarned.has(src)) {
      layoutWarned.add(src);
      console.warn(`[sprites] ${kind} ${src} frames=${n} layout=${columns}x${rows}; clamping to ${cells}`);
    }
    n = cells;
  }
  return { frames: n, columns, rows };
}

export function clearTintCache() {
  tintCache.clear();
}

function tintWithMask(
  skin: string,
  src: string,
  maskSrc: string,
  pal: PaletteDef,
  img: CanvasImageSource,
  mask: CanvasImageSource,
): HTMLCanvasElement {
  const key = `${skin}:${src}:${maskSrc}:${pal.id}`;
  const hit = tintCache.get(key);
  if (hit) return hit;
  const w = imageWidth(img);
  const h = imageHeight(img);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d");
  if (!g || !w || !h) return out;
  g.drawImage(img, 0, 0);
  const overlay = document.createElement("canvas");
  overlay.width = w;
  overlay.height = h;
  const og = overlay.getContext("2d");
  if (!og) {
    tintCache.set(key, out);
    return out;
  }
  og.filter = paletteFilter(pal);
  og.drawImage(img, 0, 0);
  og.filter = "none";
  og.globalCompositeOperation = "destination-in";
  og.drawImage(mask, 0, 0);
  g.drawImage(overlay, 0, 0);
  tintCache.set(key, out);
  return out;
}

export type FrameSample = { frame: number; next: number; blend: number };

/** Integer cell + optional blend to the next cell for smoother low-frame sheets. */
export function sampleFrame(clip: AnimClip, n: number, time: number, fps: number, opts: DrawAnimOpts): FrameSample {
  const atk = opts.attack;
  if (atk && opts.attackFrame != null && isAttackClip(clip.name)) {
    const total = Math.max(1, atk.startup + atk.active + atk.recovery);
    if (clip.frameMap && clip.frameMap.length) {
      const exact = (opts.attackFrame / total) * clip.frameMap.length;
      const idx = Math.min(clip.frameMap.length - 1, Math.floor(exact));
      const nextIdx = Math.min(clip.frameMap.length - 1, idx + 1);
      const frame = ((clip.frameMap[idx]! % n) + n) % n;
      const next = ((clip.frameMap[nextIdx]! % n) + n) % n;
      const blend = nextIdx === idx ? 0 : Math.min(1, Math.max(0, exact - idx));
      return { frame, next, blend: softBlend(blend, n) };
    }
    const exact = attackMappedExact(n, opts.attackFrame, atk.startup, atk.active, atk.recovery);
    const frame = Math.min(n - 1, Math.floor(exact));
    const next = Math.min(n - 1, frame + 1);
    return { frame, next, blend: softBlend(exact - frame, n) };
  }
  const raw = time * fps;
  let exact = clip.loop ? ((raw % n) + n) % n : Math.min(n - 1, Math.max(0, raw));
  if (clip.reverseFrames) exact = n - 1 - exact;
  // Keep reverseFrames on the integer lattice without negative blend.
  if (clip.reverseFrames) {
    const frame = Math.max(0, Math.min(n - 1, Math.round(exact)));
    return { frame, next: frame, blend: 0 };
  }
  const frame = Math.min(n - 1, Math.floor(exact));
  const next = clip.loop ? (frame + 1) % n : Math.min(n - 1, frame + 1);
  return { frame, next, blend: softBlend(exact - frame, n) };
}

/** Stronger ease on sparse sheets (≤4 cells); lighter on rich sheets. */
function softBlend(t: number, frames: number) {
  const clamped = Math.min(1, Math.max(0, t));
  if (frames <= 4) return clamped * clamped * (3 - 2 * clamped);
  return clamped * 0.85;
}

function drawBlendedFrame(
  ctx: CanvasRenderingContext2D,
  pixels: CanvasImageSource,
  cols: number,
  rows: number,
  frameW: number,
  frameH: number,
  frame: number,
  next: number,
  blend: number,
  fixedRow: number | undefined,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const drawCell = (index: number, alpha: number) => {
    const col = index % cols;
    const row = Math.min(rows - 1, fixedRow ?? Math.floor(index / cols));
    ctx.globalAlpha = alpha;
    ctx.drawImage(pixels, col * frameW, row * frameH, frameW, frameH, dx, dy, dw, dh);
  };
  if (blend <= 0.02 || next === frame) {
    drawCell(frame, 1);
    ctx.globalAlpha = 1;
    return;
  }
  drawCell(frame, 1);
  drawCell(next, blend);
  ctx.globalAlpha = 1;
}

function attackMappedExact(n: number, attackFrame: number, startup: number, active: number, recovery: number) {
  const total = Math.max(1, startup + active + recovery);
  const f = Math.max(0, Math.min(total, attackFrame));
  const startN = Math.max(1, Math.round(n * 0.3));
  const activeN = Math.max(1, Math.round(n * 0.4));
  const recN = Math.max(1, n - startN - activeN);
  if (f < startup) {
    const t = startup <= 1 ? 0 : f / (startup - 1);
    return Math.min(startN - 1, t * startN);
  }
  if (f < startup + active) {
    const t = active <= 1 ? 1 : (f - startup) / Math.max(1, active - 1);
    return Math.min(startN + activeN - 1, startN + t * activeN);
  }
  const t = recovery <= 1 ? 1 : (f - startup - active) / Math.max(1, recovery);
  return Math.min(n - 1, startN + activeN + t * recN);
}

function isAttackClip(name: string) {
  return [
    "light", "medium", "heavy", "kickLight", "kickHeavy", "aerial", "throw",
    "special1", "special2", "special3", "super", "finish1", "finish2", "counter",
  ].includes(name);
}


function imageWidth(img: CanvasImageSource) {
  if (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) return img.naturalWidth || img.width;
  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) return img.width;
  if ("width" in img) return Number((img as { width: number }).width);
  return 0;
}

function imageHeight(img: CanvasImageSource) {
  if (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) return img.naturalHeight || img.height;
  if (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) return img.height;
  if ("height" in img) return Number((img as { height: number }).height);
  return 0;
}
