// Real events from space history, shown in the news feed on their real dates.
// "rivalry" items are real military and political moments in space, the backdrop for the projected wars later.

export type NewsCategory = "science" | "milestone" | "rivalry" | "war" | "peace" | "colony" | "disaster" | "tension";

export interface HistoryItem {
  date: string;
  cat: NewsCategory;
  title: string;
  body: string;
  focus?: string;
}

export const HISTORY: HistoryItem[] = [
  { date: "1957-10-04", cat: "milestone", focus: "earth", title: "Sputnik 1 reaches orbit",
    body: "The Soviet Union launches the first artificial satellite. Its radio beeps start the space race with the United States." },
  { date: "1958-01-31", cat: "science", focus: "earth", title: "Explorer 1 finds the Van Allen belts",
    body: "The first US satellite discovers belts of trapped radiation around Earth." },
  { date: "1961-04-12", cat: "milestone", focus: "earth", title: "Yuri Gagarin orbits Earth",
    body: "Vostok 1 carries the first human into space for a single 108-minute orbit." },
  { date: "1967-01-27", cat: "peace", focus: "earth", title: "Outer Space Treaty signed",
    body: "The US, USSR and UK agree that no nation may claim the Moon or planets, or put nuclear weapons in orbit." },
  { date: "1969-07-20", cat: "milestone", focus: "moon", title: "Apollo 11 lands on the Moon",
    body: "Neil Armstrong and Buzz Aldrin walk on the Sea of Tranquility while Michael Collins orbits above." },
  { date: "1975-07-17", cat: "peace", focus: "earth", title: "Apollo and Soyuz dock in orbit",
    body: "Cold War rivals shake hands in space, the first joint US–Soviet mission." },
  { date: "1977-08-20", cat: "science", focus: "voyager2", title: "Voyager 2 launches",
    body: "It will become the only spacecraft to visit Uranus and Neptune." },
  { date: "1977-09-05", cat: "science", focus: "voyager1", title: "Voyager 1 launches",
    body: "Faster than its twin, it heads for Jupiter and Saturn, then out of the solar system." },
  { date: "1979-03-05", cat: "science", focus: "jupiter", title: "Voyager 1 flies past Jupiter",
    body: "It finds active volcanoes on Io, the first seen anywhere beyond Earth." },
  { date: "1985-09-13", cat: "rivalry", focus: "earth", title: "US fighter jet shoots down a satellite",
    body: "An ASM-135 missile fired from an F-15 destroys the Solwind satellite, a test of anti-satellite weapons." },
  { date: "1986-01-24", cat: "science", focus: "uranus", title: "Voyager 2 reaches Uranus",
    body: "Still the only visit: it finds 10 new moons and two new rings." },
  { date: "1989-08-25", cat: "science", focus: "neptune", title: "Voyager 2 reaches Neptune",
    body: "It photographs the Great Dark Spot and geysers on the moon Triton." },
  { date: "1990-04-24", cat: "science", focus: "earth", title: "Hubble Space Telescope launches",
    body: "It will help pin down the age of the universe at about 13.8 billion years." },
  { date: "1991-12-26", cat: "peace", focus: "earth", title: "The Soviet Union dissolves",
    body: "The Cold War ends, and with it the original space race." },
  { date: "1998-11-20", cat: "milestone", focus: "earth", title: "First ISS module launches",
    body: "Russia's Zarya module starts the International Space Station, built by 15 nations." },
  { date: "2000-11-02", cat: "milestone", focus: "earth", title: "First crew moves into the ISS",
    body: "People have lived in orbit continuously ever since." },
  { date: "2004-07-01", cat: "science", focus: "saturn", title: "Cassini arrives at Saturn",
    body: "It will orbit for 13 years and drop the Huygens probe onto Titan." },
  { date: "2007-01-11", cat: "rivalry", focus: "earth", title: "China destroys a satellite with a missile",
    body: "The test shatters the Fengyun-1C weather satellite into more than 3,000 pieces of trackable debris." },
  { date: "2008-02-21", cat: "rivalry", focus: "earth", title: "US Navy shoots down a failing spy satellite",
    body: "A ship-launched SM-3 missile destroys USA-193 before it can fall back with its toxic fuel." },
  { date: "2012-08-06", cat: "science", focus: "mars", title: "Curiosity lands on Mars",
    body: "A car-sized rover lowered by a rocket-powered sky crane begins exploring Gale Crater." },
  { date: "2012-08-25", cat: "science", focus: "voyager1", title: "Voyager 1 enters interstellar space",
    body: "It becomes the first human-made object to leave the Sun's bubble of solar wind." },
  { date: "2016-07-05", cat: "science", focus: "jupiter", title: "Juno enters orbit around Jupiter",
    body: "It begins mapping Jupiter's gravity, magnetism and deep atmosphere." },
  { date: "2017-09-15", cat: "science", focus: "saturn", title: "Cassini's grand finale",
    body: "Low on fuel, Cassini dives into Saturn so it can never contaminate Enceladus or Titan." },
  { date: "2019-03-27", cat: "rivalry", focus: "earth", title: "India tests an anti-satellite missile",
    body: "Mission Shakti destroys one of India's own satellites in low orbit." },
  { date: "2019-05-24", cat: "milestone", focus: "earth", title: "First big batch of Starlink satellites",
    body: "Sixty satellites launch at once. Within five years there are thousands." },
  { date: "2021-02-18", cat: "science", focus: "mars", title: "Perseverance lands in Jezero Crater",
    body: "It will collect rock samples, and its helicopter Ingenuity will make the first powered flight on another world." },
  { date: "2021-11-15", cat: "rivalry", focus: "earth", title: "Russia blows up a satellite in orbit",
    body: "The Kosmos 1408 test creates a debris cloud that forces the ISS crew to shelter in their capsules." },
  { date: "2021-12-25", cat: "science", focus: "earth", title: "James Webb Space Telescope launches",
    body: "The largest space telescope ever flown heads to its post 1.5 million km from Earth." },
  { date: "2022-09-26", cat: "science", focus: "earth", title: "DART knocks an asteroid off course",
    body: "NASA deliberately rams the moonlet Dimorphos, shortening its orbit by 32 minutes. Planetary defense works." },
  { date: "2024-07-25", cat: "science", focus: "mars", title: "Possible signs of ancient life on Mars",
    body: "Perseverance finds “leopard spots” in a rock named Cheyava Falls. They could come from microbes, or plain chemistry." },
  { date: "2024-10-14", cat: "science", focus: "jupiter", title: "Europa Clipper launches",
    body: "It will study whether Europa's hidden ocean could support life." },
];
