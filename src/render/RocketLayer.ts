import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ConeGeometry, DynamicDrawUsage, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, MeshBasicMaterial, Points, PointsMaterial, Quaternion, Vector3, type Scene } from "three";
import { FAILURE_RATE, LAUNCH_SITES, LAUNCHES_PER_YEAR } from "../data/spacecraft";
import { SETTLEMENT_SITES } from "../data/timeline";
import type { Body } from "../sim/bodies";
import { arcPoint } from "../sim/civ";
import { dayFromISO } from "../sim/time";
import type { World } from "../sim/world";
import type { Effects } from "./Effects";
import { engineColor } from "./WarLayer";
import type { FrameCtx } from "./SolarSystem";

const MAX = 32, TRAIL = 36;
const table = (t: [number, number][], x: number) => {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) if (x < t[i][0]) { const [x0, y0] = t[i - 1], [x1, y1] = t[i]; return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0); }
  return t[t.length - 1][1];
};
// Before Sputnik, rockets only flew up and back down: V-2 tests, then sounding rockets and missiles.
const EARLY_SITES = [
  { name: "Peenemünde", lat: 54.15, lon: 13.79, from: 1944, to: 1945.3 },
  { name: "White Sands", lat: 32.38, lon: -106.48, from: 1946, to: 9999 },
  { name: "Kapustin Yar", lat: 48.57, lon: 46.3, from: 1947.8, to: 9999 },
  { name: "Cape Canaveral", lat: 28.47, lon: -80.55, from: 1950.5, to: 9999 },
  { name: "Baikonur", lat: 45.92, lon: 63.34, from: 1957.3, to: 9999 },
];
const FIRST_SPACE_ROCKET = dayFromISO("1944-06-20");

type Kind = "suborbital" | "orbit" | "escape";
interface Rocket {
  body: Body; lat: number; lon: number; heading: number; kind: Kind; target?: Body;
  t: number; dur: number; failAt: number; crash: boolean; done: boolean; fade: number;
  pos: Vector3; dir: Vector3; trail: Vector3[];
}

const v1 = new Vector3(), v2 = new Vector3(), east = new Vector3(), north = new Vector3(), up = new Vector3();
const m4 = new Matrix4(), q = new Quaternion(), sc = new Vector3(), Y = new Vector3(0, 1, 0);

/**
 * Rocket launches you can watch. The launch rate follows the real record (3 in 1957, over 300 a year by 2025),
 * failures follow each era's real failure rate, and now and then a probe misses and crashes into a world.
 */
export class RocketLayer {
  private rockets: Rocket[] = [];
  private acc = 0;
  private lastDay = NaN;
  private bodiesMesh: InstancedMesh;
  private glow: Points;
  private trails: LineSegments;

