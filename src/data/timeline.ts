// Space history up to today is real. Everything after 2026 is projected (made up) and labeled as such.

/** A technology that appears in space once its era begins. The renderer draws one visual per id. */
export type TechVisual =
  | "rockets" | "stations" | "telescopes" | "satellites" | "apollo" | "voyager" | "iss" | "probes" | "megaconstellation"
  | "lunarBase" | "marsOutpost" | "ceresStation" | "cloudCities" | "oceanStations"
  | "elevator" | "fusion" | "outerColonies" | "orbitalRing" | "antimatter"
  | "lances" | "terraform" | "dyson" | "ark";

export interface Era {
  y: number;
  name: string;
  d: string;
  real?: boolean;
  weapon?: string;
  visual?: TechVisual;
  /** What appears in space, in plain words. */
  shows?: string;
  /** Body or object id the "Show me" button flies to. */
  focus?: string;
}

export const ERAS: Era[] = [
  { y: 1944, name: "First rocket in space", real: true, visual: "rockets", focus: "earth",
    d: "A V-2 test rocket crosses the edge of space. For the next 13 years rockets only go up and fall back down.",
    shows: "Small rockets launch from Earth on short up-and-down flights." },
  { y: 1957, name: "Sputnik", real: true, visual: "satellites", focus: "earth",
    d: "The Soviet Union launches Sputnik 1, the first artificial satellite.",
    shows: "Satellites start to circle Earth. Their number grows every year." },
  { y: 1961, name: "First human in orbit", real: true, focus: "earth",
    d: "Yuri Gagarin circles Earth once aboard Vostok 1." },
  { y: 1969, name: "Moon landing", real: true, visual: "apollo", focus: "moon",
    d: "Apollo 11 lands on the Moon. Twelve people walk on it by 1972.",
    shows: "Apollo landing sites light up on the Moon." },
  { y: 1971, name: "Space stations", real: true, visual: "stations", focus: "earth",
    d: "Salyut 1 becomes the first space station. Skylab (1973) and Mir (1986) follow.",
    shows: "Space stations orbit Earth. Click one to learn about it." },
  { y: 1977, name: "Voyager", real: true, visual: "voyager", focus: "voyager1",
    d: "Voyager 1 and 2 launch on a grand tour of the outer planets.",
    shows: "Both Voyagers fly their real routes past the giant planets and out of the solar system." },
  { y: 1981, name: "Space Shuttle", real: true, focus: "earth",
    d: "The Space Shuttle makes spaceflight routine, launching satellites and building stations for 30 years." },
  { y: 1990, name: "Hubble", real: true, visual: "telescopes", focus: "earth",
    d: "The Hubble Space Telescope launches, and for the first time we see the universe without the blur of the atmosphere.",
    shows: "Hubble orbits Earth. Later, Webb takes up position 1.5 million km beyond it." },
  { y: 1998, name: "Space station era", real: true, visual: "iss", focus: "earth",
    d: "The first ISS module launches. People have lived aboard without a break since 2000.",
    shows: "The International Space Station orbits Earth." },
  { y: 2015, name: "Reusable rockets", real: true, focus: "earth",
    d: "Rocket boosters start landing themselves to fly again. Launches become cheap and frequent.",
    shows: "Launches pick up sharply." },
  { y: 2021, name: "Mars robotics", real: true, visual: "probes", focus: "mars",
    d: "Perseverance lands in Jezero Crater, and the Ingenuity helicopter makes the first powered flight on another world.",
    shows: "Orbiters circle Mars and the giant planets." },
  { y: 2024, name: "Mega-constellations", real: true, visual: "megaconstellation", focus: "earth",
    d: "Thousands of satellites now ring Earth, and Europa Clipper is on its way to Jupiter.",
    shows: "A dense swarm of internet satellites wraps Earth." },
  { y: 2032, name: "Lunar base", visual: "lunarBase", focus: "moon",
    d: "A permanent crewed base opens near the Moon's south pole, mining ice for water and rocket fuel.",
    shows: "Base lights glow on the Moon's night side." },
  { y: 2045, name: "Mars outpost", visual: "marsOutpost", focus: "mars",
    d: "The first permanent settlement lands on Mars. Freighters start running between Earth, the Moon and Mars.",
    shows: "City lights on Mars, and cargo ships flying between worlds." },
  { y: 2060, name: "Belt rush", weapon: "Coilguns", visual: "ceresStation", focus: "ceres",
    d: "Mining stations claim Ceres. Rival powers arm their first patrol ships with coilguns.",
    shows: "A mining station orbits Ceres. Warships now exist, so wars can break out." },
  { y: 2070, name: "Cloud cities", visual: "cloudCities", focus: "venus",
    d: "Floating habitats drift in Venus's temperate cloud layer, 50 km above the furnace.",
    shows: "Glowing habitats float in Venus's clouds." },
  { y: 2085, name: "Ocean moons", visual: "oceanStations", focus: "europa",
    d: "Research stations drill through Europa's ice and land beside Titan's methane seas.",
    shows: "Stations and lights on Europa and Titan." },
  { y: 2095, name: "Space elevator", visual: "elevator", focus: "earth",
    d: "A carbon-nanotube tether rises from the equator to a station beyond geostationary orbit, making launches cheap.",
    shows: "A tether climbs from Earth's equator to a counterweight station." },
  { y: 2110, name: "Fusion drives", weapon: "Lasers", visual: "fusion", focus: "jupiter",
    d: "Fusion torches cut Earth–Jupiter trips from years to weeks. Warships mount lasers, and Mercury gets solar foundries.",
    shows: "Ship engines burn blue-white and ships fly faster." },
  { y: 2150, name: "Outer reach", visual: "outerColonies", focus: "triton",
    d: "Settlements spread to Titania and Triton at the edge of the planets." ,
    shows: "Colonies appear around Uranus and Neptune." },
  { y: 2180, name: "Orbital ring", visual: "orbitalRing", focus: "earth",
    d: "A continuous ring of habitats and launch tracks circles Earth's equator.",
    shows: "A glowing ring of habitats encircles Earth." },
  { y: 2200, name: "Antimatter age", weapon: "Antimatter missiles", visual: "antimatter", focus: "earth",
    d: "Antimatter missiles make every fleet battle short and blinding.",
    shows: "Battles flash with antimatter detonations. Engines glow violet." },
  { y: 2300, name: "Kinetic lances", weapon: "Relativistic lances", visual: "lances", focus: "jupiter",
    d: "Warships fire slugs at a sizeable fraction of light speed. Colony shields race to keep up.",
    shows: "Battles now streak with near-light-speed lance shots, and colonies glow with defense shields." },
  { y: 2350, name: "Terraforming Mars", visual: "terraform", focus: "mars",
    d: "Orbital mirrors and imported ice give Mars a thicker atmosphere. The first seas fill the northern lowlands.",
    shows: "Mars slowly turns blue and green." },
  { y: 2400, name: "Dyson swarm", visual: "dyson", focus: "sun",
    d: "Solar collectors begin to circle the Sun by the million, catching a growing share of its light.",
    shows: "A swarm of mirrors surrounds the Sun and keeps growing." },
  { y: 2520, name: "Starships", visual: "ark", focus: "ark",
    d: "The first generation ship leaves for Alpha Centauri, a voyage of centuries.",
    shows: "A starship with a long fusion plume heads out of the solar system." },
];

