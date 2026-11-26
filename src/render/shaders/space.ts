import { AdditiveBlending, Color, ShaderMaterial, Vector3 } from "three";
import { NOISE } from "./noise";

const LOG_V = /* glsl */ `#include <common>
#include <logdepthbuf_pars_vertex>`;
const LOG_F = /* glsl */ `#include <common>
#include <logdepthbuf_pars_fragment>`;

// ---------- Sun: boiling granulation, sunspots and limb darkening, bright enough to bloom ----------

export function sunMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
    vertexShader: /* glsl */ `${LOG_V}
      varying vec3 vObj; varying vec3 vN; varying vec3 vView;
      void main(){
        vObj = position; vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0); vView = mv.xyz;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      uniform float uTime, uPower;
      varying vec3 vObj; varying vec3 vN; varying vec3 vView;
      ${NOISE}
      void main(){
        #include <logdepthbuf_fragment>
        vec3 n = normalize(vObj);
        float oct = lodOctaves(vObj, 8.0, 9.0);
        float t = uTime * 0.04;
        float gran = fbm(n * 9.0 + vec3(t, -t, t * 0.5), oct) * 0.5 + 0.5;
        float big = fbm(n * 2.5 + vec3(0.0, t * 0.3, 0.0), 4.0);
        float spots = smoothstep(0.55, 0.7, snoise(n * 3.0 + vec3(t * 0.05))) * (1.0 - smoothstep(0.25, 0.55, abs(n.y)));
        vec3 col = mix(vec3(1.0, 0.38, 0.06), vec3(1.0, 0.86, 0.55), gran);
        col = mix(col, vec3(1.0, 0.97, 0.85), smoothstep(0.2, 0.6, big) * 0.4);
        float mu = max(dot(normalize(vN), normalize(-vView)), 0.0);
        col *= 0.3 + 0.7 * pow(mu, 0.45);
        col *= 1.0 - spots * 0.8;
        gl_FragColor = vec4(col * 3.2 * uPower, 1.0);
      }`,
  });
}

/** Corona: a camera-facing quad with streamers and a soft glow. */
export function coronaMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPower: { value: 1 } },
    vertexShader: /* glsl */ `${LOG_V}
      varying vec2 vUv;
      void main(){ vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      uniform float uTime, uPower;
      varying vec2 vUv;
      ${NOISE}
      void main(){
        #include <logdepthbuf_fragment>
        float r = length(vUv);
        if (r > 1.0) discard;
        float a = atan(vUv.y, vUv.x);
        float rays = fbm(vec3(cos(a) * 2.5, sin(a) * 2.5, r * 1.5 - uTime * 0.05), 4.0) * 0.5 + 0.5;
        float inner = 0.24;
        float glow = exp(-(r - inner) * 9.0) * step(inner * 0.9, r);
        float streamers = pow(rays, 3.0) * exp(-(r - inner) * 4.0) * 0.8;
        float halo = exp(-r * 3.5) * 0.5;
        float i = (glow + streamers + halo) * smoothstep(1.0, 0.6, r);
        vec3 col = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.9, 0.7), clamp(glow, 0.0, 1.0));
        gl_FragColor = vec4(col * i * 1.6 * uPower, 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

// ---------- Stars and the Milky Way (drawn around the camera, behind everything) ----------

export function starMaterial(pixelRatio: number) {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: pixelRatio } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute vec3 aColor; attribute float aPhase;
      uniform float uTime, uScale;
      varying vec3 vColor; varying float vTw;
      void main(){
        vColor = aColor;
        vTw = 0.82 + 0.18 * sin(uTime * (0.6 + aPhase) + aPhase * 40.0);
        gl_PointSize = aSize * uScale;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position.z = gl_Position.w * 0.999999;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vTw;
      void main(){
        vec2 d = gl_PointCoord * 2.0 - 1.0;
        float r = dot(d, d);
        if (r > 1.0) discard;
        float core = exp(-r * 6.0);
        gl_FragColor = vec4(vColor * core * vTw, 1.0);
      }`,
    // Opaque list + low renderOrder: the sky is drawn first, before any planet.
    transparent: false,
    blending: AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
}

