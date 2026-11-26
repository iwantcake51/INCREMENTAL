// Real data for the Sun, planets and major moons.
// Orbital elements: NASA JPL "Approximate Positions of the Planets" (J2000 epoch).
// Physical facts: NASA planetary fact sheets. Moon counts are confirmed moons as of 2025.

export type Surface = "rock" | "venus" | "earth" | "mars" | "gas" | "ice" | "haze";

/** How a body is drawn. Colors are sRGB hex strings. */
export interface Look {
  surface: Surface;
  colors: string[];
  seed: number;
  craters?: number;
  bands?: number;
  storm?: { lat: number; lon: number; size: number; color: string };
  atmosphere?: { color: string; density: number; height: number };
  clouds?: boolean;
  lines?: number;
  volcanoes?: number;
}

export interface Elements {
  /** semi-major axis, AU */ a: number;
  /** eccentricity */ e: number;
  /** inclination, deg */ i: number;
  /** longitude of ascending node, deg */ node: number;
  /** longitude of perihelion, deg */ peri: number;
  /** mean longitude at J2000, deg */ L0: number;
  /** orbital period, days */ T: number;
}

export interface LifeInfo {
  kind: string;
  status: "yes" | "maybe" | "no";
  statusText: string;
  count: string;
  species: number;
  text: string;
  bars: [number, number, number];
  where: string;
}

export interface PlanetDef {
  id: string;
  name: string;
  orbit: Elements;
  radiusKm: number;
  /** axial tilt, deg */ tilt: number;
  /** sidereal rotation, hours (negative = retrograde) */ rotHours: number;
  color: string;
  look: Look;
  ring?: { inner: number; outer: number; kind: "saturn" | "faint" };
  facts: [string, string][];
  trivia: string[];
  life: LifeInfo;
}

export interface MoonDef {
  id: string;
  name: string;
  parent: string;
  aKm: number;
  radiusKm: number;
  /** orbital period, days (negative = retrograde) */ period: number;
  color: string;
  look: Look;
  blurb: string;
}

export const SUN = {
  id: "sun",
  name: "Sun",
  radiusKm: 695700,
  color: "#ffd27a",
  facts: [
    ["Diameter", "1,392,700 km"], ["Mass", "333,000 Earths"], ["Surface gravity", "274 m/s²"],
    ["Rotation", "~25 days at the equator"], ["Age", "~4.6 billion years"], ["Type", "G2V yellow dwarf"],
    ["Surface", "5,500 °C"], ["Core", "~15 million °C"],
  ] as [string, string][],
  trivia: [
    "The Sun holds 99.86% of all the mass in the solar system.",
    "Sunlight takes about 8 minutes 20 seconds to reach Earth.",
    "Every second it turns about 4 million tonnes of matter into energy.",
    "About 1.3 million Earths would fit inside it.",
  ],
};

