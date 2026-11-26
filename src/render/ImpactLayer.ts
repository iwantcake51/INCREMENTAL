import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4,
  Mesh, MeshStandardMaterial, Quaternion, RingGeometry, ShaderMaterial, Vector3, type Scene,
} from "three";
import type { World } from "../sim/world";
import type { Effects } from "./Effects";
import type { FrameCtx } from "./SolarSystem";
import { rockGeometry } from "./rocks";
import { boom } from "../ui/sound";

const SIZE: Record<string, number> = { tiny: 0.25, small: 0.6, large: 1.4, huge: 3 };
const MAX_CHUNKS = 160, MAX_ROCKS = 8, TRAIL = 30;
const m4 = new Matrix4(), q = new Quaternion(), s3 = new Vector3(), v = new Vector3(), w2 = new Vector3();

interface Chunk { pos: Vector3; vel: Vector3; spin: Vector3; rot: Quaternion; size: number; heat: number; body: string; life: number }
interface Wave { mesh: Mesh; t: number; dur: number; size: number; body: string; dir: [number, number, number] }

/** Asteroids streaking in, impact flashes, shock waves along the ground, and glowing debris thrown out and falling back. */
export class ImpactLayer {
  private rocks: InstancedMesh;
  private chunks: InstancedMesh;
  private chunkList: Chunk[] = [];
  private trails: LineSegments;
  private trailPts = new Map<number, Vector3[]>();
  private waves: Wave[] = [];
  private shake = 0;

