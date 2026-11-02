# Lanterndeep

*Pilot a little submarine into the glowing dark.*

A deep-sea action incremental for the browser. You steer a tiny sub down through a procedurally generated sea, grab glowing plankton before your air runs out, dodge what lives down there, and spend your haul upgrading the sub so the next dive goes deeper.

It runs entirely in the browser: no server, no tracking. Progress is saved locally.

## How it plays

- **Dive.** Steer with the mouse, a finger (drag), or WASD / arrow keys. The sea is generated as you sink, so every dive is different.
- **Air is your clock.** It drains faster the deeper you go. Bubble columns top it up, but they're scarce. When the air runs out, the winch hauls you up with your haul.
- **Your hull is your risk.** Jellyfish, eels, spiked urchins and anglerfish all damage it. Surface any time and you keep everything. If the hull breaks, you only keep part of the haul.
- **Plankton streaks.** Grab plankton in quick succession to build a streak. Every pickup in a streak is worth more, and each one plays a note that climbs a pentatonic scale.
- **Glimmerfish** flee from you but are worth a lot. **Chests** hide near the walls, and deep ones can hold Black Pearls.
- **Five depth zones,** from the Sunlit Shallows to the Hadal Trench. Each is darker, richer and more dangerous than the last. Your lamp lights only a small circle, and glowing creatures shine through the dark.
- **Abilities.** Dash (Space) bursts you forward. Flare (F) lights up the water and stuns every creature nearby.
- **Dive conditions.** Some dives roll a condition that changes the rules, like Plankton Bloom, Black Tide, Riptide, Glimmer Shoal, Shipwreck Season or Jelly Swarm.

## Between dives

- **Sub shop.** Air tanks, propeller, hull plating, lamp, magnet coil, sample jars, a plankton farm that earns while you dive and while you're away, the jet pump (dash), sonar (off-screen arrows) and ballast weights (start deeper).
- **The Reef.** A real branching skill tree, drawn as coral growing up from a rock. One trunk splits into four boughs:
  - **Engine:** speed, handling, dash upgrades
  - **Lamp & Haul:** light, magnet, value
  - **Survival:** air, hull, flare, escape pod, auto-zap
  - **Salvage:** pearls, blueprints, mooring, away time

  Confluence vines link neighbouring boughs, and the Sleeping Leviathan waits at the very end. Pan, zoom, and replant any time.
- **Drydock (rebirth).** Rebuild the sub for Black Pearls. Pearls make every dive worth more, for good, and grow the Reef.
- **Finds** (achievements, including secret ones; each gives +1% lumen) and a **Logbook** of stats and records.
- **Settings:**
  - number notation, water colour, interface size
  - particles, floating numbers, moving water, reduced motion
  - volume, pickup notes, vibration
  - steering mode (follow the mouse, or only while holding)
  - confirmations, autosave, away progress
  - save export/import and hard reset
- **Keyboard.**
  - At the dock: `Space` / `Enter` dives, `1`–`5` switch tabs.
  - While diving: `WASD` / arrows steer, `Space` dashes, `F` flares, `Esc` pauses.
  - Anywhere: `M` mutes, `Ctrl+S` saves.

## Look

Oxidized copper and enamel for the machinery, with riveted panels, hard printed shadows, press-down buttons and paper-tag toasts. Glow is saved for living things: plankton, fish, jellies and the anglerfish's lure. Dives are drawn on a canvas with depth-tinted water, light shafts near the surface, parallax marine snow, rock walls, and a darkness layer that your lamp and every glowing creature cut holes through. Type is Young Serif and Bricolage Grotesque.

## Tech

- [Vite 8](https://vite.dev) and **TypeScript 7** (native compiler). No UI framework: plain DOM with change-detected updates.
- The dive simulation (`src/core/dive.ts`) is pure logic with fixed sub-steps and a seeded generator, so it is deterministic and testable. The renderer (`src/ui/dive-view.ts`) draws it with a canvas darkness layer. The dock runs a 20 Hz economy tick, and text only updates when it changes.
- Native `<dialog>` modals with `@starting-style` entry animations, an animated exit with a fallback, and light-dismiss with a fallback.
- Sounds are synthesized with the Web Audio API (oscillators, filtered noise and a generated reverb). There are no audio files.
- Save data is validated field by field on load and import, so broken or hand-edited saves fall back to sane defaults.
- [Vitest](https://vitest.dev) tests cover number formatting, dives (determinism, air, breach vs surface, streaks, abilities), the economy, data integrity and saves. A pacing test has a bot pilot play three simulated hours of dives, buying upgrades in between, to check that depth and rebuild pacing stay sane.

## Develop

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests + pacing simulation
npm run build     # type-check and build to dist/
```

`npm run icons` regenerates `src/ui/icons.gen.ts`, which contains only the icons the game references. It also runs automatically before `dev` and `build`.

## Deploy (Netlify)

`netlify.toml` is already set up, so Netlify needs no manual configuration:

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Node:** 22

In Netlify, choose **Add new site → Import an existing project**, pick this repository, and deploy. Netlify reads the settings from `netlify.toml`. Every push to `main` redeploys, and pull requests get deploy previews. Hashed assets are cached forever and `index.html` always revalidates, so players get updates right away. The build uses relative paths, so it also works on any other static host.

GitHub Actions (`.github/workflows/ci.yml`) runs the tests and a build on every pull request.

## Credits

- Icons: [game-icons.net](https://game-icons.net) by Lorc, Delapouite and contributors, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). They are packaged through [`@iconify-json/game-icons`](https://www.npmjs.com/package/@iconify-json/game-icons) and recolored in-game.
- Typefaces: [Young Serif](https://fonts.google.com/specimen/Young+Serif) and [Bricolage Grotesque](https://fonts.google.com/specimen/Bricolage+Grotesque), via Fontsource, under the SIL Open Font License.
