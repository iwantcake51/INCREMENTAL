import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, DynamicDrawUsage, InstancedMesh, LineBasicMaterial,
  LineSegments, Matrix4, Mesh, MeshBasicMaterial, Points, PointsMaterial, Quaternion, SphereGeometry, Vector3, type Scene,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { FACTIONS } from "../data/timeline";
import type { Weapon } from "../sim/events";
import type { Effects } from "./Effects";
import type { Labels } from "./Labels";
import type { FrameCtx } from "./SolarSystem";
import { fresnelMaterial } from "./shaders/space";

const MAX_SHIPS = 260, MAX_FREIGHT = 40, MAX_TRACERS = 700;
const m4 = new Matrix4(), qq = new Quaternion(), sc = new Vector3(), p = new Vector3(), right = new Vector3(), upv = new Vector3(), fwd = new Vector3();
const X = new Vector3(1, 0, 0), WORLD_UP = new Vector3(0, 1, 0);
const col = new Color();

interface Tracer { from: Vector3; to: Vector3; color: Color; weapon: Weapon; t: number; life: number; done: boolean }

function shipGeometry() {
  const body = new ConeGeometry(0.28, 1.4, 6); body.rotateZ(-Math.PI / 2);
  const wing = new BoxGeometry(0.5, 0.05, 1.1); wing.translate(-0.3, 0, 0);
  const fin = new BoxGeometry(0.4, 0.45, 0.05); fin.translate(-0.4, 0.2, 0);
  return mergeGeometries([body.toNonIndexed(), wing.toNonIndexed(), fin.toNonIndexed()])!;
}
function freighterGeometry() {
  const hull = new BoxGeometry(1.2, 0.35, 0.35);
  const pods = new BoxGeometry(0.6, 0.5, 0.6); pods.translate(-0.1, 0, 0);
  return mergeGeometries([hull.toNonIndexed(), pods.toNonIndexed()])!;
}

export function engineColor(year: number) {
  return year >= 2200 ? "#c79bff" : year >= 2110 ? "#9fd0ff" : "#ffb062";
}

/**
 * Fleets, freighters, weapon fire and colony markers. Ships keep a constant on-screen size so you can follow a
 * war from the whole-system view, and every fleet has a label saying who it belongs to and where it is going.
 */
export class WarLayer {
  private ships: InstancedMesh;
  private freight: InstancedMesh;
  private engines: Points;
  private engineGeo = new BufferGeometry();
  private tracers: Tracer[] = [];
  private tracerLines: LineSegments;
  private intentLines: LineSegments;
  private shields: Mesh[] = [];

