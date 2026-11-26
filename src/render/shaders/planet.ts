import { BackSide, Color, ShaderMaterial, AdditiveBlending, Vector3, Vector4, type IUniform } from "three";
import type { Look } from "../../data/bodies";
import { NOISE } from "./noise";

/** Saturn's real ring structure (in planet radii): D, C, B rings, the Cassini Division, the A ring with the Encke Gap, and the F ring. */
const BICUBIC = /* glsl */ `
// Smooth B-spline magnification (4 bilinear taps), so maps don't show a texel grid when you zoom far in.
vec4 cubicW(float v){ float v2 = v * v, v3 = v2 * v; return vec4((1.0 - v) * (1.0 - v) * (1.0 - v), 4.0 - 6.0 * v2 + 3.0 * v3, 1.0 + 3.0 * v + 3.0 * v2 - 3.0 * v3, v3) / 6.0; }
vec4 textureBicubic(sampler2D s, vec2 uv){
  vec2 size = vec2(textureSize(s, 0));
  uv = uv * size - 0.5;
  vec2 f = fract(uv); uv -= f;
  vec4 xc = cubicW(f.x), yc = cubicW(f.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 sw = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 off = (c + vec4(xc.yw, yc.yw) / sw) / size.xxyy;
  vec4 s0 = textureLod(s, off.xz, 0.0), s1 = textureLod(s, off.yz, 0.0), s2 = textureLod(s, off.xw, 0.0), s3 = textureLod(s, off.yw, 0.0);
  float sx = sw.x / (sw.x + sw.y), sy = sw.z / (sw.z + sw.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
vec4 sampleMap(sampler2D s, vec2 uv, vec2 du, vec2 dv, float close){
  vec4 g = textureGrad(s, uv, du, dv);
  return close > 0.02 ? mix(g, textureBicubic(s, uv), close) : g;
}
`;

export const RINGS_GLSL = /* glsl */ `
float ringHash(float x){ return fract(sin(x * 12.9898) * 43758.5453); }
float saturnRing(float r){
  float d = 0.0;
  d += smoothstep(1.11, 1.13, r) * (1.0 - smoothstep(1.22, 1.236, r)) * 0.05;
  d += smoothstep(1.239, 1.25, r) * (1.0 - smoothstep(1.515, 1.527, r)) * (0.16 + 0.07 * sin(r * 180.0));
  d += smoothstep(1.527, 1.545, r) * (1.0 - smoothstep(1.94, 1.95, r)) * (0.82 + 0.12 * sin(r * 97.0));
  d += smoothstep(1.95, 1.96, r) * (1.0 - smoothstep(2.015, 2.025, r)) * 0.05;
  float encke = 1.0 - 0.92 * (1.0 - smoothstep(0.0, 0.0045, abs(r - 2.214)));
  d += smoothstep(2.025, 2.035, r) * (1.0 - smoothstep(2.255, 2.27, r)) * (0.58 + 0.1 * sin(r * 140.0)) * encke;
  d += exp(-pow((r - 2.325) / 0.004, 2.0)) * 0.45;
  d *= 0.82 + 0.36 * ringHash(floor(r * 1400.0));
  return clamp(d, 0.0, 1.0);
}
float faintRing(float r, float inner, float outer){
  float span = outer - inner;
  float d = 0.0;
  d += exp(-pow((r - (inner + span * 0.15)) / 0.006, 2.0)) * 0.35;
  d += exp(-pow((r - (inner + span * 0.55)) / 0.004, 2.0)) * 0.3;
  d += exp(-pow((r - outer + 0.01) / 0.008, 2.0)) * 0.5;
  return d;
}
`;

// Cheap value noise for vertex displacement.
const NOISE_LITE = /* glsl */ `
float hashLite(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float snoiseLite(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float n = mix(mix(mix(hashLite(i), hashLite(i + vec3(1,0,0)), f.x), mix(hashLite(i + vec3(0,1,0)), hashLite(i + vec3(1,1,0)), f.x), f.y),
                mix(mix(hashLite(i + vec3(0,0,1)), hashLite(i + vec3(1,0,1)), f.x), mix(hashLite(i + vec3(0,1,1)), hashLite(i + vec3(1,1,1)), f.x), f.y), f.z);
  return n * 2.0 - 1.0;
}
`;

const VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float uDisplace, uHasHeight, uSeed;
uniform sampler2D uHeight;
${NOISE_LITE}
varying vec3 vObj;
varying vec3 vRel;
varying vec3 vViewPos;
varying vec3 vNormalV;
varying vec3 vEastV;
varying vec3 vNorthV;
void main(){
  vec3 pos = position;
  if (uDisplace > 0.0){
    // Irregular small moons: push the surface in and out (real elevation for Phobos, noise otherwise).
    vec3 dir = normalize(position);
    float h;
    if (uHasHeight > 0.5){
      vec2 uv = vec2(0.5 + atan(-dir.z, dir.x) / 6.2831853, 0.5 + asin(clamp(dir.y, -1.0, 1.0)) / 3.14159265);
      h = textureLod(uHeight, uv, 0.0).r - 0.5;
    } else {
      h = snoiseLite(dir * 1.3 + uSeed) * 0.6 + snoiseLite(dir * 3.1 + uSeed) * 0.25;
    }
    pos = dir * (1.0 + h * uDisplace * 2.0);
  }
  vObj = position;
  vRel = mat3(modelMatrix) * pos;
  vec3 eastObj = normalize(vec3(position.z, 0.0, -position.x) + vec3(1e-6, 0.0, 0.0));
  vEastV = normalize(normalMatrix * eastObj);
  vNorthV = normalize(normalMatrix * cross(normalize(position), eastObj));
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vViewPos = mv.xyz;
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}
`;

const FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uColors[6];
uniform float uSeed, uTime, uCraters, uLines, uVolcanoes, uBands, uCity, uTerraform, uBump, uDetail;
uniform vec4 uStorm;
uniform vec3 uStormColor, uAtmoColor, uSunPos, uCenter, uRingNormal;
uniform float uAtmoDensity, uRadius, uRingInner, uRingOuter, uRingKind, uSunPower;
uniform sampler2D uMap, uNight, uOcean, uHeight;
uniform float uHasMap, uHasNight, uHasOcean, uHasHeight, uHeightScale, uMoonLight, uGray;
uniform vec3 uSunObj, uMoonObj, uMoonPos;
uniform vec2 uWinter;
uniform vec4 uImpacts[10];
uniform vec4 uImpactInfo[10];
uniform int uImpactCount;
uniform vec4 uOccluder;
uniform vec4 uCitySite;   // xyz: where settlement began (body frame), w: how far it has spread (radians)
uniform vec3 uOccTint;
varying vec3 vEastV;
varying vec3 vNorthV;
varying vec3 vObj;
varying vec3 vRel;
varying vec3 vViewPos;
varying vec3 vNormalV;
${NOISE}
${RINGS_GLSL}

// Shared Earth-like terrain, also used for terraformed worlds. Fills col/h/spec/land.
void earthLike(vec3 n, float oct, float sea, float green, inout vec3 col, inout float h, inout float spec, inout float land, inout float ice){
  vec3 p = n * 1.35 + uSeed;
  float e = fbm(p, oct) + 0.35 * fbm(p * 2.7 + 3.1, oct - 1.0);
  float aa = max(fwidth(e), 1e-4);
  land = smoothstep(sea - aa, sea + aa, e);
  float lt = abs(n.y);
  float depth = clamp((sea - e) / 0.25, 0.0, 1.0);
  const vec3 DEEP = vec3(0.003, 0.02, 0.089), SHALLOW = vec3(0.012, 0.114, 0.341), GREEN = vec3(0.047, 0.195, 0.042), DRY = vec3(0.376, 0.275, 0.102), SNOW = vec3(0.815, 0.855, 0.913);
  vec3 ocean = mix(SHALLOW, DEEP, smoothstep(0.0, 0.5, depth));
  float moist = fbm(n * 2.1 + uSeed + 9.0, min(oct, 6.0));
  float arid = smoothstep(0.0, 0.3, 0.2 - moist - abs(lt - 0.33) * 0.9);
  vec3 forest = mix(GREEN, GREEN * vec3(0.7, 0.85, 0.7), smoothstep(-0.2, 0.3, moist));
  vec3 lc = mix(forest, DRY, max(arid, 1.0 - green));
  lc = mix(lc, vec3(0.42, 0.4, 0.34), smoothstep(0.6, 0.74, lt + moist * 0.06));
  float alt = e - sea;
  lc = mix(lc, vec3(0.38, 0.35, 0.32), smoothstep(0.22, 0.38, alt));
  lc = mix(lc, SNOW, smoothstep(0.42, 0.5, alt + lt * 0.2));
  ice = smoothstep(0.83, 0.87, lt + 0.05 * fbm(n * 6.0, 4.0));
  col = mix(ocean, lc, land);
  col = mix(col, SNOW, ice);
  h = max(alt, 0.0) * 0.6 + land * fbm(n * 40.0 + uSeed, max(oct - 5.0, 0.0)) * 0.02;
  spec = (1.0 - land) * (1.0 - ice);
}


${BICUBIC}
// Equirectangular lookup from a body-fixed direction, choosing the u that has no seam here (Tarini's trick).
vec2 sphereUv(vec3 n, out vec2 du, out vec2 dv){
  float lon = atan(-n.z, n.x);
  float u1 = 0.5 + lon / 6.2831853;
  float u2 = fract(u1 + 0.5) - 0.5;
  float v = 0.5 + asin(clamp(n.y, -1.0, 1.0)) / 3.14159265;
  float w1 = fwidth(u1), w2 = fwidth(u2);
  float u = w1 <= w2 + 1e-6 ? u1 : u2;
  du = vec2(dFdx(u), dFdx(v)); dv = vec2(dFdy(u), dFdy(v));
  return vec2(u, v);
}

float heightAt(vec2 uv, float lod, float close){
  float a = textureLod(uHeight, uv, lod).r;
  return close > 0.02 ? mix(a, textureBicubic(uHeight, uv).r, close) : a;
}

// Horizon test: march across the height map toward the light. Hills and crater rims block low light, so dips fall into shadow.
float horizon(vec2 uv, float h0, vec3 Lobj, vec3 n, float lat, float lod){
  vec3 east = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-6, 0.0, 0.0));
  vec3 north = cross(n, east);
  vec3 Lt = vec3(dot(Lobj, east), dot(Lobj, north), dot(Lobj, n));
  if (Lt.z <= -0.03) return 0.0;
  float lenT = length(Lt.xy);
  if (lenT < 1e-4) return 1.0;
  vec2 dir = Lt.xy / lenT;
  float tanE = Lt.z / lenT;
  float cl = max(sqrt(max(1.0 - lat * lat, 0.0)), 0.05);
  float range = 40.0 * 6.2831853 / float(textureSize(uHeight, 0).x) * exp2(lod);
  float soft = uHeightScale * 0.035;
  float base = h0 * uHeightScale + uHeightScale * 0.012; // small bias stops 8-bit height steps from shadowing themselves
  float s = 1.0;
  for (int k = 1; k <= 12; k++){
    float d = range * pow(float(k) / 12.0, 1.7);
    vec2 uvk = uv + vec2(dir.x * d / (6.2831853 * cl), dir.y * d / 3.14159265);
    float hk = textureLod(uHeight, uvk, lod).r * uHeightScale;
    float ray = base + d * tanE + 0.5 * d * d;
    s = min(s, smoothstep(-soft, soft, ray - hk));
  }
  return s;
}

void main(){
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vObj);
  vec3 Ng = normalize(vNormalV);
  vec3 V = normalize(-vViewPos);
  vec3 sunV = (viewMatrix * vec4(uSunPos, 1.0)).xyz;
  vec3 L = normalize(sunV - vViewPos);
  float lat = n.y;
  float oct = lodOctaves(vObj, 4.0, 11.0) + uDetail;
  vec3 col = uColors[0];
  float h = 0.0, spec = 0.0, land = 1.0, ice = 0.0;
  vec3 emissive = vec3(0.0);
  float cityMaskLand = 1.0;

#if defined(SURF_EARTH)
  earthLike(n, oct, 0.06, 1.0, col, h, spec, land, ice);
  cityMaskLand = land * (1.0 - ice);
#elif defined(SURF_ROCK) || defined(SURF_MARS)
  vec3 p = n * 2.0 + uSeed;
  float base = fbm(p, oct);
  float cr = 0.0;
  float cOct = oct;
  if (uCraters > 0.0){
    cr += craterField(n * 5.0 + uSeed, uCraters * 0.55) * 0.5;
    if (cOct > 4.0) cr += craterField(n * 16.0 + uSeed * 1.7, uCraters * 0.6) * 0.22 * clamp(cOct - 4.0, 0.0, 1.0);
    if (cOct > 6.0) cr += craterField(n * 52.0 + uSeed * 2.3, uCraters * 0.7) * 0.09 * clamp(cOct - 6.0, 0.0, 1.0);
    if (cOct > 8.0) cr += craterField(n * 170.0 + uSeed * 3.1, uCraters * 0.8) * 0.035 * clamp(cOct - 8.0, 0.0, 1.0);
  }
  #if defined(SURF_MARS)
    float dark = smoothstep(-0.05, 0.3, fbm(n * 1.1 + uSeed + 3.0, 5.0));
    col = mix(uColors[0], uColors[1], dark * 0.75);
    col = mix(col, uColors[2], smoothstep(0.15, 0.45, base) * 0.6);
    float cap = smoothstep(0.86, 0.9, abs(lat) + 0.04 * fbm(n * 5.0, 4.0));
    col = mix(col, uColors[3], cap);
    h = base * 0.5 + cr;
    // Valles Marineris-style canyon band
    float canyon = 1.0 - smoothstep(0.0, 0.025, abs(lat + 0.12 + 0.05 * snoise(n * 2.0 + uSeed)));
    canyon *= smoothstep(0.4, 0.9, n.x);
    h -= canyon * 0.25; col = mix(col, uColors[1] * 0.8, canyon * 0.5);
  #else
    float maria = smoothstep(-0.05, 0.25, fbm(n * 1.3 + uSeed + 5.0, 4.0));
    col = mix(uColors[0], uColors[1], maria * 0.8);
    col = mix(col, uColors[2], clamp(cr * 1.2, 0.0, 1.0) * 0.6);
    col *= 0.9 + 0.2 * base;
    h = base * 0.25 + cr;
    if (uLines > 0.0){
      float l1 = 1.0 - smoothstep(0.0, 0.035, abs(snoise(n * 3.0 + uSeed)));
      float l2 = 1.0 - smoothstep(0.0, 0.025, abs(snoise(n * 7.0 + uSeed * 2.0)));
      float l3 = 1.0 - smoothstep(0.0, 0.02, abs(snoise(n * 19.0 + uSeed * 3.0)));
      float lines = max(l1, max(l2 * 0.8, l3 * 0.5 * clamp(oct - 5.0, 0.0, 1.0))) * uLines;
      col = mix(col, uColors[1], lines * 0.8);
      h -= lines * 0.05;
    }
    if (uVolcanoes > 0.0){
      float v = pow(max(snoise(n * 4.5 + uSeed), 0.0), 5.0) * 6.0 * uVolcanoes;
      col = mix(col, vec3(0.08, 0.05, 0.03), clamp(v, 0.0, 1.0));
      col = mix(col, vec3(0.75, 0.25, 0.08), clamp(v - 0.7, 0.0, 1.0) * 0.8);
      // Active lava lakes: small hot spots (Io has ~400 active volcanoes, but each glows over a tiny area).
      float hot = pow(max(snoise(n * 22.0 + uSeed * 3.0), 0.0), 9.0) * smoothstep(0.5, 1.0, v + 0.5);
      emissive += vec3(1.8, 0.4, 0.06) * clamp(hot * 40.0, 0.0, 1.0) * uVolcanoes * 0.8;
    }
  #endif
  if (uTerraform > 0.0){
    vec3 tc = col; float th = h, ts = 0.0, tl = 1.0, ti = 0.0;
    earthLike(n, oct, -0.35 + uTerraform * 0.38, smoothstep(0.4, 1.0, uTerraform), tc, th, ts, tl, ti);
    float k = smoothstep(0.0, 0.35, uTerraform);
    col = mix(col, tc, k); h = mix(h, th, k); spec = ts * k; land = mix(1.0, tl, k);
    cityMaskLand = land;
  }
#elif defined(SURF_VENUS)
  float t = uTime * 0.012;
  float sw = fbm(vec3(n.x * 1.4 + t, n.y * 5.0, n.z * 1.4 - t), min(oct, 7.0));
  float bands = sin(lat * 9.0 + sw * 4.0 + n.x * 2.0);
  col = mix(uColors[0], uColors[1], 0.5 + 0.5 * bands);
  col = mix(col, uColors[2], smoothstep(0.15, 0.55, fbm(n * 3.5 + sw * 1.5, min(oct, 7.0))) * 0.6);
  col = mix(col, uColors[3], smoothstep(0.75, 1.0, abs(lat)) * 0.5);
  h = sw * 0.03;
  if (uTerraform > 0.0){
    vec3 tc = col; float th = 0.0, ts = 0.0, tl = 1.0, ti = 0.0;
    earthLike(n, oct, -0.3 + uTerraform * 0.34, smoothstep(0.5, 1.0, uTerraform), tc, th, ts, tl, ti);
    float clear = smoothstep(0.2, 0.9, uTerraform) * smoothstep(-0.1, 0.4, -fbm(n * 2.0 + vec3(t), 5.0) + uTerraform * 0.6);
    col = mix(col, tc, clear); h = mix(h, th, clear); spec = ts * clear; land = mix(1.0, tl, clear);
    cityMaskLand = land * clear;
  }
#elif defined(SURF_GAS) || defined(SURF_ICE) || defined(SURF_HAZE)
  float t = uTime;
  float speed = sin(lat * uBands * 1.3) * 0.03 + 0.01;
  float ang = t * speed;
  vec3 q = vec3(cos(ang) * n.x - sin(ang) * n.z, n.y, sin(ang) * n.x + cos(ang) * n.z);
  #if defined(SURF_HAZE)
    float turb = fbm(q * vec3(1.5, 4.0, 1.5) + uSeed, min(oct, 5.0));
    col = mix(uColors[0], uColors[1], 0.5 + 0.5 * sin(lat * 5.0 + turb * 2.0));
    col = mix(col, uColors[2], smoothstep(0.3, 1.0, lat) * 0.6);
    h = 0.0;
  #else
    float turb = fbm(q * vec3(2.0, 8.0, 2.0) + uSeed, oct);
    float warp = fbm(q * 5.0 + vec3(turb * 2.0), oct - 1.0);
    #if defined(SURF_ICE)
      float y = lat + turb * 0.015 + warp * 0.008;
      float b = y * uBands;
      float f = fract(b);
      int i0 = int(mod(floor(b), 3.0));
      int i1 = int(mod(floor(b) + 1.0, 3.0));
      col = mix(uColors[i0], uColors[i1], smoothstep(0.2, 0.8, f));
      col = mix(col, uColors[0], 0.55);
      float streak = smoothstep(0.55, 0.75, fbm(q * vec3(3.0, 16.0, 3.0) + uSeed + 7.0, oct)) * step(0.5, uStorm.w + 0.5);
      col = mix(col, vec3(0.92, 0.95, 1.0), streak * 0.7 * (uStorm.w > 0.0 ? 1.0 : 0.25));
    #else
      float y = lat + turb * 0.03 + warp * 0.018;
      float b = y * uBands;
      float f = fract(b);
      int i0 = int(mod(floor(b), 6.0));
      int i1 = int(mod(floor(b) + 1.0, 6.0));
      col = mix(uColors[i0], uColors[i1], smoothstep(0.25, 0.75, f + warp * 0.2));
      col *= 0.92 + 0.16 * turb;
      col = mix(col, col * vec3(0.78, 0.8, 0.86), smoothstep(0.62, 0.95, abs(lat)));
    #endif
    if (uStorm.w > 0.0 && uHasMap < 0.5){
      float lon = atan(q.z, q.x);
      float dl = mod(lon - uStorm.y + 3.14159265, 6.2831853) - 3.14159265;
      vec2 d = vec2(dl * sqrt(max(1.0 - lat * lat, 0.05)) / (uStorm.z * 1.7), (lat - uStorm.x) / (uStorm.z * 0.85));
      float r = length(d);
      float swirl = snoise(vec3(d * 3.0, uSeed) + vec3(r * 4.0 - t * 0.2));
      float spot = 1.0 - smoothstep(0.55, 1.0, r + swirl * 0.08);
      col = mix(col, uStormColor, spot * 0.85);
      col = mix(col, uColors[0], (1.0 - smoothstep(0.9, 1.15, r)) * smoothstep(0.75, 0.95, r) * 0.6);
    }
    h = turb * 0.04;
  #endif
#endif

  // Real surface maps take over the color; procedural noise only adds fine detail when you zoom past the map's resolution.
  if (uHasMap > 0.5){
    vec2 du, dv;
    vec2 uv = sphereUv(n, du, dv);
    #if defined(SURF_GAS) || defined(SURF_ICE)
      uv.x += 0.0025 * sin(lat * 38.0 + uTime * 0.15) * (1.0 - abs(lat));
    #elif defined(SURF_VENUS)
      uv.x = fract(uv.x + uTime * 0.0025);
    #endif
    float texel = 6.2831853 / float(textureSize(uMap, 0).x);
    float px = length(fwidth(vObj));
    float close = smoothstep(0.6, 3.0, texel / max(px, 1e-9));
    vec3 mapCol = sampleMap(uMap, uv, du, dv, close).rgb;
    // Fine detail gets its own level-of-detail cutoff so it never adds noise smaller than a pixel.
    float fineOct = clamp(log2(0.5 / max(px * 900.0, 1e-7)), 0.0, 4.0);
    float fine = fineOct > 0.0 ? fbm(n * 900.0 + uSeed, fineOct) : 0.0;
    #if defined(SURF_EARTH)
      float water = uHasOcean > 0.5 ? sampleMap(uOcean, uv, du, dv, close).r : 0.0;
      float bright = dot(mapCol, vec3(0.33));
      ice = smoothstep(0.55, 0.75, bright) * (1.0 - water);
      land = 1.0 - water;
      spec = water;
      col = mapCol * (1.0 + fine * 0.35 * close * land);
      h = land * (1.0 - ice) * (fine * 0.02 * close + (bright - 0.15) * 0.01 * (1.0 - close));
      // Ocean waves: drifting swell plus chop, only as fine as the pixels allow. They break the sun's glint into glitter.
      float waveOct = clamp(log2(0.5 / max(px * 1800.0, 1e-7)), 0.0, 4.0);
      if (waveOct > 0.0){
        vec3 wp = n * 1800.0 + vec3(uTime * 0.6, 0.0, uTime * 0.35);
        float swell = fbm(wp, waveOct);
        float chop = fbm(wp * 3.1 - vec3(uTime * 0.9), max(waveOct - 1.0, 0.0));
        h += water * (1.0 - ice) * (swell * 0.0016 + chop * 0.0006) * smoothstep(0.0, 1.0, waveOct);
      }
      cityMaskLand = land;
    #elif defined(SURF_GAS) || defined(SURF_ICE)
      col = mapCol * (1.0 + fine * 0.08 * close);
      h = (dot(mapCol, vec3(0.33)) - 0.4) * 0.03 * (1.0 - close);
    #elif defined(SURF_VENUS)
      if (uTerraform <= 0.0) { col = mapCol; h = dot(mapCol, vec3(0.33)) * 0.02; }
      else col = mix(mapCol, col, smoothstep(0.2, 0.9, uTerraform));
    #else
      // Grayscale mosaics: tint to the world's real colors. Black no-data areas fall back to the procedural surface.
      float rawLum = dot(mapCol, vec3(0.333));
      if (uGray > 0.5) mapCol = mix(uColors[1] * 0.5, uColors[2] * 1.08, smoothstep(0.0, 0.9, sqrt(rawLum))) * (0.75 + 0.35 * sqrt(rawLum));
      mapCol = mix(mapCol, col, 1.0 - smoothstep(0.004, 0.02, rawLum));
      #if defined(SURF_HAZE)
        mapCol = mix(col, col * (0.55 + 0.9 * sqrt(rawLum)), 0.45);
      #endif
      float k = uTerraform > 0.0 ? smoothstep(0.0, 0.35, uTerraform) : 0.0;
      vec3 rocky = mapCol * (1.0 + (fine * 0.22 + h * 0.12) * close * close);
      col = mix(rocky, col, k);
      h = mix(h * close * close * 0.3 + (dot(mapCol, vec3(0.33)) - 0.25) * 0.04 * (1.0 - close), h, k);
    #endif
  }

  // ---- Relief from real elevation maps: per-pixel normals plus self-shadowing ----
  vec3 N = Ng;
  float shadow = 1.0;
  float H0 = 0.0, hLod = 0.0;
  vec2 hUv = vec2(0.0);
  bool doShadow = false;
  if (uHasHeight > 0.5){
    vec2 du, dv;
    hUv = sphereUv(n, du, dv);
    vec2 hs = vec2(textureSize(uHeight, 0));
    float tpp = length(fwidth(vObj)) / (6.2831853 / hs.x);   // height-map texels per screen pixel
    hLod = log2(max(tpp, 1.0));
    float closeH = smoothstep(0.6, 3.0, 1.0 / max(tpp, 1e-6));
    vec2 e = max(tpp, 1.0) / hs;
    H0 = heightAt(hUv, hLod, closeH);
    float hL = heightAt(hUv - vec2(e.x, 0.0), hLod, closeH), hR = heightAt(hUv + vec2(e.x, 0.0), hLod, closeH);
    float hD = heightAt(hUv - vec2(0.0, e.y), hLod, closeH), hU = heightAt(hUv + vec2(0.0, e.y), hLod, closeH);
    float cl = max(sqrt(max(1.0 - lat * lat, 0.0)), 0.05);
    float se = (hR - hL) * uHeightScale / (2.0 * e.x * 6.2831853 * cl);
    float sn = (hU - hD) * uHeightScale / (2.0 * e.y * 3.14159265);
    float relief = 1.0;
    #if defined(SURF_EARTH)
      relief = land;
    #endif
    N = normalize(Ng - (normalize(vEastV) * se + normalize(vNorthV) * sn) * relief);
    h *= closeH;
    doShadow = 1.0 / max(tpp, 1e-6) > 0.2;
    if (doShadow) shadow = mix(1.0, horizon(hUv, H0, uSunObj, n, lat, hLod), smoothstep(0.2, 0.6, 1.0 / max(tpp, 1e-6)) * relief);
  }
  // ---- Impact craters: bowl, raised rim, ejecta, soot and burn rays, glowing melt. They fade with age. ----
  vec3 craterGlow = vec3(0.0);
  float lightsOut = 0.0;   // impact zones go dark until they are rebuilt
  for (int i = 0; i < 10; i++){
    if (i >= uImpactCount) break;
    vec4 C = uImpacts[i];
    vec4 I = uImpactInfo[i];         // x: scar strength, y: burn marks, z: molten glow, w: 1 = gas giant
    float ang = acos(clamp(dot(n, C.xyz), -1.0, 1.0));
    float t = ang / C.w;
    if (t > 4.5) continue;
    vec3 tang = normalize(n - C.xyz * dot(n, C.xyz) + 1e-6);
    float tt = t + snoise(n * (3.0 / C.w) + float(i) * 7.1) * 0.1;
    if (I.w > 0.5){
      // Gas giants have no surface: a dark bruise in the clouds, with a faint ring, that winds smear out.
      float spot = (1.0 - smoothstep(0.5, 1.5, tt)) * I.x;
      col = mix(col, vec3(0.06, 0.04, 0.035), spot * 0.85);
      col = mix(col, col * 0.75, smoothstep(1.7, 1.9, tt) * (1.0 - smoothstep(1.9, 2.4, tt)) * I.x * 0.6);
      craterGlow += vec3(1.6, 0.6, 0.2) * I.z * (1.0 - smoothstep(0.0, 1.2, tt));
      continue;
    }
    lightsOut = max(lightsOut, (1.0 - smoothstep(1.6, 3.2, tt)) * I.y);
    float bowl = tt < 1.0 ? (tt * tt - 1.0) : 0.0;
    float rim = exp(-pow((tt - 1.0) * 4.0, 2.0)) * 0.4;
    float ejecta = tt > 1.0 ? exp(-(tt - 1.0) * 1.7) * 0.08 : 0.0;
    h += (bowl * 0.45 + rim + ejecta) * C.w * 0.35 * I.x;
    float rays = smoothstep(0.45, 0.85, snoise(tang * 9.0 + float(i) * 3.3) * 0.5 + 0.5) * (tt > 1.0 ? exp(-(tt - 1.0) * 0.9) : 1.0);
    float soot = (1.0 - smoothstep(0.7, 2.6, tt)) * I.y;
    vec3 burnt = mix(vec3(0.035, 0.026, 0.022), vec3(0.2, 0.16, 0.13), smoothstep(0.0, 2.5, tt));
    col = mix(col, burnt, clamp(soot * 0.9 + rays * I.y * 0.45, 0.0, 1.0));
    col = mix(col, col * vec3(0.8, 0.78, 0.76), (1.0 - smoothstep(0.0, 1.1, tt)) * I.x * 0.5);
    spec *= 1.0 - (1.0 - smoothstep(0.8, 2.0, tt)) * I.x;
    float melt = (1.0 - smoothstep(0.0, 0.95, tt)) * (0.7 + 0.3 * snoise(n * (6.0 / C.w) + float(i)));
    craterGlow += mix(vec3(1.9, 0.5, 0.1), vec3(2.4, 1.4, 0.5), melt * I.z) * melt * I.z;
  }

  if (uBump > 0.0) N = bumpNormal(vViewPos, N, h * uBump * uRadius);

  float rough = mix(0.9, 0.2, spec);
#if defined(SURF_GAS) || defined(SURF_ICE) || defined(SURF_HAZE) || defined(SURF_VENUS)
  rough = 1.0;
#endif

#if defined(SURF_EARTH)
  // Seasonal snow: in each hemisphere's winter the snow line creeps toward the equator, further on high ground.
  {
    float latDeg = abs(asin(clamp(n.y, -1.0, 1.0))) * 57.29578;
    float w = n.y > 0.0 ? uWinter.x : uWinter.y;
    float wob = fbm(n * 7.0 + uSeed, 4.0) * 7.0;
    float line = mix(70.0, 43.0, w) - H0 * 35.0 + wob;
    float snow = smoothstep(line - 3.0, line + 5.0, latDeg) * land;
    snow = max(snow, smoothstep(0.5, 0.78, H0 + wob * 0.01) * land * (0.6 + 0.4 * w));
    float iceLine = mix(81.0, 66.0, w);
    float seaIce = smoothstep(iceLine - 2.0, iceLine + 4.0, latDeg + wob * 0.6) * (1.0 - land);
    float cover = clamp(max(snow * 0.92, seaIce), 0.0, 1.0);
    float trees = smoothstep(0.12, 0.03, dot(col, vec3(0.33)));
    col = mix(col, vec3(0.80, 0.84, 0.9), cover * (1.0 - 0.35 * trees));
    rough = mix(rough, 0.6, cover);
    spec *= 1.0 - seaIce;
    ice = max(ice, cover);
  }
#endif

  // ---- Physically based lighting (GGX microfacets, Schlick Fresnel, energy-conserving diffuse) ----
  float ndlGeo = dot(Ng, L);
  float term = smoothstep(-0.1, 0.25, ndlGeo);   // soft day/night boundary
  float NdL = max(dot(N, L), 0.0);
  float NdV = max(dot(N, V), 1e-3);
  vec3 Hh = normalize(L + V);
  float NdH = max(dot(N, Hh), 0.0), VdH = max(dot(V, Hh), 0.0);
  float a2 = pow(rough, 4.0);
  float dd = NdH * NdH * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159265 * dd * dd);
  float kk = (rough + 1.0) * (rough + 1.0) / 8.0;
  float G = (NdL / (NdL * (1.0 - kk) + kk)) * (NdV / (NdV * (1.0 - kk) + kk));
  vec3 F0 = vec3(mix(0.04, 0.02, spec));
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - VdH, 5.0);
  vec3 specBRDF = D * G * F / max(4.0 * NdL * NdV, 1e-4);
  vec3 sunCol = vec3(1.0, 0.97, 0.92) * 1.15 * uSunPower;
  // Eclipse: the Moon's shadow on Earth, or Earth's red-tinged shadow on the Moon.
  float eclipse = 1.0;
  vec3 eclipseTint = vec3(1.0);
  if (uOccluder.w > 0.0){
    vec3 P = uCenter + vRel;
    vec3 Ld = normalize(uSunPos - P);
    vec3 oc = uOccluder.xyz - P;
    float tca = dot(oc, Ld);
    if (tca > 0.0){
      float d = length(oc - Ld * tca);
      eclipse = smoothstep(uOccluder.w * 0.35, uOccluder.w * 1.15, d);
      eclipseTint = mix(uOccTint, vec3(1.0), eclipse);
    }
  }
  vec3 lit = (col * (1.0 - F) * NdL + specBRDF * NdL * 3.14159265) * sunCol * term * shadow * mix(eclipseTint * 0.35, vec3(1.0), eclipse);
  lit += col * 0.006;
  vec3 Fv = F0 + (1.0 - F0) * pow(1.0 - NdV, 5.0);
  lit += spec * Fv * uAtmoColor * 0.3 * term;

  // Moonlight on the night side, with the Moon's own phase and terrain shadows.
  if (uMoonLight > 0.001){
    vec3 moonV = (viewMatrix * vec4(uMoonPos, 1.0)).xyz;
    vec3 Lm = normalize(moonV - vViewPos);
    float nm = max(dot(N, Lm), 0.0) * smoothstep(-0.05, 0.1, dot(Ng, Lm));
    float msh = (nm > 0.0 && doShadow) ? horizon(hUv, H0, uMoonObj, n, lat, hLod) : 1.0;
    lit += col * nm * msh * uMoonLight * 0.06 * vec3(0.8, 0.88, 1.0) * (1.0 - term);
  }

  if (uCity > 0.0 && uHasNight > 0.5){
    vec2 du, dv;
    vec2 uv = sphereUv(n, du, dv);
    vec3 nightCol = textureGrad(uNight, uv, du, dv).rgb;
    // Lights spread over time: in the 1950s only the biggest cities glow; by the 2000s the map fills in.
    float lum = dot(nightCol, vec3(0.33));
    float thr = (1.0 - uCity) * 0.35;
    emissive += nightCol * vec3(1.15, 0.95, 0.75) * 3.2 * smoothstep(thr, thr + 0.12, lum) * (0.35 + 0.65 * uCity) * (1.0 - lightsOut);
  } else if (uCity > 0.0){
    float c1 = smoothstep(0.35, 0.85, snoise(n * 18.0 + uSeed) * 0.5 + 0.5);
    float c2 = smoothstep(0.45, 0.9, snoise(n * 70.0 + uSeed * 1.3) * 0.5 + 0.5);
    float c3 = smoothstep(0.6, 0.95, snoise(n * 260.0 + uSeed * 1.7) * 0.5 + 0.5);
    float cities = c1 * (0.35 + 0.65 * c2) * (0.5 + 0.5 * c3) * cityMaskLand * smoothstep(0.0, 0.6, uCity * 1.4 - (1.0 - c1));
    // Settlements spread outward from where they were founded
    float spread = 1.0;
    if (uCitySite.w > 0.0){
      float ang = acos(clamp(dot(n, uCitySite.xyz), -1.0, 1.0));
      spread = 1.0 - smoothstep(uCitySite.w * 0.6, uCitySite.w, ang + snoise(n * 9.0 + uSeed) * uCitySite.w * 0.25);
      // the founding base itself always glows
      cities = max(cities, (1.0 - smoothstep(0.0, 0.035, ang)) * 0.9);
    }
    emissive += vec3(1.0, 0.66, 0.32) * cities * spread * 2.4 * max(uCity, 0.4) * (1.0 - lightsOut);
  }
  lit += emissive * (1.0 - smoothstep(-0.15, 0.1, ndlGeo));

  // Atmosphere seen from outside: a bright, blue-tinted limb on the day side
  float fres = pow(1.0 - max(dot(Ng, V), 0.0), 2.5);
  lit = mix(lit, uAtmoColor * (0.25 + term), clamp(fres * uAtmoDensity * smoothstep(-0.3, 0.3, ndlGeo) * 0.85, 0.0, 1.0));
  lit += uAtmoColor * uAtmoDensity * 0.05 * term;

  lit += craterGlow;

  // Shadow cast by the rings
  if (uRingKind > 0.5){
    vec3 Lw = normalize(uSunPos - uCenter);
    float den = dot(Lw, uRingNormal);
    if (abs(den) > 1e-4){
      float tt = -dot(vRel, uRingNormal) / den;
      if (tt > 0.0){
        float r = length(vRel + Lw * tt) / uRadius;
        float dens = uRingKind > 1.5 ? saturnRing(r) : faintRing(r, uRingInner, uRingOuter);
        lit *= 1.0 - dens * 0.85;
      }
    }
  }
  gl_FragColor = vec4(lit, 1.0);
}
`;

