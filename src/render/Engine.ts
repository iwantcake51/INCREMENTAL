import { ACESFilmicToneMapping, AmbientLight, HalfFloatType, PerspectiveCamera, PointLight, Scene, SRGBColorSpace, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { eraYear, FACTIONS } from "../data/timeline";
import type { Body } from "../sim/bodies";
import type { World, Quality } from "../sim/world";
import { CameraRig, type FocusTarget } from "./CameraRig";
import { Effects } from "./Effects";
import { Labels } from "./Labels";
import { SolarSystem, type FrameCtx } from "./SolarSystem";
import { TechLayer } from "./TechLayer";
import { WarLayer } from "./WarLayer";
import { CraftLayer } from "./CraftLayer";
import { RocketLayer } from "./RocketLayer";
import { ImpactLayer } from "./ImpactLayer";
import { SkyFx } from "./SkyFx";
import { loadMaps } from "./textures";
import { makeSunThumb, makeThumb } from "./thumbs";

export interface EngineHooks {
  onSelect(id: string): void;
  onHover(info: { id: string; name: string; x: number; y: number } | null): void;
}

const QUALITY: Record<Quality, { dpr: number; bloom: boolean; samples: number }> = {
  low: { dpr: 1, bloom: false, samples: 0 },
  medium: { dpr: 1.5, bloom: true, samples: 2 },
  high: { dpr: 2, bloom: true, samples: 4 },
};

/** Owns the WebGL renderer and every 3D layer. Reads the simulation; never changes it except to step time. */
export class Engine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly rig: CameraRig;
  readonly labels: Labels;
  private composer: EffectComposer;
  private bloom: UnrealBloomPass;
  private system: SolarSystem;
  private tech: TechLayer;
  private war: WarLayer;
  private fx: Effects;
  readonly craft: CraftLayer;
  private rockets: RocketLayer;
  private impacts: ImpactLayer;
  readonly sky: SkyFx;
  private t = 0;
  private vis = 0;
  private last = performance.now();
  private w = 1;
  private h = 1;
  private quality: Quality = "high";
  private down: { x: number; y: number; t: number } | null = null;
  selected = "earth";
  fps = 60;
  /** God mode: when set, clicking a world drops a meteor of this size where you clicked. */
  meteorMode: null | "small" | "large" | "huge" = null;
  mapsReady = false;

  constructor(private canvas: HTMLCanvasElement, labelRoot: HTMLElement, private world: World, private hooks: EngineHooks) {
    this.renderer = new WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: "high-performance" });
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.camera = new PerspectiveCamera(45, 1, 1e-5, 2e5);
    this.camera.position.set(0, 120, 200);
    this.scene.add(new PointLight(0xfff1dd, 2.2, 0, 0), new AmbientLight(0x334466, 0.25));

    const rt = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new Vector2(256, 256), 0.85, 0.55, 0.85);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.rig = new CameraRig(this.camera, canvas);
    this.labels = new Labels(labelRoot, this.camera);
    this.fx = new Effects(this.scene);
    this.system = new SolarSystem(this.scene, world, Math.min(devicePixelRatio || 1, 2));
    this.tech = new TechLayer(this.scene, this.system);
    this.war = new WarLayer(this.scene, this.fx);
    this.craft = new CraftLayer(this.scene);
    this.rockets = new RocketLayer(this.scene, world, this.fx);
    this.impacts = new ImpactLayer(this.scene, world, this.fx);
    this.sky = new SkyFx(this.scene, world, this.system);

    world.bus.on(e => {
      if (e.type === "shot") this.war.shot(e.from, e.to, e.color, e.weapon);
      else if (e.type === "blast") this.fx.blast(e.at, e.color, e.size);
      else if (e.type === "reset") this.war.clear();
    });

    const VIEW_LON: Record<string, number> = { earth: -60, mars: -60, jupiter: 30, moon: 0 };
    loadMaps(this.renderer, (id, maps) => {
      this.system.applyMaps(id, maps);
      const b = world.bodies.get(id);
      if (b) makeThumb(id, maps.map?.image as HTMLImageElement, { gray: maps.gray, tint: b.look?.colors[2] ?? b.color, atmo: b.look?.atmosphere && b.look.atmosphere.density > 0.4 ? b.look.atmosphere.color : undefined, ring: id === "saturn", viewLon: VIEW_LON[id] });
    }, () => {
      this.mapsReady = true;
      // Worlds without real maps get a shaded portrait from their palette
      for (const b of world.bodies.list) if (b.kind !== "sun" && !["earth", "mars", "jupiter", "saturn", "mercury", "venus", "moon", "uranus", "neptune", "io", "europa", "ganymede", "callisto", "enceladus", "titan", "triton", "phobos", "ceres"].includes(b.id)) makeThumb(b.id, null, { tint: b.color });
    });
    makeSunThumb();

    this.bindPointer();
    this.resize();
    addEventListener("resize", () => this.resize());
  }

  setQuality(q: Quality) {
    this.quality = q;
    this.bloom.enabled = QUALITY[q].bloom;
    (this.composer.renderTarget1 as WebGLRenderTarget).samples = QUALITY[q].samples;
    (this.composer.renderTarget2 as WebGLRenderTarget).samples = QUALITY[q].samples;
    this.resize();
  }

  resize() {
    const r = this.canvas.parentElement!.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    const dpr = Math.min(devicePixelRatio || 1, QUALITY[this.quality].dpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(this.w, this.h, false);
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(this.w, this.h);
    this.bloom.resolution.set(this.w / 2, this.h / 2);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.labels.resize(this.w, this.h);
  }

  get pxPerUnit() { return this.h / (2 * Math.tan((this.camera.fov * Math.PI) / 360)); }

  /** Where something is and how big, for camera focus. Bodies, Voyagers and the starship can be focused. */
  target(id: string): FocusTarget | undefined {
    const b = this.world.bodies.get(id);
    if (b) return { pos: b.pos, radius: b.radius };
    const cp = this.sky.cometPos(id);
    if (cp) return { pos: cp, radius: 0.05 };
    const cv = this.craft.get(id);
    if (cv?.active) return { pos: cv.pos, radius: cv.craft.kind === "landing" ? 0.02 : 0.004 };
    const v = this.tech.voyagerPos(id);
    if (v) return { pos: v, radius: 0.05 };
    if (id === "ark") return { pos: this.tech.arkPos, radius: 0.1 };
    return undefined;
  }

  focus(id: string, dist?: number) {
    const t = this.target(id);
    if (!t) return;
    this.selected = id;
    const b = this.world.bodies.get(id);
    const cv = this.craft.get(id);
    const d = dist ?? (b?.kind === "sun" ? 60 : b?.planet?.ring ? t.radius * 7 : b ? t.radius * 5.5 : cv ? (cv.craft.kind === "landing" ? 0.12 : cv.craft.kind === "probe" && this.world.day < cv.arrive ? 1.5 : 0.05) : 3);
    this.rig.flyTo(id, t, d);
  }

  overview() {
    const far = this.world.settings.scale === "true" ? 520 : 300;
    this.selected = "sun";
    this.rig.flyTo("sun", this.target("sun")!, far, 1.8);
  }

  zoom(f: number) { this.rig.zoomBy(f); }

  screenshot(): string {
    this.render();
    return this.canvas.toDataURL("image/png");
  }

  private levels = {
    city: (id: string) => {
      const y = this.world.year;
      // Earth's night lights brighten through the 1960s–2000s as electrification spreads.
      if (id === "earth") return 0.12 + 0.88 / (1 + Math.exp(-(y - 1982) / 9));
      const c = this.world.civ.colonies.find(c => c.active && c.body === id);
      return c ? Math.min(1, 0.15 + (y - c.y) / 120) : 0;
    },
    terraform: (id: string) => this.world.god.terraformLevel(id, this.world.year),
  };

  frame() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.fps = this.fps * 0.95 + (1 / Math.max(dt, 1e-3)) * 0.05;
    this.t += dt;
    if (this.world.playing) this.vis += dt;
    this.world.step(dt);

    const year = this.world.year;
    const dysonStart = this.world.god.dysonStart();
    const dysonFrac = year >= dysonStart ? Math.min(1, (year - dysonStart) / 250) : 0;
    const ctx: FrameCtx = { world: this.world, camera: this.camera, t: this.t, dt, vis: this.vis, px: this.pxPerUnit, year, sunPower: 1 - 0.3 * dysonFrac };

    this.rig.update(dt, this.target(this.rig.focusId));
    this.camera.updateMatrixWorld();
    this.labels.begin();
    this.system.update(ctx, this.selected, this.levels);
    this.tech.update(ctx, this.labels, this.selected, dysonStart);
    this.fx.setPixelScale(ctx.px * this.renderer.getPixelRatio());
    this.fx.update(dt);
    this.war.update(ctx, this.labels, id => this.hooks.onSelect(id));
    this.craft.update(ctx, this.labels, this.selected, id => this.hooks.onSelect(id));
    this.rockets.update(ctx);
    this.impacts.update(ctx);
    this.sky.update(ctx, this.labels, this.selected);
    if (this.world.settings.labels) this.bodyLabels(ctx);
    this.labels.end();
    this.render();
  }

  private render() { this.composer.render(); }

  private bodyLabels(ctx: FrameCtx) {
    const B = this.world.bodies, cam = this.camera.position;
    const focusSys = B.systemOf(this.selected);
    for (const b of B.list) {
      const d = cam.distanceTo(b.pos);
      const rpx = (b.radius * ctx.px) / d;
      if (b.kind === "moon") {
        const parent = B.get(b.parent!)!;
        const sep = (parent.pos.distanceTo(b.pos) * ctx.px) / cam.distanceTo(parent.pos);
        if (b.parent !== focusSys && cam.distanceTo(parent.pos) > parent.radius * 40) continue;
        if (sep < 18) continue;
      }
      if (b.kind === "dwarf" && rpx < 0.5 && !this.world.civ.colonies.some(c => c.active && c.body === b.id) && this.selected !== b.id) continue;
      if (d < b.radius * 3.2) continue; // you're right next to it: keep the view clear
      const col = this.world.civ.colonies.find(c => c.active && c.body === b.id && (c.id !== "earth" || this.world.year >= 2045));
      let html = b.name;
      if (col) {
        const f = FACTIONS[col.owner];
        html = `<i style="background:${f.color}"></i>${b.name}`;
        if (col.siege > 0) html += `<span class="siege" title="Under attack"><span style="width:${Math.round(col.siege * 100)}%;background:${FACTIONS[col.besiegedBy]?.color ?? "#ff5a3c"}"></span></span>`;
      }
      const cls = (b.kind === "planet" || b.kind === "sun" ? "body" : "body small") + (b.id === this.selected ? " selected" : "") + (col?.siege ? " besieged" : "");
      this.labels.put("b-" + b.id, b.pos, html, { cls, dy: -(Math.min(rpx, 200) + 14), onClick: () => this.hooks.onSelect(b.id) });
    }
  }

  /** Meteor mode: find the world under the cursor and send a rock at exactly that spot, coming from your viewpoint. */
  private fireMeteor(x: number, y: number) {
    const ndc = new Vector3((x / this.w) * 2 - 1, -(y / this.h) * 2 + 1, 0.5);
    const origin = this.camera.position.clone();
    const dir = ndc.unproject(this.camera).sub(origin).normalize();
    let best: { id: string; t: number } | null = null;
    for (const b of this.world.bodies.list) {
      if (b.kind === "sun") continue;
      const oc = origin.clone().sub(b.pos);
      const bb = oc.dot(dir), c = oc.lengthSq() - b.radius * b.radius, disc = bb * bb - c;
      if (disc < 0) continue;
      const t = -bb - Math.sqrt(disc);
      if (t > 0 && (!best || t < best.t)) best = { id: b.id, t };
    }
    if (!best) return;
    const b = this.world.bodies.get(best.id)!;
    const hitPoint = origin.clone().addScaledVector(dir, best.t);
    const local = hitPoint.clone().sub(b.pos).normalize().applyQuaternion(b.quat!.clone().invert());
    const from = origin.clone().sub(hitPoint).normalize();
    const size = this.meteorMode!;
    this.world.impacts.launch(b.id, size === "small" ? "small" : size, "Meteor", [local.x, local.y, local.z], [from.x, from.y, from.z], size === "small" ? 1.1 : 1.6);
  }

  /** Nearest clickable thing to a screen point. */
  pick(x: number, y: number): { id: string; name: string } | null {
    const cands: { id: string; name: string; pos: Vector3; r: number }[] = this.world.bodies.list.map((b: Body) => ({ id: b.id, name: b.name, pos: b.pos, r: b.radius }));
    for (const id of ["voyager1", "voyager2"]) { const p = this.tech.voyagerPos(id); if (p && this.world.year >= 1977.6) cands.push({ id, name: id === "voyager1" ? "Voyager 1" : "Voyager 2", pos: p, r: 0.05 }); }
    if (this.world.year >= eraYear("ark")) cands.push({ id: "ark", name: "Generation ship", pos: this.tech.arkPos, r: 0.1 });
    for (const cv of this.sky.comets) if (cv.active > 0.02) cands.push({ id: cv.id, name: cv.name, pos: cv.pos, r: 0.05 });
    for (const v of this.craft.views) if (v.active) cands.push({ id: v.craft.id, name: v.craft.name, pos: v.pos, r: 0.002 });
    let best: { id: string; name: string } | null = null, bd = Infinity;
    const cam = this.camera.position;
    for (const c of cands) {
      const [sx, sy, vis] = this.labels.project(c.pos);
      if (!vis) continue;
      const rpx = (c.r * this.pxPerUnit) / cam.distanceTo(c.pos);
      const d = Math.hypot(sx - x, sy - y);
      // Prefer the body whose disc you clicked; small things get a generous hit area.
      const score = d - rpx;
      if (d < Math.max(18, rpx + 6) && score < bd) { bd = score; best = { id: c.id, name: c.name }; }
    }
    return best;
  }

  private bindPointer() {
    const el = this.canvas;
    el.addEventListener("pointerdown", e => { this.down = { x: e.offsetX, y: e.offsetY, t: performance.now() }; });
    el.addEventListener("pointerup", e => {
      if (!this.down) return;
      const moved = Math.hypot(e.offsetX - this.down.x, e.offsetY - this.down.y);
      if (moved < 5 && performance.now() - this.down.t < 500 && this.meteorMode) {
        this.fireMeteor(e.offsetX, e.offsetY);
        this.down = null;
        return;
      }
      if (moved < 5 && performance.now() - this.down.t < 500) {
        const hit = this.pick(e.offsetX, e.offsetY);
        if (hit) this.hooks.onSelect(hit.id);
      }
      this.down = null;
    });
    el.addEventListener("pointermove", e => {
      if (this.down) return;
      if (this.meteorMode) { el.style.cursor = "crosshair"; this.hooks.onHover(null); return; }
      const hit = this.pick(e.offsetX, e.offsetY);
      el.style.cursor = hit ? "pointer" : "grab";
      this.hooks.onHover(hit ? { ...hit, x: e.offsetX, y: e.offsetY } : null);
    });
    el.addEventListener("pointerleave", () => this.hooks.onHover(null));
    el.addEventListener("dblclick", e => {
      const hit = this.pick(e.offsetX, e.offsetY);
      if (!hit) return;
      const t = this.target(hit.id)!;
      this.selected = hit.id;
      this.rig.flyTo(hit.id, t, t.radius * 2.2);
      this.hooks.onSelect(hit.id);
    });
  }
}
