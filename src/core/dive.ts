import type { Mods } from './mods';
import type { DiveEvent } from '../data/events';
import { moteValue, zoneIndex } from '../data/zones';

/* ==========================================================================
   One dive: a vertical slice of sea, generated in chunks as you go down.
   Pure simulation (no DOM) so it can be tested and played by a bot.
   World units: x in [0, W], y grows downward, 20 units = 1 metre.
   ========================================================================== */

export const W = 1000;
export const UNITS_PER_M = 20;
const CHUNK = 400;

export type EntKind = 'mote' | 'fish' | 'air' | 'chest' | 'jelly' | 'urchin' | 'eel' | 'angler';
export const HAZARDS: ReadonlySet<EntKind> = new Set(['jelly', 'urchin', 'eel', 'angler']);

export interface Ent {
  kind: EntKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  value: number;
  phase: number;
  homeY: number;
  stun: number;
  t: number;
  dir: number;
  pulled: boolean;
  dead: boolean;
  /** Pearl inside (chests only). */
  pearl?: boolean;
  /** Angler hunting state. */
  hunt?: number;
  rest?: number;
}

export type EndReason = 'surface' | 'air' | 'breach';

export interface DiveResult {
  reason: EndReason;
  /** Lumen collected during the dive (before breach loss / bank bonus). */
  haul: number;
  /** Lumen actually banked. */
  banked: number;
  depth: number;
  motes: number;
  fish: number;
  chests: number;
  air: number;
  hits: number;
  pearls: number;
  bestStreak: number;
  dashes: number;
  flares: number;
  zaps: number;
  time: number;
  closeCall: boolean;
}

export type DiveSignal =
  | { type: 'mote'; x: number; y: number; value: number; streak: number }
  | { type: 'fish'; x: number; y: number; value: number }
  | { type: 'air'; x: number; y: number; value: number }
  | { type: 'chest'; x: number; y: number; value: number; pearl: boolean }
  | { type: 'hurt'; x: number; y: number; hull: number }
  | { type: 'ram'; x: number; y: number }
  | { type: 'mark'; depth: number; record: boolean }
  | { type: 'zone'; index: number }
  | { type: 'dash' }
  | { type: 'flare'; x: number; y: number; radius: number }
  | { type: 'zap'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'lowair' }
  | { type: 'end'; result: DiveResult };

