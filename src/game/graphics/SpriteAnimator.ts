import type { AnimClip, CharacterSpritePack } from "../assets/types";

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

  constructor(id: string, pack: CharacterSpritePack | null = null) {
    this.id = id;
    this.pack = pack;
    this.ready = !!pack && pack.images.size > 0 && Object.values(pack.clips).some((c) => c.src && pack.images.has(c.src));
  }

  clip(name: string): AnimClip | undefined {
    if (!this.pack) return undefined;
    return this.pack.clips[name] ?? this.pack.clips.idle;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    anim: string,
    x: number,
    y: number,
    w: number,
    h: number,
    facing: number,
    time: number,
  ): boolean {
    const clip = this.clip(anim);
    if (!clip?.src || !this.pack) return false;
    const img = this.pack.images.get(clip.src);
    if (!img) return false;

    const iw = "width" in img ? Number(img.width) : 0;
    const ih = "height" in img ? Number(img.height) : 0;
    if (!iw || !ih) return false;

    const cols = Math.max(1, clip.columns || clip.frames);
    const rows = clip.row != null ? Math.max(clip.row + 1, 1) : 1;
    const frameW = iw / cols;
    const frameH = ih / rows;
    const n = Math.max(1, clip.frames);
    const i = clip.loop
      ? Math.floor(time * clip.fps) % n
      : Math.min(n - 1, Math.floor(time * clip.fps));
    this.lastAnim = anim;
    this.lastFrame = i;
    const col = i % cols;
    const row = clip.row ?? Math.floor(i / cols);
    const sx = col * frameW;
    const sy = row * frameH;

    const px = clip.pivotX * frameW;
    const py = clip.pivotY * frameH;
    const scale = h / frameH;

    ctx.save();
    ctx.translate(x + w / 2, y + h);
    ctx.scale(facing, 1);
    ctx.drawImage(
      img,
      sx, sy, frameW, frameH,
      -px * scale,
      -py * scale,
      frameW * scale,
      frameH * scale,
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
    ctx.fillText(`${this.lastAnim} #${this.lastFrame} f${facing > 0 ? "+" : "-"}`, x, y - 6);
    ctx.restore();
  }
}
