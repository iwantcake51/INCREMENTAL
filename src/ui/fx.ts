import { prefersReducedMotion } from './dom';

/* ==========================================================================
   Foreground effects: glowing motes, bubbles, floating numbers and ripples.
   Pooled objects on one canvas; the loop sleeps when nothing is alive.
   ========================================================================== */

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
  light: number;
  drag: number;
  grav: number;
}
interface Bubble {
  x: number;
  y: number;
  vy: number;
  r: number;
  life: number;
  max: number;
  phase: number;
  wobble: number;
}
interface Floater {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  text: string;
  size: number;
  color: string;
  weight: number;
}
interface Ring {
  x: number;
  y: number;
  r: number;
  to: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

const MAX_SPARKS = 700;
const MAX_BUBBLES = 260;
const MAX_FLOATERS = 26;

class Fx {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private sparks: Spark[] = [];
  private pool: Spark[] = [];
  private bubbleList: Bubble[] = [];
  private floaters: Floater[] = [];
  private rings: Ring[] = [];
  /** Live glimmerfish wakes, owned by the stage (recent head positions). */
  tails: { x: number; y: number }[][] = [];
  private running = false;
  private last = 0;
  particles = true;
  floatingText = true;
  hue = 165;
  /** Accent colour as "r,g,b" for ripples. */
  rgb = '120,242,207';

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  private spark(): Spark {
    return this.pool.pop() ?? ({} as Spark);
  }

  burst(x: number, y: number, count: number, opts: { hue?: number; speed?: number; size?: number; light?: number; grav?: number; life?: number } = {}): void {
    if (!this.particles) return;
    const n = Math.min(prefersReducedMotion() ? Math.ceil(count / 3) : count, MAX_SPARKS - this.sparks.length);
    const speed = opts.speed ?? 3;
    for (let i = 0; i < n; i++) {
      const p = this.spark();
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.9);
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.life = 0;
      p.max = (opts.life ?? 40) * (0.7 + Math.random() * 0.7);
      p.size = (opts.size ?? 2) * (0.6 + Math.random() * 0.8);
      p.hue = (opts.hue ?? this.hue) + (Math.random() - 0.5) * 20;
      p.light = opts.light ?? 72;
      p.drag = 0.92 + Math.random() * 0.04;
      // Things drift slightly upward underwater instead of falling.
      p.grav = opts.grav ?? -0.025;
      this.sparks.push(p);
    }
    this.wake();
  }

  /** A slow glowing speck that floats up (Plankton Bloom). */
  mote(x: number, y: number): void {
    if (!this.particles || this.sparks.length >= MAX_SPARKS) return;
    const p = this.spark();
    p.x = x;
    p.y = y;
    p.vx = (Math.random() - 0.5) * 0.3;
    p.vy = -0.2 - Math.random() * 0.4;
    p.life = 0;
    p.max = 90 + Math.random() * 90;
    p.size = 1.5 + Math.random() * 2;
    p.hue = this.hue + (Math.random() - 0.5) * 30;
    p.light = 70;
    p.drag = 0.995;
    p.grav = -0.002;
    this.sparks.push(p);
    this.wake();
  }

  /** Rising air bubbles. `scale` makes them larger and faster. */
  bubbles(x: number, y: number, count: number, scale = 1): void {
    if (!this.particles) return;
    const n = Math.min(prefersReducedMotion() ? Math.ceil(count / 3) : count, MAX_BUBBLES - this.bubbleList.length);
    for (let i = 0; i < n; i++) {
      this.bubbleList.push({
        x: x + (Math.random() - 0.5) * 26 * scale,
        y: y + (Math.random() - 0.5) * 16 * scale,
        vy: -(0.8 + Math.random() * 1.6) * scale,
        r: (1.5 + Math.random() ** 2 * 5) * scale,
        life: 0,
        max: 50 + Math.random() * 50,
        phase: Math.random() * Math.PI * 2,
        wobble: 0.4 + Math.random() * 0.9,
      });
    }
    this.wake();
  }

  float(x: number, y: number, text: string, opts: { size?: number; color?: string; weight?: number; life?: number } = {}): void {
    if (!this.floatingText) return;
    if (this.floaters.length >= MAX_FLOATERS) this.floaters.shift();
    this.floaters.push({
      x: x + (Math.random() - 0.5) * 56,
      y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 0.7,
      vy: -1.2 - Math.random() * 0.6,
      life: 0,
      max: opts.life ?? 62,
      text,
      size: opts.size ?? 18,
      color: opts.color ?? '#e4f1e9',
      weight: opts.weight ?? 700,
    });
    this.wake();
  }

  ring(x: number, y: number, to: number, color = 'rgba(200,255,240,0.6)', width = 2, frames = 36): void {
    if (!this.particles) return;
    this.rings.push({ x, y, r: 4, to, life: 0, max: frames, color, width });
    this.wake();
  }

  wake(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    const step = Math.min(3, (now - this.last) / (1000 / 60));
    this.last = now;
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);