const SURF_DEFINE: Record<Look["surface"], string> = {
  rock: "SURF_ROCK", earth: "SURF_EARTH", mars: "SURF_MARS", venus: "SURF_VENUS", gas: "SURF_GAS", ice: "SURF_ICE", haze: "SURF_HAZE",
};

export type PlanetUniforms = Record<string, IUniform>;

export function planetMaterial(look: Look, radius: number) {
  const colors = Array.from({ length: 6 }, (_, i) => new Color(look.colors[i % look.colors.length]));
  const storm = look.storm;
  const uniforms: PlanetUniforms = {
    uColors: { value: colors },
    uSeed: { value: look.seed },
    uTime: { value: 0 },
    uCraters: { value: look.craters ?? 0 },
    uLines: { value: look.lines ?? 0 },
    uVolcanoes: { value: look.volcanoes ?? 0 },
    uBands: { value: look.bands ?? 8 },
    uStorm: { value: storm ? [Math.sin((storm.lat * Math.PI) / 180), storm.lon, storm.size, 1] : [0, 0, 0, look.surface === "ice" && look.seed > 9 ? 0.0 : -1] },
    uStormColor: { value: new Color(storm?.color ?? "#000000") },
    uAtmoColor: { value: new Color(look.atmosphere?.color ?? "#000000") },
    uAtmoDensity: { value: look.atmosphere?.density ?? 0 },
    uCity: { value: 0 },
    uTerraform: { value: 0 },
    uBump: { value: look.surface === "gas" || look.surface === "ice" || look.surface === "haze" ? 0.4 : look.surface === "venus" ? 0.3 : 1.6 },
    uDetail: { value: 0 },
    uSunPos: { value: new Vector3() },
    uSunPower: { value: 1 },
    uCenter: { value: new Vector3() },
    uRadius: { value: radius },
    uRingNormal: { value: new Vector3(0, 1, 0) },
    uRingInner: { value: 0 },
    uRingOuter: { value: 0 },
    uRingKind: { value: 0 },
    uMap: { value: null }, uNight: { value: null }, uOcean: { value: null },
    uHasMap: { value: 0 }, uHasNight: { value: 0 }, uHasOcean: { value: 0 },
    uHeight: { value: null }, uHasHeight: { value: 0 }, uHeightScale: { value: 0.006 }, uGray: { value: 0 }, uDisplace: { value: 0 },
    uSunObj: { value: new Vector3(1, 0, 0) }, uMoonObj: { value: new Vector3(1, 0, 0) }, uMoonPos: { value: new Vector3() },
    uMoonLight: { value: 0 }, uWinter: { value: [0.5, 0.5] },
    uImpacts: { value: Array.from({ length: 10 }, () => new Vector4()) }, uImpactInfo: { value: Array.from({ length: 10 }, () => new Vector4()) }, uImpactCount: { value: 0 },
    uOccluder: { value: new Vector4(0, 0, 0, 0) }, uOccTint: { value: new Color("#ff6a3c") }, uCitySite: { value: new Vector4() },
  };
  if (look.surface === "ice") {
    // Neptune gets bright streak clouds; Uranus stays nearly featureless.
    uniforms.uStorm.value = storm ? [Math.sin((storm.lat * Math.PI) / 180), storm.lon, storm.size, 1] : [0, 0, 0, 0];
  }
  return new ShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: FRAG,
    defines: { [SURF_DEFINE[look.surface]]: "" },
    extensions: { clipCullDistance: false, multiDraw: false },
  });
}

