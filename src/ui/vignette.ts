// Animated "life on this world" scenes for the planet panel (2D canvas), carried over from the original orrery.
/* eslint-disable */
import { toF } from "./units";
import { drawEarthScene, type SceneEnv } from "./earthScene";
let vx: CanvasRenderingContext2D;
let VW = 0, VH = 0;
const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647)(42);
const V = { fish: Array.from({length:7}, () => ({y:rnd(), s:.6+rnd()*.7, v:.4+rnd()*.8, ph:rnd()*6, c:["#ffb14a","#ff6b8a","#ffe066","#7fe0ff"][Math.floor(rnd()*4)]})),
            birds: Array.from({length:5}, () => ({y:rnd(), v:.3+rnd()*.4, ph:rnd()})),
            dust: Array.from({length:70}, () => ({x:rnd(), y:rnd(), v:.2+rnd()*.8, s:rnd()*1.6+.3})),
            bugs: Array.from({length:14}, () => ({x:rnd(), y:rnd(), ph:rnd()*6})),
            rocks: Array.from({length:26}, () => ({x:rnd(), y:rnd(), r:2+rnd()*9, rot:rnd()*6, vr:(rnd()-.5)*.8, vx:(rnd()-.5)*.08, vy:(rnd()-.5)*.05, sides: 5+Math.floor(rnd()*3)})),
            craters: Array.from({length:9}, () => ({x:rnd(), y:.62+rnd()*.33, r:6+rnd()*18})),
            stars: Array.from({length:50}, () => ({x:rnd(), y:rnd()*.6, s:rnd()*1.2+.2})) };
function label(text: string, x: number, y: number, color?: string){ vx.font = "500 10px 'IBM Plex Mono', monospace"; vx.fillStyle = color || "rgba(233,228,214,.85)"; vx.fillText(toF(text), x, y); }
function lin(y0: number, y1: number, stops: string[]){ const g = vx.createLinearGradient(0,y0,0,y1); stops.forEach((c,k)=>g.addColorStop(k/(stops.length-1), c)); return g; }
function starfield(a: number){ vx.fillStyle = `rgba(233,228,214,${a})`; V.stars.forEach(s => vx.fillRect(s.x*VW, s.y*VH, s.s, s.s)); }
function earth(ts: number, w: number, h: number){
  vx.fillStyle = lin(0, h*.6, ["#16306b","#4f86d9","#a9cdf2"]); vx.fillRect(0,0,w,h);
  vx.fillStyle = "rgba(255,244,214,.95)"; vx.beginPath(); vx.arc(w*.82, h*.18, 12, 0, 7); vx.fill();
  vx.fillStyle = "rgba(255,255,255,.75)";
  for (let k=0;k<3;k++){ const cx = ((ts*.012*(k+1) + k*.37) % 1.3 - .15)*w, cy = h*(.12+k*.09);
    vx.beginPath(); vx.ellipse(cx, cy, 22, 7, 0, 0, 7); vx.ellipse(cx+14, cy-4, 14, 7, 0, 0, 7); vx.fill(); }
  vx.strokeStyle = "#13203a"; vx.lineWidth = 1.4;
  V.birds.forEach(b => { const x = ((ts*.05*b.v + b.ph) % 1.2 - .1)*w, y = h*(.1 + b.y*.25), f = Math.sin(ts*8 + b.ph*9)*3;
    vx.beginPath(); vx.moveTo(x-5, y-f); vx.lineTo(x, y); vx.lineTo(x+5, y-f); vx.stroke(); });
  vx.fillStyle = "#2f7a46"; vx.beginPath(); vx.moveTo(0, h*.62);
  for (let x=0; x<=w; x+=6) vx.lineTo(x, h*.5 + Math.sin(x*.02)*8 + Math.sin(x*.05+1)*4);
  vx.lineTo(w, h*.62); vx.closePath(); vx.fill();
  for (let k=0;k<9;k++){ const x = w*(.05 + k*.06), y = h*.5 + Math.sin(x*.02)*8 + Math.sin(x*.05+1)*4;
    vx.fillStyle = "#5b3a22"; vx.fillRect(x-1, y-6, 2, 6);
    vx.fillStyle = "#1f5c34"; vx.beginPath(); vx.moveTo(x, y-18 - (k%3)*3); vx.lineTo(x-6, y-5); vx.lineTo(x+6, y-5); vx.fill(); }
  vx.fillStyle = lin(h*.6, h, ["#2a7fc4","#0d3a73","#06183a"]); vx.fillRect(0, h*.6, w, h*.4);
  vx.strokeStyle = "rgba(255,255,255,.35)"; vx.lineWidth = 1; vx.beginPath();
  for (let x=0; x<=w; x+=4) vx.lineTo(x, h*.6 + Math.sin(x*.08 + ts*2)*1.5); vx.stroke();
  V.fish.forEach(f => { const dir = f.v > .8 ? -1 : 1;
    let x = ((ts*.06*f.v + f.ph) % 1.2 - .1)*w; if (dir < 0) x = w - x;
    const y = h*(.68 + f.y*.27) + Math.sin(ts*2 + f.ph)*3, s = 6*f.s;
    vx.fillStyle = f.c; vx.beginPath(); vx.ellipse(x, y, s, s*.5, 0, 0, 7); vx.fill();
    vx.beginPath(); vx.moveTo(x - dir*s*.8, y); vx.lineTo(x - dir*s*1.6, y - s*.5); vx.lineTo(x - dir*s*1.6, y + s*.5); vx.fill(); });
  vx.fillStyle = "rgba(127,224,160,.7)";
  for (let k=0;k<8;k++){ const x = w*(.08 + k*.12), sway = Math.sin(ts*1.5 + k)*3;
    vx.fillRect(x + sway*.5, h-14, 2, 14); vx.fillRect(x + 4 + sway, h-10, 2, 10); }
}