  constructor(scene: Scene, private world: World, private fx: Effects) {
    const cone = new ConeGeometry(0.18, 1, 8); cone.rotateZ(-Math.PI / 2);
    this.bodiesMesh = new InstancedMesh(cone, new MeshBasicMaterial({ color: 0xf2f2f2 }), MAX);
    this.bodiesMesh.count = 0; this.bodiesMesh.frustumCulled = false;
    const gg = new BufferGeometry();
    gg.setAttribute("position", new BufferAttribute(new Float32Array(MAX * 3), 3).setUsage(DynamicDrawUsage));
    this.glow = new Points(gg, new PointsMaterial({ size: 4, sizeAttenuation: false, color: 0xffb062, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    this.glow.frustumCulled = false;
    const tg = new BufferGeometry();
    tg.setAttribute("position", new BufferAttribute(new Float32Array(MAX * TRAIL * 6), 3).setUsage(DynamicDrawUsage));
    tg.setAttribute("color", new BufferAttribute(new Float32Array(MAX * TRAIL * 6), 3).setUsage(DynamicDrawUsage));
    this.trails = new LineSegments(tg, new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    this.trails.frustumCulled = false;
    scene.add(this.bodiesMesh, this.glow, this.trails);
  }

  private launch(kind: Kind, site: { lat: number; lon: number }, body: Body, target?: Body, supply = false) {
    if (this.rockets.length >= MAX) return;
    const year = this.world.year;
    const fail = Math.random() < table(FAILURE_RATE, year);
    const dur = kind === "suborbital" ? 2.6 : kind === "orbit" ? 4.2 : 7.5;
    this.rockets.push({
      body, lat: site.lat, lon: site.lon, heading: (Math.random() - 0.3) * 0.9, kind, target,
      t: 0, dur, failAt: fail ? dur * (0.12 + Math.random() * 0.5) : Infinity,
      crash: kind === "escape" && !supply && Math.random() < 0.06, done: false, fade: 1,
      pos: new Vector3(), dir: new Vector3(), trail: [],
    });
  }

  /** Position along the flight, rotating with the planet it launched from. */
  private place(r: Rocket, s: number, out: Vector3) {
    const b = r.body;
    const lat = (r.lat * Math.PI) / 180, lon = (r.lon * Math.PI) / 180;
    up.set(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
    east.set(-Math.sin(lon), 0, -Math.cos(lon));
    north.crossVectors(up, east);
    const head = v1.copy(east).multiplyScalar(Math.cos(r.heading)).addScaledVector(north, Math.sin(r.heading));
    let range: number, alt: number;
    if (r.kind === "suborbital") { range = 0.05 * s; alt = 0.028 * 4 * s * (1 - s); }
    else { const k = r.kind === "escape" ? Math.min(1, s / 0.35) : s; range = Math.pow(k, 1.6) * 0.9; alt = 0.065 * (1 - Math.cos(Math.min(1, k * 1.6) * Math.PI / 2)); }
    v2.copy(up).multiplyScalar(Math.cos(range)).addScaledVector(head, Math.sin(range)).normalize().multiplyScalar(1 + alt);
    this.world.bodies.localToWorld(b, v2, out);
    out.multiplyScalar(b.radius).add(b.pos);
    if (r.kind === "escape" && s > 0.35 && r.target) {
      const k = (s - 0.35) / 0.65;
      const arc = arcPoint(b.pos, b.radius * 1.07, r.target.pos, r.target.radius * (r.crash ? 0.3 : 1), k, v2);
      out.lerp(arc, Math.min(1, k * 3));
    }
    return out;
  }

  update(ctx: FrameCtx) {
    const w = this.world, B = w.bodies, year = ctx.year;
    const earth = B.get("earth")!;
    const dtDays = Number.isNaN(this.lastDay) ? 0 : w.day - this.lastDay;
    // The first rocket to reach space, on its real date
    if (this.lastDay < FIRST_SPACE_ROCKET && w.day >= FIRST_SPACE_ROCKET && dtDays < 30) this.launch("suborbital", EARLY_SITES[0], earth);
    this.lastDay = w.day;
    if (Math.abs(dtDays) > 20) this.rockets = []; // time jumped: flights in progress no longer make sense

    if (w.playing && dtDays > 0 && dtDays < 400) {
      const perYear = year < 1957.75 ? (year < 1946 ? 12 : 30) : table(LAUNCHES_PER_YEAR, year);
      this.acc += Math.min(3 * ctx.dt, (perYear * dtDays) / 365.25);
      while (this.acc >= 1) {
        this.acc -= 1;
        if (year < 1957.75) {
          const sites = EARLY_SITES.filter(s => year >= s.from && year < s.to);
          if (sites.length) this.launch("suborbital", sites[Math.floor(Math.random() * sites.length)], earth);
          continue;
        }
        // Supply runs: cargo rockets between Earth and its settlements, in both directions
        const colonies = w.civ.activeColonies().filter(c => c.body !== "earth");
        if (colonies.length && Math.random() < 0.35) {
          const c = colonies[Math.floor(Math.random() * Math.min(colonies.length, 4))];
          const b = B.get(c.body)!;
          if (Math.random() < 0.55) {
            const s = LAUNCH_SITES.filter(x => year >= x.from);
            this.launch("escape", s[Math.floor(Math.random() * s.length)], earth, b, true);
          } else {
            const site = SETTLEMENT_SITES[c.body] ?? [0, 0];
            this.launch("escape", { lat: site[0], lon: site[1] }, b, earth, true);
          }
          continue;
        }
        if (colonies.length && Math.random() < Math.min(0.45, colonies.length * 0.05)) {
          const c = colonies[Math.floor(Math.random() * colonies.length)];
          const b = B.get(c.body)!;
          this.launch("orbit", { lat: (Math.random() - 0.5) * 60, lon: Math.random() * 360 - 180 }, b);
          continue;
        }
        const sites = LAUNCH_SITES.filter(s => year >= s.from);
        const site = sites[Math.floor(Math.random() * sites.length)];
        const escapeShare = year < 1959 ? 0 : year < 1977 ? 0.08 : year < 2030 ? 0.04 : 0.12;
        if (Math.random() < escapeShare) {
          const dests = year < 1962 ? ["moon"] : year < 2045 ? ["moon", "moon", "mars", "venus", "jupiter"] : ["moon", "mars", "mars", "ceres", "europa", "titan"];
          this.launch("escape", site, earth, B.get(dests[Math.floor(Math.random() * dests.length)])!);
        } else this.launch("orbit", site, earth);
      }
    }

    const bm = this.bodiesMesh, gp = this.glow.geometry.getAttribute("position") as BufferAttribute;
    const tp = this.trails.geometry.getAttribute("position") as BufferAttribute, tc = this.trails.geometry.getAttribute("color") as BufferAttribute;
    let n = 0, li = 0;
    const flame = new Color(engineColor(year));
    for (const r of this.rockets) {
      if (!r.done) {
        r.t += ctx.dt * (w.playing ? 1 : 0);
        const s = Math.min(1, r.t / r.dur);
        const prev = v1.copy(r.pos);
        this.place(r, s, r.pos);
        // Trail points are kept relative to the launch world, so the exhaust travels with it along its orbit.
        const rel = r.pos.clone().sub(r.body.pos);
        if (r.trail.length === 0 || r.trail[r.trail.length - 1].distanceToSquared(rel) > (r.body.radius * 0.004) ** 2) {
          r.trail.push(rel);
          if (r.trail.length > TRAIL) r.trail.shift();
        }
        if (prev.lengthSq() > 0) r.dir.subVectors(r.pos, prev).normalize();
        if (r.t >= r.failAt) {
          // Launch failure: the rocket breaks up
          r.done = true;
          this.fx.blast(r.pos, "#ffb062", r.body.radius * 0.35);
        } else if (s >= 1) {
          r.done = true;
          if (r.crash && r.target) {
            // A probe misses its orbit and hits the surface
            const local = v2.subVectors(r.pos, r.target.pos).normalize().applyQuaternion(q.copy(r.target.quat!).invert());
            w.impacts.crash(r.target.id, [local.x, local.y, local.z], w.day);
            this.fx.blast(r.pos, "#ffd08a", r.target.radius * 0.4);
          }
        }
      } else r.fade -= ctx.dt * 0.6;
      // Draw the rocket and its glowing trail
      if (!r.done && n < MAX) {
        const scale = Math.max(r.body.radius * 0.008, (ctx.camera.position.distanceTo(r.pos) * 6) / ctx.px);
        q.setFromUnitVectors(new Vector3(1, 0, 0), r.dir.lengthSq() > 0 ? r.dir : Y);
        m4.compose(r.pos, q, sc.setScalar(scale));
        bm.setMatrixAt(n, m4);
        gp.setXYZ(n, r.pos.x - r.dir.x * scale, r.pos.y - r.dir.y * scale, r.pos.z - r.dir.z * scale);
        n++;
      }
      // Exhaust glows brightly near the planet; long interplanetary legs stay faint.
      const T = r.trail, k = Math.max(0, r.fade) * (r.kind === "escape" && r.t / r.dur > 0.4 ? 0.3 : 1);
      const o = r.body.pos;
      for (let i = 1; i < T.length && li < MAX * TRAIL; i++) {
        const a = (i / T.length) * k, b2 = ((i - 1) / T.length) * k;
        tp.setXYZ(li * 2, T[i - 1].x + o.x, T[i - 1].y + o.y, T[i - 1].z + o.z); tp.setXYZ(li * 2 + 1, T[i].x + o.x, T[i].y + o.y, T[i].z + o.z);
        tc.setXYZ(li * 2, 0.75 * b2, 0.7 * b2, 0.65 * b2); tc.setXYZ(li * 2 + 1, 0.9 * a, 0.85 * a, 0.8 * a);
        li++;
      }
    }
    this.rockets = this.rockets.filter(r => !r.done || r.fade > 0);
    bm.count = n; bm.instanceMatrix.needsUpdate = true;
    this.glow.geometry.setDrawRange(0, n); gp.needsUpdate = true;
    (this.glow.material as PointsMaterial).color.copy(flame).multiplyScalar(1.8);
    this.trails.geometry.setDrawRange(0, li * 2); tp.needsUpdate = tc.needsUpdate = true;
  }
}
