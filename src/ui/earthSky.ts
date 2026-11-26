// GPU-rendered surface views for the World tab: Earth (an alpine lake), Mars (a dune field) and Mercury (airless craters).
// Everything is procedural: fractal noise for clouds, rock, grass and water; analytic shapes for trees, houses and rocks;
// shadows are cast from the real sun position (trees and rocks on the ground, mountains on mountains, clouds on the land).

const VS = `#version 300 es
in vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
out vec4 o;
uniform vec2 uRes;
uniform int uMode;                 // 0 Earth, 1 Mars, 2 Mercury
uniform float uTime, uSunAlt, uSunAz, uDay, uGold, uNight, uCloud, uOvercast, uSnowline, uIce, uStars;
uniform float uMoonR, uMoonVis, uElong, uWind, uSnow, uVillage, uBare, uBlossom, uFlowers;
uniform vec2 uSun, uMoon, uMoon2;
uniform float uMoon2R, uMoon2Vis, uElong2, uShine;
uniform vec3 uZenith, uHorizon, uLight, uSunCol, uGrass, uFoliage;
uniform float uHorizonY, uLakeTop, uLakeBot;

// ---------- noise ----------
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm(vec2 p, int oct){ float s = 0.0, a = 0.5; for (int i = 0; i < 8; i++){ if (i >= oct) break; s += a * vnoise(p); p = ROT * p; a *= 0.5; } return s; }
float ridgeN(float x, float seed, int oct){ float s = 0.0, a = 0.5, f = 1.0; for (int i = 0; i < 7; i++){ if (i >= oct) break; s += a * vnoise(vec2(x * f, seed + float(i) * 17.0)); a *= 0.5; f *= 2.07; } return s; }
float A(){ return uRes.x / uRes.y; }
float sunUp(){ return smoothstep(-1.0, 3.0, uSunAlt); }
// Shadow length relative to object height, and its direction on screen (we look south: a sun ahead throws shadows toward us)
vec2 shadowVec(){
  float az = radians(uSunAz);
  float len = clamp(1.0 / tan(radians(max(uSunAlt, 2.5))), 0.0, 7.0);
  return vec2(-sin(az) / A(), -cos(az) * 0.32) * len;
}

// ---------- sky ----------
vec3 skyBase(vec2 p, vec3 zen, vec3 hor, vec3 glowCol){
  float t = clamp((p.y - uHorizonY) / (1.0 - uHorizonY), 0.0, 1.0);
  vec3 c = mix(hor, zen, pow(t, 0.5));
  float r = length((p - uSun) * vec2(A(), 1.0));
  c += glowCol * (0.55 * exp(-r * 9.0) + 0.22 * exp(-r * 2.4)) * (1.0 - uOvercast * 0.85) * smoothstep(-8.0, 2.0, uSunAlt);
  c += hor * 0.15 * exp(-t * 9.0) * (0.3 + uDay);
  if (uStars > 0.01){
    vec2 g = floor(p * uRes / 1.6);
    float h = hash(g);
    c += vec3(0.9, 0.92, 1.0) * step(0.9965, h) * uStars * (0.6 + 0.4 * sin(uTime * (1.5 + h * 3.0) + h * 40.0)) * (0.4 + 0.6 * hash(g + 7.0)) * smoothstep(0.0, 0.12, t);
    float mw = exp(-pow((p.y - 0.75 + (p.x - 0.5) * 0.6) * 5.0, 2.0)) * fbm(p * 6.0, 4);
    c += vec3(0.55, 0.58, 0.75) * mw * 0.06 * uStars;
  }
  return c;
}
vec3 sunDisc(vec2 p, vec3 c, float size, float bright){
  float r = length((p - uSun) * vec2(A(), 1.0));
  return mix(c, uSunCol * bright, smoothstep(size, size * 0.7, r) * (1.0 - uOvercast * 0.9) * smoothstep(-2.5, 0.0, uSunAlt));
}
// A moon lit by the Sun at its real phase angle. The terminator fades smoothly (Lambert shading over a sphere),
// and the night side keeps a faint glow (earthshine from the planet you're standing on).
vec3 moonDisc(vec2 p, vec3 c, vec2 pos, float R, float elong, vec3 tint){
  vec2 md = (p - pos) * vec2(A(), 1.0) / R;
  float mr = length(md);
  if (mr < 1.0){
    vec3 n = vec3(md.x, md.y, sqrt(1.0 - mr * mr));
    vec3 L = vec3(sin(elong), 0.0, -cos(elong));
    float ndl = dot(n, L);
    float lit = pow(clamp(ndl, 0.0, 1.0), 0.7) * smoothstep(-0.12, 0.3, ndl);
    float maria = 0.72 + 0.28 * smoothstep(0.35, 0.65, fbm(md * 2.2 + 3.0, 4));
    float craters = 0.92 + 0.08 * fbm(md * 9.0 + 1.0, 3);
    float shine = uShine * (0.5 + 0.5 * cos(elong)) * 0.08;      // earthshine is strongest near new moon
    vec3 mc = tint * maria * craters * (lit + shine);
    c = mix(c, mc * (0.6 + 0.6 * (1.0 - uDay)), smoothstep(1.0, 0.92, mr) * (1.0 - uOvercast * 0.85));
  }
  c += tint * exp(-mr * 0.9) * 0.05 * uNight * (1.0 - uOvercast);
  return c;
}

// ---------- clouds (Earth) ----------
float cloudDensity(vec2 q){ float warp = fbm(q * 0.7 + 3.1, 4); return fbm(q * 1.5 + vec2(warp * 1.4, warp * 0.6), 6); }
float coverage(){ return mix(0.66, 0.34, uCloud); }
vec4 clouds(vec2 p){
  float e = p.y - uHorizonY;
  if (e <= 0.0) return vec4(0.0);
  float dist = 0.32 / (e + 0.03);
  vec2 q = vec2((p.x - 0.5) * A() * dist, dist) * 1.3 + vec2(uTime * 0.015 * uWind, 0.0);
  float d = cloudDensity(q), cov = coverage();
  float a = smoothstep(cov, cov + 0.16, d);
  vec2 toSun = normalize(vec2((uSun.x - 0.5) * A(), 0.35 + max(uSun.y - uHorizonY, 0.0)));
  float d2 = cloudDensity(q + toSun * 0.18);
  float shade = clamp(1.1 - (d2 - cov) * 2.6 - (d - cov) * 0.8, 0.0, 1.0);
  vec3 lit = mix(vec3(0.96, 0.97, 1.0), vec3(1.0, 0.68, 0.45), uGold) * uLight;
  vec3 dark = mix(vec3(0.42, 0.46, 0.55), vec3(0.38, 0.28, 0.36), uGold) * uLight;
  vec3 col = mix(dark, lit, shade);
  float r = length((p - uSun) * vec2(A(), 1.0));
  col += uSunCol * exp(-r * 5.0) * (1.0 - smoothstep(cov, cov + 0.25, d)) * 1.2 * smoothstep(-4.0, 1.0, uSunAlt);
  float ci = fbm(vec2(q.x * 0.25, q.y * 2.4) + vec2(uTime * 0.006, 0.0), 5);
  float ca = smoothstep(0.55, 0.85, ci) * 0.35 * smoothstep(0.1, 0.5, uCloud) * (1.0 - a);
  col = mix(col, lit, ca / max(a + ca, 1e-3));
  a = max(a, ca);
  float deck = uOvercast * (0.75 + 0.25 * fbm(q * 0.6 + uTime * 0.01, 5));
  col = mix(col, mix(dark, lit, 0.45 + 0.2 * fbm(q * 1.2, 4)), deck * (1.0 - a * 0.5));
  a = max(a, deck * 0.92);
  col = mix(col, uHorizon * 0.95, smoothstep(0.22, 0.0, e) * 0.65);
  a *= smoothstep(0.0, 0.035, e);
  return vec4(col, a);
}
// Shadow of the clouds on the ground at screen point p, for a surface at the given distance
float cloudShadow(vec2 p, float dist){
  if (uMode != 0 || uCloud < 0.05) return 1.0;
  vec2 q = vec2((p.x - 0.5) * A() * dist, dist) * 1.3 + vec2(uTime * 0.015 * uWind, 0.0) + vec2(0.4, 0.25);
  float d = cloudDensity(q * 0.9);
  return 1.0 - 0.45 * smoothstep(coverage(), coverage() + 0.18, d) * uDay * (1.0 - uOvercast);
}

// ---------- mountains ----------
vec3 rangeColor(int i, vec2 p, out float covered){
  float amps[3] = float[3](0.36, 0.24, 0.14);
  float freqs[3] = float[3](3.2, 4.5, 6.0);
  float seeds[3] = float[3](3.1, 8.7, 15.2);
  vec3 rocks[3] = vec3[3](vec3(0.49, 0.53, 0.59), vec3(0.36, 0.39, 0.44), vec3(0.2, 0.27, 0.23));
  if (uMode == 1){ rocks[0] = vec3(0.62, 0.38, 0.25); rocks[1] = vec3(0.55, 0.32, 0.2); rocks[2] = vec3(0.48, 0.27, 0.17); amps = float[3](0.2, 0.14, 0.09); }
  if (uMode == 2){ rocks[0] = vec3(0.45, 0.44, 0.42); rocks[1] = vec3(0.4, 0.39, 0.37); rocks[2] = vec3(0.35, 0.34, 0.33); amps = float[3](0.12, 0.09, 0.06); }
  float base = uHorizonY - 0.01 - float(i) * 0.012;
  float x = p.x * freqs[i];
  float top = base + ridgeN(x, seeds[i], 7) * amps[i] * (i == 0 ? 1.0 : 0.85);
  covered = p.y <= top ? 1.0 : 0.0;
  if (covered < 0.5) return vec3(0.0);
  float rel = (p.y - base) / amps[i];
  float e = 0.012;
  float slope = (ridgeN(x + e * freqs[i], seeds[i], 4) - ridgeN(x - e * freqs[i], seeds[i], 4)) * amps[i] / (2.0 * e);
  vec2 n = normalize(vec2(-slope, 1.0));
  vec2 sd = normalize(vec2(uSun.x - p.x, 0.25 + max(uSunAlt, -5.0) / 40.0));
  float gully = fbm(vec2(p.x * 26.0 + p.y * 6.0, p.y * 9.0) + seeds[i], 5);
  float sunlit = clamp(dot(n, sd) * 0.7 + 0.45 + (gully - 0.5) * 0.6, 0.18, 1.2);
  // Cast shadow: does a ridge between here and the sun block it? (matters at sunrise and sunset)
  float shadow = 1.0;
  if (uSunAlt < 28.0 && uSunAlt > -1.0){
    float dir = sign(uSun.x - p.x);
    float tanA = tan(radians(max(uSunAlt, 0.5)));
    for (int k = 1; k <= 8; k++){
      float dx = float(k) * 0.025;
      float hs = base + ridgeN((p.x + dir * dx) * freqs[i], seeds[i], 4) * amps[i] * (i == 0 ? 1.0 : 0.85);
      if (hs > p.y + dx * A() * tanA * 0.6) { shadow = 0.45; break; }
    }
  }
  float strata = fbm(vec2(p.x * 35.0, p.y * 110.0) + seeds[i] * 2.0, 4);
  vec3 rock = rocks[i] * (0.8 + 0.3 * strata + 0.2 * (gully - 0.5));
  float snowAmt = uMode == 0 ? 1.0 : 0.0;
  float sn = smoothstep(0.0, 0.07, rel - uSnowline - (fbm(vec2(x * 3.0, seeds[i]), 4) - 0.5) * 0.25 - (gully - 0.5) * 0.35) * snowAmt;
  vec3 col = mix(rock, vec3(0.94, 0.95, 1.0), sn * (i < 2 ? 1.0 : 0.6));
  float dist = 2.0 - float(i) * 0.5;
  float lightK = mix(1.0, sunlit * shadow, uDay * (1.0 - uOvercast * 0.6)) * cloudShadow(p, dist * 3.0);
  if (uMode == 2) lightK = sunlit * shadow;   // no atmosphere: no fill light in shadows
  col *= lightK * uLight;
  float depths[3] = float[3](0.55, 0.32, 0.12);
  float haze = uMode == 2 ? 0.0 : depths[i] * (0.65 + 0.35 * (1.0 - uNight));
  col = mix(col, uHorizon * mix(0.85, 1.0, uDay), haze);
  return col;
}
vec3 mountains(vec2 p, vec3 c){
  for (int i = 0; i < 3; i++){ float cov; vec3 m = rangeColor(i, p, cov); if (cov > 0.5) c = m; }
  return c;
}

// ---------- the village on the far shore ----------
vec4 village(vec2 p){
  float y0 = uLakeTop + 0.003;
  if (p.y < uLakeTop || p.y > uLakeTop + 0.11 || p.x > 0.66 || p.x < 0.03) return vec4(0.0);
  float cell = floor(p.x * 30.0);
  vec4 res = vec4(0.0);
  for (int k = -1; k <= 0; k++){
    float c = cell + float(k);
    float h = hash(vec2(c, 3.7));
    if (h < 0.22) continue;
    bool church = hash(vec2(c, 9.1)) > 0.93;
    float w = (0.55 + 0.35 * hash(vec2(c, 1.3))) / 30.0;
    float x0 = (c + 0.1 + 0.2 * hash(vec2(c, 5.5))) / 30.0;
    float hgt = church ? 0.075 : 0.022 + 0.018 * hash(vec2(c, 2.2));
    float u = (p.x - x0) / w, v = (p.y - y0) / hgt;
    vec3 col; float hit = 0.0;
    float sunSide = sign(uSun.x - (x0 + w * 0.5));
    if (u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0){
      hit = 1.0;
      col = church ? vec3(0.86, 0.84, 0.8) : mix(vec3(0.85, 0.78, 0.66), vec3(0.78, 0.7, 0.6), hash(vec2(c, 8.0)));
      col *= 0.82 + 0.18 * smoothstep(0.0, 1.0, (u - 0.5) * sunSide + 0.5) * uDay;   // light from the sun's side
      // windows: glassy by day, warm at night
      vec2 wg = vec2(fract(u * (church ? 1.0 : 3.0)), fract(v * (church ? 4.0 : 2.0)));
      if (wg.x > 0.32 && wg.x < 0.68 && wg.y > 0.35 && wg.y < 0.75){
        float on = step(hash(vec2(c, floor(u * 3.0) + floor(v * 2.0) * 7.0)), uVillage);
        col = mix(uZenith * 0.5 + vec3(0.05), vec3(1.3, 0.85, 0.45) * 1.6, on * uNight);
      }
    } else if (u >= -0.08 && u <= 1.08 && v > 1.0 && v < 1.0 + (church ? 0.7 : 0.55)){
      float rv = (v - 1.0) / (church ? 0.7 : 0.55);
      if (abs(u - 0.5) < 0.58 * (1.0 - rv)){
        hit = 1.0;
        col = church ? vec3(0.32, 0.3, 0.32) : vec3(0.55, 0.24, 0.16);
        col *= ((u - 0.5) * sunSide > 0.0 ? 1.15 : 0.75 + 0.25 * (1.0 - uDay));
        col = mix(col, vec3(0.92, 0.94, 0.98), uSnow * 0.85);
      }
    }
    if (hit > 0.0){ col *= uLight * cloudShadow(p, 1.2); res = vec4(col, 1.0); }
  }
  // shoreline meadow strip
  if (res.a < 0.5 && p.y < uLakeTop + 0.006) res = vec4(mix(uGrass * 0.8, vec3(0.9, 0.92, 0.96), uSnow) * uLight, 1.0);
  return res;
}

vec3 earthAbove(vec2 p){
  vec3 c = skyBase(p, uZenith, uHorizon, uSunCol);
  c = sunDisc(p, c, 0.024, 2.4);
  if (uMoonVis > 0.0) c = moonDisc(p, c, uMoon, uMoonR, uElong, vec3(0.92, 0.9, 0.84));
  vec4 cl = clouds(p);
  c = mix(c, cl.rgb, cl.a);
  c = mountains(p, c);
  vec4 v = village(p);
  c = mix(c, v.rgb, v.a);
  return c;
}

// ---------- trees ----------
// Rows of conifers and broadleaf trees standing on the meadow. Returns color/alpha.
struct Tree { vec2 base; float h; float kind; float seed; };
Tree treeAt(int row, float cell){
  float rowY[3] = float[3](0.205, 0.13, 0.04);
  float rowH[3] = float[3](0.13, 0.2, 0.32);
  float dens[3] = float[3](11.0, 7.0, 4.5);
  Tree t;
  t.seed = hash(vec2(cell, float(row) * 13.1));
  t.base = vec2((cell + 0.25 + 0.5 * hash(vec2(cell, float(row) + 2.0))) / dens[row], uLakeBot * (rowY[row] / 0.205) - 0.004 - 0.012 * hash(vec2(cell, 9.0)));
  t.h = rowH[row] * (0.7 + 0.5 * hash(vec2(cell, float(row) + 5.0)));
  t.kind = hash(vec2(cell, float(row) + 7.0)) < 0.58 ? 0.0 : 1.0;
  if (hash(vec2(cell, float(row) + 11.0)) < (row == 2 ? 0.55 : 0.3)) t.h = 0.0;   // gaps
  return t;
}
float treeDensity(int row){ float d[3] = float[3](11.0, 7.0, 4.5); return d[row]; }

vec4 drawTree(Tree t, vec2 p){
  if (t.h <= 0.0) return vec4(0.0);
  float u = (p.x - t.base.x) * A() / t.h, v = (p.y - t.base.y) / t.h;
  if (v < -0.02 || v > 1.05 || abs(u) > 0.6) return vec4(0.0);
  float sunSide = sign(uSun.x - t.base.x);
  vec3 trunk = vec3(0.32, 0.22, 0.15);
  if (t.kind < 0.5){
    // conifer: tiered, ragged silhouette
    float tier = fract(v * 5.0 + t.seed);
    float w = 0.3 * (1.0 - v) * (0.72 + 0.28 * tier) + (vnoise(vec2(v * 60.0, t.seed * 50.0)) - 0.5) * 0.05;
    if (v > 0.08 && abs(u) < w){
      float side = smoothstep(-w, w, u * sunSide);
      float needles = fbm(vec2(u * 40.0, v * 60.0) + t.seed * 10.0, 4);
      vec3 col = vec3(0.07, 0.2, 0.11) * (0.55 + 0.55 * side * uDay + 0.25 * needles);
      float snowOnTier = smoothstep(0.55, 0.85, 1.0 - tier) * uSnow * step(0.0, 1.0);
      col = mix(col, vec3(0.9, 0.93, 0.98) * (0.75 + 0.3 * side), snowOnTier * 0.9);
      return vec4(col, 1.0);
    }
    if (abs(u) < 0.035 && v < 0.12) return vec4(trunk * (0.7 + 0.3 * step(0.0, u * sunSide)), 1.0);
    return vec4(0.0);
  }
  // broadleaf: lumpy canopy on a trunk with branches; bare in winter
  vec2 cc = vec2(u, v - 0.62);
  float r = 0.32 * (0.85 + 0.25 * fbm(vec2(atan(cc.y, cc.x) * 2.0, t.seed * 9.0), 3));
  float dist = length(cc * vec2(1.0, 1.15));
  if (uBare < 0.5 && dist < r){
    vec2 n = cc / r;
    float lit = clamp(dot(normalize(vec2(n.x, n.y + 0.4)), normalize(vec2(sunSide, 0.6))) * 0.6 + 0.5, 0.2, 1.1);
    float clumps = fbm(cc * 18.0 + t.seed * 20.0, 5);
    vec3 col = uFoliage * mix(1.0, lit * (0.75 + 0.5 * clumps), uDay);
    col *= 0.8 + 0.4 * smoothstep(0.4, 0.75, clumps);
    if (uBlossom > 0.5) col = mix(col, vec3(0.98, 0.78, 0.86) * (0.7 + 0.4 * lit), smoothstep(0.55, 0.7, fbm(cc * 30.0 + t.seed, 3)) * 0.85);
    col = mix(col, vec3(0.92, 0.94, 0.98), uSnow * smoothstep(0.2, 0.6, n.y) * 0.4);
    return vec4(col, 1.0);
  }
  float tw = 0.04 * (1.0 - v * 0.6);
  if (abs(u) < tw && v < 0.75) return vec4(trunk * (0.7 + 0.3 * step(0.0, u * sunSide)), 1.0);
  if (uBare > 0.5 && v > 0.3 && v < 0.95){
    float br = abs(u - sin(v * 7.0 + t.seed * 6.0) * 0.18 * (v - 0.3)) - 0.012 * (1.0 - v);
    float br2 = abs(u + sin(v * 5.0 + t.seed * 3.0) * 0.22 * (v - 0.3)) - 0.01 * (1.0 - v);
    if (min(br, br2) < 0.0) return vec4(trunk * 0.8, 1.0);
  }
  return vec4(0.0);
}

// Shadow cast by a tree onto the ground at p (1 = no shadow)
float treeShadowAt(Tree t, vec2 p, vec2 S){
  if (t.h <= 0.0) return 1.0;
  vec2 sv = S * t.h;
  float L2 = dot(sv, sv);
  if (L2 < 1e-6) return 1.0;
  vec2 d = p - t.base;
  float s = dot(d, sv) / L2;
  if (s < 0.0 || s > 1.05) return 1.0;
  float perp = length(d - sv * s) * A() / t.h;
  float w;
  if (t.kind < 0.5) w = 0.26 * (1.0 - s) + 0.02;
  else w = s < 0.45 ? 0.035 : 0.3 * sqrt(max(0.0, 1.0 - pow((s - 0.68) / 0.3, 2.0)));
  if (t.kind > 0.5 && uBare > 0.5) w *= s < 0.45 ? 1.0 : 0.25;
  return 1.0 - smoothstep(w, w * 0.6, perp) * 0.6;
}

vec4 trees(vec2 p){
  vec4 res = vec4(0.0);
  for (int row = 0; row < 3; row++){
    float dens = treeDensity(row);
    float cell = floor(p.x * dens);
    for (int k = -1; k <= 1; k++){
      vec4 c = drawTree(treeAt(row, cell + float(k)), p);
      if (c.a > 0.0) res = c;
    }
  }
  return res;
}
float groundShadow(vec2 p){
  if (uSunAlt <= 0.5) return 1.0;
  vec2 S = shadowVec();
  float sh = 1.0;
  for (int row = 0; row < 3; row++){
    float dens = treeDensity(row);
    float reach = abs(S.x) * 0.35 + 0.05;
    float c0 = floor((p.x - reach) * dens), c1 = floor((p.x + reach) * dens);
    for (int k = 0; k < 8; k++){
      float cell = c0 + float(k);
      if (cell > c1) break;
      sh = min(sh, treeShadowAt(treeAt(row, cell), p, S));
    }
  }
  return mix(1.0, sh, uDay * (1.0 - uOvercast * 0.85));
}

// ---------- Earth ----------
vec3 earth(vec2 p){
  vec3 c;
  if (p.y > uLakeTop){
    c = earthAbove(p);
  } else if (p.y > uLakeBot){
    float depthT = (uLakeTop - p.y) / (uLakeTop - uLakeBot);
    float persp = 1.0 / (depthT * 2.5 + 0.12);
    vec2 wq = vec2(p.x * A() * persp * 9.0, persp * 22.0) + vec2(uTime * 0.12, uTime * 0.5);
    float w1 = fbm(wq, 5) - 0.5, w2 = fbm(wq * 1.9 + 4.0, 5) - 0.5;
    float calm = 1.0 - uIce;
    vec2 rp = vec2(p.x + w1 * 0.018 * (0.3 + depthT) * calm, uLakeTop + (uLakeTop - p.y) * 1.15 + w2 * 0.03 * depthT * calm);
    vec3 refl = earthAbove(clamp(rp, 0.0, 0.999));
    float fres = mix(0.92, 0.42, pow(depthT, 0.7));
    vec3 deep = mix(vec3(0.05, 0.12, 0.15), vec3(0.02, 0.06, 0.09), depthT) * uLight;
    c = mix(deep, refl * 0.9, fres);
    c += uHorizon * smoothstep(0.12, 0.3, w2) * 0.06 * (1.0 - depthT) * calm;
    float gx = exp(-pow((p.x - uSun.x) * A() * (5.0 + depthT * 3.0), 2.0));
    float sparkle = pow(max(fbm(wq * 2.7 + uTime, 4) - 0.42, 0.0) * 2.4, 5.0);
    float low = smoothstep(-2.0, 1.0, uSunAlt) * (1.0 - smoothstep(12.0, 45.0, uSunAlt));
    c += uSunCol * sparkle * gx * low * 4.0 * (1.0 - uOvercast) * calm;
    c *= 1.0 - 0.35 * smoothstep(0.004, 0.0, uLakeTop - p.y);
    c *= cloudShadow(p, 1.0 / (depthT + 0.3));
    float drift = smoothstep(0.45, 0.75, fbm(vec2(p.x * A() * 4.0 * persp, persp * 6.0), 5));
    vec3 ice = mix(vec3(0.66, 0.73, 0.8), refl, 0.3) * uLight;
    ice = mix(ice, vec3(0.9, 0.92, 0.96) * uLight, drift * 0.8);
    c = mix(c, ice, uIce);
  } else {
    // Meadow: perspective grass, a path down to the water, flowers, snow; tree and cloud shadows
    float dist = 0.06 / (uLakeBot - p.y + 0.015);
    vec2 q = vec2((p.x - 0.5) * A() * dist, dist);
    vec3 g = uGrass * (0.72 + 0.5 * fbm(q * 5.0, 5));
    g *= 0.85 + 0.3 * fbm(q * 22.0, 4);
    float near = smoothstep(uLakeBot, 0.0, p.y);
    float blades = vnoise(vec2(p.x * uRes.x * 0.9, p.y * 22.0 + vnoise(vec2(p.x * 40.0, 0.0)) * 3.0));
    g *= mix(1.0, 0.86 + 0.28 * blades, near * near);
    if (uFlowers > 0.0){
      vec2 fc = floor(q * 70.0);
      float fh = hash(fc);
      if (fh > 0.985 - 0.02 * uFlowers){
        vec3 fcol = fh > 0.995 ? vec3(0.95, 0.95, 0.98) : fh > 0.99 ? vec3(0.95, 0.82, 0.25) : vec3(0.75, 0.45, 0.85);
        g = mix(g, fcol, smoothstep(0.42, 0.2, length(fract(q * 70.0) - 0.5)) * uFlowers);
      }
    }
    float pathX = 0.25 * sin(q.y * 1.1 + 1.0) + 0.6;
    float onPath = smoothstep(0.32, 0.22, abs(q.x - pathX + 0.4));
    g = mix(g, vec3(0.42, 0.34, 0.25) * (0.8 + 0.3 * fbm(q * 30.0, 3)), onPath * 0.85);
    float snowPatch = smoothstep(0.35, 0.6, fbm(q * 3.0, 4) + uSnow * 0.6 - 0.3);
    g = mix(g, vec3(0.92, 0.94, 0.98), clamp(uSnow * 1.2, 0.0, 1.0) * mix(0.75, 1.0, snowPatch));
    float sh = groundShadow(p) * cloudShadow(p, dist * 0.6);
    vec3 shadowTint = mix(vec3(1.0), uZenith * 1.6 + vec3(0.1), 0.35 * uDay);
    c = g * uLight * mix(shadowTint * 0.62, vec3(1.0), sh);
  }
  vec4 t = trees(p);
  if (t.a > 0.0) c = t.rgb * uLight * cloudShadow(p, 1.5);
  return c;
}

// ---------- Mars: butterscotch sky, blue sunsets, dunes and rocks ----------
float duneH(float x, float row){ return 0.5 + 0.5 * sin(x * (9.0 + row * 4.0) + fbm(vec2(x * 3.0, row * 7.0), 4) * 4.0); }
vec4 rockAt(vec2 p, float cell, float row, out vec2 base, out float size){
  float dens = 9.0 - row * 3.0;
  float h = hash(vec2(cell, row * 5.0 + 1.0));
  size = (0.012 + 0.03 * pow(hash(vec2(cell, row + 3.0)), 3.0)) * (1.0 + row * 1.4);
  base = vec2((cell + 0.2 + 0.6 * hash(vec2(cell, row + 7.0))) / dens, 0.04 + (2.0 - row) * 0.09 + 0.03 * hash(vec2(cell, row + 9.0)));
  if (h < 0.45) { size = 0.0; return vec4(0.0); }
  vec2 d = (p - base - vec2(0.0, size * 0.45)) * vec2(A(), 1.0) / size;
  float r = 0.55 * (0.8 + 0.3 * fbm(vec2(atan(d.y, d.x) * 2.0, cell), 3));
  if (length(d * vec2(0.8, 1.15)) < r && p.y > base.y - size * 0.05){
    vec2 n = d / r;
    float lit = clamp(dot(normalize(vec2(n.x, n.y + 0.3)), normalize(vec2(sign(uSun.x - base.x), 0.5))) * 0.7 + 0.45, 0.12, 1.15);
    vec3 col = vec3(0.36, 0.22, 0.15) * (0.7 + 0.5 * fbm(d * 6.0 + cell, 4)) * mix(0.6, lit, uDay);
    return vec4(col, 1.0);
  }
  return vec4(0.0);
}
vec3 mars(vec2 p){
  vec3 zen = mix(vec3(0.03, 0.02, 0.03), vec3(0.42, 0.31, 0.24), uDay);
  vec3 hor = mix(vec3(0.05, 0.04, 0.05), vec3(0.82, 0.62, 0.45), uDay);
  hor = mix(hor, vec3(0.35, 0.45, 0.7), uGold * 0.5);   // Martian sunsets turn blue near the sun
  vec3 c = skyBase(p, zen, hor, vec3(0.45, 0.6, 1.0) * (0.5 + uGold));
  c = sunDisc(p, c, 0.016, 2.6);
  // Phobos and Deimos at their real positions and phases
  if (uMoonVis > 0.0) c = moonDisc(p, c, uMoon, uMoonR, uElong, vec3(0.62, 0.56, 0.5));
  if (uMoon2Vis > 0.0) c = moonDisc(p, c, uMoon2, uMoon2R, uElong2, vec3(0.7, 0.64, 0.58));
  // dust devil
  float dd = exp(-pow((p.x - 0.72 - sin(uTime * 0.1) * 0.05) * A() * 18.0 / (1.0 + (p.y - uHorizonY) * 4.0), 2.0));
  float ddA = dd * smoothstep(uHorizonY + 0.35, uHorizonY, p.y) * smoothstep(uHorizonY - 0.02, uHorizonY + 0.02, p.y) * (0.5 + 0.5 * fbm(vec2(p.x * 40.0, p.y * 10.0 - uTime), 4)) * uDay;
  c = mix(c, hor * 1.05, ddA * 0.55);
  c = mountains(p, c);
  if (p.y < uHorizonY - 0.01){
    // dune rows and regolith
    float dist = 0.05 / (uHorizonY - p.y + 0.01);
    vec2 q = vec2((p.x - 0.5) * A() * dist, dist);
    // Dunes: ridged waves bent by noise; the face toward the sun is bright, the lee side dark
    float phase = q.x * 2.2 + q.y * 0.6 + fbm(q * 0.8, 4) * 3.0;
    float crest = 1.0 - abs(sin(phase));
    float lee = cos(phase) * sign(sin(phase));
    float face = lee * sign(uSunAz);   // light comes from the sun's side of the sky (east in the morning, west in the evening)
    vec3 sand = vec3(0.66, 0.38, 0.22) * (0.8 + 0.3 * fbm(q * 8.0, 5));
    sand *= mix(1.0, mix(0.6, 1.15, smoothstep(-0.3, 0.3, face)), uDay * (0.4 + 0.6 * crest));
    sand *= 0.92 + 0.08 * sin(q.x * 70.0 + q.y * 25.0 + fbm(q * 4.0, 3) * 6.0);   // wind ripples
    vec2 pc = q * 60.0, pf = fract(pc) - 0.5;
    float pebble = step(0.9, hash(floor(pc))) * smoothstep(0.32, 0.18, length(pf + (vec2(hash(floor(pc) + 3.0), hash(floor(pc) + 5.0)) - 0.5) * 0.4));
    sand = mix(sand, vec3(0.28, 0.17, 0.11) * (0.8 + 0.4 * step(0.0, pf.x * sign(uSunAz))), pebble * 0.7);
    float sh = 1.0;
    if (uSunAlt > 0.5){
      vec2 S = shadowVec();
      for (int row = 0; row < 3; row++){
        float dens = 9.0 - float(row) * 3.0;
        float reach = abs(S.x) * 0.2 + 0.05;
        float c0 = floor((p.x - reach) * dens);
        for (int k = 0; k < 6; k++){
          vec2 base; float size;
          rockAt(p, c0 + float(k), float(row), base, size);
          if (size <= 0.0) continue;
          vec2 sv = S * size * 0.9;
          float L2 = dot(sv, sv);
          if (L2 < 1e-7) continue;
          vec2 d = p - base;
          float s = dot(d, sv) / L2;
          float perp = length(d - sv * s) * A() / size;
          if (s > 0.0 && s < 1.0) sh = min(sh, 1.0 - smoothstep(0.5, 0.3, perp) * 0.65);
        }
      }
    }
    c = sand * uLight * mix(0.45, 1.0, sh);
    c = mix(c, hor * 0.9, smoothstep(0.12, 0.0, uHorizonY - p.y) * 0.5);   // dust haze
  }
  for (int row = 0; row < 3; row++){
    float dens = 9.0 - float(row) * 3.0;
    float cell = floor(p.x * dens);
    for (int k = -1; k <= 1; k++){ vec2 b; float s; vec4 r = rockAt(p, cell + float(k), float(row), b, s); if (r.a > 0.0) c = r.rgb * uLight; }
  }
  return c;
}

// ---------- Mercury: no air, black sky even by day, a huge sun, hard shadows ----------
vec3 mercury(vec2 p){
  vec3 c = vec3(0.0);
  float r = length((p - uSun) * vec2(A(), 1.0));
  if (p.y > uHorizonY){
    vec2 g = floor(p * uRes / 1.6);
    float h = hash(g);
    c += vec3(0.9, 0.92, 1.0) * step(0.996, h) * (0.4 + 0.6 * hash(g + 7.0));
    c += uSunCol * (0.35 * exp(-r * 6.0) + 0.6 * exp(-r * 18.0)) * smoothstep(-6.0, 0.0, uSunAlt);   // corona only, no blue sky
  }
  c = sunDisc(p, c, 0.055, 3.0);
  c = mountains(p, c);
  if (p.y < uHorizonY - 0.01){
    float dist = 0.05 / (uHorizonY - p.y + 0.01);
    vec2 q = vec2((p.x - 0.5) * A() * dist, dist) * 2.0;
    // crater field: bowls with raised rims; the side facing away from the sun is in black shadow
    vec2 cell = floor(q), f = fract(q);
    float hgt = fbm(q * 2.0, 5) * 0.3;
    float shade = 1.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++){
      vec2 o2 = vec2(float(x), float(y));
      vec2 ctr = o2 + vec2(hash(cell + o2), hash(cell + o2 + 9.0)) - f;
      float rad = 0.25 + 0.3 * hash(cell + o2 + 3.0);
      if (hash(cell + o2 + 5.0) < 0.35) continue;
      vec2 dd = ctr / rad;
      float t = length(dd * vec2(1.0, 2.2));
      if (t < 1.25){
        hgt += t < 1.0 ? (t * t - 1.0) * 0.4 : exp(-pow((t - 1.0) * 6.0, 2.0)) * 0.25;
        float facing = -dd.x * sign(uSunAz);
        if (t < 1.0) shade = min(shade, mix(0.03, 1.15, smoothstep(-0.2, 0.4, facing + (1.0 - t) * 0.6 - (1.0 - min(uSunAlt, 30.0) / 30.0) * 0.6)));
        else shade = min(shade, mix(0.7, 1.15, smoothstep(-0.5, 0.5, -facing)));
      }
    }
    vec3 ground = vec3(0.45, 0.43, 0.4) * (0.75 + 0.5 * fbm(q * 9.0, 5) + hgt * 0.5);
    c = ground * (shade * uLight * sunUp() + vec3(0.012, 0.013, 0.016));
  }
  return c;
}

void main(){
  vec2 p = gl_FragCoord.xy / uRes;
  vec3 c = uMode == 1 ? mars(p) : uMode == 2 ? mercury(p) : earth(p);
  o = vec4(c, 1.0);
}`;

