// Small, lit sphere portraits of each world, rendered once from the real maps for the dock and panels.
const thumbs = new Map<string, string>();
const listeners: (() => void)[] = [];
export const getThumb = (id: string) => thumbs.get(id);
export const onThumbs = (fn: () => void) => listeners.push(fn);

interface ThumbOpts { tint?: string; atmo?: string; ring?: boolean; viewLon?: number; gray?: boolean }

function hexRgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

/** Render a sphere portrait from an equirectangular image. */
export function makeThumb(id: string, img: HTMLImageElement | ImageBitmap | null, o: ThumbOpts = {}) {
  const S = 128;
  const W = 512, H = 256;
  let src: Uint8ClampedArray | null = null;
  if (img) {
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(img as CanvasImageSource, 0, 0, W, H);
    src = g.getImageData(0, 0, W, H).data;
  }
  const out = document.createElement("canvas"); out.width = out.height = S;
  const g = out.getContext("2d")!;
  const R = o.ring ? S * 0.27 : S * 0.47, cx = S / 2, cy = S / 2;
  const ringBand = (front: boolean) => {
    if (!o.ring) return;
    g.save(); g.translate(cx, cy); g.rotate(-0.38); g.scale(1, 0.32);
    const bands: [number, number, string][] = [[1.25, 1.52, "rgba(150,140,120,0.35)"], [1.53, 1.95, "rgba(225,205,165,0.9)"], [2.03, 2.27, "rgba(200,185,155,0.75)"]];
    for (const [a, b, col] of bands) {
      g.beginPath(); g.arc(0, 0, R * b, front ? 0 : Math.PI, front ? Math.PI : Math.PI * 2); g.arc(0, 0, R * a, front ? Math.PI : Math.PI * 2, front ? 0 : Math.PI, true);
      g.fillStyle = col; g.fill();
    }
    g.restore();
  };
  ringBand(false);
  const im = g.getImageData(0, 0, S, S), d = im.data;
  const tint = o.tint ? hexRgb(o.tint) : [200, 200, 200];
  const atmo = o.atmo ? hexRgb(o.atmo) : null;
  const L = [-0.55, 0.42, 0.72], ll = Math.hypot(...L);
  const vl = ((o.viewLon ?? 0) * Math.PI) / 180;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const nx = (x + 0.5 - cx) / R, ny = -(y + 0.5 - cy) / R, r2 = nx * nx + ny * ny;
    if (r2 > 1) continue;
    const nz = Math.sqrt(1 - r2);
    let rgb: number[];
    if (src) {
      const lon = Math.atan2(nx, nz) + vl, lat = Math.asin(ny);
      let u = 0.5 + lon / (Math.PI * 2); u -= Math.floor(u);
      const v = 0.5 - lat / Math.PI;
      const i = (Math.min(H - 1, Math.floor(v * H)) * W + Math.min(W - 1, Math.floor(u * W))) * 4;
      rgb = [src[i], src[i + 1], src[i + 2]];
      if (o.gray) { const l = (rgb[0] + rgb[1] + rgb[2]) / 765; rgb = tint.map(t => t * (0.35 + 0.85 * l)); }
    } else {
      const n = Math.sin(nx * 9.1 + ny * 7.3) * Math.sin(ny * 11.7 - nx * 5.1) * 0.12;
      rgb = tint.map(t => t * (0.85 + n));
    }
    const diff = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / ll);
    const shade = 0.05 + 0.95 * Math.pow(diff, 0.85);
    const k = (y * S + x) * 4;
    let [r, gg, b] = rgb.map(c => c * shade);
    if (atmo) { const rim = Math.pow(1 - nz, 2.6) * (0.25 + diff); r += atmo[0] * rim * 0.9; gg += atmo[1] * rim * 0.9; b += atmo[2] * rim * 0.9; }
    const edge = Math.min(1, (1 - Math.sqrt(r2)) * R * 1.5);
    d[k] = Math.min(255, r); d[k + 1] = Math.min(255, gg); d[k + 2] = Math.min(255, b); d[k + 3] = 255 * edge + d[k + 3] * (1 - edge);
  }
  g.putImageData(im, 0, 0);
  ringBand(true);
  thumbs.set(id, out.toDataURL("image/png"));
  listeners.forEach(f => f());
}

/** A glowing Sun portrait. */
export function makeSunThumb() {
  const S = 128, c = document.createElement("canvas"); c.width = c.height = S;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, "#fffbe8"); grd.addColorStop(0.55, "#ffd77a"); grd.addColorStop(0.82, "#f39a34"); grd.addColorStop(0.92, "rgba(240,140,50,0.5)"); grd.addColorStop(1, "rgba(240,120,40,0)");
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  thumbs.set("sun", c.toDataURL("image/png"));
  listeners.forEach(f => f());
}
