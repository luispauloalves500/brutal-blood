import { GAME } from "./config";

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  private targetX = 0;
  private targetZoom = 1;
  private trauma = 0;
  private shakeMul = 1;
  private impulseX = 0;
  private bounds = { w: GAME.WIDTH, h: GAME.HEIGHT };

  setShake(enabled: boolean) {
    this.shakeMul = enabled ? 1 : 0;
  }

  addTrauma(v: number) {
    this.trauma = Math.min(1, this.trauma + v * this.shakeMul);
  }

  punch(zoom = 1.12) {
    this.targetZoom = zoom;
  }

  /** Directional kick opposite the hit, lerps back. */
  kick(dir: number, mag = 10) {
    this.impulseX += dir * mag * this.shakeMul;
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.targetZoom = 1;
    this.trauma = 0;
    this.impulseX = 0;
  }

  follow(ax: number, bx: number, cinematic = false) {
    const mid = (ax + bx) / 2;
    this.targetX = mid - GAME.WIDTH / 2;
    const dist = Math.abs(ax - bx);
    const z = cinematic ? 1.28 : dist < 280 ? 1.08 : dist > 700 ? 0.98 : 1;
    if (!cinematic) this.targetZoom = z;
    this.targetX = Math.max(-80, Math.min(80, this.targetX));
  }

  update(dt: number) {
    const k = 1 - Math.exp(-8 * dt);
    this.x += (this.targetX - this.x) * k;
    this.zoom += (this.targetZoom - this.zoom) * (1 - Math.exp(-6 * dt));
    this.targetZoom += (1 - this.targetZoom) * (1 - Math.exp(-1.6 * dt));
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.impulseX += (0 - this.impulseX) * (1 - Math.exp(-11 * dt));
  }

  apply(ctx: CanvasRenderingContext2D) {
    const shake = this.trauma * this.trauma;
    const ox = this.x + this.impulseX + (Math.random() * 2 - 1) * 18 * shake;
    const oy = (Math.random() * 2 - 1) * 12 * shake;
    const rot = (Math.random() * 2 - 1) * 0.012 * shake;
    ctx.translate(GAME.WIDTH / 2, GAME.HEIGHT / 2);
    ctx.rotate(rot);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-GAME.WIDTH / 2 - ox, -GAME.HEIGHT / 2 - oy);
  }
}