function mercury(ts: number, w: number, h: number){
  vx.fillStyle = "#040509"; vx.fillRect(0,0,w,h); starfield(.7);
  const g = vx.createRadialGradient(w*.1, h*.2, 0, w*.1, h*.2, w*.55);
  g.addColorStop(0, "rgba(255,247,220,1)"); g.addColorStop(.12, "rgba(255,220,150,.8)"); g.addColorStop(1, "rgba(255,200,120,0)");
  vx.fillStyle = g; vx.fillRect(0,0,w,h);
  vx.fillStyle = lin(h*.58, h, ["#8d877f","#55514c","#2b2927"]); vx.beginPath(); vx.moveTo(0, h*.62);
  for (let x=0;x<=w;x+=8) vx.lineTo(x, h*.6 + Math.sin(x*.03)*4); vx.lineTo(w,h); vx.lineTo(0,h); vx.fill();
  V.craters.forEach(c => { vx.fillStyle = "rgba(0,0,0,.3)"; vx.beginPath(); vx.ellipse(c.x*w, c.y*h, c.r, c.r*.35, 0, 0, 7); vx.fill();
    vx.strokeStyle = "rgba(255,255,255,.12)"; vx.stroke(); });
  vx.strokeStyle = "rgba(255,220,170,.18)";
  for (let k=0;k<5;k++){ vx.beginPath(); for (let x=0;x<=w;x+=5) vx.lineTo(x, h*(.56-k*.03) + Math.sin(x*.07 + ts*4 + k)*1.5); vx.stroke(); }
  label("427 °C DAYSIDE · NOTHING STIRS", 10, h-10);
}

