// A living view of Earth from the Swiss Alps (46.5° N, 8° E): real sun position for the date and time,
// the Moon with its real phase, seasons, weather, a lake, and a village whose lights grow over the decades.
import { moonPosition, sunLongitude } from "../sim/sky";
import { DAY_MS, J2000, yearOf } from "../sim/time";
import { renderSky } from "./earthSky";
import type { LocalSky, SkyObject } from "./localSky";

const LAT = 46.5, LON = 8.0, RAD = Math.PI / 180;
type RGB = [number, number, number];
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mul = (a: RGB, b: RGB): RGB => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const css = (c: RGB, a = 1) => `rgba(${Math.round(Math.min(1, c[0]) * 255)},${Math.round(Math.min(1, c[1]) * 255)},${Math.round(Math.min(1, c[2]) * 255)},${a})`;
const hex = (h: string): RGB => { const n = parseInt(h.slice(1), 16); return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; };
const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hash = (n: number) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const noise1 = (x: number, seed: number) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return hash(i + seed) * (1 - u) + hash(i + 1 + seed) * u; };
const ridge = (x: number, seed: number, oct = 5) => { let s = 0, a = 0.5, f = 1; for (let k = 0; k < oct; k++) { s += a * noise1(x * f, seed + k * 17); a *= 0.5; f *= 2.1; } return s; };

export interface SceneEnv { day: number; daysPerSec: number; /** The sky seen from the surface (Sun and moons, with phases). */ sky?: LocalSky }

interface Layout { w: number; h: number; stars: [number, number, number][]; trees: { x: number; s: number; kind: number; seed: number }[]; houses: { x: number; w: number; h: number }[] }
let layout: Layout | null = null;
function getLayout(w: number, h: number): Layout {
  if (layout && layout.w === w && layout.h === h) return layout;
  const stars: [number, number, number][] = Array.from({ length: 160 }, (_, i) => [hash(i * 3.1), hash(i * 7.7) * 0.6, 0.3 + hash(i * 1.3) * 0.9]);
  const trees = Array.from({ length: 26 }, (_, i) => ({ x: hash(i * 5.3) * 1.05 - 0.02, s: 0.6 + hash(i * 2.9) * 0.6, kind: hash(i * 9.1) < 0.6 ? 0 : 1, seed: i })).sort((a, b) => a.s - b.s);
  const houses = Array.from({ length: 34 }, (_, i) => ({ x: 0.08 + hash(i * 4.7) * 0.5, w: 0.006 + hash(i * 3.3) * 0.008, h: 0.012 + hash(i * 6.1) * 0.012 }));
  layout = { w, h, stars, trees, houses };
  return layout;
}

/** Sun altitude/azimuth (degrees, azimuth measured from south, positive west) for the viewer. */
function sunPos(day: number, localHours: number) {
  const doy = dayOfYear(day);
  const dec = 23.44 * Math.sin((2 * Math.PI * (doy - 81)) / 365.25);
  const H = 15 * (localHours - 12);
  return altAz(dec, H);
}
function altAz(dec: number, H: number) {
  const phi = LAT * RAD, d = dec * RAD, h = H * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(h));
  const az = Math.atan2(Math.sin(h), Math.cos(h) * Math.sin(phi) - Math.tan(d) * Math.cos(phi));
  return { alt: alt / RAD, az: az / RAD };
}
function dayOfYear(day: number) {
  const dt = new Date(J2000 + day * DAY_MS);
  return (dt.getTime() - Date.UTC(dt.getUTCFullYear(), 0, 1)) / DAY_MS;
}