let canvas: HTMLCanvasElement | null = null;
let gl: WebGL2RenderingContext | null = null;
let prog: WebGLProgram | null = null;
let failed = false;
const locs = new Map<string, WebGLUniformLocation | null>();

function init(): boolean {
  if (failed) return false;
  if (gl) return true;
  try {
    canvas = document.createElement("canvas");
    gl = canvas.getContext("webgl2", { antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "low-power" });
    if (!gl) throw new Error("no webgl2");
    const sh = (type: number, src: string) => {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, src); gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) throw new Error(gl!.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    return true;
  } catch (e) {
    console.warn("Surface shader unavailable, using the 2D fallback:", e);
    failed = true; gl = null;
    return false;
  }
}

type V3 = [number, number, number];
export interface SkyParams {
  mode?: 0 | 1 | 2;
  time: number; sunAlt: number; sunAz: number; day: number; gold: number; night: number; cloud: number; overcast: number; snowline: number; ice: number; stars: number;
  sun: [number, number]; moon: [number, number]; moonR: number; moonVis: number; elong: number; wind: number;
  moon2?: [number, number]; moon2R?: number; moon2Vis?: number; elong2?: number; shine?: number;
  snow: number; village: number; bare: number; blossom: number; flowers: number;
  zenith: V3; horizon: V3; light: V3; sunCol: V3; grass: V3; foliage: V3;
  horizonY: number; lakeTop: number; lakeBot: number;
}

