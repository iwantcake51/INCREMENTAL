import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Points, Sprite, SpriteMaterial, Vector3, type Scene } from "three";
import { particleMaterial } from "./shaders/space";

const MAX = 24000;
const col = new Color();

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.18, "rgba(255,240,210,0.85)");
  grd.addColorStop(0.45, "rgba(255,170,90,0.25)");
  grd.addColorStop(1, "rgba(255,120,60,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}
export const GLOW = typeof document !== "undefined" ? glowTexture() : null;

/** Pooled GPU particles plus expanding flash sprites. Spawning writes only the new slots to the GPU. */
export class Effects {
  readonly points: Points;
  private geo = new BufferGeometry();
  private head = 0;
  private flashes: { s: Sprite; t: number; life: number; size: number }[] = [];
  private attrs: Record<string, BufferAttribute>;
  time = 0;

  constructor(private scene: Scene) {
    const mk = (n: number) => new BufferAttribute(new Float32Array(MAX * n), n).setUsage(35048 /* DynamicDrawUsage */);
    this.attrs = { position: mk(3), aVel: mk(3), aLife: mk(2), aColor: mk(3), aSize: mk(1) };
    for (const [k, a] of Object.entries(this.attrs)) this.geo.setAttribute(k, a);
    (this.attrs.aLife.array as Float32Array).fill(-100);
    this.points = new Points(this.geo, particleMaterial());
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    for (let i = 0; i < 40; i++) {
      const s = new Sprite(new SpriteMaterial({ map: GLOW, color: 0xffffff, blending: AdditiveBlending, depthWrite: false, transparent: true }));
      s.visible = false; s.renderOrder = 6;
      scene.add(s);
      this.flashes.push({ s, t: 1, life: 1, size: 1 });
    }
  }

  /** A burst of `n` particles at `at`. Speed and size are in scene units. */
  burst(at: Vector3, color: string, n: number, speed: number, size: number, life = 1.2) {
    col.set(color);
    const start = this.head;
    const { position, aVel, aLife, aColor, aSize } = this.attrs;
    const P = position.array as Float32Array, Vv = aVel.array as Float32Array, Lf = aLife.array as Float32Array, C = aColor.array as Float32Array, S = aSize.array as Float32Array;
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (this.head + 1) % MAX;
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
      const v = speed * Math.pow(Math.random(), 0.5);
      P[i * 3] = at.x; P[i * 3 + 1] = at.y; P[i * 3 + 2] = at.z;
      Vv[i * 3] = r * Math.cos(th) * v; Vv[i * 3 + 1] = u * v; Vv[i * 3 + 2] = r * Math.sin(th) * v;
      Lf[i * 2] = this.time; Lf[i * 2 + 1] = life * (0.4 + Math.random() * 0.8);
      const hot = Math.random() < 0.3;
      C[i * 3] = hot ? 1 : col.r; C[i * 3 + 1] = hot ? 0.85 : col.g; C[i * 3 + 2] = hot ? 0.6 : col.b;
      S[i] = size * (0.5 + Math.random());
    }
    this.mark(start, n);
  }

  private mark(start: number, n: number) {
    for (const [name, a] of Object.entries(this.attrs)) {
      const size = a.itemSize;
      if (start + n <= MAX) a.addUpdateRange(start * size, n * size);
      else { a.addUpdateRange(start * size, (MAX - start) * size); a.addUpdateRange(0, (start + n - MAX) * size); }
      a.needsUpdate = true;
      void name;
    }
  }

  flash(at: Vector3, color: string, size: number, life = 0.6) {
    const f = this.flashes.find(x => x.t >= x.life) ?? this.flashes[0];
    f.s.position.copy(at);
    (f.s.material as SpriteMaterial).color.set(color);
    f.t = 0; f.life = life; f.size = size; f.s.visible = true;
  }

  /** A blast: flash plus a particle burst. */
  blast(at: Vector3, color: string, size: number) {
    this.flash(at, color, size * 1.6, 0.5 + size * 0.15);
    this.burst(at, color, Math.round(30 + size * 60), size * 0.9, size * 0.05, 1.1);
  }

  update(dt: number) {
    this.time += dt;
    (this.points.material as any).uniforms.uTime.value = this.time;
    for (const f of this.flashes) {
      if (f.t >= f.life) { if (f.s.visible) f.s.visible = false; continue; }
      f.t += dt;
      const k = Math.min(1, f.t / f.life);
      const s = f.size * (0.4 + k * 1.2);
      f.s.scale.set(s, s, s);
      (f.s.material as SpriteMaterial).opacity = Math.pow(1 - k, 1.5);
    }
  }

  setPixelScale(px: number) { (this.points.material as any).uniforms.uPx.value = px; }
  dispose() { this.scene.remove(this.points); }
}
