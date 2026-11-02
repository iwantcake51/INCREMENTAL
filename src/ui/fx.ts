import { prefersReducedMotion } from './dom';

/* ==========================================================================
   Foreground effects: sparks, floating numbers and shockwave rings.
   Pooled objects, one canvas, and the loop sleeps when nothing is alive.
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

interface Streak {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  len: number;
}

const MAX_SPARKS = 700;
const MAX_FLOATERS = 26;

class Fx {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private sparks: Spark[] = [];
  private pool: Spark[] = [];
  private floaters: Floater[] = [];
  private rings: Ring[] = [];
  private streaks: Streak[] = [];
  /** Live comet tails, owned by the stage (arrays of recent head positions). */
  tails: { x: number; y: number }[][] = [];
  private running = false;
  private last = 0;
  particles = true;
  floatingText = true;
  hue = 40;

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

  burst(x: number, y: number, count: number, opts: { hue?: number; speed?: number; size?: number; light?: number; grav?: number; spread?: number } = {}): void {
    if (!this.particles) return;
    const reduced = prefersReducedMotion();
    const n = Math.min(reduced ? Math.ceil(count / 3) : count, MAX_SPARKS - this.sparks.length);
    const speed = opts.speed ?? 3;
    for (let i = 0; i < n; i++) {
      const p = this.spark();
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.9);
      p.x = x + (Math.random() - 0.5) * (opts.spread ?? 0);
      p.y = y + (Math.random() - 0.5) * (opts.spread ?? 0);
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.life = 0;
      p.max = 28 + Math.random() * 30;
      p.size = (opts.size ?? 2) * (0.6 + Math.random() * 0.8);
      p.hue = (opts.hue ?? this.hue) + (Math.random() - 0.5) * 24;
      p.light = opts.light ?? 70;
      p.drag = 0.93 + Math.random() * 0.03;
      p.grav = opts.grav ?? 0.04;
      this.sparks.push(p);
    }
    this.wake();
  }

  /** A soft trail puff (comet tails). */
  trail(x: number, y: number, hue = this.hue): void {
    if (!this.particles || this.sparks.length >= MAX_SPARKS) return;
    const p = this.spark();
    p.x = x + (Math.random() - 0.5) * 8;
    p.y = y + (Math.random() - 0.5) * 8;
    p.vx = (Math.random() - 0.5) * 0.4;
    p.vy = (Math.random() - 0.5) * 0.4;
    p.life = 0;
    p.max = 30 + Math.random() * 25;
    p.size = 2 + Math.random() * 3;
    p.hue = hue;
    p.light = 78;
    p.drag = 0.97;
    p.grav = 0;
    this.sparks.push(p);
    this.wake();
  }

  /** A falling meteor: bright head, fading tail, small burst when it burns out. */
  streak(x: number, y: number): void {
    if (!this.particles || this.streaks.length > 24) return;
    const speed = 9 + Math.random() * 6;
    const ang = (110 + Math.random() * 20) * (Math.PI / 180);
    this.streaks.push({ x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed, life: 0, max: 40 + Math.random() * 30, len: 9 + Math.random() * 6 });
    this.wake();
  }

  float(x: number, y: number, text: string, opts: { size?: number; color?: string; weight?: number; life?: number } = {}): void {
    if (!this.floatingText) return;
    if (this.floaters.length >= MAX_FLOATERS) this.floaters.shift();
    this.floaters.push({
      x: x + (Math.random() - 0.5) * 56,
      y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 0.7,
      vy: -1.25 - Math.random() * 0.7,
      life: 0,
      max: opts.life ?? 62,
      text,
      size: opts.size ?? 18,
      color: opts.color ?? '#fff3d6',
      weight: opts.weight ?? 600,
    });
    this.wake();
  }

  ring(x: number, y: number, to: number, color = 'rgba(255,230,180,0.8)', width = 2, frames = 36): void {
    if (!this.particles) return;
    this.rings.push({ x, y, r: 6, to, life: 0, max: frames, color, width });
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

    // Sparks — additive blending gives the glow for free.
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
      ctx.fillStyle = `hsl(${p.hue} 90% ${p.light}% / ${t})`;
      const s = p.size * (0.4 + t * 0.6);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
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

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const pts of this.tails) {
      // Draw the tail as tapered segments, brightest at the head.
      for (let i = 1; i < pts.length; i++) {
        const t = i / pts.length;
        ctx.strokeStyle = `hsl(${this.hue} 90% ${70 + t * 25}% / ${t * t * 0.85})`;
        ctx.lineWidth = 1 + t * 9;
        ctx.beginPath();
        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
        ctx.lineTo(pts[i].x, pts[i].y);
        ctx.stroke();
      }
    }
    for (let i = this.streaks.length - 1; i >= 0; i--) {
      const m = this.streaks[i];
      m.life += step;
      if (m.life >= m.max) {
        this.streaks.splice(i, 1);
        continue;
      }
      m.x += m.vx * step;
      m.y += m.vy * step;
      const t = m.life / m.max;
      const a = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      const tx = m.x - m.vx * m.len;
      const ty = m.y - m.vy * m.len;
      const grad = ctx.createLinearGradient(m.x, m.y, tx, ty);
      grad.addColorStop(0, `rgba(255,246,225,${a})`);
      grad.addColorStop(0.25, `rgba(255,190,110,${a * 0.6})`);
      grad.addColorStop(1, 'rgba(255,140,60,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    }

    // Floating numbers
    ctx.globalCompositeOperation = 'source-over';
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
      ctx.font = `${f.weight} ${f.size * pop}px 'Instrument Sans Variable', system-ui, sans-serif`;
      ctx.shadowColor = 'rgba(4,6,12,0.9)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    if (this.sparks.length || this.floaters.length || this.rings.length || this.streaks.length || this.tails.length) requestAnimationFrame(this.frame);
    else {
      ctx.clearRect(0, 0, this.w, this.h);
      this.running = false;
    }
  };
}