/** Render a surface view into a shared WebGL canvas and return it (or null if WebGL2 is missing). */
export function renderSky(width: number, height: number, P: SkyParams): HTMLCanvasElement | null {
  if (!init() || !gl || !canvas || !prog) return null;
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  gl.viewport(0, 0, width, height);
  gl.useProgram(prog);
  const u = (name: string) => { if (!locs.has(name)) locs.set(name, gl!.getUniformLocation(prog!, name)); return locs.get(name)!; };
  gl.uniform2f(u("uRes"), width, height);
  gl.uniform1i(u("uMode"), P.mode ?? 0);
  const f1: [string, number][] = [["uTime", P.time], ["uSunAlt", P.sunAlt], ["uSunAz", P.sunAz], ["uDay", P.day], ["uGold", P.gold], ["uNight", P.night], ["uCloud", P.cloud], ["uOvercast", P.overcast],
    ["uSnowline", P.snowline], ["uIce", P.ice], ["uStars", P.stars], ["uMoonR", P.moonR], ["uMoonVis", P.moonVis], ["uElong", P.elong], ["uWind", P.wind],
    ["uSnow", P.snow], ["uVillage", P.village], ["uBare", P.bare], ["uBlossom", P.blossom], ["uFlowers", P.flowers],
    ["uHorizonY", P.horizonY], ["uLakeTop", P.lakeTop], ["uLakeBot", P.lakeBot]];
  for (const [k, v] of f1) gl.uniform1f(u(k), v);
  gl.uniform2f(u("uSun"), P.sun[0], P.sun[1]);
  gl.uniform2f(u("uMoon"), P.moon[0], P.moon[1]);
  gl.uniform2f(u("uMoon2"), P.moon2?.[0] ?? 0, P.moon2?.[1] ?? 0);
  gl.uniform1f(u("uMoon2R"), P.moon2R ?? 0.01);
  gl.uniform1f(u("uMoon2Vis"), P.moon2Vis ?? 0);
  gl.uniform1f(u("uElong2"), P.elong2 ?? 0);
  gl.uniform1f(u("uShine"), P.shine ?? 0);
  for (const [k, v] of [["uZenith", P.zenith], ["uHorizon", P.horizon], ["uLight", P.light], ["uSunCol", P.sunCol], ["uGrass", P.grass], ["uFoliage", P.foliage]] as [string, V3][]) gl.uniform3f(u(k), ...v);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  return canvas;
}
