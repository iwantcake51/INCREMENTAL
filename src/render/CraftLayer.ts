import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, Points, PointsMaterial,
  SphereGeometry, Vector3, type Scene,
} from "three";
import { CRAFT, type Craft } from "../data/spacecraft";
import type { Bodies } from "../sim/bodies";
import { arcPoint } from "../sim/civ";
import { dayFromISO } from "../sim/time";
import type { Labels } from "./Labels";
import type { FrameCtx } from "./SolarSystem";

const metal = new MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.65, roughness: 0.35 });
const gold = new MeshStandardMaterial({ color: 0xd8a640, metalness: 0.9, roughness: 0.3, emissive: 0x2a1a00 });
const panel = new MeshStandardMaterial({ color: 0x23366e, metalness: 0.3, roughness: 0.45, emissive: 0x070c22 });

/** Small but recognizable models, all about 1 unit across. */
function model(c: Craft): Group {
  const g = new Group();
  const add = (geo: BufferGeometry, mat: MeshStandardMaterial, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
    const m = new Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, 0, rz); g.add(m); return m;
  };
  if (c.kind === "station") {
    add(new BoxGeometry(1.1, 0.04, 0.04), metal);
    add(new CylinderGeometry(0.06, 0.06, 0.5, 12), metal, 0, 0, 0, Math.PI / 2);
    const wings = c.massKg > 100000 ? [-0.48, -0.32, 0.32, 0.48] : [-0.35, 0.35];
    for (const x of wings) for (const z of [-0.2, 0.2]) add(new BoxGeometry(0.13, 0.006, 0.34), panel, x, 0, z);
  } else if (c.kind === "telescope") {
    if (c.id === "jwst") {
      for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; add(new CylinderGeometry(0.09, 0.09, 0.02, 6), gold, Math.cos(a) * 0.2, 0.15, Math.sin(a) * 0.2, 0, 0); }
      add(new BoxGeometry(1.1, 0.01, 0.6), new MeshStandardMaterial({ color: 0xc9a7d6, metalness: 0.8, roughness: 0.25 }), 0, -0.05, 0);
    } else {
      add(new CylinderGeometry(0.12, 0.12, 0.6, 16), metal, 0, 0, 0, 0, Math.PI / 2);
      add(new BoxGeometry(0.2, 0.005, 0.6), panel, 0, 0.16, 0);
    }
  } else if (c.kind === "probe") {
    add(new BoxGeometry(0.25, 0.2, 0.25), gold);
    add(new CylinderGeometry(0.28, 0.05, 0.08, 20), metal, 0, 0.18, 0);
    add(new BoxGeometry(0.9, 0.005, 0.18), panel);
  } else if (c.kind === "satellite") {
    add(new SphereGeometry(0.15, 16, 12), metal);
    for (let i = 0; i < 4; i++) add(new CylinderGeometry(0.006, 0.006, 0.8, 4), metal, -0.3, 0, (i - 1.5) * 0.04, 0, Math.PI / 2 + 0.2);
  }
  return g;
}

interface CraftView { craft: Craft; obj: Group | null; pos: Vector3; active: boolean; launch: number; arrive: number; end: number; phase: number }

/**
 * Real spacecraft on their real dates: Sputnik, stations, telescopes, probes en route and in orbit, and landing sites.
 * Every one can be clicked for its story.
 */
export class CraftLayer {
  readonly views: CraftView[];
  private dots: Points;
  private sites: Points;

  constructor(scene: Scene) {
    this.views = CRAFT.map((c, i) => {
      const obj = c.kind === "landing" ? null : model(c);
      if (obj) { obj.visible = false; scene.add(obj); }
      return { craft: c, obj, pos: new Vector3(), active: false, launch: dayFromISO(c.launch), arrive: dayFromISO(c.arrive ?? c.launch), end: c.end ? dayFromISO(c.end) : Infinity, phase: i * 1.37 };
    });
    const mk = (n: number, color: number, size: number) => {
      const g = new BufferGeometry();
      g.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
      const p = new Points(g, new PointsMaterial({ color, size, sizeAttenuation: false, transparent: true, blending: AdditiveBlending, depthWrite: false }));
      p.frustumCulled = false; scene.add(p); return p;
    };
    this.dots = mk(CRAFT.length, 0xfff0c8, 3.5);
    this.sites = mk(CRAFT.length, 0x9fe7ff, 4);
  }