export const WAR_START_YEAR = 2060;

export interface Faction {
  id: number;
  name: string;
  short: string;
  color: string;
  /** How readily this power turns tension into war, 0.6–1.4. */
  temper: number;
}

export const FACTIONS: Faction[] = [
  { id: 0, name: "Terran Union", short: "Terran", color: "#6fa8ff", temper: 0.85 },
  { id: 1, name: "Martian Republic", short: "Martian", color: "#ff6a4d", temper: 1.25 },
  { id: 2, name: "Jovian Compact", short: "Jovian", color: "#f0b35a", temper: 1.05 },
  { id: 3, name: "Saturnine Accord", short: "Saturnine", color: "#c58bff", temper: 0.9 },
  { id: 4, name: "Outer Reach", short: "Outer", color: "#5fe0d0", temper: 1.1 },
];

export type Resource = "water" | "metals" | "fuel" | "energy" | "people";
export const RESOURCE_TEXT: Record<Resource, string> = {
  water: "water ice", metals: "metal ore", fuel: "fusion fuel", energy: "solar power", people: "population and trade",
};

export interface ColonyDef {
  id: string;
  /** Body the colony sits on. */
  body: string;
  name: string;
  y: number;
  fac: number;
  def: number;
  res: Resource[];
}

/** Where each world's first base lands; lights spread outward from here over the decades (lat, lon in degrees). */
export const SETTLEMENT_SITES: Record<string, [number, number]> = {
  moon: [-84, 20], mars: [24, -150], venus: [10, 30], ceres: [20, 230], europa: [-10, 160], titan: [-10, 168], callisto: [20, 40],
  ganymede: [5, -40], mercury: [-82, 60], enceladus: [-60, 0], titania: [-20, 30], triton: [-30, 20], io: [0, 0], phobos: [0, 0],
};

