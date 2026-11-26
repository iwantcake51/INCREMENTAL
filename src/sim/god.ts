// God mode: a light sandbox layer with progression.
// You earn Influence as civilization grows. Total Influence earned raises your rank, and each rank unlocks
// new powers. Goals give bonus Influence and point you toward things worth trying.

import { FACTIONS } from "../data/timeline";
import type { Civ } from "./civ";
import type { NewsFeed } from "./news";
import type { EventBus } from "./events";
import { yearOf } from "./time";

export const RANKS = [
  { name: "Watcher", at: 0, blurb: "You can see everything, and nudge a little." },
  { name: "Guide", at: 80, blurb: "Your favor can make a power prosper." },
  { name: "Shaper", at: 250, blurb: "You can start wars, end them, and plant colonies." },
  { name: "Architect", at: 600, blurb: "Whole worlds can be reshaped." },
  { name: "Demiurge", at: 1200, blurb: "Even the Sun answers to you." },
] as const;

export type PowerTarget = "none" | "pair" | "faction" | "war" | "colonySite" | "terraform";

export interface Power {
  id: string;
  name: string;
  icon: string;
  desc: string;
  rank: number;
  cost: number;
  target: PowerTarget;
  /** Earliest year it makes sense (before that, there are no powers to affect). */
  from?: number;
}

export const POWERS: Power[] = [
  { id: "calm", name: "Whisper of peace", icon: "leaf", rank: 0, cost: 12, target: "none", from: 2045,
    desc: "Lower tension between every pair of powers that isn't already at war." },
  { id: "discord", name: "Sow discord", icon: "alert", rank: 0, cost: 15, target: "pair", from: 2045,
    desc: "Stage an incident between two powers. If tension boils over (and it's 2060+), they go to war." },
  { id: "bless", name: "Bless a power", icon: "sparkle", rank: 1, cost: 30, target: "faction", from: 2045,
    desc: "For 25 years the chosen power's colonies defend 70% better and its fleets grow by three ships." },
  { id: "storm", name: "Solar storm", icon: "sun", rank: 1, cost: 45, target: "none", from: 2060,
    desc: "Ground every fleet in the solar system for three years. Wars freeze in place." },
  { id: "peace", name: "Impose peace", icon: "check", rank: 2, cost: 55, target: "war", from: 2060,
    desc: "End a war at once with a treaty. Both sides keep what they hold." },
  { id: "war", name: "Call to arms", icon: "swords", rank: 2, cost: 45, target: "pair", from: 2060,
    desc: "Make two powers declare war on each other right now." },
  { id: "colony", name: "Plant a colony", icon: "home", rank: 2, cost: 70, target: "colonySite", from: 2045,
    desc: "Found a settlement on an unclaimed world for the power of your choice." },
  { id: "terraform", name: "Terraform", icon: "seedling", rank: 3, cost: 140, target: "terraform", from: 1957,
    desc: "Over about 60 years, give a world air, seas and plant life. Watch it turn blue and green." },
  { id: "dyson", name: "Kindle the swarm", icon: "ringed", rank: 4, cost: 250, target: "none", from: 1957,
    desc: "Start the Dyson swarm early. Collectors begin circling the Sun now." },
];

/** Worlds that can be terraformed, and unclaimed worlds where a colony can be planted. */
export const TERRAFORMABLE = ["mars", "venus", "moon", "mercury", "callisto", "ganymede", "titania"];
export const COLONY_SITES = ["io", "phobos", "deimos", "moon", "venus", "mercury", "callisto", "ganymede", "europa", "enceladus", "titan", "titania", "triton", "ceres"];

export interface Goal {
  id: string;
  name: string;
  desc: string;
  reward: number;
}