export interface DiveOptions {
  seed: number;
  event?: DiveEvent;
  /** Deepest depth ever (metres), to flag new records. */
  record: number;
  /** Global lumen multiplier (pearls, finds, Reef). */
  valueMult: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Dive {
  readonly m: Mods;
  readonly ev: DiveEvent | undefined;
  readonly opts: DiveOptions;
  readonly sub = {
    x: W / 2,
    y: 0,
    vx: 0,
    vy: 0,
    r: 18,
    hull: 3,
    maxHull: 3,
    air: 25,
    maxAir: 25,
    inv: 0,
    charges: 1,
    dashCd: 0,
    dashT: 0,
    flareCd: 0,
    zapT: 0,
    facing: 1,
    angle: 0,
  };
  readonly input = { mode: 'none' as 'none' | 'pointer' | 'keys', tx: W / 2, ty: 0, kx: 0, ky: 0 };
  ents: Ent[] = [];
  time = 0;
  lumen = 0;
  streak = 0;
  lastPickup = -10;
  maxDepth = 0;
  over = false;
  result: DiveResult | null = null;
  private nextChunk = 0;
  private lastMark = 0;
  private zone = 0;
  private warnedAir = false;
  private wallSeed: number[];
  private stats = { motes: 0, fish: 0, chests: 0, air: 0, hits: 0, pearls: 0, bestStreak: 0, dashes: 0, flares: 0, zaps: 0, minAir: Infinity };
  private listeners: ((s: DiveSignal) => void)[] = [];

  constructor(mods: Mods, opts: DiveOptions) {
    this.m = mods;
    this.ev = opts.event;
    this.opts = opts;
    const rng = mulberry32(opts.seed);
    this.wallSeed = [rng() * 10, rng() * 10, rng() * 10, rng() * 10];
    const s = this.sub;
    s.maxHull = s.hull = Math.max(1, Math.round(mods.maxHull));
    s.maxAir = s.air = mods.maxAir;
    s.charges = mods.dash ? mods.dashCharges : 0;
    s.y = Math.max(40, mods.startDepth * UNITS_PER_M);
    this.input.ty = s.y;
    this.maxDepth = s.y / UNITS_PER_M;
    this.lastMark = Math.floor(this.maxDepth / 100) * 100;
    this.zone = zoneIndex(this.maxDepth);
    this.nextChunk = Math.max(0, Math.floor(s.y / CHUNK) - 1);
    this.generateUntil(s.y + 1600);
  }

  on(fn: (s: DiveSignal) => void): void {
    this.listeners.push(fn);
  }

  private emit(s: DiveSignal): void {
    for (const fn of this.listeners) fn(s);
  }

  depthM(y = this.sub.y): number {
    return Math.max(0, y / UNITS_PER_M);
  }

  get maxSpeed(): number {
    return 170 * this.m.speed * (this.ev?.speed ?? 1);
  }

  /* ------------------------------------------------------------ walls */
  wallL(y: number): number {
    const [a, b] = this.wallSeed;
    const narrow = Math.min(170, this.depthM(y) * 0.05);
    return 30 + 55 * (1 + Math.sin(y * 0.0019 + a)) + 35 * (1 + Math.sin(y * 0.0053 + b)) + narrow;
  }

  wallR(y: number): number {
    const [, , c, d] = this.wallSeed;
    const narrow = Math.min(170, this.depthM(y) * 0.05);
    return W - (30 + 55 * (1 + Math.sin(y * 0.0017 + c)) + 35 * (1 + Math.sin(y * 0.0049 + d)) + narrow);
  }

  /* ------------------------------------------------------------ world gen */
  private generateUntil(y: number): void {
    while (this.nextChunk * CHUNK < y) this.genChunk(this.nextChunk++);
  }

  private add(kind: EntKind, x: number, y: number, extra: Partial<Ent> = {}): Ent {
    const r = { mote: 7, fish: 16, air: 11, chest: 20, jelly: 22, urchin: 18, eel: 16, angler: 24 }[kind];
    const e: Ent = { kind, x, y, vx: 0, vy: 0, r, value: 0, phase: 0, homeY: y, stun: 0, t: 0, dir: 1, pulled: false, dead: false, ...extra };
    this.ents.push(e);
    return e;
  }

  private genChunk(c: number): void {
    const rng = mulberry32(this.opts.seed ^ Math.imul(c + 1, 2654435761));
    const y0 = c * CHUNK;
    const m = this.depthM(y0 + CHUNK / 2);
    const zi = zoneIndex(m);
    const ev = this.ev;
    const mv = moteValue(m);
    const safeStart = this.depthM(this.sub.y) + 18;
    const inCorridor = (y: number, pad: number) => {
      const l = this.wallL(y) + pad;
      const r = this.wallR(y) - pad;
      return l + rng() * Math.max(10, r - l);
    };

    // Plankton clusters in little shapes: rings, arcs, lines and spirals.
    const clusters = 2 + Math.floor(rng() * 2) + (ev?.moteMult && ev.moteMult >= 2 ? 1 : 0);
    for (let k = 0; k < clusters; k++) {
      const cy = y0 + rng() * CHUNK;
      const cx = inCorridor(cy, 70);
      const n = 6 + Math.floor(rng() * 7);
      const shape = Math.floor(rng() * 4);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        let dx = 0;
        let dy = 0;
        if (shape === 0) {
          dx = Math.cos(t * Math.PI * 2) * 46;
          dy = Math.sin(t * Math.PI * 2) * 46;
        } else if (shape === 1) {
          dx = (t - 0.5) * 220;
          dy = Math.sin(t * Math.PI) * -40;
        } else if (shape === 2) {
          dx = Math.sin(t * Math.PI * 2) * 30;
          dy = (t - 0.5) * 220;
        } else {
          const a = t * Math.PI * 3;
          dx = Math.cos(a) * (12 + t * 60);
          dy = Math.sin(a) * (12 + t * 60);
        }
        this.add('mote', cx + dx, cy + dy, { value: mv, phase: rng() * 6.28 });
      }
    }

    // Air bubbles come in short columns.
    // Air is a budget, not a given: refills are rarer than the air you use getting to them.
    if (rng() < (m < 300 ? 0.22 : 0.16)) {
      const by = y0 + rng() * CHUNK;
      const bx = inCorridor(by, 50);
      for (let i = 0; i < 3; i++) this.add('air', bx + (rng() - 0.5) * 16, by + i * 34, { value: 2, phase: rng() * 6.28 });
    }

    // Glimmerfish
    const fishChance = (0.3 + 0.08 * zi) * (ev?.fishCount ?? 1);
    for (let f = fishChance; f > 0; f -= 1) {
      if (rng() < Math.min(1, f)) {
        const fy = y0 + rng() * CHUNK;
        this.add('fish', inCorridor(fy, 60), fy, { value: mv * 25, dir: rng() < 0.5 ? -1 : 1, phase: rng() * 6.28 });
      }
    }

    // Treasure chests sit near the walls
    if (m > 60 && rng() < 0.045 * this.m.chestRate * (ev?.chestMult ?? 1)) {
      const cy = y0 + rng() * CHUNK;
      const left = rng() < 0.5;
      const cx = left ? this.wallL(cy) + 30 : this.wallR(cy) - 30;
      const pearlChance = (m > 800 ? 0.12 : m > 300 ? 0.05 : 0.02) + this.m.chestPearl;
      this.add('chest', cx, cy, { value: mv * 90, pearl: rng() < pearlChance });
    }

    if (m < safeStart) return; // no hazards right where the dive begins
    const hm = ev?.hazardMult ?? 1;
    const density = m < 40 ? 0 : Math.min(3.5, 0.5 + m / 320) * hm;
    let jellies = Math.floor(density) + (rng() < density % 1 ? 1 : 0);
    while (jellies-- > 0) {
      const jy = y0 + rng() * CHUNK;
      this.add('jelly', inCorridor(jy, 40), jy, { phase: rng() * 6.28 });
    }
    if (m > 90) {
      const urchins = (rng() < 0.6 ? 1 : 0) + (m > 600 && rng() < 0.5 ? 1 : 0);
      for (let i = 0; i < urchins; i++) {
        const uy = y0 + rng() * CHUNK;
        const left = rng() < 0.5;
        this.add('urchin', left ? this.wallL(uy) + 14 : this.wallR(uy) - 14, uy);
      }
    }
    if (m > 200 && rng() < Math.min(0.8, 0.3 + m / 3000) * hm) {
      const ey = y0 + rng() * CHUNK;
      this.add('eel', inCorridor(ey, 40), ey, { dir: rng() < 0.5 ? -1 : 1, phase: rng() * 6.28 });
    }
    if (m > 650 && rng() < Math.min(0.7, 0.25 + m / 6000) * hm) {
      const ay = y0 + rng() * CHUNK;
      this.add('angler', inCorridor(ay, 60), ay, { phase: rng() * 6.28, hunt: 0, rest: 0 });
    }
  }

