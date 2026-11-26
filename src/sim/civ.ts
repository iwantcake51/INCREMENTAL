// Colonies, trade, tension and war. Everything here is fiction set in the projected future (after 2026).
//
// How wars start: every pair of powers has a tension score. It rises from the same things that cause real
// wars (rival claims next door, competition for scarce resources, wanting lost colonies back, fear of a power
// that grows too strong, arms races and border incidents) and falls with trade and time. When it boils over
// (100+) and warships exist (2060+), one side declares war. Wars end when both sides are worn out, or one is conquered.

import { Vector3 } from "three";
import { COLONIES, ERAS, FACTIONS, RESOURCE_TEXT, warStartYear, type ColonyDef, type Resource } from "../data/timeline";
import type { Bodies } from "./bodies";
import type { EventBus, Weapon } from "./events";
import type { NewsFeed, NewsItem } from "./news";
import type { Rng } from "./rng";
import { yearOf } from "./time";

export type Cause = "border" | "resources" | "revenge" | "balance" | "arms" | "incident";
const CAUSES: Cause[] = ["border", "resources", "revenge", "balance", "arms", "incident"];

export const CAUSE_INFO: Record<Cause, { label: string; parallel: string }> = {
  border: { label: "Rival claims", parallel: "Like many real wars, it started over disputed territory next door." },
  resources: { label: "Scarce resources", parallel: "Fights over scarce resources such as oil and water have started real wars too." },
  revenge: { label: "Lost territory", parallel: "Wanting lost land back has restarted many real wars." },
  balance: { label: "Balance of power", parallel: "Rivals often gang up on a power that grows too strong, as Europe did against Napoleon." },
  arms: { label: "Arms race", parallel: "Arms races make both sides afraid, as the naval race did before World War I." },
  incident: { label: "Border incident", parallel: "Small clashes can spiral into war, as the 1914 assassination in Sarajevo did." },
};

const ZONE: Record<string, number> = { mercury: 0, venus: 0, earth: 0, mars: 1, ceres: 1, jupiter: 2, saturn: 3, uranus: 4, neptune: 4 };
const ZONE_NAME = ["the inner planets", "Mars and the asteroid belt", "Jupiter's moons", "Saturn's moons", "the outer planets"];

const WEAPON_KIND: Weapon[] = ["coil", "laser", "missile", "lance"];
/** Weapons available in a given year (weapon eras come from the timeline, which varies a little per game). */
export function weaponAt(year: number): { weapon: Weapon; name: string; level: number } | null {
  let r: { weapon: Weapon; name: string; level: number } | null = null;
  ERAS.filter(e => e.weapon).forEach((e, i) => { if (year >= e.y) r = { weapon: WEAPON_KIND[Math.min(i, 3)], name: e.weapon!, level: i }; });
  return r;
}
const firstColonyYear = () => Math.min(...COLONIES.filter(c => c.y > 2026 && c.id !== "luna").map(c => c.y));

export interface Colony extends ColonyDef {
  owner: number;
  /** Founded by the player with a god power. */
  custom?: boolean;
  /** Wrecked by an impact until this year. */
  ruinedUntil?: number;
  active: boolean;
  /** 0–1 while a siege is under way. */
  siege: number;
  besiegedBy: number;
}

export interface War {
  id: number;
  a: number;
  b: number;
  aggressor: number;
  cause: Cause;
  reason: string;
  startDay: number;
  battles: number;
  /** Colonies captured by side a and side b. */
  captures: [number, number];
  taken: string[];
  weariness: number;
  limit: number;
  gameAcc: number;
  realAcc: number;
  nextIn: number;
}

export interface Fleet {
  id: number;
  fac: number;
  warId: number;
  kind: "attack" | "intercept";
  ships: number;
  startShips: number;
  /** Colony ids: where it left from, and what it is attacking (interceptors: the colony they defend). */
  from: string;
  target: string;
  /** Interceptors: the attack fleet they are chasing, and the point of its trip where they meet. */
  chase?: number;
  meetP?: number;
  p: number;
  travel: number;
  state: "transit" | "siege" | "clash" | "done";
  t: number;
  fire: number;
  pos: Vector3;
  dir: Vector3;
  status: string;
}

export interface Freighter { id: number; fac: number; from: string; to: string; p: number; travel: number; pos: Vector3; dir: Vector3 }

type PairMap<T> = T[][];
const pairs = <T>(f: () => T): PairMap<T> => FACTIONS.map(() => FACTIONS.map(f));

export interface CivSnapshot {
  day: number;
  owners: Record<string, number>;
  custom: { body: string; name: string; fac: number; y: number }[];
  blessUntil: number[];
  stormUntil: number;
  wars: War[];
  tension: number[][];
  contrib: Record<Cause, number>[][];
  truce: number[][];
  nextId: number;
  news: NewsItem[];
}

export class Civ {
  colonies: Colony[] = COLONIES.map(c => ({ ...c, owner: c.fac, active: false, siege: 0, besiegedBy: -1 }));
  wars: War[] = [];
  fleets: Fleet[] = [];
  freighters: Freighter[] = [];
  tension = pairs(() => 0);
  contrib = pairs(() => Object.fromEntries(CAUSES.map(c => [c, 0])) as Record<Cause, number>);
  truce = pairs(() => -Infinity);
  warned = pairs(() => false);
  lastIncident = pairs(() => "");
  warsEnabled = true;
  /** God powers: per-faction blessing (until year) and a solar storm that grounds every fleet (until year). */
  blessUntil = FACTIONS.map(() => -Infinity);
  stormUntil = -Infinity;
  /** Bumped whenever something the UI shows changes shape (wars, owners). */
  version = 0;

  private nextId = 1;
  private lastDay = NaN;
  private eraIdx = -1;
  private freightClock = 0;
  private tmpA = new Vector3();
  private tmpB = new Vector3();