function venus(ts: number, w: number, h: number){
  vx.fillStyle = lin(0, h, ["#f7d48a","#e19a46","#a1501f","#4a1c0c"]); vx.fillRect(0,0,w,h);
  for (let k=0;k<7;k++){ vx.strokeStyle = `rgba(255,240,200,${.12 + (k%3)*.06})`; vx.lineWidth = 6 + k*2;
    vx.beginPath(); for (let x=-10;x<=w+10;x+=8) vx.lineTo(x, h*(.12 + k*.12) + Math.sin(x*.025 + ts*.6*(k%2?1:-1) + k)*6); vx.stroke(); }
  vx.fillStyle = "rgba(255,248,220,.12)"; vx.fillRect(0, h*.3, w, h*.22);
  V.bugs.forEach(b => { const x = ((b.x + ts*.02) % 1)*w, y = h*(.32 + b.y*.18) + Math.sin(ts + b.ph)*3, a = .5 + .5*Math.sin(ts*3 + b.ph);
    vx.fillStyle = `rgba(127,224,160,${.4 + a*.5})`; vx.beginPath(); vx.arc(x, y, 1.8, 0, 7); vx.fill(); });
  label("~50 KM · ~30 °C · CLOUD MICROBES?", 10, h*.3 - 6, "rgba(40,16,6,.85)");
  label("SURFACE 464 °C", 10, h-10, "rgba(255,210,170,.9)");
}

function mars(ts: number, w: number, h: number){
  vx.fillStyle = lin(0, h*.62, ["#3a1f2a","#b8714a","#e3a777"]); vx.fillRect(0,0,w,h);
  vx.fillStyle = "rgba(220,235,255,.85)"; vx.beginPath(); vx.arc(w*.78, h*.22, 4, 0, 7); vx.fill();
  vx.fillStyle = "#a4502c"; vx.beginPath(); vx.moveTo(0, h*.55);
  for (let x=0;x<=w;x+=8) vx.lineTo(x, h*.5 + Math.sin(x*.015+2)*10 + Math.sin(x*.06)*2); vx.lineTo(w, h*.74); vx.lineTo(0, h*.74); vx.fill();
  vx.fillStyle = "#7a3a20"; for (let k=0;k<10;k++){ vx.beginPath(); vx.ellipse(w*(.06+k*.1), h*(.66 + (k%3)*.02), 4+(k%4)*2, 3, 0, 0, 7); vx.fill(); }
  vx.fillStyle = lin(h*.74, h, ["#4d2214","#24100a"]); vx.fillRect(0, h*.74, w, h*.26);
  vx.strokeStyle = "rgba(255,200,170,.25)"; vx.setLineDash([3,3]); vx.beginPath(); vx.moveTo(0, h*.74); vx.lineTo(w, h*.74); vx.stroke(); vx.setLineDash([]);
  V.bugs.slice(0,9).forEach(b => { const a = .5 + .5*Math.sin(ts*2 + b.ph);
    vx.fillStyle = `rgba(127,224,160,${.15 + a*.55})`; vx.beginPath(); vx.arc(b.x*w, h*(.8 + b.y*.15), 1.5 + a, 0, 7); vx.fill(); });
  V.dust.forEach(d => { const x = ((d.x + ts*.05*d.v) % 1)*w, y = d.y*h*.7;
    vx.fillStyle = "rgba(255,210,170,.35)"; vx.fillRect(x, y, d.s, d.s); });
  label("SUBSURFACE · MICROBES?", 10, h-10, "rgba(200,240,210,.85)");
}