  /* ------------------------------------------------------------ actions */
  dash(): boolean {
    const s = this.sub;
    if (this.over || !this.m.dash || s.charges <= 0) return false;
    let dx = s.vx;
    let dy = s.vy;
    if (this.input.mode === 'pointer') {
      dx = this.input.tx - s.x;
      dy = this.input.ty - s.y;
    } else if (this.input.mode === 'keys' && (this.input.kx || this.input.ky)) {
      dx = this.input.kx;
      dy = this.input.ky;
    }
    if (Math.hypot(dx, dy) < 1) {
      dx = 0;
      dy = 1;
    }
    const len = Math.hypot(dx, dy);
    const v = this.maxSpeed * 2.6 * this.m.dashPower;
    s.vx = (dx / len) * v;
    s.vy = (dy / len) * v;
    s.dashT = 0.22;
    s.charges--;
    if (s.dashCd <= 0) s.dashCd = this.m.dashCooldown;
    if (this.m.dashAir) s.air = Math.min(s.maxAir, s.air + this.m.dashAir);
    this.stats.dashes++;
    this.emit({ type: 'dash' });
    return true;
  }

  flare(): boolean {
    const s = this.sub;
    if (this.over || !this.m.flare || s.flareCd > 0) return false;
    s.flareCd = this.m.flareCooldown;
    const R = this.m.flareRadius;
    for (const e of this.ents) {
      const d = Math.hypot(e.x - s.x, e.y - s.y);
      if (HAZARDS.has(e.kind) && d < R) e.stun = 3.5;
      if (this.m.flarePull && (e.kind === 'mote' || e.kind === 'air') && d < R * 1.8) e.pulled = true;
    }
    this.stats.flares++;
    this.emit({ type: 'flare', x: s.x, y: s.y, radius: R });
    return true;
  }

