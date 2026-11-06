import type { StageDef } from "./stages";

/** Deterministic geometry: no texture allocations and no random flicker. */
export function drawStageDepth(c: CanvasRenderingContext2D, s: StageDef, time: number, camera: number, fx: boolean) {
  c.save();
  c.translate(-camera * 0.12, 0);
  // Far silhouettes unique per arena family.
  if (s.props === "city" || s.props === "industrial") {
    for (let i = -1; i < 16; i++) {
      const x = i * 92;
      const top = 210 + ((i * 53 + 117) % 160);
      c.fillStyle = s.sky[0];
      c.fillRect(x, top, 70, 620 - top);
      c.fillStyle = s.accent + "55";
      for (let row = 0; row < 4; row++) {
        if ((row + i) % 2) c.fillRect(x + 14, top + 28 + row * 40, 10, 16);
      }
    }
  } else if (s.props === "forest") {
    for (let i = -2; i < 20; i++) {
      const x = i * 78;
      const h = 180 + ((i * 37) % 120);
      c.fillStyle = "#07140c";
      c.fillRect(x + 18, 620 - h, 16, h);
      c.beginPath();
      c.moveTo(x, 620 - h);
      c.lineTo(x + 26, 620 - h - 70);
      c.lineTo(x + 52, 620 - h);
      c.fill();
    }
  } else if (s.props === "cathedral" || s.props === "temple") {
    for (let i = 0; i < 9; i++) {
      const x = i * 150 - 40;
      c.fillStyle = s.sky[0];
      c.fillRect(x, 240, 40, 380);
      c.beginPath();
      c.moveTo(x - 8, 240);
      c.lineTo(x + 20, 190);
      c.lineTo(x + 48, 240);
      c.fill();
    }
  } else {
    for (let i = -1; i < 18; i++) {
      const x = i * 86;
      const top = 270 + ((i * 43 + 311) % 130);
      c.fillStyle = s.sky[0];
      c.fillRect(x, top, 66, 620 - top);
      c.fillStyle = s.accent + "65";
      for (let row = 0; row < 3; row++) c.fillRect(x + 20, top + 30 + row * 45, 9, 18);
    }
  }
  c.restore();

  if (!fx) return;
  c.save();
  for (let i = 0; i < 4; i++) {
    const x = 160 + i * 310 - camera * 0.22;
    const glow = c.createLinearGradient(x, 150, x + 140, 600);
    glow.addColorStop(0, s.haze + "28");
    glow.addColorStop(1, s.haze + "00");
    c.fillStyle = glow;
    c.beginPath();
    c.moveTo(x, 120);
    c.lineTo(x + 190, 620);
    c.lineTo(x + 40, 620);
    c.closePath();
    c.fill();
  }
  // Ambient motes — color follows arena haze.
  for (let i = 0; i < 22; i++) {
    const drift = s.props === "forest" ? 5 + (i % 4) : 8 + (i % 3);
    const x = ((i * 79 + Math.sin(time * 0.17 + i) * 32) % 1400) - 40;
    const y = 570 - ((i * 37 + time * drift) % 360);
    c.fillStyle = s.haze + (s.props === "prison" ? "99" : "80");
    const size = s.props === "fortress" ? 3 : 2;
    c.fillRect(x, y, size, size);
  }
  c.restore();
}

export function drawStageTrim(c: CanvasRenderingContext2D, s: StageDef, time: number, fx: boolean) {
  c.save();
  c.strokeStyle = s.accent + "90";
  c.lineWidth = 1;
  for (const x of [180, 1040]) {
    for (let y = 225; y < 590; y += 42) {
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 54, y);
      c.stroke();
      c.fillStyle = s.accent;
      c.fillRect(x + 6, y + 10, 3, 3);
      c.fillRect(x + 46, y + 10, 3, 3);
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = i * 91 - 40;
    const y = 640 + ((i * 13) % 49);
    c.fillStyle = s.accent + "65";
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + 24, y - 3);
    c.lineTo(x + 41, y + 7);
    c.lineTo(x + 5, y + 9);
    c.closePath();
    c.fill();
  }
  if (fx) {
    const torchXs = s.props === "cathedral" ? [160, 640, 1120] : [130, 1150];
    for (const x of torchXs) {
      const flicker = 0.8 + Math.sin(time * 7 + x) * 0.12;
      const g = c.createRadialGradient(x, 440, 2, x, 440, 90);
      g.addColorStop(0, s.haze + "90");
      g.addColorStop(1, s.haze + "00");
      c.fillStyle = g;
      c.fillRect(x - 90, 350, 180, 180);
      c.fillStyle = "#171018";
      c.fillRect(x - 6, 446, 12, 126);
      c.fillStyle = s.id === "forest" ? "#85b985" : s.id === "prison" ? "#7ec8d8" : "#f7a568";
      c.beginPath();
      c.ellipse(x, 436, 6 * flicker, 17 * flicker, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = s.haze + "18";
    for (let i = 0; i < 5; i++) {
      const x = ((time * 12 + i * 240) % 1500) - 80;
      c.beginPath();
      c.ellipse(x, 520 + Math.sin(time * 0.6 + i) * 8, 90, 18, 0, 0, Math.PI * 2);
      c.fill();
    }
    // Arena-specific foreground accent.
    if (s.props === "temple" || s.props === "cathedral") {
      c.strokeStyle = s.accent + "70";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(420, 610);
      c.quadraticCurveTo(640, 560 + Math.sin(time) * 4, 860, 610);
      c.stroke();
    }
    if (s.props === "industrial") {
      c.strokeStyle = "#4a556088";
      c.lineWidth = 3;
      for (let i = 0; i < 5; i++) {
        const y = 180 + i * 70;
        c.beginPath();
        c.moveTo(40, y);
        c.lineTo(180, y + 20);
        c.stroke();
      }
    }
  }
  c.restore();
}
