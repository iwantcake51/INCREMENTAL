import { describe, expect, it } from "vitest";
import { PLANETS } from "../src/data/bodies";
import { distanceAU, heliocentric } from "../src/sim/orbits";
import { dayFromDate, dayFromISO, yearOf } from "../src/sim/time";
import { World } from "../src/sim/world";

const earth = PLANETS.find(p => p.id === "earth")!.orbit;
const mars = PLANETS.find(p => p.id === "mars")!.orbit;

describe("orbits", () => {
  it("keeps Earth about 1 AU from the Sun, closest in early January", () => {
    const r = (d: number) => { const p = heliocentric(earth, d, { x: 0, y: 0, z: 0 }); return Math.hypot(p.x, p.y, p.z); };
    expect(r(dayFromISO("2025-01-04"))).toBeCloseTo(0.983, 2);
    expect(r(dayFromISO("2025-07-04"))).toBeCloseTo(1.017, 2);
  });
  it("puts Mars at a close approach in January 2025", () => {
    expect(distanceAU(earth, mars, dayFromISO("2025-01-12"))).toBeLessThan(0.65);
  });
});

/** Run the simulation headless in coarse steps (like fast-forwarding) and collect the news. */
function run(seed: number, toYear: number, speed = 365.25) {
  const w = new World(seed);
  w.setDay(dayFromDate(2026, 11, 26));
  w.speed = speed;
  const dt = 1 / 30;
  while (w.year < toYear) w.step(dt);
  return w;
}

describe("civilization", () => {
  it("adds real history news on real dates", () => {
    const w = new World(1);
    expect(w.news.items.some(n => n.title.includes("Sputnik"))).toBe(true);
    expect(w.news.items.every(n => n.day <= w.day)).toBe(true);
  });

  it("starts wars on its own, for a stated reason, after warships exist", () => {
    let wars = 0;
    for (const seed of [1, 2, 3, 4]) {
      const w = run(seed, 2200);
      const declared = w.news.items.filter(n => n.cat === "war" && n.title.startsWith("War:"));
      wars += declared.length;
      for (const n of declared) {
        expect(yearOf(n.day)).toBeGreaterThanOrEqual(2060);
        expect(n.body).toMatch(/ over /);
      }
    }
    expect(wars).toBeGreaterThan(3);
  });

  it("ends wars with peace treaties or conquest", () => {
    const w = run(7, 2300);
    expect(w.news.items.some(n => n.cat === "peace" || n.title.includes("has fallen"))).toBe(true);
  });

  it("undoes the future when time jumps backwards", () => {
    const w = run(3, 2150);
    w.setDay(dayFromDate(2030));
    w.step(0);
    expect(w.civ.wars.length).toBe(0);
    expect(w.news.items.every(n => n.day <= w.day + 1)).toBe(true);
    expect(w.civ.colonies.filter(c => c.active).map(c => c.id)).toEqual(["earth"]);
  });

  it("resolves a big jump forward without animating it", () => {
    const w = new World(5);
    w.setDay(dayFromDate(2250));
    w.step(0);
    expect(w.civ.activeColonies().length).toBeGreaterThan(8);
  });
});

describe("god mode", () => {
  it("earns influence, ranks up and spends it on powers", () => {
    const w = run(2, 2120);
    expect(w.god.earned).toBeGreaterThan(80);
    expect(w.god.rank).toBeGreaterThanOrEqual(1);
    const before = w.god.influence;
    expect(w.god.use("calm", w.day)).toBeNull();
    expect(w.god.influence).toBeLessThan(before);
    expect(w.god.goals.has("power")).toBe(true);
  });

  it("can force a war and impose peace", () => {
    const w = run(4, 2100);
    w.god.influence = w.god.earned = 1000;
    w.civ.wars.forEach(x => w.civ.forcePeace(x.id, w.day));
    expect(w.civ.forceWar(0, 2, w.day)).toBe(true);
    const war = w.civ.warBetween(0, 2)!;
    expect(w.god.use("peace", w.day, war.id)).toBeNull();
    expect(w.civ.atWar(0, 2)).toBe(false);
  });

  it("round-trips a save", () => {
    const w = run(6, 2140);
    const s = JSON.parse(JSON.stringify(w.save("earth")));
    const w2 = new World(9);
    w2.load(s);
    expect(w2.civ.colonies.map(c => c.owner)).toEqual(w.civ.colonies.map(c => c.owner));
    expect(w2.god.influence).toBeCloseTo(w.god.influence);
  });
});
