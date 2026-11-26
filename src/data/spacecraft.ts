// Real spacecraft, stations and landing sites, with real dates. Sources: NASA, ESA, Roscosmos, CNSA mission pages.

export type CraftKind = "satellite" | "station" | "telescope" | "probe" | "landing";

export interface Craft {
  id: string;
  name: string;
  kind: CraftKind;
  /** Which body it orbits or sits on ("sun-l2" = Sun–Earth L2 point). */
  body: string;
  launch: string;
  /** Arrival at its destination, if different from launch. */
  arrive?: string;
  /** End of mission (re-entry, de-orbit, crash, switched off). Missing = still working. */
  end?: string;
  endNote?: string;
  operator: string;
  massKg: number;
  purpose: string;
  facts: string[];
  /** Orbit radius in planet radii (for drawing), inclination in degrees. */
  orbit?: { r: number; inc: number; speed: number };
  /** Surface position for landers (degrees, body-fixed). */
  site?: { lat: number; lon: number };
}

export const CRAFT: Craft[] = [
  { id: "sputnik1", name: "Sputnik 1", kind: "satellite", body: "earth", launch: "1957-10-04", end: "1958-01-04", endNote: "Burned up re-entering the atmosphere",
    operator: "Soviet Union", massKg: 83.6, purpose: "The first artificial satellite. A polished sphere with four antennas that broadcast a simple radio beep.",
    facts: ["Its beeps could be picked up by amateur radio operators around the world.", "It circled Earth about every 96 minutes, 1,440 times in all.", "Its launch shocked the United States and started the space race."],
    orbit: { r: 1.09, inc: 65, speed: 0.6 } },
  { id: "vanguard1", name: "Vanguard 1", kind: "satellite", body: "earth", launch: "1958-03-17",
    operator: "United States", massKg: 1.47, purpose: "Tested solar power in space and measured the shape of Earth.",
    facts: ["It is the oldest human-made object still in orbit.", "It was the first satellite powered by solar cells.", "Its data showed Earth is slightly pear-shaped."],
    orbit: { r: 1.25, inc: 34, speed: 0.4 } },
  { id: "salyut1", name: "Salyut 1", kind: "station", body: "earth", launch: "1971-04-19", end: "1971-10-11", endNote: "Deliberately de-orbited",
    operator: "Soviet Union", massKg: 18425, purpose: "The first space station.",
    facts: ["Its only crew, aboard Soyuz 11, lived there for 23 days in June 1971.", "Tragically, that crew died during the return when their capsule lost air."],
    orbit: { r: 1.035, inc: 51.6, speed: 0.5 } },
  { id: "skylab", name: "Skylab", kind: "station", body: "earth", launch: "1973-05-14", end: "1979-07-11", endNote: "Fell back to Earth over Western Australia",
    operator: "NASA", massKg: 77088, purpose: "America's first space station, built from a leftover Saturn V rocket stage.",
    facts: ["Three crews lived aboard in 1973–74, the last for 84 days.", "It carried a solar observatory that took thousands of pictures of the Sun.", "When it fell, debris landed near the town of Esperance, which jokingly fined NASA $400 for littering."],
    orbit: { r: 1.07, inc: 50, speed: 0.48 } },
  { id: "mir", name: "Mir", kind: "station", body: "earth", launch: "1986-02-19", end: "2001-03-23", endNote: "Guided down into the South Pacific",
    operator: "Soviet Union / Russia", massKg: 129700, purpose: "The first modular space station, assembled in orbit over ten years.",
    facts: ["Valeri Polyakov stayed aboard for 437 days, still the longest single spaceflight.", "It was visited by the US Space Shuttle nine times.", "It survived a fire and a collision with a cargo ship in 1997."],
    orbit: { r: 1.055, inc: 51.6, speed: 0.46 } },
  { id: "hubble", name: "Hubble Space Telescope", kind: "telescope", body: "earth", launch: "1990-04-24",
    operator: "NASA / ESA", massKg: 11110, purpose: "A 2.4 m optical telescope above the blur of the atmosphere.",
    facts: ["A flaw in its main mirror was fixed by astronauts in 1993 with corrective optics.", "It helped measure the age of the universe at about 13.8 billion years.", "Five Space Shuttle missions serviced it, the last in 2009."],
    orbit: { r: 1.085, inc: 28.5, speed: 0.42 } },
  { id: "iss", name: "International Space Station", kind: "station", body: "earth", launch: "1998-11-20", end: "2030-12-31", endNote: "Planned de-orbit around 2030",
    operator: "NASA, Roscosmos, ESA, JAXA, CSA", massKg: 420000, purpose: "A research laboratory where people have lived without a break since November 2000.",
    facts: ["It is about as long as a football field, counting its solar arrays.", "It orbits Earth about every 90 minutes, so its crew sees 16 sunrises a day.", "More than 270 people from over 20 countries have visited it."],
    orbit: { r: 1.065, inc: 51.6, speed: 0.45 } },
  { id: "tiangong", name: "Tiangong", kind: "station", body: "earth", launch: "2021-04-29",
    operator: "China (CMSA)", massKg: 66000, purpose: "China's permanently crewed space station.",
    facts: ["Its name means “Heavenly Palace”.", "It has three main modules: Tianhe, Wentian and Mengtian.", "Crews of three rotate about every six months."],
    orbit: { r: 1.06, inc: 41.5, speed: 0.44 } },
  { id: "jwst", name: "James Webb Space Telescope", kind: "telescope", body: "sun-l2", launch: "2021-12-25", arrive: "2022-01-24",
    operator: "NASA / ESA / CSA", massKg: 6161, purpose: "An infrared telescope with a 6.5 m gold mirror, seeing the first galaxies.",
    facts: ["It sits near the Sun–Earth L2 point, 1.5 million km from Earth, always facing away from the Sun.", "A sunshield the size of a tennis court keeps it below −370 °F.", "It has found galaxies that formed less than 400 million years after the Big Bang."] },
  // Probes at other worlds
  { id: "mro", name: "Mars Reconnaissance Orbiter", kind: "probe", body: "mars", launch: "2005-08-12", arrive: "2006-03-10",
    operator: "NASA", massKg: 2180, purpose: "Maps Mars in high detail and relays signals from rovers.",
    facts: ["Its HiRISE camera can see objects about 1 m across from orbit.", "It has returned more data than all other Mars missions combined."], orbit: { r: 1.35, inc: 93, speed: 0.9 } },
  { id: "maven", name: "MAVEN", kind: "probe", body: "mars", launch: "2013-11-18", arrive: "2014-09-22",
    operator: "NASA", massKg: 2454, purpose: "Studies how Mars lost most of its atmosphere to space.",
    facts: ["It found the solar wind strips about 100 g of gas from Mars every second."], orbit: { r: 2.1, inc: 75, speed: 0.5 } },
  { id: "galileo", name: "Galileo", kind: "probe", body: "jupiter", launch: "1989-10-18", arrive: "1995-12-07", end: "2003-09-21", endNote: "Sent into Jupiter to protect Europa",
    operator: "NASA", massKg: 2560, purpose: "The first spacecraft to orbit Jupiter.",
    facts: ["It dropped a probe into Jupiter's atmosphere in 1995.", "Its data gave the first strong evidence for an ocean under Europa's ice."], orbit: { r: 6, inc: 5, speed: 0.12 } },
  { id: "juno", name: "Juno", kind: "probe", body: "jupiter", launch: "2011-08-05", arrive: "2016-07-05",
    operator: "NASA", massKg: 3625, purpose: "Studies Jupiter's interior, gravity and magnetic field from a polar orbit.",
    facts: ["It is the most distant solar-powered spacecraft ever flown.", "It carries three Lego figures: Galileo, Jupiter and Juno."], orbit: { r: 3.4, inc: 90, speed: 0.25 } },
  { id: "clipper", name: "Europa Clipper", kind: "probe", body: "jupiter", launch: "2024-10-14", arrive: "2030-04-11",
    operator: "NASA", massKg: 6065, purpose: "Will fly past Europa about 50 times to judge whether its ocean could support life.",
    facts: ["It is the largest spacecraft NASA has built for a planetary mission.", "Its solar arrays span over 30 m to catch the weak sunlight at Jupiter."], orbit: { r: 5, inc: 10, speed: 0.18 } },
  { id: "cassini", name: "Cassini", kind: "probe", body: "saturn", launch: "1997-10-15", arrive: "2004-07-01", end: "2017-09-15", endNote: "Dove into Saturn at the end of its mission",
    operator: "NASA / ESA / ASI", massKg: 5712, purpose: "Orbited Saturn for 13 years and landed the Huygens probe on Titan.",
    facts: ["It discovered the geysers on Enceladus.", "Its Huygens probe made the most distant landing ever, on Titan in 2005."], orbit: { r: 4, inc: 30, speed: 0.2 } },
  { id: "dawn", name: "Dawn", kind: "probe", body: "ceres", launch: "2007-09-27", arrive: "2015-03-06", end: "2018-11-01", endNote: "Ran out of fuel; still orbiting Ceres",
    operator: "NASA", massKg: 1218, purpose: "Orbited the giant asteroid Vesta, then the dwarf planet Ceres.",
    facts: ["It was the first spacecraft to orbit two different worlds beyond Earth.", "It found bright salt deposits in Ceres's Occator crater."], orbit: { r: 3, inc: 80, speed: 0.6 } },
  // Landing sites
  { id: "apollo11", name: "Apollo 11", kind: "landing", body: "moon", launch: "1969-07-16", arrive: "1969-07-20",
    operator: "NASA", massKg: 15103, purpose: "The first crewed Moon landing, in the Sea of Tranquility.",
    facts: ["Neil Armstrong and Buzz Aldrin spent about 2.5 hours walking on the surface.", "They left a laser reflector still used to measure the Moon's distance."], site: { lat: 0.67, lon: 23.47 } },
  { id: "apollo12", name: "Apollo 12", kind: "landing", body: "moon", launch: "1969-11-14", arrive: "1969-11-19",
    operator: "NASA", massKg: 15235, purpose: "A precise landing next to the Surveyor 3 probe.", facts: ["The crew brought back parts of Surveyor 3."], site: { lat: -3.01, lon: -23.42 } },
  { id: "apollo15", name: "Apollo 15", kind: "landing", body: "moon", launch: "1971-07-26", arrive: "1971-07-30",
    operator: "NASA", massKg: 16430, purpose: "The first mission with the Lunar Roving Vehicle, near Hadley Rille.", facts: ["Astronauts drove 28 km across the Moon."], site: { lat: 26.13, lon: 3.63 } },
  { id: "apollo17", name: "Apollo 17", kind: "landing", body: "moon", launch: "1972-12-07", arrive: "1972-12-11",
    operator: "NASA", massKg: 16450, purpose: "The last crewed Moon landing so far, in the Taurus–Littrow valley.",
    facts: ["Geologist Harrison Schmitt was the only scientist to walk on the Moon.", "The crew took the famous “Blue Marble” photo of Earth on the way."], site: { lat: 20.19, lon: 30.77 } },
  { id: "chang4", name: "Chang'e 4", kind: "landing", body: "moon", launch: "2018-12-07", arrive: "2019-01-03",
    operator: "China (CNSA)", massKg: 3780, purpose: "The first soft landing on the far side of the Moon.", facts: ["Its rover Yutu-2 drove for more than four years."], site: { lat: -45.44, lon: 177.6 } },
  { id: "curiosity", name: "Curiosity", kind: "landing", body: "mars", launch: "2011-11-26", arrive: "2012-08-06",
    operator: "NASA", massKg: 899, purpose: "A car-sized rover climbing Mount Sharp in Gale Crater.", facts: ["It found that Gale Crater once held a lake that could have supported microbes."], site: { lat: -4.59, lon: 137.44 } },
  { id: "perseverance", name: "Perseverance", kind: "landing", body: "mars", launch: "2020-07-30", arrive: "2021-02-18",
    operator: "NASA", massKg: 1025, purpose: "Collects rock samples in Jezero Crater for a future return to Earth.", facts: ["Its helicopter Ingenuity flew 72 times, far beyond its planned five flights."], site: { lat: 18.44, lon: 77.45 } },
  { id: "huygens", name: "Huygens", kind: "landing", body: "titan", launch: "1997-10-15", arrive: "2005-01-14",
    operator: "ESA", massKg: 320, purpose: "Parachuted through Titan's haze and landed on its surface.", facts: ["It landed on a plain of water-ice pebbles, like a dried riverbed.", "It is the most distant landing ever made."], site: { lat: -10.6, lon: 167.7 } },
];