  surface(): void {
    if (!this.over) this.end('surface');
  }

  /* ------------------------------------------------------------ simulation */
  step(dt: number): void {
    if (this.over || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    const s = this.sub;
    const m = this.m;
    this.time += dt;

    // Steering
    const max = this.maxSpeed;
    let dvx = 0;
    let dvy = 0;
    if (this.input.mode === 'pointer') {
      const dx = this.input.tx - s.x;
      const dy = this.input.ty - s.y;
      const d = Math.hypot(dx, dy);
      if (d > 8) {
        const sp = Math.min(max, d * 3.2);
        dvx = (dx / d) * sp;
        dvy = (dy / d) * sp;
      }
    } else if (this.input.mode === 'keys') {
      const d = Math.hypot(this.input.kx, this.input.ky);
      if (d > 0) {
        dvx = (this.input.kx / d) * max;
        dvy = (this.input.ky / d) * max;
      }
    }
    if (s.dashT > 0) s.dashT -= dt;
    else {
      const k = 1 - Math.exp(-dt * 5 * m.accel);
      s.vx += (dvx - s.vx) * k;
      s.vy += (dvy - s.vy) * k;
    }
    s.x += (s.vx + (this.ev?.current ?? 0)) * dt;
    s.y += s.vy * dt;
    if (Math.abs(s.vx) > 8) s.facing = s.vx > 0 ? 1 : -1;
    s.angle = Math.max(-0.5, Math.min(0.5, Math.atan2(s.vy, Math.abs(s.vx) + 60) * 0.6));

    // Walls and the surface
    const l = this.wallL(s.y) + s.r;
    const r = this.wallR(s.y) - s.r;
    if (s.x < l) {
      s.x = l;
      s.vx = Math.abs(s.vx) * 0.3;
    } else if (s.x > r) {
      s.x = r;
      s.vx = -Math.abs(s.vx) * 0.3;
    }
    if (s.y < s.r + 10) {
      s.y = s.r + 10;
      s.vy = Math.max(0, s.vy);
    }

    // Timers
    if (s.inv > 0) s.inv -= dt;
    if (s.flareCd > 0) s.flareCd = Math.max(0, s.flareCd - dt);
    if (m.dash && s.charges < m.dashCharges) {
      s.dashCd -= dt;
      if (s.dashCd <= 0) {
        s.charges++;
        s.dashCd = s.charges < m.dashCharges ? m.dashCooldown : 0;
      }
    }
    if (this.time - this.lastPickup > m.streakWindow) this.streak = 0;

    // Air
    // Pressure: air goes faster the deeper you are.
    s.air -= dt * m.airDrain * (this.ev?.airDrain ?? 1) * (1 + this.depthM() / 2500);
    this.stats.minAir = Math.min(this.stats.minAir, s.air);
    if (!this.warnedAir && s.air < s.maxAir * 0.25) {
      this.warnedAir = true;
      this.emit({ type: 'lowair' });
    }
    if (s.air > s.maxAir * 0.35) this.warnedAir = false;

    // Depth records and zones
    const depth = this.depthM();
    if (depth > this.maxDepth) this.maxDepth = depth;
    while (this.maxDepth >= this.lastMark + 100) {
      this.lastMark += 100;
      this.emit({ type: 'mark', depth: this.lastMark, record: this.lastMark > this.opts.record });
    }
    const zi = zoneIndex(depth);
    if (zi !== this.zone) {
      this.zone = zi;
      this.emit({ type: 'zone', index: zi });
    }

    this.generateUntil(s.y + 1600);
    this.updateEnts(dt);

    // Auto-zap
    if (m.zapInterval > 0) {
      s.zapT += dt;
      if (s.zapT >= m.zapInterval) {
        let best: Ent | null = null;
        let bd = 280;
        for (const e of this.ents) {
          if (!HAZARDS.has(e.kind) || e.stun > 0 || e.dead) continue;
          const d = Math.hypot(e.x - s.x, e.y - s.y);
          if (d < bd) {
            bd = d;
            best = e;
          }
        }
        if (best) {
          s.zapT = 0;
          best.stun = 2.5;
          this.stats.zaps++;
          this.emit({ type: 'zap', x1: s.x, y1: s.y, x2: best.x, y2: best.y });
        }
      }
    }

    if (s.air <= 0) this.end('air');
  }

  private updateEnts(dt: number): void {
    const s = this.sub;
    const m = this.m;
    const magnet = m.magnet + s.r;
    let w = 0;
    for (let i = 0; i < this.ents.length; i++) {
      const e = this.ents[i];
      if (e.dead || e.y < s.y - 1100) continue;
      this.ents[w++] = e;
      e.t += dt;
      if (e.stun > 0) e.stun -= dt;
      const dx = s.x - e.x;
      const dy = s.y - e.y;
      const dist = Math.hypot(dx, dy) || 0.001;

      switch (e.kind) {
        case 'mote':
        case 'air': {
          if (e.pulled || dist < magnet) {
            e.pulled = true;
            const pull = 420 + (magnet / Math.max(20, dist)) * 120;
            e.vx += ((dx / dist) * pull - e.vx) * Math.min(1, dt * 8);
            e.vy += ((dy / dist) * pull - e.vy) * Math.min(1, dt * 8);
          } else {
            e.vx *= 0.9;
            e.vy = e.kind === 'air' ? -14 : Math.sin(e.t * 1.5 + e.phase) * 6;
          }
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          break;
        }
        case 'fish': {
          const flee = dist < 190 && e.stun <= 0;
          const base = 55;
          if (flee) {
            const sp = (130 + this.depthM(e.y) * 0.04) * m.fishFlee;
            e.vx += ((-dx / dist) * sp - e.vx) * Math.min(1, dt * 4);
            e.vy += ((-dy / dist) * sp - e.vy) * Math.min(1, dt * 4);
          } else {
            e.vx += (e.dir * base - e.vx) * Math.min(1, dt * 2);
            e.vy += (Math.sin(e.t * 2 + e.phase) * 20 - e.vy) * Math.min(1, dt * 2);
          }
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          if (e.x < this.wallL(e.y) + e.r) {
            e.x = this.wallL(e.y) + e.r;
            e.dir = 1;
            e.vx = Math.abs(e.vx);
          } else if (e.x > this.wallR(e.y) - e.r) {
            e.x = this.wallR(e.y) - e.r;
            e.dir = -1;
            e.vx = -Math.abs(e.vx);
          }
          break;
        }
        case 'jelly': {
          if (e.stun <= 0) {
            e.y = e.homeY + Math.sin(e.t * 0.9 + e.phase) * 46;
            e.x += Math.sin(e.t * 0.4 + e.phase) * 10 * dt;
          }
          break;
        }
        case 'eel': {
          if (e.stun <= 0) {
            const sp = 150 + this.depthM(e.y) * 0.02;
            e.x += e.dir * sp * dt;
            e.y = e.homeY + Math.sin(e.t * 3 + e.phase) * 14;
            if (e.x < this.wallL(e.y) + 20) e.dir = 1;
            if (e.x > this.wallR(e.y) - 20) e.dir = -1;
          }
          break;
        }
        case 'angler': {
          if (e.stun > 0) break;
          if ((e.rest ?? 0) > 0) e.rest! -= dt;
          if ((e.hunt ?? 0) > 0) {
            e.hunt! -= dt;
            const sp = 125;
            e.vx += ((dx / dist) * sp - e.vx) * Math.min(1, dt * 2.5);
            e.vy += ((dy / dist) * sp - e.vy) * Math.min(1, dt * 2.5);
            if (e.hunt! <= 0) e.rest = 1.6;
          } else {
            e.vx *= 0.95;
            e.vy = Math.sin(e.t * 0.8 + e.phase) * 12;
            if (dist < 250 && (e.rest ?? 0) <= 0) e.hunt = 2.6;
          }
          e.x += e.vx * dt;
          e.y += e.vy * dt;
          break;
        }
        default:
          break;
      }

      // Contact
      const reach = s.r + e.r * (HAZARDS.has(e.kind) ? 0.75 : 1);
      if (Math.hypot(s.x - e.x, s.y - e.y) < reach) this.touch(e);
    }
    this.ents.length = w;
  }

  private gain(base: number): number {
    const depthFactor = 1 + this.m.depthBonus * (this.depthM() / 100);
    return base * this.opts.valueMult * this.m.lumenMult * depthFactor;
  }

  private touch(e: Ent): void {
    const s = this.sub;
    const m = this.m;
    if (HAZARDS.has(e.kind)) {
      if (e.stun > 0) return;
      if (s.dashT > 0 && m.dashRam) {
        e.stun = 3;
        this.emit({ type: 'ram', x: e.x, y: e.y });
        return;
      }
      if (s.inv > 0) return;
      const dmg = e.kind === 'angler' ? m.anglerDamage : 1;
      s.hull -= dmg;
      s.inv = m.invuln;
      this.stats.hits++;
      const dx = s.x - e.x;
      const dy = s.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      s.vx = (dx / d) * 320;
      s.vy = (dy / d) * 320;
      if (e.kind === 'angler') e.rest = 2.5;
      e.hunt = 0;
      this.emit({ type: 'hurt', x: s.x, y: s.y, hull: s.hull });
      if (s.hull <= 0) this.end('breach');
      return;
    }
    e.dead = true;
    if (e.kind === 'mote') {
      this.streak = this.time - this.lastPickup <= m.streakWindow ? Math.min(m.streakCap, this.streak + 1) : 1;
      this.lastPickup = this.time;
      this.stats.bestStreak = Math.max(this.stats.bestStreak, this.streak);
      const v = this.gain(e.value * m.moteMult * (this.ev?.moteMult ?? 1)) * (1 + this.streak * m.streakPer);
      this.lumen += v;
      this.stats.motes++;
      this.emit({ type: 'mote', x: e.x, y: e.y, value: v, streak: this.streak });
    } else if (e.kind === 'fish') {
      const v = this.gain(e.value * m.fishMult * (this.ev?.fishMult ?? 1));
      this.lumen += v;
      this.stats.fish++;
      this.emit({ type: 'fish', x: e.x, y: e.y, value: v });
    } else if (e.kind === 'air') {
      const v = e.value * m.airBubble;
      s.air = Math.min(s.maxAir, s.air + v);
      this.stats.air++;
      this.emit({ type: 'air', x: e.x, y: e.y, value: v });
    } else if (e.kind === 'chest') {
      const v = this.gain(e.value * m.chestMult);
      this.lumen += v;
      this.stats.chests++;
      if (e.pearl) this.stats.pearls++;
      if (m.chestRepair) s.hull = Math.min(s.maxHull, s.hull + 1);
      this.emit({ type: 'chest', x: e.x, y: e.y, value: v, pearl: !!e.pearl });
    }
  }

  private end(reason: EndReason): void {
    this.over = true;
    const keep = reason === 'breach' ? this.m.keepOnBreach : 1;
    const banked = this.lumen * keep * (1 + this.m.bankBonus);
    const st = this.stats;
    this.result = {
      reason,
      haul: this.lumen,
      banked,
      depth: Math.floor(this.maxDepth),
      motes: st.motes,
      fish: st.fish,
      chests: st.chests,
      air: st.air,
      hits: st.hits,
      pearls: st.pearls,
      bestStreak: st.bestStreak,
      dashes: st.dashes,
      flares: st.flares,
      zaps: st.zaps,
      time: this.time,
      closeCall: reason === 'surface' && this.sub.air < 2,
    };
    this.emit({ type: 'end', result: this.result });
  }
}