  constructor(private news: NewsFeed, private bus: EventBus, private rng: Rng) {}

  colony(id: string) { return this.colonies.find(c => c.id === id)!; }
  activeColonies() { return this.colonies.filter(c => c.active); }
  coloniesOf(f: number) { return this.colonies.filter(c => c.active && c.owner === f); }
  atWar(a: number, b: number) { return this.wars.some(w => (w.a === a && w.b === b) || (w.a === b && w.b === a)); }
  warBetween(a: number, b: number) { return this.wars.find(w => (w.a === a && w.b === b) || (w.a === b && w.b === a)); }
  power(f: number) { return this.coloniesOf(f).reduce((s, c) => s + c.def, 0); }

  /** Advance the simulation. `dtDays` is game time, `dtReal` is wall-clock seconds (used only for what you watch). */
  update(day: number, dtReal: number, daysPerSec: number, bodies: Bodies) {
    if (Number.isNaN(this.lastDay)) { this.reset(day); }
    if (day < this.lastDay - 0.5) { this.reset(day); this.bus.emit({ type: "reset" }); return; }
    const gap = day - this.lastDay;
    if (gap > 120) {
      // Big jump forward: resolve the skipped years quickly without animating them.
      let d = this.lastDay;
      while (d < day) { const step = Math.min(91, day - d); d += step; this.strategic(d, step / 365.25, 0, daysPerSec, bodies, false); }
    } else if (gap > 0) {
      this.strategic(day, gap / 365.25, dtReal, daysPerSec, bodies, true);
    }
    this.lastDay = day;
    this.tactical(day, dtReal, daysPerSec, bodies);
  }

  reset(day: number) {
    const year = yearOf(day);
    this.colonies = this.colonies.filter(c => !c.custom || c.y <= year);
    this.blessUntil = FACTIONS.map(() => -Infinity);
    this.stormUntil = -Infinity;
    this.colonies.forEach(c => { c.owner = c.fac; c.active = year >= c.y; c.siege = 0; c.besiegedBy = -1; c.ruinedUntil = undefined; });
    this.wars = []; this.fleets = []; this.freighters = [];
    this.tension = pairs(() => 0);
    this.contrib = pairs(() => Object.fromEntries(CAUSES.map(c => [c, 0])) as Record<Cause, number>);
    this.truce = pairs(() => -Infinity);
    this.warned = pairs(() => false);
    this.eraIdx = ERAS.reduce((k, e, i) => (year >= e.y ? i : k), -1);
    this.news.rewind(day);
    this.lastDay = day;
    this.version++;
  }

  setWarsEnabled(on: boolean, day: number) {
    this.warsEnabled = on;
    if (!on && this.wars.length) {
      for (const w of [...this.wars]) this.endWar(w, day, "ceasefire", true);
    }
  }

  // ---------- strategic layer: game time ----------

