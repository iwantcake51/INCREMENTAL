import { Vector3, type PerspectiveCamera } from "three";

interface LabelEl { el: HTMLElement; html: string; cls: string; onClick?: () => void; visible: boolean }
export interface LabelOpts { cls?: string; onClick?: () => void; dy?: number }

const v = new Vector3();

/** HTML labels pinned to 3D positions. Elements are pooled and only touched when something changes. */
export class Labels {
  private pool = new Map<string, LabelEl>();
  private used = new Set<string>();
  private w = 1;
  private h = 1;

  constructor(private root: HTMLElement, private camera: PerspectiveCamera) {}

  resize(w: number, h: number) { this.w = w; this.h = h; }

  begin() { this.used.clear(); }

  /** Returns the label's screen position, or null if it is off screen. */
  put(key: string, pos: Vector3, html: string, opts: LabelOpts = {}): [number, number] | null {
    v.copy(pos).project(this.camera);
    if (v.z > 1 || v.z < -1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) return null;
    const x = (v.x + 1) * 0.5 * this.w, y = (1 - v.y) * 0.5 * this.h + (opts.dy ?? 0);
    let l = this.pool.get(key);
    if (!l) {
      const el = document.createElement("div");
      l = { el, html: "", cls: "", visible: false };
      const ref = l;
      el.addEventListener("click", e => { if (ref.onClick) { e.stopPropagation(); ref.onClick(); } });
      this.root.appendChild(el);
      this.pool.set(key, l);
    }
    const cls = "label " + (opts.cls ?? "");
    if (l.cls !== cls) { l.el.className = cls; l.cls = cls; }
    if (l.html !== html) { l.el.innerHTML = html; l.html = html; }
    l.onClick = opts.onClick;
    if (!l.visible) { l.el.style.display = ""; l.visible = true; }
    l.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    this.used.add(key);
    return [x, y];
  }

  end() {
    for (const [k, l] of this.pool) if (!this.used.has(k) && l.visible) { l.el.style.display = "none"; l.visible = false; }
  }

  /** Screen position of a world point (no label). */
  project(pos: Vector3): [number, number, boolean] {
    v.copy(pos).project(this.camera);
    return [(v.x + 1) * 0.5 * this.w, (1 - v.y) * 0.5 * this.h, v.z < 1 && v.z > -1];
  }
}