/** Who found each moon, and when. */
export const MOON_INFO: Record<string, { discovered: string; formed: string }> = {
  moon: { discovered: "Known since prehistory", formed: "About 4.5 billion years ago, probably from debris after a Mars-sized body hit the young Earth" },
  phobos: { discovered: "Asaph Hall, 1877", formed: "Unknown: a captured asteroid, or debris from an ancient impact on Mars" },
  deimos: { discovered: "Asaph Hall, 1877", formed: "Unknown: a captured asteroid, or debris from an ancient impact on Mars" },
  io: { discovered: "Galileo Galilei, 1610", formed: "About 4.5 billion years ago, from the disk of gas and dust around young Jupiter" },
  europa: { discovered: "Galileo Galilei, 1610", formed: "About 4.5 billion years ago, alongside Jupiter" },
  ganymede: { discovered: "Galileo Galilei, 1610", formed: "About 4.5 billion years ago, alongside Jupiter" },
  callisto: { discovered: "Galileo Galilei, 1610", formed: "About 4.5 billion years ago; its surface has barely changed since" },
  enceladus: { discovered: "William Herschel, 1789", formed: "Debated: possibly as young as 100 million years, or as old as Saturn" },
  titan: { discovered: "Christiaan Huygens, 1655", formed: "About 4.5 billion years ago, alongside Saturn" },
  titania: { discovered: "William Herschel, 1787", formed: "About 4.5 billion years ago, alongside Uranus" },
  triton: { discovered: "William Lassell, 1846", formed: "Probably in the Kuiper Belt, later captured by Neptune's gravity" },
  ceres: { discovered: "Giuseppe Piazzi, 1801", formed: "About 4.5 billion years ago; it may have formed farther out and drifted in" },
};