function europa(ts: number, w: number, h: number){
  vx.fillStyle = "#05070f"; vx.fillRect(0,0,w,h); starfield(.6);
  const jx = w*.85, jy = h*.08, jr = h*.5;
  vx.save(); vx.beginPath(); vx.arc(jx, jy, jr, 0, 7); vx.clip();
  const bands = ["#e8cfa6","#b98a5c","#efdcb8","#a87348","#e3c79c","#c49a6c"];
  bands.forEach((c,k) => { vx.fillStyle = c; vx.fillRect(jx-jr, jy-jr + k*jr*2/6, jr*2, jr*2/6+1); });
  vx.fillStyle = "#c4553a"; vx.beginPath(); vx.ellipse(jx - jr*.35 + Math.sin(ts*.2)*3, jy + jr*.35, 14, 8, 0, 0, 7); vx.fill(); vx.restore();
  vx.fillStyle = lin(h*.38, h*.5, ["#f2f6ff","#c8d8ea"]); vx.fillRect(0, h*.38, w, h*.12);
  vx.strokeStyle = "rgba(160,90,60,.5)"; vx.lineWidth = 1; for (let k=0;k<6;k++){ vx.beginPath(); vx.moveTo(w*k*.18, h*.4); vx.lineTo(w*k*.18+30, h*.47); vx.stroke(); }
  vx.fillStyle = lin(h*.5, h, ["#1a4f8a","#0b2750","#041027"]); vx.fillRect(0, h*.5, w, h*.5);
  const vxp = w*.62;
  vx.fillStyle = "#1b1410"; vx.beginPath(); vx.moveTo(vxp-16, h); vx.lineTo(vxp-4, h-22); vx.lineTo(vxp+4, h-22); vx.lineTo(vxp+16, h); vx.fill();
  for (let k=0;k<10;k++){ const life = (ts*.4 + k/10) % 1, y = h-22 - life*h*.42, x = vxp + Math.sin(life*9 + k)*6;
    vx.fillStyle = `rgba(200,240,255,${.7*(1-life)})`; vx.beginPath(); vx.arc(x, y, 1.5 + life*2, 0, 7); vx.fill(); }
  V.bugs.slice(0,8).forEach(b => { const a = .5 + .5*Math.sin(ts*2.4 + b.ph);
    vx.fillStyle = `rgba(127,224,160,${.1 + a*.5})`; vx.beginPath(); vx.arc(vxp + (b.x-.5)*60, h - 10 - b.y*26, 1.3, 0, 7); vx.fill(); });
  label("EUROPA · ICE SHELL", 10, h*.38 - 6);
  label("OCEAN · VENT LIFE?", 10, h-10, "rgba(200,240,210,.85)");
}

function enceladus(ts: number, w: number, h: number){
  vx.fillStyle = "#04060d"; vx.fillRect(0,0,w,h); starfield(.6);
  const sx = w*.72, sy = h*.25;
  vx.strokeStyle = "rgba(234,211,154,.55)"; vx.lineWidth = 3; vx.beginPath(); vx.ellipse(sx, sy, 70, 14, -.15, 0, 7); vx.stroke();
  vx.fillStyle = lin(sy-26, sy+26, ["#f5e3b5","#c9a86a"]); vx.beginPath(); vx.arc(sx, sy, 24, 0, 7); vx.fill();
  vx.strokeStyle = "rgba(234,211,154,.8)"; vx.lineWidth = 3; vx.beginPath(); vx.ellipse(sx, sy, 70, 14, -.15, Math.PI*.05, Math.PI*.95); vx.stroke();
  vx.fillStyle = lin(h*.65, h, ["#eef4ff","#b7c8dc"]); vx.beginPath(); vx.moveTo(0, h*.7);
  for (let x=0;x<=w;x+=8) vx.lineTo(x, h*.68 + Math.sin(x*.02)*3); vx.lineTo(w,h); vx.lineTo(0,h); vx.fill();
  vx.strokeStyle = "#5e7fa8"; vx.lineWidth = 2;
  const vents = [.18,.42,.66,.88];
  vents.forEach(v => { vx.beginPath(); vx.moveTo(w*v-12, h*.74); vx.lineTo(w*v+12, h*.78); vx.stroke(); });
  vents.forEach((v,j) => { for (let k=0;k<26;k++){ const life = (ts*.35 + k/26 + j*.13) % 1, spread = (Math.sin(k*12.9898)*.5);
    const x = w*v + spread*life*50, y = h*.75 - life*h*.7;
    vx.fillStyle = `rgba(220,240,255,${.75*(1-life)})`; vx.fillRect(x, y, 1.6, 1.6); } });
  label("ENCELADUS · PLUMES FROM A HIDDEN OCEAN", 10, h-10, "rgba(20,40,70,.9)");
}

