import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, Group, Line, LineBasicMaterial, Mesh,
  MeshBasicMaterial, MeshStandardMaterial, Points, PointsMaterial, Quaternion, ShaderMaterial, TorusGeometry, Vector3, type Scene,
} from "three";
import { PLANETS } from "../data/bodies";
import type { Body } from "../sim/bodies";
import { eclipticDir, eclipticToScene, heliocentric, type V3 } from "../sim/orbits";
import { SUN_RADIUS, type ScaleMode } from "../sim/scale";
import { dayFromISO, yearOf } from "../sim/time";
import type { Labels } from "./Labels";
import type { FrameCtx, SolarSystem } from "./SolarSystem";
import { orbitPointsMaterial } from "./shaders/space";

const UP = new Vector3(0, 1, 0);
const v1 = new Vector3(), v2 = new Vector3();
const q = new Quaternion();

/** Interpolate a value from a sorted [x, y] table. */
function table(t: [number, number][], x: number) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x < t[i][0]) { const [x0, y0] = t[i - 1], [x1, y1] = t[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return t[t.length - 1][1];
}

// Approximate number of working satellites in orbit (UCS satellite database / public trackers).
const SAT_COUNT: [number, number][] = [[1957.75, 0], [1958, 2], [1965, 80], [1975, 300], [1990, 550], [2005, 800], [2015, 1300], [2019.4, 2200], [2021, 4300], [2023, 7500], [2025, 10500], [2027, 12500], [2040, 16000]];

/** A swarm of points orbiting a body, animated on the GPU. */
class Swarm {
  points: Points;
  mat: ShaderMaterial;
  constructor(scene: Scene, n: number, color: string, init: (i: number) => [r: number, inc: number, node: number, phase: number, speed: number, size: number], opts?: { minPx?: number; maxPx?: number; glow?: number }) {
    const orbit = new Float32Array(n * 4), motion = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const [r, inc, node, ph, sp, sz] = init(i); orbit.set([r, inc, node, ph], i * 4); motion.set([sp, sz], i * 2); }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute("aOrbit", new BufferAttribute(orbit, 4));
    g.setAttribute("aMotion", new BufferAttribute(motion, 2));
    g.setDrawRange(0, 0);
    this.mat = orbitPointsMaterial(color, opts);
    this.points = new Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  place(center: Body, count: number, ctx: FrameCtx, scale = center.radius) {
    this.points.geometry.setDrawRange(0, Math.max(0, Math.floor(count)));
    this.points.visible = count >= 1;
    const u = this.mat.uniforms;
    u.uCenter.value.copy(center.pos);
    u.uU.value.copy(center.eqU); u.uV.value.copy(center.eqV); u.uN.value.copy(center.axis);
    u.uScale.value = scale; u.uTime.value = ctx.vis; u.uPx.value = ctx.px;
  }
}

interface Probe { name: string; body: string; from: string; to?: string; r: number; speed: number; inc: number }
const PROBES: Probe[] = [
  { name: "Mars Reconnaissance Orbiter", body: "mars", from: "2006-03-10", r: 1.35, speed: 0.9, inc: 1.6 },
  { name: "MAVEN", body: "mars", from: "2014-09-22", r: 2.1, speed: 0.5, inc: 1.3 },
  { name: "Galileo", body: "jupiter", from: "1995-12-07", to: "2003-09-21", r: 6, speed: 0.12, inc: 0.1 },
  { name: "Juno", body: "jupiter", from: "2016-07-05", r: 3.4, speed: 0.25, inc: 1.5 },
  { name: "Europa Clipper", body: "jupiter", from: "2030-04-11", r: 5, speed: 0.18, inc: 0.3 },
  { name: "Cassini", body: "saturn", from: "2004-07-01", to: "2017-09-15", r: 4, speed: 0.2, inc: 0.6 },
  { name: "Dawn", body: "ceres", from: "2015-03-06", to: "2018-11-01", r: 3, speed: 0.6, inc: 1.4 },
];

/** Real Voyager routes: flyby dates and where each probe is heading now (ecliptic lon/lat), with speed in AU/year. */
const VOYAGERS = [
  { id: "voyager1", name: "Voyager 1", launch: "1977-09-05", flybys: [["jupiter", "1979-03-05"], ["saturn", "1980-11-12"]], lon: 255, lat: 35, auNow: 167, now: 2025.9, speed: 3.57 },
  { id: "voyager2", name: "Voyager 2", launch: "1977-08-20", flybys: [["jupiter", "1979-07-09"], ["saturn", "1981-08-25"], ["uranus", "1986-01-24"], ["neptune", "1989-08-25"]], lon: 289, lat: -31, auNow: 140, now: 2025.9, speed: 3.2 },
] as const;

interface VoyagerView { id: string; name: string; knots: { day: number; p: V3 }[]; dir: V3; speed: number; marker: Mesh; line: Line; samples: number[]; pos: Vector3 }

/**
 * Everything technology adds to the sky, era by era. Each piece checks the year and fades in on its own,
 * so the solar system visibly fills up as time passes.
 */
export class TechLayer {
  private sats: Swarm;
  private probes: Points;
  private venusCities: Swarm;
  private dyson: Swarm;
  private iss: Group;
  private elevator: Group;
  private ringHab: Mesh;
  private ceresStation: Mesh;
  private ark: Group;
  private voyagers: VoyagerView[] = [];
  private builtMode: ScaleMode | null = null;
  readonly arkPos = new Vector3(1e9, 0, 0);
  probePositions: { name: string; pos: Vector3; body: string }[] = [];

  constructor(private scene: Scene, system: SolarSystem) {
    const shells = [53, 53.2, 70, 97.6, 43].map(d => (d * Math.PI) / 180);
    this.sats = new Swarm(scene, 16000, "#eef3ff", i => {
      const geo = i < 2200 && i % 9 === 0;
      const r = geo ? 6.6 * 0.8 : 1.08 + Math.random() * (i < 2200 ? 0.35 : 0.08);
      const inc = geo ? 0 : i < 2200 ? Math.random() * 1.7 : shells[i % shells.length];
      return [r, inc, Math.random() * 6.283, Math.random() * 6.283, (geo ? 0.05 : 0.35 + Math.random() * 0.2) * (Math.random() < 0.06 ? -1 : 1), 0.006];
    }, { minPx: 1, maxPx: 2.5, glow: 0.2 });
    const pg = new BufferGeometry();
    pg.setAttribute("position", new BufferAttribute(new Float32Array(PROBES.length * 3), 3));
    this.probes = new Points(pg, new PointsMaterial({ color: 0xffe7a8, size: 4, sizeAttenuation: false, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    this.probes.frustumCulled = false;
    scene.add(this.probes);
    this.venusCities = new Swarm(scene, 60, "#ffd38a", () => [1.05, (Math.random() - 0.5) * 1.2, Math.random() * 6.283, Math.random() * 6.283, 0.05, 0.015], { minPx: 1.4, maxPx: 6, glow: 2.2 });
    this.dyson = new Swarm(scene, 40000, "#ffcf7a", () => {
      const u = Math.random() * 2 - 1;
      return [1.4 + Math.random() * 1.1, Math.acos(u), Math.random() * 6.283, Math.random() * 6.283, 0.04 + Math.random() * 0.05, 0.02];
    }, { minPx: 1, maxPx: 4, glow: 1.3 });

    // ISS: truss, modules and solar wings
    const metal = new MeshStandardMaterial({ color: 0xd8d8d8, metalness: 0.6, roughness: 0.4 });
    const panel = new MeshStandardMaterial({ color: 0x2a3d7a, metalness: 0.3, roughness: 0.5, emissive: 0x0a1230 });
    this.iss = new Group();
    this.iss.add(new Mesh(new BoxGeometry(1.1, 0.04, 0.04), metal));
    const mod = new Mesh(new CylinderGeometry(0.05, 0.05, 0.5, 12), metal); mod.rotation.x = Math.PI / 2; this.iss.add(mod);
    for (const x of [-0.45, -0.3, 0.3, 0.45]) for (const z of [-0.18, 0.18]) { const p = new Mesh(new BoxGeometry(0.12, 0.005, 0.32), panel); p.position.set(x, 0, z); this.iss.add(p); }
    this.iss.scale.setScalar(0.02);
    this.iss.visible = false;
    scene.add(this.iss);

    // Space elevator: tether from the equator to a counterweight station (lives in Earth's spinning frame)
    const earthView = system.views.get("earth")!;
    this.elevator = new Group();
    const tether = new Mesh(new CylinderGeometry(0.0025, 0.0025, 1, 6), new MeshBasicMaterial({ color: 0xbfd8ff }));
    tether.rotation.z = Math.PI / 2; tether.position.x = 1.6; tether.scale.y = 1.2;
    const station = new Mesh(new BoxGeometry(0.06, 0.04, 0.04), new MeshBasicMaterial({ color: 0xfff1d0 }));
    station.position.x = 2.2;
    const climber = new Mesh(new BoxGeometry(0.015, 0.015, 0.015), new MeshBasicMaterial({ color: 0xffe0a0 }));
    climber.name = "climber";
    this.elevator.add(tether, station, climber);
    this.elevator.scale.setScalar(earthView.body.radius);
    this.elevator.visible = false;
    earthView.spin.add(this.elevator);

    // Orbital ring around Earth's equator
    this.ringHab = new Mesh(new TorusGeometry(1.22, 0.006, 8, 256), new MeshBasicMaterial({ color: 0xffe2b0 }));
    this.ringHab.rotation.x = Math.PI / 2;
    this.ringHab.scale.setScalar(earthView.body.radius);
    this.ringHab.visible = false;
    earthView.tilt.add(this.ringHab);

    // Ceres mining station
    this.ceresStation = new Mesh(new TorusGeometry(1, 0.15, 8, 32), new MeshStandardMaterial({ color: 0xcfc6b0, metalness: 0.7, roughness: 0.35, emissive: 0x332211 }));
    this.ceresStation.visible = false;
    scene.add(this.ceresStation);

    // Generation ship with a long fusion plume
    this.ark = new Group();
    const hull = new Mesh(new CylinderGeometry(0.08, 0.12, 1, 12), new MeshStandardMaterial({ color: 0xc9ced8, metalness: 0.7, roughness: 0.3 }));
    hull.rotation.z = Math.PI / 2;
    const plume = new Mesh(new ConeGeometry(0.18, 2.6, 16, 1, true), new MeshBasicMaterial({ color: 0x9fc2ff, transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false }));
    plume.rotation.z = Math.PI / 2; plume.position.x = -1.8;
    this.ark.add(hull, plume);
    this.ark.visible = false;
    scene.add(this.ark);
  }

  private buildVoyagers(mode: ScaleMode) {
    for (const v of this.voyagers) { this.scene.remove(v.line, v.marker); v.line.geometry.dispose(); }
    this.voyagers = [];
    const earth = PLANETS.find(p => p.id === "earth")!.orbit;
    for (const V of VOYAGERS) {
      const knots: { day: number; p: V3 }[] = [];
      const ld = dayFromISO(V.launch);
      knots.push({ day: ld, p: heliocentric(earth, ld, { x: 0, y: 0, z: 0 }) });
      for (const [pid, date] of V.flybys) {
        const d = dayFromISO(date);
        knots.push({ day: d, p: heliocentric(PLANETS.find(p => p.id === pid)!.orbit, d, { x: 0, y: 0, z: 0 }) });
      }
      const dir = eclipticDir(V.lon, V.lat, { x: 0, y: 0, z: 0 });
      const ecl = { x: dir.x, y: -dir.z, z: dir.y }; // eclipticDir returns scene axes; convert back to ecliptic
      const nowDay = (V.now - 2000) * 365.25;
      knots.push({ day: nowDay, p: { x: ecl.x * V.auNow, y: ecl.y * V.auNow, z: ecl.z * V.auNow } });
      const samples: number[] = [];
      const pts: number[] = [];
      const out = { x: 0, y: 0, z: 0 };
      const view: VoyagerView = { id: V.id, name: V.name, knots, dir: ecl, speed: V.speed, marker: null!, line: null!, samples, pos: new Vector3() };
      for (let k = 0; k <= 600; k++) {
        const d = ld + (k / 600) * (dayFromISO("2600-01-01") - ld);
        samples.push(d);
        eclipticToScene(this.voyagerAU(view, d), mode, out);
        pts.push(out.x, out.y, out.z);
      }
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
      view.line = new Line(g, new LineBasicMaterial({ color: 0xd9a64a, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false }));
      view.line.frustumCulled = false;
      view.marker = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: 0xfff1c4 }));
      this.scene.add(view.line, view.marker);
      this.voyagers.push(view);
    }
    this.builtMode = mode;
  }

  private voyagerAU(v: VoyagerView, day: number): V3 {
    const k = v.knots;
    if (day <= k[0].day) return k[0].p;
    for (let i = 1; i < k.length; i++) {
      if (day < k[i].day) {
        const f = (day - k[i - 1].day) / (k[i].day - k[i - 1].day);
        const a = k[i - 1].p, b = k[i].p;
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
      }
    }
    const last = k[k.length - 1], au = ((day - last.day) / 365.25) * v.speed;
    return { x: last.p.x + v.dir.x * au, y: last.p.y + v.dir.y * au, z: last.p.z + v.dir.z * au };
  }

  voyagerPos(id: string) { return this.voyagers.find(v => v.id === id)?.pos; }

  update(ctx: FrameCtx, labels: Labels, focus: string, dysonStart: number) {
    const { world, camera, year } = ctx;
    const B = world.bodies;
    const earth = B.get("earth")!;
    if (this.builtMode !== world.settings.scale) this.buildVoyagers(world.settings.scale);
    const camDist = (b: Body) => camera.position.distanceTo(b.pos);
    const near = (b: Body, k: number) => camDist(b) < b.radius * k;
    const screenScale = (p: Vector3, px: number) => Math.max(1e-4, (camera.position.distanceTo(p) * px) / ctx.px);

    // Satellites around Earth
    this.sats.place(earth, table(SAT_COUNT, year), ctx);

    // Probes at other worlds
    const day = world.day;
    this.probePositions = [];
    const pp = this.probes.geometry.getAttribute("position") as BufferAttribute;
    PROBES.forEach((p, i) => {
      const on = day >= dayFromISO(p.from) && (!p.to || day < dayFromISO(p.to));
      if (!on) return;
      const b = B.get(p.body)!;
      const a = i * 1.7 + p.speed * ctx.vis;
      const pos = new Vector3().copy(b.pos)
        .addScaledVector(b.eqU, Math.cos(a) * p.r * b.radius)
        .addScaledVector(b.eqV, Math.sin(a) * Math.cos(p.inc) * p.r * b.radius)
        .addScaledVector(b.axis, Math.sin(a) * Math.sin(p.inc) * p.r * b.radius);
      pp.setXYZ(this.probePositions.length, pos.x, pos.y, pos.z);
      this.probePositions.push({ name: p.name, pos, body: p.body });
      if (B.systemOf(focus) === B.systemOf(p.body) && near(b, 40)) labels.put("probe-" + i, pos, `<span class="dot-probe"></span>${p.name}`, { cls: "tiny" });
    });
    this.probes.geometry.setDrawRange(0, this.probePositions.length);
    pp.needsUpdate = true;

    // ISS
    const issOn = year >= 1998.9;
    this.iss.visible = issOn && near(earth, 30);
    if (this.iss.visible) {
      const a = ctx.vis * 0.45;
      const inc = (51.6 * Math.PI) / 180;
      v1.copy(earth.eqU).multiplyScalar(Math.cos(a)).addScaledVector(earth.eqV, Math.sin(a) * Math.cos(inc)).addScaledVector(earth.axis, Math.sin(a) * Math.sin(inc));
      this.iss.position.copy(earth.pos).addScaledVector(v1, earth.radius * 1.065);
      this.iss.lookAt(earth.pos);
      this.iss.scale.setScalar(Math.max(0.0035, screenScale(this.iss.position, 9)));
      labels.put("iss", this.iss.position, "ISS", { cls: "tiny" });
    }

    // Space elevator and orbital ring
    this.elevator.visible = year >= 2095;
    if (this.elevator.visible) {
      const climber = this.elevator.getObjectByName("climber")!;
      climber.position.x = 1 + ((ctx.vis * 0.08) % 1) * 1.2;
    }
    this.ringHab.visible = year >= 2180;
    if (this.ringHab.visible) (this.ringHab.material as MeshBasicMaterial).color.setScalar(1.4);

    // Venus cloud cities
    const venus = B.get("venus")!;
    this.venusCities.place(venus, year >= 2070 ? Math.min(60, 6 + (year - 2070) * 0.8) : 0, ctx);

    // Ceres station
    const ceres = B.get("ceres")!;
    this.ceresStation.visible = year >= 2060;
    if (this.ceresStation.visible) {
      const a = ctx.vis * 0.4;
      this.ceresStation.position.copy(ceres.pos).add(v2.set(Math.cos(a), 0.2, Math.sin(a)).multiplyScalar(ceres.radius * 2.2));
      this.ceresStation.scale.setScalar(Math.max(ceres.radius * 0.25, screenScale(this.ceresStation.position, 4)));
      this.ceresStation.rotation.y += ctx.dt * 0.6;
      if (near(ceres, 60)) labels.put("ceres-station", this.ceresStation.position, "Mining station", { cls: "tiny" });
    }

    // Dyson swarm (dims the Sun as it grows)
    const dysonN = year >= dysonStart ? Math.min(40000, Math.pow(year - dysonStart, 1.7) * 25 + 200) : 0;
    this.dyson.place(B.get("sun")!, dysonN, ctx, SUN_RADIUS);

    // Voyagers
    for (const v of this.voyagers) {
      const launched = day >= v.knots[0].day;
      v.marker.visible = v.line.visible = launched;
      if (!launched) continue;
      eclipticToScene(this.voyagerAU(v, day), world.settings.scale, v.pos);
      v.marker.position.copy(v.pos);
      v.marker.scale.setScalar(screenScale(v.pos, 4));
      let n = 0; while (n < v.samples.length && v.samples[n] <= day) n++;
      v.line.geometry.setDrawRange(0, n);
      (v.line.material as LineBasicMaterial).opacity = focus === v.id ? 0.6 : 0.14;
      labels.put(v.id, v.pos, v.name, { cls: "small voyager", dy: -14 });
    }

    // Generation ship
    this.ark.visible = year >= 2520;
    if (this.ark.visible) {
      const t = year - 2520;
      const dir = eclipticDir(239.5, -42.6, { x: 0, y: 0, z: 0 });
      const au = 1 + 0.6 * t * t;
      const start = { x: 0, y: 0, z: 0 };
      heliocentric(PLANETS.find(p => p.id === "earth")!.orbit, dayFromISO("2520-01-01"), start);
      const ecl = { x: start.x + dir.x * au, y: start.y - dir.z * au, z: start.z + dir.y * au };
      eclipticToScene(ecl, world.settings.scale, this.arkPos);
      this.ark.position.copy(this.arkPos);
      v1.set(dir.x, dir.y, dir.z);
      q.setFromUnitVectors(new Vector3(1, 0, 0), v1);
      this.ark.quaternion.copy(q);
      this.ark.scale.setScalar(screenScale(this.arkPos, 14));
      labels.put("ark", this.arkPos, "Generation ship", { cls: "small voyager", dy: -16 });
    }
    void UP; void yearOf;
  }
}