/** Orbital launch attempts per year worldwide (real to 2025, then projected). */
export const LAUNCHES_PER_YEAR: [number, number][] = [
  [1957, 3], [1958, 28], [1960, 39], [1963, 70], [1967, 139], [1975, 125], [1985, 121], [1990, 116], [1995, 80],
  [2000, 85], [2005, 55], [2010, 74], [2015, 87], [2018, 114], [2020, 114], [2021, 146], [2022, 186], [2023, 223],
  [2024, 263], [2025, 320], [2035, 700], [2060, 1500], [2600, 3000],
];
/** Share of launches that failed, by era (real averages, then projected). */
export const FAILURE_RATE: [number, number][] = [[1957, 0.4], [1965, 0.15], [1975, 0.07], [1990, 0.06], [2010, 0.05], [2025, 0.03], [2100, 0.01]];

/** Launch sites (degrees) and the year each opened. */
export const LAUNCH_SITES = [
  { name: "Baikonur", lat: 45.92, lon: 63.34, from: 1957 },
  { name: "Cape Canaveral", lat: 28.49, lon: -80.58, from: 1958 },
  { name: "Vandenberg", lat: 34.74, lon: -120.57, from: 1959 },
  { name: "Plesetsk", lat: 62.93, lon: 40.58, from: 1966 },
  { name: "Kourou", lat: 5.24, lon: -52.77, from: 1970 },
  { name: "Jiuquan", lat: 40.96, lon: 100.29, from: 1970 },
  { name: "Tanegashima", lat: 30.4, lon: 130.97, from: 1975 },
  { name: "Sriharikota", lat: 13.72, lon: 80.23, from: 1979 },
  { name: "Wenchang", lat: 19.61, lon: 110.95, from: 2016 },
  { name: "Starbase", lat: 25.99, lon: -97.15, from: 2023 },
];