export const GOALS: Goal[] = [
  { id: "power", name: "First miracle", desc: "Use any god power.", reward: 10 },
  { id: "luna", name: "A foothold", desc: "Reach 2032, when the first Moon base opens.", reward: 20 },
  { id: "mars", name: "Red frontier", desc: "Reach 2045 and watch the first Mars settlement land.", reward: 25 },
  { id: "firstwar", name: "The first war", desc: "See a war break out (or start one).", reward: 25 },
  { id: "bless", name: "Chosen people", desc: "Bless a power.", reward: 15 },
  { id: "peacemaker", name: "Peacemaker", desc: "End a war with Impose peace.", reward: 40 },
  { id: "colony", name: "Gardener", desc: "Plant a colony on an unclaimed world.", reward: 40 },
  { id: "longpeace", name: "Golden age", desc: "Keep 40 years without any war after 2060.", reward: 80 },
  { id: "green", name: "Second Earth", desc: "Fully terraform any world.", reward: 120 },
  { id: "balance", name: "Balance of power", desc: "Reach 2300 with all five powers still holding colonies.", reward: 120 },
  { id: "stars", name: "To the stars", desc: "Reach 2520, when the first starship leaves.", reward: 150 },
];

export interface GodSnapshot { influence: number; earned: number; goals: string[]; terraform: Record<string, { start: number; done?: boolean }>; uses: Record<string, number>; dysonFrom: number | null; lastWarYear: number }

export class God {
  influence = 25;
  earned = 25;
  goals = new Set<string>();
  /** Terraforming jobs: body → start year. Progress takes 60 years. */
  terraform: Record<string, { start: number; done?: boolean }> = {};
  uses: Record<string, number> = {};
  /** Year the Dyson swarm starts if kindled early. */
  dysonFrom: number | null = null;
  lastWarYear = 2060;
  version = 0;

  constructor(private civ: Civ, private news: NewsFeed, private bus: EventBus) {}

  get rank() { let r = 0; RANKS.forEach((k, i) => { if (this.earned >= k.at) r = i; }); return r; }
  costOf(p: Power) { return Math.round(p.cost * (1 + 0.25 * (this.uses[p.id] ?? 0))); }

  /** 0–1 terraforming progress for a body at the given year (Mars also terraforms on its own from 2350). */
  terraformLevel(body: string, year: number) {
    const job = this.terraform[body];
    let v = job ? clamp01((year - job.start) / 60) : 0;
    if (body === "mars") v = Math.max(v, clamp01((year - 2350) / 120));
    return v;
  }

  dysonStart() { return Math.min(2400, this.dysonFrom ?? 2400); }

  update(day: number, dtDays: number) {
    if (dtDays <= 0) return;
    const year = yearOf(day), dtY = dtDays / 365.25;
    const colonies = this.civ.activeColonies().length;
    const atWar = this.civ.wars.length > 0;
    const gain = (0.6 + 0.35 * colonies + (atWar ? 0 : 0.5)) * dtY;
    this.influence += gain; this.earned += gain;
    if (atWar) this.lastWarYear = year;
    else if (year < 2060) this.lastWarYear = 2060;

    const check = (id: string, ok: boolean) => { if (ok && !this.goals.has(id)) this.complete(id, day); };
    check("luna", year >= 2032);
    check("mars", year >= 2045);
    check("firstwar", atWar);
    check("longpeace", year >= 2100 && year - this.lastWarYear >= 40);
    check("balance", year >= 2300 && FACTIONS.every(f => this.civ.coloniesOf(f.id).length > 0));
    check("stars", year >= 2520);
    for (const [body, job] of Object.entries(this.terraform)) {
      if (!job.done && this.terraformLevel(body, year) >= 1) {
        job.done = true;
        this.news.add({ day, cat: "milestone", focus: body, major: true, title: `${cap(body)} is green`, body: `Terraforming is complete. ${cap(body)} now has breathable air, seas and forests.` });
        check("green", true);
      }
    }
  }