  get(id: string) { return this.views.find(v => v.craft.id === id); }

  update(ctx: FrameCtx, labels: Labels, focus: string, onSelect: (id: string) => void) {
    const { world, camera } = ctx;
    const B: Bodies = world.bodies;
    const day = world.day;
    const dp = this.dots.geometry.getAttribute("position") as BufferAttribute;
    const sp = this.sites.geometry.getAttribute("position") as BufferAttribute;
    let nd = 0, ns = 0;
    for (const v of this.views) {
      const c = v.craft;
      v.active = day >= v.launch && day < v.end;
      if (!v.active) { if (v.obj) v.obj.visible = false; continue; }
      const earth = B.get("earth")!;
      const home = c.body === "sun-l2" ? earth : B.get(c.body)!;
      let near = camera.position.distanceTo(home.pos) < home.radius * 40;
      if (c.kind === "landing") {
        if (day < v.arrive) { v.active = false; continue; }
        const lat = (c.site!.lat * Math.PI) / 180, lon = (c.site!.lon * Math.PI) / 180;
        B.localToWorld(home, { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: -Math.cos(lat) * Math.sin(lon) }, v.pos);
        v.pos.multiplyScalar(home.radius * 1.003).add(home.pos);
        near = camera.position.distanceTo(home.pos) < home.radius * 8;
        if (near) { sp.setXYZ(ns++, v.pos.x, v.pos.y, v.pos.z); labels.put("craft-" + c.id, v.pos, c.name, { cls: "tiny site", onClick: () => onSelect(c.id) }); }
        continue;
      }
      if (day < v.arrive && c.body !== "earth") {
        // Cruising from Earth to its destination
        const f = (day - v.launch) / Math.max(1, v.arrive - v.launch);
        arcPoint(earth.pos, earth.radius, home.pos, home.radius, f, v.pos);
        near = camera.position.distanceTo(v.pos) < 30;
      } else if (c.body === "sun-l2") {
        // Sun–Earth L2: straight out from Earth, away from the Sun, with a slow halo orbit around the point
        const out = new Vector3().copy(earth.pos).normalize();
        const moon = B.get("moon")!;
        v.pos.copy(earth.pos).addScaledVector(out, moon.orbitR * 1.6);
        v.pos.addScaledVector(earth.axis, Math.sin(ctx.vis * 0.2 + v.phase) * 0.25);
      } else {
        const o = c.orbit!;
        const a = v.phase + o.speed * ctx.vis;
        const inc = (o.inc * Math.PI) / 180;
        const r = o.r * home.radius;
        v.pos.copy(home.pos)
          .addScaledVector(home.eqU, Math.cos(a) * r)
          .addScaledVector(home.eqV, Math.sin(a) * Math.cos(inc) * r)
          .addScaledVector(home.axis, Math.sin(a) * Math.sin(inc) * r);
      }
      dp.setXYZ(nd++, v.pos.x, v.pos.y, v.pos.z);
      if (v.obj) {
        const d = camera.position.distanceTo(v.pos);
        v.obj.visible = d < home.radius * 12 || focus === c.id;
        if (v.obj.visible) {
          v.obj.position.copy(v.pos);
          v.obj.lookAt(home.pos);
          v.obj.scale.setScalar(Math.max(home.radius * 0.004, (d * 10) / ctx.px));
        }
      }
      if (near || focus === c.id) labels.put("craft-" + c.id, v.pos, c.name, { cls: "tiny craft" + (focus === c.id ? " selected" : ""), onClick: () => onSelect(c.id) });
    }
    this.dots.geometry.setDrawRange(0, nd); dp.needsUpdate = true;
    this.sites.geometry.setDrawRange(0, ns); sp.needsUpdate = true;
  }
}
