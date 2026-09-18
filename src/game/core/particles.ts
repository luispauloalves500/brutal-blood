type P = {
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; gravity: number; spark: boolean;
};

const POOL = 220;

export class ParticlePool {
  private list: P[] = [];
  private i = 0;
  enabled = true;

  constructor() {
    for (let n = 0; n < POOL; n++) {
      this.list.push({ x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: "#fff", gravity: 0, spark: false });
    }
  }

  spawn(x: number, y: number, n: number, color: string, spark = true) {
    if (!this.enabled) return;
    for (let k = 0; k < n; k++) {
      const p = this.list[this.i];
      this.i = (this.i + 1) % POOL;
      const a = Math.random() * Math.PI * 2;
      const sp = 80 + Math.random() * 340;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp - 80;
      p.life = p.max = 0.25 + Math.random() * 0.45;
      p.size = spark ? 2 + Math.random() * 3 : 6 + Math.random() * 10;
      p.color = color; p.gravity = spark ? 600 : 80; p.spark = spark;
    }
  }

  ember(x: number, y: number, n: number) {
    if (!this.enabled) return;
    for (let k = 0; k < n; k++) {
      const p = this.list[this.i];
      this.i = (this.i + 1) % POOL;
      p.x = x + (Math.random() * 40 - 20);
      p.y = y;
      p.vx = (Math.random() - 0.5) * 30;
      p.vy = -40 - Math.random() * 80;
      p.life = p.max = 0.8 + Math.random() * 1.2;
      p.size = 2 + Math.random() * 2;
      p.color = Math.random() > 0.5 ? "#e25a3a" : "#f0a060";
      p.gravity = -40;
      p.spark = true;
    }
  }

  update(dt: number) {
    for (const p of this.list) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.gravity * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      if (p.life <= 0) continue;
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      if (p.spark) ctx.fillRect(p.x, p.y, p.size, p.size);
      else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