export function milkyWayMaterial(pole: Vector3, center: Vector3) {
  return new ShaderMaterial({
    uniforms: { uPole: { value: pole }, uCenter: { value: center } },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position.z = gl_Position.w * 0.999999; }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uPole, uCenter;
      varying vec3 vDir;
      ${NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float b = dot(d, uPole);
        float band = exp(-b * b * 28.0);
        float bulge = pow(max(dot(d, uCenter), 0.0), 6.0);
        float n = fbm(d * 4.0, 6.0) * 0.5 + 0.5;
        float dust = smoothstep(0.45, 0.7, fbm(d * 7.0 + 3.0, 5.0) * 0.5 + 0.5) * exp(-b * b * 120.0);
        float i = (band * (0.35 + 0.65 * n) + bulge * 0.9) * (1.0 - dust * 0.8);
        vec3 col = mix(vec3(0.42, 0.48, 0.7), vec3(1.0, 0.86, 0.68), bulge + 0.2 * n);
        gl_FragColor = vec4(col * i * 0.075, 1.0);
      }`,
    side: 1,
    depthWrite: false,
    depthTest: false,
  });
}

// ---------- Points that orbit a center on the GPU (asteroid belt, satellites, Dyson swarm, cloud cities) ----------

/**
 * Each point has: aOrbit = (radius, inclination, node, phase), aMotion = (angular speed rad/s, size).
 * Positions are computed in the vertex shader from uTime, so thousands of objects cost almost nothing.
 * uBasis rotates the orbit plane (e.g. into a planet's equator). If uKepler is 1, radius is in AU and is
 * mapped with the same compressed scale the planets use.
 */
export function orbitPointsMaterial(color: string, opts: { kepler?: boolean; minPx?: number; maxPx?: number; glow?: number } = {}) {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uCenter: { value: new Vector3() }, uU: { value: new Vector3(1, 0, 0) }, uV: { value: new Vector3(0, 0, -1) },
      uN: { value: new Vector3(0, 1, 0) }, uScale: { value: 1 }, uKepler: { value: opts.kepler ? 1 : 0 }, uTrue: { value: 0 },
      uColor: { value: new Color(color) }, uPx: { value: 600 }, uMinPx: { value: opts.minPx ?? 1.2 }, uMaxPx: { value: opts.maxPx ?? 24 },
      uGlow: { value: opts.glow ?? 1 }, uFade: { value: 1 },
    },
    vertexShader: /* glsl */ `${LOG_V}
      attribute vec4 aOrbit; attribute vec2 aMotion;
      uniform float uTime, uScale, uKepler, uTrue, uPx, uMinPx, uMaxPx;
      uniform vec3 uCenter, uU, uV, uN;
      varying float vA;
      void main(){
        float r = aOrbit.x;
        if (uKepler > 0.5) r = uTrue > 0.5 ? 14.0 * r : 40.0 * sqrt(r);
        r *= uScale;
        float a = aOrbit.w + aMotion.x * uTime;
        float inc = aOrbit.y, node = aOrbit.z;
        vec3 p = vec3(cos(a), 0.0, sin(a));
        // tilt the orbit by its inclination around the node line
        vec3 nodeDir = vec3(cos(node), 0.0, sin(node));
        float c = cos(inc), s = sin(inc);
        vec3 k = vec3(-nodeDir.z, 0.0, nodeDir.x);
        p = p * c + cross(nodeDir, p) * s + nodeDir * dot(nodeDir, p) * (1.0 - c);
        vec3 w = uCenter + (uU * p.x + uN * p.y + uV * p.z) * r;
        vec4 mv = modelViewMatrix * vec4(w, 1.0);
        float size = aMotion.y * uScale;
        float px = size * uPx / max(-mv.z, 1e-5);
        vA = clamp(px / uMinPx, 0.15, 1.0);
        gl_PointSize = clamp(px, uMinPx, uMaxPx);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      uniform vec3 uColor; uniform float uGlow, uFade;
      varying float vA;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 d = gl_PointCoord * 2.0 - 1.0;
        float r = dot(d, d);
        if (r > 1.0) discard;
        float core = smoothstep(1.0, 0.0, r);
        gl_FragColor = vec4(uColor * core * vA * uGlow * uFade, 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

// ---------- GPU particles for explosions and weapon hits ----------

export function particleMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: 600 } },
    vertexShader: /* glsl */ `${LOG_V}
      attribute vec3 aVel; attribute vec2 aLife; attribute vec3 aColor; attribute float aSize;
      uniform float uTime, uPx;
      varying vec3 vColor; varying float vK;
      void main(){
        float age = uTime - aLife.x;
        float k = age / aLife.y;
        if (age < 0.0 || k > 1.0){ gl_Position = vec4(2.0, 2.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
        vec3 p = position + aVel * (1.0 - exp(-2.2 * age)) / 2.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = clamp(aSize * (1.0 + k) * uPx / max(-mv.z, 1e-5), 1.5, 48.0);
        vColor = aColor; vK = k;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      varying vec3 vColor; varying float vK;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 d = gl_PointCoord * 2.0 - 1.0;
        float r = dot(d, d);
        if (r > 1.0) discard;
        float a = pow(1.0 - vK, 1.6) * exp(-r * 3.0);
        vec3 hot = mix(vec3(1.0, 0.95, 0.85), vColor, smoothstep(0.0, 0.35, vK));
        gl_FragColor = vec4(hot * a * 2.2, 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

// ---------- Orbit lines with a bright trail behind each planet ----------

export function orbitLineMaterial(color: string) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uHead: { value: 0 }, uBase: { value: 0.16 }, uTrail: { value: 0.9 }, uFade: { value: 1 } },
    vertexShader: /* glsl */ `${LOG_V}
      attribute float aPhase; varying float vPhase;
      void main(){ vPhase = aPhase; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      uniform vec3 uColor; uniform float uHead, uBase, uTrail, uFade;
      varying float vPhase;
      void main(){
        #include <logdepthbuf_fragment>
        float behind = fract(uHead - vPhase);
        float trail = (1.0 - smoothstep(0.0, 0.14, behind)) * uTrail;
        gl_FragColor = vec4(uColor * (uBase + trail) * uFade, 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

/** Constant-brightness glow used for shields and selection rings. */
export function fresnelMaterial(color: string) {
  return new ShaderMaterial({
    uniforms: { uColor: { value: new Color(color) }, uAlpha: { value: 1 } },
    vertexShader: /* glsl */ `${LOG_V}
      varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `${LOG_F}
      uniform vec3 uColor; uniform float uAlpha;
      varying vec3 vN; varying vec3 vV;
      void main(){
        #include <logdepthbuf_fragment>
        float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
        gl_FragColor = vec4(uColor * f * uAlpha, 1.0);
      }`,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}
