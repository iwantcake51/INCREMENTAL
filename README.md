# Lanterndeep

*Tap the lure. Light up the deep.*

An incremental (clicker/idle) web game set at the bottom of the sea. You tap the glowing lure of an enormous anglerfish to gather **lumen**, build a fleet of strange harvesters, and keep sinking deeper. Along the way you grow a 66-part reef of upgrades and dive into trenches that bend the rules.

It runs entirely in the browser: no server, no tracking. Progress is saved locally.

## Features

- **The lure.** Each tap squashes the bulb, puffs out bubbles and sends a ripple through the water. Every tap sound is a soft "bloop" plus a note on a pentatonic scale that climbs as your streak grows, so steady tapping turns into a little tune. Lucky taps pay out big.
- **Streaks and lucky taps.** Tap in rhythm to fill the ring around the lure. Both can be upgraded.
- **Flare.** Taps also fill a gold gauge. When it's full the lure flares: eight seconds of ×10 taps and ×3 production, with light, sound and screen shake.
- **12 harvesters**, from Plankton Nets and Shrimp Traps to Leviathan Ranches and the Kraken Heart. Buy ×1, ×10, ×100 or Max.
- **The Workshop: 170 upgrades that do different things.** Each harvester's 10 upgrades each have their own effect:
  - plain output boosts
  - a lure link (taps give a share of that harvester's output)
  - colony scaling (+4% per one owned)
  - half-price salvage
  - a network bonus (every 10 owned lifts all production)
  - a unique perk for each harvester
  - mentors that double the harvester below
  Plus pairings between harvesters, and upgrades for taps, echo taps, the flare gauge, luck, streaks, glimmerfish, sea events and everything at once.
- **Glimmerfish** swim past now and then. Catch one for a pile of lumen or a boost: Feeding Frenzy, Eel Shock or Steady Current.
- **Sea events.** Every few minutes the sea changes the rules for a while:
  - Plankton Bloom (production ×3)
  - Black Tide (taps ×10, production halved)
  - Salvage Rush (everything 30% cheaper)
  - Whale Song (production and taps ×2)
  - Glimmer Shoal (a burst of glimmerfish)
  - Riptide (streak cap +100, streak never fades)
  - Pearl Moon (+25% lucky-tap chance)
  - Thermal Vent (each tap also grants 1s of production)
  - Tidal Pulse (production swings between ×1 and ×6)
  - Warm Current (production ×1.5 for three minutes)
- **Descent (rebirth).** Sink deeper to start a fresh dive and bring back **Black Pearls**. Pearls boost production permanently and grow the Reef. The water gets darker with every descent, and the pressure means pearls need more lumen the deeper you go.
- **The Reef.** A real branching skill tree, drawn as coral growing up from a rock. One trunk splits into four boughs (Abyss, Hands, Harvest, Currents), and each forks again and again. Confluence vines link neighbouring boughs, a Kinship canopy with one node per harvester spreads across the top, and the Sleeping Leviathan sits at the end of the Abyss. It unlocks autobuyers, automatic descents, longer away time and glimmerfish tricks. Pan, zoom, and replant it at any time.
- **8 Trenches.** Hard dives (no tapping, no workshop, crushing prices, a slow leak…) with permanent rewards.
- **134 finds (achievements)**, including secret ones. Each gives +1% production.
- **Logbook** with detailed statistics, and **work while away** with a "welcome back" summary.
- **Settings:**
  - number notation (standard, scientific, engineering, letters)
  - four water colours and interface size
  - particles, floating numbers, moving water and reduced-motion toggles
  - volume, mute and vibration
  - confirmations, autosave interval and away progress
  - save export/import (code or file) and hard reset
- **A sea that comes alive.** Your harvesters swim through the background as glowing silhouettes, and the water brightens as production climbs.
- **Quality of life:**
  - Numbers roll up smoothly.
  - Hold a harvester to keep buying.
  - A "Next" buy amount goes up to the next milestone.
  - A best-value tag and payback times.
  - "Affordable in…" timers.
  - Spend all (`X`).
  - An "only what I can afford" filter in the Workshop.
  - Pending pearls in the top bar, with a time estimate for the next one.
  - A save indicator.
  - A tap-sound toggle.
  - Fast tapping sounds continuous instead of cutting out.
- **Keyboard shortcuts.** `Space` taps, `1`–`7` switch tabs, `B` cycles buy amount, `X` spends all, `U` buys all upgrades, `M` mutes, `Ctrl+S` saves.
- Works on phones: touch-friendly, long-press for details, haptics on supported devices.

## Look

Oxidized copper and enamel for the machinery, with hard printed shadows, riveted panels and paper-tag toasts. Glow is saved for living things: the lure, the fish and the plankton. The background is a canvas sea with swaying light shafts, drifting marine snow, kelp silhouettes and the odd column of bubbles from a far-off vent. Type is Young Serif for headings and numbers, and Bricolage Grotesque for everything else.

## Tech

- [Vite 8](https://vite.dev) and **TypeScript 7** (native compiler). No UI framework: plain DOM with change-detected updates.
- Fixed 20 Hz logic tick plus a `requestAnimationFrame` render loop. Text only updates when it changes, panels refresh only while visible, and the effects canvas sleeps when idle. Particles are pooled, and the sea background is cached to an offscreen canvas and paused in background tabs.
- Native `<dialog>` modals with `@starting-style` entry animations, an animated exit with a fallback, and light-dismiss with a fallback.
- Sounds are synthesized with the Web Audio API (oscillators, filtered noise and a generated reverb). There are no audio files.
- Save data is validated field by field on load and import, so broken or hand-edited saves fall back to sane defaults.
- [Vitest](https://vitest.dev) tests cover number formatting, the economy, data integrity, saves, and a pacing simulation that plays the game for 16 simulated hours to check descent pacing stays sane.

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
