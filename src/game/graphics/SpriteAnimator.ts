/**
 * SpriteAnimator — ready for real WebP sheets per character.
 * Only loads paths listed in SPRITE_MANIFEST to avoid 404s.
 * Horizontal flip is done with scale, never duplicated art.
 */
export const SPRITE_MANIFEST: Record<string, Partial<Record<string, string>>> = {
  // Populate when real sheets land, e.g. kharon: { idle: "/fighters/kharon/idle.webp" }
};

type Anim = { img: HTMLImageElement; frames: number; fps: number; fw: number; fh: number };

export class SpriteAnimator {
  private anims = new Map<string, Anim>();
  ready = false;
  id: string;

  constructor(id: string) {
    this.id = id;
    const manifest = SPRITE_MANIFEST[id];
    if (!manifest) return;
    const loads: Promise<void>[] = [];
    for (const [name, src] of Object.entries(manifest)) {
      if (!src) continue;
      loads.push(
        new Promise((res) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const frames = Math.max(1, Math.round(img.width / img.height));
            this.anims.set(name, { img, frames, fps: 8, fw: img.width / frames, fh: img.height });
            res();
          };
          img.onerror = () => res();
          img.src = src;
        }),
      );
    }
    void Promise.all(loads).then(() => {
      this.ready = this.anims.size > 0;
    });
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
    const a = this.anims.get(anim) ?? this.anims.get("idle");
    if (!a) return false;
    const i = Math.floor(time * a.fps) % a.frames;
    ctx.save();
    ctx.translate(x + w / 2, y + h);
    ctx.scale(facing, 1);
    ctx.drawImage(a.img, i * a.fw, 0, a.fw, a.fh, -w / 2, -h, w, h);
    ctx.restore();
    return true;
  }
}