export function drawEarthScene(g: CanvasRenderingContext2D, w: number, h: number, ts: number, env: SceneEnv) {
  const L = getLayout(w, h);
  const racing = env.daysPerSec > 1.5;
  const ut = ((((env.day % 1) + 1) % 1) * 24 + 12) % 24;
  const local = racing ? 14.5 : (ut + LON / 15 + 24) % 24;
  const doy = dayOfYear(env.day);
  const year = yearOf(env.day);
  const sun = sunPos(env.day, local);
  const winter = 0.5 + 0.5 * Math.cos((2 * Math.PI * (doy - 22)) / 365.25);
  const season = doy < 80 || doy >= 355 ? "Winter" : doy < 172 ? "Spring" : doy < 266 ? "Summer" : "Autumn";
  // Weather changes day to day (fixed for each calendar day)
  const dayIdx = Math.floor(env.day);
  const cloud = racing ? 0.25 : Math.max(0, hash(dayIdx * 0.731) * 1.25 - 0.2);
  const precip = cloud > 0.82 ? (winter > 0.55 ? "snow" : "rain") : null;
  const snowGround = ss(0.62, 0.85, winter + (precip === "snow" ? 0.12 : 0));

  // Light: day, golden hour, twilight, night
  const a = sun.alt;
  const day = ss(-6, 8, a), gold = ss(-4, 2, a) * (1 - ss(6, 18, a)), night = 1 - ss(-14, -4, a);
  const overcast = ss(0.5, 1, cloud);
  let light: RGB = mix([0.1, 0.12, 0.22], [1, 0.98, 0.95], day);
  light = mix(light, [1.0, 0.7, 0.45], gold * 0.6);
  light = mix(light, [0.62, 0.65, 0.7], overcast * day * 0.5);
  const zenith = mix(mix(hex("#03050c"), hex("#16224a"), 1 - night), hex("#2d67c4"), day);
  let horizon = mix(mix(hex("#0b1124"), hex("#e07b58"), ss(-12, -2, a)), hex("#b9d6f2"), day);
  horizon = mix(horizon, hex("#ffbe86"), gold * 0.85);
  const grayZ = mix(zenith, [0.55, 0.58, 0.63].map(c => c * (0.15 + 0.85 * day)) as RGB, overcast * 0.85);
  const grayH = mix(horizon, [0.68, 0.7, 0.74].map(c => c * (0.15 + 0.85 * day)) as RGB, overcast * 0.85);

  const horizonY = h * 0.6;
  const shoreY = horizonY + 6;
  const lakeTop = shoreY, lakeBot = h * 0.8;
  const winterIce = ss(0.88, 1, winter);
  const sx = w / 2 + (sun.az / 95) * w * 0.48, sy = horizonY - (a / 50) * horizonY * 0.95;
  const m = moonPosition(env.day);
  const elong = ((m.lon - sunLongitude(env.day)) % 360 + 360) % 360;
  const mdec = 23.44 * Math.sin(m.lon * RAD) + m.lat;
  const moon = altAz(mdec, 15 * (local - 12) - elong);
  const snowlineGL = 0.58 - winter * 0.38 - snowGround * 0.1;

  // Season colors for the shader (grass, leaves, blossom, bare winter trees, flowers) and village lights by decade
  const grassC: RGB = doy < 80 || doy >= 340 ? hex("#6b7a4a") : doy < 140 ? hex("#79b24f") : doy < 250 ? hex("#4f8b36") : doy < 300 ? hex("#a7913f") : hex("#7a6a40");
  const foliageC: RGB = doy < 100 ? hex("#5f6b45") : doy < 140 ? hex("#9ed27a") : doy < 255 ? hex("#3e7a33") : doy < 290 ? hex("#d98b2e") : doy < 320 ? hex("#b5502e") : hex("#5a4a3a");
  const villageLit = Math.min(1, 0.12 + Math.max(0, year - 1944) / 70);

  // The whole landscape is drawn by a GPU shader: noise clouds, wave-distorted reflections, trees and their shadows.
  const dpr = g.getTransform().a || 1;
  const sunCol: RGB = mix([1, 0.55, 0.25], [1, 0.97, 0.88], ss(0, 20, a));
  const glSky = renderSky(Math.round(w * dpr), Math.round(h * dpr), {
    time: ts, sunAlt: a, day, gold, night, cloud, overcast, snowline: snowlineGL, ice: winterIce, stars: night * (1 - overcast),
    sun: [sx / w, 1 - sy / h], moon: [(w / 2 + (moon.az / 95) * w * 0.48) / w, 1 - (horizonY - (moon.alt / 50) * horizonY * 0.95) / h],
    moonR: 7 / h, moonVis: moon.alt > -2 ? 1 : 0, elong: elong * RAD, wind: 0.6 + hash(dayIdx * 1.7) * 1.2, shine: 1,
    zenith: grayZ, horizon: grayH, light, sunCol,
    sunAz: sun.az, snow: snowGround, village: villageLit, bare: doy >= 320 || doy < 95 ? 1 : 0, blossom: doy > 100 && doy < 135 ? 1 : 0,
    flowers: doy > 110 && doy < 230 ? 1 : 0, grass: grassC, foliage: foliageC,
    horizonY: 1 - horizonY / h, lakeTop: 1 - lakeTop / h, lakeBot: 1 - lakeBot / h,
  });
  if (glSky) g.drawImage(glSky, 0, 0, w, h);
  else {
  const sky = g.createLinearGradient(0, 0, 0, horizonY);
  sky.addColorStop(0, css(grayZ)); sky.addColorStop(1, css(grayH));
  g.fillStyle = sky; g.fillRect(0, 0, w, horizonY + 1);

  // Stars and the Milky Way
  const starA = night * (1 - overcast);
  if (starA > 0.02) {
    for (const [sx, sy, sb] of L.stars) { g.fillStyle = `rgba(235,235,255,${starA * sb * (0.75 + 0.25 * Math.sin(ts * 2 + sx * 50))})`; g.fillRect(sx * w, sy * h, 1.2, 1.2); }
    const mw = g.createLinearGradient(w * 0.2, 0, w * 0.8, h * 0.6);
    mw.addColorStop(0, "rgba(180,190,230,0)"); mw.addColorStop(0.5, `rgba(180,190,230,${0.07 * starA})`); mw.addColorStop(1, "rgba(180,190,230,0)");
    g.fillStyle = mw; g.fillRect(0, 0, w, horizonY);
  }

  // Sun
  if (a > -3) {
    const sc: RGB = mix([1, 0.55, 0.25], [1, 0.97, 0.88], ss(0, 20, a));
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, h * 0.55);
    glow.addColorStop(0, css(sc, 0.55 * (1 - overcast * 0.8))); glow.addColorStop(1, css(sc, 0));
    g.fillStyle = glow; g.fillRect(0, 0, w, horizonY);
    g.fillStyle = css(sc, 1 - overcast * 0.85);
    g.beginPath(); g.arc(sx, sy, 7, 0, Math.PI * 2); g.fill();
  }

  // Moon with its real phase
  if (moon.alt > -2) {
    const mx = w / 2 + (moon.az / 95) * w * 0.48, my = horizonY - (moon.alt / 50) * horizonY * 0.95;
    if (mx > -10 && mx < w + 10) {
      const r = 6.5, lit = (1 - Math.cos(elong * RAD)) / 2;
      g.save();
      g.globalAlpha = (0.35 + 0.65 * (1 - day * 0.7)) * (1 - overcast * 0.8);
      const mg = g.createRadialGradient(mx, my, 0, mx, my, r * 4);
      mg.addColorStop(0, `rgba(220,225,240,${0.25 * night})`); mg.addColorStop(1, "rgba(220,225,240,0)");
      g.fillStyle = mg; g.fillRect(mx - r * 4, my - r * 4, r * 8, r * 8);
      g.fillStyle = "rgba(40,44,60,0.6)"; g.beginPath(); g.arc(mx, my, r, 0, Math.PI * 2); g.fill();
      // lit part: right side when waxing (elong < 180), left when waning
      g.fillStyle = "#e9e6dc";
      g.beginPath();
      const waxing = elong < 180;
      g.arc(mx, my, r, -Math.PI / 2, Math.PI / 2, !waxing);
      g.ellipse(mx, my, Math.abs(1 - 2 * lit) * r, r, 0, Math.PI / 2, -Math.PI / 2, lit > 0.5 ? !waxing : waxing);
      g.fill();
      g.restore();
    }
  }

  // Clouds: flat-bottomed cumulus lit from above (orange at sunset, gray at night), or a stratus deck when overcast
  const cloudLit: RGB = mul(mix([0.97, 0.97, 0.98], [1, 0.72, 0.52], gold), light);
  const cloudDark: RGB = mul(mix([0.52, 0.55, 0.62], [0.45, 0.38, 0.45], gold), light);
  if (overcast > 0.05) {
    const deck = g.createLinearGradient(0, 0, 0, horizonY * 0.8);
    deck.addColorStop(0, css(mul([0.5, 0.53, 0.58], light), 0.9 * overcast)); deck.addColorStop(1, css(mul([0.68, 0.7, 0.74], light), 0.55 * overcast));
    g.fillStyle = deck; g.fillRect(0, 0, w, horizonY * 0.8);
    for (let i = 0; i < 26; i++) {
      const x = ((hash(i * 4.1) + ts * 0.003) % 1.2 - 0.1) * w, y = horizonY * (0.1 + hash(i * 2.3) * 0.6), rx = w * (0.08 + hash(i) * 0.12);
      g.fillStyle = css(mix(cloudDark, cloudLit, hash(i * 9.3) * 0.4), 0.18 * overcast);
      g.beginPath(); g.ellipse(x, y, rx, rx * 0.16, 0, 0, Math.PI * 2); g.fill();
    }
  }
  const nClouds = Math.round(2 + cloud * 7 * (1 - overcast * 0.6));
  g.filter = "blur(1.6px)"; // soft, vaporous edges
  for (let i = 0; i < nClouds; i++) {
    const cx = ((hash(i + dayIdx * 0.13) + ts * 0.004 * (0.6 + hash(i) * 0.6)) % 1.3 - 0.15) * w;
    const base = horizonY * (0.22 + hash(i * 3.7) * 0.45);
    const cw = w * (0.1 + hash(i * 1.9) * 0.14) * (0.8 + cloud * 0.4);
    g.save();
    g.beginPath(); g.rect(cx - cw, base - cw, cw * 2, cw); g.clip(); // flat bottom
    const puffs = 11;
    for (let k = 0; k < puffs; k++) {
      const f = k / (puffs - 1);
      const bx = cx + (f - 0.5) * cw * 1.3 + (hash(i * 10 + k) - 0.5) * cw * 0.15;
      const r = cw * (0.16 + 0.22 * Math.sin(f * Math.PI)) * (0.75 + hash(i * 30 + k) * 0.5);
      const by = base - r * 0.55;
      const cg = g.createRadialGradient(bx - r * 0.25, by - r * 0.45, r * 0.05, bx, by, r);
      cg.addColorStop(0, css(cloudLit, 0.95)); cg.addColorStop(0.65, css(mix(cloudLit, cloudDark, 0.45), 0.9)); cg.addColorStop(1, css(cloudDark, 0.0));
      g.fillStyle = cg; g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // shadowed underside
    const ug = g.createLinearGradient(0, base - cw * 0.12, 0, base);
    ug.addColorStop(0, css(cloudDark, 0)); ug.addColorStop(1, css(cloudDark, 0.45));
    g.fillStyle = ug; g.fillRect(cx - cw * 0.65, base - cw * 0.12, cw * 1.3, cw * 0.12);
  }

  g.filter = "none";

  // Mountains: three ridges fading into the haze; snowfields follow the slopes (lower in winter)
  const haze = grayH;
  const ridges = [
    { base: horizonY + 2, amp: h * 0.36, seed: 3.1, freq: 3.2, rock: hex("#7d8796"), depth: 0.55 },
    { base: horizonY + 4, amp: h * 0.24, seed: 8.7, freq: 4.5, rock: hex("#5b6470"), depth: 0.32 },
    { base: horizonY + 6, amp: h * 0.14, seed: 15.2, freq: 6.0, rock: hex("#34443a"), depth: 0.12 },
  ];
  const snowline = 0.58 - winter * 0.38 - snowGround * 0.1;
  ridges.forEach((r, ri) => {
    const step = 2, top: number[] = [];
    for (let x = 0; x <= w + step; x += step) top.push(r.base - ridge((x / w) * r.freq, r.seed) * r.amp * (ri === 0 ? 1 : 0.85));
    const col = mul(mix(r.rock, haze, r.depth * (0.6 + 0.4 * (1 - night))), light);
    const peak = Math.min(...top);
    const mg = g.createLinearGradient(0, peak, 0, r.base);
    mg.addColorStop(0, css(mix(col, mul(haze, light), 0.15))); mg.addColorStop(1, css(col.map(c => c * 0.78) as RGB));
    g.fillStyle = mg;
    g.beginPath(); g.moveTo(0, horizonY + 20);
    top.forEach((y, i) => g.lineTo(i * step, y));
    g.lineTo(w, horizonY + 20); g.closePath(); g.fill();
    // shadowed slopes (facing away from the sun)
    if (day > 0.1) {
      g.fillStyle = css(mul([0.2, 0.24, 0.35], light), 0.22 * day * (1 - overcast * 0.7));
      g.beginPath();
      for (let i = 1; i < top.length; i++) {
        const x0 = (i - 1) * step, x1 = i * step, slope = top[Math.min(top.length - 1, i + 3)] - top[Math.max(0, i - 4)];
        if ((sx > x1 ? slope : -slope) > 0) { g.moveTo(x0, top[i - 1]); g.lineTo(x1, top[i]); g.lineTo(x1, top[i] + (r.base - top[i]) * 0.7); g.lineTo(x0, top[i - 1] + (r.base - top[i - 1]) * 0.7); g.closePath(); }
      }
      g.fill();
    }
    if (ri < 2) {
      // snowfield: from the ridge line down to a wavy snowline
      const snowY = (i: number) => r.base - r.amp * (snowline + (noise1(i * 0.09, r.seed * 3) - 0.5) * 0.16);
      const sc = mul(mix([0.95, 0.96, 1.0], haze, r.depth * 0.45), light);
      const sg = g.createLinearGradient(0, peak, 0, r.base - r.amp * snowline);
      sg.addColorStop(0, css(sc)); sg.addColorStop(1, css(mix(sc, col, 0.35)));
      g.fillStyle = sg;
      g.beginPath();
      let open = false;
      for (let i = 0; i < top.length; i++) {
        const y = top[i], sy2 = snowY(i);
        if (y < sy2) { if (!open) { g.moveTo(i * step, sy2); open = true; } g.lineTo(i * step, y); }
        else if (open) {
          for (let j = i - 1; j >= 0 && top[j] < snowY(j); j--) g.lineTo(j * step, snowY(j));
          g.closePath(); open = false;
        }
      }
      if (open) { for (let j = top.length - 1; j >= 0 && top[j] < snowY(j); j--) g.lineTo(j * step, snowY(j)); g.closePath(); }
      g.fill();
    }
  });

  // Lake: reflects the sky and mountains, with ripples and a glitter path under a low sun
  const lg = g.createLinearGradient(0, lakeTop, 0, lakeBot);
  lg.addColorStop(0, css(mul(mix(grayH, [0.2, 0.3, 0.4], 0.35), [0.85, 0.9, 0.95]))); lg.addColorStop(1, css(mul(mix(grayZ, [0.05, 0.12, 0.2], 0.5), [0.8, 0.85, 0.9])));
  g.fillStyle = lg; g.fillRect(0, lakeTop, w, lakeBot - lakeTop);
  g.save(); g.globalAlpha = 0.35; g.translate(0, lakeTop * 2); g.scale(1, -1);
  const r0 = ridges[0];
  g.fillStyle = css(mul(mix(r0.rock, haze, 0.6), light));
  g.beginPath(); g.moveTo(0, lakeTop);
  for (let x = 0; x <= w; x += 3) g.lineTo(x, r0.base + 4 - ridge((x / w) * r0.freq, r0.seed) * r0.amp * 0.5);
  g.lineTo(w, lakeTop); g.fill(); g.restore();
  if (a > -2 && a < 30 && overcast < 0.7) {
    for (let k = 0; k < 18; k++) {
      const yy = lakeTop + (k / 18) * (lakeBot - lakeTop), spread = 4 + k * 1.6;
      g.fillStyle = `rgba(255,${200 + 40 * ss(0, 20, a)},${140 + 80 * ss(0, 20, a)},${(0.5 - k / 40) * (1 - overcast)})`;
      g.fillRect(sx - spread / 2 + Math.sin(ts * 3 + k) * 2, yy, spread, 1);
    }
  }
  g.strokeStyle = css(mul([0.9, 0.95, 1], light), 0.18 * (1 - winterIce)); g.lineWidth = 1;
  for (let k = 0; k < 7; k++) { const yy = lakeTop + 4 + k * 4.5; g.beginPath(); for (let x = 0; x <= w; x += 6) g.lineTo(x, yy + Math.sin(x * 0.07 + ts * 1.6 + k) * 0.8); g.stroke(); }
  if (winterIce > 0) { g.fillStyle = css(mul([0.85, 0.9, 0.95], light), 0.55 * winterIce); g.fillRect(0, lakeTop, w, lakeBot - lakeTop); }
  }

  if (!glSky) {
  // Village on the far shore: lights spread as the decades pass
  const lit = night * Math.min(1, 0.12 + Math.max(0, year - 1944) / 70);
  L.houses.forEach((hs, i) => {
    const x = hs.x * w, hh = hs.h * h * 2.2, ww = hs.w * w * 1.6;
    g.fillStyle = css(mul(hex("#c9b9a0"), light)); g.fillRect(x, shoreY - hh, ww, hh);
    g.fillStyle = css(mul(hex("#7a3f2c"), light)); g.beginPath(); g.moveTo(x - 1, shoreY - hh); g.lineTo(x + ww / 2, shoreY - hh - hh * 0.6); g.lineTo(x + ww + 1, shoreY - hh); g.fill();
    if (lit > 0.05 && hash(i * 2.3) < lit + 0.15) {
      g.fillStyle = `rgba(255,205,130,${Math.min(1, lit * 1.3) * (0.8 + 0.2 * Math.sin(ts * 3 + i))})`;
      g.fillRect(x + ww * 0.3, shoreY - hh * 0.6, 1.4, 1.4);
    }
  });

  if (lit > 0.05) L.houses.forEach((hs, i) => { if (hash(i * 2.3) < lit + 0.15) { g.fillStyle = `rgba(255,205,130,${lit * 0.35})`; g.fillRect(hs.x * w + hs.w * w * 0.5, lakeTop + 4 + hash(i) * 10, 1, 4); } });

  // Meadow in the foreground: the season shows in the grass and the trees
  const grass: RGB = doy < 80 || doy >= 340 ? hex("#6b7a4a") : doy < 140 ? hex("#79b24f") : doy < 250 ? hex("#4f8b36") : doy < 300 ? hex("#a7913f") : hex("#7a6a40");
  const mg2 = g.createLinearGradient(0, lakeBot, 0, h);
  mg2.addColorStop(0, css(mul(grass, light))); mg2.addColorStop(1, css(mul(grass.map(c => c * 0.6) as RGB, light)));
  g.fillStyle = mg2; g.fillRect(0, lakeBot, w, h - lakeBot);
  if (snowGround > 0) { g.fillStyle = css(mul([0.9, 0.93, 0.97], light), snowGround * 0.92); g.fillRect(0, lakeBot, w, h - lakeBot); }
  // grass blades and flowers
  if (snowGround < 0.6) {
    for (let i = 0; i < 90; i++) {
      const x = hash(i * 1.7) * w, y = lakeBot + 3 + hash(i * 2.9) * (h - lakeBot - 3), bend = Math.sin(ts * 1.5 + i) * 1.2;
      g.strokeStyle = css(mul(grass.map(c => c * 1.25) as RGB, light), 0.7 * (1 - snowGround)); g.beginPath(); g.moveTo(x, y); g.lineTo(x + bend, y - 4); g.stroke();
      if (doy > 110 && doy < 230 && i % 4 === 0) { g.fillStyle = css(mul(["#f3e36b", "#f4f4f4", "#d77ad8", "#ff8f6b"].map(hex)[i % 4], light)); g.fillRect(x, y - 4, 1.6, 1.6); }
    }
  }
  // trees
  const foliage: RGB = doy < 100 ? hex("#5f6b45") : doy < 140 ? hex("#9ed27a") : doy < 255 ? hex("#3e7a33") : doy < 290 ? hex("#d98b2e") : doy < 320 ? hex("#b5502e") : hex("#5a4a3a");
  const blossom = doy > 100 && doy < 135;
  for (const t of L.trees) {
    const x = t.x * w, base = lakeBot + (t.s - 0.6) * (h - lakeBot) * 1.4 + 6, hh = h * 0.16 * t.s;
    if (t.kind === 0) {
      // conifer
      const c = mul(hex("#1f4a2e"), light);
      for (let k = 0; k < 3; k++) {
        const y0 = base - hh * (0.35 + k * 0.28), ww = hh * (0.36 - k * 0.09);
        g.fillStyle = css(c); g.beginPath(); g.moveTo(x, y0 - hh * 0.32); g.lineTo(x - ww, y0); g.lineTo(x + ww, y0); g.fill();
        if (snowGround > 0.2) { g.fillStyle = css(mul([0.92, 0.95, 1], light), snowGround * 0.85); g.beginPath(); g.moveTo(x, y0 - hh * 0.32); g.lineTo(x - ww * 0.5, y0 - hh * 0.14); g.lineTo(x + ww * 0.5, y0 - hh * 0.14); g.fill(); }
      }
      g.fillStyle = css(mul(hex("#4a3426"), light)); g.fillRect(x - 1, base - hh * 0.35, 2, hh * 0.35);
    } else {
      // deciduous
      g.strokeStyle = css(mul(hex("#4a3426"), light)); g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x, base); g.lineTo(x, base - hh * 0.55); g.moveTo(x, base - hh * 0.4); g.lineTo(x - hh * 0.15, base - hh * 0.7); g.moveTo(x, base - hh * 0.45); g.lineTo(x + hh * 0.17, base - hh * 0.72); g.stroke();
      const bare = doy >= 320 || doy < 95;
      if (!bare) for (let k = 0; k < 5; k++) {
        const bx = x + (hash(t.seed * 7 + k) - 0.5) * hh * 0.5, by = base - hh * (0.62 + hash(t.seed * 3 + k) * 0.3), br = hh * (0.14 + hash(t.seed + k) * 0.08);
        const fc = blossom && k % 2 ? hex("#f2c9d8") : foliage;
        const cg = g.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
        cg.addColorStop(0, css(mul(fc.map(c => c * 1.2) as RGB, light))); cg.addColorStop(1, css(mul(fc.map(c => c * 0.7) as RGB, light)));
        g.fillStyle = cg; g.beginPath(); g.arc(bx, by, br, 0, Math.PI * 2); g.fill();
      }
    }
  }
  }

  // Weather: falling snow or rain
  if (precip) {
    g.fillStyle = "rgba(240,244,255,0.8)"; g.strokeStyle = "rgba(200,210,230,0.35)";
    for (let i = 0; i < 70; i++) {
      const px = (hash(i * 3.3) * w + (precip === "snow" ? Math.sin(ts + i) * 6 : ts * 30)) % w;
      const py = (hash(i * 5.1) * h + ts * (precip === "snow" ? 18 : 260)) % h;
      if (precip === "snow") g.fillRect(px, py, 1.6, 1.6);
      else { g.beginPath(); g.moveTo(px, py); g.lineTo(px - 1.5, py + 7); g.stroke(); }
    }
  }
  // Birds on clear days
  if (day > 0.6 && cloud < 0.6 && !precip) {
    g.strokeStyle = css(mul([0.15, 0.17, 0.2], [1, 1, 1]), 0.7); g.lineWidth = 1.1;
    for (let i = 0; i < 4; i++) {
      const bx = ((ts * 0.03 * (0.7 + i * 0.1) + i * 0.27) % 1.2 - 0.1) * w, by = horizonY * (0.25 + i * 0.07), f = Math.sin(ts * 7 + i * 2) * 2.5;
      g.beginPath(); g.moveTo(bx - 4, by - f); g.lineTo(bx, by); g.lineTo(bx + 4, by - f); g.stroke();
    }
  }

  // Lens: soft vignette and a touch of grain
  const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.38)");
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${hash(i + Math.floor(ts * 12)) * 0.035})`; g.fillRect(hash(i * 1.1 + ts) * w, hash(i * 2.2 + ts) * h, 1, 1); }

  // Caption
  const hh24 = Math.floor(local), mm = Math.floor((local - hh24) * 60);
  const time = racing ? "time is racing" : `${((hh24 + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh24 < 12 ? "am" : "pm"}`;
  const weather = precip ? (precip === "snow" ? "snowing" : "raining") : cloud > 0.6 ? "overcast" : cloud > 0.3 ? "partly cloudy" : a < -6 ? "clear night" : "clear";
  g.font = "600 11px 'IBM Plex Sans', system-ui, sans-serif";
  g.shadowColor = "rgba(0,0,0,0.8)"; g.shadowBlur = 4;
  g.fillStyle = "rgba(255,255,255,0.92)";
  g.fillText(`Swiss Alps, 46.5° N · ${time} · ${season}, ${weather}`, 10, h - 10);
  g.shadowBlur = 0;
}

/** Mars (Jezero Crater) or Mercury, lit by the sun at the world's local solar time. Returns false if WebGL is unavailable. */
export function drawAlienScene(g: CanvasRenderingContext2D, w: number, h: number, ts: number, kind: "mars" | "mercury", sky: LocalSky): boolean {
  const hour = sky.hour, alt = sky.sunAlt, az = sky.sunAz;
  const day = ss(-5, 6, alt), gold = ss(-4, 2, alt) * (1 - ss(6, 16, alt)), night = 1 - ss(-12, -3, alt);
  const horizonY = h * 0.6;
  const sx = w / 2 + (az / 95) * w * 0.48, sy = horizonY - (alt / 50) * horizonY * 0.95;
  const light: RGB = kind === "mars"
    ? mix(mix([0.05, 0.04, 0.05], [0.95, 0.86, 0.76], day), [1.0, 0.7, 0.55], gold * 0.4)
    : mix([0.0, 0.0, 0.0], [1.25, 1.22, 1.15], ss(-1, 2, alt));
  const sunCol: RGB = kind === "mars" ? mix([0.75, 0.8, 1.0], [1, 0.97, 0.92], ss(0, 15, alt)) : [1, 0.98, 0.92];
  const toScreen = (o: SkyObject): [number, number] => [0.5 + (o.az / 95) * 0.48, 1 - (horizonY - (o.alt / 50) * horizonY * 0.95) / h];
  const phobos = sky.objects.find(o => o.id === "phobos"), deimos = sky.objects.find(o => o.id === "deimos");
  const dpr = g.getTransform().a || 1;
  const img = renderSky(Math.round(w * dpr), Math.round(h * dpr), {
    moon2: deimos ? toScreen(deimos) : [0, 0], moon2R: 0.007, moon2Vis: deimos && deimos.alt > -1 ? 1 : 0, elong2: deimos?.elong ?? 0, shine: 0.6,
    mode: kind === "mars" ? 1 : 2, time: ts, sunAlt: alt, sunAz: az, day, gold, night, cloud: 0, overcast: 0, snowline: 9, ice: 0,
    stars: kind === "mercury" ? 1 : night, sun: [sx / w, 1 - sy / h], moon: phobos ? toScreen(phobos) : [0, 0], moonR: 0.017, moonVis: phobos && phobos.alt > -1 ? 1 : 0, elong: phobos?.elong ?? 0, wind: 1,
    snow: 0, village: 0, bare: 0, blossom: 0, flowers: 0, zenith: [0, 0, 0], horizon: [0.8, 0.6, 0.45], light, sunCol, grass: [0, 0, 0], foliage: [0, 0, 0],
    horizonY: 1 - horizonY / h, lakeTop: 0, lakeBot: 0,
  });
  if (!img) return false;
  g.drawImage(img, 0, 0, w, h);
  const vg = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.75);
  vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.38)");
  g.fillStyle = vg; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(255,255,255,${hash(i + Math.floor(ts * 12)) * 0.03})`; g.fillRect(hash(i * 1.1 + ts) * w, hash(i * 2.2 + ts) * h, 1, 1); }
  const hh = Math.floor(((hour % 24) + 24) % 24), mm = Math.floor((hour - Math.floor(hour)) * 60);
  const time = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "am" : "pm"}`;
  g.font = "600 11px 'IBM Plex Sans', system-ui, sans-serif";
  g.shadowColor = "rgba(0,0,0,0.8)"; g.shadowBlur = 4; g.fillStyle = "rgba(255,255,255,0.92)";
  g.fillText(kind === "mars" ? `Jezero Crater, Mars · ${time} local · ${alt > 0 ? "daytime" : "night"}` : `Mercury, Caloris plains · ${time} local · ${alt > 0 ? "day (800 °F)" : "night (−290 °F)"}`, 10, h - 10);
  g.shadowBlur = 0;
  return true;
}
