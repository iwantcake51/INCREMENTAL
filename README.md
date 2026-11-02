# Astral Forge

*Click the star. Forge a universe.*

An incremental (clicker/idle) web game. You start by tapping a star for stardust and end up running a whole observatory of machines. Along the way you go supernova, chart a 66-node constellation skill tree and survive trials that bend the rules.

It runs entirely in the browser: no server, no tracking. Progress is saved locally.

## Features

- **The star.** Every click has weight: the star squashes, sparks fly, and floating numbers rise. Each click sound is a note on a pentatonic scale that climbs as your combo grows, so fast clicking turns into a little melody. Critical clicks ring out with a shockwave.
- **Combos and crits.** Keep a rhythm to fill the combo ring around the star. Crits and combo depth can be upgraded.
- **12 machines**, from the humble Spark Catcher to the Big Bang Kiln. Buy ×1, ×10, ×100 or Max.
- **170 upgrades.** Every machine has 10 tiers, plus synergies between machines and upgrades for clicks, crits, combos, comets and global production.
- **Comets** streak across the sky. Catch one for a Starfall of stardust or a buff: Frenzy, Click Storm or Combo Lock.
- **Cosmic events.** Every few minutes the sky changes the rules for a while:
  - Meteor Shower (production ×3)
  - Solar Eclipse (clicks ×10, production halved)
  - Gravitational Lensing (everything 30% cheaper)
  - Stellar Alignment (production and clicks ×2)
  - Comet Swarm
  - Stardust Surge (combo cap +100, combo never fades)
  - Lucky Constellation (+25% crit chance)
  - Coronal Burst (each click also grants 1s of production)
  - Pulsar Beat (production swings between ×1 and ×6)
  - Nebula Drift (production ×1.5 for three minutes)
- **Supernova (rebirth).** Explode your star for Nova Shards. Shards boost production permanently and buy constellation nodes.
- **The Constellation.** A pannable, zoomable skill tree with 66 nodes across Touch, Forge, Cosmos and Nova branches, plus Confluence links, a per-machine Attunement arc and the Singularity apex. It unlocks autobuyers, auto-supernova, offline gains, comet mastery and more. You can respec at any time.
- **8 Trials.** Restricted runs (no clicking, no upgrades, inflation, entropy…) with permanent rewards.
- **134 feats (achievements)**, including secret ones. Each gives +1% production.
- **Ledger** with detailed statistics.
- **Offline progress**, with a "welcome back" summary.
- **Settings:**
  - number notation (standard, scientific, engineering, letters)
  - four color palettes and interface size
  - particles, floating numbers, animated sky and reduced-motion toggles
  - volume, mute and vibration
  - confirmations, autosave interval and offline progress
  - save export/import (code or file) and hard reset
- **Keyboard shortcuts.** `1`–`7` switch tabs, `B` cycles buy amount, `U` buys all upgrades, `M` mutes, `Ctrl+S` saves.
- Works on phones: touch-friendly, long-press for details, haptics on supported devices.

## Tech

- [Vite 8](https://vite.dev) and **TypeScript 7** (native compiler). No UI framework: plain DOM with change-detected updates.
- Fixed 20 Hz logic tick plus a `requestAnimationFrame` render loop. Text only updates when it changes, panels refresh only while visible, and the effects canvas sleeps when idle. Particles are pooled, and the sky is cached to an offscreen canvas and paused in background tabs.
- Native `<dialog>` modals with `@starting-style` entry animations, an animated exit with a fallback, and light-dismiss with a fallback.
- Sounds are synthesized with the Web Audio API (oscillators, filtered noise and a generated reverb). There are no audio files.
- Save data is validated field by field on load and import, so broken or hand-edited saves fall back to sane defaults.
- [Vitest](https://vitest.dev) tests cover number formatting, the economy, data integrity, saves, and a pacing simulation that plays the game for 16 simulated hours to check rebirth pacing stays sane.

## Develop

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests + pacing simulation
npm run build     # type-check and build to dist/
```

`npm run icons` regenerates `src/ui/icons.gen.ts`, which contains only the icons the game references. It also runs automatically before `dev` and `build`.

## Deploy

`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every push to `main`. Enable it under **Settings → Pages → Source: GitHub Actions**. The build uses relative paths, so it also works on itch.io or any static host.

## Credits

- Icons: [game-icons.net](https://game-icons.net) by Lorc, Delapouite and contributors, licensed under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). They are packaged through [`@iconify-json/game-icons`](https://www.npmjs.com/package/@iconify-json/game-icons) and recolored in-game.
- Typefaces: [Fraunces](https://fonts.google.com/specimen/Fraunces) and [Instrument Sans](https://fonts.google.com/specimen/Instrument+Sans), via Fontsource, under the SIL Open Font License.