export const COLONIES: ColonyDef[] = [
  { id: "earth", body: "earth", name: "Earth", y: 1957, fac: 0, def: 12, res: ["people"] },
  { id: "luna", body: "moon", name: "Luna Base", y: 2032, fac: 0, def: 4, res: ["water", "fuel"] },
  { id: "mars", body: "mars", name: "Mars", y: 2045, fac: 1, def: 6, res: ["people", "metals"] },
  { id: "ceres", body: "ceres", name: "Ceres", y: 2060, fac: 1, def: 3, res: ["water", "metals"] },
  { id: "venus", body: "venus", name: "Venus Cloud City", y: 2070, fac: 0, def: 3, res: ["people"] },
  { id: "europa", body: "europa", name: "Europa", y: 2085, fac: 2, def: 3, res: ["water"] },
  { id: "titan", body: "titan", name: "Titan", y: 2085, fac: 3, def: 3, res: ["fuel"] },
  { id: "callisto", body: "callisto", name: "Callisto", y: 2095, fac: 2, def: 4, res: ["water", "metals"] },
  { id: "ganymede", body: "ganymede", name: "Ganymede", y: 2105, fac: 2, def: 4, res: ["people", "water"] },
  { id: "mercury", body: "mercury", name: "Mercury Foundry", y: 2110, fac: 0, def: 3, res: ["energy", "metals"] },
  { id: "enceladus", body: "enceladus", name: "Enceladus", y: 2120, fac: 3, def: 2, res: ["water"] },
  { id: "titania", body: "titania", name: "Titania", y: 2150, fac: 4, def: 2, res: ["water", "metals"] },
  { id: "triton", body: "triton", name: "Triton", y: 2150, fac: 4, def: 2, res: ["fuel", "water"] },
];

// ---------- Per-game variation of the projected future ----------
// Real history never moves. Each new game nudges projected milestones and settlement dates by a few years
// (more the further out they are), so no two futures play out quite the same.
const BASE_ERAS = ERAS.map(e => e.y);
const BASE_COLONIES = COLONIES.map(c => c.y);
/** Colonies founded together with a milestone keep that link when dates shift. */
const LINKED: Record<string, TechVisual> = {
  luna: "lunarBase", mars: "marsOutpost", ceres: "ceresStation", venus: "cloudCities", europa: "oceanStations",
  titan: "oceanStations", mercury: "fusion", titania: "outerColonies", triton: "outerColonies",
};
/** How quickly each colony's lights spread (1 = normal). */
export const COLONY_GROWTH: Record<string, number> = {};

export interface TimelineRoll { eras: number[]; colonies: number[]; growth: Record<string, number> }

export function rollTimeline(rand: () => number): TimelineRoll {
  const eras = BASE_ERAS.map((y, i) => {
    if (ERAS[i].real) return y;
    const spread = 1.5 + (y - 2026) * 0.025;
    return Math.round(y + (rand() * 2 - 1) * spread * 1.5);
  });
  for (let i = 1; i < eras.length; i++) if (!ERAS[i].real && eras[i] <= eras[i - 1]) eras[i] = eras[i - 1] + 1;
  const eraOf = (v: TechVisual) => eras[ERAS.findIndex(e => e.visual === v)];
  const colonies = COLONIES.map((c, i) => {
    const base = BASE_COLONIES[i];
    if (base <= 2026) return base;
    const link = LINKED[c.id];
    if (link) return eraOf(link) + (c.id === "titan" || c.id === "triton" ? Math.round(rand() * 6) : 0);
    return Math.round(base + (rand() * 2 - 1) * (2 + (base - 2026) * 0.03) * 1.5);
  });
  const growth = Object.fromEntries(COLONIES.map(c => [c.id, 0.7 + rand() * 0.7]));
  return { eras, colonies, growth };
}

export function applyTimeline(r: TimelineRoll) {
  ERAS.forEach((e, i) => { e.y = r.eras[i] ?? BASE_ERAS[i]; });
  COLONIES.forEach((c, i) => { c.y = r.colonies[i] ?? BASE_COLONIES[i]; });
  Object.assign(COLONY_GROWTH, r.growth);
}

/** Year a projected technology arrives in this game. */
export function eraYear(v: TechVisual): number { return ERAS.find(e => e.visual === v)?.y ?? 9999; }
/** Warships exist from the first weapon era on. */
export function warStartYear(): number { return ERAS.find(e => e.weapon)?.y ?? WAR_START_YEAR; }