  private complete(id: string, day: number) {
    const g = GOALS.find(x => x.id === id)!;
    this.goals.add(id);
    this.influence += g.reward; this.earned += g.reward;
    this.version++;
    this.bus.emit({ type: "news", toast: true, item: { id: -1, day, cat: "milestone", title: `Goal complete: ${g.name}`, body: `+${g.reward} Influence. ${g.desc}` } });
  }

  /** Which powers can be used right now, and why not if not. */
  availability(p: Power, year: number): string | null {
    if (this.rank < p.rank) return `Unlocks at rank ${RANKS[p.rank].name}`;
    if (p.from && year < p.from) return `Available from ${p.from}`;
    if (this.influence < this.costOf(p)) return "Not enough Influence";
    if (p.id === "peace" && !this.civ.wars.length) return "No wars to end";
    if (p.id === "dyson" && (this.dysonFrom !== null || year >= 2400)) return "The swarm is already growing";
    return null;
  }

  /** Use a power. `a` and `b` are targets (faction ids, war id, or body id). Returns an error message or null. */
  use(id: string, day: number, a?: number | string, b?: number | string): string | null {
    const p = POWERS.find(x => x.id === id)!;
    const year = yearOf(day);
    const why = this.availability(p, year);
    if (why) return why;
    switch (id) {
      case "calm": this.civ.calmAll(35); this.news.add({ day, cat: "peace", title: "A calm settles over the colonies", body: "Diplomats on every side find reasons to talk instead of fight." }); break;
      case "discord": if (a === b) return "Pick two different powers"; this.civ.sowDiscord(a as number, b as number, day); break;
      case "bless": this.civ.bless(a as number, day); this.complete2("bless", day); break;
      case "storm": this.civ.solarStorm(day); break;
      case "peace": if (!this.civ.forcePeace(a as number, day)) return "That war is already over"; this.complete2("peacemaker", day); break;
      case "war": if (a === b) return "Pick two different powers"; if (!this.civ.forceWar(a as number, b as number, day)) return "They are already at war, or one has no colonies"; break;
      case "colony": {
        const body = a as string;
        if (!this.civ.canFound(body)) return "That world is already settled";
        this.civ.foundColony(body, cap(body), b as number, day); this.complete2("colony", day); break;
      }
      case "terraform": {
        const body = a as string;
        if (this.terraform[body] || this.terraformLevel(body, year) > 0) return "Already terraforming";
        this.terraform[body] = { start: year };
        this.news.add({ day, cat: "milestone", focus: body, title: `Terraforming ${cap(body)} begins`, body: "Comets are steered in for water, and engineered microbes thicken the air. It will take about 60 years." });
        break;
      }
      case "dyson": this.dysonFrom = year; this.news.add({ day, cat: "milestone", focus: "sun", major: true, title: "The Dyson swarm begins early", body: "The first solar collectors start circling the Sun, centuries ahead of schedule." }); break;
    }
    const cost = this.costOf(p);
    this.influence -= cost;
    this.uses[id] = (this.uses[id] ?? 0) + 1;
    this.complete2("power", day);
    this.version++;
    return null;
  }

  private complete2(id: string, day: number) { if (!this.goals.has(id)) this.complete(id, day); }

  /** Time jumped backwards: forget terraforming and swarm starts that haven't happened yet. Influence is kept. */
  rewind(year: number) {
    for (const [k, j] of Object.entries(this.terraform)) if (j.start > year) delete this.terraform[k];
    if (this.dysonFrom !== null && this.dysonFrom > year) this.dysonFrom = null;
    this.lastWarYear = Math.min(this.lastWarYear, year);
    this.version++;
  }

  snapshot(): GodSnapshot {
    return { influence: this.influence, earned: this.earned, goals: [...this.goals], terraform: this.terraform, uses: this.uses, dysonFrom: this.dysonFrom, lastWarYear: this.lastWarYear };
  }
  restore(s: GodSnapshot) {
    Object.assign(this, { ...s, goals: new Set(s.goals) });
    this.version++;
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