    // Glimmerfish wakes: tapered, brightest at the fish.
    ctx.lineCap = 'round';
    for (const pts of this.tails) {
      for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length;
        ctx.strokeStyle = `rgba(${this.rgb},${t * t * 0.55})`;
        ctx.lineWidth = 1 + t * 7;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }

    // Glowing motes — round, additive.
    ctx.globalCompositeOperation = 'lighter';
    const sparks = this.sparks;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.life += step;
      if (p.life >= p.max) {
        sparks[i] = sparks[sparks.length - 1];
        sparks.pop();
        this.pool.push(p);
        continue;
      }
      const drag = p.drag ** step;
      p.vx *= drag;
      p.vy = p.vy * drag + p.grav * step;
      p.x += p.vx * step;
      p.y += p.vy * step;
      const t = 1 - p.life / p.max;
      const s = p.size * (0.5 + t * 0.5);
      ctx.fillStyle = `hsl(${p.hue} 90% ${p.light}% / ${t * 0.9})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    // Bubbles: thin rim, a highlight, gentle wobble on the way up.
    for (let i = this.bubbleList.length - 1; i >= 0; i--) {
      const b = this.bubbleList[i];
      b.life += step;
      if (b.life >= b.max || b.y < -20) {
        this.bubbleList.splice(i, 1);
        continue;
      }
      b.vy -= 0.02 * step;
      b.y += b.vy * step;
      const x = b.x + Math.sin(b.phase + b.life * 0.12) * b.wobble * 3;
      const t = b.life / b.max;
      const a = (t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9) * 0.75;
      ctx.strokeStyle = `rgba(214,255,244,${a})`;
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
      if (b.r > 2.5) {
        ctx.fillStyle = `rgba(255,255,255,${a * 0.8})`;
        ctx.beginPath();
        ctx.arc(x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.22, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life += step;
      if (r.life >= r.max) {
        this.rings.splice(i, 1);
        continue;
      }
      const t = r.life / r.max;
      const e = 1 - (1 - t) ** 3;
      ctx.globalAlpha = 1 - t;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = r.width * (1 - t * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r + (r.to - r.r) * e, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // Floating numbers with a hard dark offset, like printed type.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life += step;
      if (f.life >= f.max) {
        this.floaters.splice(i, 1);
        continue;
      }
      f.x += f.vx * step;
      f.y += f.vy * step;
      f.vy *= 0.975 ** step;
      const t = f.life / f.max;
      const pop = t < 0.12 ? 0.7 + (t / 0.12) * 0.4 : t < 0.2 ? 1.1 - ((t - 0.12) / 0.08) * 0.1 : 1;
      ctx.globalAlpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      ctx.font = `${f.weight} ${f.size * pop}px 'Bricolage Grotesque Variable', system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(1,6,10,0.9)';
      ctx.fillText(f.text, f.x, f.y + 2);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;

    if (this.sparks.length || this.bubbleList.length || this.floaters.length || this.rings.length || this.tails.length) requestAnimationFrame(this.frame);
    else {
      ctx.clearRect(0, 0, this.w, this.h);
      this.running = false;
    }
  };
}

export const fx = new Fx();

/* ==========================================================================
   Background water: a depth gradient and distant silhouettes cached to an
   offscreen canvas, plus swaying light shafts, drifting marine snow and the
   odd column of bubbles. ~24fps, paused when hidden or disabled. Each descent
   makes the water a little darker and colder.
   ========================================================================== */

interface Snow {
  x: number;
  y: number;
  r: number;
  vy: number;
  phase: number;
  a: number;
}