// ---------- Cloud layer (Earth and terraformed worlds) ----------

const CLOUD_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform float uTime, uSeed, uCover, uSunPower, uHasMap;
uniform vec3 uSunPos;
uniform sampler2D uMap;
varying vec3 vObj;
varying vec3 vRel;
varying vec3 vViewPos;
varying vec3 vNormalV;
${NOISE}
${BICUBIC}
void main(){
  #include <logdepthbuf_fragment>
  vec3 n = normalize(vObj);
  float oct = lodOctaves(vObj, 3.0, 10.0);
  float t = uTime * 0.006;
  vec3 q = n * 2.0 + vec3(t, 0.0, -t * 0.6) + uSeed;
  float w = fbm(q * 0.8, 4.0);
  float c = fbm(q + vec3(w * 1.6), oct) + 0.15 * (1.0 - abs(n.y)) * sin(n.y * 18.0 + w * 3.0);
  float a = smoothstep(0.14 - uCover, 0.48 - uCover, c) * 0.88;
  if (uHasMap > 0.5){
    // Real cloud cover, drifting slowly, with procedural wisps added when you're close.
    float lon = atan(-n.z, n.x);
    float u1 = 0.5 + lon / 6.2831853 + uTime * 0.0004;
    float u2 = fract(u1 + 0.5) - 0.5;
    float u = fwidth(fract(u1)) <= fwidth(u2) + 1e-6 ? fract(u1) : u2;
    vec2 uv = vec2(u, 0.5 + asin(clamp(n.y, -1.0, 1.0)) / 3.14159265);
    float px = length(fwidth(vObj));
    float close = smoothstep(0.6, 3.0, (6.2831853 / 4096.0) / max(px, 1e-9));
    float m = sampleMap(uMap, uv, vec2(dFdx(uv.x), dFdx(uv.y)), vec2(dFdy(uv.x), dFdy(uv.y)), close).r;
    a = clamp(pow(m, 1.25) * (1.0 + (c - 0.1) * 0.8 * close), 0.0, 1.0) * 0.95;
  }
  vec3 V = normalize(-vViewPos);
  vec3 Ng = normalize(vNormalV);
  vec3 sunV = (viewMatrix * vec4(uSunPos, 1.0)).xyz;
  vec3 L = normalize(sunV - vViewPos);
  float ndl = dot(Ng, L);
  float lit = smoothstep(-0.08, 0.3, ndl) * uSunPower;
  vec3 col = mix(vec3(1.0, 0.72, 0.5), vec3(1.0), smoothstep(0.0, 0.35, ndl)) * (lit * 1.05 + 0.015);
  float edge = pow(1.0 - max(dot(Ng, V), 0.0), 3.0);
  gl_FragColor = vec4(col, a * (0.92 - edge * 0.5));
}
`;

export function cloudMaterial(seed: number) {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSeed: { value: seed + 3.7 }, uCover: { value: 0 }, uSunPos: { value: new Vector3() }, uSunPower: { value: 1 }, uMap: { value: null }, uHasMap: { value: 0 } },
    vertexShader: VERT,
    fragmentShader: CLOUD_FRAG,
    transparent: true,
    depthWrite: false,
  });
}

// ---------- Atmosphere halo ----------

const ATMO_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vWorld;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;
const ATMO_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCenter, uColor, uSunPos;
uniform float uRadius, uOuter, uDensity, uSunPower;
varying vec3 vWorld;
void main(){
  #include <logdepthbuf_fragment>
  vec3 ro = cameraPosition;
  vec3 rd = normalize(vWorld - ro);
  float t = max(dot(uCenter - ro, rd), 0.0);
  vec3 cp = ro + rd * t;
  float d = length(cp - uCenter);
  float x = clamp((uOuter - d) / (uOuter - uRadius), 0.0, 1.0);
  float glow = pow(x, 2.4);
  vec3 Lw = normalize(uSunPos - uCenter);
  float s = dot(normalize(cp - uCenter), Lw);
  float day = smoothstep(-0.35, 0.35, s);
  vec3 sunset = vec3(1.0, 0.45, 0.2);
  vec3 col = mix(sunset, uColor, smoothstep(-0.1, 0.4, s));
  gl_FragColor = vec4(col * glow * day * uDensity * 1.3 * uSunPower, 1.0);
}
`;