  private strategic(day: number, dtY: number, dtReal: number, daysPerSec: number, bodies: Bodies, live: boolean) {
    const year = yearOf(day);
    this.news.syncHistory(day).forEach(item => this.bus.emit({ type: "news", item, toast: live && !!item.major }));

    // Milestones and new colonies
    while (this.eraIdx + 1 < ERAS.length && year >= ERAS[this.eraIdx + 1].y) {
      const e = ERAS[++this.eraIdx];
      if (!e.real) this.post({ day, cat: "milestone", title: e.name, body: e.shows ? `${e.d} ${e.shows}` : e.d, focus: e.focus, major: true }, live);
      if (e.weapon && year >= warStartYear()) this.armsRace(e.weapon, day, live);
    }
    for (const c of this.colonies) {
      if (!c.active && c.ruinedUntil !== undefined && year >= c.ruinedUntil && year >= c.y) {
        c.active = true; c.ruinedUntil = undefined; this.version++;
        this.post({ day, cat: "colony", title: `${c.name} rebuilt`, body: `Settlers return to ${c.name} and rebuild after the impact.`, focus: c.body, facs: [c.owner] }, live);
        continue;
      }
      if (!c.active && year >= c.y && c.ruinedUntil === undefined) {
        c.active = true; c.owner = c.fac; this.version++;
        if (c.y > 2026) this.post({ day, cat: "colony", title: `${c.name} settlement founded`, body: `The ${FACTIONS[c.fac].name} opens a settlement on ${c.name.replace(/ .*/, "")}.`, focus: c.body, facs: [c.fac] }, live);
      }
    }
    if (year < firstColonyYear()) return;

    // Occupied colonies may rise up and return to the power that founded them (this can revive a fallen power).
    for (const c of this.colonies) {
      if (!c.active || c.owner === c.fac || c.besiegedBy >= 0) continue;
      const founderAlive = this.coloniesOf(c.fac).length > 0;
      if (this.rng.chance(Math.min(0.5, dtY * (founderAlive ? 0.05 : 0.035)))) {
        const occupier = c.owner;
        c.owner = c.fac; this.version++;
        const w = this.warBetween(c.fac, occupier);
        if (w) w.weariness += 1;
        this.post({ day, cat: "war", facs: [c.fac, occupier], focus: c.body, major: !founderAlive,
          title: founderAlive ? `Uprising on ${c.name}` : `The ${FACTIONS[c.fac].name} is reborn`,
          body: founderAlive
            ? `Settlers on ${c.name} throw out the ${FACTIONS[occupier].name} and rejoin the ${FACTIONS[c.fac].name}. Occupations rarely last.`
            : `An uprising on ${c.name} drives out the ${FACTIONS[occupier].name} and restores the ${FACTIONS[c.fac].name}.` }, live);
      }
    }

    // Tension between every pair of powers
    const counts = FACTIONS.map(f => this.coloniesOf(f.id).length);
    const total = counts.reduce((a, b) => a + b, 0) || 1;
    for (let i = 0; i < FACTIONS.length; i++) for (let j = i + 1; j < FACTIONS.length; j++) {
      if (!counts[i] || !counts[j]) { this.tension[i][j] = this.tension[j][i] = Math.max(0, this.tension[i][j] - 20 * dtY); continue; }
      if (this.atWar(i, j)) continue;
      const r = this.rates(i, j, counts, total);
      const truce = this.truce[i][j] > year;
      const temper = (FACTIONS[i].temper + FACTIONS[j].temper) / 2;
      let rise = 0;
      for (const c of CAUSES) {
        const v = Math.max(0, r[c]) * temper * (truce ? 0.15 : 1) * dtY;
        rise += v;
        this.contrib[i][j][c] = this.contrib[j][i][c] = this.contrib[i][j][c] * (1 - 0.08 * dtY) + v;
      }
      let t = this.tension[i][j];
      t += rise - r.trade * dtY - t * 0.08 * dtY;
      // Incidents: random sparks, likelier the more the two compete
      if (!truce && rise > 0 && this.rng.chance(Math.min(0.5, 0.12 * dtY * (1 + rise / dtY / 10)))) {
        const text = this.incident(i, j);
        this.lastIncident[i][j] = this.lastIncident[j][i] = text;
        t += 15; this.contrib[i][j].incident += 15; this.contrib[j][i].incident = this.contrib[i][j].incident;
        this.post({ day, cat: "tension", title: "Incident in space", body: text + ".", facs: [i, j] }, live);
      }
      t = Math.max(0, Math.min(130, t));
      this.tension[i][j] = this.tension[j][i] = t;
      if (t > 70 && !this.warned[i][j]) {
        this.warned[i][j] = true;
        const cause = this.topCause(i, j);
        this.post({ day, cat: "tension", title: `Tensions rise: ${FACTIONS[i].short} and ${FACTIONS[j].short}`,
          body: `Relations between the ${FACTIONS[i].name} and the ${FACTIONS[j].name} are souring over ${this.reason(cause, i, j)}. War is possible.`, facs: [i, j] }, live);
      } else if (t < 40) this.warned[i][j] = false;
      if (t >= 100 && year >= warStartYear() && this.warsEnabled && !truce && this.wars.length < 3) this.declare(i, j, day, live);
    }

    // Wars in progress
    for (const w of [...this.wars]) {
      w.weariness += 1.0 * dtY;
      w.gameAcc += dtY; w.realAcc += dtReal;
      if (w.gameAcc >= w.nextIn && year >= this.stormUntil) {
        const visible = this.fleets.filter(f => f.warId === w.id && f.kind === "attack").length;
        if (live && visible < 2 && this.fleets.length < 12) { this.spawnAttack(w, day, daysPerSec, bodies); w.gameAcc = 0; w.realAcc = 0; w.nextIn = this.rng.range(0.1, 0.25); }
        else if (!live || (daysPerSec >= 200 && w.realAcc >= 0.5)) { this.abstractBattle(w, day, bodies, live); w.gameAcc = 0; w.realAcc = 0; w.nextIn = this.rng.range(0.1, 0.25); }
      }
      if (!this.coloniesOf(w.a).length || !this.coloniesOf(w.b).length) this.endWar(w, day, "conquest", live);
      else if (w.weariness >= w.limit) this.endWar(w, day, "treaty", live);
    }
  }

  private rates(i: number, j: number, counts: number[], total: number) {
    const ci = this.coloniesOf(i), cj = this.coloniesOf(j);
    const r: Record<Cause | "trade", number> = { border: 0, resources: 0, revenge: 0, balance: 0, arms: 0, incident: 0, trade: 0 };
    // Rival claims: colonies in the same or neighboring zones
    for (const a of ci) for (const b of cj) {
      const za = ZONE[sysOf(a.body)], zb = ZONE[sysOf(b.body)];
      if (za === zb) r.border += 2.5; else if (Math.abs(za - zb) === 1) r.border += 0.6;
    }
    // Scarce resources both depend on
    const resI = new Set(ci.flatMap(c => c.res)), resJ = new Set(cj.flatMap(c => c.res));
    resI.forEach(x => { if (x !== "people" && resJ.has(x)) r.resources += 3.5; });
    // Lost colonies held by the other side
    r.revenge = 7 * this.colonies.filter(c => c.active && ((c.fac === i && c.owner === j) || (c.fac === j && c.owner === i))).length;
    // Fear of a power that grows too strong
    if (counts[j] / total > 0.4 || counts[i] / total > 0.4) r.balance = 6;
    // Trade calms things down
    r.trade = Math.sqrt(counts[i] * counts[j]) * 1.2;
    return r;
  }

  private topCause(i: number, j: number): Cause {
    let best: Cause = "incident", v = -1;
    for (const c of CAUSES) if (this.contrib[i][j][c] > v) { v = this.contrib[i][j][c]; best = c; }
    return best;
  }

