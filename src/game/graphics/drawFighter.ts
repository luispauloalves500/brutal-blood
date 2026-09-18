import type { Fighter } from "../combat/Fighter";
import type { SpriteAnimator } from "./SpriteAnimator";

export function drawFighter(ctx: CanvasRenderingContext2D, f: Fighter, sprites: SpriteAnimator | null, shadows: boolean) {
  const anim = mapAnim(f);
  if (sprites?.draw(ctx, anim, f.x, f.y, f.w, f.h, f.facing, f.stateTime)) return;

  ctx.save();
  ctx.translate(f.x + f.w / 2, f.y + f.h);
  const squash = f.impactSquash;
  ctx.scale(f.facing * f.scaleX * (1 + squash * 0.18), f.scaleY * (1 - squash * 0.2));
  ctx.translate(-f.w / 2, -f.h);

  if (f.state === "ko" || f.state === "knockdown") {
    ctx.translate(18, 135);
    ctx.rotate(-1.2);
    ctx.translate(-18, -135);
  }
  if (f.state === "crouch") ctx.translate(0, 28);
  if (f.state === "hit") ctx.translate(6, 0);

  if (shadows) {
    ctx.fillStyle = "#00000066";
    ctx.beginPath();
    ctx.ellipse(38, 152, 28, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (f.data.id === "nyx") drawNyx(ctx, f);
  else if (f.data.id === "draven") drawDraven(ctx, f);
  else drawKharon(ctx, f);

  if (f.blocking) {
    ctx.strokeStyle = "#8ec8ff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(40, 70, 62, -1.15, 1.15);
    ctx.stroke();
  }
  if (f.hitFlash > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgba(255,240,230,${Math.min(0.7, f.hitFlash * 5)})`;
    ctx.fillRect(8, 4, 60, 140);
    ctx.globalCompositeOperation = "source-over";
  }
  ctx.restore();
}

function mapAnim(f: Fighter): string {
  if (f.state === "attack" && f.attack) return f.attack.id;
  if (f.state === "walk" || f.state === "walkBack") return "walk";
  return f.state;
}

function drawKharon(ctx: CanvasRenderingContext2D, f: Fighter) {
  const c = f.hitFlash > 0 ? "#fff" : f.data.color;
  const swing = attackSwing(f);
  ctx.fillStyle = c;
  ctx.shadowColor = f.data.color;
  ctx.shadowBlur = 16;
  ctx.fillRect(16, 36, 46, 78);
  ctx.beginPath();
  ctx.arc(40, 22, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1a1014";
  ctx.fillRect(14, 12, 52, 10);
  ctx.fillRect(8, 112, 24, 40);
  ctx.fillRect(46, 112, 24, 40);
  ctx.fillStyle = f.data.accent;
  ctx.fillRect(20, 52, 38, 7);
  ctx.save();
  ctx.translate(58, 50);
  ctx.rotate(-0.5 + swing);
  ctx.fillStyle = "#2a1a1c";
  ctx.fillRect(0, -4, 78, 7);
  ctx.fillStyle = "#d0d4dc";
  ctx.beginPath();
  ctx.moveTo(70, -16);
  ctx.lineTo(108, 0);
  ctx.lineTo(70, 16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "#3a2024";
  ctx.fillRect(22, 36, 34, 14);
}

function drawNyx(ctx: CanvasRenderingContext2D, f: Fighter) {
  const c = f.hitFlash > 0 ? "#fff" : f.data.color;
  const swing = attackSwing(f);
  ctx.fillStyle = c;
  ctx.shadowColor = f.data.accent;
  ctx.shadowBlur = 18;
  ctx.fillRect(22, 34, 32, 80);
  ctx.beginPath();
  ctx.arc(38, 20, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#120c18";
  ctx.fillRect(18, 14, 22, 8);
  ctx.fillRect(14, 112, 18, 38);
  ctx.fillRect(44, 112, 18, 38);
  ctx.fillStyle = f.data.accent;
  ctx.fillRect(26, 48, 24, 4);
  ctx.save();
  ctx.translate(50, 58);
  ctx.rotate(-0.2 + swing);
  ctx.fillStyle = "#c8c0d8";
  ctx.fillRect(0, -2, 64, 4);
  ctx.beginPath();
  ctx.moveTo(60, -8);
  ctx.lineTo(86, 0);
  ctx.lineTo(60, 8);
  ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.translate(18, 62);
  ctx.rotate(0.6 - swing * 0.6);
  ctx.fillStyle = "#c8c0d8";
  ctx.fillRect(0, -2, 50, 4);
  ctx.restore();
}

function drawDraven(ctx: CanvasRenderingContext2D, f: Fighter) {
  const c = f.hitFlash > 0 ? "#fff" : f.data.color;
  const swing = attackSwing(f);
  ctx.fillStyle = c;
  ctx.shadowColor = "#4a3028";
  ctx.shadowBlur = 14;
  ctx.fillRect(12, 40, 54, 72);
  ctx.beginPath();
  ctx.arc(40, 24, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#1c1410";
  ctx.fillRect(10, 112, 26, 40);
  ctx.fillRect(42, 112, 26, 40);
  ctx.fillStyle = "#3a2a22";
  ctx.fillRect(16, 46, 46, 18);
  ctx.fillStyle = f.data.accent;
  ctx.fillRect(22, 64, 34, 6);
  ctx.save();
  ctx.translate(62, 58);
  ctx.rotate(-0.15 + swing);
  ctx.fillStyle = "#c8b49a";
  ctx.fillRect(0, -10, 22, 20);
  ctx.fillStyle = "#6a5a4a";
  ctx.fillRect(16, -12, 10, 24);
  ctx.restore();
  ctx.save();
  ctx.translate(10, 70);
  ctx.rotate(0.35 - swing * 0.5);
  ctx.fillStyle = "#c8b49a";
  ctx.fillRect(-18, -8, 22, 18);
  ctx.fillStyle = "#6a5a4a";
  ctx.fillRect(-26, -10, 10, 22);
  ctx.restore();
}

function attackSwing(f: Fighter) {
  if (f.state !== "attack" || !f.attack) return f.state === "walk" ? Math.sin(f.stateTime * 10) * 0.12 : 0;
  const p = Math.min(1, f.attackFrame / Math.max(1, f.attack.startup + f.attack.active));
  return Math.sin(p * Math.PI) * (f.attack.type === "special" || f.attack.type === "super" ? 1.4 : 0.9);
}

export function drawHitboxes(ctx: CanvasRenderingContext2D, f: Fighter) {
  const hurt = f.getHurtBox();
  ctx.strokeStyle = "#4ade80";
  ctx.lineWidth = 1;
  ctx.strokeRect(hurt.x, hurt.y, hurt.w, hurt.h);
  const atk = f.getAttackBox();
  if (atk) {
    ctx.strokeStyle = "#f87171";
    ctx.strokeRect(atk.x, atk.y, atk.w, atk.h);
  }
}