class Ocean {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private base!: HTMLCanvasElement;
  private snow: Snow[] = [];
  private column: { x: number; y: number; t: number }[] = [];
  private dpr = 1;
  private w = 0;
  private h = 0;
  private enabled = true;
  private raf = 0;
  private lastDraw = 0;
  private depth = 0;
  private accent = '120 242 207';

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.base = document.createElement('canvas');
    addEventListener('resize', () => this.build());
    document.addEventListener('visibilitychange', () => this.schedule());
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.schedule();
    if (!on) this.draw(performance.now(), true);
  }

  /** Kept for API compatibility; the light comes from above regardless. */
  setCenter(_x: number, _y: number): void {}

  setAccent(rgb: string): void {
    this.accent = rgb.trim().replace(/,/g, ' ');
    this.build();
  }

  /** Each descent darkens the water a little (caps out around depth 12). */
  setDepth(n: number): void {
    const d = Math.min(12, n);
    if (d === this.depth) return;
    this.depth = d;
    this.build();
  }

  build(): void {
    if (!this.canvas) return;
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.w = innerWidth;
    this.h = innerHeight;
    for (const c of [this.canvas, this.base]) {
      c.width = Math.round(this.w * this.dpr);
      c.height = Math.round(this.h * this.dpr);
    }
    const g = this.base.getContext('2d')!;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const k = this.depth / 12;
    const mix = (a: number[], b: number[]) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
    const top = mix([12, 52, 62], [10, 18, 40]);
    const mid = mix([5, 26, 32], [6, 10, 26]);
    const bottom = mix([2, 9, 12], [2, 3, 10]);
    const grad = g.createLinearGradient(0, 0, 0, this.h);
    grad.addColorStop(0, `rgb(${top})`);
    grad.addColorStop(0.45, `rgb(${mid})`);
    grad.addColorStop(1, `rgb(${bottom})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, this.w, this.h);

    // Deterministic random so resizes don't reshuffle the sea floor.
    let seed = 4242;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    // Distant rock spires and kelp at the bottom, in flat silhouette.
    g.fillStyle = `rgb(${mix([3, 15, 19], [3, 6, 16])})`;
    g.beginPath();
    g.moveTo(0, this.h);
    let x = 0;
    while (x < this.w + 60) {
      const peak = this.h - (40 + rand() * rand() * 220);
      const wdt = 40 + rand() * 120;
      g.quadraticCurveTo(x + wdt * 0.5, peak, x + wdt, this.h - 20 - rand() * 30);
      x += wdt;
    }
    g.lineTo(this.w, this.h);
    g.closePath();
    g.fill();
    g.strokeStyle = `rgb(${mix([6, 26, 28], [5, 9, 20])})`;
    g.lineCap = 'round';
    for (let i = 0; i < Math.round(this.w / 70); i++) {
      const kx = rand() * this.w;
      const kh = 60 + rand() * 160;
      g.lineWidth = 2 + rand() * 3;
      g.beginPath();
      g.moveTo(kx, this.h);
      g.bezierCurveTo(kx - 20, this.h - kh * 0.4, kx + 25, this.h - kh * 0.7, kx - 5 + rand() * 10, this.h - kh);
      g.stroke();
    }

    this.snow = Array.from({ length: Math.round((this.w * this.h) / 9000) }, () => ({
      x: rand() * this.w,
      y: rand() * this.h,
      r: 0.5 + rand() ** 2 * 1.6,
      vy: 0.08 + rand() * 0.25,
      phase: rand() * Math.PI * 2,
      a: 0.15 + rand() * 0.4,
    }));
    this.draw(performance.now(), true);
    this.schedule();
  }

  private schedule(): void {
    cancelAnimationFrame(this.raf);
    if (!this.canvas) return;
    if (!this.enabled || document.hidden || prefersReducedMotion()) {
      this.draw(performance.now(), true);
      return;
    }
    const loop = (t: number) => {
      if (t - this.lastDraw > 41) {
        this.lastDraw = t;
        this.draw(t, false);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private draw(t: number, still: boolean): void {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(this.base, 0, 0);
    if (!this.enabled) return;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const s = t / 1000;
    const k = 1 - (this.depth / 12) * 0.7;

    // Light shafts from the surface, slowly swaying.
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {
      const cx = this.w * (0.08 + i * 0.17) + Math.sin(s * 0.15 + i * 1.7) * 60;
      const spread = 60 + ((i * 37) % 70);
      const lean = 120 + Math.sin(s * 0.1 + i) * 40;
      const len = this.h * (0.55 + ((i * 13) % 30) / 100);
      const grad = g.createLinearGradient(0, 0, 0, len);
      const alpha = (0.035 + 0.02 * Math.sin(s * 0.4 + i * 2)) * k;
      grad.addColorStop(0, `rgba(180,255,235,${alpha})`);
      grad.addColorStop(1, 'rgba(180,255,235,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(cx - 18, 0);
      g.lineTo(cx + 18, 0);
      g.lineTo(cx + lean + spread, len);
      g.lineTo(cx + lean - spread, len);
      g.closePath();
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';

    // Marine snow drifting down.
    for (const p of this.snow) {
      if (!still) {
        p.y += p.vy;
        if (p.y > this.h + 4) {
          p.y = -4;
          p.x = Math.random() * this.w;
        }
      }
      g.fillStyle = `rgba(200,235,225,${p.a})`;
      g.beginPath();
      g.arc(p.x + Math.sin(s * 0.5 + p.phase) * 6, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }

    // Now and then a vent somewhere far off lets out a string of bubbles.
    if (!still && Math.random() < 0.012) this.column.push({ x: Math.random() * this.w, y: this.h + 10, t: 0 });
    for (let i = this.column.length - 1; i >= 0; i--) {
      const c = this.column[i];
      c.t++;
      c.y -= 2.2;
      if (c.y < -20) {
        this.column.splice(i, 1);
        continue;
      }
      for (let j = 0; j < 5; j++) {
        const by = c.y + j * 22;
        const bx = c.x + Math.sin((c.t + j * 9) * 0.1) * 4;
        g.strokeStyle = `rgb(${this.accent} / 0.18)`;
        g.lineWidth = 1;
        g.beginPath();
        g.arc(bx, by, 2 + j * 0.6, 0, Math.PI * 2);
        g.stroke();
      }
    }
  }
}

export const sky = new Ocean();
