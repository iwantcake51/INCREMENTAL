import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Line, LineBasicMaterial, LineLoop, Mesh, PlaneGeometry, Points, Quaternion,
  RingGeometry, Scene, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3, type PerspectiveCamera,
} from "three";
import { CERES, PLANETS } from "../data/bodies";
import type { Body } from "../sim/bodies";
import { eclipticDir, eclipticToScene, heliocentric } from "../sim/orbits";
import type { ScaleMode } from "../sim/scale";
import type { World } from "../sim/world";
import { GLOW } from "./Effects";
import { DISPLACE, HEIGHT_SCALE, type BodyMaps } from "./textures";
import { DAY_MS, J2000 } from "../sim/time";
import { craterLifetime } from "../sim/impacts";
import { COLONY_GROWTH, SETTLEMENT_SITES } from "../data/timeline";
import { atmosphereMaterial, cloudMaterial, planetMaterial, ringMaterial } from "./shaders/planet";
import { coronaMaterial, milkyWayMaterial, orbitLineMaterial, orbitPointsMaterial, starMaterial, sunMaterial } from "./shaders/space";

const UP = new Vector3(0, 1, 0);
const tmpV = new Vector3();
const tmpQ = new Quaternion();

interface BodyView {
  body: Body;
  root: Group;
  tilt: Group;
  spin: Group;
  mesh: Mesh;
  mat: ShaderMaterial;
  clouds?: Mesh;
  atmo?: Mesh;
  ring?: Mesh;
}

export interface FrameCtx {
  world: World;
  camera: PerspectiveCamera;
  t: number;
  dt: number;
  /** Real seconds that pass only while playing (for visual-only motion like satellites). */
  vis: number;
  /** Pixels per scene unit at distance 1. */
  px: number;
  year: number;
  sunPower: number;
}

/** Sun, planets, moons, Ceres, rings, atmospheres, orbit lines, the asteroid belt and the sky. */
export class SolarSystem {
  readonly views = new Map<string, BodyView>();
  readonly sky = new Group();
  private sun!: Mesh;
  private corona!: Mesh;
  private glow!: Sprite;
  private orbits = new Group();
  private orbitLines: { id: string; line: Line; T: number; L0: number; mat: ShaderMaterial }[] = [];
  private moonOrbits: { id: string; parent: string; line: LineLoop }[] = [];
  private belt!: Points;
  private stars!: Points;
  private builtMode: ScaleMode | null = null;

  constructor(private scene: Scene, private world: World, pixelRatio: number) {
    this.buildSky(pixelRatio);
    this.buildSun();
    const hi = new SphereGeometry(1, 192, 128), lo = new SphereGeometry(1, 96, 64);
    for (const b of world.bodies.list) if (b.kind !== "sun") this.buildBody(b, b.kind === "planet" ? hi : lo);
    this.buildBelt();
    scene.add(this.orbits);
  }

