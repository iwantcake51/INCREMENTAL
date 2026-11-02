import type { Game } from '../core/game';
import { Dive, HAZARDS, W, UNITS_PER_M, type DiveSignal, type Ent } from '../core/dive';
import { ZONES, zoneAt, zoneIndex } from '../data/zones';
import { fmt, fmtInt } from '../core/format';
import { ICON_PATHS } from './icons.gen';
import { h, setText, toggle, replay, prefersReducedMotion } from './dom';
import { ic } from './icons';
import { sound } from './audio';

/* ==========================================================================
   The dive screen: canvas renderer, input and HUD on top of a core Dive.
   ========================================================================== */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'spark' | 'bubble' | 'text';
  text?: string;
}

const paths = new Map<string, Path2D>();
function iconPath(name: string): Path2D {
  let p = paths.get(name);
  if (!p) {
    p = new Path2D(ICON_PATHS[name] ?? '');
    paths.set(name, p);
  }
  return p;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const mixRgb = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(lerp(v, b[i], t)));

export class DiveView {
  private root = h('div', { class: 'dive', hidden: true, 'aria-label': 'Dive' });
  private canvas = h('canvas', { class: 'dive-canvas' }) as HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private darkCanvas = document.createElement('canvas');
  private dark: CanvasRenderingContext2D;
  private dive: Dive | null = null;
  private raf = 0;
  private last = 0;
  private paused = false;
  private dpr = 1;
  private vw = 0;
  private vh = 0;
  private scale = 1;
  private camX = 0;
  private camY = 0;
  private particles: Particle[] = [];
  private shake = 0;
  private hurtFlash = 0;
  private flareFx: { x: number; y: number; r: number; t: number } | null = null;
  private zaps: { x1: number; y1: number; x2: number; y2: number; t: number }[] = [];
  private snow: { x: number; y: number; z: number }[] = [];
  private keys = new Set<string>();
  private pointerDown = false;
  private hud!: Record<string, HTMLElement>;
  private haulShown = 0;

