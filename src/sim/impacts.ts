// Impacts: asteroids, comet fragments and crashing spacecraft hit worlds and leave craters that slowly fade.
import { FACTIONS, SETTLEMENT_SITES } from "../data/timeline";
import type { Bodies } from "./bodies";
import type { Civ } from "./civ";
import type { NewsFeed, NewsItem } from "./news";
import type { Rng } from "./rng";
import { dayFromISO, yearOf } from "./time";

export type ImpactSize = "tiny" | "small" | "large" | "huge";

export interface Crater {
  id: number;
  body: string;
  /** Unit vector in the body's own rotating frame. */
  dir: [number, number, number];
  /** Angular radius, radians. */
  size: number;
  year: number;
  /** Seconds of real time since impact (keeps the glow visible even when time races). */
  realAge: number;
}

export interface Incoming {
  id: number;
  body: string;
  dir: [number, number, number];
  size: ImpactSize;
  /** Direction it comes from (unit vector, scene space). */
  from: [number, number, number];
  t: number;
  travel: number;
  label: string;
}

const ANGULAR: Record<ImpactSize, number> = { tiny: 0.012, small: 0.04, large: 0.11, huge: 0.3 };
/** How long a scar lasts, in years. Weather and life erase scars fast on Earth; airless worlds keep them longest. */
export function craterLifetime(body: string) {
  return body === "earth" ? 150 : body === "mars" ? 400 : body === "jupiter" || body === "saturn" || body === "uranus" || body === "neptune" ? 1.5 : body === "venus" || body === "titan" ? 250 : 700;
}

const GAS = new Set(["jupiter", "saturn", "uranus", "neptune"]);
const TARGETS = ["moon", "moon", "mercury", "mars", "mars", "callisto", "ganymede", "ceres", "earth", "jupiter", "jupiter", "venus", "io", "europa", "titan", "triton"];

/** Real impacts that happened, replayed on their dates. */
const SCRIPTED = [
  { date: "1959-09-14", body: "moon", lat: 29.1, lon: 0, size: "tiny" as ImpactSize, label: "Luna 2" },
  { date: "1994-07-16", body: "jupiter", lat: -44, lon: 20, size: "large" as ImpactSize, label: "Shoemaker–Levy 9 fragment A" },
  { date: "1994-07-18", body: "jupiter", lat: -44, lon: 60, size: "huge" as ImpactSize, label: "Shoemaker–Levy 9 fragment G" },
  { date: "1994-07-20", body: "jupiter", lat: -44, lon: 110, size: "large" as ImpactSize, label: "Shoemaker–Levy 9 fragment K" },
  { date: "2009-10-09", body: "moon", lat: -84.7, lon: -49.4, size: "tiny" as ImpactSize, label: "LCROSS" },
];

function randomDir(rng: Rng): [number, number, number] {
  const u = rng.range(-1, 1), t = rng.range(0, Math.PI * 2), r = Math.sqrt(1 - u * u);
  return [r * Math.cos(t), u, r * Math.sin(t)];
}
function latLonDir(lat: number, lon: number): [number, number, number] {
  const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180;
  return [Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)];
}

export class Impacts {
  craters: Crater[] = [];
  incoming: Incoming[] = [];
  private nextId = 1;
  private scriptIdx = 0;
  private realCooldown = 0;
  version = 0;
  onHit?: (body: string, dir: [number, number, number], size: ImpactSize) => void;
  /** If set, the next launched rock aims here (body frame), e.g. the side you're looking at. */
  aim: [number, number, number] | null = null;

  constructor(private rng: Rng) {}

  reset(day: number) {
    const y = yearOf(day);
    this.craters = this.craters.filter(c => c.year <= y);
    this.incoming = [];
    this.scriptIdx = SCRIPTED.findIndex(s => dayFromISO(s.date) > day);
    if (this.scriptIdx < 0) this.scriptIdx = SCRIPTED.length;
    this.version++;
  }

  /** Send a rock at a world (also used by god powers and crashing probes). */
  launch(body: string, size: ImpactSize, label: string, dir?: [number, number, number], from?: [number, number, number], travel?: number, delay = 0) {
    const d = dir ?? this.aim ?? randomDir(this.rng);
    this.aim = null;
    this.incoming.push({ id: this.nextId++, body, dir: d, size, from: from ?? randomDir(this.rng), t: -delay, travel: travel ?? (size === "tiny" ? 2.2 : 3.6), label });
  }

  /** A swarm of small rocks over a few seconds. */
  shower(body: string) {
    for (let i = 0; i < 9; i++) this.launch(body, this.rng.chance(0.7) ? "tiny" : "small", "Meteor", undefined, undefined, 1.8 + this.rng.range(0, 0.8), i * 0.35);
  }

  /** Worlds protected from impacts until the given year. */
  shields: Record<string, number> = {};
  shield(body: string, untilYear: number) { this.shields[body] = untilYear; this.version++; }
  onBlast?: (body: string, dir: [number, number, number]) => void;

  /** A spacecraft crashing into a world: a tiny crater right away, no incoming rock. */
  crash(body: string, dir: [number, number, number], day: number) {
    this.craters.push({ id: this.nextId++, body, dir, size: ANGULAR.tiny * 0.6, year: yearOf(day), realAge: 0 });
    this.onHit?.(body, dir, "tiny");
    this.version++;
  }