  private buildSky(pixelRatio: number) {
    // ~9000 stars, brighter and denser toward the Milky Way, colored by temperature.
    const N = 9000;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), phase = new Float32Array(N);
    const pole = eclipticDir(180.02, 29.81, new Vector3()) as Vector3;
    const center = eclipticDir(266.84, -5.54, new Vector3()) as Vector3;
    const palette = [new Color("#9bb0ff"), new Color("#cad7ff"), new Color("#f8f7ff"), new Color("#fff4ea"), new Color("#ffd2a1"), new Color("#ffb07a")];
    const v = new Vector3();
    for (let i = 0; i < N; i++) {
      do { v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1); } while (v.lengthSq() > 1 || v.lengthSq() < 1e-3);
      v.normalize();
      if (i % 3 === 0) { v.addScaledVector(pole, -v.dot(pole) * 0.85).normalize(); }
      v.multiplyScalar(1000);
      pos.set([v.x, v.y, v.z], i * 3);
      const c = palette[Math.min(palette.length - 1, Math.floor(Math.pow(Math.random(), 0.8) * palette.length))];
      const mag = Math.pow(Math.random(), 7);
      const b = 0.35 + mag * 1.6;
      col.set([c.r * b, c.g * b, c.b * b], i * 3);
      size[i] = 1.1 + mag * 3.4;
      phase[i] = Math.random();
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aColor", new BufferAttribute(col, 3));
    g.setAttribute("aSize", new BufferAttribute(size, 1));
    g.setAttribute("aPhase", new BufferAttribute(phase, 1));
    this.stars = new Points(g, starMaterial(pixelRatio));
    this.stars.frustumCulled = false;
    this.stars.renderOrder = -100;
    const mw = new Mesh(new SphereGeometry(900, 64, 32), milkyWayMaterial(pole, center));
    mw.renderOrder = -101;
    mw.frustumCulled = false;
    this.sky.add(mw, this.stars);
    this.scene.add(this.sky);
  }

  private buildSun() {
    const b = this.world.bodies.get("sun")!;
    this.sun = new Mesh(new SphereGeometry(1, 128, 96), sunMaterial());
    this.sun.scale.setScalar(b.radius);
    this.corona = new Mesh(new PlaneGeometry(1, 1), coronaMaterial());
    this.corona.scale.setScalar(b.radius * 6);
    this.corona.renderOrder = 2;
    this.glow = new Sprite(new SpriteMaterial({ map: GLOW, color: 0xffd9a0, blending: AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false }));
    this.glow.scale.setScalar(0.09);
    this.glow.renderOrder = 3;
    this.scene.add(this.sun, this.corona, this.glow);
  }

  private buildBody(b: Body, geo: SphereGeometry) {
    const look = b.look!;
    const root = new Group(), tilt = new Group(), spin = new Group();
    tilt.quaternion.setFromUnitVectors(UP, b.axis);
    root.add(tilt); tilt.add(spin);
    const mat = planetMaterial(look, b.radius);
    mat.uniforms.uDisplace.value = DISPLACE[b.id] ?? 0;
    const mesh = new Mesh(geo, mat);
    mesh.scale.setScalar(b.radius);
    spin.add(mesh);
    const view: BodyView = { body: b, root, tilt, spin, mesh, mat };
    if (look.clouds || ["mars", "venus", "moon", "mercury", "callisto", "ganymede", "titania"].includes(b.id)) {
      // Cloud layer: always on for Earth, fades in on terraformed worlds.
      const clouds = new Mesh(geo, cloudMaterial(look.seed));
      clouds.scale.setScalar(b.radius * 1.008);
      clouds.visible = !!look.clouds;
      clouds.renderOrder = 1;
      spin.add(clouds);
      view.clouds = clouds;
    }
    const atm = look.atmosphere ?? (b.kind !== "sun" ? { color: "#9cc4ff", density: 0, height: 0.03 } : undefined);
    if (atm) {
      const atmo = new Mesh(geo, atmosphereMaterial(atm.color, atm.density));
      const outer = b.radius * (1 + Math.max(atm.height, 0.025) * 2.2);
      atmo.scale.setScalar(outer);
      const u = (atmo.material as ShaderMaterial).uniforms;
      u.uRadius.value = b.radius; u.uOuter.value = outer;
      atmo.visible = atm.density > 0;
      atmo.renderOrder = 2;
      root.add(atmo);
      view.atmo = atmo;
    }
    if (b.planet?.ring) {
      const r = b.planet.ring;
      const ring = new Mesh(new RingGeometry(r.inner, r.outer, 512, 1), ringMaterial(r.kind, r.inner, r.outer));
      ring.rotation.x = -Math.PI / 2;
      ring.scale.setScalar(b.radius);
      ring.renderOrder = 3;
      tilt.add(ring);
      view.ring = ring;
      const u = (ring.material as ShaderMaterial).uniforms;
      u.uRadius.value = b.radius;
      mat.uniforms.uRingKind.value = r.kind === "saturn" ? 2 : 1;
      mat.uniforms.uRingInner.value = r.inner;
      mat.uniforms.uRingOuter.value = r.outer;
    }
    this.scene.add(root);
    this.views.set(b.id, view);
  }

  private buildBelt() {
    const N = 7000;
    const orbit = new Float32Array(N * 4), motion = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      let a: number;
      do { a = 2.1 + Math.pow(Math.random(), 0.9) * 1.25; } while (Math.abs(a - 2.5) < 0.03 || Math.abs(a - 2.82) < 0.025 || Math.abs(a - 2.95) < 0.02); // Kirkwood gaps
      const inc = (Math.random() + Math.random() + Math.random() - 1.5) * 0.18;
      orbit.set([a, inc, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2], i * 4);
      motion.set([(Math.PI * 2) / (365.25 * Math.pow(a, 1.5)), 0.015 + Math.pow(Math.random(), 4) * 0.08], i * 2);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(N * 3), 3));
    g.setAttribute("aOrbit", new BufferAttribute(orbit, 4));
    g.setAttribute("aMotion", new BufferAttribute(motion, 2));
    this.belt = new Points(g, orbitPointsMaterial("#b4a896", { kepler: true, minPx: 1.1, maxPx: 10, glow: 0.55 }));
    this.belt.frustumCulled = false;
    this.scene.add(this.belt);
  }

  /** Swap in a real surface map once it has loaded. */
  applyMaps(id: string, maps: BodyMaps) {
    const v = this.views.get(id);
    if (!v) return;
    const u = v.mat.uniforms;
    if (maps.map) { u.uMap.value = maps.map; u.uHasMap.value = 1; }
    if (maps.night) { u.uNight.value = maps.night; u.uHasNight.value = 1; }
    if (maps.ocean) { u.uOcean.value = maps.ocean; u.uHasOcean.value = 1; }
    if (maps.height) { u.uHeight.value = maps.height; u.uHasHeight.value = 1; u.uHeightScale.value = HEIGHT_SCALE[id] ?? 0.006; }
    if (maps.gray) u.uGray.value = 1;
    if (maps.clouds && v.clouds) {
      const cu = (v.clouds.material as ShaderMaterial).uniforms;
      cu.uMap.value = maps.clouds; cu.uHasMap.value = 1;
    }
    // Bump strength suits the maps better a little lower
    if (id === "earth") u.uBump.value = 1.2;
  }

  /** Orbit paths depend on the distance scale, so they are rebuilt when it changes. */
  private buildOrbits(mode: ScaleMode) {
    this.orbits.clear();
    this.orbitLines = [];
    const add = (id: string, el: typeof CERES.orbit, color: string, base: number) => {
      const N = 512;
      const pos = new Float32Array((N + 1) * 3), ph = new Float32Array(N + 1);
      const p = { x: 0, y: 0, z: 0 }, s = { x: 0, y: 0, z: 0 };
      for (let k = 0; k <= N; k++) {
        eclipticToScene(heliocentric(el, (el.T * k) / N, p), mode, s);
        pos.set([s.x, s.y, s.z], k * 3);
        ph[k] = k / N;
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(pos, 3));
      g.setAttribute("aPhase", new BufferAttribute(ph, 1));
      const mat = orbitLineMaterial(color);
      mat.uniforms.uBase.value = base;
      const line = new Line(g, mat);
      line.frustumCulled = false;
      this.orbits.add(line);
      this.orbitLines.push({ id, line, T: el.T, L0: 0, mat });
    };
    for (const p of PLANETS) add(p.id, p.orbit, p.color, 0.13);
    add("ceres", CERES.orbit, "#8f8a82", 0.06);
    // Moon orbits: circles in each planet's equatorial plane
    this.moonOrbits = [];
    for (const m of this.world.bodies.moons) {
      const N = 128, pos = new Float32Array(N * 3);
      const parent = this.world.bodies.get(m.parent!)!;
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2;
        tmpV.set(0, 0, 0).addScaledVector(parent.eqU, Math.cos(a) * m.orbitR).addScaledVector(parent.eqV, Math.sin(a) * m.orbitR);
        pos.set([tmpV.x, tmpV.y, tmpV.z], k * 3);
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(pos, 3));
      const line = new LineLoop(g, new LineBasicMaterial({ color: 0x8f93ad, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false }));
      this.orbits.add(line);
      this.moonOrbits.push({ id: m.id, parent: m.parent!, line });
    }
    this.builtMode = mode;
  }

  update(ctx: FrameCtx, selected: string, levels: { city: (id: string) => number; terraform: (id: string) => number }) {
    const { world, camera, t } = ctx;
    if (this.builtMode !== world.settings.scale) this.buildOrbits(world.settings.scale);
    this.sky.position.copy(camera.position);
    (this.stars.material as ShaderMaterial).uniforms.uTime.value = t;

    const sunBody = world.bodies.get("sun")!;
    const sm = this.sun.material as ShaderMaterial;
    sm.uniforms.uTime.value = t; sm.uniforms.uPower.value = ctx.sunPower;
    this.sun.quaternion.setFromAxisAngle(UP, sunBody.spin);
    this.corona.quaternion.copy(camera.quaternion);
    (this.corona.material as ShaderMaterial).uniforms.uTime.value = t;
    (this.corona.material as ShaderMaterial).uniforms.uPower.value = ctx.sunPower;
    const sunDist = camera.position.length();
    this.glow.material.opacity = Math.min(1, Math.max(0, (sunDist - 30) / 200)) * ctx.sunPower;

    // Season for Earth's snow: 1 = deep northern winter (late January), 0 = northern summer.
    const date = new Date(J2000 + world.day * DAY_MS);
    const doy = (date.getTime() - Date.UTC(date.getUTCFullYear(), 0, 1)) / DAY_MS;
    const winterN = 0.5 + 0.5 * Math.cos((2 * Math.PI * (doy - 22)) / 365.25);
    const moonBody = world.bodies.get("moon")!, earthBody = world.bodies.get("earth")!;

    for (const v of this.views.values()) {
      const b = v.body;
      v.root.position.copy(b.pos);
      v.spin.quaternion.setFromAxisAngle(UP, b.spin);
      const u = v.mat.uniforms;
      // Light directions in the body's own (rotating) frame, for terrain shadows.
      tmpQ.copy(v.tilt.quaternion).multiply(v.spin.quaternion).invert();
      u.uSunObj.value.copy(b.pos).negate().normalize().applyQuaternion(tmpQ);
      // Craters on this world
      const craters = world.impacts.craters.filter(c => c.body === b.id).slice(-10);
      u.uImpactCount.value = craters.length;
      const gas = b.look?.surface === "gas" || b.look?.surface === "ice";
      craters.forEach((c, k) => {
        const age = Math.max(0, ctx.year - c.year), life = craterLifetime(b.id);
        u.uImpacts.value[k].set(c.dir[0], c.dir[1], c.dir[2], c.size);
        u.uImpactInfo.value[k].set(
          1 - Math.min(1, age / life) ** 2,
          Math.max(0, 1 - age / (life * 0.4)),
          Math.max(Math.exp(-age / 4), Math.exp(-c.realAge / 5)) * (c.size > 0.02 ? 1 : 0.5),
          gas ? 1 : 0);
      });
      // Settlement lights spread outward from the first base
      const col = world.civ.colonies.find(c => c.active && c.body === b.id && b.id !== "earth");
      const site = SETTLEMENT_SITES[b.id];
      if (col && site) {
        const la = (site[0] * Math.PI) / 180, lo = (site[1] * Math.PI) / 180;
        const age = Math.max(0, ctx.year - col.y) * (COLONY_GROWTH[col.id] ?? 1);
        u.uCitySite.value.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo), 0.04 + Math.min(1.4, Math.pow(age / 160, 0.8) * 1.4));
      } else u.uCitySite.value.w = 0;
      // Eclipses (only meaningful while the Moon is in its real position)
      if (b.id === "earth") u.uOccluder.value.set(moonBody.pos.x, moonBody.pos.y, moonBody.pos.z, moonBody.radius * 1.05);
      else if (b.id === "moon") u.uOccluder.value.set(earthBody.pos.x, earthBody.pos.y, earthBody.pos.z, moonBody.orbitR * 0.021);
      if (b.id === "moon") {
        // Earthshine: sunlight bounced off Earth lights the Moon's night side (strongest near new moon)
        u.uMoonPos.value.copy(earthBody.pos);
        u.uMoonObj.value.subVectors(earthBody.pos, b.pos).normalize().applyQuaternion(tmpQ);
        const toSun = tmpV.copy(earthBody.pos).negate().normalize();
        const toMoon = new Vector3().subVectors(b.pos, earthBody.pos).normalize();
        u.uMoonLight.value = ((1 + toSun.dot(toMoon)) / 2) * 1.6;
      }
      if (b.id === "earth") {
        u.uMoonPos.value.copy(moonBody.pos);
        u.uMoonObj.value.subVectors(moonBody.pos, b.pos).normalize().applyQuaternion(tmpQ);
        const toSun = tmpV.copy(moonBody.pos).negate().normalize();
        const toEarth = new Vector3().subVectors(earthBody.pos, moonBody.pos).normalize();
        u.uMoonLight.value = (1 + toSun.dot(toEarth)) / 2;
        u.uWinter.value = [winterN, 1 - winterN];
      }
      u.uTime.value = t;
      u.uCenter.value.copy(b.pos);
      u.uRingNormal.value.copy(b.axis);
      u.uSunPower.value = ctx.sunPower;
      u.uCity.value = levels.city(b.id);
      const tf = levels.terraform(b.id);
      u.uTerraform.value = tf;
      // Extra noise detail when the camera is close (the per-pixel LOD does most of the work).
      const alt = camera.position.distanceTo(b.pos) / b.radius;
      u.uDetail.value = alt < 1.3 ? 1 : 0;
      if (v.clouds) {
        const cu = (v.clouds.material as ShaderMaterial).uniforms;
        cu.uTime.value = t; cu.uSunPower.value = ctx.sunPower;
        const cover = b.look?.clouds ? 0 : tf > 0.3 ? -0.25 + (tf - 0.3) * 0.36 : -1;
        v.clouds.visible = cover > -0.9;
        cu.uCover.value = cover;
      }
      if (v.atmo) {
        const au = (v.atmo.material as ShaderMaterial).uniforms;
        au.uCenter.value.copy(b.pos);
        au.uSunPower.value = ctx.sunPower;
        const base = b.look?.atmosphere?.density ?? 0;
        const dens = Math.max(base, tf * 0.95);
        au.uDensity.value = dens;
        if (tf > 0 && !b.look?.atmosphere) au.uColor.value.set("#7fb4ff");
        else if (tf > 0) au.uColor.value.lerpColors(new Color(b.look!.atmosphere!.color), new Color("#7fb4ff"), tf);
        u.uAtmoColor.value.copy(au.uColor.value);
        u.uAtmoDensity.value = dens;
        v.atmo.visible = dens > 0.01;
      }
      if (v.ring) {
        const ru = (v.ring.material as ShaderMaterial).uniforms;
        ru.uCenter.value.copy(b.pos); ru.uNormal.value.copy(b.axis); ru.uSunPower.value = ctx.sunPower;
      }
    }

    // Orbit lines with a bright trail behind each planet
    const showOrbits = world.settings.orbits;
    this.orbits.visible = showOrbits;
    // Planet orbit lines fade away when you're close to the world you're looking at.
    const focusBody = world.bodies.get(selected);
    const nearFade = focusBody && focusBody.kind !== "sun" ? Math.min(1, Math.max(0, (camera.position.distanceTo(focusBody.pos) / focusBody.radius - 4) / 25)) : 1;
    if (showOrbits) {
      for (const o of this.orbitLines) {
        const el = o.id === "ceres" ? CERES.orbit : PLANETS.find(p => p.id === o.id)!.orbit;
        o.mat.uniforms.uHead.value = (((world.day / el.T) % 1) + 1) % 1;
        const isSel = o.id === selected || world.bodies.systemOf(selected) === o.id;
        o.mat.uniforms.uColor.value.set(isSel ? "#f3cf82" : el === CERES.orbit ? "#8f8a82" : PLANETS.find(p => p.id === o.id)!.color);
        o.mat.uniforms.uBase.value = isSel ? 0.35 : o.id === "ceres" ? 0.05 : 0.12;
        // Fade an orbit line out when the camera is right next to that planet, so it doesn't slice through the view.
        const b = world.bodies.get(o.id)!;
        const d = camera.position.distanceTo(b.pos) / b.radius;
        o.mat.uniforms.uFade.value = Math.min(1, Math.max(0, (d - 4) / 30)) * nearFade;
      }
      for (const m of this.moonOrbits) {
        const parent = world.bodies.get(m.parent)!;
        m.line.position.copy(parent.pos);
        const d = camera.position.distanceTo(parent.pos) / parent.radius;
        const near = world.bodies.systemOf(selected) === m.parent;
        (m.line.material as LineBasicMaterial).opacity = (near ? 0.35 : 0.12) * Math.min(1, Math.max(0, (90 - d) / 40));
        m.line.visible = d < 90;
      }
    }

    const bu = (this.belt.material as ShaderMaterial).uniforms;
    bu.uTime.value = world.day;
    bu.uTrue.value = world.settings.scale === "true" ? 1 : 0;
    bu.uPx.value = ctx.px;
  }
}