export const fx = new Fx();

/* ==========================================================================
   Background sky: a static star chart (graticule + faint stars) cached to an
   offscreen canvas, plus a handful of twinkling stars and rare shooting stars.
   Throttled to ~24fps and fully paused when hidden or disabled.
   ========================================================================== */

interface Twinkle {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
}
interface Shooter {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

class Sky {
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private base!: HTMLCanvasElement;
  private twinkles: Twinkle[] = [];
  private shooter: Shooter | null = null;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private enabled = true;
  private raf = 0;
  private lastDraw = 0;
  private center = { x: 0.3, y: 0.45 };
  private accent = '214 165 72';

  init(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.base = document.createElement('canvas');
    addEventListener('resize', () => this.build());
    document.addEventListener('visibilitychange', () => this.schedule());
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.canvas.style.opacity = on ? '1' : '0';
    this.schedule();
  }

  /** Center the chart's graticule behind the star. */
  setCenter(x: number, y: number): void {
    this.center = { x, y };
    this.build();
  }

  setAccent(rgb: string): void {
    this.accent = rgb.trim().replace(/,/g, ' ');
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
    g.clearRect(0, 0, this.w, this.h);

    const cx = this.center.x * this.w;
    const cy = this.center.y * this.h;
    const maxR = Math.hypot(this.w, this.h);
    // Graticule: concentric declination circles and right-ascension spokes.
    g.lineWidth = 1;
    for (let r = 220, i = 0; r < maxR; r += 130, i++) {
      g.strokeStyle = `rgb(${this.accent} / ${i % 3 === 0 ? 0.075 : 0.035})`;
      g.setLineDash(i % 3 === 0 ? [] : [2, 7]);
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.setLineDash([]);
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      g.strokeStyle = `rgb(${this.accent} / ${a % 6 === 0 ? 0.06 : 0.025})`;
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * 220, cy + Math.sin(ang) * 220);
      g.lineTo(cx + Math.cos(ang) * maxR, cy + Math.sin(ang) * maxR);
      g.stroke();
    }
    // Faint field stars (deterministic so resizes don't reshuffle the sky).
    let seed = 1337;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const count = Math.round((this.w * this.h) / 2600);
    for (let i = 0; i < count; i++) {
      const x = rand() * this.w;
      const y = rand() * this.h;
      const r = rand() ** 3 * 1.3 + 0.25;
      const warm = rand() > 0.7;
      g.fillStyle = warm ? `rgba(255,226,180,${0.15 + rand() * 0.45})` : `rgba(210,222,255,${0.12 + rand() * 0.4})`;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
    this.twinkles = Array.from({ length: Math.round(count / 14) }, () => ({
      x: rand() * this.w,
      y: rand() * this.h,
      r: 0.8 + rand() * 1.4,
      phase: rand() * Math.PI * 2,
      speed: 0.6 + rand() * 1.6,
    }));
    this.draw(performance.now());
    this.schedule();
  }

  private schedule(): void {
    cancelAnimationFrame(this.raf);
    if (!this.enabled || document.hidden || prefersReducedMotion()) {
      if (this.enabled) this.draw(performance.now());
      return;
    }
    const loop = (t: number) => {
      if (t - this.lastDraw > 41) {
        this.lastDraw = t;
        this.draw(t);
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  private draw(t: number): void {
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.base, 0, 0);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const s = t / 1000;
    for (const tw of this.twinkles) {
      const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(tw.phase + s * tw.speed)) ** 3;
      g.fillStyle = `rgba(255,248,230,${a})`;
      g.beginPath();
      g.arc(tw.x, tw.y, tw.r, 0, Math.PI * 2);
      g.fill();
      if (a > 0.85) {
        g.strokeStyle = `rgba(255,248,230,${(a - 0.85) * 2.5})`;
        g.lineWidth = 0.6;
        g.beginPath();
        g.moveTo(tw.x - tw.r * 4, tw.y);
        g.lineTo(tw.x + tw.r * 4, tw.y);
        g.moveTo(tw.x, tw.y - tw.r * 4);
        g.lineTo(tw.x, tw.y + tw.r * 4);
        g.stroke();
      }
    }
    // Rare ambient shooting star.
    if (!this.shooter && Math.random() < 0.0025) {
      this.shooter = { x: Math.random() * this.w, y: Math.random() * this.h * 0.5, vx: 9 + Math.random() * 6, vy: 3 + Math.random() * 3, life: 0 };
    }
    const sh = this.shooter;
    if (sh) {
      sh.life++;
      sh.x += sh.vx;
      sh.y += sh.vy;
      const grad = g.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * 9, sh.y - sh.vy * 9);
      const fade = Math.max(0, 1 - sh.life / 40);
      grad.addColorStop(0, `rgba(255,245,220,${0.9 * fade})`);
      grad.addColorStop(1, 'rgba(255,245,220,0)');
      g.strokeStyle = grad;
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(sh.x, sh.y);
      g.lineTo(sh.x - sh.vx * 9, sh.y - sh.vy * 9);
      g.stroke();
      if (sh.life > 40) this.shooter = null;
    }
  }
}

export const sky = new Sky();