  update(day: number, dtDays: number, dtReal: number, bodies: Bodies, civ: Civ, news: NewsFeed, post: (item: NewsItem, toast: boolean) => void) {
    const year = yearOf(day);
    // Real impacts on their dates
    while (this.scriptIdx < SCRIPTED.length && dayFromISO(SCRIPTED[this.scriptIdx].date) <= day) {
      const s = SCRIPTED[this.scriptIdx++];
      if (dtDays < 60) this.launch(s.body, s.size, s.label, latLonDir(s.lat, s.lon));
    }
    // Natural impacts, compressed so you see one every decade or so
    this.realCooldown -= dtReal;
    if (dtDays > 0 && dtDays < 200 && this.realCooldown <= 0) {
      const p = (dtDays / 365.25) * 0.12;
      if (this.rng.chance(Math.min(0.5, p))) {
        const body = this.rng.pick(TARGETS);
        const roll = this.rng.next();
        const size: ImpactSize = body === "earth" ? (roll < 0.85 ? "tiny" : "small") : roll < 0.55 ? "tiny" : roll < 0.92 ? "small" : "large";
        this.launch(body, size, "asteroid");
        this.realCooldown = 2;
      }
    }
    // Flight and impact
    for (const r of this.incoming) {
      r.t += dtReal;
      if (r.t >= r.travel) this.hit(r, day, year, bodies, civ, news, post);
    }
    this.incoming = this.incoming.filter(r => r.t < r.travel);
    // Craters age and fade away
    for (const c of this.craters) c.realAge += dtReal;
    const before = this.craters.length;
    this.craters = this.craters.filter(c => year - c.year < craterLifetime(c.body) && year >= c.year);
    if (this.craters.length !== before) this.version++;
  }

  private hit(r: Incoming, day: number, year: number, bodies: Bodies, civ: Civ, news: NewsFeed, post: (item: NewsItem, toast: boolean) => void) {
    const b = bodies.get(r.body);
    if (!b) return;
    if ((this.shields[r.body] ?? -Infinity) > year) { this.onBlast?.(r.body, r.dir); return; }   // burst on the shield
    const size = ANGULAR[r.size] * (GAS.has(r.body) ? 1.6 : 1);
    this.craters.push({ id: this.nextId++, body: r.body, dir: r.dir, size, year, realAge: 0 });
    this.onHit?.(r.body, r.dir, r.size);
    // Keep at most 10 scars per world (the oldest go first)
    const mine = this.craters.filter(c => c.body === r.body);
    if (mine.length > 10) this.craters = this.craters.filter(c => c !== mine[0]);
    this.version++;
    const big = r.size === "large" || r.size === "huge";
    // A colony is wrecked if the blast lands near it (an extinction-class impact wrecks it anywhere on the world).
    const colony = civ.colonies.find(c => {
      if (!c.active || c.body !== r.body) return false;
      if (r.size === "huge") return true;
      if (r.body === "earth") return false; // Earth is too big and spread out for one strike short of an extinction event to wreck it
      const site = SETTLEMENT_SITES[c.body];
      if (!site) return true;
      const la = (site[0] * Math.PI) / 180, lo = (site[1] * Math.PI) / 180;
      const dot = Math.cos(la) * Math.cos(lo) * r.dir[0] + Math.sin(la) * r.dir[1] - Math.cos(la) * Math.sin(lo) * r.dir[2];
      return Math.acos(Math.max(-1, Math.min(1, dot))) < 0.9;
    });
    if (colony && big) {
      civ.ruin(colony.id, day, r.size === "huge" ? 60 : 25);
      post(news.add({ day, cat: "disaster", focus: r.body, facs: [colony.owner], major: true,
        title: `Asteroid devastates ${colony.name}`,
        body: `An impact on ${b.name} wrecks the ${FACTIONS[colony.owner].name} settlement. Survivors will need decades to rebuild.` }), true);
    } else if (r.label === "Meteor") {
      // Meteor mode and showers: no headline for every rock
    } else if (r.label !== "asteroid") {
      // Real or deliberate impacts get their own story (history items already cover Luna 2 and SL9)
      if (r.label.startsWith("God")) post(news.add({ day, cat: "disaster", focus: r.body, major: true, title: `Impact on ${b.name}`, body: `A ${r.size} asteroid strikes ${b.name}, blasting out a fresh crater.` }), true);
    } else if (r.body === "earth" || colony || big) {
      post(news.add({ day, cat: "disaster", focus: r.body, major: r.body === "earth",
        title: r.body === "earth" ? "Meteorite strikes Earth" : `Fresh crater on ${b.name}`,
        body: r.body === "earth" ? "A small asteroid survives the atmosphere and digs a crater. Scars like this fade within a century or two as rain and plants reclaim them."
          : `Telescopes spot a new ${r.size === "large" ? "large " : ""}impact crater on ${b.name}.` }), false);
    }
  }

  snapshot() { return this.craters.map(c => ({ ...c, realAge: 99 })); }
  restore(cs: Crater[]) { this.craters = cs ?? []; this.version++; }
}