  constructor(scene: Scene, private fx: Effects) {
    this.ships = new InstancedMesh(shipGeometry(), new MeshBasicMaterial({ color: 0xffffff }), MAX_SHIPS);
    this.ships.instanceMatrix.setUsage(DynamicDrawUsage);
    this.ships.count = 0;
    this.ships.frustumCulled = false;
    this.freight = new InstancedMesh(freighterGeometry(), new MeshBasicMaterial({ color: 0xffffff }), MAX_FREIGHT);
    this.freight.count = 0;
    this.freight.frustumCulled = false;
    for (let i = 0; i < MAX_SHIPS; i++) this.ships.setColorAt(i, col.set("#ffffff"));
    for (let i = 0; i < MAX_FREIGHT; i++) this.freight.setColorAt(i, col.set("#d7d2c4"));

    const n = MAX_SHIPS + MAX_FREIGHT;
    this.engineGeo.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3).setUsage(DynamicDrawUsage));
    this.engines = new Points(this.engineGeo, new PointsMaterial({ size: 5, sizeAttenuation: false, color: 0xffb062, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    this.engines.frustumCulled = false;

    const tg = new BufferGeometry();
    tg.setAttribute("position", new BufferAttribute(new Float32Array(MAX_TRACERS * 6), 3).setUsage(DynamicDrawUsage));
    tg.setAttribute("color", new BufferAttribute(new Float32Array(MAX_TRACERS * 6), 3).setUsage(DynamicDrawUsage));
    this.tracerLines = new LineSegments(tg, new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    this.tracerLines.frustumCulled = false;
    this.tracerLines.renderOrder = 7;

    const ig = new BufferGeometry();
    ig.setAttribute("position", new BufferAttribute(new Float32Array(64 * 6), 3).setUsage(DynamicDrawUsage));
    ig.setAttribute("color", new BufferAttribute(new Float32Array(64 * 6), 3).setUsage(DynamicDrawUsage));
    this.intentLines = new LineSegments(ig, new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    this.intentLines.frustumCulled = false;

    const sg = new SphereGeometry(1, 48, 32);
    for (let i = 0; i < 6; i++) { const s = new Mesh(sg, fresnelMaterial("#8fd8ff")); s.visible = false; s.renderOrder = 4; this.shields.push(s); scene.add(s); }
    scene.add(this.ships, this.freight, this.engines, this.tracerLines, this.intentLines);
  }

  shot(from: Vector3, to: Vector3, color: string, weapon: Weapon) {
    if (this.tracers.length >= MAX_TRACERS) this.tracers.shift();
    const life = weapon === "laser" ? 0.22 : weapon === "missile" ? 0.8 : weapon === "lance" ? 0.12 : 0.38;
    this.tracers.push({ from, to, color: new Color(color), weapon, t: 0, life, done: false });
    if (weapon === "laser") this.fx.burst(to, color, 6, 0.08, 0.02, 0.4);
  }

  clear() { this.tracers = []; }

  update(ctx: FrameCtx, labels: Labels, onFocus: (id: string) => void) {
    const { world, camera, year, dt } = ctx;
    const civ = world.civ, B = world.bodies;
    const pxScale = (pos: Vector3, px: number) => (camera.position.distanceTo(pos) * px) / ctx.px;
    const enginePos = this.engineGeo.getAttribute("position") as BufferAttribute;
    let e = 0;

    // Warships in formation, colored by faction
    let n = 0;
    const intent = this.intentLines.geometry;
    const ip = intent.getAttribute("position") as BufferAttribute, ic = intent.getAttribute("color") as BufferAttribute;
    let li = 0;
    for (const f of civ.fleets) {
      const fac = FACTIONS[f.fac];
      col.set(fac.color);
      const s = Math.max(0.004, pxScale(f.pos, 9));
      fwd.copy(f.dir);
      right.crossVectors(fwd, WORLD_UP).normalize();
      if (right.lengthSq() < 1e-6) right.set(0, 0, 1);
      upv.crossVectors(right, fwd).normalize();
      qq.setFromUnitVectors(X, fwd);
      for (let k = 0; k < f.ships && n < MAX_SHIPS; k++) {
        const row = Math.ceil(k / 2), side = k === 0 ? 0 : k % 2 ? 1 : -1;
        p.copy(f.pos).addScaledVector(fwd, -row * s * 2.2).addScaledVector(right, side * row * s * 1.6).addScaledVector(upv, Math.sin(ctx.t * 2 + k) * s * 0.15);
        m4.compose(p, qq, sc.setScalar(s));
        this.ships.setMatrixAt(n, m4);
        this.ships.setColorAt(n, col);
        n++;
        if (e < MAX_SHIPS) { p.addScaledVector(fwd, -s * 0.9); enginePos.setXYZ(e++, p.x, p.y, p.z); }
      }
      // Dashed intent line from the fleet to its target
      if (li < 64 && f.state === "transit") {
        const T = B.get(civ.colony(f.target).body)!.pos;
        ip.setXYZ(li * 2, f.pos.x, f.pos.y, f.pos.z); ip.setXYZ(li * 2 + 1, T.x, T.y, T.z);
        ic.setXYZ(li * 2, col.r * 0.5, col.g * 0.5, col.b * 0.5); ic.setXYZ(li * 2 + 1, col.r * 0.05, col.g * 0.05, col.b * 0.05);
        li++;
      }
      const verb = f.state === "clash" ? "⚔ Fleet battle" : f.state === "siege" ? `⚔ Attacking ${civ.colony(f.target).name}` : f.kind === "intercept" ? "Intercepting" : `→ ${civ.colony(f.target).name}`;
      labels.put("fleet-" + f.id, f.pos, `<i style="background:${fac.color}"></i>${fac.short} · ${f.ships} ship${f.ships === 1 ? "" : "s"} <b>${verb}</b>`,
        { cls: "fleet" + (f.state !== "transit" ? " fighting" : ""), dy: -18, onClick: () => onFocus(civ.colony(f.target).body) });
    }
    this.ships.count = n;
    this.ships.instanceMatrix.needsUpdate = true;
    if (this.ships.instanceColor) this.ships.instanceColor.needsUpdate = true;
    intent.setDrawRange(0, li * 2);
    ip.needsUpdate = ic.needsUpdate = true;

    // Freighters
    let fn = 0;
    for (const f of civ.freighters) {
      if (fn >= MAX_FREIGHT) break;
      const s = Math.max(0.003, pxScale(f.pos, 5));
      qq.setFromUnitVectors(X, f.dir);
      m4.compose(f.pos, qq, sc.setScalar(s));
      this.freight.setMatrixAt(fn++, m4);
      if (e < MAX_SHIPS + MAX_FREIGHT) { p.copy(f.pos).addScaledVector(f.dir, -s * 0.8); enginePos.setXYZ(e++, p.x, p.y, p.z); }
    }
    this.freight.count = fn;
    this.freight.instanceMatrix.needsUpdate = true;
    this.engineGeo.setDrawRange(0, e);
    enginePos.needsUpdate = true;
    (this.engines.material as PointsMaterial).color.set(engineColor(year)).multiplyScalar(1.6);

    // Weapon fire
    const tp = this.tracerLines.geometry.getAttribute("position") as BufferAttribute;
    const tc = this.tracerLines.geometry.getAttribute("color") as BufferAttribute;
    let ti = 0;
    for (const r of this.tracers) {
      r.t += dt;
      const k = Math.min(1, r.t / r.life);
      let a: Vector3, b: Vector3, bright: number;
      if (r.weapon === "laser") { a = r.from; b = r.to; bright = (1 - k) * 2.2 * (0.7 + 0.3 * Math.sin(r.t * 90)); }
      else if (r.weapon === "missile") {
        const lift = r.from.distanceTo(r.to) * 0.25;
        const pt = (u: number, out: Vector3) => out.lerpVectors(r.from, r.to, u).addScaledVector(WORLD_UP, Math.sin(Math.PI * u) * lift);
        a = pt(Math.max(0, k - 0.18), new Vector3()); b = pt(k, new Vector3()); bright = 1.8;
      } else {
        const len = r.weapon === "lance" ? 0.6 : 0.12;
        a = new Vector3().lerpVectors(r.from, r.to, Math.max(0, k - len)); b = new Vector3().lerpVectors(r.from, r.to, k);
        bright = r.weapon === "lance" ? 3 : 1.6;
      }
      if (ti < MAX_TRACERS) {
        const c = r.weapon === "lance" ? col.set("#cfe6ff") : col.copy(r.color);
        tp.setXYZ(ti * 2, a.x, a.y, a.z); tp.setXYZ(ti * 2 + 1, b.x, b.y, b.z);
        tc.setXYZ(ti * 2, c.r * bright * 0.25, c.g * bright * 0.25, c.b * bright * 0.25); tc.setXYZ(ti * 2 + 1, c.r * bright, c.g * bright, c.b * bright);
        ti++;
      }
      if (k >= 1 && !r.done) {
        r.done = true;
        if (r.weapon === "missile") this.fx.blast(r.to, "#" + r.color.getHexString(), 0.35);
        else if (r.weapon === "lance") this.fx.blast(r.to, "#cfe6ff", 0.25);
        else if (r.weapon === "coil") this.fx.burst(r.to, "#" + r.color.getHexString(), 8, 0.12, 0.02, 0.5);
      }
    }
    this.tracers = this.tracers.filter(r => !r.done || r.t < r.life + 0.02);
    this.tracerLines.geometry.setDrawRange(0, ti * 2);
    tp.needsUpdate = tc.needsUpdate = true;

    // Shields flicker around colonies under siege once shield tech exists (2300+)
    let si = 0;
    for (const c of civ.colonies) {
      if (!c.active || c.siege <= 0 || si >= this.shields.length) continue;
      const b = B.get(c.body)!;
      const s = this.shields[si++];
      s.visible = year >= 2300 || c.siege > 0;
      s.position.copy(b.pos);
      s.scale.setScalar(b.radius * (year >= 2300 ? 1.5 : 1.25));
      const u = (s.material as any).uniforms;
      u.uColor.value.set(year >= 2300 ? "#8fd8ff" : FACTIONS[c.owner].color);
      u.uAlpha.value = (year >= 2300 ? 1.2 : 0.5) * (0.6 + 0.4 * Math.sin(ctx.t * 20 + si));
    }
    for (; si < this.shields.length; si++) this.shields[si].visible = false;
  }
}
