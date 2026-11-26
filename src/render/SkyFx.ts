import {
  AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, LineBasicMaterial,
  LineSegments, Mesh, MeshStandardMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3, type Scene,
} from "three";
import { COMETS } from "../data/bodies";
import { eclipticToScene, heliocentric } from "../sim/orbits";
import type { World } from "../sim/world";
import { GLOW } from "./Effects";
import type { Labels } from "./Labels";
import { rockGeometry } from "./rocks";
import type { FrameCtx, SolarSystem } from "./SolarSystem";

const LOG_V = "#include <common>\n#include <logdepthbuf_pars_vertex>";
const LOG_F = "#include <common>\n#include <logdepthbuf_pars_fragment>";
const tmp = { x: 0, y: 0, z: 0 };

// ---------- Comet tails: camera-facing ribbons pointing away from the Sun ----------
function tailMaterial(color: string) {
  return new ShaderMaterial({
    uniforms: { uHead: { value: new Vector3() }, uDir: { value: new Vector3(1, 0, 0) }, uBend: { value: new Vector3() }, uLen: { value: 1 }, uWidth: { value: 0.1 }, uColor: { value: new Color(color) }, uAlpha: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `${LOG_V}
      uniform vec3 uHead, uDir, uBend; uniform float uLen, uWidth;
      varying vec2 vT;
      void main(){
        float x = position.x;
        vec3 along = uHead + uDir * x * uLen + uBend * x * x * uLen;
        vec3 view = normalize(cameraPosition - along);
        vec3 side = normalize(cross(normalize(uDir + uBend * 2.0 * x), view) + 1e-6);
        vec3 p = along + side * position.y * uWidth * (0.12 + x * 1.1);
        vT = vec2(x, position.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `${LOG_F}
      uniform vec3 uColor; uniform float uAlpha, uTime;
      varying vec2 vT;
      void main(){
        #include <logdepthbuf_fragment>
        float across = 1.0 - abs(vT.y);
        float fade = pow(1.0 - vT.x, 1.6) * smoothstep(0.0, 0.04, vT.x);
        float streak = 0.7 + 0.3 * sin(vT.y * 23.0 + vT.x * 6.0 - uTime * 0.7);
        gl_FragColor = vec4(uColor * across * across * fade * streak * uAlpha, 1.0);
      }`,
    transparent: true, blending: AdditiveBlending, depthWrite: false, side: 2,
  });
}

// ---------- Aurora: glowing curtains around Earth's magnetic poles on the night side ----------
function auroraMaterial() {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSun: { value: new Vector3(1, 0, 0) }, uPole: { value: new Vector3(0, 1, 0) }, uActivity: { value: 0.5 } },
    vertexShader: `${LOG_V}
      varying vec3 vObj; varying vec3 vWorldN; varying vec3 vView;
      void main(){
        vObj = normalize(position);
        vWorldN = normalize(mat3(modelMatrix) * position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `${LOG_F}
      uniform float uTime, uActivity; uniform vec3 uSun, uPole;
      varying vec3 vObj; varying vec3 vWorldN; varying vec3 vView;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        #include <logdepthbuf_fragment>
        float m = dot(vObj, uPole);
        float mlat = abs(asin(clamp(m, -1.0, 1.0))) * 57.2958;
        vec3 e = normalize(cross(uPole, vObj) + 1e-6);
        float mlon = atan(dot(e, vec3(0.0, 0.0, 1.0)), dot(e, vec3(1.0, 0.0, 0.0)));
        float center = 67.0 - uActivity * 6.0 + sin(mlon * 3.0 + uTime * 0.05) * 2.0;
        float band = exp(-pow((mlat - center) / (3.0 + uActivity * 3.0), 2.0));
        float curtain = smoothstep(0.35, 1.0, n2(vec2(mlon * 14.0, uTime * 0.15)) * 0.7 + n2(vec2(mlon * 41.0 + uTime * 0.4, mlat * 0.5)) * 0.5);
        float night = smoothstep(0.05, -0.2, dot(vWorldN, uSun));
        float edge = pow(1.0 - abs(dot(normalize(vWorldN), vView)), 1.5);
        float i = band * curtain * night * (0.25 + edge * 2.0) * uActivity;
        vec3 col = mix(vec3(0.15, 1.0, 0.45), vec3(1.0, 0.25, 0.35), smoothstep(0.6, 1.0, edge) * 0.4);
        gl_FragColor = vec4(col * i * 1.4, 1.0);
      }`,
    transparent: true, blending: AdditiveBlending, depthWrite: false, side: BackSide,
  });
}

// ---------- Belt rocks: instanced, orbit and tumble on the GPU ----------
function beltMaterial() {
  return new ShaderMaterial({
    uniforms: { uDay: { value: 0 }, uVis: { value: 0 }, uTrue: { value: 0 } },
    vertexShader: `${LOG_V}
      attribute vec4 aOrbit; attribute vec2 aMotion; attribute vec4 aSpin; attribute vec3 aColor;
      uniform float uDay, uVis, uTrue;
      varying vec3 vN; varying vec3 vWorld; varying vec3 vColor;
      mat3 rot(vec3 a, float t){ float c = cos(t), s = sin(t), k = 1.0 - c;
        return mat3(c + a.x*a.x*k, a.y*a.x*k + a.z*s, a.z*a.x*k - a.y*s, a.x*a.y*k - a.z*s, c + a.y*a.y*k, a.z*a.y*k + a.x*s, a.x*a.z*k + a.y*s, a.y*a.z*k - a.x*s, c + a.z*a.z*k); }
      void main(){
        float r = uTrue > 0.5 ? 14.0 * aOrbit.x : 40.0 * sqrt(aOrbit.x);
        float ang = aOrbit.w + aMotion.x * uDay;
        vec3 p = vec3(cos(ang), 0.0, -sin(ang));
        vec3 node = vec3(cos(aOrbit.z), 0.0, -sin(aOrbit.z));
        p = rot(node, aOrbit.y) * p;
        mat3 R = rot(normalize(aSpin.xyz), aSpin.w * uVis);
        vec3 wp = p * r + R * (position * aMotion.y);
        vN = normalize(R * normal);
        vWorld = wp;
        vColor = aColor;
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `${LOG_F}
      varying vec3 vN; varying vec3 vWorld; varying vec3 vColor;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 L = normalize(-vWorld);
        float d = max(dot(normalize(vN), L), 0.0);
        gl_FragColor = vec4(vColor * (d * 1.15 + 0.015), 1.0);
      }`,
  });
}

interface CometView { id: string; name: string; core: Mesh; coma: Sprite; dot: Sprite; ion: Mesh; dust: Mesh; pos: Vector3; active: number }

/** Comets, auroras, shooting stars and the 3D asteroid belt. */
export class SkyFx {
  readonly comets: CometView[] = [];
  private aurora: Mesh;
  private meteors: LineSegments;
  private meteorList: { a: Vector3; dir: Vector3; t: number; dur: number; len: number }[] = [];
  private belt: InstancedMesh[] = [];
  private beltMat = beltMaterial();

  constructor(scene: Scene, _world: World, system: SolarSystem) {
    const plane = new PlaneGeometry(1, 2, 40, 6).translate(0.5, 0, 0);
    for (const c of COMETS) {
      const core = new Mesh(new SphereGeometry(1, 16, 12), new MeshStandardMaterial({ color: 0x3a342e, roughness: 1 }));
      const coma = new Sprite(new SpriteMaterial({ map: GLOW, color: 0xbfe6ff, blending: AdditiveBlending, depthWrite: false, transparent: true }));
      const dot = new Sprite(new SpriteMaterial({ map: GLOW, color: 0xdff2ff, blending: AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false }));
      dot.scale.setScalar(0.02);
      const ion = new Mesh(plane, tailMaterial("#7fb6ff"));
      const dust = new Mesh(plane, tailMaterial("#ffe9c4"));
      for (const m of [core, coma, dot, ion, dust]) { m.frustumCulled = false; scene.add(m); }
      this.comets.push({ id: c.id, name: c.name, core, coma, dot, ion, dust, pos: new Vector3(), active: 0 });
    }
    // Aurora rides with Earth's rotation, so it lives in Earth's spinning frame.
    const earth = system.views.get("earth")!;
    this.aurora = new Mesh(new SphereGeometry(1, 128, 64), auroraMaterial());
    this.aurora.scale.setScalar(earth.body.radius * 1.022);
    this.aurora.renderOrder = 3;
    earth.spin.add(this.aurora);
    const pl = (80.7 * Math.PI) / 180, po = (-72.7 * Math.PI) / 180;
    (this.aurora.material as ShaderMaterial).uniforms.uPole.value.set(Math.cos(pl) * Math.cos(po), Math.sin(pl), -Math.cos(pl) * Math.sin(po));
    // Shooting stars
    const mg = new BufferGeometry();
    mg.setAttribute("position", new BufferAttribute(new Float32Array(48 * 6), 3).setUsage(DynamicDrawUsage));
    mg.setAttribute("color", new BufferAttribute(new Float32Array(48 * 6), 3).setUsage(DynamicDrawUsage));
    this.meteors = new LineSegments(mg, new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    this.meteors.frustumCulled = false;
    scene.add(this.meteors);
    // 3D asteroid belt: three rock shapes, ~3,600 rocks
    const kinds = [new Color("#5d5750"), new Color("#8f7a62"), new Color("#9a9893")];
    for (let s = 0; s < 3; s++) {
      const n = 1200;
      const mesh = new InstancedMesh(rockGeometry(s * 2.7 + 1.1, 1), this.beltMat, n);
      const orbit = new Float32Array(n * 4), motion = new Float32Array(n * 2), spin = new Float32Array(n * 4), color = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        let a: number;
        do { a = 2.15 + Math.pow(Math.random(), 0.9) * 1.15; } while (Math.abs(a - 2.5) < 0.03 || Math.abs(a - 2.82) < 0.025 || Math.abs(a - 2.95) < 0.02);
        orbit.set([a, (Math.random() + Math.random() - 1) * 0.22, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2], i * 4);
        motion.set([(Math.PI * 2) / (365.25 * Math.pow(a, 1.5)), 0.005 + Math.pow(Math.random(), 6) * 0.06], i * 2);
        spin.set([Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5, (Math.random() - 0.5) * 1.5], i * 4);
        const k = kinds[Math.random() < 0.72 ? 0 : Math.random() < 0.8 ? 1 : 2].clone().multiplyScalar(0.75 + Math.random() * 0.5);
        color.set([k.r, k.g, k.b], i * 3);
      }
      mesh.geometry.setAttribute("aOrbit", new InstancedBufferAttribute(orbit, 4));
      mesh.geometry.setAttribute("aMotion", new InstancedBufferAttribute(motion, 2));
      mesh.geometry.setAttribute("aSpin", new InstancedBufferAttribute(spin, 4));
      mesh.geometry.setAttribute("aColor", new InstancedBufferAttribute(color, 3));
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.belt.push(mesh);
    }
  }

  cometPos(id: string) { return this.comets.find(c => c.id === id && c.active > 0.02)?.pos; }

  update(ctx: FrameCtx, labels: Labels, focus: string) {
    const { world, camera, t } = ctx;
    const mode = world.settings.scale;
    // Comets
    for (const v of this.comets) {
      const c = COMETS.find(x => x.id === v.id)!;
      const h = heliocentric(c.orbit, world.day, tmp);
      const rAU = Math.hypot(h.x, h.y, h.z);
      eclipticToScene(h, mode, v.pos);
      const ahead = eclipticToScene(heliocentric(c.orbit, world.day + 2, { x: 0, y: 0, z: 0 }), mode, { x: 0, y: 0, z: 0 });
      const vel = new Vector3(ahead.x, ahead.y, ahead.z).sub(v.pos).normalize();
      v.active = Math.max(0, Math.min(1, (4.5 - rAU) / 3.5)) ** 2;
      const vis = rAU < 30;
      for (const m of [v.core, v.coma, v.dot, v.ion, v.dust]) m.visible = vis;
      if (!vis) continue;
      v.core.position.copy(v.pos);
      v.core.scale.setScalar(Math.max(0.004, (camera.position.distanceTo(v.pos) * 2) / ctx.px));
      v.coma.position.copy(v.pos);
      v.coma.scale.setScalar(0.3 + v.active * 3.5);
      (v.coma.material as SpriteMaterial).opacity = 0.15 + v.active * 0.85;
      v.dot.position.copy(v.pos);
      (v.dot.material as SpriteMaterial).opacity = 0.25 + v.active * 0.75;
      const anti = v.pos.clone().normalize();
      const len = 2 + v.active * 34;
      for (const [mesh, bend, width, alpha] of [[v.ion, 0, 0.6, 1.2], [v.dust, 0.35, 1.6, 0.9]] as const) {
        const u = (mesh.material as ShaderMaterial).uniforms;
        u.uHead.value.copy(v.pos); u.uDir.value.copy(anti); u.uBend.value.copy(vel).multiplyScalar(-bend);
        u.uLen.value = len; u.uWidth.value = width * (0.4 + v.active); u.uAlpha.value = v.active * alpha; u.uTime.value = t;
      }
      if (v.active > 0.05 || focus === v.id) labels.put("comet-" + v.id, v.pos, v.name, { cls: "small voyager", dy: -14 });
    }
    // Aurora strength follows the 11-year solar cycle (maxima around 2014, 2025, 2036...)
    const au = (this.aurora.material as ShaderMaterial).uniforms;
    const earth = world.bodies.get("earth")!;
    au.uTime.value = t;
    au.uSun.value.copy(earth.pos).negate().normalize();
    au.uActivity.value = 0.3 + 0.7 * Math.max(0, Math.cos((2 * Math.PI * (ctx.year - 2025)) / 11)) * (0.75 + 0.25 * Math.sin(t * 0.13));
    this.aurora.visible = camera.position.distanceTo(earth.pos) < earth.radius * 30;
    // Shooting stars when you're near Earth (more during the big annual showers)
    const camD = camera.position.distanceTo(earth.pos);
    if (camD < earth.radius * 8) {
      const doy = ((world.day % 365.25) + 365.25 + 1.5) % 365.25; // ~days since Jan 1
      const shower = [224, 321, 348].some(d => Math.abs(doy - d) < 3) ? 4 : 1;
      if (Math.random() < ctx.dt * 1.5 * shower && this.meteorList.length < 48) {
        const toCam = camera.position.clone().sub(earth.pos).normalize();
        const p = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().addScaledVector(toCam, 1.2).normalize();
        const dir = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).projectOnPlane(p).normalize();
        this.meteorList.push({ a: earth.pos.clone().addScaledVector(p, earth.radius * 1.02), dir, t: 0, dur: 0.35 + Math.random() * 0.5, len: earth.radius * (0.02 + Math.random() * 0.04) });
      }
    }
    const mp = this.meteors.geometry.getAttribute("position") as BufferAttribute, mc = this.meteors.geometry.getAttribute("color") as BufferAttribute;
    let mi = 0;
    for (const m of this.meteorList) {
      m.t += ctx.dt;
      const k = m.t / m.dur;
      const head = m.a.clone().addScaledVector(m.dir, m.len * k);
      const tail = m.a.clone().addScaledVector(m.dir, m.len * Math.max(0, k - 0.45));
      const b = Math.sin(Math.PI * Math.min(1, k)) * 1.6;
      mp.setXYZ(mi * 2, tail.x, tail.y, tail.z); mp.setXYZ(mi * 2 + 1, head.x, head.y, head.z);
      mc.setXYZ(mi * 2, 0, 0, 0); mc.setXYZ(mi * 2 + 1, 0.9 * b, 1.0 * b, 0.85 * b);
      mi++;
    }
    this.meteorList = this.meteorList.filter(m => m.t < m.dur);
    this.meteors.geometry.setDrawRange(0, mi * 2); mp.needsUpdate = mc.needsUpdate = true;
    // Belt rocks
    const bu = this.beltMat.uniforms;
    bu.uDay.value = world.day; bu.uVis.value = ctx.vis; bu.uTrue.value = mode === "true" ? 1 : 0;
  }
}