export const PLANETS: PlanetDef[] = [
  {
    id: "mercury", name: "Mercury", color: "#a9a39b", radiusKm: 2439.7, tilt: 0.03, rotHours: 1407.6,
    orbit: { a: 0.38709927, e: 0.20563593, i: 7.00497902, node: 48.33076593, peri: 77.45779628, L0: 252.2503235, T: 87.969 },
    look: { surface: "rock", colors: ["#8a847c", "#5d5953", "#b3ada4"], seed: 1.3, craters: 1 },
    facts: [["Diameter", "4,879 km"], ["Mass", "0.055 Earths"], ["Gravity", "3.7 m/s²"], ["Day (sunrise to sunrise)", "176 Earth days"], ["Year", "88 Earth days"], ["Moons", "0"], ["Atmosphere", "Almost none"], ["Temperature", "−173 to 427 °C"]],
    trivia: [
      "One sunrise-to-sunrise day on Mercury lasts 176 Earth days, twice as long as its year.",
      "It is the smallest planet, only about 40% wider than Earth's Moon.",
      "Its iron core fills about 85% of its radius, the largest share of any planet.",
      "It is closest to the Sun but not the hottest planet. Venus is hotter.",
    ],
    life: { kind: "mercury", status: "no", statusText: "No known life", count: "0 known species", species: 0,
      text: "Days reach 427 °C and nights fall to −173 °C, with almost no atmosphere to hold heat or block radiation. Oddly, MESSENGER found water ice hiding in permanently shadowed polar craters.",
      bars: [5, 10, 0], where: "Surface" },
  },
  {
    id: "venus", name: "Venus", color: "#e8cf9a", radiusKm: 6051.8, tilt: 177.4, rotHours: -5832.5,
    orbit: { a: 0.72333566, e: 0.00677672, i: 3.39467605, node: 76.67984255, peri: 131.60246718, L0: 181.9790995, T: 224.701 },
    look: { surface: "venus", colors: ["#f3dca6", "#d9b06a", "#b98a4a", "#fff1cf"], seed: 2.1,
      atmosphere: { color: "#ffd9a0", density: 1.1, height: 0.06 } },
    facts: [["Diameter", "12,104 km"], ["Mass", "0.815 Earths"], ["Gravity", "8.87 m/s²"], ["Rotation", "243 Earth days (backwards)"], ["Year", "224.7 Earth days"], ["Moons", "0"], ["Atmosphere", "96.5% CO₂, 92× Earth's pressure"], ["Temperature", "464 °C"]],
    trivia: [
      "Venus spins backwards compared with most planets, so the Sun rises in the west.",
      "It takes longer to spin once (243 days) than to orbit the Sun (225 days).",
      "Its surface is hot enough to melt lead, making it the hottest planet.",
      "After the Moon, it is the brightest natural object in the night sky.",
    ],
    life: { kind: "venus", status: "maybe", statusText: "Debated", count: "0 confirmed", species: 0,
      text: "The surface is 464 °C under 92 bar of CO₂. About 50 km up, the clouds sit near room temperature, and a disputed 2020 phosphine detection put them on the shortlist for airborne microbes.",
      bars: [30, 5, 35], where: "Cloud layer, ~50 km up" },
  },
  {
    id: "earth", name: "Earth", color: "#4f8fe8", radiusKm: 6371, tilt: 23.44, rotHours: 23.934,
    orbit: { a: 1.00000261, e: 0.01671123, i: 0, node: 0, peri: 102.93768193, L0: 100.46457166, T: 365.256 },
    look: { surface: "earth", colors: ["#0a2754", "#1b5f9e", "#3d7a3a", "#a58f5a", "#e9eef5"], seed: 7.7, clouds: true,
      atmosphere: { color: "#6fb0ff", density: 1, height: 0.035 } },
    facts: [["Diameter", "12,742 km"], ["Mass", "5.97 × 10²⁴ kg"], ["Gravity", "9.81 m/s²"], ["Day", "23 h 56 min"], ["Year", "365.25 days"], ["Moons", "1"], ["Atmosphere", "78% N₂, 21% O₂"], ["Temperature", "15 °C average"]],
    trivia: [
      "Earth is the only known world with liquid water on its surface, covering about 71% of it.",
      "It is the densest planet in the solar system, at 5.51 g/cm³.",
      "The Moon drifts about 3.8 cm farther from Earth every year.",
      "Earth is closest to the Sun in early January, during northern winter.",
    ],
    life: { kind: "earth", status: "yes", statusText: "Teeming", count: "~8.7 million species", species: 8.7e6,
      text: "The only world where life is confirmed: about 8.7 million species of plants, animals and fungi by one widely cited estimate, plus microbes in uncounted numbers, from deep-sea vents to the upper atmosphere.",
      bars: [90, 100, 100], where: "Everywhere" },
  },
  {
    id: "mars", name: "Mars", color: "#c8643c", radiusKm: 3389.5, tilt: 25.19, rotHours: 24.623,
    orbit: { a: 1.52371034, e: 0.0933941, i: 1.84969142, node: 49.55953891, peri: -23.94362959, L0: -4.55343205, T: 686.98 },
    look: { surface: "mars", colors: ["#b5562b", "#7a3519", "#d98a55", "#f4efe8"], seed: 4.4, craters: 0.35,
      atmosphere: { color: "#e8a27a", density: 0.35, height: 0.025 } },
    facts: [["Diameter", "6,779 km"], ["Mass", "0.107 Earths"], ["Gravity", "3.71 m/s²"], ["Day", "24 h 37 min"], ["Year", "687 Earth days"], ["Moons", "2 (Phobos, Deimos)"], ["Atmosphere", "95% CO₂, under 1% of Earth's pressure"], ["Temperature", "−63 °C average"]],
    trivia: [
      "Olympus Mons is about 22 km tall, roughly two and a half times the height of Everest.",
      "The canyon Valles Marineris runs about 4,000 km, the width of the United States.",
      "Its red color comes from iron oxide, which is rust, in the dust.",
      "Sunsets on Mars glow blue, because fine dust scatters blue light toward the Sun.",
    ],
    life: { kind: "mars", status: "maybe", statusText: "Possible past life", count: "0 confirmed", species: 0,
      text: "Dried river deltas show Mars once had liquid water. In 2024 Perseverance found speckled “leopard spot” patterns in a rock named Cheyava Falls that could be traces of ancient microbes, or of plain chemistry.",
      bars: [25, 30, 10], where: "Below the surface" },
  },
  {
    id: "jupiter", name: "Jupiter", color: "#d8b48a", radiusKm: 69911, tilt: 3.13, rotHours: 9.925,
    orbit: { a: 5.202887, e: 0.04838624, i: 1.30439695, node: 100.47390909, peri: 14.72847983, L0: 34.39644051, T: 4332.59 },
    look: { surface: "gas", colors: ["#efe3cb", "#b98a5c", "#f2e6cf", "#a8713f", "#e2c9a0", "#8e5a33"], seed: 5.2, bands: 14,
      storm: { lat: -22, lon: 0.6, size: 0.16, color: "#c4553a" },
      atmosphere: { color: "#f3d9b0", density: 0.5, height: 0.02 } },
    facts: [["Diameter", "139,820 km"], ["Mass", "317.8 Earths"], ["Gravity", "24.79 m/s²"], ["Day", "9 h 56 min"], ["Year", "11.86 Earth years"], ["Moons", "95+"], ["Atmosphere", "~90% hydrogen, ~10% helium"], ["Temperature", "−110 °C at cloud tops"]],
    trivia: [
      "Jupiter holds more than twice the mass of all the other planets combined.",
      "The Great Red Spot is a storm wider than Earth, watched for at least 190 years.",
      "It spins faster than any other planet, so a day lasts under 10 hours.",
      "Its moon Ganymede is the largest moon in the solar system, bigger than Mercury.",
    ],
    life: { kind: "europa", status: "maybe", statusText: "Ocean moon", count: "0 confirmed", species: 0,
      text: "Jupiter has no surface, but its moon Europa hides a salty ocean under the ice holding about twice the water of Earth's oceans. NASA's Europa Clipper, launched in 2024, is on its way to look.",
      bars: [40, 80, 5], where: "Europa's ocean" },
  },
  {
    id: "saturn", name: "Saturn", color: "#e3cf9b", radiusKm: 58232, tilt: 26.73, rotHours: 10.656,
    orbit: { a: 9.53667594, e: 0.05386179, i: 2.48599187, node: 113.66242448, peri: 92.59887831, L0: 49.95424423, T: 10759.2 },
    look: { surface: "gas", colors: ["#f1e3bd", "#d9c08c", "#ecdcb2", "#c9ab72", "#e8d6a6", "#b8975e"], seed: 6.1, bands: 10,
      atmosphere: { color: "#f0dcae", density: 0.45, height: 0.02 } },
    ring: { inner: 1.11, outer: 2.35, kind: "saturn" },
    facts: [["Diameter", "116,460 km"], ["Mass", "95.2 Earths"], ["Gravity", "10.44 m/s²"], ["Day", "10 h 33 min"], ["Year", "29.46 Earth years"], ["Moons", "274"], ["Atmosphere", "Hydrogen and helium"], ["Temperature", "−140 °C at cloud tops"]],
    trivia: [
      "Saturn's average density is lower than water's, at 0.69 g/cm³.",
      "Its main rings span about 280,000 km but are mostly only about 10 m thick.",
      "A six-sided jet stream circles its north pole.",
      "Its moon Titan has a thicker atmosphere than Earth and lakes of liquid methane.",
    ],
    life: { kind: "enceladus", status: "maybe", statusText: "Ocean moon", count: "0 confirmed", species: 0,
      text: "Saturn's moon Enceladus sprays its ocean into space through cracks near its south pole. Cassini flew through the plumes and tasted water, salts, organic molecules and phosphates. Titan has lakes of liquid methane.",
      bars: [40, 75, 5], where: "Enceladus's ocean" },
  },
  {
    id: "uranus", name: "Uranus", color: "#a8dfe3", radiusKm: 25362, tilt: 97.77, rotHours: -17.24,
    orbit: { a: 19.18916464, e: 0.04725744, i: 0.77263783, node: 74.01692503, peri: 170.9542763, L0: 313.23810451, T: 30688.5 },
    look: { surface: "ice", colors: ["#c9f1f2", "#9fd8de", "#7cc0c9"], seed: 8.3, bands: 6,
      atmosphere: { color: "#bff3f5", density: 0.6, height: 0.025 } },
    ring: { inner: 1.6, outer: 2.0, kind: "faint" },
    facts: [["Diameter", "50,724 km"], ["Mass", "14.5 Earths"], ["Gravity", "8.69 m/s²"], ["Day", "17 h 14 min (backwards)"], ["Year", "84 Earth years"], ["Moons", "28"], ["Atmosphere", "Hydrogen, helium, methane"], ["Temperature", "−195 °C at cloud tops"]],
    trivia: [
      "Uranus is tilted 98°, so it rolls around the Sun on its side.",
      "Each pole gets about 42 years of sunlight followed by 42 years of darkness.",
      "It has the coldest atmosphere of any planet, reaching −224 °C.",
      "William Herschel found it in 1781, the first planet discovered with a telescope.",
    ],
    life: { kind: "uranus", status: "no", statusText: "None known", count: "0 known species", species: 0,
      text: "An ice giant knocked on its side, with cloud tops near −195 °C. Its larger moons, such as Ariel and Titania, may hide thin oceans under their crusts, but no spacecraft has gone back to check since 1986.",
      bars: [5, 20, 5], where: "Moon interiors (unknown)" },
  },
  {
    id: "neptune", name: "Neptune", color: "#4a6fe0", radiusKm: 24622, tilt: 28.32, rotHours: 16.11,
    orbit: { a: 30.06992276, e: 0.00859048, i: 1.77004347, node: 131.78422574, peri: 44.96476227, L0: -55.12002969, T: 60182 },
    look: { surface: "ice", colors: ["#5b7ff0", "#3554c9", "#2a3f9e"], seed: 9.1, bands: 8,
      storm: { lat: -20, lon: 2.2, size: 0.12, color: "#1b2770" },
      atmosphere: { color: "#7ea2ff", density: 0.65, height: 0.025 } },
    ring: { inner: 1.7, outer: 2.55, kind: "faint" },
    facts: [["Diameter", "49,244 km"], ["Mass", "17.1 Earths"], ["Gravity", "11.15 m/s²"], ["Day", "16 h 6 min"], ["Year", "164.8 Earth years"], ["Moons", "16"], ["Atmosphere", "Hydrogen, helium, methane"], ["Temperature", "−200 °C at cloud tops"]],
    trivia: [
      "Neptune was found by math first: astronomers predicted it from Uranus's wobble and saw it in 1846.",
      "Its winds reach about 2,100 km/h, the fastest measured in the solar system.",
      "It finished its first full orbit since its discovery in 2011.",
      "Its largest moon, Triton, orbits backwards and is slowly spiraling inward.",
    ],
    life: { kind: "neptune", status: "no", statusText: "None known", count: "0 known species", species: 0,
      text: "Cloud tops near −200 °C and the fastest winds measured in the solar system, over 2,000 km/h. Its captured moon Triton erupts dark geysers of nitrogen gas from beneath a frozen surface.",
      bars: [3, 15, 5], where: "Triton's interior (unknown)" },
  },
];