  constructor(
    private game: Game,
    private onEnd: () => void,
  ) {
    this.ctx = this.canvas.getContext('2d', { alpha: false })!;
    this.dark = this.darkCanvas.getContext('2d')!;
    this.buildHud();
    this.root.prepend(this.canvas);
    document.body.append(this.root);
    for (let i = 0; i < 90; i++) this.snow.push({ x: Math.random(), y: Math.random(), z: 0.3 + Math.random() * 0.7 });
    this.bindInput();
    addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.dive && !this.paused) this.setPaused(true);
    });
  }

  get active(): boolean {
    return !!this.dive;
  }

  /* ------------------------------------------------------------ HUD */
  private buildHud(): void {
    const hud = h('div', { class: 'dive-hud' });
    hud.innerHTML = `
      <div class="hud-depth"><div class="hud-depth-v"><span data-k="depth">0</span><small>m</small></div><div class="hud-zone" data-k="zone"></div></div>
      <div class="hud-mid">
        <div class="hud-air"><span class="hud-ic">${ic('air-zigzag')}</span><div class="hud-bar"><div class="hud-bar-fill" data-k="air"></div></div><span class="hud-air-t" data-k="airT"></span></div>
        <div class="hud-hull" data-k="hull"></div>
      </div>
      <div class="hud-right">
        <div class="hud-haul"><span data-k="haul">0</span><small>lumen this dive</small></div>
        <div class="hud-streak" data-k="streak"></div>
        <div class="hud-btns">
          <button class="icon-btn" type="button" data-k="pause" aria-label="Pause (Esc)" data-tip="Pause (Esc)">${ic('pause-button')}</button>
          <button class="btn btn-sm hud-surface" type="button" data-k="surface">${ic('anchor')} Surface</button>
        </div>
      </div>
      <div class="hud-event" data-k="event" hidden></div>
      <div class="hud-abilities">
        <button class="ability" type="button" data-k="dash" aria-label="Dash (Space)"><span class="ability-ic">${ic('rocket-thruster')}</span><span class="ability-key">Space</span><span class="ability-charges" data-k="charges"></span></button>
        <button class="ability" type="button" data-k="flare" aria-label="Flare (F)"><span class="ability-ic">${ic('sun-radiations')}</span><span class="ability-key">F</span></button>
      </div>
      <div class="hud-low" data-k="low" hidden>Low air</div>
      <div class="dive-pause" data-k="pauseScreen" hidden>
        <div class="dive-pause-card">
          <h2>Paused</h2>
          <p>Surfacing keeps everything you have collected.</p>
          <div class="btn-row"><button class="btn" type="button" data-k="resume">Keep diving</button><button class="btn btn-ghost" type="button" data-k="surface2">${ic('anchor')} Surface now</button></div>
        </div>
      </div>`;
    this.root.append(hud);
    this.hud = {};
    hud.querySelectorAll<HTMLElement>('[data-k]').forEach((el) => (this.hud[el.dataset.k!] = el));
    const stop = (e: Event) => e.stopPropagation();
    for (const k of ['pause', 'surface', 'dash', 'flare', 'resume', 'surface2']) this.hud[k].addEventListener('pointerdown', stop);
    this.hud.pause.addEventListener('click', () => this.setPaused(!this.paused));
    this.hud.resume.addEventListener('click', () => this.setPaused(false));
    this.hud.surface.addEventListener('click', () => this.dive?.surface());
    this.hud.surface2.addEventListener('click', () => {
      this.setPaused(false);
      this.dive?.surface();
    });
    this.hud.dash.addEventListener('click', () => this.dive?.dash());
    this.hud.flare.addEventListener('click', () => this.dive?.flare());
  }

  /* ------------------------------------------------------------ input */
  private toWorld(cx: number, cy: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    return [(cx - r.left) / this.scale + this.camX, (cy - r.top) / this.scale + this.camY];
  }

  private bindInput(): void {
    const c = this.canvas;
    const aim = (e: PointerEvent) => {
      if (!this.dive) return;
      const follow = this.game.s.settings.steer === 'follow' && e.pointerType === 'mouse';
      if (!follow && !this.pointerDown) return;
      const [x, y] = this.toWorld(e.clientX, e.clientY);
      this.dive.input.mode = 'pointer';
      this.dive.input.tx = x;
      this.dive.input.ty = y;
    };
    c.addEventListener('pointerdown', (e) => {
      this.pointerDown = true;
      c.setPointerCapture(e.pointerId);
      sound.unlock();
      aim(e);
    });
    c.addEventListener('pointermove', aim);
    const up = (e: PointerEvent) => {
      this.pointerDown = false;
      if (this.dive && (e.pointerType !== 'mouse' || this.game.s.settings.steer === 'hold')) this.dive.input.mode = 'none';
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());

    addEventListener('keydown', (e) => {
      if (!this.dive) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') {
        e.preventDefault();
        this.setPaused(!this.paused);
        return;
      }
      if (this.paused) return;
      if (k === ' ' || k === 'shift') {
        e.preventDefault();
        if (!e.repeat) this.dive.dash();
        return;
      }
      if (k === 'f' && !e.repeat) {
        this.dive.flare();
        return;
      }
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        e.preventDefault();
        this.keys.add(k);
        this.syncKeys();
      }
    });
    addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
      if (this.dive) this.syncKeys();
    });
  }

  private syncKeys(): void {
    if (!this.dive) return;
    const has = (...k: string[]) => k.some((x) => this.keys.has(x));
    const kx = (has('d', 'arrowright') ? 1 : 0) - (has('a', 'arrowleft') ? 1 : 0);
    const ky = (has('s', 'arrowdown') ? 1 : 0) - (has('w', 'arrowup') ? 1 : 0);
    this.dive.input.kx = kx;
    this.dive.input.ky = ky;
    if (kx || ky) this.dive.input.mode = 'keys';
    else if (this.dive.input.mode === 'keys') this.dive.input.mode = 'none';
  }

  private setPaused(p: boolean): void {
    if (!this.dive) return;
    this.paused = p;
    this.hud.pauseScreen.hidden = !p;
    if (!p) this.last = performance.now();
  }

  /* ------------------------------------------------------------ lifecycle */
  start(dive: Dive): void {
    this.dive = dive;
    this.particles = [];
    this.zaps = [];
    this.flareFx = null;
    this.paused = false;
    this.keys.clear();
    this.haulShown = 0;
    this.hud.pauseScreen.hidden = true;
    this.hud.low.hidden = true;
    this.root.hidden = false;
    document.documentElement.classList.add('diving');
    this.resize();
    this.hud.dash.hidden = !dive.m.dash;
    this.hud.flare.hidden = !dive.m.flare;
    const ev = dive.ev;
    this.hud.event.hidden = !ev;
    if (ev) {
      this.hud.event.innerHTML = `<span class="hud-ic">${ic(ev.icon)}</span><div><b>${ev.name}</b><span>${ev.desc}</span></div>`;
      replay(this.hud.event, 'show');
    }
    dive.on((sig) => this.onSignal(sig));
    this.last = performance.now();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
    this.canvas.focus?.();
  }

  private stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.dive = null;
    this.root.hidden = true;
    document.documentElement.classList.remove('diving');
  }

  private resize(): void {
    this.dpr = Math.min(2, devicePixelRatio || 1);
    this.vw = innerWidth;
    this.vh = innerHeight;
    for (const c of [this.canvas, this.darkCanvas]) {
      c.width = Math.round(this.vw * this.dpr);
      c.height = Math.round(this.vh * this.dpr);
    }
    this.canvas.style.width = `${this.vw}px`;
    this.canvas.style.height = `${this.vh}px`;
    this.scale = Math.max(0.58, Math.min(1.3, this.vw / W));
  }

  /* ------------------------------------------------------------ signals → feedback */
  private haptic(p: number | number[]): void {
    if (this.game.s.settings.haptics) navigator.vibrate?.(p);
  }

  private onSignal(sig: DiveSignal): void {
    switch (sig.type) {
      case 'mote':
        sound.click(sig.streak * 3, false);
        this.burst(sig.x, sig.y, 5, 'rgba(160,255,225,0.9)', 2.2);
        if (this.game.s.settings.floatingText && (sig.streak % 5 === 0 || sig.value >= this.dive!.lumen * 0.05)) this.text(sig.x, sig.y - 14, `+${fmt(sig.value)}`, '#d7fff1');
        break;
      case 'fish':
        sound.cometCatch();
        this.haptic([10, 30, 10]);
        this.burst(sig.x, sig.y, 26, 'rgba(255,220,140,0.95)', 3);
        this.text(sig.x, sig.y - 20, `Glimmerfish +${fmt(sig.value)}`, '#ffcf6e', 18);
        break;
      case 'air':
        sound.bubble();
        this.bubbles(sig.x, sig.y, 8);
        this.text(sig.x, sig.y - 16, `+${sig.value.toFixed(0)}s air`, '#9fe8ff', 14);
        break;
      case 'chest':
        sound.achievement();
        this.haptic([20, 40, 20]);
        this.burst(sig.x, sig.y, 40, 'rgba(255,214,120,0.95)', 3.4);
        this.text(sig.x, sig.y - 24, `Treasure +${fmt(sig.value)}`, '#ffcf6e', 20);
        if (sig.pearl) this.text(sig.x, sig.y - 50, '+1 Black Pearl!', '#c9b8ff', 20);
        break;
      case 'hurt':
        sound.hurt();
        this.haptic(60);
        this.shake = 0.35;
        this.hurtFlash = 1;
        this.burst(sig.x, sig.y, 18, 'rgba(255,140,120,0.9)', 3);
        replay(this.hud.hull, 'bump');
        break;
      case 'ram':
        sound.buy();
        this.burst(sig.x, sig.y, 16, 'rgba(255,255,255,0.9)', 2.5);
        break;
      case 'mark':
        sound.tick();
        this.text(this.dive!.sub.x, this.dive!.sub.y + 130, sig.record ? `${fmtInt(sig.depth)} m · new record!` : `${fmtInt(sig.depth)} m`, sig.record ? '#ffcf6e' : '#a7c2bb', sig.record ? 20 : 15);
        if (sig.record) sound.event(true);
        break;
      case 'zone':
        sound.event(sig.index < 3);
        this.showZone(sig.index);
        break;
      case 'dash':
        sound.dash();
        this.bubbles(this.dive!.sub.x, this.dive!.sub.y, 14);
        break;
      case 'flare':
        sound.flare();
        this.haptic([20, 30, 20]);
        this.flareFx = { x: sig.x, y: sig.y, r: sig.radius, t: 0 };
        break;
      case 'zap':
        sound.zap();
        this.zaps.push({ x1: sig.x1, y1: sig.y1, x2: sig.x2, y2: sig.y2, t: 0 });
        break;
      case 'lowair':
        sound.alarm();
        this.hud.low.hidden = false;
        break;
      case 'end':
        this.render(0); // final frame behind the summary
        setTimeout(() => {
          this.stop();
          this.onEnd();
        }, sig.result.reason === 'breach' ? 650 : 250);
        if (sig.result.reason === 'breach') {
          sound.rebirth();
          this.shake = 0.8;
        }
        break;
    }
  }

  private showZone(index: number): void {
    const z = ZONES[index];
    this.hud.event.hidden = false;
    this.hud.event.innerHTML = `<span class="hud-ic">${ic('high-tide')}</span><div><b>${z.name}</b><span>${z.blurb}</span></div>`;
    replay(this.hud.event, 'show');
  }

  /* ------------------------------------------------------------ particles */
  private burst(x: number, y: number, n: number, color: string, size: number): void {
    if (!this.game.s.settings.particles) return;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 40 + Math.random() * 140;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.4 + Math.random() * 0.4, size: size * (0.5 + Math.random()), color, kind: 'spark' });
    }
  }

  private bubbles(x: number, y: number, n: number): void {
    if (!this.game.s.settings.particles) return;
    for (let i = 0; i < n; i++) {
      this.particles.push({ x: x + (Math.random() - 0.5) * 20, y: y + (Math.random() - 0.5) * 20, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 80, life: 0, max: 0.8 + Math.random() * 0.8, size: 2 + Math.random() * 4, color: '', kind: 'bubble' });
    }
  }

  private text(x: number, y: number, text: string, color: string, size = 15): void {
    if (!this.game.s.settings.floatingText) return;
    this.particles.push({ x, y, vx: 0, vy: -40, life: 0, max: 1.2, size, color, kind: 'text', text });
  }

  /* ------------------------------------------------------------ loop */
  private frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.max(0, Math.min(0.05, (now - this.last) / 1000));
    this.last = now;
    const d = this.dive;
    if (!d) return;
    if (!this.paused) {
      // fixed sub-steps keep collisions stable at low frame rates
      let left = dt;
      while (left > 0 && !d.over) {
        const step = Math.min(left, 1 / 60);
        d.step(step);
        left -= step;
      }
      // propeller wash
      const sp = Math.hypot(d.sub.vx, d.sub.vy);
      if (this.game.s.settings.particles && sp > 60 && Math.random() < sp / 900) {
        this.particles.push({ x: d.sub.x - d.sub.facing * 26, y: d.sub.y + (Math.random() - 0.5) * 8, vx: -d.sub.facing * 30, vy: -20 - Math.random() * 30, life: 0, max: 0.9, size: 1.5 + Math.random() * 2.5, color: '', kind: 'bubble' });
      }
    }
    this.render(this.paused ? 0 : dt);
  };

  private render(dt: number): void {
    const d = this.dive;
    if (!d) return;
    const g = this.ctx;
    const { vw, vh, scale, dpr } = this;
    const s = d.sub;
    const viewW = vw / scale;
    const viewH = vh / scale;
    this.camX = viewW >= W ? (W - viewW) / 2 : Math.max(0, Math.min(W - viewW, s.x - viewW / 2));
    const targetY = s.y - viewH * 0.42;
    this.camY = lerp(this.camY || targetY, targetY, 0.15);
    let sx = 0;
    let sy = 0;
    if (this.shake > 0 && !prefersReducedMotion()) {
      sx = (Math.random() - 0.5) * 14 * this.shake;
      sy = (Math.random() - 0.5) * 14 * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.6);
    }
    const camX = this.camX + sx / scale;
    const camY = this.camY + sy / scale;
    const depth = d.depthM(camY + viewH / 2);
    const zi = zoneIndex(depth);
    const z = ZONES[zi];
    const next = ZONES[zi + 1];
    const t = next ? Math.min(1, Math.max(0, (depth - z.from) / (next.from - z.from))) : 0;
    const top = mixRgb(z.top, next ? next.top : z.bottom, t);
    const bot = mixRgb(z.bottom, next ? next.bottom : z.bottom, t);

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = g.createLinearGradient(0, 0, 0, vh);
    bg.addColorStop(0, `rgb(${top})`);
    bg.addColorStop(1, `rgb(${bot})`);
    g.fillStyle = bg;
    g.fillRect(0, 0, vw, vh);

    // Sunlight shafts near the surface
    const sun = Math.max(0, 1 - depth / 220);
    if (sun > 0) {
      g.globalCompositeOperation = 'lighter';
      const tt = performance.now() / 1000;
      for (let i = 0; i < 5; i++) {
        const x = vw * (0.1 + i * 0.2) + Math.sin(tt * 0.2 + i) * 40;
        const grad = g.createLinearGradient(0, 0, 0, vh);
        grad.addColorStop(0, `rgba(200,255,240,${0.07 * sun})`);
        grad.addColorStop(1, 'rgba(200,255,240,0)');
        g.fillStyle = grad;
        g.beginPath();
        g.moveTo(x - 20, 0);
        g.lineTo(x + 20, 0);
        g.lineTo(x + 140, vh);
        g.lineTo(x - 40, vh);
        g.closePath();
        g.fill();
      }
      g.globalCompositeOperation = 'source-over';
    }

    // Marine snow (parallax)
    g.fillStyle = 'rgba(210,240,230,0.35)';
    for (const p of this.snow) {
      const py = (((p.y * vh - camY * scale * p.z * 0.6) % vh) + vh) % vh;
      const px = (((p.x * vw - camX * scale * p.z * 0.6) % vw) + vw) % vw;
      g.fillRect(px, py, 1.4 * p.z, 1.4 * p.z);
    }

    g.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * dpr * scale, -camY * dpr * scale);

    // Surface line
    if (camY < 40) {
      g.fillStyle = 'rgba(220,255,245,0.25)';
      g.fillRect(-200, 0, W + 400, 3);
    }

    // Walls
    const y0 = camY - 40;
    const y1 = camY + viewH + 40;
    const rock = mixRgb(bot, [0, 0, 0], 0.55);
    const edge = mixRgb(top, [255, 255, 255], 0.08);
    g.fillStyle = `rgb(${rock})`;
    g.strokeStyle = `rgb(${edge})`;
    g.lineWidth = 3 / scale;
    for (const side of [0, 1]) {
      g.beginPath();
      g.moveTo(side ? W + 400 : -400, y0);
      for (let y = y0; y <= y1; y += 24) g.lineTo(side ? d.wallR(y) : d.wallL(y), y);
      g.lineTo(side ? W + 400 : -400, y1);
      g.closePath();
      g.fill();
      g.beginPath();
      for (let y = y0; y <= y1; y += 24) {
        const x = side ? d.wallR(y) : d.wallL(y);
        if (y === y0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }

    // Depth markers on the left wall
    g.font = `600 ${13 / scale}px 'Bricolage Grotesque Variable', sans-serif`;
    g.fillStyle = 'rgba(220,245,235,0.35)';
    for (let m = Math.ceil(d.depthM(y0) / 50) * 50; m * UNITS_PER_M < y1; m += 50) {
      const y = m * UNITS_PER_M;
      g.fillRect(d.wallL(y) - 6, y, 14, 2 / scale);
      g.fillText(`${m} m`, d.wallL(y) + 12, y + 4);
    }
    // Record line
    const rec = this.game.s.deepest * UNITS_PER_M;
    if (rec > y0 && rec < y1 && rec > 0) {
      g.strokeStyle = 'rgba(255,207,110,0.5)';
      g.setLineDash([10, 10]);
      g.beginPath();
      g.moveTo(d.wallL(rec), rec);
      g.lineTo(d.wallR(rec), rec);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = 'rgba(255,207,110,0.8)';
      g.fillText('your record', d.wallR(rec) - 90, rec - 6);
    }

    const now = performance.now() / 1000;
    const visible = d.ents.filter((e) => e.y > y0 - 60 && e.y < y1 + 60);
    for (const e of visible) this.drawEnt(e, now);
    this.drawSub(d, now);

    // Darkness, with holes for the lamp and anything that glows
    const darkness = Math.min(0.97, z.dark + (next ? (next.dark - z.dark) * t : 0) + (d.ev?.dark ?? 0));
    if (darkness > 0.02) {
      const dk = this.dark;
      dk.setTransform(1, 0, 0, 1, 0, 0);
      dk.clearRect(0, 0, this.darkCanvas.width, this.darkCanvas.height);
      dk.globalCompositeOperation = 'source-over';
      dk.fillStyle = `rgba(1,4,8,${darkness})`;
      dk.fillRect(0, 0, this.darkCanvas.width, this.darkCanvas.height);
      dk.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * dpr * scale, -camY * dpr * scale);
      dk.globalCompositeOperation = 'destination-out';
      const hole = (x: number, y: number, r: number, a = 1) => {
        const gr = dk.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, `rgba(0,0,0,${a})`);
        gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.75})`);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        dk.fillStyle = gr;
        dk.fillRect(x - r, y - r, r * 2, r * 2);
      };
      const lamp = 230 * d.m.light;
      hole(s.x + s.facing * 40, s.y + 10, lamp);
      for (const e of visible) {
        if (e.kind === 'mote') hole(e.x, e.y, 26, 0.9);
        else if (e.kind === 'fish') hole(e.x, e.y, 46, 0.9);
        else if (e.kind === 'chest') hole(e.x, e.y, 40, 0.6);
        else if (e.kind === 'air') hole(e.x, e.y, 22, 0.6);
        else if (e.kind === 'angler') hole(e.x + 22, e.y - 26, 30, 0.95);
        else if (e.kind === 'jelly') hole(e.x, e.y, 34, 0.45);
      }
      if (this.flareFx) hole(this.flareFx.x, this.flareFx.y, this.flareFx.r * (1 + this.flareFx.t), Math.max(0, 1 - this.flareFx.t));
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(this.darkCanvas, 0, 0);
      g.setTransform(dpr * scale, 0, 0, dpr * scale, -camX * dpr * scale, -camY * dpr * scale);
    }

    this.drawParticles(dt);
    this.drawFx(dt);

    // Sonar arrows and screen effects
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (d.m.sonar > 0) this.drawSonar(d, camX, camY);
    if (this.hurtFlash > 0) {
      const vg = g.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.3, vw / 2, vh / 2, Math.max(vw, vh) * 0.7);
      vg.addColorStop(0, 'rgba(255,60,40,0)');
      vg.addColorStop(1, `rgba(255,60,40,${0.45 * this.hurtFlash})`);
      g.fillStyle = vg;
      g.fillRect(0, 0, vw, vh);
      this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2.5);
    }
    if (s.air < s.maxAir * 0.25) {
      const pulse = 0.5 + 0.5 * Math.sin(now * 8);
      g.strokeStyle = `rgba(255,143,124,${0.25 + 0.3 * pulse})`;
      g.lineWidth = 8;
      g.strokeRect(4, 4, vw - 8, vh - 8);
    }
    this.updateHud(d, dt);
  }

  private drawEnt(e: Ent, now: number): void {
    const g = this.ctx;
    const stunned = e.stun > 0;
    switch (e.kind) {
      case 'mote': {
        const pulse = 0.75 + 0.25 * Math.sin(now * 4 + e.phase);
        g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(e.x, e.y, 0, e.x, e.y, 16);
        gr.addColorStop(0, `rgba(190,255,230,${0.95 * pulse})`);
        gr.addColorStop(0.3, `rgba(110,240,200,${0.5 * pulse})`);
        gr.addColorStop(1, 'rgba(110,240,200,0)');
        g.fillStyle = gr;
        g.fillRect(e.x - 16, e.y - 16, 32, 32);
        g.globalCompositeOperation = 'source-over';
        break;
      }
      case 'air': {
        g.strokeStyle = 'rgba(200,245,255,0.85)';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(e.x, e.y, e.r, 0, Math.PI * 2);
        g.stroke();
        g.fillStyle = 'rgba(200,245,255,0.15)';
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.arc(e.x - e.r * 0.35, e.y - e.r * 0.35, e.r * 0.25, 0, Math.PI * 2);
        g.fill();
        break;
      }
      case 'chest':
        this.icon('open-treasure-chest', e.x, e.y, 46, '#ffcf6e', 0, Math.sin(now * 3) * 0.08);
        if (e.pearl) {
          g.fillStyle = 'rgba(201,184,255,0.9)';
          g.beginPath();
          g.arc(e.x + 14, e.y - 18, 4 + Math.sin(now * 5) * 1.2, 0, Math.PI * 2);
          g.fill();
        }
        break;
      case 'fish':
        this.icon('clownfish', e.x, e.y, 40, '#ffe7a8', e.vx < 0 ? -1 : 1, Math.sin(now * 8 + e.phase) * 0.12, true);
        break;
      case 'jelly':
        this.icon('jellyfish', e.x, e.y, 50, stunned ? '#8aa0b0' : '#ff9ed2', 0, Math.sin(now * 1.5 + e.phase) * 0.1, !stunned);
        break;
      case 'eel':
        this.icon('eel', e.x, e.y, 54, stunned ? '#8aa0b0' : '#b8ff8a', e.dir, Math.sin(now * 6 + e.phase) * 0.15);
        break;
      case 'urchin':
        this.icon('sea-urchin', e.x, e.y, 42, stunned ? '#8aa0b0' : '#c9a0ff', 0, now * 0.3);
        break;
      case 'angler': {
        this.icon('angler-fish', e.x, e.y, 62, stunned ? '#556' : '#2a3a48', e.vx < 0 ? -1 : 1, 0);
        const hunting = (e.hunt ?? 0) > 0;
        g.globalCompositeOperation = 'lighter';
        const lx = e.x + (e.vx < 0 ? -22 : 22);
        const ly = e.y - 26;
        const gr = g.createRadialGradient(lx, ly, 0, lx, ly, 18);
        gr.addColorStop(0, hunting ? 'rgba(255,140,110,1)' : 'rgba(255,230,160,1)');
        gr.addColorStop(1, 'rgba(255,230,160,0)');
        g.fillStyle = gr;
        g.fillRect(lx - 18, ly - 18, 36, 36);
        g.globalCompositeOperation = 'source-over';
        break;
      }
    }
    if (stunned && HAZARDS.has(e.kind)) {
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 3; i++) {
        const a = now * 4 + (i * Math.PI * 2) / 3;
        g.fillRect(e.x + Math.cos(a) * 20 - 1.5, e.y - e.r - 8 + Math.sin(a) * 5 - 1.5, 3, 3);
      }
    }
  }

  private icon(name: string, x: number, y: number, size: number, color: string, flip: number, rot: number, glow = false): void {
    const g = this.ctx;
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    const sc = size / 512;
    g.scale(flip < 0 ? -sc : sc, sc);
    g.translate(-256, -256);
    if (glow) {
      g.shadowColor = color;
      g.shadowBlur = 18;
    }
    g.fillStyle = color;
    g.fill(iconPath(name));
    g.restore();
  }

  private drawSub(d: Dive, now: number): void {
    const g = this.ctx;
    const s = d.sub;
    const blink = s.inv > 0 && Math.floor(now * 14) % 2 === 0;
    g.save();
    g.translate(s.x, s.y);
    g.rotate(s.angle * s.facing);
    g.scale(s.facing, 1);
    if (blink) g.globalAlpha = 0.45;
    // lamp beam
    g.globalCompositeOperation = 'lighter';
    const beam = g.createLinearGradient(24, 0, 24 + 200 * d.m.light, 0);
    beam.addColorStop(0, 'rgba(255,240,190,0.35)');
    beam.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = beam;
    g.beginPath();
    g.moveTo(24, -4);
    g.lineTo(24 + 200 * d.m.light, -60 * d.m.light);
    g.lineTo(24 + 200 * d.m.light, 60 * d.m.light);
    g.lineTo(24, 4);
    g.closePath();
    g.fill();
    g.globalCompositeOperation = 'source-over';
    // hull
    g.fillStyle = '#e0a254';
    g.strokeStyle = '#6e4126';
    g.lineWidth = 2.5;
    g.beginPath();
    g.ellipse(0, 0, 30, 16, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // tower
    g.beginPath();
    g.roundRect(-10, -26, 20, 14, 4);
    g.fill();
    g.stroke();
    g.fillRect(-2, -34, 3, 9);
    // porthole
    g.fillStyle = '#0b2328';
    g.beginPath();
    g.arc(8, -1, 6.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#f5d3a6';
    g.lineWidth = 2;
    g.stroke();
    g.fillStyle = 'rgba(120,242,207,0.8)';
    g.beginPath();
    g.arc(6.5, -2.5, 2, 0, Math.PI * 2);
    g.fill();
    // rivets
    g.fillStyle = '#6e4126';
    for (const rx of [-18, -8, 18]) g.fillRect(rx, 7, 2, 2);
    // propeller
    const spin = Math.sin(now * (20 + Math.hypot(s.vx, s.vy) / 5));
    g.fillStyle = '#b8c4d6';
    g.fillRect(-36, -9 * Math.abs(spin) - 1, 4, 18 * Math.abs(spin) + 2);
    // lamp
    g.fillStyle = '#fff6d8';
    g.beginPath();
    g.arc(29, 0, 4, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  private drawParticles(dt: number): void {
    const g = this.ctx;
    const ps = this.particles;
    g.textAlign = 'center';
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.life += dt;
      if (p.life >= p.max) {
        ps.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = 1 - p.life / p.max;
      if (p.kind === 'spark') {
        p.vx *= 0.92;
        p.vy *= 0.92;
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = p.color.replace(/[\d.]+\)$/, `${t})`);
        g.beginPath();
        g.arc(p.x, p.y, p.size * (0.4 + 0.6 * t), 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = 'source-over';
      } else if (p.kind === 'bubble') {
        p.vy -= 30 * dt;
        g.strokeStyle = `rgba(214,255,244,${0.7 * t})`;
        g.lineWidth = 1.2;
        g.beginPath();
        g.arc(p.x + Math.sin(p.life * 8) * 2, p.y, p.size, 0, Math.PI * 2);
        g.stroke();
      } else {
        g.globalAlpha = t > 0.3 ? 1 : t / 0.3;
        g.font = `800 ${p.size}px 'Bricolage Grotesque Variable', sans-serif`;
        g.fillStyle = 'rgba(1,6,10,0.85)';
        g.fillText(p.text!, p.x, p.y + 2);
        g.fillStyle = p.color;
        g.fillText(p.text!, p.x, p.y);
        g.globalAlpha = 1;
      }
    }
    if (ps.length > 500) ps.splice(0, ps.length - 500);
  }

  private drawFx(dt: number): void {
    const g = this.ctx;
    if (this.flareFx) {
      const f = this.flareFx;
      f.t += dt * 1.4;
      if (f.t >= 1) this.flareFx = null;
      else {
        g.strokeStyle = `rgba(255,230,160,${1 - f.t})`;
        g.lineWidth = 6 * (1 - f.t);
        g.beginPath();
        g.arc(f.x, f.y, f.r * f.t, 0, Math.PI * 2);
        g.stroke();
      }
    }
    for (let i = this.zaps.length - 1; i >= 0; i--) {
      const z = this.zaps[i];
      z.t += dt;
      if (z.t > 0.25) {
        this.zaps.splice(i, 1);
        continue;
      }
      g.strokeStyle = `rgba(200,240,255,${1 - z.t * 4})`;
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(z.x1, z.y1);
      for (let k = 1; k < 6; k++) {
        const tt = k / 6;
        g.lineTo(lerp(z.x1, z.x2, tt) + (Math.random() - 0.5) * 24, lerp(z.y1, z.y2, tt) + (Math.random() - 0.5) * 24);
      }
      g.lineTo(z.x2, z.y2);
      g.stroke();
    }
  }

  private drawSonar(d: Dive, camX: number, camY: number): void {
    const g = this.ctx;
    const { vw, vh, scale } = this;
    const s = d.sub;
    const range = 1600;
    for (const e of d.ents) {
      const want = e.kind === 'fish' || e.kind === 'chest' || (d.m.sonar >= 2 && e.kind === 'air');
      if (!want) continue;
      const sx = (e.x - camX) * scale;
      const sy = (e.y - camY) * scale;
      if (sx > 0 && sx < vw && sy > 0 && sy < vh) continue;
      const dist = Math.hypot(e.x - s.x, e.y - s.y);
      if (dist > range) continue;
      const cx = vw / 2;
      const cy = vh / 2;
      const a = Math.atan2(sy - cy, sx - cx);
      const px = Math.max(24, Math.min(vw - 24, cx + Math.cos(a) * vw));
      const py = Math.max(80, Math.min(vh - 90, cy + Math.sin(a) * vh));
      const col = e.kind === 'chest' ? '255,207,110' : e.kind === 'fish' ? '255,231,168' : '160,230,255';
      g.save();
      g.translate(px, py);
      g.rotate(a);
      g.fillStyle = `rgba(${col},${0.35 + 0.5 * (1 - dist / range)})`;
      g.beginPath();
      g.moveTo(10, 0);
      g.lineTo(-6, -7);
      g.lineTo(-6, 7);
      g.closePath();
      g.fill();
      g.restore();
    }
  }

  private updateHud(d: Dive, dt: number): void {
    const s = d.sub;
    const h = this.hud;
    setText(h.depth, fmtInt(d.depthM()));
    setText(h.zone, zoneAt(d.depthM()).name);
    const airFrac = Math.max(0, s.air / s.maxAir);
    h.air.style.width = `${(airFrac * 100).toFixed(1)}%`;
    toggle(h.air, 'low', airFrac < 0.25);
    setText(h.airT, `${Math.max(0, s.air).toFixed(0)}s`);
    if (airFrac >= 0.3 && !h.low.hidden) h.low.hidden = true;
    const pips = `${'<span class="pip on"></span>'.repeat(Math.max(0, s.hull))}${'<span class="pip"></span>'.repeat(Math.max(0, s.maxHull - Math.max(0, s.hull)))}`;
    if (h.hull.dataset.v !== pips) {
      h.hull.dataset.v = pips;
      h.hull.innerHTML = pips;
    }
    this.haulShown = lerp(this.haulShown, d.lumen, Math.min(1, dt * 10));
    if (Math.abs(this.haulShown - d.lumen) < 0.5) this.haulShown = d.lumen;
    setText(h.haul, fmt(this.haulShown));
    const streakMult = 1 + d.streak * d.m.streakPer;
    setText(h.streak, d.streak >= 3 ? `Streak ${d.streak} · ×${streakMult.toFixed(2)}` : '');
    // ability cooldowns as a conic fill
    if (d.m.dash) {
      const ready = s.charges > 0;
      const frac = ready ? 1 : 1 - Math.max(0, s.dashCd) / d.m.dashCooldown;
      h.dash.style.setProperty('--cd', frac.toFixed(3));
      toggle(h.dash, 'ready', ready);
      setText(h.charges, d.m.dashCharges > 1 ? `${s.charges}` : '');
    }
    if (d.m.flare) {
      const frac = 1 - s.flareCd / d.m.flareCooldown;
      h.flare.style.setProperty('--cd', frac.toFixed(3));
      toggle(h.flare, 'ready', s.flareCd <= 0);
    }
  }
}

/** Short label for why a dive ended. */
export function endLabel(reason: 'surface' | 'air' | 'breach', keep: number): string {
  if (reason === 'surface') return 'You surfaced with the whole haul.';
  if (reason === 'air') return 'Out of air. The winch hauled you up, haul and all.';
  return `Hull breached! The escape pod saved ${Math.round(keep * 100)}% of the haul.`;
}

