# Brass Orrery

A live 3D solar system you can play with: real orbits, real planet surfaces, real space history, then a projected future where colonies grow and wars break out on their own. You can step in as a small god.

## What's in it

- **Starts at the dawn of spaceflight.** The game opens on 19 June 1944, the day before a V-2 became the first rocket to reach space. Real launches follow at their real yearly rates, from bases that opened on their real dates, with real failure rates.
- **Real sky.** Planets follow NASA JPL orbital elements, so they're where they really are on any date. Earth spins to its true orientation and the Moon sits in its true position at slow speeds, so day, night, phases and eclipses all line up. Real eclipses, Mars oppositions, and Halley's and Hale–Bopp's comets appear on their dates.
- **Real surfaces.** NASA-derived maps for every planet, real mosaics for the major moons (Io, Europa, Ganymede, Callisto, Titan, Enceladus, Triton, Phobos) and Ceres, real elevation for Earth, the Moon and Phobos, PBR lighting, terrain that casts shadows from the Sun (and from moonlight on Earth's night side), city lights that spread from the 1960s on, and seasonal snow.
- **Spacecraft you can click.** Sputnik, Vanguard 1, Salyut, Skylab, Mir, Hubble, the ISS, Tiangong, Webb at L2, probes on their real routes and orbits, and landing sites from Apollo 11 to Perseverance, each with its story.
- **Impacts.** Asteroids, comet fragments (Shoemaker–Levy 9 hits Jupiter in July 1994) and crashing probes leave scorched, glowing craters that cool and fade over centuries, and can wreck colonies.
- **Zoom from the whole solar system to a few kilometres above the ground.** Procedural detail takes over as you pass the maps' resolution.
- **Colonies that grow.** Moon and Mars settlements light up outward from their first base, with supply rockets flying back and forth. Each new game varies the projected dates a little; real history never moves.
- **Technology you can see.** Satellites multiply from Sputnik on, the ISS and the Voyagers follow their real paths, then (projected) Moon and Mars bases, cargo ships, a space elevator, an orbital ring, terraformed Mars and a Dyson swarm.
- **Wars that explain themselves.** Tension between five fictional powers builds from realistic causes (rival claims, scarce resources, lost territory, a rising power, arms races, incidents). At 100 they fight. Fleets, sieges, interceptions and peace treaties are all shown on the map and explained in the Wars tab.
- **God mode.** Earn Influence, rank up, unlock powers (calm or inflame rivals, bless a power, impose peace, plant colonies, terraform worlds) and complete goals.
- **Readable news.** Real history on real dates, plus everything the simulation does, grouped by year and filterable.

Everything after 2026 is projected and labeled as such.

## Run it

```bash
npm install
npm run dev
```

Then open the printed local URL.

`npm run build` makes `dist/index.html`, a single self-contained file you can open straight from disk or host anywhere.

`npm test` runs the simulation tests.

## Controls

| Action | How |
| --- | --- |
| Rotate | Drag |
| Zoom | Scroll, pinch, ↑ ↓, or the + − buttons |
| Pick a world | The dock at the bottom, click it in space, or ← → |
| Fly in close | Double-click a world |
| Play / pause, speed | Space, keys 1–5 |
| Travel in time | Drag the timeline, the date box, or N for the next milestone |
| Panels | P World, G God, W Wars, Y Tech, B News; Tab hides the panel |
| Search | / or Ctrl+K |
| Help | ? |

## Project layout

| Path | What it holds |
| --- | --- |
| `src/data/` | Real data (orbits, facts, history) and the projected timeline, factions and colonies |
| `src/sim/` | The simulation: time, orbits, bodies, civilization and war, god mode, news. No rendering code |
| `src/render/` | Three.js renderer: `Engine`, the solar system, tech and war layers, effects, camera, shaders |
| `src/ui/` | Preact interface: top bar, dock, timeline, side panels, dialogs |
| `src/assets/textures/` | Planet maps |
| `tests/` | Vitest tests for orbits, the war simulation, god mode and units |

Built with TypeScript, Vite, Three.js and Preact.

## Credits

- Planet maps: [Solar System Scope](https://www.solarsystemscope.com/textures/) (CC BY 4.0), based on NASA imagery.
- Moon and Ceres maps: [USGS Astrogeology](https://astrogeology.usgs.gov/) global mosaics (public domain) from Voyager, Galileo, Cassini, Mars Express and Dawn.
- Elevation: NASA Blue Marble topography; LRO LOLA lunar elevation from the [NASA SVS CGI Moon Kit](https://svs.gsfc.nasa.gov/4720); Mars Express HRSC for Phobos.
- Comet orbits: JPL Small-Body Database. Spacecraft: NASA, ESA, Roscosmos and CNSA mission pages.
- Orbits: NASA JPL approximate planetary positions. Facts: NASA planetary fact sheets.

## Contributing

Pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).
