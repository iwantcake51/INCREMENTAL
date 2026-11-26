# Contributing

Thanks for helping build the orrery.

## Workflow

1. Create a branch from `main`, named for what you're adding, for example `add-pluto` or `fix-saturn-rings`.
2. `npm install`, then `npm run dev` and make your change.
3. Run `npm run typecheck` and `npm test`. Check the page in a browser with no console errors, at desktop and phone width.
4. Push your branch and open a pull request into `main`. Fill in the template.
5. The owner reviews it and merges it.

If you aren't a collaborator, fork the repo first and open the pull request from your fork.

## Where things go

- Real numbers and history go in `src/data/` (`bodies.ts`, `history.ts`, the real part of `timeline.ts`). Cite where a number comes from in your pull request.
- Anything invented, like future eras, factions or weapons, must stay clearly labeled as projected or fictional in the page.
- Simulation logic lives in `src/sim/` and must not import from `src/render/` or `src/ui/`, so it stays testable.
- New 3D things go in a layer under `src/render/`; shaders live in `src/render/shaders/`.
- Textures go in `src/assets/textures/` as WebP. Credit the source in `src/render/textures.ts` and the README.

## Ideas

- Dwarf planets (Pluto, Eris) with their own facts
- More real spacecraft
- Sound design for battles and launches
