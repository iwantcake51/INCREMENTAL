// Real sky events: the Moon's true position (a short lunar theory, accurate to about a degree),
// solar and lunar eclipses, and Mars oppositions. Posted to the news on their real dates.
import { PLANETS } from "../data/bodies";
import type { NewsFeed, NewsItem } from "./news";
import { heliocentric } from "./orbits";

const RAD = Math.PI / 180;
const norm360 = (a: number) => ((a % 360) + 360) % 360;
const EARTH = PLANETS.find(p => p.id === "earth")!.orbit;
const MARS = PLANETS.find(p => p.id === "mars")!.orbit;

/** Geocentric ecliptic longitude/latitude (degrees) and distance (km) of the Moon. */
export function moonPosition(day: number) {
  const L = 218.316 + 13.176396 * day;
  const M = 134.963 + 13.064993 * day;
  const F = 93.272 + 13.22935 * day;
  const D = 297.85 + 12.190749 * day; // mean elongation
  const Ms = 357.529 + 0.98560028 * day; // Sun's mean anomaly
  const lon = L + 6.289 * Math.sin(M * RAD) + 1.274 * Math.sin((2 * D - M) * RAD) + 0.658 * Math.sin(2 * D * RAD) - 0.186 * Math.sin(Ms * RAD);
  const lat = 5.128 * Math.sin(F * RAD) + 0.2806 * Math.sin((M + F) * RAD) + 0.2777 * Math.sin((M - F) * RAD) + 0.1732 * Math.sin((2 * D - F) * RAD);
  const dist = 385001 - 20905 * Math.cos(M * RAD) - 3699 * Math.cos((2 * D - M) * RAD);
  return { lon: norm360(lon), lat, dist };
}

/** Geocentric ecliptic longitude of the Sun (degrees). */
export function sunLongitude(day: number) {
  const e = heliocentric(EARTH, day, { x: 0, y: 0, z: 0 });
  return norm360(Math.atan2(e.y, e.x) / RAD + 180);
}

function marsElongation(day: number) {
  const e = heliocentric(EARTH, day, { x: 0, y: 0, z: 0 }), m = heliocentric(MARS, day, { x: 0, y: 0, z: 0 });
  const toSun = Math.atan2(-e.y, -e.x), toMars = Math.atan2(m.y - e.y, m.x - e.x);
  return { elong: norm360((toMars - toSun) / RAD), distAU: Math.hypot(m.x - e.x, m.y - e.y, m.z - e.z) };
}

/** Watches for eclipses and oppositions as time passes. */
export class SkyWatcher {
  private lastPhase = NaN;
  private lastMars = NaN;

  reset() { this.lastPhase = NaN; this.lastMars = NaN; }

  update(day: number, dtDays: number, news: NewsFeed, post: (item: NewsItem) => void) {
    if (dtDays <= 0 || dtDays > 20) { this.reset(); return; }
    const m = moonPosition(day);
    const phase = norm360(m.lon - sunLongitude(day)); // 0 = new moon, 180 = full moon
    if (!Number.isNaN(this.lastPhase)) {
      const crossedNew = this.lastPhase > 300 && phase < 60;
      const crossedFull = this.lastPhase < 180 && phase >= 180;
      if (crossedNew && Math.abs(m.lat) < 1.45) {
        const central = Math.abs(m.lat) < 0.9;
        const kind = !central ? "Partial" : m.dist < 377000 ? "Total" : "Annular";
        post(news.add({ day, cat: "science", focus: "earth", real: false, major: kind === "Total",
          title: `${kind} solar eclipse`,
          body: kind === "Total" ? "The Moon covers the Sun completely along a narrow path, turning day to dusk and revealing the corona."
            : kind === "Annular" ? "The Moon is near its farthest point, too small to cover the Sun, leaving a “ring of fire”."
            : "The Moon takes a bite out of the Sun for people in part of the world." }));
      }
      if (crossedFull && Math.abs(m.lat) < 1.05) {
        const total = Math.abs(m.lat) < 0.45;
        post(news.add({ day, cat: "science", focus: "moon", major: total,
          title: total ? "Total lunar eclipse: a blood moon" : "Partial lunar eclipse",
          body: total ? "The Moon passes through Earth's shadow and turns deep red, lit only by sunlight bent through Earth's atmosphere."
            : "Part of the Moon slips into Earth's shadow." }));
      }
    }
    this.lastPhase = phase;
    const ma = marsElongation(day);
    if (!Number.isNaN(this.lastMars) && Math.abs(ma.elong - 180) < 15 && Math.sign(this.lastMars - 180) !== Math.sign(ma.elong - 180)) {
      post(news.add({ day, cat: "science", focus: "mars", title: "Mars at opposition",
        body: `Earth passes between the Sun and Mars. Mars is ${Math.round(ma.distAU * 149.6)} million km away and shines bright all night.` }));
    }
    this.lastMars = ma.elong;
  }
}