  constructor(private scene: Scene, private world: World, private fx: Effects) {
    const rockMat = new MeshStandardMaterial({ color: 0x6b6259, roughness: 0.95, metalness: 0.05 });
    this.rocks = new InstancedMesh(rockGeometry(3.3, 2), rockMat, MAX_ROCKS);
    this.rocks.count = 0; this.rocks.frustumCulled = false;
    const chunkMat = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0.0, emissive: 0xffffff, emissiveIntensity: 1 });
    this.chunks = new InstancedMesh(rockGeometry(7.7, 0), chunkMat, MAX_CHUNKS);
    this.chunks.instanceMatrix.setUsage(DynamicDrawUsage);
    this.chunks.count = 0; this.chunks.frustumCulled = false;
    for (let i = 0; i < MAX_CHUNKS; i++) this.chunks.setColorAt(i, new Color(0x333333));
    const tg = new BufferGeometry();
    tg.setAttribute("position", new BufferAttribute(new Float32Array(MAX_ROCKS * TRAIL * 6), 3).setUsage(DynamicDrawUsage));
    tg.setAttribute("color", new BufferAttribute(new Float32Array(MAX_ROCKS * TRAIL * 6), 3).setUsage(DynamicDrawUsage));
    this.trails = new LineSegments(tg, new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false }));
    this.trails.frustumCulled = false;
    scene.add(this.rocks, this.chunks, this.trails);
    world.bus.on(e => { if (e.type === "impact") this.onImpact(e.body, e.dir, e.size); });
  }

  /** Where a body-fixed direction on a world is in the scene right now. */
  private surfacePoint(bodyId: string, dir: [number, number, number], out: Vector3, lift = 1) {
    const b = this.world.bodies.get(bodyId)!;
    this.world.bodies.localToWorld(b, { x: dir[0], y: dir[1], z: dir[2] }, out);
    return out.multiplyScalar(b.radius * lift).add(b.pos);
  }

  private onImpact(bodyId: string, dir: [number, number, number], size: string) {
    const b = this.world.bodies.get(bodyId);
    if (!b) return;
    const k = SIZE[size] ?? 0.5;
    const at = this.surfacePoint(bodyId, dir, new Vector3());
    const normal = new Vector3().subVectors(at, b.pos).normalize();
    const gas = b.look?.surface === "gas" || b.look?.surface === "ice";
    this.fx.flash(at, "#fff1d0", b.radius * 0.5 * k, 0.6 + k * 0.25);
    this.fx.flash(at, gas ? "#ffb070" : "#ff8a3c", b.radius * 0.9 * k, 1.4 + k * 0.4);
    this.fx.burst(at, gas ? "#ffcf8a" : "#ff9a50", Math.round(80 + 140 * k), b.radius * 0.35 * k, b.radius * 0.012 * k, 1.6);
    this.fx.burst(at, "#8a7a6a", Math.round(40 + 80 * k), b.radius * 0.2 * k, b.radius * 0.02 * k, 2.4);
    // Shock wave racing out along the ground
    const ring = new Mesh(new RingGeometry(0.85, 1, 96), new ShaderMaterial({
      uniforms: { uA: { value: 1 } }, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: "uniform float uA; varying vec2 vUv; void main(){ gl_FragColor = vec4(vec3(1.0,0.75,0.5) * uA, 1.0); }",
    }));
    ring.position.copy(at).addScaledVector(normal, b.radius * 0.003);
    ring.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), normal);
    this.scene.add(ring);
    this.waves.push({ mesh: ring, t: 0, dur: 1.4 + k * 0.5, size: b.radius * 0.45 * k, body: bodyId, dir });
    // Debris chunks (solid worlds only)
    if (!gas) {
      const n = Math.round(10 + 22 * k);
      for (let i = 0; i < n && this.chunkList.length < MAX_CHUNKS; i++) {
        const out = new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().addScaledVector(normal, 1.6).normalize();
        this.chunkList.push({
          pos: at.clone().addScaledVector(normal, b.radius * 0.01), vel: out.multiplyScalar(b.radius * (0.3 + Math.random() * 0.9) * Math.sqrt(k)),
          spin: new Vector3(Math.random(), Math.random(), Math.random()).normalize(), rot: new Quaternion(), size: b.radius * (0.004 + Math.random() * 0.012) * k,
          heat: 1, body: bodyId, life: 0,
        });
      }
    }
    const camD = this.world.bodies.get(bodyId)!.pos.distanceTo(this.lastCam);
    if (camD < b.radius * 12) { this.shake = Math.min(1, 0.3 + k * 0.3); this.shakeScale = camD * 0.004; boom(0.4 + k * 0.3); }
  }
  private lastCam = new Vector3();
  private shakeScale = 0;

  update(ctx: FrameCtx) {
    const { camera, dt } = ctx;
    this.lastCam.copy(camera.position);
    const imp = this.world.impacts;
    // Incoming rocks: speed up as they fall, with a fiery trail inside an atmosphere
    let n = 0;
    const tp = this.trails.geometry.getAttribute("position") as BufferAttribute, tc = this.trails.geometry.getAttribute("color") as BufferAttribute;
    let li = 0;
    const live = new Set<number>();
    for (const r of imp.incoming) {
      if (n >= MAX_ROCKS) break;
      const b = this.world.bodies.get(r.body)!;
      const target = this.surfacePoint(r.body, r.dir, w2);
      const k = Math.pow(Math.min(1, r.t / r.travel), 2.2);
      const start = v.set(r.from[0], r.from[1], r.from[2]).multiplyScalar(b.radius * 14).add(target);
      const pos = start.lerp(target, k);
      const size = b.radius * 0.02 * (SIZE[r.size] ?? 0.5);
      q.setFromAxisAngle(s3.set(0.3, 1, 0.2).normalize(), ctx.t * 2 + r.id);
      m4.compose(pos, q, s3.setScalar(Math.max(size, (camera.position.distanceTo(pos) * 4) / ctx.px)));
      this.rocks.setMatrixAt(n++, m4);
      live.add(r.id);
      const pts = this.trailPts.get(r.id) ?? [];
      pts.push(pos.clone()); if (pts.length > TRAIL) pts.shift();
      this.trailPts.set(r.id, pts);
      const hasAir = !!b.look?.atmosphere;
      const inAir = hasAir && pos.distanceTo(b.pos) < b.radius * 1.25;
      if (inAir) this.fx.burst(pos, "#ffb070", 2, b.radius * 0.01, size * 1.5, 0.5);
      for (let i = 1; i < pts.length && li < MAX_ROCKS * TRAIL; i++) {
        const a = i / pts.length, hot = inAir ? 1 : 0.35;
        tp.setXYZ(li * 2, pts[i - 1].x, pts[i - 1].y, pts[i - 1].z); tp.setXYZ(li * 2 + 1, pts[i].x, pts[i].y, pts[i].z);
        tc.setXYZ(li * 2, a * hot, a * 0.55 * hot, a * 0.25 * hot); tc.setXYZ(li * 2 + 1, a * hot * 1.3, a * 0.75 * hot, a * 0.35 * hot);
        li++;
      }
    }
    for (const id of [...this.trailPts.keys()]) if (!live.has(id)) this.trailPts.delete(id);
    this.rocks.count = n; this.rocks.instanceMatrix.needsUpdate = true;
    this.trails.geometry.setDrawRange(0, li * 2); tp.needsUpdate = tc.needsUpdate = true;

    // Debris: ballistic under the world's gravity, glowing hot then cooling
    let cn = 0;
    const col = new Color();
    for (const c of this.chunkList) {
      const b = this.world.bodies.get(c.body)!;
      c.life += dt;
      const toC = v.subVectors(b.pos, c.pos);
      const r = toC.length();
      c.vel.addScaledVector(toC.normalize(), (b.radius * 0.9 * dt) * (b.radius * b.radius) / Math.max(r * r, 1e-6) * 2);
      c.pos.addScaledVector(c.vel, dt);
      c.heat = Math.max(0, c.heat - dt * 0.5);
      if (c.pos.distanceTo(b.pos) < b.radius * 1.001 && c.life > 0.3) { c.life = 99; continue; }
      c.rot.multiply(q.setFromAxisAngle(c.spin, dt * 3));
      m4.compose(c.pos, c.rot, s3.setScalar(Math.max(c.size, (camera.position.distanceTo(c.pos) * 1.5) / ctx.px)));
      this.chunks.setMatrixAt(cn, m4);
      col.setRGB(0.25 + 1.6 * c.heat, 0.2 + 0.7 * c.heat * c.heat, 0.18 + 0.2 * c.heat * c.heat * c.heat);
      this.chunks.setColorAt(cn, col);
      cn++;
    }
    this.chunkList = this.chunkList.filter(c => c.life < 12);
    this.chunks.count = cn; this.chunks.instanceMatrix.needsUpdate = true;
    if (this.chunks.instanceColor) this.chunks.instanceColor.needsUpdate = true;

    for (const wv of this.waves) {
      wv.t += dt;
      const k = Math.min(1, wv.t / wv.dur);
      // The ring rides with the surface as the world moves and turns
      const wb = this.world.bodies.get(wv.body)!;
      this.surfacePoint(wv.body, wv.dir, wv.mesh.position, 1.003);
      wv.mesh.quaternion.setFromUnitVectors(s3.set(0, 0, 1), v.subVectors(wv.mesh.position, wb.pos).normalize());
      wv.mesh.scale.setScalar(wv.size * (0.1 + Math.pow(k, 0.6)));
      (wv.mesh.material as ShaderMaterial).uniforms.uA.value = Math.pow(1 - k, 1.5) * 1.4;
      if (k >= 1) { this.scene.remove(wv.mesh); wv.mesh.geometry.dispose(); (wv.mesh.material as ShaderMaterial).dispose(); }
    }
    this.waves = this.waves.filter(wv => wv.t < wv.dur);

    // Camera shake for nearby impacts
    if (this.shake > 0.01) {
      camera.position.add(v.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(this.shake * this.shakeScale));
      this.shake *= Math.pow(0.02, dt);
    }
  }
}
