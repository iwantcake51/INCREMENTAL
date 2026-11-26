import { describe, expect, it } from "vitest";
import { NewsFeed } from "../src/sim/news";
import { SkyWatcher } from "../src/sim/sky";
import { dayFromISO, isoOf } from "../src/sim/time";
import { World } from "../src/sim/world";

function events(from: string, to: string) {
  const sky = new SkyWatcher(), news = new NewsFeed(), out: { title: string; date: string }[] = [];
  for (let d = dayFromISO(from); d < dayFromISO(to); d += 0.05) sky.update(d, 0.05, news, it => out.push({ title: it.title, date: isoOf(it.day) }));
  return out;
}
const near = (date: string, target: string, days = 1.5) => Math.abs(dayFromISO(date) - dayFromISO(target)) <= days;

describe("sky events", () => {
  it("finds the 8 April 2024 total solar eclipse", () => {
    const e = events("2024-03-20", "2024-04-20").filter(x => x.title.includes("solar eclipse"));
    expect(e.some(x => near(x.date, "2024-04-08") && x.title.startsWith("Total"))).toBe(true);
  });
  it("finds the 14 March 2025 total lunar eclipse", () => {
    const e = events("2025-03-01", "2025-03-25").filter(x => x.title.includes("lunar eclipse"));
    expect(e.some(x => near(x.date, "2025-03-14") && x.title.startsWith("Total"))).toBe(true);
  });
  it("finds the January 2025 Mars opposition", () => {
    const e = events("2024-12-15", "2025-02-15").filter(x => x.title.includes("Mars"));
    expect(e.some(x => near(x.date, "2025-01-16", 3))).toBe(true);
  });
  it("does not invent eclipses every month", () => {
    const e = events("2024-05-01", "2024-08-30").filter(x => x.title.includes("eclipse"));
    expect(e.length).toBe(0);
  });
});

describe("impacts", () => {
  it("leaves a crater that fades over time, and asteroid strikes can be ordered", () => {
    const w = new World(3);
    w.setDay(dayFromISO("2100-01-01"));
    w.step(0);
    w.god.influence = w.god.earned = 2000;
    expect(w.god.use("asteroid", w.day, "earth")).toBeNull();
    for (let i = 0; i < 300; i++) w.step(1 / 60);
    const scar = w.impacts.craters.find(c => c.body === "earth");
    expect(scar).toBeTruthy();
    // Earth's scars fade within about 150 years
    w.setDay(dayFromISO("2200-01-01"));
    w.step(1 / 60);
    expect(w.impacts.craters.includes(scar!)).toBe(true);
    w.setDay(dayFromISO("2300-01-01"));
    w.step(1 / 60);
    expect(w.impacts.craters.includes(scar!)).toBe(false);
  });
  it("starts the game the day before the first rocket reached space", () => {
    expect(isoOf(new World(1).day)).toBe("1944-06-19");
  });
});

describe("per-game timeline", () => {
  it("keeps real history fixed but varies the projected future between games", async () => {
    const { ERAS, COLONIES } = await import("../src/data/timeline");
    const snap = () => ({ real: ERAS.filter(e => e.real).map(e => e.y), proj: ERAS.filter(e => !e.real).map(e => e.y), mars: COLONIES.find(c => c.id === "mars")!.y });
    const seen = new Set<string>();
    let real = "";
    for (const seed of [1, 2, 3, 4, 5]) {
      new World(seed);
      const s = snap();
      real = real || JSON.stringify(s.real);
      expect(JSON.stringify(s.real)).toBe(real);
      expect(s.proj.every((y, i, a) => i === 0 || y > a[i - 1])).toBe(true);
      expect(Math.abs(s.mars - 2045)).toBeLessThanOrEqual(4);
      seen.add(JSON.stringify(s.proj));
    }
    expect(seen.size).toBeGreaterThan(2);
  });
});
