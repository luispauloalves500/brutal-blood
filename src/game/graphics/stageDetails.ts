import type { StageDef } from './stages';

/** Deterministic geometry: no allocations of textures and no random flicker. */
export function drawStageDepth(c: CanvasRenderingContext2D, s: StageDef, time: number, camera: number, fx: boolean) {
  c.save();
  c.translate(-camera * .12, 0);
  c.fillStyle = s.sky[0];
  for (let i = -1; i < 18; i++) {
    const x = i * 86, top = 270 + ((i * 43 + 311) % 130);
    c.fillRect(x, top, 66, 620 - top);
    c.fillStyle = s.accent + '65';
    for (let row = 0; row < 3; row++) c.fillRect(x + 20, top + 30 + row * 45, 9, 18);
    c.fillStyle = s.sky[0];
  }
  c.restore();
  if (!fx) return;
  c.save();
  for (let i = 0; i < 4; i++) {
    const x = 160 + i * 310 - camera * .22;
    const glow = c.createLinearGradient(x, 150, x + 140, 600);
    glow.addColorStop(0, s.haze + '28'); glow.addColorStop(1, s.haze + '00');
    c.fillStyle = glow; c.beginPath();c.moveTo(x, 120);c.lineTo(x + 190, 620);c.lineTo(x + 40, 620);c.closePath();c.fill();
  }
  for (let i = 0; i < 18; i++) {
    const x = ((i * 79 + Math.sin(time * .17 + i) * 32) % 1400) - 40;
    const y = 570 - ((i * 37 + time * (8 + i % 3)) % 360);
    c.fillStyle = s.haze + '80';c.fillRect(x,y,2,2);
  }
  c.restore();
}

export function drawStageTrim(c: CanvasRenderingContext2D, s: StageDef, time: number, fx: boolean) {
  c.save();
  // Masonry and rivets establish scale behind the fighters.
  c.strokeStyle = s.accent + '90'; c.lineWidth = 1;
  for (const x of [180, 1040]) {
    for (let y = 225; y < 590; y += 42) {
      c.beginPath();c.moveTo(x,y);c.lineTo(x+54,y);c.stroke();
      c.fillStyle=s.accent;c.fillRect(x+6,y+10,3,3);c.fillRect(x+46,y+10,3,3);
    }
  }
  for(let i=0;i<16;i++) {
    const x=i*91-40,y=640+(i*13%49);
    c.fillStyle=s.accent+'65';c.beginPath();c.moveTo(x,y);c.lineTo(x+24,y-3);c.lineTo(x+41,y+7);c.lineTo(x+5,y+9);c.closePath();c.fill();
  }
  if(fx) {
    for(const x of [130,1150]) {
      const flicker=.8+Math.sin(time*7+x)*.12;
      const g=c.createRadialGradient(x,440,2,x,440,90);
      g.addColorStop(0,s.haze+'90');g.addColorStop(1,s.haze+'00');c.fillStyle=g;c.fillRect(x-90,350,180,180);
      c.fillStyle='#171018';c.fillRect(x-6,446,12,126);
      c.fillStyle=s.id==='forest'?'#85b985':'#f7a568';
      c.beginPath();c.ellipse(x,436,6*flicker,17*flicker,0,0,Math.PI*2);c.fill();
    }
    c.fillStyle = s.haze + '18';
    for (let i = 0; i < 5; i++) {
      const x = ((time * 12 + i * 240) % 1500) - 80;
      c.beginPath();
      c.ellipse(x, 520 + Math.sin(time * 0.6 + i) * 8, 90, 18, 0, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.restore();
}
