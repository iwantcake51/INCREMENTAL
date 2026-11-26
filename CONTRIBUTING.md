# Contributing

Thanks for helping build the orrery.

## Workflow

1. Create a branch from `main`, named for what you're adding, for example `add-pluto` or `fix-saturn-rings`.
2. Make your change. Everything lives in `index.html`: styles at the top, markup in the middle, the simulation script at the bottom.
3. Open `index.html` in a browser and check that it works, with no errors in the browser console.
4. Push your branch and open a pull request into `main`. Fill in the template.
5. The owner reviews it and merges it.

If you aren't a collaborator, fork the repo first and open the pull request from your fork.

## Guidelines

- Keep it one file with no build step. Libraries may only load from a CDN script tag.
- Real science goes in `FACTS` and `LIFE`. Cite where a number comes from in your pull request.
- Anything invented, like future eras, factions or weapons, must stay clearly labeled as projected or fictional in the page.
- Check the layout at phone width as well as desktop.

## Ideas

- Dwarf planets (Pluto, Ceres, Eris) with their own facts
- Comets on long elliptical orbits
- A save slot for your war and timeline
- Sound for battles and freighters