export const MOONS: MoonDef[] = [
  { id: "moon", name: "Moon", parent: "earth", aKm: 384400, radiusKm: 1737.4, period: 27.32, color: "#d8d4cc",
    look: { surface: "rock", colors: ["#9d9a94", "#5f5d59", "#c9c6bf"], seed: 3.3, craters: 1 },
    blurb: "3,474 km across. Twelve people walked on it between 1969 and 1972, the only other world humans have stood on." },
  { id: "phobos", name: "Phobos", parent: "mars", aKm: 9376, radiusKm: 11.3, period: 0.319, color: "#a08a7a",
    look: { surface: "rock", colors: ["#7d6d62", "#4f453e", "#9b897b"], seed: 11.1, craters: 1 },
    blurb: "22 km across and spiraling inward. In tens of millions of years it will break apart or crash into Mars." },
  { id: "deimos", name: "Deimos", parent: "mars", aKm: 23463, radiusKm: 6.2, period: 1.263, color: "#b49c8a",
    look: { surface: "rock", colors: ["#a18c7b", "#6e5f53", "#bba692"], seed: 12.4, craters: 0.6 },
    blurb: "Only about 12 km across. From Mars it looks like a bright star." },
  { id: "io", name: "Io", parent: "jupiter", aKm: 421700, radiusKm: 1821.6, period: 1.769, color: "#f2d46b",
    look: { surface: "rock", colors: ["#e8cf5a", "#b8862f", "#f6eaa0"], seed: 13.7, craters: 0, volcanoes: 1 },
    blurb: "The most volcanically active world known, with over 400 active volcanoes, squeezed by Jupiter's tides." },
  { id: "europa", name: "Europa", parent: "jupiter", aKm: 671034, radiusKm: 1560.8, period: 3.551, color: "#e8e2d0",
    look: { surface: "rock", colors: ["#efe9da", "#b88a63", "#fbf8f0"], seed: 14.2, craters: 0.05, lines: 1 },
    blurb: "An ice shell over a salty ocean with about twice the water of all Earth's oceans." },
  { id: "ganymede", name: "Ganymede", parent: "jupiter", aKm: 1070412, radiusKm: 2634.1, period: 7.155, color: "#b8a990",
    look: { surface: "rock", colors: ["#a59a88", "#6e6457", "#cfc6b6"], seed: 15.9, craters: 0.6, lines: 0.4 },
    blurb: "The largest moon in the solar system, bigger than Mercury, and the only moon with its own magnetic field." },
  { id: "callisto", name: "Callisto", parent: "jupiter", aKm: 1882709, radiusKm: 2410.3, period: 16.69, color: "#8b7d6b",
    look: { surface: "rock", colors: ["#6d6152", "#3e362d", "#a8987f"], seed: 16.6, craters: 1 },
    blurb: "One of the most heavily cratered surfaces in the solar system, almost unchanged for 4 billion years." },
  { id: "enceladus", name: "Enceladus", parent: "saturn", aKm: 237948, radiusKm: 252.1, period: 1.37, color: "#f4f8ff",
    look: { surface: "rock", colors: ["#f2f6fb", "#b9c9da", "#ffffff"], seed: 17.3, craters: 0.3, lines: 0.6 },
    blurb: "Geysers at its south pole spray its hidden ocean into space, feeding Saturn's E ring." },
  { id: "titan", name: "Titan", parent: "saturn", aKm: 1221870, radiusKm: 2574.7, period: 15.95, color: "#e3a94f",
    look: { surface: "haze", colors: ["#e3a94f", "#b9772c", "#f3c983"], seed: 18.8,
      atmosphere: { color: "#f0b25a", density: 1, height: 0.08 } },
    blurb: "Thicker air than Earth and seas of liquid methane. ESA's Huygens probe landed there in 2005." },
  { id: "titania", name: "Titania", parent: "uranus", aKm: 435910, radiusKm: 788.4, period: 8.706, color: "#c9c3bc",
    look: { surface: "rock", colors: ["#aaa39b", "#6b655f", "#cdc6be"], seed: 19.5, craters: 0.8, lines: 0.3 },
    blurb: "Uranus's largest moon, 1,578 km across, cut by huge canyons." },
  { id: "triton", name: "Triton", parent: "neptune", aKm: 354759, radiusKm: 1353.4, period: -5.877, color: "#e6cfc9",
    look: { surface: "rock", colors: ["#e3cdc6", "#a98f8a", "#f6ebe6"], seed: 20.2, craters: 0.15, volcanoes: 0.4 },
    blurb: "Orbits backwards, so it was probably captured. Voyager 2 saw nitrogen geysers in 1989." },
];

/** Ceres, the largest object in the asteroid belt. */
export const CERES = {
  id: "ceres", name: "Ceres", radiusKm: 470, color: "#9c958c",
  orbit: { a: 2.7675, e: 0.0758, i: 10.59, node: 80.3, peri: 153.9, L0: 153, T: 1681.6 } as Elements,
  look: { surface: "rock", colors: ["#7d7871", "#4d4a46", "#e9e6df"], seed: 21.7, craters: 0.8 } as Look,
  blurb: "A dwarf planet 940 km across, holding about a third of the asteroid belt's mass. NASA's Dawn orbited it from 2015 to 2018.",
};

export const BAR_NAMES = ["Temperature", "Liquid water", "Atmosphere"] as const;