  private reason(cause: Cause, i: number, j: number): string {
    switch (cause) {
      case "border": {
        const zones = new Map<number, number>();
        for (const a of this.coloniesOf(i)) for (const b of this.coloniesOf(j)) {
          const za = ZONE[sysOf(a.body)]; if (za === ZONE[sysOf(b.body)]) zones.set(za, (zones.get(za) ?? 0) + 1);
        }
        const z = [...zones.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ZONE[sysOf(this.coloniesOf(j)[0]?.body ?? "earth")];
        return `rival claims in ${ZONE_NAME[z]}`;
      }
      case "resources": {
        const ri = new Set(this.coloniesOf(i).flatMap(c => c.res));
        const shared = this.coloniesOf(j).flatMap(c => c.res).find(x => x !== "people" && ri.has(x)) as Resource | undefined;
        return `control of ${RESOURCE_TEXT[shared ?? "water"]}, which both depend on`;
      }
      case "revenge": {
        const lost = this.colonies.find(c => c.active && ((c.fac === i && c.owner === j) || (c.fac === j && c.owner === i)));
        return lost ? `${lost.name}, which the ${FACTIONS[lost.fac].name} lost in an earlier war` : "colonies lost in an earlier war";
      }
      case "balance": {
        const strong = this.coloniesOf(i).length >= this.coloniesOf(j).length ? i : j;
        return `fear of the ${FACTIONS[strong].name}'s growing power`;
      }
      case "arms": return `a spiraling arms race (${weaponAt(yearOf(this.lastDay))?.name.toLowerCase() ?? "new weapons"})`;
      case "incident": return (this.lastIncident[i][j] || "a clash between patrol ships").replace(/^./, c => c.toLowerCase());
    }
  }

  private incident(i: number, j: number) {
    const [a, b] = this.rng.chance(0.5) ? [i, j] : [j, i];
    const places = [...this.coloniesOf(a), ...this.coloniesOf(b)].filter(c => c.id !== "earth");
    const place = (places.length ? this.rng.pick(places) : this.colony("earth")).name;
    const A = FACTIONS[a].short, B = FACTIONS[b].short;
    return this.rng.pick([
      `A ${A} patrol boards a ${B} freighter near ${place}`,
      `A ${B} survey drone is shot down over ${place}`,
      `The ${FACTIONS[a].name} accuses the ${FACTIONS[b].name} of spying on ${place}`,
      `${B} miners are expelled from claims near ${place}`,
      `A ${A} warship rams a ${B} tug near ${place}`,
      `${A} and ${B} patrols exchange warning shots near ${place}`,
    ]);
  }

  private armsRace(weapon: string, day: number, live: boolean) {
    for (let i = 0; i < FACTIONS.length; i++) for (let j = i + 1; j < FACTIONS.length; j++) {
      if (!this.coloniesOf(i).length || !this.coloniesOf(j).length) continue;
      this.tension[i][j] = this.tension[j][i] = this.tension[i][j] + 20;
      this.contrib[i][j].arms += 20; this.contrib[j][i].arms = this.contrib[i][j].arms;
    }
    this.post({ day, cat: "tension", title: `Arms race: ${weapon}`, body: `Every power rushes to fit ${weapon.toLowerCase()} to its warships. Tensions rise everywhere.` }, live);
  }

  private declare(i: number, j: number, day: number, live: boolean) {
    const cause = this.topCause(i, j);
    let aggressor: number;
    if (cause === "revenge") {
      const lost = this.colonies.find(c => c.active && ((c.fac === i && c.owner === j) || (c.fac === j && c.owner === i)));
      aggressor = lost ? lost.fac : i;
    } else if (cause === "balance") {
      aggressor = this.coloniesOf(i).length < this.coloniesOf(j).length ? i : j;
    } else {
      aggressor = FACTIONS[i].temper * (1 + this.power(i) / 40) >= FACTIONS[j].temper * (1 + this.power(j) / 40) ? i : j;
    }
    const other = aggressor === i ? j : i;
    const reason = this.reason(cause, i, j);
    const w: War = { id: this.nextId++, a: aggressor, b: other, aggressor, cause, reason, startDay: day, battles: 0, captures: [0, 0], taken: [],
      weariness: 0, limit: this.rng.range(6, 12), gameAcc: 0, realAcc: 0, nextIn: this.rng.range(0.03, 0.1) };
    this.wars.push(w);
    this.version++;
    const capital = this.coloniesOf(other)[0];
    this.post({ day, cat: "war", major: true, facs: [aggressor, other], focus: capital?.body,
      title: `War: ${FACTIONS[aggressor].short} vs ${FACTIONS[other].short}`,
      body: `The ${FACTIONS[aggressor].name} declares war on the ${FACTIONS[other].name} over ${reason}. ${CAUSE_INFO[cause].parallel}` }, live);
  }

  private endWar(w: War, day: number, how: "treaty" | "conquest" | "ceasefire", live: boolean) {
    this.wars = this.wars.filter(x => x !== w);
    this.fleets.filter(f => f.warId === w.id).forEach(f => { f.state = "done"; });
    this.colonies.forEach(c => { if (c.besiegedBy === w.a || c.besiegedBy === w.b) { c.siege = 0; c.besiegedBy = -1; } });
    const year = yearOf(day), A = FACTIONS[w.a], B = FACTIONS[w.b];
    this.truce[w.a][w.b] = this.truce[w.b][w.a] = year + this.rng.range(20, 45);
    this.tension[w.a][w.b] = this.tension[w.b][w.a] = 15;
    for (const c of CAUSES) this.contrib[w.a][w.b][c] = this.contrib[w.b][w.a][c] = 0;
    this.warned[w.a][w.b] = this.warned[w.b][w.a] = false;
    this.version++;
    const years = Math.max(1, Math.round(year - yearOf(w.startDay)));
    const gains = (k: 0 | 1) => w.captures[k] ? `${(k ? B : A).short} gained ${w.captures[k]} colon${w.captures[k] > 1 ? "ies" : "y"}` : "";
    const summary = [gains(0), gains(1)].filter(Boolean).join(", ") || "Neither side gained ground";
    if (how === "conquest") {
      const loser = this.coloniesOf(w.a).length ? B : A, winner = loser === A ? B : A;
      this.post({ day, cat: "war", major: true, facs: [w.a, w.b], title: `The ${loser.name} has fallen`,
        body: `After ${w.battles} battle${w.battles === 1 ? "" : "s"}, the ${winner.name} holds every one of its colonies.` }, live);
    } else {
      const place = w.taken.length ? this.colony(this.rng.pick(w.taken)).name : this.rng.pick([...this.coloniesOf(w.a), ...this.coloniesOf(w.b)])?.name ?? "Earth";
      this.post({ day, cat: "peace", major: true, facs: [w.a, w.b],
        title: how === "ceasefire" ? `Ceasefire: ${A.short} and ${B.short}` : `Peace: the Treaty of ${place.replace(/ .*/, "")}`,
        body: `${A.name} and ${B.name} stop fighting after ${w.battles} battle${w.battles === 1 ? "" : "s"} in ${years} year${years === 1 ? "" : "s"}. ${summary}. A truce should hold for a few decades.` }, live);
    }
  }

  // ---------- battles ----------

  private pickTarget(w: War, attacker: number, bodies: Bodies) {
    const defender = attacker === w.a ? w.b : w.a;
    const mine = this.coloniesOf(attacker), theirs = this.coloniesOf(defender);
    if (!mine.length || !theirs.length) return null;
    const pos = (c: Colony) => bodies.get(c.body)!.pos;
    // Prefer nearby targets, and colonies that used to be ours.
    const scored = theirs.map(t => {
      let best = mine[0], bd = Infinity;
      for (const m of mine) { const d = pos(m).distanceTo(pos(t)); if (d < bd) { bd = d; best = m; } }
      return { t, from: best, d: bd * (t.fac === attacker ? 0.4 : 1) * (t.id === "earth" ? 2.5 : 1) };
    }).sort((a, b) => a.d - b.d);
    return scored[Math.floor(this.rng.next() ** 2 * scored.length)];
  }

  private chooseAttacker(w: War) {
    const pa = this.power(w.a) * (w.aggressor === w.a ? 1.3 : 1), pb = this.power(w.b);
    return this.rng.next() < pa / (pa + pb) ? w.a : w.b;
  }

  private fleetSize(fac: number, year: number) {
    return 3 + this.rng.int(3) + (weaponAt(year)?.level ?? 0) + Math.floor(this.power(fac) / 12) + (this.blessUntil[fac] > year ? 3 : 0);
  }

  private spawnAttack(w: War, day: number, daysPerSec: number, bodies: Bodies) {
    const attacker = this.chooseAttacker(w);
    const pick = this.pickTarget(w, attacker, bodies);
    if (!pick) return;
    const year = yearOf(day);
    const ships = this.fleetSize(attacker, year);
    const travel = clamp((40 + pick.d * 1.5) / daysPerSec, 2.5, 7);
    const f: Fleet = { id: this.nextId++, fac: attacker, warId: w.id, kind: "attack", ships, startShips: ships, from: pick.from.id, target: pick.t.id,
      p: 0, travel, state: "transit", t: 0, fire: 0, pos: bodies.get(pick.from.body)!.pos.clone(), dir: new Vector3(1, 0, 0), status: "" };
    this.fleets.push(f);
    // The defender may send ships to intercept on the way.
    const defender = attacker === w.a ? w.b : w.a;
    const guards = this.coloniesOf(defender).filter(c => c.id !== pick.t.id);
    if (guards.length && this.rng.chance(0.4)) {
      const mid = this.tmpA.lerpVectors(bodies.get(pick.from.body)!.pos, bodies.get(pick.t.body)!.pos, 0.55);
      const g = guards.sort((a, b) => bodies.get(a.body)!.pos.distanceTo(mid) - bodies.get(b.body)!.pos.distanceTo(mid))[0];
      const n = Math.max(2, this.fleetSize(defender, year) - 1);
      this.fleets.push({ id: this.nextId++, fac: defender, warId: w.id, kind: "intercept", ships: n, startShips: n, from: g.id, target: pick.t.id,
        chase: f.id, meetP: this.rng.range(0.45, 0.65), p: 0, travel, state: "transit", t: 0, fire: 0,
        pos: bodies.get(g.body)!.pos.clone(), dir: new Vector3(1, 0, 0), status: "" });
    }
  }

  private defense(c: Colony, year: number) {
    const blessed = this.blessUntil[c.owner] > year ? 1.7 : 1;
    const homeTurf = c.owner === c.fac ? 1.4 : 0.8;
    return homeTurf * (c.def * (1 + Math.min(1.5, (year - c.y) / 100)) + this.power(c.owner) * 0.1) * blessed;
  }

  /** Decide a siege. Returns true if the colony changed hands. */
  private resolveSiege(w: War, fac: number, ships: number, c: Colony, day: number, live: boolean, bodies: Bodies) {
    const year = yearOf(day);
    const atk = ships * (1 + 0.15 * (weaponAt(year)?.level ?? 0));
    const odds = atk / (atk + this.defense(c, year) * 1.2);
    const old = c.owner;
    w.battles++;
    c.siege = 0; c.besiegedBy = -1;
    const at = bodies.get(c.body)!.pos;
    if (this.rng.next() < odds) {
      c.owner = fac;
      w.captures[fac === w.a ? 0 : 1]++;
      if (!w.taken.includes(c.id)) w.taken.push(c.id);
      w.weariness += 1.5;
      this.version++;
      this.bus.emit({ type: "blast", at: at.clone(), color: FACTIONS[fac].color, size: 2 });
      this.post({ day, cat: "war", facs: [fac, old], focus: c.body, major: c.id === "earth" || c.fac === old && c.def >= 6,
        title: `${FACTIONS[fac].short} forces capture ${c.name}`,
        body: `${c.name} falls to the ${FACTIONS[fac].name} after a ${odds < 0.35 ? "daring" : "hard-fought"} assault. It was held by the ${FACTIONS[old].name}.` }, live);
      return true;
    }
    w.weariness += 1;
    this.post({ day, cat: "war", facs: [old, fac], focus: c.body,
      title: `${c.name} holds out`, body: `${c.name}'s defenses drive off a ${FACTIONS[fac].name} attack of ${ships} ship${ships === 1 ? "" : "s"}.` }, live);
    return false;
  }

  private abstractBattle(w: War, day: number, bodies: Bodies, live: boolean) {
    const attacker = this.chooseAttacker(w);
    const pick = this.pickTarget(w, attacker, bodies);
    if (pick) this.resolveSiege(w, attacker, this.fleetSize(attacker, yearOf(day)), pick.t, day, live, bodies);
  }

  // ---------- tactical layer: what you watch, in real seconds ----------

  private tactical(day: number, dtReal: number, daysPerSec: number, bodies: Bodies) {
    const year = yearOf(day);
    for (const o of this.orders.splice(0)) {
      const w = this.warBetween(o.fac, this.colony(o.target).owner);
      const target = this.colony(o.target);
      const mine = this.coloniesOf(o.fac);
      if (!w || !mine.length) continue;
      const from = mine.reduce((best, m) => bodies.get(m.body)!.pos.distanceTo(bodies.get(target.body)!.pos) < bodies.get(best.body)!.pos.distanceTo(bodies.get(target.body)!.pos) ? m : best, mine[0]);
      const ships = this.fleetSize(o.fac, year) + 2;
      const d = bodies.get(from.body)!.pos.distanceTo(bodies.get(target.body)!.pos);
      this.fleets.push({ id: this.nextId++, fac: o.fac, warId: w.id, kind: "attack", ships, startShips: ships, from: from.id, target: target.id,
        p: 0, travel: clamp((40 + d * 1.5) / daysPerSec, 2.5, 7), state: "transit", t: 0, fire: 0, pos: bodies.get(from.body)!.pos.clone(), dir: new Vector3(1, 0, 0), status: "" });
    }
    const weapon = weaponAt(year)?.weapon ?? "coil";
    const byId = new Map(this.fleets.map(f => [f.id, f]));
    for (const f of this.fleets) {
      if (f.state === "done") continue;
      const w = this.wars.find(x => x.id === f.warId);
      const target = this.colony(f.target), from = this.colony(f.from);
      if (!w || !target.active) { f.state = "done"; continue; }
      if (f.kind === "attack" && target.owner === f.fac) { f.state = "done"; continue; }
      const T = bodies.get(target.body)!, A = bodies.get(from.body)!;
      const prev = this.tmpB.copy(f.pos);

      if (f.kind === "attack") {
        if (f.state === "transit") {
          f.p = Math.min(1, f.p + dtReal / f.travel);
          arcPoint(A.pos, A.radius, T.pos, T.radius, f.p, f.pos);
          f.status = `Heading for ${target.name}`;
          if (f.p >= 1) { f.state = "siege"; f.t = 0; }
        } else if (f.state === "siege") {
          standoff(A.pos, T.pos, T.radius, f.pos);
          f.t += dtReal; f.fire += dtReal;
          target.siege = Math.min(1, f.t / 3); target.besiegedBy = f.fac;
          f.status = `Attacking ${target.name}`;
          if (f.fire > 0.14) { f.fire = 0; this.shoot(f.pos, T.pos, T.radius, f.fac, weapon); }
          if (f.t >= 3) { this.resolveSiege(w, f.fac, f.ships, target, day, true, bodies); f.state = "done"; }
        }
      } else {
        const prey = byId.get(f.chase!);
        if (!prey || prey.state === "done" || prey.state === "siege") { f.state = "done"; continue; }
        const PA = bodies.get(this.colony(prey.from).body)!;
        const meet = arcPoint(PA.pos, PA.radius, T.pos, T.radius, f.meetP!, this.tmpA);
        const q = Math.min(1, prey.p / f.meetP!);
        f.pos.lerpVectors(A.pos, meet, easeInOut(q));
        f.status = `Intercepting ${FACTIONS[prey.fac].short} fleet`;
        if (q >= 1 && f.state === "transit") { f.state = "clash"; prey.state = "clash"; f.t = 0; }
        if (f.state === "clash") {
          f.pos.copy(meet).addScaledVector(prey.dir, 0.6);
          f.status = prey.status = "Fleet battle";
          f.t += dtReal; f.fire += dtReal;
          if (f.fire > 0.22) {
            f.fire = 0;
            this.shoot(f.pos, prey.pos, 0, f.fac, weapon);
            this.shoot(prey.pos, f.pos, 0, prey.fac, weapon);
            const loser = this.rng.next() < f.ships / (f.ships + prey.ships) ? prey : f;
            loser.ships--;
            this.bus.emit({ type: "blast", at: loser.pos.clone(), color: FACTIONS[loser.fac].color, size: 0.6 });
          }
          if (f.t > 2.6 || f.ships <= 0 || prey.ships <= 0) this.resolveClash(w, prey, f, day, target);
        }
      }
      if (f.state !== "done") { const d = this.tmpA.subVectors(f.pos, prev); if (d.lengthSq() > 1e-8) f.dir.copy(d.normalize()); }
    }
    this.fleets = this.fleets.filter(f => f.state !== "done");
    this.updateFreighters(day, dtReal, daysPerSec, bodies, year);
  }

  private resolveClash(w: War, atk: Fleet, def: Fleet, day: number, target: Colony) {
    w.battles++; w.weariness += 0.7;
    const atkWins = atk.ships >= def.ships && atk.ships > 0;
    def.state = "done";
    if (atkWins) {
      atk.state = "transit"; atk.ships = Math.max(1, atk.ships);
      this.post({ day, cat: "war", facs: [atk.fac, def.fac], focus: target.body, title: `${FACTIONS[atk.fac].short} fleet breaks through`,
        body: `A ${FACTIONS[def.fac].name} squadron fails to stop ${atk.ships} ${FACTIONS[atk.fac].short} warship${atk.ships === 1 ? "" : "s"} heading for ${target.name}.` }, true);
    } else {
      atk.state = "done";
      this.post({ day, cat: "war", facs: [def.fac, atk.fac], focus: target.body, title: `${FACTIONS[def.fac].short} navy stops an attack`,
        body: `${FACTIONS[def.fac].name} ships turn back a ${FACTIONS[atk.fac].short} fleet bound for ${target.name}.` }, true);
    }
  }

  private shoot(from: Vector3, to: Vector3, radius: number, fac: number, weapon: Weapon) {
    const aim = to.clone();
    if (radius > 0) aim.add(new Vector3(this.rng.range(-1, 1), this.rng.range(-1, 1), this.rng.range(-1, 1)).normalize().multiplyScalar(radius * 0.9));
    this.bus.emit({ type: "shot", from: from.clone().add(new Vector3(this.rng.range(-.15, .15), this.rng.range(-.15, .15), this.rng.range(-.15, .15))), to: aim, color: FACTIONS[fac].color, weapon });
  }

  private updateFreighters(day: number, dtReal: number, daysPerSec: number, bodies: Bodies, year: number) {
    const act = this.activeColonies();
    if (year >= firstColonyYear() && act.length >= 2) {
      this.freightClock += dtReal * Math.min(2.5, 0.35 * act.length);
      while (this.freightClock > 1 && this.freighters.length < 36) {
        this.freightClock -= 1;
        const a = this.rng.pick(act), b = this.rng.pick(act);
        if (a === b || this.atWar(a.owner, b.owner)) continue;
        const d = bodies.get(a.body)!.pos.distanceTo(bodies.get(b.body)!.pos);
        this.freighters.push({ id: this.nextId++, fac: a.owner, from: a.id, to: b.id, p: 0, travel: clamp((30 + d * 1.2) / daysPerSec, 2.5, 8),
          pos: bodies.get(a.body)!.pos.clone(), dir: new Vector3(1, 0, 0) });
      }
      this.freightClock = Math.min(this.freightClock, 1);
    }
    for (const f of this.freighters) {
      const A = bodies.get(this.colony(f.from).body)!, B = bodies.get(this.colony(f.to).body)!;
      f.p += dtReal / f.travel;
      const prev = this.tmpB.copy(f.pos);
      arcPoint(A.pos, A.radius, B.pos, B.radius, Math.min(1, f.p), f.pos);
      const d = this.tmpA.subVectors(f.pos, prev); if (d.lengthSq() > 1e-8) f.dir.copy(d.normalize());
    }
    this.freighters = this.freighters.filter(f => f.p < 1 && this.colony(f.from).active && this.colony(f.to).active);
    void day;
  }

  private post(item: Omit<NewsItem, "id">, live: boolean) {
    const full = this.news.add(item);
    this.bus.emit({ type: "news", item: full, toast: live && !!item.major });
  }

  // ---------- god powers ----------

  nudgeTension(i: number, j: number, delta: number, cause: Cause = "incident") {
    const t = Math.max(0, Math.min(130, this.tension[i][j] + delta));
    this.tension[i][j] = this.tension[j][i] = t;
    if (delta > 0) { this.contrib[i][j][cause] += delta; this.contrib[j][i][cause] = this.contrib[i][j][cause]; }
    else for (const c of CAUSES) this.contrib[i][j][c] = this.contrib[j][i][c] = this.contrib[i][j][c] * (t / Math.max(1, t - delta));
    this.version++;
  }

  calmAll(amount: number) {
    for (let i = 0; i < FACTIONS.length; i++) for (let j = i + 1; j < FACTIONS.length; j++) if (!this.atWar(i, j)) this.nudgeTension(i, j, -amount);
  }

  sowDiscord(i: number, j: number, day: number) {
    this.lastIncident[i][j] = this.lastIncident[j][i] = `Mysterious sabotage blamed on each other`;
    this.nudgeTension(i, j, 45, "incident");
    this.truce[i][j] = this.truce[j][i] = Math.min(this.truce[i][j], yearOf(day));
    if (this.tension[i][j] >= 100 && yearOf(day) >= warStartYear() && this.warsEnabled && !this.atWar(i, j)) this.declare(i, j, day, true);
  }

  forceWar(i: number, j: number, day: number) {
    if (this.atWar(i, j) || !this.coloniesOf(i).length || !this.coloniesOf(j).length) return false;
    this.nudgeTension(i, j, 110 - this.tension[i][j], "incident");
    this.lastIncident[i][j] = this.lastIncident[j][i] = "An omen that both sides read as a call to arms";
    this.truce[i][j] = this.truce[j][i] = -Infinity;
    this.declare(i, j, day, true);
    return true;
  }

  forcePeace(warId: number, day: number) {
    const w = this.wars.find(x => x.id === warId);
    if (w) this.endWar(w, day, "treaty", true);
    return !!w;
  }

  bless(f: number, day: number, years = 25) {
    this.blessUntil[f] = yearOf(day) + years;
    this.version++;
    this.post({ day, cat: "milestone", facs: [f], title: `The ${FACTIONS[f].name} prospers`,
      body: `A run of good fortune: stronger defenses and bigger fleets for ${years} years.` }, true);
  }

  solarStorm(day: number, years = 3) {
    this.stormUntil = yearOf(day) + years;
    this.fleets.forEach(f => (f.state = "done"));
    this.colonies.forEach(c => { c.siege = 0; c.besiegedBy = -1; });
    this.post({ day, cat: "disaster", focus: "sun", major: true, title: "Great solar storm",
      body: `A huge solar flare fries ship electronics across the solar system. Every fleet is grounded for ${years} years.` }, true);
  }

  /** An impact wrecks a colony for some years. */
  ruin(id: string, day: number, years: number) {
    const c = this.colony(id);
    c.active = false; c.siege = 0; c.besiegedBy = -1;
    c.ruinedUntil = yearOf(day) + years;
    this.fleets.filter(f => f.target === id || f.from === id).forEach(f => (f.state = "done"));
    this.version++;
  }

  handOver(id: string, fac: number, day: number) {
    const c = this.colonies.find(x => x.id === id);
    if (!c || !c.active) return false;
    const old = c.owner;
    c.owner = fac; c.siege = 0; c.besiegedBy = -1; this.version++;
    this.post({ day, cat: "colony", facs: [fac, old], focus: c.body, title: `${c.name} changes hands`, body: `${c.name} passes from the ${FACTIONS[old].name} to the ${FACTIONS[fac].name}, as if by an unseen hand.` }, true);
    return true;
  }

  uprising(id: string, day: number) {
    const c = this.colonies.find(x => x.id === id);
    if (!c || !c.active || c.owner === c.fac) return false;
    const old = c.owner;
    c.owner = c.fac; this.version++;
    this.post({ day, cat: "war", facs: [c.fac, old], focus: c.body, major: true, title: `Uprising on ${c.name}`, body: `Settlers on ${c.name} throw out the ${FACTIONS[old].name} and rejoin the ${FACTIONS[c.fac].name}.` }, true);
    return true;
  }

  /** Attack orders from god mode, launched on the next tactical update (where positions are known). */
  private orders: { fac: number; target: string; day: number }[] = [];
  orderAttack(fac: number, target: string, day: number) {
    const c = this.colonies.find(x => x.id === target);
    if (!c || !c.active || c.owner === fac || !this.coloniesOf(fac).length) return false;
    if (!this.atWar(fac, c.owner)) this.forceWar(fac, c.owner, day);
    if (!this.atWar(fac, c.owner)) return false;
    this.orders.push({ fac, target, day });
    return true;
  }

  canFound(body: string) { return !this.colonies.some(c => c.body === body); }

  foundColony(body: string, name: string, fac: number, day: number) {
    if (!this.canFound(body)) return false;
    const y = yearOf(day);
    this.colonies.push({ id: "custom-" + body, body, name, y, fac, def: 2, res: ["water", "metals"], owner: fac, active: true, siege: 0, besiegedBy: -1, custom: true });
    this.version++;
    this.post({ day, cat: "colony", facs: [fac], focus: body, title: `${name} settlement founded`, body: `Guided by unseen hands, the ${FACTIONS[fac].name} settles ${name}.` }, true);
    return true;
  }

  // ---------- save / load ----------

  snapshot(day: number): CivSnapshot {
    return {
      day, owners: Object.fromEntries(this.colonies.map(c => [c.id, c.owner])),
      custom: this.colonies.filter(c => c.custom).map(c => ({ body: c.body, name: c.name, fac: c.fac, y: c.y })),
      blessUntil: this.blessUntil.map(v => (Number.isFinite(v) ? v : -1e9)), stormUntil: Number.isFinite(this.stormUntil) ? this.stormUntil : -1e9,
      wars: this.wars.map(w => ({ ...w, taken: [...w.taken] })), tension: this.tension.map(r => [...r]),
      contrib: this.contrib.map(r => r.map(c => ({ ...c }))), truce: this.truce.map(r => r.map(v => (Number.isFinite(v) ? v : -1e9))),
      nextId: this.nextId, news: this.news.items.filter(n => !n.real),
    };
  }

  restore(s: CivSnapshot) {
    this.reset(s.day);
    for (const c of s.custom ?? []) this.colonies.push({ id: "custom-" + c.body, body: c.body, name: c.name, y: c.y, fac: c.fac, def: 2, res: ["water", "metals"], owner: c.fac, active: true, siege: 0, besiegedBy: -1, custom: true });
    if (s.blessUntil) this.blessUntil = s.blessUntil;
    this.stormUntil = s.stormUntil ?? -1e9;
    this.colonies.forEach(c => { if (s.owners[c.id] !== undefined) c.owner = s.owners[c.id]; });
    this.wars = s.wars; this.tension = s.tension; this.contrib = s.contrib; this.truce = s.truce; this.nextId = s.nextId;
    this.news.restore(s.news, s.day);
    this.version++;
  }
}

function sysOf(body: string) {
  const moonParent: Record<string, string> = { moon: "earth", phobos: "mars", deimos: "mars", io: "jupiter", europa: "jupiter", ganymede: "jupiter", callisto: "jupiter", enceladus: "saturn", titan: "saturn", titania: "uranus", triton: "neptune" };
  return moonParent[body] ?? body;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);
const _d = new Vector3();

/** A point along a curved flight path from body A to body B that rises out of the orbital plane. */
export function arcPoint(A: Vector3, rA: number, B: Vector3, rB: number, p: number, out: Vector3) {
  _d.subVectors(B, A);
  const len = _d.length() || 1;
  _d.divideScalar(len);
  const s0 = Math.min(rA * 2 + 0.3, len * 0.3), s1 = Math.min(rB * 2.6 + 0.5, len * 0.3);
  const e = easeInOut(p);
  out.copy(A).addScaledVector(_d, s0 + (len - s0 - s1) * e);
  out.y += Math.sin(Math.PI * e) * len * 0.08;
  return out;
}

/** Where a besieging fleet waits: just outside the target, on the side it came from. */
function standoff(A: Vector3, T: Vector3, rT: number, out: Vector3) {
  _d.subVectors(A, T).normalize();
  out.copy(T).addScaledVector(_d, rT * 2.6 + 0.5);
  return out;
}