export function atmosphereMaterial(color: string, density: number) {
  return new ShaderMaterial({
    uniforms: {
      uCenter: { value: new Vector3() }, uColor: { value: new Color(color) }, uSunPos: { value: new Vector3() },
      uRadius: { value: 1 }, uOuter: { value: 1.05 }, uDensity: { value: density }, uSunPower: { value: 1 },
    },
    vertexShader: ATMO_VERT,
    fragmentShader: ATMO_FRAG,
    side: BackSide,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

// ---------- Rings ----------

const RING_VERT = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vLocal;
varying vec3 vWorld;
void main(){
  vLocal = position;
  vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;
const RING_FRAG = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 uCenter, uSunPos, uNormal;
uniform float uRadius, uKind, uInner, uOuter, uSunPower;
varying vec3 vLocal;
varying vec3 vWorld;
${RINGS_GLSL}
void main(){
  #include <logdepthbuf_fragment>
  float r = length(vLocal.xy);
  float dens = uKind > 1.5 ? saturnRing(r) : faintRing(r, uInner, uOuter);
  if (dens < 0.004) discard;
  vec3 col = uKind > 1.5
    ? mix(vec3(0.55, 0.52, 0.48), mix(vec3(0.86, 0.78, 0.62), vec3(0.74, 0.7, 0.62), smoothstep(1.95, 2.05, r)), smoothstep(1.45, 1.6, r))
    : vec3(0.45, 0.47, 0.5);
  vec3 Lw = normalize(uSunPos - uCenter);
  vec3 rel = vWorld - uCenter;
  // Planet shadow on the rings
  float b = dot(rel, Lw), c = dot(rel, rel) - uRadius * uRadius, disc = b * b - c;
  float shadow = (disc > 0.0 && -b + sqrt(disc) > 0.0 && b < 0.0) ? 0.06 : 1.0;
  float sunSide = sign(dot(Lw, uNormal));
  float camSide = sign(dot(cameraPosition - uCenter, uNormal));
  float lit = sunSide == camSide ? 0.35 + 0.75 * abs(dot(Lw, uNormal)) : (1.0 - dens) * 0.9 + 0.08;
  gl_FragColor = vec4(col * lit * shadow * uSunPower, dens * (uKind > 1.5 ? 0.95 : 0.6));
}
`;

export function ringMaterial(kind: "saturn" | "faint", inner: number, outer: number) {
  return new ShaderMaterial({
    uniforms: {
      uCenter: { value: new Vector3() }, uSunPos: { value: new Vector3() }, uNormal: { value: new Vector3(0, 1, 0) },
      uRadius: { value: 1 }, uKind: { value: kind === "saturn" ? 2 : 1 }, uInner: { value: inner }, uOuter: { value: outer }, uSunPower: { value: 1 },
    },
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
    side: 2,
  });
}
