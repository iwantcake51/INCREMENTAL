import { MathUtils, Vector3, type PerspectiveCamera } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export interface FocusTarget { pos: Vector3; radius: number }

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Orbit camera that follows a moving body. Zoom covers ~7 orders of magnitude: from the whole solar system
 * down to a few kilometres above a planet's surface (the renderer uses a logarithmic depth buffer).
 */
export class CameraRig {
  readonly controls: OrbitControls;
  focusId = "sun";
  private last = new Vector3();
  private anim: { t: number; dur: number; fromTarget: Vector3; d0: number; d1: number; dir: Vector3 } | null = null;
  private pendingZoom = 1;
  private radius = 3;
  private tmp = new Vector3();

  constructor(private camera: PerspectiveCamera, dom: HTMLElement) {
    const c = new OrbitControls(camera, dom);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.zoomSpeed = 2.2;
    c.rotateSpeed = 0.7;
    c.enablePan = false;
    c.maxDistance = 9000;
    c.minDistance = 0.001;
    this.controls = c;
  }

  get distance() { return this.camera.position.distanceTo(this.controls.target); }
  get animating() { return !!this.anim; }

  /** Fly to a body. `dist` defaults to a nice framing distance for its size. */
  flyTo(id: string, target: FocusTarget, dist?: number, dur = 1.6) {
    const d1 = dist ?? Math.max(target.radius * 5, 0.25);
    const dir = this.tmp.subVectors(this.camera.position, this.controls.target).normalize().clone();
    if (dir.y < 0.15) { dir.y = 0.35; dir.normalize(); }
    this.anim = { t: 0, dur, fromTarget: this.controls.target.clone(), d0: this.distance, d1, dir };
    this.focusId = id;
    this.radius = target.radius;
    this.last.copy(target.pos);
  }

  /** Jump without animation (used on load). */
  snapTo(id: string, target: FocusTarget, dist: number, elevation = 0.45) {
    this.focusId = id; this.radius = target.radius; this.anim = null;
    this.controls.minDistance = target.radius * 1.0015;
    this.controls.target.copy(target.pos);
    this.camera.position.copy(target.pos).add(new Vector3(0, Math.sin(elevation), Math.cos(elevation)).multiplyScalar(dist));
    this.last.copy(target.pos);
    this.controls.update();
  }

  zoomBy(factor: number) { this.pendingZoom *= factor; }

  update(dt: number, target: FocusTarget | undefined) {
    const c = this.controls;
    if (!target) return;
    this.radius = target.radius;
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(1, a.t + dt / a.dur);
      const e = ease(a.t);
      c.target.lerpVectors(a.fromTarget, target.pos, e);
      const d = Math.exp(MathUtils.lerp(Math.log(a.d0), Math.log(a.d1), e));
      const cur = this.tmp.subVectors(this.camera.position, c.target);
      const dir = cur.lengthSq() > 1e-12 ? cur.normalize().lerp(a.dir, e * 0.15).normalize() : a.dir;
      this.camera.position.copy(c.target).addScaledVector(dir, d);
      if (a.t >= 1) this.anim = null;
      this.last.copy(target.pos);
      this.camera.lookAt(c.target);
      return;
    }
    // Follow the body as it moves along its orbit.
    const delta = this.tmp.subVectors(target.pos, this.last);
    this.camera.position.add(delta);
    c.target.add(delta);
    this.last.copy(target.pos);
    if (Math.abs(this.pendingZoom - 1) > 1e-3) {
      const step = Math.pow(this.pendingZoom, Math.min(1, dt * 7));
      this.pendingZoom /= step;
      const off = this.tmp.subVectors(this.camera.position, c.target).multiplyScalar(step);
      const min = this.radius * 1.0015, len = off.length();
      if (len < min) off.setLength(min);
      if (len > c.maxDistance) off.setLength(c.maxDistance);
      this.camera.position.copy(c.target).add(off);
    }
    c.minDistance = this.radius * 1.0015;
    // Rotate more gently close to the surface so it doesn't feel like spinning a globe too fast.
    const alt = this.distance / this.radius - 1;
    c.rotateSpeed = MathUtils.clamp(alt * 0.9, 0.04, 0.7);
    c.zoomSpeed = alt < 0.2 ? 1.2 : 2.2;
    c.update(dt);
  }
}