function iceWorld(ts: number, w: number, h: number, c1: string, c2: string, geysers: boolean, text: string){
  vx.fillStyle = "#03050b"; vx.fillRect(0,0,w,h); starfield(.7);
  const px = w*.5, py = h*1.9, pr = h*1.5;
  const g = vx.createRadialGradient(px - pr*.2, py - pr*.6, pr*.2, px, py, pr);
  g.addColorStop(0, c1); g.addColorStop(1, c2);
  vx.fillStyle = g; vx.beginPath(); vx.arc(px, py, pr, 0, 7); vx.fill();
  vx.save(); vx.beginPath(); vx.arc(px, py, pr, 0, 7); vx.clip();
  for (let k=0;k<6;k++){ vx.strokeStyle = "rgba(255,255,255,.08)"; vx.lineWidth = 5;
    vx.beginPath(); vx.arc(px, py, pr - 12 - k*14 + Math.sin(ts*.5 + k)*2, 0, 7); vx.stroke(); }
  vx.restore();
  vx.strokeStyle = "rgba(160,220,255,.25)"; vx.lineWidth = 2.4; vx.beginPath(); vx.arc(px, py, pr + 4, Math.PI*1.2, Math.PI*1.8); vx.stroke();
  if (geysers){
    const tx = w*.16, ty = h*.3;
    vx.fillStyle = lin(ty-16, ty+16, ["#f2d7d2","#a88c8c"]); vx.beginPath(); vx.arc(tx, ty, 16, 0, 7); vx.fill();
    for (let k=0;k<14;k++){ const life = (ts*.5 + k/14) % 1;
      vx.fillStyle = `rgba(40,30,30,${.8*(1-life)})`; vx.beginPath(); vx.arc(tx + 6 + life*14, ty - 14 - life*26, 1 + life*2, 0, 7); vx.fill(); }
    label("TRITON", tx - 18, ty + 30);
  }
  // wind streaks
  vx.strokeStyle = "rgba(255,255,255,.18)"; vx.lineWidth = 1;
  for (let k=0;k<6;k++){ const x = ((ts*(geysers ? .25 : .08) + k/6) % 1.2 - .1)*w, y = h*(.62 + k*.05);
    vx.beginPath(); vx.moveTo(x, y); vx.lineTo(x+30, y-1); vx.stroke(); }
  label(text, 10, h-10);
}
function uranus(ts: number, w: number, h: number){ iceWorld(ts, w, h, "#d6fbfb", "#4aa7b4", false, "−195 °C · NO KNOWN LIFE"); }
function neptune(ts: number, w: number, h: number){ iceWorld(ts, w, h, "#a9bfff", "#24398f", true, "−200 °C · 2,000 KM/H WINDS"); }

const SCENES: Record<string, (ts: number, w: number, h: number) => void> = { earth, mercury, venus, mars, europa, enceladus, uranus, neptune };

/** Draw one frame of the scene for `kind` (a LifeInfo.kind) into the canvas. */
export function drawVignette(canvas: HTMLCanvasElement, kind: string, ts: number, env?: SceneEnv) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  vx = ctx; VW = w; VH = h;
  vx.clearRect(0, 0, w, h);
  if (kind === "earth" && env) { drawEarthScene(ctx, w, h, ts, env); return; }
  (SCENES[kind] ?? mercury)(ts, w, h);
  // Lens finish for every scene: soft vignette, depth haze and fine grain, so nothing looks flat
  const haze = vx.createLinearGradient(0, 0, 0, h);
  haze.addColorStop(0, "rgba(255,255,255,0.03)"); haze.addColorStop(0.55, "rgba(255,255,255,0)"); haze.addColorStop(1, "rgba(0,0,0,0.25)");
  vx.fillStyle = haze; vx.fillRect(0, 0, w, h);
  const vg = vx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.42)");
  vx.fillStyle = vg; vx.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) { vx.fillStyle = `rgba(255,255,255,${((Math.sin(i * 91.7 + Math.floor(ts * 12) * 13.1) * 43758.5) % 1 + 1) % 1 * 0.035})`; vx.fillRect(((i * 37.3 + ts * 97) % w), ((i * 71.9 + ts * 53) % h), 1, 1); }
}
